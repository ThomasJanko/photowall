import { Router } from "express";
import {
  createPoll,
  getActivePoll,
  getDisplayPoll,
  votePoll,
  closePoll,
  type PollRow,
} from "../pollDb";
import { getConfig } from "../configDb";
import { getIo } from "../io";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

function toPublicPoll(row: PollRow) {
  return {
    id: row.id,
    question: row.question,
    options: row.options,
    status: row.status,
    createdAt: row.createdAt,
    closedAt: row.closedAt,
  };
}

router.get("/active", (_req, res) => {
  const poll = getActivePoll();
  res.json(poll ? toPublicPoll(poll) : null);
});

router.get("/current", (_req, res) => {
  const duration = getConfig().pollResultsDurationMs ?? 60_000;
  const poll = getDisplayPoll(duration);
  res.json(poll ? toPublicPoll(poll) : null);
});

router.post("/", requireAdmin, (req, res) => {
  const question: unknown = req.body?.question;
  const options: unknown = req.body?.options;

  if (typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "Question requise" });
  }

  if (
    !Array.isArray(options) ||
    options.length < 2 ||
    !options.every((o) => typeof o === "string" && o.trim().length > 0)
  ) {
    return res.status(400).json({ error: "Minimum 2 options requises" });
  }

  const poll = createPoll(
    question,
    options.map((o) => (o as string).trim())
  );
  const publicPoll = toPublicPoll(poll);
  getIo().emit("poll:new", publicPoll);
  res.status(201).json(publicPoll);
});

router.post("/:id/vote", (req, res) => {
  const { id } = req.params;
  const optionId: unknown = req.body?.optionId;

  if (typeof optionId !== "string" || !optionId) {
    return res.status(400).json({ error: "optionId requis" });
  }

  const updated = votePoll(id, optionId);
  if (!updated) {
    return res.status(404).json({ error: "Sondage ou option introuvable" });
  }

  const publicPoll = toPublicPoll(updated);
  getIo().emit("poll:update", publicPoll);
  res.json(publicPoll);
});

router.post("/:id/close", requireAdmin, (req, res) => {
  const { id } = req.params;
  const closed = closePoll(id);
  if (!closed) {
    return res.status(404).json({ error: "Sondage actif introuvable" });
  }

  const publicPoll = toPublicPoll(closed);
  getIo().emit("poll:closed", publicPoll);
  res.json(publicPoll);
});

export default router;
