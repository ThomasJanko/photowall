import type { Photo, ReactionEvent } from "./types";
import type { PhotoService } from "./photoService";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const BUCKET = "photos";
const TABLE = "photos";

/**
 * Implémentation "en ligne" : Supabase Storage (photos) + Postgres (métadonnées)
 * + Realtime (notifications de nouvelles photos).
 *
 * SETUP REQUIS (à faire une fois dans le dashboard Supabase) :
 * 1. Créer un bucket Storage public nommé "photos"
 * 2. Créer une table "photos" :
 *    id uuid primary key default gen_random_uuid(),
 *    url text not null,
 *    created_at timestamptz default now(),
 *    hidden boolean default false,
 *    reactions jsonb default '{}'::jsonb
 * 3. Activer Realtime sur la table "photos" (Replication > photos)
 *    + REPLICA IDENTITY FULL pour recevoir payload.old dans les UPDATE :
 *    alter table photos replica identity full;
 * 4. Renseigner NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local
 * 5. npm install @supabase/supabase-js
 */
export class SupabasePhotoService implements PhotoService {
  private client: any;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "Supabase non configuré : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local"
      );
    }
    // Import paresseux : @supabase/supabase-js doit être installé
    // (npm install @supabase/supabase-js) si ce backend est utilisé.
    const { createClient } = require("@supabase/supabase-js");
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async upload(blob: Blob, filename: string): Promise<Photo> {
    const path = `${Date.now()}-${filename}`;

    const { error: uploadError } = await this.client.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = this.client.storage
      .from(BUCKET)
      .getPublicUrl(path);

    const { data, error } = await this.client
      .from(TABLE)
      .insert({ url: publicUrlData.publicUrl })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      url: data.url,
      createdAt: new Date(data.created_at).getTime(),
      reactions: data.reactions ?? {},
    };
  }

  async listPhotos(): Promise<Photo[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("hidden", false)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      url: row.url,
      createdAt: new Date(row.created_at).getTime(),
      reactions: row.reactions ?? {},
    }));
  }

  onNewPhoto(callback: (photo: Photo) => void): () => void {
    const channel = this.client
      .channel("photos-insert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLE },
        (payload: any) => {
          if (payload.new.hidden) return;
          callback({
            id: payload.new.id,
            url: payload.new.url,
            createdAt: new Date(payload.new.created_at).getTime(),
            reactions: payload.new.reactions ?? {},
          });
        }
      )
      .subscribe();

    return () => this.client.removeChannel(channel);
  }

  onPhotoRemoved(callback: (photoId: string) => void): () => void {
    const channel = this.client
      .channel("photos-update")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLE },
        (payload: any) => {
          if (payload.new.hidden) callback(payload.new.id);
        }
      )
      .subscribe();

    return () => this.client.removeChannel(channel);
  }

  private async applyReaction(
    photoId: string,
    emoji: string,
    delta: 1 | -1
  ): Promise<void> {
    // Lecture puis update du JSON. Suffisant pour une soirée ; pour un
    // incrément strictement atomique, passer par une fonction RPC Postgres.
    const { data, error } = await this.client
      .from(TABLE)
      .select("reactions")
      .eq("id", photoId)
      .single();

    if (error) throw error;

    const reactions: Record<string, number> = data?.reactions ?? {};
    reactions[emoji] = Math.max(0, (reactions[emoji] ?? 0) + delta);

    const { error: updateError } = await this.client
      .from(TABLE)
      .update({ reactions })
      .eq("id", photoId);

    if (updateError) throw updateError;
  }

  async react(photoId: string, emoji: string): Promise<void> {
    return this.applyReaction(photoId, emoji, 1);
  }

  async unreact(photoId: string, emoji: string): Promise<void> {
    return this.applyReaction(photoId, emoji, -1);
  }

  onReaction(callback: (event: ReactionEvent) => void): () => void {
    const channel = this.client
      .channel("photos-reactions")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLE },
        (payload: any) => {
          const newReactions: Record<string, number> =
            payload.new.reactions ?? {};
          const oldReactions: Record<string, number> =
            payload.old?.reactions ?? {};

          // Retrouve l'emoji modifié en diffant ancien/nouveau état
          // (nécessite REPLICA IDENTITY FULL, cf. setup en tête de fichier).
          const emoji = Object.keys({ ...oldReactions, ...newReactions }).find(
            (e) => (newReactions[e] ?? 0) !== (oldReactions[e] ?? 0)
          );
          if (!emoji) return;

          callback({
            photoId: payload.new.id,
            emoji,
            reactions: newReactions,
            action:
              (newReactions[emoji] ?? 0) > (oldReactions[emoji] ?? 0)
                ? "add"
                : "remove",
          });
        }
      )
      .subscribe();

    return () => this.client.removeChannel(channel);
  }

  /**
   * No-op : le suivi Realtime Supabase nécessiterait un refactor des canaux.
   * On considère toujours connecté en mode online pour ne pas alarmer à tort.
   */
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    callback(true);
    return () => {};
  }

  async hidePhoto(id: string): Promise<void> {
    // Mode Supabase : pas de middleware serveur Express. La page /admin
    // exige une connexion côté front ; pour une vraie sécurité, ajouter
    // des RLS policies Postgres + Supabase Auth.
    const { error } = await this.client
      .from(TABLE)
      .update({ hidden: true })
      .eq("id", id);

    if (error) throw error;
  }

  async hidePhotos(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await this.client
      .from(TABLE)
      .update({ hidden: true })
      .in("id", ids);

    if (error) throw error;
  }

  /** Zip côté client : télécharge chaque URL publique puis assemble avec JSZip. */
  async exportPhotos(ids: string[]): Promise<Blob> {
    const { default: JSZip } = await import("jszip");
    const photos = await this.listPhotos();
    const toExport =
      ids.length > 0 ? photos.filter((p) => ids.includes(p.id)) : photos;

    if (toExport.length === 0) {
      throw new Error("Aucune photo à exporter");
    }

    const zip = new JSZip();
    await Promise.all(
      toExport.map(async (photo) => {
        const res = await fetch(photo.url);
        if (!res.ok) return;
        const blob = await res.blob();
        const ext =
          photo.url.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
        zip.file(`${photo.id}.${ext}`, blob);
      })
    );

    return zip.generateAsync({ type: "blob" });
  }
}
