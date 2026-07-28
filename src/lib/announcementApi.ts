import { adminFetch } from "./adminAuth";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/** Envoie une annonce éphémère sur /wall (admin). */
export async function sendAnnouncement(payload: {
  text: string;
  emoji?: string;
  durationMs?: number;
}): Promise<void> {
  const res = await adminFetch(`${SERVER_URL}/api/announcement`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Envoi échoué (${res.status})`);
  }
}
