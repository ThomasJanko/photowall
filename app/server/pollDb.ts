import crypto from "crypto";
import { createJsonStore } from "./jsonStore";

/** Stockage JSON des sondages (data/polls.json). */

const pollStore = createJsonStore<PollRow[]>("polls.json", []);

export type PollStatus = "draft" | "active" | "closed";

export interface PollOptionRow {
  id: string;
  label: string;
  votes: number;
}

export interface PollRow {
  id: string;
  question: string;
  options: PollOptionRow[];
  status: PollStatus;
  createdAt: number;
  /** Horodatage de clôture (résultats éphémères). */
  closedAt?: number;
}

function readAll(): PollRow[] {
  return pollStore.read();
}

function writeAll(rows: PollRow[]) {
  pollStore.write(rows);
}

/** Passe un sondage en clôturé avec horodatage. */
function markClosed(poll: PollRow) {
  poll.status = "closed";
  poll.closedAt = Date.now();
}

/** Ferme tout sondage actif avant d'en créer un nouveau. */
export function createPoll(question: string, optionLabels: string[]): PollRow {
  const rows = readAll();
  for (const p of rows) {
    if (p.status === "active") markClosed(p);
  }

  const poll: PollRow = {
    id: crypto.randomUUID(),
    question: question.trim(),
    options: optionLabels.map((label) => ({
      id: crypto.randomUUID(),
      label: label.trim(),
      votes: 0,
    })),
    status: "active",
    createdAt: Date.now(),
  };

  rows.push(poll);
  writeAll(rows);
  return poll;
}

export function getActivePoll(): PollRow | null {
  return readAll().find((p) => p.status === "active") ?? null;
}

/** Sondage à afficher : actif, ou dernier clôturé encore dans la fenêtre résultats. */
export function getDisplayPoll(resultsVisibleMs: number): PollRow | null {
  const active = getActivePoll();
  if (active) return active;

  const closed = readAll()
    .filter((p) => p.status === "closed")
    .sort(
      (a, b) => (b.closedAt ?? b.createdAt) - (a.closedAt ?? a.createdAt)
    )[0];
  if (!closed) return null;

  const closedAt = closed.closedAt ?? closed.createdAt;
  if (Date.now() - closedAt > resultsVisibleMs) return null;
  return closed;
}

export function getPollById(id: string): PollRow | undefined {
  return readAll().find((p) => p.id === id);
}

export function votePoll(
  pollId: string,
  optionId: string
): PollRow | undefined {
  const rows = readAll();
  const poll = rows.find((p) => p.id === pollId);
  if (!poll || poll.status !== "active") return undefined;

  const option = poll.options.find((o) => o.id === optionId);
  if (!option) return undefined;

  option.votes += 1;
  writeAll(rows);
  return poll;
}

export function closePoll(pollId: string): PollRow | undefined {
  const rows = readAll();
  const poll = rows.find((p) => p.id === pollId);
  if (!poll || poll.status !== "active") return undefined;

  markClosed(poll);
  writeAll(rows);
  return poll;
}
