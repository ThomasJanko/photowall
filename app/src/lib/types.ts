import { DEFAULT_REACTION_EMOJIS } from "@/config/event";

/** Réexport depuis la config événement (aligné avec server/db.ts). */
export const REACTION_EMOJIS = DEFAULT_REACTION_EMOJIS;
export type ReactionEmoji = (typeof DEFAULT_REACTION_EMOJIS)[number];

export interface Photo {
  id: string;
  url: string;
  createdAt: number;
  hidden?: boolean;
  reactions: Record<string, number>;
  challengeId?: string;
  authorPseudo?: string;
  challengeVotes?: { success: number; fail: number };
  /** Modération : "pending" jusqu'à validation admin (mode local). */
  status?: "pending" | "approved";
}

export interface ChallengeVoteEvent {
  photoId: string;
  challengeVotes: { success: number; fail: number };
  vote: "success" | "fail";
  action: "add" | "remove";
}

/** Payload émis par le serveur quand quelqu'un réagit (ou retire sa réaction). */
export interface ReactionEvent {
  photoId: string;
  emoji: string;
  reactions: Record<string, number>;
  action: "add" | "remove";
}

/** Annonce éphémère diffusée sur /wall (organisateur → invités). */
export interface AnnouncementEvent {
  text: string;
  emoji?: string;
  durationMs: number;
}

/** Bloc structurant de la frise chronologique (/timeline). */
export interface TimelineEra {
  id: string;
  label: string;
  period: string;
  order: number;
  description?: string;
  photoUrl?: string;
  color?: string;
}

/** Souvenir ajouté par un invité sur la frise. */
export interface TimelineEntry {
  id: string;
  eraId: string | null;
  author: string;
  text: string;
  photoUrl?: string;
  createdAt: number;
  approved?: boolean;
}

export interface AddTimelineEntryInput {
  text: string;
  author: string;
  eraId?: string | null;
  photo?: Blob;
}
