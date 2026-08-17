import { Router } from "express";
import { getIo } from "../io";
import { requireAdmin } from "../middleware/requireAdmin";
import { getRaffleState, applyRaffleCommand, type RaffleCommand } from "../raffleDb";

function parseNamesArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((v) => typeof v === "string")) return null;
  return value as string[];
}

function parseRaffleCommand(body: unknown): RaffleCommand | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;

  switch (raw.type) {
    case "setPool": {
      const names = parseNamesArray(raw.names);
      return names ? { type: "setPool", names } : null;
    }
    case "addNames": {
      const names = parseNamesArray(raw.names);
      return names ? { type: "addNames", names } : null;
    }
    case "removeFromPool":
      return typeof raw.name === "string" && raw.name.trim()
        ? { type: "removeFromPool", name: raw.name }
        : null;
    case "draw":
      return { type: "draw" };
    case "restoreAll":
      return { type: "restoreAll" };
    case "clear":
      return { type: "clear" };
    default:
      return null;
  }
}

const router = Router();

router.get("/state", (_req, res) => {
  res.json({ state: getRaffleState() });
});

router.post("/command", requireAdmin, (req, res) => {
  const cmd = parseRaffleCommand(req.body);
  if (!cmd) return res.status(400).json({ error: "Commande invalide" });

  // Capturé AVANT d'appliquer la commande : sert à l'animation de "roulement"
  // côté /wall (liste des candidats juste avant ce tirage).
  const before = cmd.type === "draw" ? getRaffleState() : null;

  const state = applyRaffleCommand(cmd);
  getIo().emit("raffle:state", state);

  if (cmd.type === "draw") {
    const drewSomething =
      before !== null && state.drawnNames.length > before.drawnNames.length;
    if (!drewSomething || !state.currentDraw) {
      return res
        .status(400)
        .json({ error: "Aucune personne restante à tirer" });
    }
    getIo().emit("raffle:draw", {
      name: state.currentDraw.name,
      drawnAt: state.currentDraw.drawnAt,
      candidatePool: before.pool,
      remainingCount: state.pool.length,
      totalCount: state.pool.length + state.drawnNames.length,
    });
  }

  res.json({ ok: true, state });
});

export default router;
