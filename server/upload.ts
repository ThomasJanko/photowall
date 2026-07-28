import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";

export const UPLOAD_DIR = path.join(__dirname, "..", "data", "uploads");
export const PRIVATE_UPLOAD_DIR = path.join(
  __dirname,
  "..",
  "data",
  "private-uploads"
);

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(PRIVATE_UPLOAD_DIR)) {
  fs.mkdirSync(PRIVATE_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const id = crypto.randomUUID();
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${id}${ext}`);
  },
});

/** Photos du mur public : uniquement des images (pas de vidéo/PDF/etc.). */
export const ALLOWED_PHOTO_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_PHOTO_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé (image uniquement)"));
    }
  },
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

export const privateUpload = multer({
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
