"use client";

import { useEffect, useRef, useState } from "react";
import { getPhotoService } from "@/lib/photoService";
import { compressImage } from "@/lib/compressImage";
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
    <main className="flex-1 flex flex-col items-center justify-center gap-6 p-6 bg-gradient-to-b from-pink-50 to-purple-100 min-h-screen">
      <h1 className="text-2xl font-bold text-center text-purple-900">
        🎉 Partage tes photos de la soirée !
      </h1>
      <p className="text-center text-purple-700 max-w-sm">
        Prends une photo (ou choisis-en une) et elle apparaîtra sur le grand
        écran 📸
      </p>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Aperçu"
          className="w-64 h-64 object-cover rounded-2xl shadow-lg"
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        id="photo-input"
      />

      {!previewUrl && (
        <label
          htmlFor="photo-input"
          className="cursor-pointer rounded-full bg-purple-600 text-white font-semibold px-8 py-4 text-lg shadow-lg active:scale-95 transition-transform"
        >
          {status === "compressing" ? "Préparation..." : "📷 Prendre une photo"}
        </label>
      )}

      {previewUrl && (
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-gray-200 text-gray-800 font-semibold px-6 py-3"
          >
            Recommencer
          </button>
          <button
            onClick={handleSend}
            disabled={status === "uploading"}
            className="rounded-full bg-purple-600 text-white font-semibold px-8 py-3 shadow-lg disabled:opacity-50"
          >
            {status === "uploading" ? "Envoi..." : "Envoyer ✨"}
          </button>
        </div>
      )}

      {status === "success" && (
        <p className="text-green-700 font-medium">Photo envoyée 🎊</p>
      )}
      {status === "error" && (
        <p className="text-orange-700 font-medium text-center max-w-sm">
          Pas de réseau pour le moment, ta photo est en attente et sera
          envoyée automatiquement dès que possible.
        </p>
      )}
      {pendingCount > 0 && (
        <p className="text-sm text-purple-500">
          {pendingCount} photo(s) en attente d&apos;envoi...
        </p>
      )}
    </main>
  );
}
