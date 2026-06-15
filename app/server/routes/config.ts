import { Router } from "express";
import { getConfig, updateConfig, resetConfig } from "../configDb";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.get("/", (_req, res) => {
  res.json(getConfig());
});

router.put("/", requireAdmin, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Corps JSON invalide" });
  }

  if (body.reset === true) {
    return res.json(resetConfig());
  }

  try {
    const { reset: _reset, ...partial } = body as Record<string, unknown>;
    const saved = updateConfig(partial as Parameters<typeof updateConfig>[0]);
    res.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Config invalide";
    res.status(400).json({ error: message });
  }
});

export default router;
