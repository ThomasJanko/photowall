"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getPhotoService } from "@/lib/photoService";
import { useEventConfig } from "@/components/EventThemeProvider";
import type { Photo } from "@/lib/types";
import { X } from "lucide-react";
import { deferCallback } from "@/lib/deferCallback";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
}

/** Popup discrète sur les pages hors /wall quand une nouvelle photo arrive. */
export function NewPhotoPopup() {
  const pathname = usePathname();
  const router = useRouter();
  const { config } = useEventConfig();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spotlightDurationMs = config.spotlightDurationMs;

  const hidden = pathname === "/wall" || pathname.startsWith("/admin");

  function clearDismissTimer() {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }

  function dismiss() {
    clearDismissTimer();
    setVisible(false);
    setTimeout(() => setPhoto(null), 320);
  }

  function showNewPhoto(incoming: Photo) {
    setPhoto(incoming);
    setVisible(true);
    clearDismissTimer();
    dismissTimerRef.current = setTimeout(dismiss, spotlightDurationMs);
  }

  useEffect(() => {
    if (hidden) {
      deferCallback(dismiss);
      return;
    }

    const service = getPhotoService();
    const unsub = service.onNewPhoto(showNewPhoto);

    return () => {
      unsub();
      clearDismissTimer();
    };
  }, [hidden, spotlightDurationMs]);

  if (hidden || !photo) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`new-photo-popup fixed top-20 right-4 z-[45] max-w-[min(calc(100vw-2rem),18rem)] ${
        visible ? "new-photo-popup-enter" : "new-photo-popup-leave"
      }`}
    >
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--event-gradient-via)]/95 p-2.5 pr-3 text-white shadow-2xl ring-1 ring-white/25 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            dismiss();
            router.push("/wall");
          }}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-transform active:scale-[0.98]"
        >
          <img
            src={resolveUrl(photo.url)}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-xl object-cover ring-2 ring-white/30"
          />
          <span className="text-sm leading-tight font-semibold">
            📸 Nouvelle photo !
          </span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="shrink-0 rounded-full p-1.5 text-white/80 transition-transform hover:bg-white/10 active:scale-90"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
