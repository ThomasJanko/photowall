const VOTED_KEY = "polls:voted";

/** IDs de sondages pour lesquels cet appareil a déjà voté. */
export function getVotedPollIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VOTED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function hasVotedPoll(pollId: string): boolean {
  return getVotedPollIds().includes(pollId);
}

export function markPollVoted(pollId: string): void {
  const ids = getVotedPollIds();
  if (ids.includes(pollId)) return;
  localStorage.setItem(VOTED_KEY, JSON.stringify([...ids, pollId]));
}
