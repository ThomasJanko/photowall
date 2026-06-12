import type { Photo } from "@/lib/types";

export interface HourlyBucket {
  label: string;
  count: number;
}

export interface RetrospectiveStats {
  totalPhotos: number;
  totalReactions: number;
  reactionBreakdown: Record<string, number>;
  starEmoji: string;
  starEmojiCount: number;
  topPhoto: Photo | null;
  top3Photos: Photo[];
  firstPhoto: Photo | null;
  lastPhoto: Photo | null;
  hourlyBuckets: HourlyBucket[];
}

/** Total de réactions sur une photo. */
export function photoReactionTotal(photo: Photo): number {
  return Object.values(photo.reactions).reduce((sum, n) => sum + n, 0);
}

/** Calcule les stats à partir des photos visibles et des emojis configurés. */
export function computeRetrospectiveStats(
  photos: Photo[],
  reactionEmojis: readonly string[]
): RetrospectiveStats {
  const sorted = [...photos].sort((a, b) => a.createdAt - b.createdAt);
  const reactionBreakdown: Record<string, number> = Object.fromEntries(
    reactionEmojis.map((e) => [e, 0])
  );

  let totalReactions = 0;
  for (const photo of photos) {
    for (const emoji of reactionEmojis) {
      const n = photo.reactions[emoji] ?? 0;
      reactionBreakdown[emoji] = (reactionBreakdown[emoji] ?? 0) + n;
      totalReactions += n;
    }
  }

  let starEmoji = reactionEmojis[0] ?? "❤️";
  let starEmojiCount = 0;
  for (const emoji of reactionEmojis) {
    const count = reactionBreakdown[emoji] ?? 0;
    if (count > starEmojiCount) {
      starEmojiCount = count;
      starEmoji = emoji;
    }
  }

  const byReactions = [...photos].sort(
    (a, b) => photoReactionTotal(b) - photoReactionTotal(a)
  );

  const hourMap = new Map<string, number>();
  for (const photo of photos) {
    const label = new Date(photo.createdAt).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const hourKey = label.slice(0, 2) + "h";
    hourMap.set(hourKey, (hourMap.get(hourKey) ?? 0) + 1);
  }
  const hourlyBuckets = [...hourMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    totalPhotos: photos.length,
    totalReactions,
    reactionBreakdown,
    starEmoji,
    starEmojiCount,
    topPhoto: byReactions[0] ?? null,
    top3Photos: byReactions.slice(0, 3),
    firstPhoto: sorted[0] ?? null,
    lastPhoto: sorted[sorted.length - 1] ?? null,
    hourlyBuckets,
  };
}

export function formatPhotoTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
