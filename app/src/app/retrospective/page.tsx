"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";
import { QuickNav } from "@/components/QuickNav";
import { buildBackNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useEventConfig } from "@/components/EventThemeProvider";
import { computeRetrospectiveStats } from "@/lib/retrospectiveStats";
import { buildRetrospectiveScenes } from "@/lib/retrospectiveScenes";
import { RetrospectiveShow } from "@/components/retrospective/RetrospectiveShow";

// ============================================================================
const MUSIC_SRC = "/music/retrospective.mp3";
const MUSIC_VOLUME = 0.5;
const CLOSING_MESSAGE =
  "Merci d'avoir fêté ces 25 ans avec nous ❤️";
// ============================================================================

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
}

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onVolumeChange: (value: number) => void;
  onToggleMute: () => void;
  compact?: boolean;
}

function VolumeControl({
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
  compact = false,
}: VolumeControlProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur-sm ${
        compact ? "px-2 py-2" : "px-4 py-3"
      }`}
    >
      <button
        type="button"
        onClick={onToggleMute}
        title={muted ? "Remettre le son" : "Couper le son"}
        className="shrink-0 text-white/70 hover:text-white active:scale-95 transition-transform"
      >
        {muted || volume === 0 ? "🔇" : "🔊"}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
        aria-label="Volume"
        className={`accent-purple-400 ${compact ? "w-16 sm:w-24" : "w-28 sm:w-40"}`}
      />
    </div>
  );
}

export default function RetrospectivePage() {
  const { config } = useEventConfig();
  const isAdmin = useIsAdmin();
  const navLinks = useMemo(() => buildBackNavLinks(isAdmin), [isAdmin]);

  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [started, setStarted] = useState(false);
  const [volume, setVolume] = useState(MUSIC_VOLUME);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    getPhotoService()
      .listPhotos()
      .then((list) =>
        setPhotos(list.map((p) => ({ ...p, url: resolveUrl(p.url) })))
      )
      .catch((err) => {
        console.error(err);
        setPhotos([]);
      });
  }, []);

  const stats = useMemo(() => {
    if (!photos) return null;
    return computeRetrospectiveStats(photos, config.reactionEmojis);
  }, [photos, config.reactionEmojis]);

  const scenes = useMemo(() => {
    if (!stats || !photos) return [];
    return buildRetrospectiveScenes(stats, photos);
  }, [stats, photos]);

  const eventTitle =
    config.eventName.trim() || "✨ Rétrospective de la soirée ✨";

  function handleStart() {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      audio.muted = muted;
      audio.play().catch((err) => console.warn("Musique indisponible:", err));
    }
    setStarted(true);
  }

  const count = photos?.length ?? 0;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black">
      <audio ref={audioRef} src={MUSIC_SRC} loop preload="auto" />

      {photos === null && (
        <div className="flex min-h-dvh items-center justify-center">
          <p className="text-purple-200 text-xl">Chargement des photos...</p>
        </div>
      )}

      {photos !== null && count === 0 && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
          <p className="text-white text-2xl">Aucune photo à afficher 😢</p>
          <Link
            href="/wall"
            className="rounded-full bg-white/10 text-purple-100 font-semibold px-6 py-3 ring-1 ring-white/25 active:scale-95 transition-transform"
          >
            ← Retour au mur
          </Link>
        </div>
      )}

      {photos !== null && count > 0 && !started && (
        <div className="event-gradient-bg flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white drop-shadow-lg">
            🎬 Rétrospective de la soirée
          </h1>
          <p className="text-purple-200 text-lg sm:text-xl max-w-lg">
            {count} photo{count > 1 ? "s" : ""} · show awards · musique 🎵
          </p>
          <VolumeControl
            volume={volume}
            muted={muted}
            onVolumeChange={(v) => {
              setVolume(v);
              if (v > 0) setMuted(false);
            }}
            onToggleMute={() => setMuted((m) => !m)}
          />
          <button
            type="button"
            onClick={handleStart}
            className="cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 text-white font-bold px-10 py-5 text-xl sm:text-2xl shadow-xl shadow-pink-900/40 active:scale-95 transition-transform"
          >
            ▶ Lancer la rétrospective
          </button>
          <Link
            href="/wall"
            className="text-sm text-purple-300/70 underline-offset-4 hover:underline"
          >
            ← Retour au mur
          </Link>
          <QuickNav links={navLinks} position="bottom-left" variant="dark" />
        </div>
      )}

      {started && stats && photos && (
        <>
          <RetrospectiveShow
            scenes={scenes}
            stats={stats}
            photos={photos}
            eventTitle={eventTitle}
            closingMessage={CLOSING_MESSAGE}
            active={started}
          />
          <div className="fixed bottom-4 left-4 z-40">
            <VolumeControl
              volume={volume}
              muted={muted}
              onVolumeChange={(v) => {
                setVolume(v);
                if (v > 0) setMuted(false);
              }}
              onToggleMute={() => setMuted((m) => !m)}
              compact
            />
          </div>
        </>
      )}
    </main>
  );
}
