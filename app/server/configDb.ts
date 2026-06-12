import path from "path";
import fs from "fs";
import {
  eventConfig as defaultEventConfig,
  type EventConfig,
  type EventTheme,
  type FeatureFlags,
} from "../src/config/event";

/** Persistance JSON de la config événement (surcharge src/config/event.ts). */
const DATA_DIR = path.join(__dirname, "..", "data");
const CONFIG_FILE = path.join(DATA_DIR, "event-config.json");

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeConfigFile(config: EventConfig) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

/** Fusionne un partial avec une config de base (ne remplace pas les sous-objets entiers). */
function mergeConfig(
  partial: Partial<EventConfig>,
  base: EventConfig
): EventConfig {
  return {
    ...base,
    ...partial,
    theme: partial.theme ? { ...base.theme, ...partial.theme } : base.theme,
    features: partial.features
      ? { ...base.features, ...partial.features }
      : base.features,
    pollScreens: partial.pollScreens
      ? { ...base.pollScreens, ...partial.pollScreens }
      : base.pollScreens,
    reactionEmojis:
      partial.reactionEmojis && partial.reactionEmojis.length > 0
        ? partial.reactionEmojis
        : base.reactionEmojis,
    photoChallenges:
      partial.photoChallenges && partial.photoChallenges.length > 0
        ? partial.photoChallenges
        : base.photoChallenges,
  };
}

function validateHex(value: unknown, field: string): string | null {
  if (typeof value !== "string" || !HEX_RE.test(value)) {
    return `${field} doit être une couleur hex (#RRGGBB)`;
  }
  return null;
}

function validateTheme(theme: Partial<EventTheme>): string | null {
  for (const key of [
    "primary",
    "secondary",
    "accent",
    "gradientFrom",
    "gradientVia",
    "gradientTo",
  ] as const) {
    if (theme[key] !== undefined) {
      const err = validateHex(theme[key], `theme.${key}`);
      if (err) return err;
    }
  }
  return null;
}

/** Valide un partial avant écriture. Retourne un message d'erreur ou null. */
export function validatePartialConfig(
  partial: Partial<EventConfig>
): string | null {
  if (partial.eventName !== undefined && typeof partial.eventName !== "string") {
    return "eventName invalide";
  }
  if (
    partial.welcomeMessage !== undefined &&
    typeof partial.welcomeMessage !== "string"
  ) {
    return "welcomeMessage invalide";
  }
  if (
    partial.celebrationText !== undefined &&
    typeof partial.celebrationText !== "string"
  ) {
    return "celebrationText invalide";
  }
  if (
    partial.spotlightDurationMs !== undefined &&
    (typeof partial.spotlightDurationMs !== "number" ||
      partial.spotlightDurationMs <= 0)
  ) {
    return "spotlightDurationMs doit être un nombre positif";
  }
  if (
    partial.reactionCooldownMs !== undefined &&
    (typeof partial.reactionCooldownMs !== "number" ||
      partial.reactionCooldownMs <= 0)
  ) {
    return "reactionCooldownMs doit être un nombre positif";
  }
  if (
    partial.pollResultsDurationMs !== undefined &&
    (typeof partial.pollResultsDurationMs !== "number" ||
      partial.pollResultsDurationMs <= 0)
  ) {
    return "pollResultsDurationMs doit être un nombre positif";
  }
  if (partial.reactionEmojis !== undefined) {
    if (
      !Array.isArray(partial.reactionEmojis) ||
      partial.reactionEmojis.length === 0 ||
      !partial.reactionEmojis.every((e) => typeof e === "string" && e.length > 0)
    ) {
      return "reactionEmojis doit être un tableau de strings non vide";
    }
  }
  if (partial.theme) {
    const err = validateTheme(partial.theme);
    if (err) return err;
  }
  if (partial.features) {
    for (const [key, val] of Object.entries(partial.features)) {
      if (typeof val !== "boolean") {
        return `features.${key} doit être un booléen`;
      }
    }
  }
  if (partial.pollScreens) {
    for (const [key, val] of Object.entries(partial.pollScreens)) {
      if (typeof val !== "boolean") {
        return `pollScreens.${key} doit être un booléen`;
      }
    }
  }
  return null;
}

/**
 * Config effective. Au premier lancement, crée data/event-config.json
 * avec les défauts de src/config/event.ts.
 */
export function getConfig(): EventConfig {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    writeConfigFile(defaultEventConfig);
    return { ...defaultEventConfig };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    const stored = raw.trim()
      ? (JSON.parse(raw) as Partial<EventConfig>)
      : {};
    return mergeConfig(stored, defaultEventConfig);
  } catch {
    return { ...defaultEventConfig };
  }
}

/** Met à jour la config (merge) après validation. */
export function updateConfig(partial: Partial<EventConfig>): EventConfig {
  const err = validatePartialConfig(partial);
  if (err) throw new Error(err);

  const merged = mergeConfig(partial, getConfig());
  const mergedErr = validatePartialConfig(merged);
  if (mergedErr) throw new Error(mergedErr);

  writeConfigFile(merged);
  return merged;
}

/** Réinitialise aux valeurs par défaut du code. */
export function resetConfig(): EventConfig {
  writeConfigFile(defaultEventConfig);
  return { ...defaultEventConfig };
}

/**
 * Emojis autorisés pour les réactions (lu depuis la config dynamique).
 * Note : modifier les emojis en cours de soirée ne migre pas les compteurs
 * déjà stockés sur les photos (clés différentes dans reactions) — acceptable.
 */
export function getReactionEmojis(): readonly string[] {
  return getConfig().reactionEmojis;
}
