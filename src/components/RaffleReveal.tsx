"use client";

import { useEffect, useRef, useState } from "react";
import type { RaffleDrawEvent } from "@/lib/types";
import { RAFFLE_SHUFFLE_MS } from "@/lib/raffleUtils";
import { playAnnouncementSound } from "@/lib/announcementSound";

const SHUFFLE_STEP_MS = 80;

interface RaffleRevealProps {
  readonly draw: RaffleDrawEvent;
  readonly leaving: boolean;
}

/**
 * Révélation plein écran du tirage au sort sur /wall : réutilise le style de
 * l'annonce centrée (fond assombri + panneau dégradé), avec un "roulement"
 * parmi les candidats restants avant de s'arrêter sur le nom tiré.
 */
export function RaffleReveal({ draw, leaving }: RaffleRevealProps) {
  const hasShuffle = draw.candidatePool.length > 1;
  const [displayName, setDisplayName] = useState(draw.name);
  const [revealed, setRevealed] = useState(!hasShuffle);
  const soundPlayedRef = useRef(false);

  useEffect(() => {
    soundPlayedRef.current = false;

    if (!hasShuffle) {
      setDisplayName(draw.name);
      setRevealed(true);
      if (!soundPlayedRef.current) {
        soundPlayedRef.current = true;
        playAnnouncementSound();
      }
      return;
    }

    setRevealed(false);
    const pool = draw.candidatePool;
    const shuffleInterval = setInterval(() => {
      setDisplayName(pool[Math.floor(Math.random() * pool.length)]);
    }, SHUFFLE_STEP_MS);

    const revealTimeout = setTimeout(() => {
      clearInterval(shuffleInterval);
      setDisplayName(draw.name);
      setRevealed(true);
      if (!soundPlayedRef.current) {
        soundPlayedRef.current = true;
        playAnnouncementSound();
      }
    }, RAFFLE_SHUFFLE_MS);

    return () => {
      clearInterval(shuffleInterval);
      clearTimeout(revealTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw.name, draw.drawnAt, hasShuffle]);

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`announcement-center-backdrop fixed inset-0 z-[56] flex items-center justify-center p-6 ${
        leaving ? "announcement-center-backdrop-out" : ""
      }`}
    >
      <div
        className={`announcement-center-panel relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/25 shadow-2xl ${
          leaving ? "announcement-center-panel-out" : ""
        }`}
        style={{
          background:
            "linear-gradient(135deg, var(--event-gradient-from), var(--event-gradient-via), var(--event-gradient-to))",
        }}
      >
        <span
          className="announcement-shimmer pointer-events-none absolute inset-0"
          aria-hidden
        />
        <div className="relative flex flex-col items-center justify-center gap-4 px-8 py-14 text-center sm:px-16 sm:py-20">
          <span className="text-6xl leading-none sm:text-7xl" aria-hidden>
            🎲
          </span>
          <p className="text-base tracking-widest text-white/80 uppercase sm:text-xl">
            Tirage au sort
          </p>
          <p
            key={revealed ? "revealed" : "shuffling"}
            className={`text-4xl leading-tight font-extrabold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] sm:text-6xl md:text-7xl ${
              revealed ? "raffle-reveal-pop" : "opacity-80"
            }`}
          >
            {displayName}
          </p>
          {revealed &&
            (draw.remainingCount > 0 ? (
              <p className="text-sm text-white/70 sm:text-base">
                {draw.remainingCount} personne
                {draw.remainingCount > 1 ? "s" : ""} restante
                {draw.remainingCount > 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-sm font-semibold text-amber-200 sm:text-base">
                🎉 Tout le monde est passé !
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}
