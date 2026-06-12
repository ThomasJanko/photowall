import { io, type Socket } from "socket.io-client";
import type { Photo, ReactionEvent, AnnouncementEvent, ChallengeVoteEvent } from "./types";
import type { PhotoService } from "./photoService";
import { adminFetch } from "./adminAuth";

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

  async upload(
    blob: Blob,
    filename: string,
    challengeId?: string,
    authorPseudo?: string
  ): Promise<Photo> {
    const form = new FormData();
    form.append("photo", blob, filename);
    if (challengeId) form.append("challengeId", challengeId);
    if (authorPseudo) form.append("authorPseudo", authorPseudo);

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

  private async sendReaction(
    photoId: string,
    emoji: string,
    action: "add" | "remove"
  ): Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/photos/${photoId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, action }),
    });
    if (!res.ok) throw new Error(`Réaction échouée (${res.status})`);
  }

  async react(photoId: string, emoji: string): Promise<void> {
    return this.sendReaction(photoId, emoji, "add");
  }

  async unreact(photoId: string, emoji: string): Promise<void> {
    return this.sendReaction(photoId, emoji, "remove");
  }

  onReaction(callback: (event: ReactionEvent) => void): () => void {
    this.socket.on("photo:reaction", callback);
    return () => this.socket.off("photo:reaction", callback);
  }

  private async sendChallengeVote(
    photoId: string,
    vote: "success" | "fail",
    action: "add" | "remove"
  ): Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/photos/${photoId}/challenge-vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote, action }),
    });
    if (!res.ok) throw new Error(`Vote défi échoué (${res.status})`);
  }

  async voteChallenge(
    photoId: string,
    vote: "success" | "fail",
    action: "add" | "remove"
  ): Promise<void> {
    return this.sendChallengeVote(photoId, vote, action);
  }

  onChallengeVote(callback: (event: ChallengeVoteEvent) => void): () => void {
    this.socket.on("photo:challengeVote", callback);
    return () => this.socket.off("photo:challengeVote", callback);
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    const onConnect = () => callback(true);
    const onDisconnect = () => callback(false);
    const onReconnectAttempt = () => callback(false);

    this.socket.on("connect", onConnect);
    this.socket.on("disconnect", onDisconnect);
    this.socket.on("reconnect_attempt", onReconnectAttempt);

    // État initial au moment de l'abonnement
    callback(this.socket.connected);

    return () => {
      this.socket.off("connect", onConnect);
      this.socket.off("disconnect", onDisconnect);
      this.socket.off("reconnect_attempt", onReconnectAttempt);
    };
  }

  onAnnouncement(callback: (event: AnnouncementEvent) => void): () => void {
    this.socket.on("announcement:new", callback);
    return () => this.socket.off("announcement:new", callback);
  }

  async hidePhoto(id: string): Promise<void> {
    const res = await adminFetch(`${SERVER_URL}/api/photos/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Suppression échouée (${res.status})`);
  }

  async hidePhotos(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const res = await adminFetch(`${SERVER_URL}/api/photos/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Suppression en masse échouée (${res.status})`);
  }

  async exportPhotos(ids: string[]): Promise<Blob> {
    const res = await adminFetch(`${SERVER_URL}/api/photos/export`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) throw new Error(`Export échoué (${res.status})`);
    return res.blob();
  }

  async listPendingPhotos(): Promise<Photo[]> {
    const res = await adminFetch(`${SERVER_URL}/api/photos/pending`);
    if (!res.ok) throw new Error(`Chargement des photos en attente échoué (${res.status})`);
    return res.json();
  }

  async approvePhoto(id: string): Promise<Photo> {
    const res = await adminFetch(`${SERVER_URL}/api/photos/${id}/approve`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Approbation échouée (${res.status})`);
    return res.json();
  }

  onPendingPhoto(callback: (photo: Photo) => void): () => void {
    this.socket.on("photo:pending", callback);
    return () => this.socket.off("photo:pending", callback);
  }

  onNewPrivateMessage(callback: () => void): () => void {
    this.socket.on("message:new", callback);
    return () => this.socket.off("message:new", callback);
  }
}
