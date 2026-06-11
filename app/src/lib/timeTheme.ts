/**
 * Palette du mur selon l'heure réelle : la fête évolue, le fond aussi.
 * Les classes Tailwind sont des chaînes COMPLÈTES (jamais concaténées)
 * pour être détectées par le JIT.
 */

export interface TimeTheme {
  /** Classes Tailwind du dégradé de fond. */
  gradient: string;
  /** Couleur d'accent (hex), ex: confettis. */
  accent: string;
}

/** Après-midi / début de soirée — palette vive actuelle. Sert aussi de valeur SSR. */
export const DEFAULT_THEME: TimeTheme = {
  gradient: "bg-linear-to-br from-purple-950 via-purple-900 to-pink-900",
  accent: "#f472b6",
};

/** Soirée (20h-23h) — doré/orangé plus chaleureux. */
const EVENING_THEME: TimeTheme = {
  gradient: "bg-linear-to-br from-purple-950 via-rose-900 to-amber-900",
  accent: "#fbbf24",
};

/** Nuit (23h-2h) — bleu nuit / indigo profond. */
const NIGHT_THEME: TimeTheme = {
  gradient: "bg-linear-to-br from-slate-950 via-indigo-950 to-purple-950",
  accent: "#818cf8",
};

/** Très tard (2h-6h) — encore plus sombre et calme. */
const LATE_NIGHT_THEME: TimeTheme = {
  gradient: "bg-linear-to-br from-black via-slate-950 to-indigo-950",
  accent: "#6366f1",
};

export function getTimeTheme(date: Date = new Date()): TimeTheme {
  const hour = date.getHours();
  if (hour >= 2 && hour < 6) return LATE_NIGHT_THEME;
  if (hour >= 23 || hour < 2) return NIGHT_THEME;
  if (hour >= 20) return EVENING_THEME;
  return DEFAULT_THEME;
}
