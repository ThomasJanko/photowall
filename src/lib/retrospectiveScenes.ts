import type { Photo } from "@/lib/types";
import type { RetrospectiveStats } from "./retrospectiveStats";

export type SceneType =
  | "intro"
  | "starReaction"
  | "top3"
  | "firstLast"
  | "rhythm"
  | "challengeMostAttempted"
  | "challengeMostSuccessful"
  | "challengeMostFailed"
  | "challengeLeaderboard"
  | "slideshow"
  | "closing";

export interface Scene {
  type: SceneType;
  durationMs: number;
}

const SLIDE_MS = 3500;

/** Durées calibrées pour un enchaînement fluide (~musique en fond). */
export function buildRetrospectiveScenes(
  stats: RetrospectiveStats,
  photos: Photo[]
): Scene[] {
  const scenes: Scene[] = [{ type: "intro", durationMs: 8500 }];

  if (stats.totalReactions > 0) {
    scenes.push({ type: "starReaction", durationMs: 7500 });
  }

  if (stats.top3Photos.length > 0) {
    scenes.push({ type: "top3", durationMs: 9000 });
  }

  if (stats.firstPhoto) {
    scenes.push({ type: "firstLast", durationMs: 7000 });
  }

  if (stats.hourlyBuckets.length >= 2) {
    scenes.push({ type: "rhythm", durationMs: 6500 });
  }

  const cs = stats.challengeStats;
  if (cs.mostAttempted && cs.mostAttempted.count > 0) {
    scenes.push({ type: "challengeMostAttempted", durationMs: 7000 });
  }
  if (cs.mostSuccessful) {
    scenes.push({ type: "challengeMostSuccessful", durationMs: 8000 });
  }
  if (cs.mostFailed) {
    scenes.push({ type: "challengeMostFailed", durationMs: 7000 });
  }
  if (cs.leaderboardTop3.length > 0) {
    scenes.push({ type: "challengeLeaderboard", durationMs: 9000 });
  }

  if (photos.length > 0) {
    const slideDuration = Math.min(
      Math.max(photos.length * SLIDE_MS, 12_000),
      120_000
    );
    scenes.push({ type: "slideshow", durationMs: slideDuration });
  }

  scenes.push({ type: "closing", durationMs: 12_000 });

  return scenes;
}

export const SLIDESHOW_INTERVAL_MS = SLIDE_MS;
