import { io, type Socket } from "socket.io-client";
import { adminFetch } from "./adminAuth";
import type {
  AdminPollSession,
  PollQuestionInput,
  PollSession,
} from "./types/poll";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }
  return socket;
}

async function readJsonError(res: Response, fallback: string): Promise<never> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(data.error ?? `${fallback} (${res.status})`);
}

/** Sondage à afficher côté invité (question courante — actif ou dernier clôturé récent). */
export async function fetchCurrentPoll(): Promise<PollSession | null> {
  const res = await fetch(`${SERVER_URL}/api/polls/current`);
  if (!res.ok) throw new Error(`Chargement sondage échoué (${res.status})`);
  const data = await res.json();
  return data ?? null;
}

/** Sondage actif complet côté admin (toutes les questions, vrais compteurs). */
export async function fetchActivePollAdmin(): Promise<AdminPollSession | null> {
  const res = await adminFetch(`${SERVER_URL}/api/polls/active`);
  if (!res.ok) return readJsonError(res, "Chargement sondage échoué");
  const data = await res.json();
  return data ?? null;
}

export async function createQuickPoll(
  question: string,
  options: string[],
  liveResults = false
): Promise<AdminPollSession> {
  const res = await adminFetch(`${SERVER_URL}/api/polls/quick`, {
    method: "POST",
    body: JSON.stringify({ question, options, liveResults }),
  });
  if (!res.ok) return readJsonError(res, "Création échouée");
  return res.json();
}

export async function createQuizPoll(
  questions: PollQuestionInput[],
  title?: string,
  liveResults = false
): Promise<AdminPollSession> {
  const res = await adminFetch(`${SERVER_URL}/api/polls/quiz`, {
    method: "POST",
    body: JSON.stringify({ title, questions, liveResults }),
  });
  if (!res.ok) return readJsonError(res, "Création échouée");
  return res.json();
}

export async function votePoll(
  sessionId: string,
  questionId: string,
  optionId: string
): Promise<PollSession> {
  const res = await fetch(`${SERVER_URL}/api/polls/${sessionId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionId, optionId }),
  });
  if (!res.ok) return readJsonError(res, "Vote échoué");
  return res.json();
}

/** Révèle les résultats de la question courante (sans avancer). */
export async function revealResults(
  sessionId: string
): Promise<AdminPollSession> {
  const res = await adminFetch(`${SERVER_URL}/api/polls/${sessionId}/reveal`, {
    method: "POST",
  });
  if (!res.ok) return readJsonError(res, "Révélation échouée");
  return res.json();
}

/** Passe à la question suivante (quiz). */
export async function nextQuestionApi(
  sessionId: string
): Promise<AdminPollSession> {
  const res = await adminFetch(`${SERVER_URL}/api/polls/${sessionId}/next`, {
    method: "POST",
  });
  if (!res.ok) return readJsonError(res, "Passage à la question suivante échoué");
  return res.json();
}

export async function closePollApi(
  sessionId: string
): Promise<AdminPollSession> {
  const res = await adminFetch(`${SERVER_URL}/api/polls/${sessionId}/close`, {
    method: "POST",
  });
  if (!res.ok) return readJsonError(res, "Clôture échouée");
  return res.json();
}

export interface PollSocketHandlers {
  onNew?: (poll: PollSession) => void;
  onUpdate?: (poll: PollSession) => void;
  onResults?: (poll: PollSession) => void;
  onClosed?: (poll: PollSession) => void;
}

/** S'abonne aux événements sondage (temps réel). */
export function subscribePollEvents(handlers: PollSocketHandlers): () => void {
  const s = getSocket();
  const { onNew, onUpdate, onResults, onClosed } = handlers;

  if (onNew) s.on("poll:new", onNew);
  if (onUpdate) s.on("poll:update", onUpdate);
  if (onResults) s.on("poll:results", onResults);
  if (onClosed) s.on("poll:closed", onClosed);

  return () => {
    if (onNew) s.off("poll:new", onNew);
    if (onUpdate) s.off("poll:update", onUpdate);
    if (onResults) s.off("poll:results", onResults);
    if (onClosed) s.off("poll:closed", onClosed);
  };
}

/** Rappelle `cb` à chaque (re)connexion socket — utile pour re-fetch après coupure wifi. */
export function onPollSocketReconnect(cb: () => void): () => void {
  const s = getSocket();
  s.on("connect", cb);
  return () => s.off("connect", cb);
}
