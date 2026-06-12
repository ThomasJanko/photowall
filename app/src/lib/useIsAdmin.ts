"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ADMIN_TOKEN_KEY } from "./adminAuth";
import type { QuickNavLink } from "@/components/QuickNav";

/** Présence du token admin en localStorage (pas de vérif serveur ici). */
export function useIsAdmin(): boolean {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const check = () =>
      setIsAdmin(!!localStorage.getItem(ADMIN_TOKEN_KEY));
    check();
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("focus", check);
    };
  }, [pathname]);

  return isAdmin;
}

/** Ajoute le lien admin si l'utilisateur est connecté. */
export function withAdminLink(
  links: QuickNavLink[],
  isAdmin: boolean
): QuickNavLink[] {
  if (!isAdmin || links.some((l) => l.href === "/admin")) return links;
  return [...links, { href: "/admin", label: "Admin", icon: "🔧" }];
}
