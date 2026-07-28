"use client";

import type { Photo } from "@/lib/types";
import { ChallengeBadge } from "@/components/ChallengeBadge";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
}

export interface Floater {
  id: number;
  photoId: string;
  emoji: string;
  left: number;
}

function FloatersOverlay({ floaters }: { readonly floaters: Floater[] }) {
  return (
    <>
      {floaters.map((f) => (
        <span
          key={f.id}
          className="reaction-float pointer-events-none absolute bottom-2 text-3xl md:text-4xl"
          style={{ left: `${f.left}%` }}
        >
          {f.emoji}
        </span>
      ))}
    </>
  );
}

export interface PhotoLightboxProps {
  photo: Photo;
  onClose: () => void;
  challengeInfo?: { label: string; emoji?: string };
  reactionEmojis?: string[];
  features: { reactions: boolean };
  floaters: Floater[];
  onReact?: (photoId: string, emoji: string) => void;
  myReactions?: ReadonlySet<string>;
  reactionCooldowns?: ReadonlySet<string>;
  /** z-index Tailwind class suffix, default 50 */
  zIndexClass?: string;
  /** spotlight-pop-in on first open (queue) vs static (manual viewer) */
  animate?: boolean;
}

/** Plein écran réutilisable : spotlight queue ou viewer manuel / deep link. */
export function PhotoLightbox({
  photo,
  onClose,
  challengeInfo,
  reactionEmojis = [],
  features,
  floaters,
  onReact,
  myReactions,
  reactionCooldowns,
  zIndexClass = "z-50",
  animate = true,
}: PhotoLightboxProps) {
  return (
    <div
      key={photo.id}
      role="dialog"
      aria-modal="true"
      aria-label="Photo en grand"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm md:p-12 ${
        animate ? "spotlight-pop-in" : ""
      }`}
    >
      <div
        className="relative flex max-h-full max-w-full items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative inline-block max-h-[82vh] max-w-full">
          {challengeInfo && (
            <div className="absolute top-3 left-3 z-20 sm:top-4 sm:left-4">
              <ChallengeBadge {...challengeInfo} floating={false} />
            </div>
          )}
          <img
            src={resolveUrl(photo.url)}
            alt=""
            className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl ring-4 ring-white/30"
          />
          {features.reactions && (
            <div className="absolute bottom-2 left-1/2 flex w-max max-w-[90vw] -translate-x-1/2 flex-wrap justify-center gap-1.5 md:bottom-3 md:gap-2">
              {reactionEmojis.map((emoji) => {
                const key = `${photo.id}:${emoji}`;
                const mine = myReactions?.has(key) ?? false;
                const coolingDown = reactionCooldowns?.has(key) ?? false;
                return (
                  <button
                    type="button"
                    key={emoji}
                    onClick={
                      onReact ? () => onReact(photo.id, emoji) : undefined
                    }
                    disabled={onReact ? coolingDown : undefined}
                    title={
                      onReact
                        ? mine
                          ? "Retirer ma réaction"
                          : "Réagir"
                        : undefined
                    }
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 ring-1 backdrop-blur-sm transition-transform md:gap-1.5 md:px-3 md:py-1.5 ${
                      onReact
                        ? `cursor-pointer active:scale-90 disabled:opacity-40 ${
                            mine
                              ? "bg-pink-500/50 text-white ring-pink-300/60"
                              : "bg-black/60 text-white ring-white/20"
                          }`
                        : "bg-black/60 text-white ring-white/20"
                    }`}
                  >
                    <span className="text-base md:text-xl">{emoji}</span>
                    <span
                      className={`text-xs tabular-nums md:text-base ${
                        mine ? "font-semibold" : ""
                      }`}
                    >
                      {photo.reactions?.[emoji] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {features.reactions && (
            <FloatersOverlay
              floaters={floaters.filter((f) => f.photoId === photo.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
