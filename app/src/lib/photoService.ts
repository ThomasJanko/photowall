import type { Photo, ReactionEvent, AnnouncementEvent, ChallengeVoteEvent, TimelineEra, TimelineEntry, TimelinePageSettings, AddTimelineEntryInput } from "./types";

/**
 * Interface commune aux deux backends (local et online).
 * Le reste de l'app (pages, composants) ne dépend QUE de cette interface :
 * changer de backend = changer l'implémentation retournée par getPhotoService(),
 * rien d'autre ne bouge.
 */
export interface PhotoService {
  /** Upload une image (déjà compressée côté client) et retourne la photo créée. */
  upload(
    blob: Blob,
    filename: string,
    challengeId?: string,
    authorPseudo?: string
  ): Promise<Photo>;

  /** Liste les photos visibles (non masquées), triées par date croissante. */
  listPhotos(): Promise<Photo[]>;

  /** S'abonne aux nouvelles photos. Retourne une fonction de désabonnement. */
  onNewPhoto(callback: (photo: Photo) => void): () => void;

  /** S'abonne aux suppressions/masquages (pour la page /wall). */
  onPhotoRemoved(callback: (photoId: string) => void): () => void;

  /** Ajoute une réaction emoji à une photo. */
  react(photoId: string, emoji: string): Promise<void>;

  /** Retire une réaction emoji (toggle au 2e clic côté client). */
  unreact(photoId: string, emoji: string): Promise<void>;

  /** S'abonne aux réactions (pour les compteurs + animations du mur). */
  onReaction(callback: (event: ReactionEvent) => void): () => void;

  /** Vote réussi/échec sur une photo de défi. */
  voteChallenge?(
    photoId: string,
    vote: "success" | "fail",
    action: "add" | "remove"
  ): Promise<void>;

  /** S'abonne aux votes défi (compteurs /wall). */
  onChallengeVote?(callback: (event: ChallengeVoteEvent) => void): () => void;

  /**
   * S'abonne aux changements de connexion temps réel (optionnel).
   * `true` = connecté, `false` = déconnecté ou reconnexion en cours.
   */
  onConnectionChange?(callback: (connected: boolean) => void): () => void;

  /** Annonces live sur /wall (optionnel, mode local). */
  onAnnouncement?(callback: (event: AnnouncementEvent) => void): () => void;

  /** Masque une photo (admin). */
  hidePhoto(id: string): Promise<void>;

  /** Masque plusieurs photos (admin). */
  hidePhotos(ids: string[]): Promise<void>;

  /** Exporte des photos en ZIP. Liste vide = toutes les photos visibles. */
  exportPhotos(ids: string[]): Promise<Blob>;

  /** Photos en attente de validation (admin, mode local). */
  listPendingPhotos?(): Promise<Photo[]>;

  /** Approuve une photo en attente (admin, mode local). */
  approvePhoto?(id: string): Promise<Photo>;

  /** Nouvelle photo en attente (admin, mode local). */
  onPendingPhoto?(callback: (photo: Photo) => void): () => void;

  /** Nouveau message privé (admin, mode local). */
  onNewPrivateMessage?(callback: () => void): () => void;

  /** Frise chronologique (/timeline). */
  listTimelineEras?(): Promise<TimelineEra[]>;
  listTimelinePageSettings?(): Promise<TimelinePageSettings>;
  listTimelineEntries?(): Promise<TimelineEntry[]>;
  addTimelineEntry?(data: AddTimelineEntryInput): Promise<TimelineEntry>;
  onNewTimelineEntry?(callback: (entry: TimelineEntry) => void): () => void;
  onTimelineErasUpdated?(callback: (eras: TimelineEra[]) => void): () => void;
  onTimelinePageUpdated?(callback: (page: TimelinePageSettings) => void): () => void;
  saveTimelineEras?(
    eras: TimelineEra[],
    page?: TimelinePageSettings
  ): Promise<TimelineEra[]>;
  removeTimelineEntry?(id: string): Promise<void>;
  listPendingTimelineEntries?(): Promise<TimelineEntry[]>;
  approveTimelineEntry?(id: string): Promise<TimelineEntry>;
  onPendingTimelineEntry?(callback: (entry: TimelineEntry) => void): () => void;
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
