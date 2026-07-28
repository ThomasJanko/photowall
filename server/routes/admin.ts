import { Router } from "express";
import { createAdminToken, getAdminCode } from "../../src/lib/adminToken";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.post("/login", (req, res) => {
  const adminCode = getAdminCode();
  if (!adminCode) {
    return res.status(503).json({ error: "Admin non configuré" });
  }

  const code: unknown = req.body?.code;
  if (typeof code !== "string" || code !== adminCode) {
    return res.status(401).json({ error: "Code incorrect" });
  }

  res.json({ token: createAdminToken(adminCode) });
});

router.get("/verify", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

export default router;
