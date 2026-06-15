import type { QuickNavLink } from "@/components/QuickNav";
import type { FeatureFlags } from "@/config/event";

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
    links.push({ href: "/", label: "Accueil", icon: "🏠" });
  }
  if (pathname !== "/wall") {
    links.push({ href: "/wall", label: "Mur", icon: "🖼️" });
  }
  if (features.privateMessages && pathname !== "/message") {
    links.push({ href: "/message", label: "Message privé", icon: "💌" });
  }
  if (features.qrPage && pathname !== "/qr") {
    links.push({ href: "/qr", label: "QR code", icon: "📱" });
  }
  if (features.countdown && pathname !== "/countdown") {
    links.push({ href: "/countdown", label: "Compte à rebours", icon: "⏳" });
  }
  if (features.leaderboard && pathname !== "/classement") {
    links.push({ href: "/classement", label: "Classement", icon: "🏆" });
  }
  if (features.timeline && pathname !== "/timeline") {
    links.push({ href: "/timeline", label: "Frise", icon: "🕰️" });
  }
  if (
    features.retrospective &&
    isAdmin &&
    pathname !== "/retrospective"
  ) {
    links.push({ href: "/retrospective", label: "Rétrospective", icon: "🎬" });
  }
  if (isAdmin && pathname !== "/admin") {
    links.push({ href: "/admin", label: "Admin", icon: "🔧" });
  }

  return links;
}
