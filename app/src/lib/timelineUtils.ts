/** Couleurs d'accent par défaut pour les ères sans `color` custom. */
export const TIMELINE_ERA_FALLBACK_COLORS = [
  "#f472b6",
  "#c084fc",
  "#818cf8",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#fb923c",
  "#f87171",
] as const;

export function eraAccentColor(
  color: string | undefined,
  index: number
): string {
  if (color?.match(/^#[0-9a-fA-F]{6}$/)) return color;
  return TIMELINE_ERA_FALLBACK_COLORS[
    index % TIMELINE_ERA_FALLBACK_COLORS.length
  ];
}

export function resolveMediaUrl(url: string): string {
  if (url.startsWith("http")) return url;
  const base = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";
  return `${base}${url}`;
}

export function formatTimelineDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
