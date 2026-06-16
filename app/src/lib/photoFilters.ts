/** Filtre couleur style Snapchat (CSS `filter` + option vignette overlay). */
export type PhotoFilter = {
  id: string;
  label: string;
  /** Valeur CSS `filter` pour preview et canvas. Vide = normal. */
  css: string;
  /** Overlay radial-gradient (preview + canvas). */
  vignette?: boolean;
};

export const DEFAULT_PHOTO_FILTER_ID = "normal";

export const PHOTO_FILTERS: readonly PhotoFilter[] = [
  { id: "normal", label: "Normal", css: "" },
  { id: "bw", label: "N&B", css: "grayscale(1)" },
  { id: "sepia", label: "Sépia", css: "sepia(0.8) contrast(1.1)" },
  {
    id: "vintage",
    label: "Vintage",
    css: "sepia(0.4) contrast(1.1) saturate(1.3) hue-rotate(-10deg)",
  },
  { id: "contrast", label: "Contraste+", css: "contrast(1.35) saturate(1.1)" },
  {
    id: "cold",
    label: "Froid",
    css: "saturate(0.9) hue-rotate(15deg) brightness(1.05)",
  },
  {
    id: "warm",
    label: "Chaud",
    css: "sepia(0.25) saturate(1.2) hue-rotate(-15deg) brightness(1.05)",
  },
  {
    id: "vignette",
    label: "Vignette",
    css: "contrast(1.05) saturate(1.1)",
    vignette: true,
  },
] as const;

export function getPhotoFilter(id: string): PhotoFilter {
  return PHOTO_FILTERS.find((f) => f.id === id) ?? PHOTO_FILTERS[0];
}

export function isNormalPhotoFilter(id: string): boolean {
  return id === DEFAULT_PHOTO_FILTER_ID || getPhotoFilter(id).css === "";
}

/** Classes Tailwind pour l'overlay vignette (preview). */
export const VIGNETTE_OVERLAY_CLASS =
  "pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.55)_100%)]";

const UPLOAD_QUALITY = 0.75;

function drawVignetteOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const inner = Math.min(width, height) * 0.35;
  const outer = Math.max(width, height) * 0.72;
  const gradient = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Applique le filtre sur le blob (taille originale du blob) via canvas.
 * Retourne le blob d'origine si filtre normal ou en cas d'échec.
 */
export async function applyPhotoFilterToBlob(
  blob: Blob,
  filterId: string,
  quality = UPLOAD_QUALITY
): Promise<Blob> {
  if (isNormalPhotoFilter(filterId)) return blob;

  const filter = getPhotoFilter(filterId);

  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;

    ctx.filter = filter.css || "none";
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    if (filter.vignette) {
      ctx.filter = "none";
      drawVignetteOverlay(ctx, canvas.width, canvas.height);
    }

    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((result) => resolve(result ?? blob), "image/jpeg", quality);
    });
  } catch {
    return blob;
  }
}
