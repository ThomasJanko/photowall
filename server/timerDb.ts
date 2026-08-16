import { createJsonStore } from "./jsonStore";

/**
 * "off"       → aucun chrono/minuteur actif, /countdown affiche le compte à
 *               rebours final (vers la date de la soirée).
 * "stopwatch" → chrono qui compte le temps écoulé (ex: chronométrer un jeu).
 * "timer"     → minuteur qui décompte depuis `durationMs` (dernières
 *               secondes en rouge + son côté client).
 */
export type TimerMode = "off" | "stopwatch" | "timer";

export interface TimerState {
  mode: TimerMode;
  running: boolean;
  /** Durée totale du minuteur (ms), utilisée uniquement en mode "timer". */
  durationMs: number;
  /** Horodatage serveur du début du segment de course courant (null si en pause/arrêté). */
  startedAt: number | null;
  /** Temps déjà écoulé (ms) avant le segment de course courant. */
  elapsedMs: number;
  /**
   * Date/heure cible du compte à rebours final (mode "off"), au format local
   * "YYYY-MM-DDTHH:mm:ss" (compatible <input type="datetime-local">).
   * Réglée en direct depuis l'onglet admin "Chrono", indépendamment du mode
   * courant : pas besoin de recharger les pages invités.
   */
  finalTargetAt: string;
}

const DEFAULT_DURATION_MS = 60_000;
const MAX_DURATION_MS = 3 * 60 * 60 * 1000; // 3h, garde-fou
const DEFAULT_FINAL_TARGET_AT = "2026-07-18T00:00:00";

const DEFAULT_STATE: TimerState = {
  mode: "off",
  running: false,
  durationMs: DEFAULT_DURATION_MS,
  startedAt: null,
  elapsedMs: 0,
  finalTargetAt: DEFAULT_FINAL_TARGET_AT,
};

const timerStore = createJsonStore<TimerState>("timer.json", DEFAULT_STATE);

function effectiveElapsedMs(state: TimerState, nowMs: number): number {
  if (!state.running || state.startedAt == null) return state.elapsedMs;
  return state.elapsedMs + Math.max(0, nowMs - state.startedAt);
}

/**
 * Fige le minuteur à échéance (mode "timer" arrivé à 0 restant) pour éviter
 * qu'il continue de "courir" indéfiniment côté serveur une fois terminé.
 */
function settle(state: TimerState, nowMs: number): TimerState {
  if (state.mode !== "timer" || !state.running) return state;
  const elapsed = effectiveElapsedMs(state, nowMs);
  if (elapsed >= state.durationMs) {
    return {
      ...state,
      running: false,
      startedAt: null,
      elapsedMs: state.durationMs,
    };
  }
  return state;
}

/** État courant (auto-réglé si le minuteur est arrivé à échéance). */
export function getTimerState(): TimerState {
  // Spread sur DEFAULT_STATE : comble les champs manquants si le fichier a
  // été écrit par une version antérieure (ex: sans finalTargetAt).
  const raw: TimerState = { ...DEFAULT_STATE, ...timerStore.read() };
  const settled = settle(raw, Date.now());
  if (settled !== raw) timerStore.write(settled);
  return settled;
}

export type TimerCommand =
  | { type: "setMode"; mode: TimerMode }
  | { type: "setDuration"; durationMs: number }
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "setFinalTarget"; targetAt: string };

/** Applique une commande admin et persiste le nouvel état. */
export function applyTimerCommand(cmd: TimerCommand): TimerState {
  const current = getTimerState();
  const now = Date.now();
  let next: TimerState;

  switch (cmd.type) {
    case "setMode":
      next = {
        ...current,
        mode: cmd.mode,
        running: false,
        startedAt: null,
        elapsedMs: 0,
      };
      break;

    case "setDuration":
      next = {
        ...current,
        durationMs: Math.min(
          MAX_DURATION_MS,
          Math.max(1000, Math.round(cmd.durationMs))
        ),
        running: false,
        startedAt: null,
        elapsedMs: 0,
      };
      break;

    case "start":
      if (current.mode === "off") {
        next = current;
        break;
      }
      // Minuteur déjà à échéance : il faut d'abord "reset" avant de repartir.
      if (
        current.mode === "timer" &&
        current.elapsedMs >= current.durationMs
      ) {
        next = current;
        break;
      }
      next = { ...current, running: true, startedAt: now };
      break;

    case "pause":
      next = {
        ...current,
        running: false,
        startedAt: null,
        elapsedMs: effectiveElapsedMs(current, now),
      };
      break;

    case "reset":
      next = { ...current, running: false, startedAt: null, elapsedMs: 0 };
      break;

    case "setFinalTarget":
      next = { ...current, finalTargetAt: cmd.targetAt };
      break;

    default:
      next = current;
  }

  timerStore.write(next);
  return next;
}
