"use client";

import { useEffect, useState, useMemo } from "react";
import QRCode from "qrcode";
import { QuickNav } from "@/components/QuickNav";
import { useToast } from "@/components/ToastProvider";
import { useEventConfig } from "@/components/EventThemeProvider";
import { buildNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { usePathname } from "next/navigation";
import { deferCallback } from "@/lib/deferCallback";

/** URL de base sans slash final. */
function resolveAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function QrPage() {
  const pathname = usePathname();
  const { config } = useEventConfig();
  const isAdmin = useIsAdmin();
  const { showToast } = useToast();
  const navLinks = useMemo(
    () => buildNavLinks(pathname, config.features, isAdmin),
    [pathname, config.features, isAdmin]
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");

  useEffect(() => {
    deferCallback(() => {
      const base = resolveAppUrl();
      if (!base) {
        showToast("URL de l'application introuvable.", "error");
        setFailed(true);
        return;
      }

      const url = `${base}/`;
      setTargetUrl(url);

      QRCode.toDataURL(url, {
        width: 600,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      })
        .then(setQrDataUrl)
        .catch((err) => {
          console.error(err);
          setFailed(true);
          showToast("Impossible de générer le QR code.", "error");
        });
    });
  }, [showToast]);

  return (
    <main className="event-gradient-bg relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden p-6 text-center">
      <h1 className="text-2xl font-bold text-white drop-shadow-lg sm:text-4xl md:text-5xl">
        📱 Scanne pour participer au mur de souvenirs !
      </h1>

      <div className="rounded-3xl bg-white p-6 shadow-2xl ring-4 ring-white/20 sm:p-8">
        {failed ? (
          <p className="max-w-sm text-lg text-purple-600">
            QR code indisponible
          </p>
        ) : qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR code d'accès au mur de photos"
            className="h-[80vmin] max-h-[600px] w-[80vmin] max-w-[600px]"
          />
        ) : (
          <div
            className="flex h-[80vmin] max-h-[600px] w-[80vmin] max-w-[600px] items-center justify-center"
            aria-busy="true"
          >
            <p className="text-lg text-purple-400">Génération du QR code...</p>
          </div>
        )}
      </div>

      {targetUrl && (
        <p className="max-w-xl font-mono text-sm break-all text-purple-100 sm:text-lg">
          {targetUrl}
        </p>
      )}
      <QuickNav links={navLinks} position="bottom-left" />
    </main>
  );
}
