import type { AnnouncementEvent } from "./types";

/** Temps restant avant fin de l'annonce (ms). */
export function announcementRemainingMs(payload: AnnouncementEvent): number {
  if (payload.startedAt != null) {
    return Math.max(0, payload.durationMs - (Date.now() - payload.startedAt));
  }
  return payload.durationMs;
}
