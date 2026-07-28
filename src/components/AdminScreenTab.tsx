"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import {
  SCREEN_PATHS,
  type ScreenCommand,
  type ScreenPath,
  type ScreenState,
} from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { deferCallback } from "@/lib/deferCallback";

const SCREEN_LABELS: Record<ScreenPath, string> = {
  "/wall": "🖼️ Mur",
  "/planning": "📅 Planning",
  "/timeline": "🕰️ Frise",
  "/countdown": "⏳ Countdown",
  "/classement": "🏆 Classement",
  "/retrospective": "🎬 Rétrospective",
};

interface AdminScreenTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

function useHoldRepeat(action: () => void) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    action();
    stop();
    intervalRef.current = setInterval(action, 200);
  }, [action, stop]);

  useEffect(() => stop, [stop]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      start();
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
  };
}

export function AdminScreenTab({ onUnauthorized }: AdminScreenTabProps) {
  const { showToast } = useToast();
  const [state, setState] = useState<ScreenState>({
    path: "/wall",
    volume: 0.5,
    zoom: 1,
  });
  const [loading, setLoading] = useState(true);
  const [volumePercent, setVolumePercent] = useState(50);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyState = useCallback((next: ScreenState) => {
    setState(next);
    setVolumePercent(Math.round(next.volume * 100));
    setZoomPercent(Math.round(next.zoom * 100));
  }, []);

  const load = useCallback(async () => {
    try {
      const remote = await getPhotoService().getScreenState();
      applyState(remote);
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("État écran indisponible", "error");
    } finally {
      setLoading(false);
    }
  }, [applyState, onUnauthorized, showToast]);

  useEffect(() => {
    deferCallback(() => void load());
  }, [load]);

  useEffect(() => {
    const unsub = getPhotoService().onScreenCommand((cmd) => {
      setState((prev) => {
        const next = { ...prev };
        if (cmd.type === "navigate") next.path = cmd.path;
        if (cmd.type === "volume") next.volume = cmd.value;
        if (cmd.type === "zoom") next.zoom = cmd.level;
        return next;
      });
      if (cmd.type === "volume") {
        setVolumePercent(Math.round(cmd.value * 100));
      }
      if (cmd.type === "zoom") {
        setZoomPercent(Math.round(cmd.level * 100));
      }
    });
    return unsub;
  }, []);

  async function send(cmd: ScreenCommand) {
    try {
      await getPhotoService().sendScreenCommand(cmd);
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Commande échouée", "error");
    }
  }

  function navigate(path: ScreenPath) {
    void send({ type: "navigate", path });
  }

  function scroll(direction: "up" | "down" | "top" | "bottom") {
    void send({ type: "scroll", direction });
  }

  const scrollUpHold = useHoldRepeat(() => scroll("up"));
  const scrollDownHold = useHoldRepeat(() => scroll("down"));

  function setVolumeDebounced(percent: number) {
    setVolumePercent(percent);
    if (volumeDebounceRef.current) clearTimeout(volumeDebounceRef.current);
    volumeDebounceRef.current = setTimeout(() => {
      void send({ type: "volume", value: percent / 100 });
    }, 100);
  }

  function setVolumeImmediate(percent: number) {
    setVolumePercent(percent);
    void send({ type: "volume", value: percent / 100 });
  }

  function setZoomLevel(percent: number) {
    setZoomPercent(percent);
    void send({ type: "zoom", level: percent / 100 });
  }

  async function launchRetrospective() {
    await send({ type: "navigate", path: "/retrospective" });
    await send({ type: "action", name: "retrospective:start" });
    setIsPlaying(true);
  }

  if (loading) return <p className="text-purple-200">Chargement…</p>;

  return (
    <div className="max-w-lg space-y-8 pb-8">
      {/* A) Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">
            📺 Télécommande écran
          </h2>
          <p className="mt-1 text-sm text-purple-200">
            Affichage actuel :{" "}
            <span className="font-mono text-white">{state.path}</span>
          </p>
        </div>
        <Link
          href="/screen"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-transform active:scale-95"
        >
          Ouvrir l&apos;écran →
        </Link>
      </div>

      {/* B) Navigation */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-purple-200">Navigation</h3>
        <div className="grid grid-cols-2 gap-3">
          {SCREEN_PATHS.map((path) => {
            const active = state.path === path;
            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                className={`min-h-16 cursor-pointer rounded-2xl px-4 py-4 text-left text-sm font-semibold ring-1 transition-transform active:scale-95 ${
                  active
                    ? "bg-linear-to-r from-pink-500 to-purple-500 text-white shadow-lg ring-pink-300/40"
                    : "bg-white/5 text-white ring-white/15 hover:bg-white/10"
                }`}
              >
                {SCREEN_LABELS[path]}
              </button>
            );
          })}
        </div>
      </section>

      {/* C) Scroll pad */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-purple-200">Défilement</h3>
        <div className="mx-auto grid max-w-xs grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => scroll("top")}
            className="min-h-14 rounded-2xl bg-white/5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 active:scale-95"
          >
            ⬆️ Haut
          </button>
          <button
            type="button"
            className="min-h-14 touch-none rounded-2xl bg-white/5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 select-none active:scale-95"
            {...scrollUpHold}
          >
            ⬆ Défiler ⬆
          </button>
          <button
            type="button"
            className="min-h-14 touch-none rounded-2xl bg-white/5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 select-none active:scale-95"
            {...scrollDownHold}
          >
            ⬇ Défiler ⬇
          </button>
          <button
            type="button"
            onClick={() => scroll("bottom")}
            className="min-h-14 rounded-2xl bg-white/5 py-3 text-sm font-semibold text-white ring-1 ring-white/15 active:scale-95"
          >
            ⬇️ Bas
          </button>
        </div>
      </section>

      {/* D) Musique */}
      <section className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/15">
        <h3 className="text-sm font-semibold text-purple-200">
          🎵 Musique · {volumePercent}%
        </h3>

        {/* Play / Pause / Stop */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !isPlaying;
              setIsPlaying(next);
              void send({ type: "action", name: "audio:toggle" });
            }}
            className={`flex-1 min-h-12 rounded-2xl text-sm font-bold ring-1 transition-transform active:scale-95 ${
              isPlaying
                ? "bg-yellow-500/20 text-yellow-100 ring-yellow-400/30"
                : "bg-green-500/20 text-green-100 ring-green-400/30"
            }`}
          >
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false);
              void send({ type: "action", name: "audio:stop" });
            }}
            className="min-h-12 rounded-2xl bg-red-500/20 px-4 text-sm font-bold text-red-100 ring-1 ring-red-400/30 active:scale-95"
          >
            ⏹ Stop
          </button>
        </div>

        {/* Slider volume */}
        <input
          type="range"
          min={0}
          max={100}
          value={volumePercent}
          onChange={(e) => setVolumeDebounced(Number(e.target.value))}
          className="w-full accent-pink-500"
        />
        <div className="flex flex-wrap gap-2">
          {[
            { label: "🔇 0%", value: 0 },
            { label: "🔉 30%", value: 30 },
            { label: "🔊 70%", value: 70 },
            { label: "📢 100%", value: 100 },
          ].map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => setVolumeImmediate(value)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white ring-1 ring-white/20"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* E) Zoom */}
      <section className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/15">
        <h3 className="text-sm font-semibold text-purple-200">
          Zoom · {zoomPercent}%
        </h3>
        <input
          type="range"
          min={50}
          max={200}
          value={zoomPercent}
          onChange={(e) => setZoomLevel(Number(e.target.value))}
          className="w-full accent-purple-500"
        />
        <div className="flex flex-wrap gap-2">
          {[75, 100, 125, 150].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setZoomLevel(value)}
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white ring-1 ring-white/20"
            >
              {value}%
            </button>
          ))}
        </div>
      </section>

      {/* F) Actions */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-purple-200">
          Actions spéciales
        </h3>
        <div className="grid gap-3">
          <button
            type="button"
            onClick={() => void launchRetrospective()}
            className="min-h-14 rounded-2xl bg-amber-500/20 px-4 py-3 text-sm font-bold text-amber-100 ring-1 ring-amber-400/30 active:scale-95"
          >
            🎬 Lancer la rétrospective
          </button>
          <button
            type="button"
            onClick={() =>
              void send({ type: "action", name: "confetti:burst" })
            }
            className="min-h-14 rounded-2xl bg-amber-500/20 px-4 py-3 text-sm font-bold text-amber-100 ring-1 ring-amber-400/30 active:scale-95"
          >
            🎉 Burst confettis
          </button>
          <button
            type="button"
            onClick={() => void send({ type: "fullscreen" })}
            className="min-h-14 rounded-2xl bg-amber-500/20 px-4 py-3 text-sm font-bold text-amber-100 ring-1 ring-amber-400/30 active:scale-95"
          >
            ⛶ Plein écran
          </button>
        </div>
      </section>
    </div>
  );
}
