/**
 * Palette du mur selon l'heure réelle : la fête évolue, le fond aussi.
 * Les couleurs sont appliquées via CSS variables (voir applyEventTheme.ts).
 */

import { eventConfig } from "@/config/event";

export interface TimeTheme {
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  accent: string;
  primary: string;
  secondary: string;
}

/** Après-midi / début de soirée — palette vive actuelle. */
export const DEFAULT_THEME: TimeTheme = {
  ...eventConfig.theme,
};

/** Soirée (20h-23h) — doré/orangé plus chaleureux. */
const EVENING_THEME: TimeTheme = {
  primary: "#3b0764",
  secondary: "#881337",
  accent: "#fbbf24",
  gradientFrom: "#3b0764",
  gradientVia: "#881337",
  gradientTo: "#78350f",
};

/** Nuit (23h-2h) — bleu nuit / indigo profond. */
const NIGHT_THEME: TimeTheme = {
  primary: "#020617",
  secondary: "#1e1b4b",
  accent: "#818cf8",
  gradientFrom: "#020617",
  gradientVia: "#1e1b4b",
  gradientTo: "#3b0764",
};

/** Très tard (2h-6h) — encore plus sombre et calme. */
const LATE_NIGHT_THEME: TimeTheme = {
  primary: "#000000",
  secondary: "#020617",
  accent: "#6366f1",
  gradientFrom: "#000000",
  gradientVia: "#020617",
  gradientTo: "#1e1b4b",
};

export function getTimeTheme(date: Date = new Date()): TimeTheme {
  const hour = date.getHours();
  if (hour >= 2 && hour < 6) return LATE_NIGHT_THEME;
  if (hour >= 23 || hour < 2) return NIGHT_THEME;
  if (hour >= 20) return EVENING_THEME;
  return DEFAULT_THEME;
}
