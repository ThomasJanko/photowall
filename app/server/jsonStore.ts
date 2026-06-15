import path from "path";
import fs from "fs";

/** Dossier de persistance JSON partagé par tous les stores serveur. */
export const DATA_DIR = path.join(__dirname, "..", "data");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Store JSON synchrone générique (lecture/écriture fichier).
 * Fallback sur `defaultValue` si fichier absent, vide ou JSON invalide.
 */
export function createJsonStore<T>(filename: string, defaultValue: T) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);

  return {
    filePath,

    exists(): boolean {
      return fs.existsSync(filePath);
    },

    read(): T {
      if (!fs.existsSync(filePath)) return defaultValue;
      try {
        const raw = fs.readFileSync(filePath, "utf-8");
        return raw.trim() ? (JSON.parse(raw) as T) : defaultValue;
      } catch {
        return defaultValue;
      }
    },

    write(data: T): void {
      ensureDataDir();
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    },
  };
}
