"use client";

import { useEffect, useState, useMemo } from "react";
import QRCode from "qrcode";
import { QuickNav } from "@/components/QuickNav";
import { buildBackNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";

/** URL de base sans slash final. */
function resolveAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function QrPage() {
  const isAdmin = useIsAdmin();
  const navLinks = useMemo(() => buildBackNavLinks(isAdmin), [isAdmin]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetUrl, setTargetUrl] = useState("");

  useEffect(() => {
    const base = resolveAppUrl();
    if (!base) {
      setError("URL de l'application introuvable.");
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
        setError("Impossible de générer le QR code.");
      });
  }, []);

  return (
    <main className="relative min-h-dvh overflow-hidden event-gradient-bg flex flex-col items-center justify-center gap-8 p-6 text-center">
      <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
        📱 Scanne pour participer au mur de souvenirs !
      </h1>

      <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-2xl ring-4 ring-white/20">
        {error ? (
          <p className="text-red-600 text-lg max-w-sm">{error}</p>
        ) : qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="QR code d'accès au mur de photos"
            className="w-[80vmin] h-[80vmin] max-w-[600px] max-h-[600px]"
          />
        ) : (
          <div
            className="flex w-[80vmin] h-[80vmin] max-w-[600px] max-h-[600px] items-center justify-center"
            aria-busy="true"
          >
            <p className="text-purple-400 text-lg">Génération du QR code...</p>
          </div>
        )}
      </div>

      {targetUrl && (
        <p className="max-w-xl break-all text-purple-100 text-sm sm:text-lg font-mono">
          {targetUrl}
        </p>
      )}
      <QuickNav links={navLinks} position="bottom-left" />
    </main>
  );
}
