import path from "path";
import fs from "fs";
import { DEFAULT_REACTION_EMOJIS } from "../src/config/event";

/**
 * Stockage simple en fichier JSON (pas de dépendance native).
 * Largement suffisant pour quelques centaines de photos sur une soirée.
 * Lecture/écriture synchrones : volumes faibles, pas de souci de perf.
 */

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "photos.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/** Aligné sur src/config/event.ts (DEFAULT_REACTION_EMOJIS). */
export const REACTION_EMOJIS = DEFAULT_REACTION_EMOJIS;

export interface PhotoRow {
  id: string;
  filename: string;
  created_at: number;
  hidden: number;
  reactions: Record<string, number>;
}

function emptyReactions(): Record<string, number> {
  return Object.fromEntries(REACTION_EMOJIS.map((e) => [e, 0]));
}

function readAll(): PhotoRow[] {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const rows = raw.trim() ? (JSON.parse(raw) as PhotoRow[]) : [];
    // Migration douce : les photos créées avant la feature n'ont pas de champ reactions
    return rows.map((r) => ({ ...r, reactions: r.reactions ?? emptyReactions() }));
  } catch {
    return [];
  }
}

function writeAll(rows: PhotoRow[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), "utf-8");
}

export function insertPhoto(id: string, filename: string, createdAt: number) {
  const rows = readAll();
  rows.push({
    id,
    filename,
    created_at: createdAt,
    hidden: 0,
    reactions: emptyReactions(),
  });
  writeAll(rows);
}

export function listVisiblePhotos(): PhotoRow[] {
  return readAll()
    .filter((r) => r.hidden === 0)
    .sort((a, b) => a.created_at - b.created_at);
}

export function hidePhoto(id: string) {
  const rows = readAll();
  const row = rows.find((r) => r.id === id);
  if (row) row.hidden = 1;
  writeAll(rows);
}

export function getPhoto(id: string): PhotoRow | undefined {
  return readAll().find((r) => r.id === id);
}

export function addReaction(
  photoId: string,
  emoji: string,
  delta: 1 | -1 = 1
): PhotoRow | undefined {
  const rows = readAll();
  const row = rows.find((r) => r.id === photoId);
  if (!row) return undefined;

  // Clamp à 0 : un retrait ne peut pas rendre un compteur négatif
  row.reactions[emoji] = Math.max(0, (row.reactions[emoji] ?? 0) + delta);
  writeAll(rows);
  return row;
}
