import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { Server as SocketIOServer } from "socket.io";
import {
  insertPhoto,
  listVisiblePhotos,
  hidePhoto,
  getPhoto,
} from "./db";

const PORT = Number(process.env.SERVER_PORT ?? 4000);
const UPLOAD_DIR = path.join(__dirname, "..", "data", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
const server = http.createServer(app);

// CORS ouvert : on est sur un réseau local fermé, pas besoin de restreindre.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

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

function toPublicPhoto(row: { id: string; filename: string; created_at: number }) {
  return {
    id: row.id,
    url: `/uploads/${row.filename}`,
    createdAt: row.created_at,
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
  });

  io.emit("photo:new", photo);

  res.status(201).json(photo);
});

// Masquer une photo (admin)
app.delete("/api/photos/:id", (req, res) => {
  const { id } = req.params;
  const existing = getPhoto(id);

  if (!existing) {
    return res.status(404).json({ error: "Photo introuvable" });
  }

  hidePhoto(id);
  io.emit("photo:removed", id);

  res.status(204).send();
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
