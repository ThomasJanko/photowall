import { io, type Socket } from "socket.io-client";
import type {
  Photo,
  ReactionEvent,
  AnnouncementEvent,
  CurrentAnnouncement,
  ChallengeVoteEvent,
  TimelineEra,
  TimelineEntry,
  TimelinePageSettings,
  AddTimelineEntryInput,
  PlanningEvent,
  PlanningEventInput,
  ScreenCommand,
  ScreenState,
  TimerCommand,
  TimerState,
  RaffleCommand,
  RaffleState,
  RaffleDrawEvent,
} from "./types";
import type { PhotoService } from "./photoService";
import { adminFetch } from "./adminAuth";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/**
 * Implémentation locale : parle à server/index.ts (Express + Socket.io).
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
    if (!res.ok)
      throw new Error(`Chargement des photos échoué (${res.status})`);
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
    const res = await fetch(
      `${SERVER_URL}/api/photos/${photoId}/challenge-vote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote, action }),
      }
    );
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

  async getCurrentAnnouncement(): Promise<CurrentAnnouncement | null> {
    const res = await fetch(`${SERVER_URL}/api/announcement/current`);
    if (!res.ok) return null;
    const data = (await res.json()) as CurrentAnnouncement | null;
    return data;
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
    if (!res.ok)
      throw new Error(`Suppression en masse échouée (${res.status})`);
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
    if (!res.ok)
      throw new Error(
        `Chargement des photos en attente échoué (${res.status})`
      );
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

  async listTimelineEras(): Promise<TimelineEra[]> {
    const res = await fetch(`${SERVER_URL}/api/timeline/eras`);
    if (!res.ok) throw new Error(`Chargement frise échoué (${res.status})`);
    return res.json();
  }

  async listTimelinePageSettings(): Promise<TimelinePageSettings> {
    const res = await fetch(`${SERVER_URL}/api/timeline/page`);
    if (!res.ok)
      throw new Error(`Chargement en-tête frise échoué (${res.status})`);
    return res.json();
  }

  async listTimelineEntries(): Promise<TimelineEntry[]> {
    const res = await fetch(`${SERVER_URL}/api/timeline/entries`);
    if (!res.ok) throw new Error(`Chargement souvenirs échoué (${res.status})`);
    return res.json();
  }

  async addTimelineEntry(data: AddTimelineEntryInput): Promise<TimelineEntry> {
    const form = new FormData();
    form.append("text", data.text);
    form.append("author", data.author);
    if (data.eraId) form.append("eraId", data.eraId);
    if (data.photo) form.append("photo", data.photo, "timeline.jpg");

    const res = await fetch(`${SERVER_URL}/api/timeline/entries`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Ajout souvenir échoué (${res.status})`);
    return res.json();
  }

  onNewTimelineEntry(callback: (entry: TimelineEntry) => void): () => void {
    this.socket.on("timeline:new", callback);
    return () => this.socket.off("timeline:new", callback);
  }

  onTimelineErasUpdated(callback: (eras: TimelineEra[]) => void): () => void {
    this.socket.on("timeline:eras", callback);
    return () => this.socket.off("timeline:eras", callback);
  }

  onTimelinePageUpdated(
    callback: (page: TimelinePageSettings) => void
  ): () => void {
    this.socket.on("timeline:page", callback);
    return () => this.socket.off("timeline:page", callback);
  }

  async saveTimelineEras(
    eras: TimelineEra[],
    page?: TimelinePageSettings
  ): Promise<TimelineEra[]> {
    const res = await adminFetch(`${SERVER_URL}/api/timeline/eras`, {
      method: "PUT",
      body: JSON.stringify({ eras, ...(page ? { page } : {}) }),
    });
    if (!res.ok) throw new Error(`Sauvegarde frise échouée (${res.status})`);
    const data = (await res.json()) as TimelineEra[] | { eras: TimelineEra[] };
    return Array.isArray(data) ? data : data.eras;
  }

  async removeTimelineEntry(id: string): Promise<void> {
    const res = await adminFetch(`${SERVER_URL}/api/timeline/entries/${id}`, {
      method: "DELETE",
    });
    if (!res.ok)
      throw new Error(`Suppression souvenir échouée (${res.status})`);
  }

  async listPendingTimelineEntries(): Promise<TimelineEntry[]> {
    const res = await adminFetch(`${SERVER_URL}/api/timeline/entries/pending`);
    if (!res.ok) {
      throw new Error(`Chargement souvenirs en attente échoué (${res.status})`);
    }
    return res.json();
  }

  async approveTimelineEntry(id: string): Promise<TimelineEntry> {
    const res = await adminFetch(
      `${SERVER_URL}/api/timeline/entries/${id}/approve`,
      {
        method: "POST",
      }
    );
    if (!res.ok) throw new Error(`Validation souvenir échouée (${res.status})`);
    return res.json();
  }

  onPendingTimelineEntry(callback: (entry: TimelineEntry) => void): () => void {
    this.socket.on("timeline:pending", callback);
    return () => this.socket.off("timeline:pending", callback);
  }

  // ─── Planning ───────────────────────────────────────────────────────────────

  async listPlanningEvents(): Promise<PlanningEvent[]> {
    const res = await fetch(`${SERVER_URL}/api/planning`);
    if (!res.ok) throw new Error(`Chargement planning échoué (${res.status})`);
    return res.json();
  }

  private planningFormData(data: Partial<PlanningEventInput>, photo?: File): FormData {
    const form = new FormData();
    if (data.title !== undefined) form.append("title", data.title);
    if (data.date !== undefined) form.append("date", data.date);
    if (data.time !== undefined) form.append("time", data.time);
    if (data.duration !== undefined) form.append("duration", data.duration ?? "");
    if (data.description !== undefined) form.append("description", data.description ?? "");
    if (data.emoji !== undefined) form.append("emoji", data.emoji ?? "");
    if (data.color !== undefined) form.append("color", data.color ?? "");
    if (data.location !== undefined) form.append("location", data.location ?? "");
    if (data.surprise !== undefined) {
      form.append("surprise", data.surprise ? "true" : "false");
    }
    if (photo) form.append("photo", photo, photo.name);
    return form;
  }

  async createPlanningEvent(data: PlanningEventInput, photo?: File): Promise<PlanningEvent> {
    const res = await adminFetch(`${SERVER_URL}/api/planning`, {
      method: "POST",
      body: this.planningFormData(data, photo),
    });
    if (!res.ok) throw new Error(`Création événement planning échouée (${res.status})`);
    return res.json();
  }

  async updatePlanningEvent(id: string, data: Partial<PlanningEventInput>, photo?: File): Promise<PlanningEvent> {
    const res = await adminFetch(`${SERVER_URL}/api/planning/${id}`, {
      method: "PUT",
      body: this.planningFormData(data, photo),
    });
    if (!res.ok) throw new Error(`Mise à jour planning échouée (${res.status})`);
    return res.json();
  }

  async deletePlanningEvent(id: string): Promise<void> {
    const res = await adminFetch(`${SERVER_URL}/api/planning/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Suppression planning échouée (${res.status})`);
  }

  async reorderPlanningEvents(events: PlanningEvent[]): Promise<PlanningEvent[]> {
    const res = await adminFetch(`${SERVER_URL}/api/planning/reorder`, {
      method: "PUT",
      body: JSON.stringify({ events }),
    });
    if (!res.ok) throw new Error(`Réordonnancement planning échoué (${res.status})`);
    return res.json();
  }

  async revealPlanningEvent(id: string): Promise<PlanningEvent> {
    const res = await adminFetch(`${SERVER_URL}/api/planning/${id}/reveal`, {
      method: "POST",
    });
    if (!res.ok) throw new Error(`Révélation planning échouée (${res.status})`);
    return res.json();
  }

  onPlanningNew(callback: (event: PlanningEvent) => void): () => void {
    this.socket.on("planning:new", callback);
    return () => this.socket.off("planning:new", callback);
  }

  onPlanningUpdated(callback: (event: PlanningEvent) => void): () => void {
    this.socket.on("planning:updated", callback);
    return () => this.socket.off("planning:updated", callback);
  }

  onPlanningRemoved(callback: (payload: { id: string }) => void): () => void {
    this.socket.on("planning:removed", callback);
    return () => this.socket.off("planning:removed", callback);
  }

  onPlanningList(callback: (events: PlanningEvent[]) => void): () => void {
    this.socket.on("planning:list", callback);
    return () => this.socket.off("planning:list", callback);
  }

  // ─── Écran TV ───────────────────────────────────────────────────────────────

  async getScreenState(): Promise<ScreenState> {
    const res = await fetch(`${SERVER_URL}/api/screen/state`);
    if (!res.ok) throw new Error(`État écran indisponible (${res.status})`);
    const data = (await res.json()) as { state: ScreenState };
    return data.state;
  }

  async sendScreenCommand(cmd: ScreenCommand): Promise<void> {
    const res = await adminFetch(`${SERVER_URL}/api/screen/command`, {
      method: "POST",
      body: JSON.stringify(cmd),
    });
    if (!res.ok) throw new Error(`Commande écran échouée (${res.status})`);
  }

  onScreenCommand(callback: (cmd: ScreenCommand) => void): () => void {
    this.socket.on("screen:command", callback);
    return () => this.socket.off("screen:command", callback);
  }

  // ─── Chrono / minuteur ──────────────────────────────────────────────────────

  async getTimerState(): Promise<TimerState> {
    const res = await fetch(`${SERVER_URL}/api/timer/state`);
    if (!res.ok) throw new Error(`État chrono indisponible (${res.status})`);
    const data = (await res.json()) as { state: TimerState };
    return data.state;
  }

  async sendTimerCommand(cmd: TimerCommand): Promise<void> {
    const res = await adminFetch(`${SERVER_URL}/api/timer/command`, {
      method: "POST",
      body: JSON.stringify(cmd),
    });
    if (!res.ok) throw new Error(`Commande chrono échouée (${res.status})`);
  }

  onTimerState(callback: (state: TimerState) => void): () => void {
    this.socket.on("timer:state", callback);
    return () => this.socket.off("timer:state", callback);
  }

  // ─── Tirage au sort ─────────────────────────────────────────────────────────

  async getRaffleState(): Promise<RaffleState> {
    const res = await fetch(`${SERVER_URL}/api/raffle/state`);
    if (!res.ok) throw new Error(`État tirage indisponible (${res.status})`);
    const data = (await res.json()) as { state: RaffleState };
    return data.state;
  }

  async sendRaffleCommand(cmd: RaffleCommand): Promise<void> {
    const res = await adminFetch(`${SERVER_URL}/api/raffle/command`, {
      method: "POST",
      body: JSON.stringify(cmd),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Commande tirage échouée (${res.status})`);
    }
  }

  onRaffleState(callback: (state: RaffleState) => void): () => void {
    this.socket.on("raffle:state", callback);
    return () => this.socket.off("raffle:state", callback);
  }

  onRaffleDraw(callback: (event: RaffleDrawEvent) => void): () => void {
    this.socket.on("raffle:draw", callback);
    return () => this.socket.off("raffle:draw", callback);
  }
}
