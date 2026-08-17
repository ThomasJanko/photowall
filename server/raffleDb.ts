import { createJsonStore } from "./jsonStore";

export interface RaffleDraw {
  name: string;
  drawnAt: number;
}

export interface RaffleState {
  /** Personnes encore en jeu (pas encore tirées). */
  pool: string[];
  /** Historique des tirages, dans l'ordre (plus ancien en premier). */
  drawnNames: string[];
  /** Dernier tirage (pour la révélation live sur /wall), ou null. */
  currentDraw: RaffleDraw | null;
}

const DEFAULT_STATE: RaffleState = {
  pool: [],
  drawnNames: [],
  currentDraw: null,
};

const raffleStore = createJsonStore<RaffleState>("raffle.json", DEFAULT_STATE);

/** Trim + dédoublonnage insensible à la casse, en conservant l'ordre. */
function normalizeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function getRaffleState(): RaffleState {
  return { ...DEFAULT_STATE, ...raffleStore.read() };
}

export type RaffleCommand =
  | { type: "setPool"; names: string[] }
  | { type: "addNames"; names: string[] }
  | { type: "removeFromPool"; name: string }
  | { type: "draw" }
  | { type: "restoreAll" }
  | { type: "clear" };

/** Applique une commande admin et persiste le nouvel état. */
export function applyRaffleCommand(cmd: RaffleCommand): RaffleState {
  const current = getRaffleState();
  let next: RaffleState;

  switch (cmd.type) {
    case "setPool":
      // Redéfinit toute la liste : repart de zéro (efface l'historique).
      next = { pool: normalizeNames(cmd.names), drawnNames: [], currentDraw: null };
      break;

    case "addNames": {
      const existingKeys = new Set(
        [...current.pool, ...current.drawnNames].map((n) => n.toLowerCase())
      );
      const additions = normalizeNames(cmd.names).filter(
        (n) => !existingKeys.has(n.toLowerCase())
      );
      next = { ...current, pool: [...current.pool, ...additions] };
      break;
    }

    case "removeFromPool": {
      const key = cmd.name.trim().toLowerCase();
      next = {
        ...current,
        pool: current.pool.filter((n) => n.toLowerCase() !== key),
      };
      break;
    }

    case "draw": {
      if (current.pool.length === 0) {
        next = current;
        break;
      }
      const idx = Math.floor(Math.random() * current.pool.length);
      const name = current.pool[idx];
      const pool = current.pool.filter((_, i) => i !== idx);
      next = {
        pool,
        drawnNames: [...current.drawnNames, name],
        currentDraw: { name, drawnAt: Date.now() },
      };
      break;
    }

    case "restoreAll":
      // Remet tout le monde en jeu (garde la même liste, efface l'historique).
      next = {
        pool: normalizeNames([...current.pool, ...current.drawnNames]),
        drawnNames: [],
        currentDraw: null,
      };
      break;

    case "clear":
      next = { pool: [], drawnNames: [], currentDraw: null };
      break;

    default:
      next = current;
  }

  raffleStore.write(next);
  return next;
}
