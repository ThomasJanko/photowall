import { isActiveChallengeId } from "../challengesDb";

/** Valide un challengeId contre les défis actifs (challengesDb). */
export function parseChallengeId(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const id = raw.trim();
  return isActiveChallengeId(id) ? id : undefined;
}

export function parseAuthorPseudo(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().slice(0, 20);
  return trimmed.length >= 2 ? trimmed : undefined;
}

export function parseTimelineText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 500);
  return trimmed.length >= 2 ? trimmed : null;
}

export function filenameFromUploadUrl(
  url: string | undefined
): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/uploads\/([^/?#]+)$/);
  return match?.[1];
}
