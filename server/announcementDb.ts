import { createJsonStore } from "./jsonStore";

export interface AnnouncementRow {
  text: string;
  emoji?: string;
  durationMs: number;
  startedAt: number;
}

const announcementStore = createJsonStore<AnnouncementRow | null>(
  "announcement.json",
  null
);

/** Enregistre une nouvelle annonce (remplace la précédente). */
export function saveCurrentAnnouncement(
  data: Omit<AnnouncementRow, "startedAt">
): AnnouncementRow {
  const row: AnnouncementRow = {
    ...data,
    startedAt: Date.now(),
  };
  announcementStore.write(row);
  return row;
}

/** Annonce encore active, ou null si expirée / absente. */
export function getCurrentAnnouncement(): AnnouncementRow | null {
  const row = announcementStore.read();
  if (!row) return null;

  const elapsed = Date.now() - row.startedAt;
  if (elapsed >= row.durationMs) {
    announcementStore.write(null);
    return null;
  }

  return row;
}
