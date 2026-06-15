"use client";

import { useRef, useState, useMemo } from "react";
import Link from "next/link";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { QuickNav } from "@/components/QuickNav";
import { buildBackNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { submitPrivateMessage } from "@/lib/privateMessages";
import { useToast } from "@/components/ToastProvider";
import {
  MAX_PRIVATE_TEXT,
  MAX_VIDEO_DURATION_SEC,
  validatePrivateMedia,
  type ValidatedPrivateMedia,
} from "@/lib/validatePrivateMedia";

type Status = "idle" | "validating" | "sending";

export default function MessagePage() {
  const isAdmin = useIsAdmin();
  const { showToast } = useToast();
  const navLinks = useMemo(() => buildBackNavLinks(isAdmin), [isAdmin]);
  const [text, setText] = useState("");
  const [media, setMedia] = useState<ValidatedPrivateMedia | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const photoGalleryRef = useRef<HTMLInputElement>(null);
  const videoGalleryRef = useRef<HTMLInputElement>(null);

  function clearMedia() {
    setMedia(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    for (const ref of [
      photoInputRef,
      videoInputRef,
      photoGalleryRef,
      videoGalleryRef,
    ]) {
      if (ref.current) ref.current.value = "";
    }
  }

  function resetForm() {
    setText("");
    clearMedia();
    setValidationError(null);
    setStatus("idle");
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("validating");
    setValidationError(null);
    clearMedia();

    try {
      const validated = await validatePrivateMedia(file);
      setMedia(validated);
      setPreviewUrl(URL.createObjectURL(validated.blob));
      setStatus("idle");
    } catch (err) {
      setStatus("idle");
      setValidationError(
        err instanceof Error ? err.message : "Fichier non valide"
      );
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      if (photoGalleryRef.current) photoGalleryRef.current.value = "";
      if (videoGalleryRef.current) videoGalleryRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();

    if (!trimmed && !media) {
      setValidationError("Écris un message ou ajoute une photo/vidéo");
      return;
    }

    setStatus("sending");
    setValidationError(null);

    try {
      await submitPrivateMessage(
        trimmed,
        media?.blob ?? null,
        media?.filename
      );
      resetForm();
      showToast("Merci, ton message a bien été transmis 💕", "success");
    } catch (err) {
      setStatus("idle");
      showToast(
        err instanceof Error
          ? err.message
          : "Erreur réseau — vérifie ta connexion et réessaie",
        "error"
      );
    }
  }

  const charCount = text.length;
  const canSubmit =
    status !== "sending" &&
    status !== "validating" &&
    (text.trim().length > 0 || media !== null);

  return (
    <main className="relative min-h-dvh overflow-hidden event-gradient-bg flex flex-col items-center px-5 py-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-pink-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl"
      />

      <ConfettiBackground />

      <div className="relative flex w-full max-w-md flex-1 flex-col gap-6">
        <header className="text-center space-y-2">
          <p className="text-5xl">💌</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow">
            Laisser un message privé
          </h1>
          <p className="text-purple-200 text-sm sm:text-base">
            Un mot doux pour les organisateurs — visible uniquement par eux
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="message-text" className="sr-only">
                Ton message
              </label>
              <textarea
                id="message-text"
                value={text}
                onChange={(e) =>
                  setText(e.target.value.slice(0, MAX_PRIVATE_TEXT))
                }
                placeholder="Écris ton message ici…"
                rows={5}
                className="w-full resize-none rounded-2xl bg-white/10 px-4 py-3 text-white placeholder:text-purple-300 ring-1 ring-white/20 backdrop-blur-sm focus:outline-none focus:ring-pink-400"
              />
              <p className="mt-1 text-right text-xs text-purple-300">
                {charCount}/{MAX_PRIVATE_TEXT}
              </p>
            </div>

            <div className="space-y-3">
              {/* Inputs séparés : sur mobile, capture="environment" ouvre la caméra vidéo */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="photo-input"
              />
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="video-input"
              />
              <input
                ref={photoGalleryRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="photo-gallery-input"
              />
              <input
                ref={videoGalleryRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
                id="video-gallery-input"
              />

              {!previewUrl ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      htmlFor="photo-input"
                      className="cursor-pointer text-center rounded-full bg-white/10 text-white font-semibold px-4 py-4 ring-1 ring-white/20 backdrop-blur-sm active:scale-95 transition-transform"
                    >
                      {status === "validating"
                        ? "… ⏳"
                        : "📷 Photo"}
                    </label>
                    <label
                      htmlFor="video-input"
                      className="cursor-pointer text-center rounded-full bg-white/10 text-white font-semibold px-4 py-4 ring-1 ring-white/20 backdrop-blur-sm active:scale-95 transition-transform"
                    >
                      {status === "validating"
                        ? "… ⏳"
                        : "🎥 Filmer"}
                    </label>
                  </div>
                  <p className="text-center text-xs text-purple-400">
                    ou{" "}
                    <label
                      htmlFor="photo-gallery-input"
                      className="cursor-pointer underline underline-offset-2"
                    >
                      photo
                    </label>
                    {" / "}
                    <label
                      htmlFor="video-gallery-input"
                      className="cursor-pointer underline underline-offset-2"
                    >
                      vidéo
                    </label>
                    {" "}depuis la galerie
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {media?.type === "video" ? (
                    <video
                      src={previewUrl}
                      controls
                      className="w-full rounded-2xl bg-black/20"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Aperçu"
                      className="w-full rounded-2xl object-cover ring-2 ring-white/20"
                    />
                  )}
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="w-full rounded-full bg-white/10 text-purple-200 text-sm font-semibold px-4 py-2 ring-1 ring-white/20 active:scale-95 transition-transform"
                  >
                    Retirer le média
                  </button>
                </div>
              )}
              <p className="text-xs text-purple-400 text-center">
                Vidéo : max {MAX_VIDEO_DURATION_SEC} s et 20 Mo
              </p>
            </div>

            {validationError && (
              <p className="rounded-2xl bg-orange-400/15 text-orange-200 text-sm font-medium px-4 py-3 ring-1 ring-orange-400/30">
                {validationError}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-full bg-linear-to-r from-pink-500 to-purple-500 text-white font-bold px-8 py-4 text-lg shadow-xl shadow-pink-900/40 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
            >
              {status === "sending" ? "Envoi… ⏳" : "Envoyer 💕"}
            </button>
          </form>

        <Link
          href="/"
          className="rounded-full bg-white/10 text-white font-semibold px-6 py-3 ring-1 ring-white/20 backdrop-blur-sm active:scale-95 transition-transform text-center"
        >
          ← Retour à l&apos;accueil
        </Link>
      </div>

      <QuickNav links={navLinks} position="bottom-left" />
    </main>
  );
}
