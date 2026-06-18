import { Router } from "express";
import {
  listPlanningEvents,
  insertPlanningEvent,
  updatePlanningEvent,
  deletePlanningEvent,
  savePlanningEvents,
  type PlanningEventRow,
} from "../planningDb";
import { getIo } from "../io";
import { upload } from "../upload";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

/** Convertit une row DB en objet public (remplace photo_filename par photoUrl). */
function toPublic(row: PlanningEventRow) {
  const { photo_filename, ...rest } = row;
  return {
    ...rest,
    photoUrl: photo_filename ? `/uploads/${photo_filename}` : undefined,
  };
}

// ── GET /api/planning ─────────────────────────────────────────────────────────
router.get("/", (_req, res) => {
  res.json(listPlanningEvents().map(toPublic));
});

// ── POST /api/planning (admin) ────────────────────────────────────────────────
router.post("/", requireAdmin, upload.single("photo"), (req, res) => {
  const { title, date, time, duration, description, emoji, color, location } =
    req.body as Record<string, string | undefined>;

  if (!title?.trim()) return res.status(400).json({ error: "Titre requis" });
  if (!date?.match(/^\d{4}-\d{2}-\d{2}$/))
    return res.status(400).json({ error: "Date invalide (YYYY-MM-DD)" });
  if (!time?.match(/^\d{2}:\d{2}$/))
    return res.status(400).json({ error: "Heure invalide (HH:MM)" });

  const events = listPlanningEvents();
  const order = events.length;

  const row = insertPlanningEvent({
    title: title.trim(),
    date,
    time,
    duration: duration?.trim() || undefined,
    description: description?.trim() || undefined,
    emoji: emoji?.trim() || undefined,
    color: color?.trim() || undefined,
    location: location?.trim() || undefined,
    photo_filename: req.file?.filename,
    order,
  });

  const pub = toPublic(row);
  getIo().emit("planning:new", pub);
  res.status(201).json(pub);
});

// ── PUT /api/planning/reorder (admin) — sauvegarde l'ordre complet ─────────────
router.put("/reorder", requireAdmin, (req, res) => {
  const raw: unknown = req.body?.events;
  if (!Array.isArray(raw)) return res.status(400).json({ error: "events[] requis" });

  const current = new Map(listPlanningEvents().map((e) => [e.id, e]));
  const merged: PlanningEventRow[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as { id?: unknown };
    if (typeof item?.id !== "string") {
      return res.status(400).json({ error: `Événement invalide index ${i}` });
    }
    const existing = current.get(item.id);
    if (!existing) continue;
    merged.push({ ...existing, order: i });
  }

  const saved = savePlanningEvents(merged).map(toPublic);
  getIo().emit("planning:list", saved);
  res.json(saved);
});

// ── PUT /api/planning/:id (admin) ─────────────────────────────────────────────
router.put("/:id", requireAdmin, upload.single("photo"), (req, res) => {
  const { title, date, time, duration, description, emoji, color, location } =
    req.body as Record<string, string | undefined>;

  const patch: Parameters<typeof updatePlanningEvent>[1] = {};
  if (title !== undefined) patch.title = title.trim();
  if (date !== undefined) patch.date = date;
  if (time !== undefined) patch.time = time;
  if (duration !== undefined) patch.duration = duration.trim() || undefined;
  if (description !== undefined)
    patch.description = description.trim() || undefined;
  if (emoji !== undefined) patch.emoji = emoji.trim() || undefined;
  if (color !== undefined) patch.color = color.trim() || undefined;
  if (location !== undefined) patch.location = location.trim() || undefined;
  if (req.file) patch.photo_filename = req.file.filename;

  const row = updatePlanningEvent(req.params.id, patch);
  if (!row) return res.status(404).json({ error: "Événement introuvable" });

  const pub = toPublic(row);
  getIo().emit("planning:updated", pub);
  res.json(pub);
});

// ── DELETE /api/planning/:id (admin) ──────────────────────────────────────────
router.delete("/:id", requireAdmin, (req, res) => {
  if (!deletePlanningEvent(req.params.id)) {
    return res.status(404).json({ error: "Événement introuvable" });
  }
  getIo().emit("planning:removed", { id: req.params.id });
  res.sendStatus(204);
});

export default router;
