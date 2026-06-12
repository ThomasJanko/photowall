import { adminFetch, AdminUnauthorizedError } from "./adminAuth";
import type { PrivateMessage } from "./types/privateMessage";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

const MESSAGES_LAST_SEEN_KEY = "admin:messages-last-seen";

/** Horodatage de la dernière consultation de l'onglet messages (admin). */
export function getMessagesLastSeen(): number {
  if (typeof window === "undefined") return 0;
  const v = localStorage.getItem(MESSAGES_LAST_SEEN_KEY);
  return v ? Number(v) || 0 : 0;
}

export function markMessagesSeen(): void {
  localStorage.setItem(MESSAGES_LAST_SEEN_KEY, String(Date.now()));
}

export function isPrivateMessagesLocal(): boolean {
  return (process.env.NEXT_PUBLIC_BACKEND ?? "local") === "local";
}

/**
 * Mode Supabase (à compléter avant usage en production) :
 * - Table `private_messages` (id, text, media_url, media_type, created_at)
 * - Bucket Storage privé (PAS public, contrairement à "photos")
 * - RLS : INSERT anon pour invités, SELECT/DELETE réservés au service role
 * - Médias servis via createSignedUrl() uniquement côté admin authentifié
 * - Ne jamais exposer ces fichiers dans le bucket public ni GET /api/photos
 */

/** Envoi invité (route publique, pas de token). */
export async function submitPrivateMessage(
  text: string,
  media: Blob | null,
  filename?: string
): Promise<void> {
  if (!isPrivateMessagesLocal()) {
    throw new Error(
      "Messages privés disponibles en mode local uniquement pour le moment"
    );
  }

  const form = new FormData();
  form.append("text", text);
  if (media) {
    form.append("media", media, filename ?? "media");
  }

  const res = await fetch(`${SERVER_URL}/api/messages`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Envoi échoué (${res.status})`);
  }
}

/** Liste admin (protégée). */
export async function listPrivateMessages(): Promise<PrivateMessage[]> {
  if (!isPrivateMessagesLocal()) return [];

  const res = await adminFetch(`${SERVER_URL}/api/messages`);
  if (!res.ok) throw new Error(`Chargement échoué (${res.status})`);
  return res.json();
}

/** Suppression admin. */
export async function deletePrivateMessage(id: string): Promise<void> {
  const res = await adminFetch(`${SERVER_URL}/api/messages/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Suppression échouée (${res.status})`);
}

/** Télécharge un média privé avec le token admin (jamais d'URL publique). */
export async function fetchPrivateMessageMedia(
  filename: string
): Promise<Blob> {
  const res = await adminFetch(
    `${SERVER_URL}/api/messages/media/${encodeURIComponent(filename)}`
  );
  if (!res.ok) throw new Error(`Média introuvable (${res.status})`);
  return res.blob();
}

export { AdminUnauthorizedError };
