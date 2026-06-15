import type { PhotoRow } from "../db";

export function toPublicPhoto(row: PhotoRow) {
  return {
    id: row.id,
    url: `/uploads/${row.filename}`,
    createdAt: row.created_at,
    reactions: row.reactions,
    status: row.status,
    ...(row.challenge_id ? { challengeId: row.challenge_id } : {}),
    ...(row.author_pseudo ? { authorPseudo: row.author_pseudo } : {}),
    ...(row.challenge_votes ? { challengeVotes: row.challenge_votes } : {}),
  };
}
