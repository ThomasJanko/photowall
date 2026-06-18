import crypto from "crypto";
import { createJsonStore } from "./jsonStore";

export interface PlanningEventRow {
  id: string;
  title: string;
  /** ISO date "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  time: string;
  duration?: string;
  description?: string;
  emoji?: string;
  color?: string;
  location?: string;
  photo_filename?: string;
  order: number;
  created_at: number;
  surprise?: boolean;
}

interface PlanningStore {
  events: PlanningEventRow[];
}

function emptyStore(): PlanningStore {
  return { events: [] };
}

const planningStore = createJsonStore<PlanningStore>("planning.json", emptyStore());

function readStore(): PlanningStore {
  const parsed = planningStore.read();
  return { events: parsed.events ?? [] };
}

function writeStore(store: PlanningStore) {
  planningStore.write(store);
}

export function listPlanningEvents(): PlanningEventRow[] {
  return readStore()
    .events.slice()
    .sort((a, b) => {
      const dateA = `${a.date}T${a.time}`;
      const dateB = `${b.date}T${b.time}`;
      if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      return a.order - b.order;
    });
}

export function getPlanningEvent(id: string): PlanningEventRow | null {
  return readStore().events.find((e) => e.id === id) ?? null;
}

export function insertPlanningEvent(
  data: Omit<PlanningEventRow, "id" | "created_at">
): PlanningEventRow {
  const store = readStore();
  const row: PlanningEventRow = {
    id: crypto.randomUUID(),
    created_at: Date.now(),
    ...data,
  };
  store.events.push(row);
  writeStore(store);
  return row;
}

export function updatePlanningEvent(
  id: string,
  data: Partial<Omit<PlanningEventRow, "id" | "created_at">>
): PlanningEventRow | null {
  const store = readStore();
  const idx = store.events.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  store.events[idx] = { ...store.events[idx], ...data };
  writeStore(store);
  return store.events[idx];
}

export function deletePlanningEvent(id: string): boolean {
  const store = readStore();
  const before = store.events.length;
  store.events = store.events.filter((e) => e.id !== id);
  if (store.events.length === before) return false;
  writeStore(store);
  return true;
}

export function savePlanningEvents(rows: PlanningEventRow[]): PlanningEventRow[] {
  const store = readStore();
  store.events = rows;
  writeStore(store);
  return listPlanningEvents();
}
