import type { QuickNavLink } from "@/components/QuickNav";
import type { FeatureFlags } from "@/config/event";
import { withAdminLink } from "./useIsAdmin";

/** Liens invités optionnels selon les feature flags. */
export function buildGuestNavLinks(
  features: FeatureFlags,
  isAdmin: boolean,
  extra: QuickNavLink[] = []
): QuickNavLink[] {
  const links: QuickNavLink[] = [...extra];

  const optional: QuickNavLink[] = [
    { href: "/wall", label: "Mur", icon: "🖼️" },
    ...(features.privateMessages
      ? [{ href: "/message", label: "Message privé", icon: "💌" }]
      : []),
    ...(features.qrPage ? [{ href: "/qr", label: "QR code", icon: "📱" }] : []),
    ...(features.countdown
      ? [{ href: "/countdown", label: "Compte à rebours", icon: "⏳" }]
      : []),
    ...(features.retrospective && isAdmin
      ? [{ href: "/retrospective", label: "Rétrospective", icon: "🎬" }]
      : []),
    ...(features.leaderboard
      ? [{ href: "/classement", label: "Classement", icon: "🏆" }]
      : []),
    ...(features.timeline
      ? [{ href: "/timeline", label: "Frise", icon: "🕰️" }]
      : []),
  ];

  for (const item of optional) {
    if (!links.some((l) => l.href === item.href)) links.push(item);
  }

  return withAdminLink(links, isAdmin);
}

/** Liens minimaux retour accueil + mur (+ admin si connecté). */
export function buildBackNavLinks(isAdmin: boolean): QuickNavLink[] {
  return withAdminLink(
    [
      { href: "/", label: "Accueil", icon: "🏠" },
      { href: "/wall", label: "Mur", icon: "🖼️" },
    ],
    isAdmin
  );
}
