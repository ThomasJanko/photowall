import { Router } from "express";
import {
  listChallenges,
  listActiveChallenges,
  createChallenge,
  updateChallenge,
  deleteChallenge,
  toPublicChallenge,
} from "../challengesDb";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.get("/", (_req, res) => {
  res.json(listActiveChallenges().map(toPublicChallenge));
});

router.get("/all", requireAdmin, (_req, res) => {
  res.json(listChallenges().map(toPublicChallenge));
});

router.post("/", requireAdmin, (req, res) => {
  const label: unknown = req.body?.label;
  if (typeof label !== "string" || !label.trim()) {
    return res.status(400).json({ error: "Label requis" });
  }
  const emoji =
    typeof req.body?.emoji === "string" && req.body.emoji.trim()
      ? req.body.emoji.trim().slice(0, 8)
      : undefined;

  const row = createChallenge(label, emoji);
  res.status(201).json(toPublicChallenge(row));
});

router.put("/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const patch: {
    label?: string;
    emoji?: string;
    active?: boolean;
  } = {};

  if (req.body?.label !== undefined) {
    if (typeof req.body.label !== "string" || !req.body.label.trim()) {
      return res.status(400).json({ error: "Label invalide" });
    }
    patch.label = req.body.label;
  }
  if (req.body?.emoji !== undefined) {
    patch.emoji = typeof req.body.emoji === "string" ? req.body.emoji : "";
  }
  if (req.body?.active !== undefined) {
    patch.active = req.body.active === true;
  }

  const updated = updateChallenge(id, patch);
  if (!updated) {
    return res.status(404).json({ error: "Défi introuvable" });
  }
  res.json(toPublicChallenge(updated));
});

router.delete("/:id", requireAdmin, (req, res) => {
  const ok = deleteChallenge(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Défi introuvable" });
  }
  res.status(204).send();
});

export default router;
