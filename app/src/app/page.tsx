"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";
import { compressImage } from "@/lib/compressImage";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { useEventConfig } from "@/components/EventThemeProvider";
import { QuickNav } from "@/components/QuickNav";
import { PollModal } from "@/components/PollModal";
import { ChallengePicker } from "@/components/ChallengePicker";
import { PseudoGate } from "@/components/PseudoGate";
import { buildGuestNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { fetchActiveChallenges, type PublicChallenge } from "@/lib/challengesApi";
import { getGuestPseudo } from "@/lib/guestPseudo";
import {
  getCompletedChallengeIds,
  markChallengeCompleted,
} from "@/lib/challengesCompleted";
import {
  addToQueue,
  blobToDataUrl,
  dataUrlToBlob,
  generateId,
  loadQueue,
  removeFromQueue,
  type QueueItem,
} from "@/lib/uploadQueue";
import {
  addMyPendingPhoto,
  countMyPendingPhotos,
  getMyPendingPhotoIds,
  removeMyPendingPhoto,
} from "@/lib/myPendingPhotos";

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
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(
    null
  );
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<PublicChallenge[]>([]);
  const [waitingModerationCount, setWaitingModerationCount] = useState(0);
  const [approvedNotice, setApprovedNotice] = useState(false);
  const [lastUploadPending, setLastUploadPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const moderationEnabled = config.features.moderationRequired === true;

  const refreshModerationCount = useCallback(() => {
    setWaitingModerationCount(countMyPendingPhotos());
  }, []);

  useEffect(() => {
    setCompletedIds(getCompletedChallengeIds());
    fetchActiveChallenges().then(setChallenges).catch(() => setChallenges([]));
    refreshModerationCount();
  }, [refreshModerationCount]);

  useEffect(() => {
    if (!moderationEnabled) return;

    let approvedTimer: ReturnType<typeof setTimeout> | null = null;
    const service = getPhotoService();
    const unsub = service.onNewPhoto((photo) => {
      if (!getMyPendingPhotoIds().includes(photo.id)) return;
      removeMyPendingPhoto(photo.id);
      refreshModerationCount();
      setApprovedNotice(true);
      if (approvedTimer) clearTimeout(approvedTimer);
      approvedTimer = setTimeout(() => setApprovedNotice(false), 6000);
    });

    return () => {
      unsub();
      if (approvedTimer) clearTimeout(approvedTimer);
    };
  }, [moderationEnabled, refreshModerationCount]);

  const registerUploadResult = useCallback(
    (photo: Photo) => {
      if (!moderationEnabled) {
        setLastUploadPending(false);
        return;
      }
      if (photo.status === "pending") {
        addMyPendingPhoto(photo.id);
        refreshModerationCount();
        setLastUploadPending(true);
      } else {
        setLastUploadPending(false);
      }
    },
    [moderationEnabled, refreshModerationCount]
  );

  const refreshCompleted = useCallback(() => {
    setCompletedIds(getCompletedChallengeIds());
  }, []);

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
    const pseudo = getGuestPseudo() ?? undefined;
    for (const item of queue) {
      try {
        const blob = dataUrlToBlob(item.dataUrl);
        const photo = await service.upload(
          blob,
          item.filename,
          item.challengeId,
          item.authorPseudo ?? pseudo
        );
        registerUploadResult(photo);
        if (item.challengeId) markChallengeCompleted(item.challengeId);
        removeFromQueue(item.id);
      } catch {
        break;
      }
    }
    setPendingCount(loadQueue().length);
    refreshCompleted();
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
    const challengeId = selectedChallengeId ?? undefined;
    const authorPseudo = getGuestPseudo() ?? undefined;
    const service = getPhotoService();

    try {
      const photo = await service.upload(
        pendingBlob,
        filename,
        challengeId,
        authorPseudo
      );
      registerUploadResult(photo);
      if (challengeId) markChallengeCompleted(challengeId);
      refreshCompleted();
      setStatus("success");
      reset();
    } catch (err) {
      console.error(err);
      const dataUrl = await blobToDataUrl(pendingBlob);
      const item: QueueItem = {
        id: generateId(),
        dataUrl,
        filename,
        createdAt: Date.now(),
        ...(challengeId ? { challengeId } : {}),
        ...(authorPseudo ? { authorPseudo } : {}),
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
    setLastUploadPending(false);
    setTimeout(() => setStatus("idle"), 2000);
  }

  const hasChallenges = challenges.length > 0;

  return (
    <PseudoGate>
    <main className="relative min-h-dvh overflow-hidden event-gradient-bg flex flex-col items-center px-5 py-8 sm:py-12">
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

        {hasChallenges && (
          <ChallengePicker
            challenges={challenges}
            selectedId={selectedChallengeId}
            onSelect={setSelectedChallengeId}
            completedIds={completedIds}
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

        {previewUrl ? (
          <div className="w-full space-y-4">
            {selectedChallengeId && (
              <p className="text-center text-sm text-pink-200">
                Défi :{" "}
                {challenges.find((c) => c.id === selectedChallengeId)?.emoji}{" "}
                {challenges.find((c) => c.id === selectedChallengeId)?.label}
              </p>
            )}
            <img
              src={previewUrl}
              alt="Aperçu"
              className="w-full aspect-square object-cover rounded-3xl shadow-2xl ring-4 ring-white/20"
            />
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-full bg-white/10 text-white font-semibold px-6 py-4 backdrop-blur-sm ring-1 ring-white/20 active:scale-95 transition-transform"
              >
                ↩️ Recommencer
              </button>
              <button
                type="button"
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
          {moderationEnabled && approvedNotice && (
            <p className="inline-block rounded-full bg-green-400/15 text-green-300 font-medium px-4 py-2 ring-1 ring-green-400/30">
              ✅ Ta photo est en ligne sur le mur !
            </p>
          )}
          {status === "success" &&
            moderationEnabled &&
            lastUploadPending && (
              <p className="inline-block rounded-full bg-amber-400/15 text-amber-200 font-medium px-4 py-2 ring-1 ring-amber-400/30">
                📷 Ta photo est en attente de validation par l&apos;organisateur
              </p>
            )}
          {status === "success" &&
            (!moderationEnabled || !lastUploadPending) && (
              <p className="inline-block rounded-full bg-green-400/15 text-green-300 font-medium px-4 py-2 ring-1 ring-green-400/30">
                Photo envoyée 🎊
              </p>
            )}
          {moderationEnabled &&
            waitingModerationCount > 0 &&
            status !== "success" &&
            !approvedNotice && (
              <p className="text-sm text-amber-200/90">
                📷{" "}
                {waitingModerationCount === 1
                  ? "Ta photo est en attente de validation par l'organisateur"
                  : `${waitingModerationCount} photos en attente de validation par l'organisateur`}
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
      <PollModal screen="home" />
    </main>
    </PseudoGate>
  );
}
