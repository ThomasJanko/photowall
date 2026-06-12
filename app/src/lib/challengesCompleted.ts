const STORAGE_KEY = "challenges:completed";

export function getCompletedChallengeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isChallengeCompleted(id: string): boolean {
  return getCompletedChallengeIds().includes(id);
}

/** Marque un défi comme relevé sur cet appareil (idempotent). */
export function markChallengeCompleted(id: string): void {
  const ids = getCompletedChallengeIds();
  if (ids.includes(id)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, id]));
}
