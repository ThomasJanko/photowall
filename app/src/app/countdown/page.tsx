"use client";

import { useEffect, useState, useMemo } from "react";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { useEventConfig } from "@/components/EventThemeProvider";
import { QuickNav } from "@/components/QuickNav";
import { buildBackNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";

const TARGET_FALLBACK = "2026-07-18T00:00:00";

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

export default function CountdownPage() {
  const { config } = useEventConfig();
  const isAdmin = useIsAdmin();
  const navLinks = useMemo(() => buildBackNavLinks(isAdmin), [isAdmin]);
  const targetDate = new Date(
    process.env.NEXT_PUBLIC_TARGET_DATE ??
      config.countdownTarget ??
      TARGET_FALLBACK
  );
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

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
            ? [{ label: remaining.days > 1 ? "jours" : "jour", value: String(remaining.days) }]
            : []),
          ...(remaining.days > 0 || remaining.hours > 0
            ? [{ label: "heures", value: pad2(remaining.hours) }]
            : []),
          { label: "minutes", value: pad2(remaining.minutes) },
          { label: "secondes", value: pad2(remaining.seconds) },
        ];

  return (
    <main className="relative min-h-dvh overflow-hidden event-gradient-bg flex flex-col items-center justify-center p-6">
      {isOver ? (
        config.features.confetti && <CelebrationConfetti />
      ) : (
        config.features.confetti && <ConfettiBackground />
      )}

      {isOver ? (
        /* ------ Célébration ------ */
        <div className="relative z-10 flex flex-col items-center gap-10 text-center">
          <h1 className="celebration-pop text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold text-white drop-shadow-[0_4px_24px_rgba(244,114,182,0.6)]">
            {config.celebrationText}
          </h1>
        </div>
      ) : (
        /* ------ Compte à rebours ------ */
        <div className="relative z-10 flex flex-col items-center gap-8 sm:gap-12 text-center">
          <p className="text-purple-200 text-lg sm:text-2xl md:text-3xl tracking-widest uppercase">
            🎂 Le grand moment approche...
          </p>

          <div className="flex flex-wrap items-stretch justify-center gap-3 sm:gap-5 md:gap-8">
            {units.map((unit) => (
              <div
                key={unit.label}
                className="flex min-w-20 sm:min-w-32 md:min-w-44 flex-col items-center gap-2 rounded-2xl bg-white/10 px-4 py-5 sm:px-7 sm:py-8 ring-1 ring-white/15 backdrop-blur-sm"
              >
                <span className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-extrabold tabular-nums text-white drop-shadow-lg">
                  {unit.value}
                </span>
                <span className="text-xs sm:text-base md:text-lg uppercase tracking-widest text-purple-200">
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
