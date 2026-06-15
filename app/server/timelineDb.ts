import crypto from "crypto";
import { createJsonStore } from "./jsonStore";

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

export interface TimelinePageSettings {
  title: string;
  subtitle: string;
  emoji: string;
}

export const DEFAULT_TIMELINE_PAGE_SETTINGS: TimelinePageSettings = {
  title: "Timeline",
  subtitle: "25 ans de souvenirs — et la soirée continue",
  emoji: "🕰️",
};

interface TimelineStore {
  eras: TimelineEraRow[];
  entries: TimelineEntryRow[];
  page?: Partial<TimelinePageSettings>;
}

function emptyStore(): TimelineStore {
  return { eras: [], entries: [] };
}

const timelineStore = createJsonStore<TimelineStore>("timeline.json", emptyStore());

function readStore(): TimelineStore {
  const parsed = timelineStore.read();
  return {
    eras: parsed.eras ?? [],
    entries: parsed.entries ?? [],
    page: parsed.page,
  };
}

function writeStore(store: TimelineStore) {
  timelineStore.write(store);
}

export function listTimelineEras(): TimelineEraRow[] {
  return readStore().eras.slice().sort((a, b) => a.order - b.order);
}

export function getTimelinePageSettings(): TimelinePageSettings {
  const page = readStore().page;
  return {
    title: page?.title?.trim() || DEFAULT_TIMELINE_PAGE_SETTINGS.title,
    subtitle: page?.subtitle?.trim() || DEFAULT_TIMELINE_PAGE_SETTINGS.subtitle,
    emoji: page?.emoji?.trim() || DEFAULT_TIMELINE_PAGE_SETTINGS.emoji,
  };
}

export function saveTimelinePageSettings(
  settings: TimelinePageSettings
): TimelinePageSettings {
  const store = readStore();
  store.page = {
    title: settings.title.trim(),
    subtitle: settings.subtitle.trim(),
    emoji: settings.emoji.trim(),
  };
  writeStore(store);
  return getTimelinePageSettings();
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
