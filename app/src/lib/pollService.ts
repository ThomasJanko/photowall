import { io, type Socket } from "socket.io-client";
import { adminFetch } from "./adminAuth";
import type { Poll } from "./types/poll";

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

export async function fetchActivePoll(): Promise<Poll | null> {
  const res = await fetch(`${SERVER_URL}/api/polls/active`);
  if (!res.ok) throw new Error(`Chargement sondage échoué (${res.status})`);
  const data = await res.json();
  return data ?? null;
}

/** Sondage à afficher sur / et /wall (actif ou dernier clôturé). */
export async function fetchDisplayPoll(): Promise<Poll | null> {
  const res = await fetch(`${SERVER_URL}/api/polls/current`);
  if (!res.ok) throw new Error(`Chargement sondage échoué (${res.status})`);
  const data = await res.json();
  return data ?? null;
}

export async function votePoll(
  pollId: string,
  optionId: string
): Promise<Poll> {
  const res = await fetch(`${SERVER_URL}/api/polls/${pollId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ optionId }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Vote échoué (${res.status})`);
  }
  return res.json();
}

export async function createPoll(
  question: string,
  options: string[]
): Promise<Poll> {
  const res = await adminFetch(`${SERVER_URL}/api/polls`, {
    method: "POST",
    body: JSON.stringify({ question, options }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Création échouée (${res.status})`);
  }
  return res.json();
}

export async function closePollApi(pollId: string): Promise<Poll> {
  const res = await adminFetch(`${SERVER_URL}/api/polls/${pollId}/close`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Clôture échouée (${res.status})`);
  }
  return res.json();
}

export interface PollSocketHandlers {
  onNew?: (poll: Poll) => void;
  onUpdate?: (poll: Poll) => void;
  onClosed?: (poll: Poll) => void;
}

/** S'abonne aux événements sondage (temps réel). */
export function subscribePollEvents(handlers: PollSocketHandlers): () => void {
  const s = getSocket();
  const { onNew, onUpdate, onClosed } = handlers;

  if (onNew) s.on("poll:new", onNew);
  if (onUpdate) s.on("poll:update", onUpdate);
  if (onClosed) s.on("poll:closed", onClosed);

  return () => {
    if (onNew) s.off("poll:new", onNew);
    if (onUpdate) s.off("poll:update", onUpdate);
    if (onClosed) s.off("poll:closed", onClosed);
  };
}
