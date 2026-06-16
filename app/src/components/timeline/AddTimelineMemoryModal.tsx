"use client";

import { useEffect, useRef, useState } from "react";
import { compressImage } from "@/lib/compressImage";
import { getGuestPseudo } from "@/lib/guestPseudo";
import type { TimelineEra } from "@/lib/types";
import { Camera } from "lucide-react";
import { deferCallback } from "@/lib/deferCallback";

const MAX_TEXT = 500;

interface AddTimelineMemoryModalProps {
  open: boolean;
  eras: TimelineEra[];
  moderationEnabled: boolean;
  onClose: () => void;
  onSubmit: (data: {
    text: string;
    author: string;
    eraId: string | null;
    photo?: Blob;
  }) => Promise<void>;
}

export function AddTimelineMemoryModal({
  open,
  eras,
  moderationEnabled,
  onClose,
  onSubmit,
}: AddTimelineMemoryModalProps) {
  const [text, setText] = useState("");
  const [eraId, setEraId] = useState<string>("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    deferCallback(() => {
      setText("");
      setEraId("");
      setPhotoBlob(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, {
        maxDimension: 1200,
        quality: 0.75,
      });
      setPhotoBlob(compressed);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(compressed);
      });
    } catch {
      setPhotoBlob(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const author = getGuestPseudo();
    if (!author || text.trim().length < 2) return;

    setBusy(true);
    try {
      await onSubmit({
        text: text.trim().slice(0, MAX_TEXT),
        author,
        eraId: eraId || null,
        ...(photoBlob ? { photo: photoBlob } : {}),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[90dvh] w-full max-w-md scrollbar-none overflow-y-auto rounded-t-3xl bg-linear-to-b from-purple-950 to-purple-900 p-6 shadow-2xl ring-1 ring-white/20 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-xl font-bold text-white">
          Ajouter un souvenir
        </h2>
        <p className="mb-4 text-sm text-purple-200">
          Partage une anecdote ou un message pour la frise
          {moderationEnabled ? " (validation organisateur)" : ""}.
        </p>

        <label className="mb-1 block text-sm font-medium text-purple-100">
          Ton message
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
          rows={4}
          maxLength={MAX_TEXT}
          placeholder="Raconte un souvenir..."
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-white ring-1 ring-white/20 placeholder:text-purple-300/50 focus:ring-pink-400/50 focus:outline-none"
          required
        />
        <p className="mt-1 text-right text-xs text-purple-400 tabular-nums">
          {text.length}/{MAX_TEXT}
        </p>

        <label className="mt-4 mb-1 block text-sm font-medium text-purple-100">
          Période (optionnel)
        </label>
        <select
          value={eraId}
          onChange={(e) => setEraId(e.target.value)}
          className="w-full rounded-xl bg-white/10 px-4 py-3 text-white ring-1 ring-white/20 focus:outline-none"
        >
          <option value="" className="bg-purple-950">
            Non classé
          </option>
          {eras.map((era) => (
            <option key={era.id} value={era.id} className="bg-purple-950">
              {era.period} — {era.label}
            </option>
          ))}
        </select>

        <div className="mt-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-3 text-sm font-semibold text-purple-100 ring-1 ring-white/20 transition-transform active:scale-[0.98]"
          >
            <Camera className="h-4 w-4 shrink-0" aria-hidden />
            {previewUrl ? "Changer la photo" : "Ajouter une photo (optionnel)"}
          </button>
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="mt-2 max-h-32 w-full rounded-xl object-cover ring-1 ring-white/20"
            />
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-white/10 py-3 font-semibold text-white ring-1 ring-white/20"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy || text.trim().length < 2}
            className="flex-1 rounded-full bg-linear-to-r from-pink-500 to-purple-500 py-3 font-bold text-white shadow-lg disabled:opacity-50"
          >
            {busy ? "Envoi…" : "Publier ✨"}
          </button>
        </div>
      </form>
    </div>
  );
}
