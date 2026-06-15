import type express from "express";
import {
  verifyAdminToken,
  getAdminCode,
  extractBearerToken,
} from "../../src/lib/adminToken";

/** Routes admin protégées par token dérivé de ADMIN_CODE. */
export function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const adminCode = getAdminCode();
  if (!adminCode) {
    return res.status(503).json({ error: "Admin non configuré" });
  }

  const token = extractBearerToken(
    req.headers.authorization,
    req.headers["x-admin-token"]
  );

  if (!verifyAdminToken(token ?? "", adminCode)) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  next();
}
