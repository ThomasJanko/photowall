import { Router } from "express";
import { getIo } from "../io";
import { requireAdmin } from "../middleware/requireAdmin";

const DEFAULT_ANNOUNCEMENT_MS = 20000;

const router = Router();

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

  const payload = {
    text: rawText.trim().slice(0, 200),
    emoji,
    durationMs,
  };

  getIo().emit("announcement:new", payload);
  res.json({ ok: true, ...payload });
});

export default router;
