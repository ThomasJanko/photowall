import { Router } from "express";
import {
  listTimelineEras,
  saveTimelineEras,
  listApprovedTimelineEntries,
  listPendingTimelineEntries,
  insertTimelineEntry,
  approveTimelineEntry,
  deleteTimelineEntry,
  getTimelinePageSettings,
  saveTimelinePageSettings,
  type TimelineEraRow,
} from "../timelineDb";
import { getConfig } from "../configDb";
import { getIo } from "../io";
import { upload } from "../upload";
import { requireAdmin } from "../middleware/requireAdmin";
import { parseAuthorPseudo, parseTimelineText } from "../lib/parsers";
import {
  toPublicTimelineEra,
  toPublicTimelineEntry,
  eraRowFromPublic,
  parseTimelinePageSettings,
  parseEraId,
} from "../lib/timelinePublic";

const router = Router();

router.get("/eras", (_req, res) => {
  res.json(listTimelineEras().map(toPublicTimelineEra));
});

router.get("/page", (_req, res) => {
  res.json(getTimelinePageSettings());
});

router.get("/entries", (_req, res) => {
  res.json(listApprovedTimelineEntries().map(toPublicTimelineEntry));
});

router.post("/entries", upload.single("photo"), (req, res) => {
  const text = parseTimelineText(req.body?.text);
  const author = parseAuthorPseudo(req.body?.author);
  if (!text)
    return res.status(400).json({ error: "Texte requis (2–500 car.)" });
  if (!author) return res.status(400).json({ error: "Pseudo requis" });

  const eraId = parseEraId(req.body?.eraId);
  const moderationRequired = getConfig().features.moderationRequired === true;
  const photo_filename = req.file?.filename;

  const row = insertTimelineEntry({
    era_id: eraId,
    author,
    text,
    approved: !moderationRequired,
    ...(photo_filename ? { photo_filename } : {}),
  });

  const entry = toPublicTimelineEntry(row);
  if (row.approved) {
    getIo().emit("timeline:new", entry);
  } else {
    getIo().emit("timeline:pending", entry);
  }
  res.status(201).json(entry);
});

router.get("/entries/pending", requireAdmin, (_req, res) => {
  res.json(listPendingTimelineEntries().map(toPublicTimelineEntry));
});

router.post("/entries/:id/approve", requireAdmin, (req, res) => {
  const row = approveTimelineEntry(req.params.id);
  if (!row) return res.status(404).json({ error: "Entrée introuvable" });
  const entry = toPublicTimelineEntry(row);
  getIo().emit("timeline:new", entry);
  res.json(entry);
});

router.delete("/entries/:id", requireAdmin, (req, res) => {
  if (!deleteTimelineEntry(req.params.id)) {
    return res.status(404).json({ error: "Entrée introuvable" });
  }
  getIo().emit("timeline:removed", { id: req.params.id });
  res.sendStatus(204);
});

router.put("/eras", requireAdmin, (req, res) => {
  const raw: unknown = req.body?.eras;
  if (!Array.isArray(raw)) {
    return res.status(400).json({ error: "eras[] requis" });
  }

  const existing = new Map(listTimelineEras().map((e) => [e.id, e]));
  const eras: TimelineEraRow[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as { id?: unknown }).id !== "string" ||
      typeof (item as { label?: unknown }).label !== "string" ||
      typeof (item as { period?: unknown }).period !== "string"
    ) {
      return res.status(400).json({ error: `Ère invalide à l'index ${i}` });
    }
    const pub = item as {
      id: string;
      label: string;
      period: string;
      order: number;
      description?: string;
      photoUrl?: string;
      color?: string;
    };
    eras.push(
      eraRowFromPublic(
        { ...pub, order: typeof pub.order === "number" ? pub.order : i },
        existing.get(pub.id)
      )
    );
  }

  const saved = saveTimelineEras(eras).map(toPublicTimelineEra);
  let page = getTimelinePageSettings();
  const parsedPage = parseTimelinePageSettings(req.body?.page);
  if (parsedPage) {
    page = saveTimelinePageSettings(parsedPage);
    getIo().emit("timeline:page", page);
  }
  getIo().emit("timeline:eras", saved);
  res.json({ eras: saved, page });
});

router.post("/eras/photo", requireAdmin, upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu" });
  }
  res.status(201).json({ photoUrl: `/uploads/${req.file.filename}` });
});

export default router;
