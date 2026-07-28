import crypto from "crypto";
import { eventConfig } from "../src/config/event";
import { createJsonStore } from "./jsonStore";

/** Stockage JSON des défis photo (data/challenges.json). */

const challengeStore = createJsonStore<ChallengeRow[]>("challenges.json", []);

export interface ChallengeRow {
  id: string;
  label: string;
  emoji?: string;
  active: boolean;
  createdAt: number;
}

/** Migration initiale depuis src/config/event.ts. */
function seedFromEventConfig(): ChallengeRow[] {
  const now = Date.now();
  return eventConfig.photoChallenges.map((c, i) => ({
    id: c.id,
    label: c.label,
    emoji: c.emoji,
    active: true,
    createdAt: now + i,
  }));
}

function readAll(): ChallengeRow[] {
  if (!challengeStore.exists()) {
    const seeded = seedFromEventConfig();
    challengeStore.write(seeded);
    return seeded;
  }
  return challengeStore.read();
}

function writeAll(rows: ChallengeRow[]) {
  challengeStore.write(rows);
}

export function listChallenges(): ChallengeRow[] {
  return readAll().sort((a, b) => a.createdAt - b.createdAt);
}

export function listActiveChallenges(): ChallengeRow[] {
  return listChallenges().filter((c) => c.active);
}

export function getChallenge(id: string): ChallengeRow | undefined {
  return readAll().find((c) => c.id === id);
}

export function isActiveChallengeId(id: string): boolean {
  const c = getChallenge(id);
  return !!c?.active;
}

export function createChallenge(label: string, emoji?: string): ChallengeRow {
  const rows = readAll();
  const row: ChallengeRow = {
    id: crypto.randomUUID(),
    label: label.trim(),
    emoji: emoji?.trim() || undefined,
    active: true,
    createdAt: Date.now(),
  };
  rows.push(row);
  writeAll(rows);
  return row;
}

export function updateChallenge(
  id: string,
  patch: Partial<Pick<ChallengeRow, "label" | "emoji" | "active">>
): ChallengeRow | undefined {
  const rows = readAll();
  const row = rows.find((c) => c.id === id);
  if (!row) return undefined;

  if (patch.label !== undefined) row.label = patch.label.trim();
  if (patch.emoji !== undefined) {
    row.emoji = patch.emoji.trim() || undefined;
  }
  if (patch.active !== undefined) row.active = patch.active;

  writeAll(rows);
  return row;
}

export function deleteChallenge(id: string): boolean {
  const rows = readAll();
  const next = rows.filter((c) => c.id !== id);
  if (next.length === rows.length) return false;
  writeAll(next);
  return true;
}

export function toPublicChallenge(row: ChallengeRow) {
  return {
    id: row.id,
    label: row.label,
    emoji: row.emoji,
    active: row.active,
    createdAt: row.createdAt,
  };
}
