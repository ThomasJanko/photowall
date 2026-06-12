const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

export interface PublicChallenge {
  id: string;
  label: string;
  emoji?: string;
}

export interface AdminChallenge extends PublicChallenge {
  active: boolean;
  createdAt: number;
}

/** Défis actifs (page d'upload invités). */
export async function fetchActiveChallenges(): Promise<PublicChallenge[]> {
  try {
    const res = await fetch(`${SERVER_URL}/api/challenges`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Tous les défis (admin). */
export async function fetchAllChallenges(): Promise<AdminChallenge[]> {
  const { adminFetch } = await import("./adminAuth");
  const res = await adminFetch(`${SERVER_URL}/api/challenges/all`);
  if (!res.ok) throw new Error(`Chargement défis échoué (${res.status})`);
  return res.json();
}

export async function createChallengeApi(
  label: string,
  emoji?: string
): Promise<AdminChallenge> {
  const { adminFetch } = await import("./adminAuth");
  const res = await adminFetch(`${SERVER_URL}/api/challenges`, {
    method: "POST",
    body: JSON.stringify({ label, emoji }),
  });
  if (!res.ok) throw new Error(`Création défi échouée (${res.status})`);
  return res.json();
}

export async function updateChallengeApi(
  id: string,
  patch: Partial<Pick<AdminChallenge, "label" | "emoji" | "active">>
): Promise<AdminChallenge> {
  const { adminFetch } = await import("./adminAuth");
  const res = await adminFetch(`${SERVER_URL}/api/challenges/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Mise à jour défi échouée (${res.status})`);
  return res.json();
}

export async function deleteChallengeApi(id: string): Promise<void> {
  const { adminFetch } = await import("./adminAuth");
  const res = await adminFetch(`${SERVER_URL}/api/challenges/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Suppression défi échouée (${res.status})`);
}
