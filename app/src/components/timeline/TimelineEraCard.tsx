"use client";

import { useTimelineInView } from "./useTimelineInView";
import { eraAccentColor, resolveMediaUrl } from "@/lib/timelineUtils";
import type { TimelineEra, TimelineEntry } from "@/lib/types";

interface TimelineEraCardProps {
  era: TimelineEra;
  index: number;
  entries: TimelineEntry[];
  onPhotoClick?: (src: string, caption?: string) => void;
}

export function TimelineEraCard({
  era,
  index,
  entries,
  onPhotoClick,
}: TimelineEraCardProps) {
  const { ref, visible } = useTimelineInView();
  const accent = eraAccentColor(era.color, index);

  return (
    <div
      ref={ref}
      className={`timeline-reveal relative grid grid-cols-[2rem_1fr] gap-x-4 ${
        visible ? "timeline-reveal-visible" : ""
      }`}
    >
      <div className="relative flex flex-col items-center">
        <span
          className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-4 ring-purple-950/80"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <span
          className="absolute top-5 bottom-0 -mb-8 w-0.5 bg-white/20"
          aria-hidden
        />
      </div>

      <article className="col-start-2 w-full min-w-0 pb-10 lg:pb-16">
        <div
          className="rounded-2xl bg-white/10 p-5 shadow-xl ring-1 backdrop-blur-sm"
          style={{
            borderColor: `${accent}55`,
            boxShadow: `0 8px 32px ${accent}22`,
          }}
        >
          <p
            className="text-2xl font-extrabold tracking-tight text-white tabular-nums sm:text-3xl"
            style={{ color: accent }}
          >
            {era.period}
          </p>
          <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">
            {era.label}
          </h2>
          {era.description && (
            <p className="mt-3 text-sm leading-relaxed text-purple-100/95 sm:text-base">
              {era.description}
            </p>
          )}
          {era.photoUrl && (
            <button
              type="button"
              onClick={() =>
                onPhotoClick?.(resolveMediaUrl(era.photoUrl!), era.label)
              }
              className="mt-4 block w-full cursor-zoom-in overflow-hidden rounded-xl bg-black/20 ring-2 ring-white/20 transition hover:ring-white/40"
            >
              <img
                src={resolveMediaUrl(era.photoUrl)}
                alt=""
                className="mx-auto max-h-72 w-full object-contain lg:max-h-[28rem]"
                loading="lazy"
                decoding="async"
              />
            </button>
          )}
        </div>

        {entries.length > 0 && (
          <div className="mt-4 w-full">
            <p className="mb-2.5 text-xs font-semibold tracking-wide text-purple-300/90 uppercase">
              💬 {entries.length} souvenir{entries.length > 1 ? "s" : ""}
            </p>
            <div className="flex w-full flex-wrap gap-2.5 sm:gap-3 lg:gap-3.5">
              {entries.map((entry) => (
                <TimelineGuestEntry
                  key={entry.id}
                  entry={entry}
                  accent={accent}
                  onPhotoClick={onPhotoClick}
                />
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}

function TimelineGuestEntry({
  entry,
  accent,
  onPhotoClick,
}: {
  entry: TimelineEntry;
  accent: string;
  onPhotoClick?: (src: string, caption?: string) => void;
}) {
  const { ref, visible } = useTimelineInView(0.08);
  const hasPhoto = Boolean(entry.photoUrl);

  return (
    <div
      ref={ref}
      className={`timeline-reveal timeline-entry-pop w-[calc(50%-0.3125rem)] max-w-[13rem] min-w-[8.25rem] shrink-0 overflow-hidden rounded-xl bg-white/10 shadow-md ring-1 ring-white/20 backdrop-blur-sm sm:w-[calc(33.333%-0.5rem)] sm:max-w-[12rem] md:w-[calc(33.333%-0.5rem)] md:max-w-[11.5rem] lg:w-[calc(33.333%-0.75rem)] lg:max-w-[12.5rem] xl:w-[calc(25%-0.84375rem)] xl:max-w-[13rem] ${visible ? "timeline-reveal-visible" : ""}`}
      style={{
        borderTop: `3px solid ${accent}`,
      }}
    >
      {hasPhoto && (
        <button
          type="button"
          onClick={() =>
            onPhotoClick?.(
              resolveMediaUrl(entry.photoUrl!),
              `${entry.text}\n— ${entry.author}`
            )
          }
          className="aspect-square w-full cursor-zoom-in overflow-hidden bg-black/20"
        >
          <img
            src={resolveMediaUrl(entry.photoUrl!)}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </button>
      )}
      <div className={`p-2.5 ${hasPhoto ? "pt-2" : ""}`}>
        <p
          className={`text-xs leading-snug whitespace-pre-wrap text-purple-50 ${
            hasPhoto ? "line-clamp-3" : "line-clamp-5"
          }`}
        >
          {entry.text}
        </p>
        <p className="mt-1.5 truncate text-[10px] font-medium text-purple-300/85">
          — {entry.author}
        </p>
      </div>
    </div>
  );
}

interface TimelineUnassignedEntriesProps {
  entries: TimelineEntry[];
  onPhotoClick?: (src: string, caption?: string) => void;
}

export function TimelineUnassignedEntries({
  entries,
  onPhotoClick,
}: TimelineUnassignedEntriesProps) {
  const { ref, visible } = useTimelineInView();
  const accent = eraAccentColor(undefined, 0);

  if (entries.length === 0) return null;

  return (
    <section
      ref={ref}
      className={`timeline-reveal mt-4 pb-8 ${visible ? "timeline-reveal-visible" : ""}`}
    >
      <h2 className="mb-4 text-center text-lg font-bold text-white">
        💬 Souvenirs des invités
      </h2>
      <div className="flex w-full flex-wrap justify-center gap-2.5 sm:gap-3 lg:gap-3.5">
        {entries.map((entry) => (
          <TimelineGuestEntry
            key={entry.id}
            entry={entry}
            accent={accent}
            onPhotoClick={onPhotoClick}
          />
        ))}
      </div>
    </section>
  );
}
