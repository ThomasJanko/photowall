"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface QuickNavLink {
  href: string;
  label: string;
  icon?: string;
}

type Position = "bottom-left" | "bottom-right" | "top-left" | "top-right";

interface QuickNavProps {
  readonly links: QuickNavLink[];
  readonly position?: Position;
  /** light = fond clair (défaut, comme le bouton photo sur /wall) */
  readonly variant?: "light" | "dark";
}

const COLLAPSE_THRESHOLD = 3;

const POSITION: Record<Position, string> = {
  "bottom-left": "bottom-6 left-4 sm:left-6",
  "bottom-right": "bottom-6 right-4 sm:right-6",
  "top-left": "top-6 left-4 sm:left-6",
  "top-right": "top-6 right-4 sm:right-6",
};

function displayLabel(link: QuickNavLink): string {
  return link.icon ? `${link.icon} ${link.label}` : link.label;
}

function buttonClasses(variant: "light" | "dark", extra = ""): string {
  const base =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full font-semibold px-4 sm:px-5 py-2.5 text-sm sm:text-base active:scale-95 transition-transform whitespace-nowrap";
  const skin =
    variant === "light"
      ? "bg-white/90 text-purple-900 shadow-2xl"
      : "bg-black/50 text-white ring-1 ring-white/20 backdrop-blur-sm shadow-2xl";
  return `${base} ${skin} ${extra}`.trim();
}

interface NavButtonProps {
  href: string;
  variant: "light" | "dark";
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

function NavButton({ href, variant, children, className, onClick }: NavButtonProps) {
  return (
    <Link href={href} className={buttonClasses(variant, className)} onClick={onClick}>
      {children}
    </Link>
  );
}

/** Navigation flottante compacte — boutons empilés ou menu déroulant si > 3 liens. */
export function QuickNav({
  links,
  position = "bottom-right",
  variant = "light",
}: QuickNavProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (links.length === 0) return null;

  const pos = POSITION[position];
  const menuAbove =
    position === "bottom-left" || position === "bottom-right";

  if (links.length <= COLLAPSE_THRESHOLD) {
    return (
      <nav
        aria-label="Navigation rapide"
        className={`fixed z-40 flex flex-col items-start gap-2 ${pos}`}
      >
        {links.map((link) => (
          <NavButton key={link.href} href={link.href} variant={variant}>
            {displayLabel(link)}
          </NavButton>
        ))}
      </nav>
    );
  }

  return (
    <nav
      ref={rootRef}
      aria-label="Navigation rapide"
      className={`fixed z-40 ${pos}`}
    >
      {open && (
        <div
          className={`absolute flex flex-col gap-2 min-w-[11rem] ${
            menuAbove ? "bottom-full mb-2" : "top-full mt-2"
          } ${position.includes("right") ? "right-0 items-end" : "left-0 items-start"}`}
        >
          {links.map((link) => (
            <NavButton
              key={link.href}
              href={link.href}
              variant={variant}
              onClick={() => setOpen(false)}
            >
              {displayLabel(link)}
            </NavButton>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-label="Ouvrir la navigation"
        onClick={() => setOpen((v) => !v)}
        className={buttonClasses(variant, "w-12 px-0 text-lg")}
      >
        {open ? "✕" : "🔗"}
      </button>
    </nav>
  );
}
