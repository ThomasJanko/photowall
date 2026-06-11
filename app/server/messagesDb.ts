import path from "path";
import fs from "fs";
import crypto from "crypto";

/** Stockage JSON séparé du mur public — messages privés organisateurs uniquement. */
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "private-messages.json");

export type PrivateMediaType = "image" | "video" | null;

export interface PrivateMessageRow {
  id: string;
  text: string;
  mediaFilename: string | null;
  mediaType: PrivateMediaType;
  created_at: number;
}

function readAll(): PrivateMessageRow[] {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    return raw.trim() ? (JSON.parse(raw) as PrivateMessageRow[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: PrivateMessageRow[]) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), "utf-8");
}

export function insertPrivateMessage(
  text: string,
  mediaFilename: string | null,
  mediaType: PrivateMediaType
): PrivateMessageRow {
  const row: PrivateMessageRow = {
    id: crypto.randomUUID(),
    text,
    mediaFilename,
    mediaType,
    created_at: Date.now(),
  };
  const rows = readAll();
  rows.push(row);
  writeAll(rows);
  return row;
}

export function listPrivateMessages(): PrivateMessageRow[] {
  return readAll().sort((a, b) => b.created_at - a.created_at);
}

export function getPrivateMessage(id: string): PrivateMessageRow | undefined {
  return readAll().find((r) => r.id === id);
}

export function getPrivateMessageByFilename(
  filename: string
): PrivateMessageRow | undefined {
  return readAll().find((r) => r.mediaFilename === filename);
}

export function deletePrivateMessage(id: string): PrivateMessageRow | undefined {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  const [removed] = rows.splice(idx, 1);
  writeAll(rows);
  return removed;
}
