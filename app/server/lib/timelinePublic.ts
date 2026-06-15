import {
  listTimelineEras,
  type TimelineEraRow,
  type TimelineEntryRow,
  type TimelinePageSettings,
} from "../timelineDb";
import { filenameFromUploadUrl } from "./parsers";

export function toPublicTimelineEra(row: TimelineEraRow) {
  return {
    id: row.id,
    label: row.label,
    period: row.period,
    order: row.order,
    ...(row.description ? { description: row.description } : {}),
    ...(row.photo_filename
      ? { photoUrl: `/uploads/${row.photo_filename}` }
      : {}),
    ...(row.color ? { color: row.color } : {}),
  };
}

export function toPublicTimelineEntry(row: TimelineEntryRow) {
  return {
    id: row.id,
    eraId: row.era_id,
    author: row.author,
    text: row.text,
    createdAt: row.created_at,
    approved: row.approved,
    ...(row.photo_filename
      ? { photoUrl: `/uploads/${row.photo_filename}` }
      : {}),
  };
}

export function eraRowFromPublic(
  era: {
    id: string;
    label: string;
    period: string;
    order: number;
    description?: string;
    photoUrl?: string;
    color?: string;
  },
  existing?: TimelineEraRow
): TimelineEraRow {
  const photo_filename =
    filenameFromUploadUrl(era.photoUrl) ?? existing?.photo_filename;
  return {
    id: era.id,
    label: era.label.trim().slice(0, 80),
    period: era.period.trim().slice(0, 40),
    order: era.order,
    ...(era.description?.trim()
      ? { description: era.description.trim().slice(0, 2000) }
      : {}),
    ...(photo_filename ? { photo_filename } : {}),
    ...(era.color?.match(/^#[0-9a-fA-F]{6}$/) ? { color: era.color } : {}),
  };
}

export function parseTimelinePageSettings(
  raw: unknown
): TimelinePageSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as {
    title?: unknown;
    subtitle?: unknown;
    emoji?: unknown;
  };
  if (typeof item.title !== "string" || !item.title.trim()) return null;
  if (typeof item.subtitle !== "string" || !item.subtitle.trim()) return null;
  if (typeof item.emoji !== "string" || !item.emoji.trim()) return null;
  return {
    title: item.title.trim().slice(0, 120),
    subtitle: item.subtitle.trim().slice(0, 300),
    emoji: item.emoji.trim().slice(0, 8),
  };
}

export function parseEraId(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!id) return null;
  return listTimelineEras().some((e) => e.id === id) ? id : null;
}
