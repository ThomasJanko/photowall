"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import { compressImage } from "@/lib/compressImage";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { useEventConfig } from "@/components/EventThemeProvider";
import { QuickNav } from "@/components/QuickNav";
import { buildGuestNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";
import {
  addToQueue,
  blobToDataUrl,
  dataUrlToBlob,
  generateId,
  loadQueue,
  removeFromQueue,
  type QueueItem,
} from "@/lib/uploadQueue";

type Status = "idle" | "compressing" | "uploading" | "success" | "error";

export default function UploadPage() {
  const { config } = useEventConfig();
  const isAdmin = useIsAdmin();
  const navLinks = useMemo(
    () => buildGuestNavLinks(config.features, isAdmin),
    [config.features, isAdmin]
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [pendingCount, setPendingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Au chargement de la page, on tente de renvoyer les photos en attente
  // (en cas de coupure réseau précédente).
  useEffect(() => {
    flushQueue();
    const interval = setInterval(flushQueue, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flushQueue() {
    const queue = loadQueue();
    setPendingCount(queue.length);
    if (queue.length === 0) return;

    const service = getPhotoService();
    for (const item of queue) {
      try {
        const blob = dataUrlToBlob(item.dataUrl);
        await service.upload(blob, item.filename);
        removeFromQueue(item.id);
      } catch {
        // Toujours pas de réseau : on réessaiera au prochain tick
        break;
      }
    }
    setPendingCount(loadQueue().length);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("compressing");
    try {
      const compressed = await compressImage(file, {
        maxDimension: 1600,
        quality: 0.75,
      });
      setPendingBlob(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setStatus("idle");
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  }

  async function handleSend() {
    if (!pendingBlob) return;
    setStatus("uploading");

    const filename = `photo-${Date.now()}.jpg`;
    const service = getPhotoService();

    try {
      await service.upload(pendingBlob, filename);
      setStatus("success");
      reset();
    } catch (err) {
      console.error(err);
      // Pas de réseau : on garde la photo en file d'attente locale
      const dataUrl = await blobToDataUrl(pendingBlob);
      const item: QueueItem = {
        id: generateId(),
        dataUrl,
        filename,
        createdAt: Date.now(),
      };
      addToQueue(item);
      setPendingCount(loadQueue().length);
      setStatus("error");
    }
  }

  function reset() {
    setPendingBlob(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <main className="relative min-h-dvh overflow-hidden event-gradient-bg flex flex-col items-center px-5 py-8 sm:py-12">
      {/* Halos décoratifs en arrière-plan */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl"
      />

      {config.features.confetti && <ConfettiBackground />}

      <div className="relative flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
        <header className="text-center space-y-2">
          <p className="text-5xl sm:text-6xl">🎉</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow">
            Partage tes photos de la soirée !
          </h1>
          <p className="text-purple-200 text-sm sm:text-base">
            Prends une photo (ou choisis-en une) et elle apparaîtra sur le
            grand écran 📸
          </p>
        </header>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
          id="photo-input"
        />

        {previewUrl ? (
          <div className="w-full space-y-4">
            <img
              src={previewUrl}
              alt="Aperçu"
              className="w-full aspect-square object-cover rounded-3xl shadow-2xl ring-4 ring-white/20"
            />
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                onClick={reset}
                className="flex-1 rounded-full bg-white/10 text-white font-semibold px-6 py-4 backdrop-blur-sm ring-1 ring-white/20 active:scale-95 transition-transform"
              >
                ↩️ Recommencer
              </button>
              <button
                onClick={handleSend}
                disabled={status === "uploading"}
                className="flex-1 rounded-full bg-linear-to-r from-pink-500 to-purple-500 text-white font-bold px-6 py-4 text-lg shadow-xl shadow-pink-900/40 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
              >
                {status === "uploading" ? "Envoi... ⏳" : "Envoyer ✨"}
              </button>
            </div>
          </div>
        ) : (
          <label
            htmlFor="photo-input"
            className="w-full max-w-xs cursor-pointer text-center rounded-full bg-linear-to-r from-pink-500 to-purple-500 text-white font-bold px-8 py-5 text-lg shadow-xl shadow-pink-900/40 active:scale-95 transition-transform"
          >
            {status === "compressing"
              ? "Préparation... ⏳"
              : "📷 Prendre une photo"}
          </label>
        )}

        <div className="min-h-6 w-full space-y-2 text-center" aria-live="polite">
          {status === "success" && (
            <p className="inline-block rounded-full bg-green-400/15 text-green-300 font-medium px-4 py-2 ring-1 ring-green-400/30">
              Photo envoyée 🎊
            </p>
          )}
          {status === "error" && (
            <p className="rounded-2xl bg-orange-400/15 text-orange-200 font-medium px-4 py-3 ring-1 ring-orange-400/30">
              Pas de réseau pour le moment, ta photo est en attente et sera
              envoyée automatiquement dès que possible.
            </p>
          )}
          {pendingCount > 0 && (
            <p className="text-sm text-purple-300">
              {pendingCount} photo(s) en attente d&apos;envoi...
            </p>
          )}
        </div>
      </div>

      <Link
        href="/wall"
        className="relative mt-6 rounded-full text-purple-200 font-semibold px-6 py-3 ring-1 ring-white/20 bg-white/5 backdrop-blur-sm active:scale-95 transition-transform"
      >
        🖼️ Voir le mur de photos
      </Link>

      {config.features.privateMessages && (
        <Link
          href="/message"
          className="relative mt-3 text-sm text-purple-300/80 hover:text-purple-200 transition-colors"
        >
          💌 Laisser un message privé
        </Link>
      )}

      <QuickNav links={navLinks} position="bottom-left" />
    </main>
  );
}
