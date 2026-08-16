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
  /** Horodatage serveur au moment de l'envoi (sync temps restant). */
  startedAt?: number;
}

/** Annonce active avec temps restant (GET /api/announcement/current). */
export interface CurrentAnnouncement extends AnnouncementEvent {
  startedAt: number;
  remainingMs: number;
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

/** En-tête configurable de la page /timeline. */
export interface TimelinePageSettings {
  title: string;
  subtitle: string;
  emoji: string;
}

export const DEFAULT_TIMELINE_PAGE_SETTINGS: TimelinePageSettings = {
  title: "Timeline",
  subtitle: "25 ans de souvenirs — et la soirée continue",
  emoji: "🕰️",
};

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

// ─── Planning ────────────────────────────────────────────────────────────────

/**
 * Événement du planning soirée, géré par l'admin et visible par les invités
 * sur /planning.
 */
export interface PlanningEvent {
  id: string;
  title: string;
  /** ISO date string "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  time: string;
  /** Durée indicative (ex: "30 min", "1h") — optionnel */
  duration?: string;
  description?: string;
  emoji?: string;
  color?: string;
  location?: string;
  photoUrl?: string;
  order: number;
  createdAt: number;
  /** Masqué aux invités jusqu'à révélation admin en temps réel */
  surprise?: boolean;
}

export interface PlanningEventInput {
  title: string;
  date: string;
  time: string;
  duration?: string;
  description?: string;
  emoji?: string;
  color?: string;
  location?: string;
  photoUrl?: string;
  surprise?: boolean;
}

// ─── Écran TV (télécommande admin) ───────────────────────────────────────────

export const SCREEN_PATHS = [
  "/wall",
  "/planning",
  "/timeline",
  "/countdown",
  "/classement",
  "/retrospective",
] as const;

export type ScreenPath = (typeof SCREEN_PATHS)[number];

export type ScreenCommand =
  | { type: "navigate"; path: ScreenPath }
  | {
      type: "scroll";
      direction: "up" | "down" | "top" | "bottom";
      amount?: number;
    }
  | { type: "volume"; value: number }
  | { type: "zoom"; level: number }
  | { type: "fullscreen" }
  | {
      type: "action";
      name:
        | "retrospective:start"
        | "confetti:burst"
        | "audio:play"
        | "audio:stop"
        | "audio:toggle";
    };

export interface ScreenState {
  path: ScreenPath;
  volume: number;
  zoom: number;
}

// ─── Chrono / minuteur (page /countdown) ─────────────────────────────────────

/**
 * "off"       → aucun chrono/minuteur actif, /countdown affiche le compte à
 *               rebours final vers la date de la soirée (comportement historique).
 * "stopwatch" → chrono qui compte le temps écoulé (ex: chronométrer un jeu).
 * "timer"     → minuteur qui décompte depuis `durationMs` (dernières
 *               secondes en rouge + son sur /countdown).
 */
export type TimerMode = "off" | "stopwatch" | "timer";

export interface TimerState {
  mode: TimerMode;
  running: boolean;
  /** Durée totale du minuteur (ms), utilisée uniquement en mode "timer". */
  durationMs: number;
  /** Horodatage serveur du début du segment de course courant (null si en pause/arrêté). */
  startedAt: number | null;
  /** Temps déjà écoulé (ms) avant le segment de course courant. */
  elapsedMs: number;
  /**
   * Date/heure cible du compte à rebours final (mode "off"), au format local
   * "YYYY-MM-DDTHH:mm:ss". Réglée en direct depuis l'onglet admin "Chrono".
   */
  finalTargetAt: string;
}

export type TimerCommand =
  | { type: "setMode"; mode: TimerMode }
  | { type: "setDuration"; durationMs: number }
  | { type: "start" }
  | { type: "pause" }
  | { type: "reset" }
  | { type: "setFinalTarget"; targetAt: string };
