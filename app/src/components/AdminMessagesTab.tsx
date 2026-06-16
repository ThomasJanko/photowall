"use client";

import { useEffect, useState } from "react";
import type { PrivateMessage } from "@/lib/types/privateMessage";
import {
  deletePrivateMessage,
  fetchPrivateMessageMedia,
  listPrivateMessages,
} from "@/lib/privateMessages";
import { useToast } from "@/components/ToastProvider";
import { Download } from "lucide-react";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MessageMediaProps {
  filename: string;
  mediaType: "image" | "video";
  onUnauthorized: (err: unknown) => boolean;
}

function MessageMedia({
  filename,
  mediaType,
  onUnauthorized,
}: MessageMediaProps) {
  const { showToast } = useToast();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let revoked = false;
    setLoading(true);
    setLoadFailed(false);

    fetchPrivateMessageMedia(filename)
      .then((blob) => {
        if (revoked) return;
        setBlobUrl(URL.createObjectURL(blob));
      })
      .catch((err) => {
        if (revoked) return;
        if (onUnauthorized(err)) return;
        setLoadFailed(true);
        showToast("Impossible de charger le média", "error");
      })
      .finally(() => {
        if (!revoked) setLoading(false);
      });

    return () => {
      revoked = true;
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [filename, onUnauthorized, showToast]);

  async function handleDownload() {
    try {
      const blob = await fetchPrivateMessageMedia(filename);
      downloadBlob(blob, filename);
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Téléchargement impossible", "error");
    }
  }

  if (loading) {
    return <p className="text-sm text-purple-300">Chargement du média…</p>;
  }
  if (loadFailed) {
    return <p className="text-sm text-purple-400">Média indisponible</p>;
  }
  if (!blobUrl) return null;

  return (
    <div className="space-y-2">
      {mediaType === "image" ? (
        <img
          src={blobUrl}
          alt=""
          className="max-h-64 w-full rounded-xl bg-black/20 object-contain"
        />
      ) : (
        <video
          src={blobUrl}
          controls
          className="max-h-64 w-full rounded-xl bg-black/20"
        />
      )}
      <button
        type="button"
        onClick={handleDownload}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-purple-100 ring-1 ring-white/20 transition-transform active:scale-95"
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Télécharger
      </button>
    </div>
  );
}

interface AdminMessagesTabProps {
  onUnauthorized: (err: unknown) => boolean;
  onCountChange?: (count: number) => void;
}

export function AdminMessagesTab({
  onUnauthorized,
  onCountChange,
}: AdminMessagesTabProps) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    listPrivateMessages()
      .then((list) => {
        setMessages(list);
        onCountChange?.(0);
      })
      .catch((err) => {
        if (onUnauthorized(err)) return;
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [onUnauthorized, onCountChange]);

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce message privé ?")) return;
    setBusyId(id);
    try {
      await deletePrivateMessage(id);
      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== id);
        onCountChange?.(0);
        return next;
      });
      showToast("Message supprimé", "success");
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Erreur lors de la suppression", "error");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="mt-10 text-center text-purple-200">Chargement…</p>;
  }

  if (messages.length === 0) {
    return (
      <p className="mt-10 text-center text-purple-300">
        Aucun message privé pour le moment 💌
      </p>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {messages.map((msg) => (
        <article
          key={msg.id}
          className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur-sm"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <time className="text-xs text-purple-300">
              {formatDate(msg.createdAt)}
            </time>
            <button
              type="button"
              onClick={() => handleDelete(msg.id)}
              disabled={busyId === msg.id}
              className="cursor-pointer rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
            >
              Supprimer
            </button>
          </div>

          {msg.text && (
            <p className="mb-3 leading-relaxed whitespace-pre-wrap text-white">
              {msg.text}
            </p>
          )}

          {msg.mediaFilename && msg.mediaType && (
            <MessageMedia
              filename={msg.mediaFilename}
              mediaType={msg.mediaType}
              onUnauthorized={onUnauthorized}
            />
          )}
        </article>
      ))}
    </div>
  );
}
