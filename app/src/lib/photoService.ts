import type { Photo } from "./types";

/**
 * Interface commune aux deux backends (local et online).
 * Le reste de l'app (pages, composants) ne dépend QUE de cette interface :
 * changer de backend = changer l'implémentation retournée par getPhotoService(),
 * rien d'autre ne bouge.
 */
export interface PhotoService {
  /** Upload une image (déjà compressée côté client) et retourne la photo créée. */
  upload(blob: Blob, filename: string): Promise<Photo>;

  /** Liste les photos visibles (non masquées), triées par date croissante. */
  listPhotos(): Promise<Photo[]>;

  /** S'abonne aux nouvelles photos. Retourne une fonction de désabonnement. */
  onNewPhoto(callback: (photo: Photo) => void): () => void;

  /** S'abonne aux suppressions/masquages (pour la page /wall). */
  onPhotoRemoved(callback: (photoId: string) => void): () => void;

  /** Masque une photo (admin). */
  hidePhoto(id: string): Promise<void>;
}

let instance: PhotoService | null = null;

/**
 * Renvoie l'implémentation configurée via NEXT_PUBLIC_BACKEND.
 * - "local"    -> serveur Express + Socket.io (réseau local, sans internet)
 * - "supabase" -> Supabase Storage + Realtime (en ligne)
 */
export function getPhotoService(): PhotoService {
  if (instance) return instance;

  const backend = process.env.NEXT_PUBLIC_BACKEND ?? "local";

  if (backend === "supabase") {
    // Import paresseux : évite de charger @supabase/supabase-js si on est en mode local
    const { SupabasePhotoService } = require("./supabasePhotoService");
    instance = new SupabasePhotoService();
  } else {
    const { LocalPhotoService } = require("./localPhotoService");
    instance = new LocalPhotoService();
  }

  return instance!;
}
