import path from "path";
import fs from "fs";
import crypto from "crypto";
import { eventConfig } from "../src/config/event";

/** Stockage JSON des défis photo (data/challenges.json). */
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "challenges.json");

export interface ChallengeRow {
  id: string;
  label: string;
  emoji?: string;
  active: boolean;
  createdAt: number;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): ChallengeRow[] {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const seeded = seedFromEventConfig();
    writeAll(seeded);
    return seeded;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return raw.trim() ? (JSON.parse(raw) as ChallengeRow[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: ChallengeRow[]) {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), "utf-8");
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
