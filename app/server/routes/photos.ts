import path from "path";
import fs from "fs";
import { Router } from "express";
import { ZipArchive } from "archiver";
import {
  insertPhoto,
  listVisiblePhotos,
  listPendingPhotos,
  hidePhoto,
  approvePhoto,
  getPhoto,
  addReaction,
  voteChallenge,
  computeLeaderboard,
  type PhotoRow,
} from "../db";
import { getConfig, getReactionEmojis } from "../configDb";
import { getIo } from "../io";
import { upload, UPLOAD_DIR } from "../upload";
import { requireAdmin } from "../middleware/requireAdmin";
import { parseChallengeId, parseAuthorPseudo } from "../lib/parsers";
import { toPublicPhoto } from "../lib/photoPublic";

const router = Router();

router.get("/", (_req, res) => {
  res.json(listVisiblePhotos().map(toPublicPhoto));
});

router.post("/", upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu" });
  }

  const id = path.parse(req.file.filename).name;
  const createdAt = Date.now();
  const moderationRequired = getConfig().features.moderationRequired === true;
  const challengeId = parseChallengeId(req.body?.challengeId);
  const authorPseudo = parseAuthorPseudo(req.body?.authorPseudo);

  const row = insertPhoto(
    id,
    req.file.filename,
    createdAt,
    moderationRequired,
    challengeId,
    authorPseudo
  );
  const photo = toPublicPhoto(row);

  if (row.status === "approved") {
    getIo().emit("photo:new", photo);
  } else {
    getIo().emit("photo:pending", photo);
  }

  res.status(201).json(photo);
});

router.post("/:id/react", (req, res) => {
  const { id } = req.params;
  const emoji: unknown = req.body?.emoji;
  const action: "add" | "remove" =
    req.body?.action === "remove" ? "remove" : "add";

  if (
    typeof emoji !== "string" ||
    !(getReactionEmojis() as readonly string[]).includes(emoji)
  ) {
    return res.status(400).json({ error: "Emoji non autorisé" });
  }

  const existing = getPhoto(id);
  if (!existing || existing.hidden || existing.status !== "approved") {
    return res.status(404).json({ error: "Photo introuvable" });
  }

  const updated = addReaction(id, emoji, action === "remove" ? -1 : 1)!;

  getIo().emit("photo:reaction", {
    photoId: id,
    emoji,
    reactions: updated.reactions,
    action,
  });

  res.json(toPublicPhoto(updated));
});

router.post("/:id/challenge-vote", (req, res) => {
  const { id } = req.params;
  const vote: unknown = req.body?.vote;
  const action: "add" | "remove" =
    req.body?.action === "remove" ? "remove" : "add";

  if (vote !== "success" && vote !== "fail") {
    return res.status(400).json({ error: "Vote invalide" });
  }

  const existing = getPhoto(id);
  if (!existing || existing.hidden || existing.status !== "approved") {
    return res.status(404).json({ error: "Photo introuvable" });
  }
  if (!existing.challenge_id) {
    return res.status(400).json({ error: "Cette photo n'est pas liée à un défi" });
  }

  const updated = voteChallenge(id, vote, action);
  if (!updated) {
    return res.status(400).json({ error: "Vote impossible" });
  }

  getIo().emit("photo:challengeVote", {
    photoId: id,
    challengeVotes: updated.challenge_votes!,
    vote,
    action,
  });

  res.json(toPublicPhoto(updated));
});

router.get("/pending", requireAdmin, (_req, res) => {
  res.json(listPendingPhotos().map(toPublicPhoto));
});

router.post("/:id/approve", requireAdmin, (req, res) => {
  const { id } = req.params;
  const row = approvePhoto(id);
  if (!row) {
    return res.status(404).json({ error: "Photo introuvable ou déjà traitée" });
  }

  const photo = toPublicPhoto(row);
  getIo().emit("photo:new", photo);
  res.json(photo);
});

router.post("/export", requireAdmin, (req, res) => {
  const ids: unknown = req.body?.ids;
  let rows: PhotoRow[];

  if (!Array.isArray(ids) || ids.length === 0) {
    rows = listVisiblePhotos();
  } else {
    rows = ids
      .filter((id): id is string => typeof id === "string")
      .map((id) => getPhoto(id))
      .filter((row): row is PhotoRow => row !== undefined && row.hidden === 0);
  }

  if (rows.length === 0) {
    return res.status(404).json({ error: "Aucune photo à exporter" });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="photos.zip"'
  );

  const archive = new ZipArchive({ zlib: { level: 5 } });
  archive.on("error", (err: Error) => {
    console.error("[export]", err);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  for (const row of rows) {
    const filePath = path.join(UPLOAD_DIR, row.filename);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: row.filename });
    }
  }

  void archive.finalize();
});

router.delete("/bulk", requireAdmin, (req, res) => {
  const ids: unknown = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Liste d'IDs requise" });
  }

  let removed = 0;
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const existing = getPhoto(id);
    if (!existing || existing.hidden) continue;
    hidePhoto(id);
    getIo().emit("photo:removed", id);
    removed++;
  }

  res.json({ removed });
});

router.delete("/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const existing = getPhoto(id);

  if (!existing) {
    return res.status(404).json({ error: "Photo introuvable" });
  }

  hidePhoto(id);
  getIo().emit("photo:removed", id);

  res.status(204).send();
});

export default router;

/** Classement des défis (calcul à la volée). */
export const leaderboardRouter = Router();
leaderboardRouter.get("/", (_req, res) => {
  res.json(computeLeaderboard());
});
