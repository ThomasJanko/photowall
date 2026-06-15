import { getReactionEmojis } from "./configDb";
import { createJsonStore } from "./jsonStore";

/**
 * Stockage simple en fichier JSON (pas de dépendance native).
 * Largement suffisant pour quelques centaines de photos sur une soirée.
 * Lecture/écriture synchrones : volumes faibles, pas de souci de perf.
 */

const photoStore = createJsonStore<PhotoRow[]>("photos.json", []);

export type PhotoStatus = "pending" | "approved";

export interface PhotoRow {
  id: string;
  filename: string;
  created_at: number;
  hidden: number;
  reactions: Record<string, number>;
  status: PhotoStatus;
  challenge_id?: string;
  author_pseudo?: string;
  challenge_votes?: { success: number; fail: number };
}

export interface LeaderboardEntry {
  pseudo: string;
  points: number;
  challengesWon: number;
}

/** Compteurs vides selon les emojis courants (configDb.getReactionEmojis). */
function emptyReactions(): Record<string, number> {
  return Object.fromEntries(getReactionEmojis().map((e) => [e, 0]));
}

function readAll(): PhotoRow[] {
  const rows = photoStore.read();
  // Migration douce : reactions et status absents sur les anciennes lignes
  return rows.map((r) => ({
    ...r,
    reactions: r.reactions ?? emptyReactions(),
    status: r.status ?? "approved",
  }));
}

function writeAll(rows: PhotoRow[]) {
  photoStore.write(rows);
}

export function insertPhoto(
  id: string,
  filename: string,
  createdAt: number,
  moderationRequired: boolean,
  challengeId?: string,
  authorPseudo?: string
): PhotoRow {
  const rows = readAll();
  const row: PhotoRow = {
    id,
    filename,
    created_at: createdAt,
    hidden: 0,
    reactions: emptyReactions(),
    status: moderationRequired ? "pending" : "approved",
    ...(challengeId
      ? {
          challenge_id: challengeId,
          challenge_votes: { success: 0, fail: 0 },
        }
      : {}),
    ...(authorPseudo ? { author_pseudo: authorPseudo } : {}),
  };
  rows.push(row);
  writeAll(rows);
  return row;
}

export function listVisiblePhotos(): PhotoRow[] {
  return readAll()
    .filter((r) => r.hidden === 0 && r.status === "approved")
    .sort((a, b) => a.created_at - b.created_at);
}

export function listPendingPhotos(): PhotoRow[] {
  return readAll()
    .filter((r) => r.hidden === 0 && r.status === "pending")
    .sort((a, b) => a.created_at - b.created_at);
}

export function hidePhoto(id: string) {
  const rows = readAll();
  const row = rows.find((r) => r.id === id);
  if (row) row.hidden = 1;
  writeAll(rows);
}

export function approvePhoto(id: string): PhotoRow | undefined {
  const rows = readAll();
  const row = rows.find((r) => r.id === id);
  if (!row || row.hidden || row.status !== "pending") return undefined;
  row.status = "approved";
  writeAll(rows);
  return row;
}

export function getPhoto(id: string): PhotoRow | undefined {
  return readAll().find((r) => r.id === id);
}

export function addReaction(
  photoId: string,
  emoji: string,
  delta: 1 | -1 = 1
): PhotoRow | undefined {
  const rows = readAll();
  const row = rows.find((r) => r.id === photoId);
  if (!row) return undefined;

  // Clamp à 0 : un retrait ne peut pas rendre un compteur négatif
  row.reactions[emoji] = Math.max(0, (row.reactions[emoji] ?? 0) + delta);
  writeAll(rows);
  return row;
}

/** Vote réussi/échec sur une photo de défi (clamp à 0). */
export function voteChallenge(
  photoId: string,
  vote: "success" | "fail",
  action: "add" | "remove"
): PhotoRow | undefined {
  const rows = readAll();
  const row = rows.find((r) => r.id === photoId);
  if (!row || !row.challenge_id) return undefined;

  if (!row.challenge_votes) {
    row.challenge_votes = { success: 0, fail: 0 };
  }

  const delta = action === "remove" ? -1 : 1;
  row.challenge_votes[vote] = Math.max(
    0,
    row.challenge_votes[vote] + delta
  );
  writeAll(rows);
  return row;
}

/** Classement calculé à la volée (+1 pt par défi gagné : success > fail). */
export function computeLeaderboard(): LeaderboardEntry[] {
  const byPseudo = new Map<string, { points: number; challengesWon: number }>();

  for (const row of listVisiblePhotos()) {
    if (!row.challenge_id || !row.author_pseudo || !row.challenge_votes) {
      continue;
    }
    if (row.challenge_votes.success <= row.challenge_votes.fail) continue;

    const cur = byPseudo.get(row.author_pseudo) ?? {
      points: 0,
      challengesWon: 0,
    };
    cur.points += 1;
    cur.challengesWon += 1;
    byPseudo.set(row.author_pseudo, cur);
  }

  return [...byPseudo.entries()]
    .map(([pseudo, data]) => ({ pseudo, ...data }))
    .sort(
      (a, b) =>
        b.points - a.points || a.pseudo.localeCompare(b.pseudo, "fr")
    );
}
