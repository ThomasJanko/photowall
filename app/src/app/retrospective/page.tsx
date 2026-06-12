"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";
import { QuickNav } from "@/components/QuickNav";
import { buildBackNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";

// ============================================================================
// CONFIGURATION
//
// Durée d'affichage de chaque photo (ms).
const SLIDE_DURATION_MS = 4000;

// Musique de fond : place ton fichier dans app/public/music/retrospective.mp3
const MUSIC_SRC = "/music/retrospective.mp3";

// Volume de la musique (0 à 1).
const MUSIC_VOLUME = 0.5;
// ============================================================================

/** Durée du fondu enchaîné entre deux photos (doit matcher duration-800). */
const FADE_DURATION_MS = 800;

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/** Préfixe les URLs relatives (mode local: /uploads/xxx.jpg) avec le serveur. */
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

/** Curseur volume + bouton mute. */
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
      {!compact && (
        <span className="w-8 text-right text-xs text-white/50 tabular-nums">
          {Math.round(volume * 100)}
        </span>
      )}
    </div>
  );
}

export default function RetrospectivePage() {
  const isAdmin = useIsAdmin();
  const navLinks = useMemo(() => buildBackNavLinks(isAdmin), [isAdmin]);
  // null = chargement en cours
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [volume, setVolume] = useState(MUSIC_VOLUME);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Synchronise volume / mute avec l'élément audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // Charge toutes les photos visibles, URLs résolues une fois pour toutes
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

  // Avance le diaporama (boucle infinie)
  useEffect(() => {
    if (!started || !photos || photos.length === 0) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % photos.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(interval);
  }, [started, photos]);

  // Précharge la photo suivante pour un fondu sans "pop" de chargement
  useEffect(() => {
    if (!photos || photos.length < 2) return;
    const next = photos[(index + 1) % photos.length];
    const img = new Image();
    img.src = next.url;
  }, [index, photos]);

  function handleStart() {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      audio.muted = muted;
      // Fichier absent ou autoplay refusé : le diaporama démarre quand même
      audio.play().catch((err) => console.warn("Musique indisponible:", err));
    }
    setStarted(true);
  }

  function toggleMute() {
    setMuted((m) => !m);
  }

  function handleVolumeChange(value: number) {
    const clamped = Math.min(1, Math.max(0, value));
    setVolume(clamped);
    if (clamped > 0) setMuted(false);
  }

  const count = photos?.length ?? 0;
  const current = photos && count > 0 ? photos[index % count] : null;
  const previous = photos && count > 0 ? photos[(index - 1 + count) % count] : null;

  // Deux "slots" alternés : les nœuds <img> persistent dans le DOM, seuls
  // src et opacité changent -> la transition CSS fait le fondu enchaîné.
  const evenIsCurrent = index % 2 === 0;
  const slotA = evenIsCurrent ? current : previous;
  const slotB = evenIsCurrent ? previous : current;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black">
      {/* Musique de fond (déclenchée par le bouton de démarrage) */}
      <audio ref={audioRef} src={MUSIC_SRC} loop preload="auto" />

      {/* ------ Chargement ------ */}
      {photos === null && (
        <div className="flex min-h-dvh items-center justify-center">
          <p className="text-purple-200 text-xl">Chargement des photos...</p>
        </div>
      )}

      {/* ------ Aucune photo ------ */}
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

      {/* ------ Écran de démarrage ------ */}
      {photos !== null && count > 0 && !started && (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6 text-center">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold text-white drop-shadow-lg">
            🎬 Rétrospective de la soirée
          </h1>
          <p className="text-purple-200 text-lg sm:text-xl">
            {count} photo{count > 1 ? "s" : ""} · musique incluse 🎵
          </p>
          <VolumeControl
            volume={volume}
            muted={muted}
            onVolumeChange={handleVolumeChange}
            onToggleMute={toggleMute}
          />
          <button
            onClick={handleStart}
            className="rounded-full bg-linear-to-r from-pink-500 to-purple-500 text-white font-bold px-10 py-5 text-xl sm:text-2xl shadow-xl shadow-pink-900/40 active:scale-95 transition-transform"
          >
            ▶ Lancer la rétrospective
          </button>
          <Link
            href="/wall"
            className="text-sm text-purple-300/70 underline-offset-4 hover:underline"
          >
            ← Retour au mur
          </Link>
        </div>
      )}

      {/* ------ Diaporama ------ */}
      {started && count > 0 && (
        <>
          {slotA && (
            <img
              src={slotA.url}
              alt=""
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-800 ease-in-out ${
                evenIsCurrent ? "opacity-100" : "opacity-0"
              }`}
              style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
            />
          )}
          {slotB && (
            <img
              src={slotB.url}
              alt=""
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-800 ease-in-out ${
                evenIsCurrent ? "opacity-0" : "opacity-100"
              }`}
              style={{ transitionDuration: `${FADE_DURATION_MS}ms` }}
            />
          )}

          {/* Compteur discret */}
          <p className="absolute bottom-4 left-5 z-10 text-sm sm:text-base text-white/50 tabular-nums">
            {(index % count) + 1} / {count}
          </p>

          {/* Contrôles discrets */}
          <div className="absolute top-4 right-5 z-10 flex items-center gap-3">
            <VolumeControl
              volume={volume}
              muted={muted}
              onVolumeChange={handleVolumeChange}
              onToggleMute={toggleMute}
              compact
            />
            <Link
              href="/wall"
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-white/70 ring-1 ring-white/15 backdrop-blur-sm hover:text-white active:scale-95 transition-transform"
            >
              Quitter
            </Link>
          </div>
        </>
      )}

      <QuickNav links={navLinks} position="bottom-left" variant="dark" />
    </main>
  );
}
