import { Router } from "express";
import { getIo } from "../io";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  getTimerState,
  applyTimerCommand,
  type TimerCommand,
  type TimerMode,
} from "../timerDb";

const MODES: readonly TimerMode[] = ["off", "stopwatch", "timer"];

function isTimerMode(value: unknown): value is TimerMode {
  return typeof value === "string" && (MODES as string[]).includes(value);
}

function parseTimerCommand(body: unknown): TimerCommand | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;

  switch (raw.type) {
    case "setMode":
      return isTimerMode(raw.mode) ? { type: "setMode", mode: raw.mode } : null;
    case "setDuration":
      return typeof raw.durationMs === "number" && raw.durationMs > 0
        ? { type: "setDuration", durationMs: raw.durationMs }
        : null;
    case "start":
      return { type: "start" };
    case "pause":
      return { type: "pause" };
    case "reset":
      return { type: "reset" };
    case "setFinalTarget":
      return typeof raw.targetAt === "string" && raw.targetAt.trim()
        ? { type: "setFinalTarget", targetAt: raw.targetAt.trim() }
        : null;
    default:
      return null;
  }
}

const router = Router();

router.get("/state", (_req, res) => {
  res.json({ state: getTimerState() });
});

router.post("/command", requireAdmin, (req, res) => {
  const cmd = parseTimerCommand(req.body);
  if (!cmd) return res.status(400).json({ error: "Commande invalide" });

  const state = applyTimerCommand(cmd);
  getIo().emit("timer:state", state);
  res.json({ ok: true, state });
});

export default router;
