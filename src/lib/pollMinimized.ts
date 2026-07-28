const MINIMIZED_KEY = "poll:minimized";

function readMinimized(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(MINIMIZED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isPollMinimized(pollId: string): boolean {
  return readMinimized().includes(pollId);
}

export function setPollMinimized(pollId: string, minimized: boolean): void {
  const ids = readMinimized();
  const next = minimized
    ? ids.includes(pollId)
      ? ids
      : [...ids, pollId]
    : ids.filter((id) => id !== pollId);
  sessionStorage.setItem(MINIMIZED_KEY, JSON.stringify(next));
}

/** Nouveau sondage ou clôture → rouvrir la modal. */
export function clearPollMinimized(pollId: string): void {
  setPollMinimized(pollId, false);
}
