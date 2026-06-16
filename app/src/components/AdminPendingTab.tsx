"use client";

import { useCallback, useEffect, useState } from "react";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { deferCallback } from "@/lib/deferCallback";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface AdminPendingTabProps {
  onUnauthorized: (err: unknown) => boolean;
  onCountChange?: (count: number) => void;
}

export function AdminPendingTab({
  onUnauthorized,
  onCountChange,
}: AdminPendingTabProps) {
  const { showToast } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const service = getPhotoService();
    if (!service.listPendingPhotos) {
      setPhotos([]);
      onCountChange?.(0);
      setLoading(false);
      return;
    }

    try {
      const pending = await service.listPendingPhotos();
      setPhotos(pending);
      onCountChange?.(pending.length);
    } catch (err) {
      if (onUnauthorized(err)) return;
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [onCountChange, onUnauthorized]);

  useEffect(() => {
    deferCallback(() => void refresh());
    const interval = setInterval(refresh, 12_000);
    const service = getPhotoService();
    const unsub = service.onPendingPhoto?.(() => {
      refresh();
    });

    return () => {
      clearInterval(interval);
      unsub?.();
    };
  }, [refresh]);

  async function handleApprove(id: string) {
    const service = getPhotoService();
    if (!service.approvePhoto) return;

    setBusyId(id);
    try {
      await service.approvePhoto(id);
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== id);
        onCountChange?.(next.length);
        return next;
      });
      showToast("Photo approuvée — visible sur le mur", "success");
    } catch (err) {
      if (onUnauthorized(err)) return;
      console.error(err);
      showToast("Approbation impossible", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!confirm("Refuser cette photo ? Elle sera masquée définitivement.")) {
      return;
    }

    setBusyId(id);
    try {
      await getPhotoService().hidePhoto(id);
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== id);
        onCountChange?.(next.length);
        return next;
      });
      showToast("Photo refusée", "success");
    } catch (err) {
      if (onUnauthorized(err)) return;
      console.error(err);
      showToast("Refus impossible", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="py-8 text-center text-purple-200">Chargement…</p>;
  }

  if (photos.length === 0) {
    return (
      <p className="py-8 text-center text-purple-200">
        Aucune photo en attente de validation.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="overflow-hidden rounded-xl bg-white/5 shadow-lg ring-1 ring-white/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveUrl(photo.url)}
            alt=""
            className="aspect-square w-full object-cover"
          />
          <div className="space-y-2 p-3">
            <p className="text-xs text-purple-300">
              {formatDate(photo.createdAt)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleApprove(photo.id)}
                disabled={busyId === photo.id}
                className="flex-1 cursor-pointer rounded-lg bg-emerald-600/80 px-2 py-2 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
              >
                ✅ Approuver
              </button>
              <button
                type="button"
                onClick={() => handleReject(photo.id)}
                disabled={busyId === photo.id}
                className="flex-1 cursor-pointer rounded-lg bg-red-600/70 px-2 py-2 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
              >
                🚫 Refuser
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
