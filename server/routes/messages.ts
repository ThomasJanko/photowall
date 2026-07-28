import path from "path";
import fs from "fs";
import { Router } from "express";
import {
  insertPrivateMessage,
  listPrivateMessages,
  getPrivateMessageByFilename,
  deletePrivateMessage,
  type PrivateMessageRow,
} from "../messagesDb";
import { getIo } from "../io";
import { privateUpload, PRIVATE_UPLOAD_DIR } from "../upload";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

function toPublicPrivateMessage(row: PrivateMessageRow) {
  return {
    id: row.id,
    text: row.text,
    mediaFilename: row.mediaFilename,
    mediaType: row.mediaType,
    createdAt: row.created_at,
  };
}

router.post("/", (req, res) => {
  privateUpload.single("media")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Fichier invalide" });
    }

    const rawText = req.body?.text;
    const text =
      typeof rawText === "string" ? rawText.trim().slice(0, 500) : "";

    if (!text && !req.file) {
      return res
        .status(400)
        .json({ error: "Écris un message ou ajoute un média" });
    }

    let mediaType: "image" | "video" | null = null;
    let mediaFilename: string | null = null;

    if (req.file) {
      if (
        !req.file.mimetype.startsWith("image/") &&
        !req.file.mimetype.startsWith("video/")
      ) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Type de média non autorisé" });
      }
      mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";
      mediaFilename = req.file.filename;
    }

    const row = insertPrivateMessage(text, mediaFilename, mediaType);
    getIo().emit("message:new", toPublicPrivateMessage(row));
    res.status(201).json({ ok: true, id: row.id });
  });
});

router.get("/", requireAdmin, (_req, res) => {
  res.json(listPrivateMessages().map(toPublicPrivateMessage));
});

router.get("/media/:filename", requireAdmin, (req, res) => {
  const filename = path.basename(req.params.filename);
  const message = getPrivateMessageByFilename(filename);
  if (!message?.mediaFilename) {
    return res.status(404).json({ error: "Média introuvable" });
  }

  const filePath = path.join(PRIVATE_UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Fichier introuvable" });
  }

  res.sendFile(filePath);
});

router.delete("/:id", requireAdmin, (req, res) => {
  const removed = deletePrivateMessage(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: "Message introuvable" });
  }

  if (removed.mediaFilename) {
    const filePath = path.join(
      PRIVATE_UPLOAD_DIR,
      path.basename(removed.mediaFilename)
    );
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  res.status(204).send();
});

export default router;
