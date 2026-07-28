/**
 * Configuration centralisée de l'événement.
 * Modifier ce fichier pour adapter l'app à un autre anniversaire, mariage, etc.
 *
 * ⚠️ reactionEmojis : valeurs par défaut au 1er lancement ; ensuite lues depuis
 * data/event-config.json via server/configDb.ts (getReactionEmojis).
 */

/** Source de vérité des emojis de réaction (front + serveur). */
export const DEFAULT_REACTION_EMOJIS = ["❤️", "🔥", "😂", "🎉"] as const;

export interface FeatureFlags {
  reactions: boolean;
  confetti: boolean;
  spotlight: boolean;
  countdown: boolean;
  retrospective: boolean;
  privateMessages: boolean;
  qrPage: boolean;
  timeBasedTheme: boolean;
  adminBulkActions: boolean;
  /** Si true, les uploads passent par /admin avant d'apparaître sur /wall. */
  moderationRequired: boolean;
  /** Active la page /sondage + la pastille de notification live. */
  livePolls: boolean;
  /** Affiche la page classement des défis photo. */
  leaderboard: boolean;
  /** Frise chronologique interactive (/timeline). */
  timeline: boolean;
  /** Planning de la soirée (/planning). */
  planning: boolean;
}

/** Défi photo proposé aux invités sur /. */
export interface Challenge {
  id: string;
  label: string;
  emoji?: string;
}

export interface EventTheme {
  primary: string;
  secondary: string;
  accent: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
}

export interface EventConfig {
  eventName: string;
  welcomeMessage: string;
  countdownTarget?: string;
  celebrationText: string;
  reactionEmojis: readonly string[];
  spotlightDurationMs: number;
  reactionCooldownMs: number;
  theme: EventTheme;
  features: FeatureFlags;
  /** Durée d'affichage des résultats après clôture (ms). */
  pollResultsDurationMs: number;
  photoChallenges: readonly Challenge[];
}

/** Valeurs par défaut = comportement actuel (25 ans, violet/rose). */
export const eventConfig: EventConfig = {
  eventName: "🎉 Joyeux 25 ans ! 🎉",
  welcomeMessage:
    "En attente des premières photos... scanne le QR code pour participer 📱",
  countdownTarget: "2026-07-18T00:00:00",
  celebrationText: "🎉 Joyeux 25 ans 🎉",
  reactionEmojis: DEFAULT_REACTION_EMOJIS,
  spotlightDurationMs: 10_000,
  reactionCooldownMs: 1500,
  theme: {
    // Équivalent Tailwind : purple-950 / purple-900 / pink-900
    primary: "#3b0764",
    secondary: "#581c87",
    accent: "#f472b6",
    gradientFrom: "#3b0764",
    gradientVia: "#581c87",
    gradientTo: "#831843",
  },
  features: {
    reactions: true,
    confetti: true,
    spotlight: true,
    countdown: true,
    retrospective: true,
    privateMessages: true,
    qrPage: true,
    timeBasedTheme: true,
    adminBulkActions: true,
    moderationRequired: false,
    livePolls: true,
    leaderboard: true,
    timeline: false,
    planning: true,
  },
  pollResultsDurationMs: 60_000,
  photoChallenges: [
    {
      id: "stranger",
      emoji: "🤝",
      label: "Photo avec quelqu'un que tu ne connais pas",
    },
    {
      id: "jump",
      emoji: "🦘",
      label: "Saute en l'air sur la photo",
    },
    {
      id: "funny",
      emoji: "🤪",
      label: "Grimace la plus drôle",
    },
    {
      id: "group",
      emoji: "👯",
      label: "Photo de groupe (3 personnes minimum)",
    },
    {
      id: "toast",
      emoji: "🥂",
      label: "Trinquer avec la star de la soirée",
    },
  ],
};
