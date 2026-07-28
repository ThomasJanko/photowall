import express from "express";
import http from "http";
import path from "path";
import { config as loadEnv } from "dotenv";
import multer from "multer";
import { Server as SocketIOServer } from "socket.io";
import { setIo } from "./io";
import { UPLOAD_DIR } from "./upload";
import photosRouter, { leaderboardRouter } from "./routes/photos";
import challengesRouter from "./routes/challenges";
import adminRouter from "./routes/admin";
import messagesRouter from "./routes/messages";
import configRouter from "./routes/config";
import announcementsRouter from "./routes/announcements";
import pollsRouter from "./routes/polls";
import timelineRouter from "./routes/timeline";
import planningRouter from "./routes/planning";
import screenRouter from "./routes/screen";

loadEnv({ path: path.join(__dirname, "..", ".env.local") });
loadEnv({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.SERVER_PORT ?? 4000);

const app = express();
const server = http.createServer(app);

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Admin-Token"
  );
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(
  express.json({
    type: (req) =>
      (req.headers["content-type"] ?? "").includes("application/json"),
  })
);

const io = new SocketIOServer(server, {
  cors: { origin: "*" },
});
setIo(io);

app.use("/uploads", express.static(UPLOAD_DIR));

/** Healthcheck Docker / reverse-proxy (ne pas utiliser / comme page web). */
app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "express" });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    ok: true,
    message:
      "API photo (Express). Le site est sur le port 3000 (Next.js), pas ici.",
  });
});

app.use("/api/photos", photosRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/challenges", challengesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/config", configRouter);
app.use("/api/announcement", announcementsRouter);
app.use("/api/polls", pollsRouter);
app.use("/api/timeline", timelineRouter);
app.use("/api/planning", planningRouter);
app.use("/api/screen", screenRouter);

io.on("connection", (socket) => {
  console.log(`[socket] client connecté: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[socket] client déconnecté: ${socket.id}`);
  });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Route introuvable" });
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "Fichier trop volumineux"
          : err.message;
      return res.status(400).json({ error: message });
    }

    if (err instanceof Error) {
      console.error("[error]", err.message);
      return res.status(400).json({ error: err.message });
    }

    console.error("[error] inconnue:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  }
);

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Serveur photo local démarré sur http://0.0.0.0:${PORT}`);
  console.log(`Photos stockées dans: ${UPLOAD_DIR}`);
});
