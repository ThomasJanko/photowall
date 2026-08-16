import type { TimerState } from "./types";

/** Temps écoulé "effectif" à l'instant nowMs, tenant compte d'une éventuelle pause. */
export function effectiveElapsedMs(state: TimerState, nowMs: number): number {
  if (!state.running || state.startedAt == null) return state.elapsedMs;
  return state.elapsedMs + Math.max(0, nowMs - state.startedAt);
}

/**
 * Formate une durée en mm:ss (ou h:mm:ss au-delà d'une heure).
 *
 * `rounding` compte : pour un temps ÉCOULÉ (chrono), on veut le nombre de
 * secondes pleines déjà passées → "floor" (0 pendant tout le premier
 * seconde, puis 1 à partir de exactement 1000ms). Pour un temps RESTANT
 * (minuteur), on veut le nombre de secondes encore à courir → "ceil" (10
 * dès le lancement d'un minuteur de 10s, jusqu'à ce que 1000ms se soient
 * réellement écoulées, puis 9...). Un simple arrondi ferait changer les
 * chiffres une demi-seconde trop tôt dans les deux cas.
 */
export function formatDuration(
  ms: number,
  rounding: "floor" | "ceil" = "floor"
): string {
  const totalSec =
    rounding === "ceil" ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const clamped = Math.max(0, totalSec);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor(clamped / 60) % 60;
  const s = clamped % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
