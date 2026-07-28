import type { EventConfig } from "@/config/event";
import { eventConfig as defaultEventConfig } from "@/config/event";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/** Charge la config depuis l'API (fallback sur les défauts du code). */
export async function fetchEventConfig(): Promise<EventConfig> {
  try {
    const res = await fetch(`${SERVER_URL}/api/config`);
    if (!res.ok) return defaultEventConfig;
    return res.json();
  } catch {
    return defaultEventConfig;
  }
}

/** Met à jour la config (admin, merge côté serveur). */
export async function updateEventConfigApi(
  partial: Partial<EventConfig>
): Promise<EventConfig> {
  const { adminFetch } = await import("./adminAuth");
  const res = await adminFetch(`${SERVER_URL}/api/config`, {
    method: "PUT",
    body: JSON.stringify(partial),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Sauvegarde échouée (${res.status})`);
  }
  return res.json();
}

/** Réinitialise aux valeurs par défaut de src/config/event.ts. */
export async function resetEventConfigApi(): Promise<EventConfig> {
  const { adminFetch } = await import("./adminAuth");
  const res = await adminFetch(`${SERVER_URL}/api/config`, {
    method: "PUT",
    body: JSON.stringify({ reset: true }),
  });
  if (!res.ok) throw new Error(`Réinitialisation échouée (${res.status})`);
  return res.json();
}
