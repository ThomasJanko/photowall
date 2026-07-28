"use client";

import type { AnnouncementEvent } from "@/lib/types";

interface AnnouncementBannerProps {
  readonly announcement: AnnouncementEvent;
  readonly leaving: boolean;
}

/** Bandeau d'annonce live en haut de /wall. */
export function AnnouncementBanner({
  announcement,
  leaving,
}: AnnouncementBannerProps) {
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
