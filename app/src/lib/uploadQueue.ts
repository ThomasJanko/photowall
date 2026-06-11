/**
 * File d'attente persistée (localStorage) pour les photos qui n'ont pas pu
 * être envoyées (coupure réseau). Permet de réessayer automatiquement
 * plus tard sans perdre la photo de l'invité.
 */

const STORAGE_KEY = "photo-upload-queue";

export interface QueueItem {
  id: string;
  dataUrl: string;
  filename: string;
  createdAt: number;
}

export function loadQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(items: QueueItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addToQueue(item: QueueItem) {
  const items = loadQueue();
  items.push(item);
  saveQueue(items);
}

export function removeFromQueue(id: string) {
  const items = loadQueue().filter((i) => i.id !== id);
  saveQueue(items);
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Génère un identifiant unique sans dépendre de crypto.randomUUID(),
 * qui exige un "secure context" (HTTPS) — indisponible sur
 * http://192.168.x.x (réseau local).
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
