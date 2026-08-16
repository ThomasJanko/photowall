"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { useEventConfig } from "@/components/EventThemeProvider";
import { QuickNav } from "@/components/QuickNav";
import { buildNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { usePathname } from "next/navigation";
import { getPhotoService } from "@/lib/photoService";
import type { TimerState } from "@/lib/types";
import { effectiveElapsedMs, formatDuration } from "@/lib/timerFormat";
import { playTimerTick, playTimerEnd } from "@/lib/timerSound";

const TARGET_FALLBACK = "2026-07-18T00:00:00";
/** Nombre de secondes restantes à partir desquelles le minuteur passe en rouge + bip. */
const TIMER_ALERT_SEC = 5;

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Millisecondes restantes (<= 0 quand c'est l'heure). */
  total: number;
}

function getRemaining(target: Date, nowMs: number): Remaining {
  const total = target.getTime() - nowMs;
  const clamped = Math.max(0, total);
  return {
    days: Math.floor(clamped / 86_400_000),
    hours: Math.floor(clamped / 3_600_000) % 24,
    minutes: Math.floor(clamped / 60_000) % 60,
    seconds: Math.floor(clamped / 1000) % 60,
    total,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Pluie de confettis dense pour la célébration : réutilise la classe
 * .confetti-piece / @keyframes confetti-fall existantes, en plus nombreux
 * et plus rapides. Génération déterministe (pas de mismatch d'hydratation).
 */
const CELEBRATION_COLORS = [
  "#facc15", // or
  "#f472b6", // rose
  "#c084fc", // violet
  "#34d399", // vert
  "#60a5fa", // bleu
  "#fb923c", // orange
];

const CELEBRATION_PIECES = Array.from({ length: 48 }, (_, i) => ({
  left: (i * 41 + 7) % 100,
  delay: -(((i * 23) % 50) / 10), // -0 → -4.9s : écran plein immédiatement
  duration: 2.2 + ((i * 17) % 30) / 10, // 2.2 → 5.1s : chute rapide
  size: 7 + ((i * 11) % 8), // 7 → 14px
  color: CELEBRATION_COLORS[i % CELEBRATION_COLORS.length],
  round: i % 4 === 0,
}));

function CelebrationConfetti() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {CELEBRATION_PIECES.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece absolute ${
            p.round ? "rounded-full" : "rounded-[2px]"
          }`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Vue "Chrono" (stopwatch) : compte le temps écoulé depuis le lancement. */
function StopwatchView({ state, now }: { state: TimerState; now: number }) {
  const elapsedMs = effectiveElapsedMs(state, now);
  return (
    <div className="relative z-10 flex flex-col items-center gap-8 text-center sm:gap-12">
      <p className="text-lg tracking-widest text-purple-200 uppercase sm:text-2xl md:text-3xl">
        ⏱️ Chrono
      </p>
      <div className="rounded-2xl bg-white/10 px-8 py-10 ring-1 ring-white/15 backdrop-blur-sm sm:px-16 sm:py-14">
        <span className="text-6xl font-extrabold text-white tabular-nums drop-shadow-lg sm:text-8xl md:text-9xl">
          {formatDuration(elapsedMs, "floor")}
        </span>
      </div>
    </div>
  );
}

/** Vue "Minuteur" : décompte depuis durationMs, dernières secondes en rouge. */
function TimerView({
  state,
  now,
  alert,
}: {
  state: TimerState;
  now: number;
  alert: boolean;
}) {
  const remainingMs = Math.max(
    0,
    state.durationMs - effectiveElapsedMs(state, now)
  );
  const done = remainingMs <= 0;
  const highlight = alert || done;

  return (
    <div className="relative z-10 flex flex-col items-center gap-8 text-center sm:gap-12">
      <p className="text-lg tracking-widest text-purple-200 uppercase sm:text-2xl md:text-3xl">
        ⏳ Minuteur
      </p>
      <div
        className={`rounded-2xl px-8 py-10 ring-1 backdrop-blur-sm transition-colors duration-300 sm:px-16 sm:py-14 ${
          highlight
            ? "timer-alert-panel bg-red-500/15 ring-red-400/50"
            : "bg-white/10 ring-white/15"
        }`}
      >
        <span
          className={`text-6xl font-extrabold tabular-nums drop-shadow-lg sm:text-8xl md:text-9xl ${
            highlight ? "timer-alert-digits text-red-400" : "text-white"
          }`}
        >
          {formatDuration(remainingMs, "ceil")}
        </span>
      </div>
      {done && (
        <p className="text-xl font-bold text-red-300 sm:text-3xl">
          ⏰ Temps écoulé !
        </p>
      )}
    </div>
  );
}

export default function CountdownPage() {
  const pathname = usePathname();
  const { config } = useEventConfig();
  const isAdmin = useIsAdmin();
  const navLinks = useMemo(
    () => buildNavLinks(pathname, config.features, isAdmin),
    [pathname, config.features, isAdmin]
  );
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── Chrono / minuteur pilotés par l'admin (onglet "Chrono") ────────────────
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const lastTickSecondRef = useRef<number | null>(null);
  const endPlayedRef = useRef(false);

  // Date du countdown final, réglée en direct depuis l'onglet admin "Chrono"
  // (plus de dépendance à la config statique ni au .env).
  const targetDate = new Date(timerState?.finalTargetAt ?? TARGET_FALLBACK);

  useEffect(() => {
    const service = getPhotoService();
    service.getTimerState().then(setTimerState).catch(() => {});
    const unsub = service.onTimerState(setTimerState);
    return unsub;
  }, []);

  // Un minuteur remis à zéro (reset / nouvelle durée / nouveau mode) doit
  // pouvoir rejouer ses sons depuis le début.
  useEffect(() => {
    if (!timerState) return;
    if (!timerState.running && timerState.elapsedMs === 0) {
      lastTickSecondRef.current = null;
      endPlayedRef.current = false;
    }
  }, [timerState]);

  // Rafraîchit l'affichage pendant que le chrono/minuteur tourne et déclenche
  // les sons du minuteur (bip des 5 dernières secondes, buzzer à 0).
  useEffect(() => {
    if (!timerState || !timerState.running) return;
    const interval = setInterval(() => {
      const nowMs = Date.now();
      setTimerNow(nowMs);

      if (timerState.mode !== "timer") return;
      const remainingMs = Math.max(
        0,
        timerState.durationMs - effectiveElapsedMs(timerState, nowMs)
      );
      if (remainingMs <= 0) {
        if (!endPlayedRef.current) {
          endPlayedRef.current = true;
          playTimerEnd();
        }
        return;
      }
      const remainingSec = Math.ceil(remainingMs / 1000);
      if (
        remainingSec <= TIMER_ALERT_SEC &&
        lastTickSecondRef.current !== remainingSec
      ) {
        lastTickSecondRef.current = remainingSec;
        playTimerTick();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [timerState]);

  const remaining = now === null ? null : getRemaining(targetDate, now);
  const isOver = remaining !== null && remaining.total <= 0;

  // Unités affichées : on masque jours/heures quand elles sont à zéro
  // (même soir = juste minutes/secondes en très grand).
  const units =
    remaining === null
      ? [
          { label: "minutes", value: "--" },
          { label: "secondes", value: "--" },
        ]
      : [
          ...(remaining.days > 0
            ? [
                {
                  label: remaining.days > 1 ? "jours" : "jour",
                  value: String(remaining.days),
                },
              ]
            : []),
          ...(remaining.days > 0 || remaining.hours > 0
            ? [{ label: "heures", value: pad2(remaining.hours) }]
            : []),
          { label: "minutes", value: pad2(remaining.minutes) },
          { label: "secondes", value: pad2(remaining.seconds) },
        ];

  // ─── Chrono ou minuteur actif : prend le pas sur le countdown final ────────
  if (timerState && timerState.mode !== "off") {
    const timerRemainingMs =
      timerState.mode === "timer"
        ? Math.max(
            0,
            timerState.durationMs - effectiveElapsedMs(timerState, timerNow)
          )
        : 0;
    const alert =
      timerState.mode === "timer" &&
      timerRemainingMs > 0 &&
      timerRemainingMs <= TIMER_ALERT_SEC * 1000;

    return (
      <main className="event-gradient-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-6">
        {config.features.confetti && <ConfettiBackground />}
        {timerState.mode === "stopwatch" ? (
          <StopwatchView state={timerState} now={timerNow} />
        ) : (
          <TimerView state={timerState} now={timerNow} alert={alert} />
        )}
        <QuickNav links={navLinks} position="bottom-left" />
      </main>
    );
  }

  return (
    <main className="event-gradient-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-6">
      {isOver
        ? config.features.confetti && <CelebrationConfetti />
        : config.features.confetti && <ConfettiBackground />}

      {isOver ? (
        /* ------ Célébration ------ */
        <div className="relative z-10 flex flex-col items-center gap-10 text-center">
          <h1 className="celebration-pop text-5xl font-extrabold text-white drop-shadow-[0_4px_24px_rgba(244,114,182,0.6)] sm:text-7xl md:text-8xl lg:text-9xl">
            {config.celebrationText}
          </h1>
        </div>
      ) : (
        /* ------ Compte à rebours ------ */
        <div className="relative z-10 flex flex-col items-center gap-8 text-center sm:gap-12">
          <p className="text-lg tracking-widest text-purple-200 uppercase sm:text-2xl md:text-3xl">
            🎂 Le grand moment approche...
          </p>

          <div className="flex flex-wrap items-stretch justify-center gap-3 sm:gap-5 md:gap-8">
            {units.map((unit) => (
              <div
                key={unit.label}
                className="flex min-w-20 flex-col items-center gap-2 rounded-2xl bg-white/10 px-4 py-5 ring-1 ring-white/15 backdrop-blur-sm sm:min-w-32 sm:px-7 sm:py-8 md:min-w-44"
              >
                <span className="text-5xl font-extrabold text-white tabular-nums drop-shadow-lg sm:text-7xl md:text-8xl lg:text-9xl">
                  {unit.value}
                </span>
                <span className="text-xs tracking-widest text-purple-200 uppercase sm:text-base md:text-lg">
                  {unit.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <QuickNav links={navLinks} position="bottom-left" />
    </main>
  );
}
