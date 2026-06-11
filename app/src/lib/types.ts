/** Emojis de réaction autorisés (doit rester aligné avec server/db.ts). */
export const REACTION_EMOJIS = ["❤️", "🔥", "😂", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

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
