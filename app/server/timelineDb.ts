import path from "path";
import fs from "fs";
import crypto from "crypto";

const DATA_DIR = path.join(__dirname, "..", "data");
const TIMELINE_FILE = path.join(DATA_DIR, "timeline.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export interface TimelineEraRow {
  id: string;
  label: string;
  period: string;
  order: number;
  description?: string;
  photo_filename?: string;
  color?: string;
}

export interface TimelineEntryRow {
  id: string;
  era_id: string | null;
  author: string;
  text: string;
  photo_filename?: string;
  created_at: number;
  approved: boolean;
}

interface TimelineStore {
  eras: TimelineEraRow[];
  entries: TimelineEntryRow[];
}

function emptyStore(): TimelineStore {
  return { eras: [], entries: [] };
}

function readStore(): TimelineStore {
  if (!fs.existsSync(TIMELINE_FILE)) return emptyStore();
  try {
    const raw = fs.readFileSync(TIMELINE_FILE, "utf-8");
    const parsed = raw.trim() ? (JSON.parse(raw) as TimelineStore) : emptyStore();
    return {
      eras: parsed.eras ?? [],
      entries: parsed.entries ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: TimelineStore) {
  fs.writeFileSync(TIMELINE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function listTimelineEras(): TimelineEraRow[] {
  return readStore().eras.slice().sort((a, b) => a.order - b.order);
}

export function saveTimelineEras(eras: TimelineEraRow[]): TimelineEraRow[] {
  const sorted = eras
    .slice()
    .map((e, i) => ({ ...e, order: e.order ?? i }))
    .sort((a, b) => a.order - b.order);
  const store = readStore();
  store.eras = sorted;
  writeStore(store);
  return sorted;
}

export function listApprovedTimelineEntries(): TimelineEntryRow[] {
  return readStore()
    .entries.filter((e) => e.approved)
    .sort((a, b) => a.created_at - b.created_at);
}

export function listPendingTimelineEntries(): TimelineEntryRow[] {
  return readStore()
    .entries.filter((e) => !e.approved)
    .sort((a, b) => b.created_at - a.created_at);
}

export function insertTimelineEntry(
  data: Omit<TimelineEntryRow, "id" | "created_at" | "approved"> & {
    approved: boolean;
  }
): TimelineEntryRow {
  const store = readStore();
  const row: TimelineEntryRow = {
    id: crypto.randomUUID(),
    created_at: Date.now(),
    ...data,
  };
  store.entries.push(row);
  writeStore(store);
  return row;
}

export function approveTimelineEntry(id: string): TimelineEntryRow | null {
  const store = readStore();
  const idx = store.entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  store.entries[idx] = { ...store.entries[idx], approved: true };
  writeStore(store);
  return store.entries[idx];
}

export function deleteTimelineEntry(id: string): boolean {
  const store = readStore();
  const before = store.entries.length;
  store.entries = store.entries.filter((e) => e.id !== id);
  if (store.entries.length === before) return false;
  writeStore(store);
  return true;
}

export function getTimelineEntry(id: string): TimelineEntryRow | null {
  return readStore().entries.find((e) => e.id === id) ?? null;
}
