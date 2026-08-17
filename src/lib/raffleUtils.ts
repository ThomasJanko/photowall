import type { RaffleDraw } from "./types";

/** Durée de l'animation de "roulement" avant révélation (ms). */
export const RAFFLE_SHUFFLE_MS = 1100;
/** Durée d'affichage du nom une fois révélé, avant disparition (ms). */
export const RAFFLE_HOLD_MS = 5000;
/** Durée totale d'affichage de la révélation sur /wall (ms). */
export const RAFFLE_TOTAL_DISPLAY_MS = RAFFLE_SHUFFLE_MS + RAFFLE_HOLD_MS;

/** Temps restant d'affichage du tirage courant (ms), pour un invité qui rejoint en cours. */
export function raffleRemainingMs(draw: RaffleDraw): number {
  return Math.max(0, RAFFLE_TOTAL_DISPLAY_MS - (Date.now() - draw.drawnAt));
}
