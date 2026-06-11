import { compressImage } from "./compressImage";

export const MAX_PRIVATE_TEXT = 500;
export const MAX_VIDEO_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_DURATION_SEC = 30;

export interface ValidatedPrivateMedia {
  type: "image" | "video";
  blob: Blob;
  filename: string;
}

/** Lit la durée d'une vidéo via un élément <video> temporaire. */
function getVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const url = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de lire la vidéo"));
    };
    video.src = url;
  });
}

/**
 * Valide et prépare un média privé (photo compressée ou vidéo courte).
 * Lance une Error avec message clair si hors limites.
 */
export async function validatePrivateMedia(
  file: File
): Promise<ValidatedPrivateMedia> {
  if (file.type.startsWith("image/")) {
    const blob = await compressImage(file, { maxDimension: 1600, quality: 0.75 });
    return {
      type: "image",
      blob,
      filename: `message-${Date.now()}.jpg`,
    };
  }

  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      throw new Error("Vidéo trop lourde (maximum 20 Mo)");
    }
    const duration = await getVideoDurationSec(file);
    if (duration > MAX_VIDEO_DURATION_SEC) {
      throw new Error(
        `Vidéo trop longue (maximum ${MAX_VIDEO_DURATION_SEC} secondes)`
      );
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    return {
      type: "video",
      blob: file,
      filename: `message-${Date.now()}.${ext}`,
    };
  }

  throw new Error("Format non supporté — photo ou vidéo uniquement");
}
