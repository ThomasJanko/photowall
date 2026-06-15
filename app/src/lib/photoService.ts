import type { Photo, ReactionEvent, AnnouncementEvent, CurrentAnnouncement, ChallengeVoteEvent, TimelineEra, TimelineEntry, TimelinePageSettings, AddTimelineEntryInput } from "./types";
import { LocalPhotoService } from "./localPhotoService";

/**
 * Interface du client API photos + temps réel (Express + Socket.io).
 * Les pages consomment cette interface via getPhotoService(), jamais le serveur directement
 * (sauf cas admin/upload multipart via adminFetch).
 */
export interface PhotoService {
  upload(
    blob: Blob,
    filename: string,
    challengeId?: string,
    authorPseudo?: string
  ): Promise<Photo>;

  listPhotos(): Promise<Photo[]>;
  onNewPhoto(callback: (photo: Photo) => void): () => void;
  onPhotoRemoved(callback: (photoId: string) => void): () => void;

  react(photoId: string, emoji: string): Promise<void>;
  unreact(photoId: string, emoji: string): Promise<void>;
  onReaction(callback: (event: ReactionEvent) => void): () => void;

  voteChallenge(
    photoId: string,
    vote: "success" | "fail",
    action: "add" | "remove"
  ): Promise<void>;
  onChallengeVote(callback: (event: ChallengeVoteEvent) => void): () => void;

  /** `true` = connecté, `false` = déconnecté ou reconnexion en cours. */
  onConnectionChange(callback: (connected: boolean) => void): () => void;
  onAnnouncement(callback: (event: AnnouncementEvent) => void): () => void;

  /** Annonce encore active côté serveur (rejoin /wall en retard). */
  getCurrentAnnouncement(): Promise<CurrentAnnouncement | null>;

  hidePhoto(id: string): Promise<void>;
  hidePhotos(ids: string[]): Promise<void>;
  exportPhotos(ids: string[]): Promise<Blob>;

  listPendingPhotos(): Promise<Photo[]>;
  approvePhoto(id: string): Promise<Photo>;
  onPendingPhoto(callback: (photo: Photo) => void): () => void;
  onNewPrivateMessage(callback: () => void): () => void;

  listTimelineEras(): Promise<TimelineEra[]>;
  listTimelinePageSettings(): Promise<TimelinePageSettings>;
  listTimelineEntries(): Promise<TimelineEntry[]>;
  addTimelineEntry(data: AddTimelineEntryInput): Promise<TimelineEntry>;
  onNewTimelineEntry(callback: (entry: TimelineEntry) => void): () => void;
  onTimelineErasUpdated(callback: (eras: TimelineEra[]) => void): () => void;
  onTimelinePageUpdated(callback: (page: TimelinePageSettings) => void): () => void;
  saveTimelineEras(
    eras: TimelineEra[],
    page?: TimelinePageSettings
  ): Promise<TimelineEra[]>;
  removeTimelineEntry(id: string): Promise<void>;
  listPendingTimelineEntries(): Promise<TimelineEntry[]>;
  approveTimelineEntry(id: string): Promise<TimelineEntry>;
  onPendingTimelineEntry(callback: (entry: TimelineEntry) => void): () => void;
}

let instance: PhotoService | null = null;

/** Instance unique du client API local (JSON + Socket.io). */
export function getPhotoService(): PhotoService {
  if (!instance) {
    instance = new LocalPhotoService();
  }
  return instance;
}
