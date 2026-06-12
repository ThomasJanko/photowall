import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { config as loadEnv } from "dotenv";
import multer from "multer";
import { ZipArchive } from "archiver";
import { Server as SocketIOServer } from "socket.io";
import {
  insertPhoto,
  listVisiblePhotos,
  hidePhoto,
  getPhoto,
  addReaction,
  type PhotoRow,
} from "./db";
import {
  getConfig,
  updateConfig,
  resetConfig,
  getReactionEmojis,
} from "./configDb";
import {
  insertPrivateMessage,
  listPrivateMessages,
  getPrivateMessageByFilename,
  deletePrivateMessage,
  type PrivateMessageRow,
} from "./messagesDb";
import {
  createAdminToken,
  verifyAdminToken,
  getAdminCode,
  extractBearerToken,
} from "../src/lib/adminToken";

// Charge .env.local / .env en dev local (tsx ne le fait pas automatiquement)
loadEnv({ path: path.join(__dirname, "..", ".env.local") });
loadEnv({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.SERVER_PORT ?? 4000);
const UPLOAD_DIR = path.join(__dirname, "..", "data", "uploads");
const PRIVATE_UPLOAD_DIR = path.join(__dirname, "..", "data", "private-uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(PRIVATE_UPLOAD_DIR)) {
  fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });
}

const app = express();
const server = http.createServer(app);

// CORS ouvert : on est sur un réseau local fermé, pas besoin de restreindre.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Admin-Token"
  );
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Parse les body JSON (utilisé par la route de réaction)
app.use(express.json());

const io = new SocketIOServer(server, {
  cors: { origin: "*" },
});

// Sert les photos uploadées
app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max (sécurité, la compression côté client vise ~300KB)
});

const privateStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRIVATE_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const id = crypto.randomUUID();
    const ext =
      path.extname(file.originalname) ||
      (file.mimetype.startsWith("video/") ? ".mp4" : ".jpg");
    cb(null, `${id}${ext}`);
  },
});

const privateUpload = multer({
  storage: privateStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé"));
    }
  },
});

function toPublicPhoto(row: {
  id: string;
  filename: string;
  created_at: number;
  reactions: Record<string, number>;
}) {
  return {
    id: row.id,
    url: `/uploads/${row.filename}`,
    createdAt: row.created_at,
    reactions: row.reactions,
  };
}

// Liste des photos visibles
app.get("/api/photos", (_req, res) => {
  const photos = listVisiblePhotos().map(toPublicPhoto);
  res.json(photos);
});

// Upload d'une nouvelle photo
app.post("/api/photos", upload.single("photo"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Aucun fichier reçu" });
  }

  const id = path.parse(req.file.filename).name;
  const createdAt = Date.now();

  insertPhoto(id, req.file.filename, createdAt);

  const photo = toPublicPhoto({
    id,
    filename: req.file.filename,
    created_at: createdAt,
    reactions: Object.fromEntries(getReactionEmojis().map((e) => [e, 0])),
  });

  io.emit("photo:new", photo);

  res.status(201).json(photo);
});

// Réagir (ou retirer sa réaction) à une photo avec un emoji
app.post("/api/photos/:id/react", (req, res) => {
  const { id } = req.params;
  const emoji: unknown = req.body?.emoji;
  const action: "add" | "remove" =
    req.body?.action === "remove" ? "remove" : "add";

  if (
    typeof emoji !== "string" ||
    !(getReactionEmojis() as readonly string[]).includes(emoji)
  ) {
    return res.status(400).json({ error: "Emoji non autorisé" });
  }

  const existing = getPhoto(id);
  if (!existing || existing.hidden) {
    return res.status(404).json({ error: "Photo introuvable" });
  }

  const updated = addReaction(id, emoji, action === "remove" ? -1 : 1)!;

  io.emit("photo:reaction", {
    photoId: id,
    emoji,
    reactions: updated.reactions,
    action,
  });

  res.json(toPublicPhoto(updated));
});

function toPublicPrivateMessage(row: PrivateMessageRow) {
  return {
    id: row.id,
    text: row.text,
    mediaFilename: row.mediaFilename,
    mediaType: row.mediaType,
    createdAt: row.created_at,
  };
}

/** Middleware : routes admin protégées par token dérivé de ADMIN_CODE. */
function requireAdmin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const adminCode = getAdminCode();
  if (!adminCode) {
    return res.status(503).json({ error: "Admin non configuré" });
  }

  const token = extractBearerToken(
    req.headers.authorization,
    req.headers["x-admin-token"]
  );

  if (!verifyAdminToken(token ?? "", adminCode)) {
    return res.status(401).json({ error: "Non autorisé" });
  }

  next();
}

