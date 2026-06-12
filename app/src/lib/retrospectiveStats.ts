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
  challengeStats: ChallengeRetrospectiveStats;
}

export interface LeaderboardEntry {
  pseudo: string;
  points: number;
  challengesWon: number;
}

export interface ChallengeRetrospectiveStats {
  mostAttempted: {
    id: string;
    label: string;
    emoji?: string;
    count: number;
  } | null;
  mostSuccessful: {
    photo: Photo;
    success: number;
    fail: number;
    label: string;
    emoji?: string;
  } | null;
  mostFailed: {
    photo: Photo;
    failCount: number;
    label: string;
    emoji?: string;
  } | null;
  leaderboardTop3: LeaderboardEntry[];
}

/** Total de réactions sur une photo. */
export function photoReactionTotal(photo: Photo): number {
  return Object.values(photo.reactions).reduce((sum, n) => sum + n, 0);
}

/** Calcule les stats à partir des photos visibles et des emojis configurés. */
export function computeRetrospectiveStats(
  photos: Photo[],
  reactionEmojis: readonly string[],
  challengeMap: Map<string, { label: string; emoji?: string }> = new Map()
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
    challengeStats: computeChallengeRetrospectiveStats(photos, challengeMap),
  };
}

function challengeInfo(
  challengeMap: Map<string, { label: string; emoji?: string }>,
  id: string
) {
  return challengeMap.get(id) ?? { label: "Défi supprimé" };
}

/** Stats défis photo pour la rétrospective. */
export function computeChallengeRetrospectiveStats(
  photos: Photo[],
  challengeMap: Map<string, { label: string; emoji?: string }>
): ChallengeRetrospectiveStats {
  const challengePhotos = photos.filter((p) => p.challengeId);

  const counts = new Map<string, number>();
  for (const p of challengePhotos) {
    if (!p.challengeId) continue;
    counts.set(p.challengeId, (counts.get(p.challengeId) ?? 0) + 1);
  }

  let mostAttempted: ChallengeRetrospectiveStats["mostAttempted"] = null;
  let maxCount = 0;
  for (const [id, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      const info = challengeInfo(challengeMap, id);
      mostAttempted = { id, label: info.label, emoji: info.emoji, count };
    }
  }

  let mostSuccessful: ChallengeRetrospectiveStats["mostSuccessful"] = null;
  let bestRatio = -1;
  for (const p of challengePhotos) {
    if (!p.challengeId || !p.challengeVotes) continue;
    const total = p.challengeVotes.success + p.challengeVotes.fail;
    if (total === 0) continue;
    const ratio = p.challengeVotes.success / total;
    if (
      ratio > bestRatio ||
      (ratio === bestRatio &&
        p.challengeVotes.success > (mostSuccessful?.success ?? 0))
    ) {
      bestRatio = ratio;
      const info = challengeInfo(challengeMap, p.challengeId);
      mostSuccessful = {
        photo: p,
        success: p.challengeVotes.success,
        fail: p.challengeVotes.fail,
        label: info.label,
        emoji: info.emoji,
      };
    }
  }

  let mostFailed: ChallengeRetrospectiveStats["mostFailed"] = null;
  let maxFail = 0;
  for (const p of challengePhotos) {
    if (!p.challengeId || !p.challengeVotes || p.challengeVotes.fail === 0) {
      continue;
    }
    if (p.challengeVotes.fail > maxFail) {
      maxFail = p.challengeVotes.fail;
      const info = challengeInfo(challengeMap, p.challengeId);
      mostFailed = {
        photo: p,
        failCount: p.challengeVotes.fail,
        label: info.label,
        emoji: info.emoji,
      };
    }
  }

  const byPseudo = new Map<string, LeaderboardEntry>();
  for (const p of challengePhotos) {
    if (!p.challengeId || !p.authorPseudo || !p.challengeVotes) continue;
    if (p.challengeVotes.success <= p.challengeVotes.fail) continue;
    const cur = byPseudo.get(p.authorPseudo) ?? {
      pseudo: p.authorPseudo,
      points: 0,
      challengesWon: 0,
    };
    cur.points += 1;
    cur.challengesWon += 1;
    byPseudo.set(p.authorPseudo, cur);
  }

  const leaderboardTop3 = [...byPseudo.values()]
    .sort(
      (a, b) =>
        b.points - a.points || a.pseudo.localeCompare(b.pseudo, "fr")
    )
    .slice(0, 3);

  return { mostAttempted, mostSuccessful, mostFailed, leaderboardTop3 };
}

export function formatPhotoTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
