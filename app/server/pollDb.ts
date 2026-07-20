import crypto from "crypto";
import { createJsonStore } from "./jsonStore";

/** Stockage JSON des sondages (data/poll-sessions.json). */

const pollStore = createJsonStore<PollSessionRow[]>("poll-sessions.json", []);

export type PollMode = "quick" | "quiz";
export type PollSessionStatus = "active" | "closed";
export type QuestionPhase = "voting" | "results";

export interface PollOptionRow {
  id: string;
  label: string;
  votes: number;
}

export interface PollQuestionRow {
  id: string;
  question: string;
  options: PollOptionRow[];
}

export interface PollSessionRow {
  id: string;
  mode: PollMode;
  title?: string;
  questions: PollQuestionRow[];
  currentIndex: number;
  phase: QuestionPhase;
  status: PollSessionStatus;
  /** Si true, les invités voient les % en direct pendant le vote (pas d'attente de révélation). */
  liveResults: boolean;
  createdAt: number;
  closedAt?: number;
}

export interface QuestionInput {
  question: string;
  options: string[];
}

function readAll(): PollSessionRow[] {
  return pollStore.read();
}

function writeAll(rows: PollSessionRow[]) {
  pollStore.write(rows);
}

function buildQuestion(input: QuestionInput): PollQuestionRow {
  return {
    id: crypto.randomUUID(),
    question: input.question.trim(),
    options: input.options.map((label) => ({
      id: crypto.randomUUID(),
      label: label.trim(),
      votes: 0,
    })),
  };
}

/** Ferme toute session active (sécurité avant d'en créer une nouvelle). */
function closeAllActive(rows: PollSessionRow[]) {
  for (const s of rows) {
    if (s.status === "active") {
      s.status = "closed";
      s.phase = "results";
      s.closedAt = Date.now();
    }
  }
}

export function createSession(
  mode: PollMode,
  questions: QuestionInput[],
  title?: string,
  liveResults = false
): PollSessionRow {
  const rows = readAll();
  closeAllActive(rows);

  const session: PollSessionRow = {
    id: crypto.randomUUID(),
    mode,
    title: title?.trim() || undefined,
    questions: questions.map(buildQuestion),
    currentIndex: 0,
    phase: "voting",
    status: "active",
    liveResults,
    createdAt: Date.now(),
  };

  rows.push(session);
  writeAll(rows);
  return session;
}

export function getActiveSession(): PollSessionRow | null {
  return readAll().find((s) => s.status === "active") ?? null;
}

/** Session à afficher : active, ou dernière clôturée encore dans la fenêtre résultats. */
export function getDisplaySession(
  resultsVisibleMs: number
): PollSessionRow | null {
  const active = getActiveSession();
  if (active) return active;

  const closed = readAll()
    .filter((s) => s.status === "closed")
    .sort(
      (a, b) => (b.closedAt ?? b.createdAt) - (a.closedAt ?? a.createdAt)
    )[0];
  if (!closed) return null;

  const closedAt = closed.closedAt ?? closed.createdAt;
  if (Date.now() - closedAt > resultsVisibleMs) return null;
  return closed;
}

export function getSessionById(id: string): PollSessionRow | undefined {
  return readAll().find((s) => s.id === id);
}

function currentQuestion(session: PollSessionRow): PollQuestionRow {
  return session.questions[session.currentIndex];
}

export function voteOnCurrentQuestion(
  sessionId: string,
  questionId: string,
  optionId: string
): PollSessionRow | undefined {
  const rows = readAll();
  const session = rows.find((s) => s.id === sessionId);
  if (!session || session.status !== "active" || session.phase !== "voting") {
    return undefined;
  }

  const question = currentQuestion(session);
  if (!question || question.id !== questionId) return undefined;

  const option = question.options.find((o) => o.id === optionId);
  if (!option) return undefined;

  option.votes += 1;
  writeAll(rows);
  return session;
}

/** Révèle les résultats de la question courante (sans changer de question). */
export function revealCurrentQuestion(
  sessionId: string
): PollSessionRow | undefined {
  const rows = readAll();
  const session = rows.find((s) => s.id === sessionId);
  if (!session || session.status !== "active") return undefined;

  session.phase = "results";
  writeAll(rows);
  return session;
}

/** Passe à la question suivante (quiz uniquement). */
export function nextQuestion(sessionId: string): PollSessionRow | undefined {
  const rows = readAll();
  const session = rows.find((s) => s.id === sessionId);
  if (!session || session.status !== "active") return undefined;
  if (session.currentIndex + 1 >= session.questions.length) return undefined;

  session.currentIndex += 1;
  session.phase = "voting";
  writeAll(rows);
  return session;
}

/** Clôture la session (force la révélation de la question courante). */
export function closeSession(sessionId: string): PollSessionRow | undefined {
  const rows = readAll();
  const session = rows.find((s) => s.id === sessionId);
  if (!session || session.status !== "active") return undefined;

  session.status = "closed";
  session.phase = "results";
  session.closedAt = Date.now();
  writeAll(rows);
  return session;
}
