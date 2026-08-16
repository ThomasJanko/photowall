"use client";

import type { AnnouncementEvent } from "@/lib/types";

/**
 * Cycle de vie d'une annonce sur /wall :
 * "center"     → plein écran, centrée (0-6s, avec son)
 * "center-out" → transition : se réduit et remonte vers le haut (~450ms)
 * "top"        → bandeau compact en haut (reste jusqu'à la fin de la durée)
 */
export type AnnouncementPhase = "center" | "center-out" | "top";

interface AnnouncementBannerProps {
  readonly announcement: AnnouncementEvent;
  readonly phase: AnnouncementPhase;
  /** Sortie finale (fin de la durée totale de l'annonce). */
  readonly leaving: boolean;
}

/** Annonce live : plein écran centrée puis rangée en bandeau en haut de /wall. */
export function AnnouncementBanner({
  announcement,
  phase,
  leaving,
}: AnnouncementBannerProps) {
  if (phase === "center" || phase === "center-out") {
    const exiting = phase === "center-out" || leaving;
    return (
      <div
        role="status"
        aria-live="assertive"
        className={`announcement-center-backdrop fixed inset-0 z-[55] flex items-center justify-center p-6 ${
          exiting ? "announcement-center-backdrop-out" : ""
        }`}
      >
        <div
          className={`announcement-center-panel relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/25 shadow-2xl ${
            exiting ? "announcement-center-panel-out" : ""
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
          <div className="relative flex flex-col items-center justify-center gap-5 px-8 py-14 text-center sm:px-16 sm:py-20">
            {announcement.emoji && (
              <span
                className="announcement-emoji text-7xl leading-none sm:text-8xl"
                aria-hidden
              >
                {announcement.emoji}
              </span>
            )}
            <p className="announcement-text text-3xl leading-tight font-extrabold tracking-tight [text-wrap:balance] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.4)] sm:text-5xl md:text-6xl">
              {announcement.text}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`announcement-banner fixed inset-x-0 top-0 z-[55] ${
        leaving ? "announcement-banner-leaving" : ""
      }`}
    >
      <div
        className="relative overflow-hidden rounded-b-2xl border-b border-white/25 shadow-2xl backdrop-blur-md sm:rounded-b-xl"
        style={{
          background:
            "linear-gradient(135deg, var(--event-gradient-from), var(--event-gradient-via), var(--event-gradient-to))",
        }}
      >
        {/* Reflet animé */}
        <span
          className="announcement-shimmer pointer-events-none absolute inset-0"
          aria-hidden
        />

        <div className="announcement-banner-content relative mx-auto flex max-w-4xl flex-col items-center justify-center gap-1.5 px-4 py-3 sm:flex-row sm:gap-3 sm:px-6 sm:py-4">
          {announcement.emoji && (
            <span
              className="announcement-emoji shrink-0 text-4xl leading-none sm:text-5xl"
              aria-hidden
            >
              {announcement.emoji}
            </span>
          )}
          <p className="announcement-text text-center text-base leading-snug font-extrabold tracking-tight [text-wrap:balance] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:text-xl md:text-2xl">
            {announcement.text}
          </p>
        </div>
      </div>
    </div>
  );
}
