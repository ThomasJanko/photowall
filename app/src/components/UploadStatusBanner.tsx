"use client";

import { Loader2, RefreshCw } from "lucide-react";

interface UploadStatusBannerProps {
  isUploading: boolean;
  isFlushingQueue: boolean;
  queueCount: number;
  successVisible: boolean;
  successLeaving: boolean;
  /** Message de succès (modération ou envoi standard). */
  successLabel: string;
}

/** Bandeau d'état upload / file réseau (page d'accueil invités). */
export function UploadStatusBanner({
  isUploading,
  isFlushingQueue,
  queueCount,
  successVisible,
  successLeaving,
  successLabel,
}: UploadStatusBannerProps) {
  const showQueue = queueCount > 0;
  const showSending = isUploading || (isFlushingQueue && showQueue);

  if (!showSending && !showQueue && !successVisible) return null;

  return (
    <div
      className="w-full space-y-2"
      role="status"
      aria-live="polite"
    >
      {showSending && (
        <p className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-medium text-purple-100 ring-1 ring-white/20 backdrop-blur-sm">
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Envoi en cours...
          </span>
        </p>
      )}

      {showQueue && (
        <p className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-medium text-purple-200 ring-1 ring-pink-400/25 backdrop-blur-sm">
          <span className="inline-flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            En attente d&apos;envoi (réseau faible) —{" "}
            {queueCount} photo{queueCount !== 1 ? "s" : ""} en attente
          </span>
        </p>
      )}

      {successVisible && (
        <p
          className={`rounded-2xl bg-green-400/15 px-4 py-3 text-center text-sm font-semibold text-green-300 ring-1 ring-green-400/30 transition-opacity duration-700 ease-out ${
            successLeaving ? "opacity-0" : "opacity-100"
          }`}
        >
          {successLabel}
        </p>
      )}
    </div>
  );
}
