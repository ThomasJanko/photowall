import type { CSSProperties } from "react";
import type { EventTheme } from "@/config/event";

/** Couleurs de fond / accent appliquées via CSS variables sur :root. */
export type ThemeColors = Pick<
  EventTheme,
  | "gradientFrom"
  | "gradientVia"
  | "gradientTo"
  | "accent"
  | "primary"
  | "secondary"
>;

/** Style inline pour le dégradé événement (utilise les CSS variables). */
export const eventGradientStyle: CSSProperties = {
  background:
    "linear-gradient(to bottom right, var(--event-gradient-from), var(--event-gradient-via), var(--event-gradient-to))",
};

/** Applique les couleurs du thème sur document.documentElement. */
export function applyThemeToDocument(theme: ThemeColors): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--event-gradient-from", theme.gradientFrom);
  root.style.setProperty("--event-gradient-via", theme.gradientVia);
  root.style.setProperty("--event-gradient-to", theme.gradientTo);
  root.style.setProperty("--event-accent", theme.accent);
  root.style.setProperty("--event-primary", theme.primary);
  root.style.setProperty("--event-secondary", theme.secondary);
}
