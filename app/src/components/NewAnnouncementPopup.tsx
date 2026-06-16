"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getPhotoService } from "@/lib/photoService";
import type { AnnouncementEvent } from "@/lib/types";
import { X } from "lucide-react";

/** Durée d'affichage du popup hors /wall (fixe, comme les autres popups ~10s). */
const POPUP_VISIBLE_MS = 10_000;

/**
 * Popup discret en haut à droite sur les pages ≠ /wall quand une annonce est envoyée.
 * Clic → redirection vers /wall (la bannière y sera visible avec le temps restant).
 */
export function NewAnnouncementPopup() {
  const pathname = usePathname();
  const router = useRouter();
  const [announcement, setAnnouncement] = useState<AnnouncementEvent | null>(
    null
  );
  const [visible, setVisible] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setTimeout(() => setAnnouncement(null), 320);
  }

  function showIncoming(payload: AnnouncementEvent) {
    setAnnouncement(payload);
    setVisible(true);
    clearDismissTimer();
    dismissTimerRef.current = setTimeout(dismiss, POPUP_VISIBLE_MS);
  }

  useEffect(() => {
    if (hidden) {
      dismiss();
      return;
    }

    const service = getPhotoService();
    const unsub = service.onAnnouncement(showIncoming);

    return () => {
      unsub();
      clearDismissTimer();
    };
  }, [hidden]);

  if (hidden || !announcement) return null;

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
          {announcement.emoji ? (
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15 text-3xl ring-2 ring-white/30"
              aria-hidden
            >
              {announcement.emoji}
            </span>
          ) : (
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/15 text-3xl ring-2 ring-white/30"
              aria-hidden
            >
              📢
            </span>
          )}
          <span className="line-clamp-3 text-sm leading-tight font-semibold">
            Nouvelle annonce !
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
