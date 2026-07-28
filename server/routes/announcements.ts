import { Router } from "express";
import { getIo } from "../io";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  saveCurrentAnnouncement,
  getCurrentAnnouncement,
} from "../announcementDb";

const DEFAULT_ANNOUNCEMENT_MS = 8_000;

const router = Router();

router.get("/current", (_req, res) => {
  const row = getCurrentAnnouncement();
  if (!row) {
    return res.json(null);
  }
  const remainingMs = row.durationMs - (Date.now() - row.startedAt);
  res.json({
    text: row.text,
    emoji: row.emoji,
    durationMs: row.durationMs,
    startedAt: row.startedAt,
    remainingMs,
  });
});

router.post("/", requireAdmin, (req, res) => {
  const rawText = req.body?.text;
  if (typeof rawText !== "string" || !rawText.trim()) {
    return res.status(400).json({ error: "Texte requis" });
  }

  const emoji =
    typeof req.body?.emoji === "string" && req.body.emoji.trim()
      ? req.body.emoji.trim().slice(0, 8)
      : undefined;

  let durationMs = DEFAULT_ANNOUNCEMENT_MS;
  if (typeof req.body?.durationMs === "number" && req.body.durationMs > 0) {
    durationMs = Math.min(Math.round(req.body.durationMs), 30_000);
  }

  const row = saveCurrentAnnouncement({
    text: rawText.trim().slice(0, 200),
    emoji,
    durationMs,
  });

  const payload = {
    text: row.text,
    emoji: row.emoji,
    durationMs: row.durationMs,
    startedAt: row.startedAt,
  };

  getIo().emit("announcement:new", payload);
  res.json({ ok: true, ...payload });
});

export default router;
