"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Link2 } from "lucide-react";
import type { QuickNavLink } from "@/lib/quickNavLink";

export type { QuickNavLink };

type QuickNavPosition =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right";

interface QuickNavProps {
  readonly links: QuickNavLink[];
  readonly position?: QuickNavPosition;
  /** light = fond clair (défaut) | dark = fond sombre (admin, rétrospective) */
  readonly variant?: "light" | "dark";
}

const POSITION: Record<QuickNavPosition, string> = {
  "bottom-left": "bottom-6 left-4 sm:left-6",
  "bottom-right": "bottom-6 right-4 sm:right-6",
  "top-left": "top-6 left-4 sm:left-6",
  "top-right": "top-6 right-4 sm:right-6",
};

function toggleSkin(variant: "light" | "dark"): string {
  return variant === "light"
    ? "bg-white/95 text-purple-900 shadow-2xl ring-1 ring-purple-200/50"
    : "bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-md shadow-2xl";
}

function itemSkin(variant: "light" | "dark"): string {
  return variant === "light"
    ? "bg-white/95 text-purple-900 ring-1 ring-purple-200/60 shadow-xl"
    : "bg-black/55 text-white ring-1 ring-white/20 backdrop-blur-md shadow-xl";
}

/** Navigation rapide — colonne avec libellés au-dessus du burger. */
export function QuickNav({
  links,
  position = "bottom-left",
  variant = "light",
}: QuickNavProps) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (links.length === 0) return null;

  const isBottom = position.startsWith("bottom");
  const isRight = position.endsWith("right");
  /** Hauteur item + gap-2 (≈ 52px) pour l'animation bas → haut. */
  const ROW_STEP = 52;

  const menu = open ? (
    <div
      className={`quicknav-menu flex max-h-[min(70dvh,calc(100dvh-7rem))] scrollbar-none flex-col gap-2 overflow-y-auto overscroll-contain ${
        isRight ? "items-end" : "items-start"
      }`}
    >
      {links.map((link, index) => {
        const fromAnchor = isBottom ? links.length - 1 - index : index;
        const travel = fromAnchor * ROW_STEP + 8;
        const enterY = isBottom ? `${travel}px` : `-${travel}px`;

        const Icon = link.icon ?? Link2;

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-label={link.label}
            onClick={() => setOpen(false)}
            className={`quicknav-menu-item quicknav-menu-item-open flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium whitespace-nowrap active:scale-[0.98] ${itemSkin(variant)}`}
            style={
              {
                "--orbit-i": fromAnchor,
                "--enter-y": enterY,
              } as CSSProperties
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </div>
  ) : null;

  const nav = (
    <nav
      ref={rootRef}
      aria-label="Navigation rapide"
      className={`quicknav-root fixed z-40 ${POSITION[position]} ${
        open ? "quicknav-root-open" : ""
      }`}
    >
      <div
        className={`quicknav-stage flex flex-col gap-2 ${
          isRight ? "items-end" : "items-start"
        }`}
      >
        {isBottom ? (
          <>
            {menu}
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setOpen((v) => !v)}
              className={`quicknav-toggle flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${toggleSkin(variant)}`}
            >
              <span
                className={`quicknav-burger ${open ? "quicknav-burger-open" : ""}`}
                aria-hidden
              >
                <span />
                <span />
                <span />
              </span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setOpen((v) => !v)}
              className={`quicknav-toggle flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${toggleSkin(variant)}`}
            >
              <span
                className={`quicknav-burger ${open ? "quicknav-burger-open" : ""}`}
                aria-hidden
              >
                <span />
                <span />
                <span />
              </span>
            </button>
            {menu}
          </>
        )}
      </div>
    </nav>
  );

  if (!mounted) return nav;

  return createPortal(nav, document.body);
}
