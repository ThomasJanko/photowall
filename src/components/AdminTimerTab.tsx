"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type { TimerMode, TimerState } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { deferCallback } from "@/lib/deferCallback";
import { effectiveElapsedMs, formatDuration } from "@/lib/timerFormat";

const DEFAULT_STATE: TimerState = {
  mode: "off",
  running: false,
  durationMs: 60_000,
  startedAt: null,
  elapsedMs: 0,
  finalTargetAt: "2026-07-18T00:00:00",
};

const MODE_OPTIONS: { mode: TimerMode; label: string; hint: string }[] = [
  {
    mode: "off",
    label: "🎉 Countdown final",
    hint: "/countdown affiche le compte à rebours vers la soirée.",
  },
  {
    mode: "stopwatch",
    label: "⏱️ Chrono",
    hint: "Compte le temps écoulé (chronométrer un jeu, un discours...).",
  },
  {
    mode: "timer",
    label: "⏳ Minuteur",
    hint: "Décompte depuis une durée. Dernières secondes en rouge + son.",
  },
];

const DURATION_PRESETS_SEC = [30, 60, 120, 180, 300];

interface AdminTimerTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

export function AdminTimerTab({ onUnauthorized }: AdminTimerTabProps) {
  const { showToast } = useToast();
  const [state, setState] = useState<TimerState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [minutesInput, setMinutesInput] = useState(1);
  const [secondsInput, setSecondsInput] = useState(0);
  const [finalTargetInput, setFinalTargetInput] = useState(
    DEFAULT_STATE.finalTargetAt
  );

  const load = async () => {
    try {
      const remote = await getPhotoService().getTimerState();
      setState(remote);
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("État chrono indisponible", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    deferCallback(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = getPhotoService().onTimerState(setState);
    return unsub;
  }, []);

  // Garde le champ de saisie synchronisé avec la valeur serveur (initiale ou
  // modifiée depuis un autre poste admin).
  useEffect(() => {
    setFinalTargetInput(state.finalTargetAt);
  }, [state.finalTargetAt]);

  // Rafraîchissement local de l'affichage pendant que ça tourne.
  useEffect(() => {
    if (!state.running) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [state.running]);

  const elapsedMs = useMemo(
    () => effectiveElapsedMs(state, now),
    [state, now]
  );
  const remainingMs =
    state.mode === "timer" ? Math.max(0, state.durationMs - elapsedMs) : 0;
  const isTimerDone = state.mode === "timer" && remainingMs <= 0;
  const isLastSeconds = state.mode === "timer" && remainingMs <= 5000 && remainingMs > 0;

  async function send(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      if (onUnauthorized(err)) return;
      console.error(err);
      showToast("Commande échouée", "error");
    }
  }

  function setMode(mode: TimerMode) {
    void send(() => getPhotoService().sendTimerCommand({ type: "setMode", mode }));
  }

  function applyDuration() {
    const durationMs = Math.max(1, minutesInput * 60 + secondsInput) * 1000;
    void send(() =>
      getPhotoService().sendTimerCommand({ type: "setDuration", durationMs })
    );
  }

  function applyPreset(sec: number) {
    setMinutesInput(Math.floor(sec / 60));
    setSecondsInput(sec % 60);
    void send(() =>
      getPhotoService().sendTimerCommand({
        type: "setDuration",
        durationMs: sec * 1000,
      })
    );
  }

  function applyFinalTarget() {
    if (!finalTargetInput) return;
    void send(() =>
      getPhotoService().sendTimerCommand({
        type: "setFinalTarget",
        targetAt: finalTargetInput,
      })
    );
  }

  function start() {
    void send(() => getPhotoService().sendTimerCommand({ type: "start" }));
  }
  function pause() {
    void send(() => getPhotoService().sendTimerCommand({ type: "pause" }));
  }
  function reset() {
    void send(() => getPhotoService().sendTimerCommand({ type: "reset" }));
  }

  if (loading) return <p className="text-purple-200">Chargement…</p>;

  const displayMs = state.mode === "timer" ? remainingMs : elapsedMs;

  return (
    <div className="max-w-lg space-y-8 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">⏱️ Chrono & minuteur</h2>
          <p className="mt-1 text-sm text-purple-200">
            Visible en direct sur /countdown (mur, écran TV, invités).
          </p>
        </div>
        <Link
          href="/countdown"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-transform active:scale-95"
        >
          Ouvrir /countdown →
        </Link>
      </div>

      {/* Sélecteur de mode */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-purple-200">Mode</h3>
        <div className="grid gap-3">
          {MODE_OPTIONS.map((opt) => {
            const active = state.mode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setMode(opt.mode)}
                className={`rounded-2xl px-4 py-3 text-left ring-1 transition-transform active:scale-95 ${
                  active
                    ? "bg-linear-to-r from-pink-500 to-purple-500 text-white shadow-lg ring-pink-300/40"
                    : "bg-white/5 text-white ring-white/15 hover:bg-white/10"
                }`}
              >
                <span className="block text-sm font-bold">{opt.label}</span>
                <span
                  className={`block text-xs ${active ? "text-white/85" : "text-purple-200"}`}
                >
                  {opt.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Date du countdown final : réglable en direct, indépendamment du mode actif */}
      <section className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/15">
        <h3 className="text-sm font-semibold text-purple-200">
          🎉 Date de la soirée (countdown final)
        </h3>
        <p className="text-xs text-purple-300">
          Utilisée par /countdown en mode « Countdown final ». Appliquée en
          direct, aucun rechargement nécessaire.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            step={1}
            value={finalTargetInput}
            onChange={(e) => setFinalTargetInput(e.target.value)}
            className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/20 [color-scheme:dark]"
          />
          <button
            type="button"
            onClick={applyFinalTarget}
            disabled={!finalTargetInput}
            className="cursor-pointer rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Définir
          </button>
        </div>
      </section>

      {state.mode !== "off" && (
        <>
          {/* Réglage durée (minuteur uniquement) */}
          {state.mode === "timer" && (
            <section className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/15">
              <h3 className="text-sm font-semibold text-purple-200">
                Durée du minuteur
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={minutesInput}
                  onChange={(e) =>
                    setMinutesInput(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="w-20 rounded-xl bg-white/10 px-3 py-2 text-center text-white ring-1 ring-white/20"
                  aria-label="Minutes"
                />
                <span className="text-purple-200">min</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={secondsInput}
                  onChange={(e) =>
                    setSecondsInput(
                      Math.min(59, Math.max(0, Number(e.target.value) || 0))
                    )
                  }
                  className="w-20 rounded-xl bg-white/10 px-3 py-2 text-center text-white ring-1 ring-white/20"
                  aria-label="Secondes"
                />
                <span className="text-purple-200">sec</span>
                <button
                  type="button"
                  onClick={applyDuration}
                  className="ml-auto cursor-pointer rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 active:scale-95"
                >
                  Définir
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS_SEC.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => applyPreset(sec)}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white ring-1 ring-white/20"
                  >
                    {sec < 60 ? `${sec}s` : `${sec / 60}min`}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Affichage live + contrôles */}
          <section className="space-y-4 rounded-2xl bg-white/5 p-6 text-center ring-1 ring-white/15">
            <p
              className={`text-6xl font-extrabold tabular-nums ${
                isLastSeconds || isTimerDone ? "text-red-400" : "text-white"
              }`}
            >
              {formatDuration(displayMs, state.mode === "timer" ? "ceil" : "floor")}
            </p>
            {isTimerDone && (
              <p className="text-sm font-semibold text-red-300">
                ⏰ Temps écoulé — réinitialise pour relancer.
              </p>
            )}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={state.running ? pause : start}
                disabled={isTimerDone && !state.running}
                className={`min-h-12 flex-1 max-w-40 cursor-pointer rounded-2xl text-sm font-bold ring-1 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                  state.running
                    ? "bg-yellow-500/20 text-yellow-100 ring-yellow-400/30"
                    : "bg-green-500/20 text-green-100 ring-green-400/30"
                }`}
              >
                {state.running ? "⏸ Pause" : "▶ Lancer"}
              </button>
              <button
                type="button"
                onClick={reset}
                className="min-h-12 flex-1 max-w-40 cursor-pointer rounded-2xl bg-red-500/20 text-sm font-bold text-red-100 ring-1 ring-red-400/30 transition-transform active:scale-95"
              >
                ⟲ Réinitialiser
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
