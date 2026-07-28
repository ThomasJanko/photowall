export type PrivateMediaType = "image" | "video" | null;

/** Message privé (organisateurs uniquement — jamais sur /wall). */
export interface PrivateMessage {
  id: string;
  text: string;
  mediaFilename: string | null;
  mediaType: PrivateMediaType;
  createdAt: number;
}
