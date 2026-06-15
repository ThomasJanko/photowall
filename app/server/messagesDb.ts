import crypto from "crypto";
import { createJsonStore } from "./jsonStore";

/** Stockage JSON séparé du mur public — messages privés organisateurs uniquement. */

const messageStore = createJsonStore<PrivateMessageRow[]>(
  "private-messages.json",
  []
);

export type PrivateMediaType = "image" | "video" | null;

export interface PrivateMessageRow {
  id: string;
  text: string;
  mediaFilename: string | null;
  mediaType: PrivateMediaType;
  created_at: number;
}

function readAll(): PrivateMessageRow[] {
  return messageStore.read();
}

function writeAll(rows: PrivateMessageRow[]) {
  messageStore.write(rows);
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