// Connexion admin (mode local)
app.post("/api/admin/login", (req, res) => {
  const adminCode = getAdminCode();
  if (!adminCode) {
    return res.status(503).json({ error: "Admin non configuré" });
  }

  const code: unknown = req.body?.code;
  if (typeof code !== "string" || code !== adminCode) {
    return res.status(401).json({ error: "Code incorrect" });
  }

  res.json({ token: createAdminToken(adminCode) });
});

app.get("/api/admin/verify", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

// Export ZIP de photos (admin). ids vide → toutes les photos visibles.
app.post("/api/photos/export", requireAdmin, (req, res) => {
  const ids: unknown = req.body?.ids;
  let rows: PhotoRow[];

  if (!Array.isArray(ids) || ids.length === 0) {
    rows = listVisiblePhotos();
  } else {
    rows = ids
      .filter((id): id is string => typeof id === "string")
      .map((id) => getPhoto(id))
      .filter((row): row is PhotoRow => row !== undefined && row.hidden === 0);
  }

  if (rows.length === 0) {
    return res.status(404).json({ error: "Aucune photo à exporter" });
  }

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="photos.zip"'
  );

  const archive = new ZipArchive({ zlib: { level: 5 } });
  archive.on("error", (err: Error) => {
    console.error("[export]", err);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  for (const row of rows) {
    const filePath = path.join(UPLOAD_DIR, row.filename);
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: row.filename });
    }
  }

  void archive.finalize();
});

// Masquer plusieurs photos (admin)
app.delete("/api/photos/bulk", requireAdmin, (req, res) => {
  const ids: unknown = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Liste d'IDs requise" });
  }

  let removed = 0;
  for (const id of ids) {
    if (typeof id !== "string") continue;
    const existing = getPhoto(id);
    if (!existing || existing.hidden) continue;
    hidePhoto(id);
    io.emit("photo:removed", id);
    removed++;
  }

  res.json({ removed });
});

// Masquer une photo (admin)
app.delete("/api/photos/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const existing = getPhoto(id);

  if (!existing) {
    return res.status(404).json({ error: "Photo introuvable" });
  }

  hidePhoto(id);
  io.emit("photo:removed", id);

  res.status(204).send();
});

// --- Messages privés (séparés du mur public) ---

// Envoi invité (public)
app.post("/api/messages", (req, res) => {
  privateUpload.single("media")(req, res, (err) => {
    if (err) {
      return res
        .status(400)
        .json({ error: err.message || "Fichier invalide" });
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
      if (!req.file.mimetype.startsWith("image/") &&
          !req.file.mimetype.startsWith("video/")) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: "Type de média non autorisé" });
      }
      mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";
      mediaFilename = req.file.filename;
    }

    const row = insertPrivateMessage(text, mediaFilename, mediaType);
    res.status(201).json({ ok: true, id: row.id });
  });
});

// Liste admin
app.get("/api/messages", requireAdmin, (_req, res) => {
  res.json(listPrivateMessages().map(toPublicPrivateMessage));
});

// Média privé — token admin obligatoire (pas de static public)
app.get("/api/messages/media/:filename", requireAdmin, (req, res) => {
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

// Suppression admin
app.delete("/api/messages/:id", requireAdmin, (req, res) => {
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

// --- Config événement ---

app.get("/api/config", (_req, res) => {
  res.json(getConfig());
});

app.put("/api/config", requireAdmin, (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Corps JSON invalide" });
  }

  // Réinitialisation explicite aux défauts du code
  if (body.reset === true) {
    return res.json(resetConfig());
  }

  try {
    const { reset: _reset, ...partial } = body as Record<string, unknown>;
    const saved = updateConfig(partial as Parameters<typeof updateConfig>[0]);
    res.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Config invalide";
    res.status(400).json({ error: message });
  }
});

// --- Annonces live sur /wall (éphémères, pas de stockage) ---

const DEFAULT_ANNOUNCEMENT_MS = 20000;

app.post("/api/announcement", requireAdmin, (req, res) => {
  const rawText = req.body?.text;
  if (typeof rawText !== "string" || !rawText.trim()) {
    return res.status(400).json({ error: "Texte requis" });
  }

  const emoji =
    typeof req.body?.emoji === "string" && req.body.emoji.trim()
      ? req.body.emoji.trim().slice(0, 8)
      : undefined;

  let durationMs = DEFAULT_ANNOUNCEMENT_MS;
  if (typeof req.body?.durationMs === "number" && req.body.durationMs > 0) {
    durationMs = Math.min(Math.round(req.body.durationMs), 30_000);
  }

  const payload = {
    text: rawText.trim().slice(0, 200),
    emoji,
    durationMs,
  };

  io.emit("announcement:new", payload);
  res.json({ ok: true, ...payload });
});

io.on("connection", (socket) => {
  console.log(`[socket] client connecté: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[socket] client déconnecté: ${socket.id}`);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur photo local démarré sur http://0.0.0.0:${PORT}`);
  console.log(`Photos stockées dans: ${UPLOAD_DIR}`);
});
