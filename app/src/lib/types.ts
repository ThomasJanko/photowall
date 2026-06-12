import { DEFAULT_REACTION_EMOJIS } from "@/config/event";

/** Réexport depuis la config événement (aligné avec server/db.ts). */
export const REACTION_EMOJIS = DEFAULT_REACTION_EMOJIS;
export type ReactionEmoji = (typeof DEFAULT_REACTION_EMOJIS)[number];

export interface Photo {
  id: string;
  url: string;
  createdAt: number;
  hidden?: boolean;
  /** Compteurs de réactions par emoji, ex: { "❤️": 3, "🔥": 1 } */
  reactions: Record<string, number>;
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
