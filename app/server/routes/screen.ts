import { Router } from "express";
import { getIo } from "../io";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  applyScreenCommand,
  getScreenState,
  SCREEN_PATHS,
  type ScreenCommand,
  type ScreenPath,
} from "../screenDb";

const router = Router();

function isScreenPath(value: unknown): value is ScreenPath {
  return (
    typeof value === "string" &&
    (SCREEN_PATHS as readonly string[]).includes(value)
  );
}

function parseScreenCommand(body: unknown): ScreenCommand | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const type = raw.type;

  switch (type) {
    case "navigate":
      return isScreenPath(raw.path)
        ? { type: "navigate", path: raw.path }
        : null;
    case "scroll": {
      const direction = raw.direction;
      if (
        direction !== "up" &&
        direction !== "down" &&
        direction !== "top" &&
        direction !== "bottom"
      ) {
        return null;
      }
      const amount =
        typeof raw.amount === "number" ? raw.amount : undefined;
      return { type: "scroll", direction, amount };
    }
    case "volume":
      return typeof raw.value === "number"
        ? { type: "volume", value: raw.value }
        : null;
    case "zoom":
      return typeof raw.level === "number"
        ? { type: "zoom", level: raw.level }
        : null;
    case "fullscreen":
      return { type: "fullscreen" };
    case "action": {
      const name = raw.name;
      if (name === "retrospective:start" || name === "confetti:burst") {
        return { type: "action", name };
      }
      return null;
    }
    default:
      return null;
  }
}

router.get("/state", (_req, res) => {
  res.json({ state: getScreenState() });
});

router.post("/command", requireAdmin, (req, res) => {
  const cmd = parseScreenCommand(req.body);
  if (!cmd) return res.status(400).json({ error: "Commande invalide" });

  applyScreenCommand(cmd);
  getIo().emit("screen:command", cmd);
  res.json({ ok: true, state: getScreenState() });
});

export default router;
