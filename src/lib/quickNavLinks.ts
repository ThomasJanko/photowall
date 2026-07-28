"use client";

import type { QuickNavLink } from "@/lib/quickNavLink";
import type { FeatureFlags } from "@/config/event";
import {
  BarChart3,
  CalendarDays,
  Clapperboard,
  History,
  Home,
  Hourglass,
  LayoutGrid,
  Mail,
  QrCode,
  ShieldCheck,
  Trophy,
} from "lucide-react";

/**
 * Liens QuickNav pour la page courante : toutes les destinations actives
 * (feature flags + admin), sauf la page en cours.
 */
export function buildNavLinks(
  pathname: string,
  features: FeatureFlags,
  isAdmin: boolean
): QuickNavLink[] {
  const links: QuickNavLink[] = [];

  if (pathname !== "/") {
    links.push({ href: "/", label: "Accueil", icon: Home });
  }
  if (pathname !== "/wall") {
    links.push({ href: "/wall", label: "Mur", icon: LayoutGrid });
  }
  if (features.privateMessages && pathname !== "/message") {
    links.push({ href: "/message", label: "Message privé", icon: Mail });
  }
  if (features.qrPage && pathname !== "/qr") {
    links.push({ href: "/qr", label: "QR code", icon: QrCode });
  }
  if (features.countdown && pathname !== "/countdown") {
    links.push({
      href: "/countdown",
      label: "Compte à rebours",
      icon: Hourglass,
    });
  }
  if (features.leaderboard && pathname !== "/classement") {
    links.push({ href: "/classement", label: "Classement", icon: Trophy });
  }
  if (features.livePolls && pathname !== "/sondage") {
    links.push({ href: "/sondage", label: "Sondage", icon: BarChart3 });
  }
  if (features.timeline && pathname !== "/timeline") {
    links.push({ href: "/timeline", label: "Frise", icon: History });
  }
  if (features.planning && pathname !== "/planning") {
    links.push({ href: "/planning", label: "Planning", icon: CalendarDays });
  }
  if (features.retrospective && isAdmin && pathname !== "/retrospective") {
    links.push({
      href: "/retrospective",
      label: "Rétrospective",
      icon: Clapperboard,
    });
  }
  if (isAdmin && pathname !== "/admin") {
    links.push({ href: "/admin", label: "Admin", icon: ShieldCheck });
  }

  return links;
}
