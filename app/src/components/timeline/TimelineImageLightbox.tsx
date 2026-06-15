"use client";

import { useEffect } from "react";

interface TimelineImageLightboxProps {
  src: string;
  caption?: string;
  onClose: () => void;
}

export function TimelineImageLightbox({
  src,
  caption,
  onClose,
}: TimelineImageLightboxProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo en plein écran"
      onClick={onClose}
      className="fixed inset-0 z-60 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-8"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/25"
      >
        Fermer
      </button>
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl ring-2 ring-white/20"
      />
      {caption && (
        <p
          onClick={(e) => e.stopPropagation()}
          className="mt-4 max-w-lg whitespace-pre-wrap text-center text-sm text-purple-100"
        >
          {caption}
        </p>
      )}
    </div>
  );
}
