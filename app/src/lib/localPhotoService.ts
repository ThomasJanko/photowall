import { io, type Socket } from "socket.io-client";
import type { Photo } from "./types";
import type { PhotoService } from "./photoService";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/**
 * Implémentation "réseau local" : parle à server/index.ts (Express + Socket.io).
 * Utilisée quand NEXT_PUBLIC_BACKEND=local (par défaut).
 */
export class LocalPhotoService implements PhotoService {
  private socket: Socket;

  constructor() {
    this.socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }

  async upload(blob: Blob, filename: string): Promise<Photo> {
    const form = new FormData();
    form.append("photo", blob, filename);

    const res = await fetch(`${SERVER_URL}/api/photos`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Upload échoué (${res.status})`);
    }

    return res.json();
  }

  async listPhotos(): Promise<Photo[]> {
    const res = await fetch(`${SERVER_URL}/api/photos`);
    if (!res.ok) throw new Error(`Chargement des photos échoué (${res.status})`);
    return res.json();
  }

  onNewPhoto(callback: (photo: Photo) => void): () => void {
    this.socket.on("photo:new", callback);
    return () => this.socket.off("photo:new", callback);
  }

  onPhotoRemoved(callback: (photoId: string) => void): () => void {
    this.socket.on("photo:removed", callback);
    return () => this.socket.off("photo:removed", callback);
  }

  async hidePhoto(id: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/photos/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Suppression échouée (${res.status})`);
  }
}
