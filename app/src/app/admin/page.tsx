"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";
import {
  adminLogin,
  clearAdminToken,
  handleAdminError,
  verifyAdminSession,
  AdminUnauthorizedError,
} from "@/lib/adminAuth";
import { AdminMessagesTab } from "@/components/AdminMessagesTab";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

type AuthState = "checking" | "guest" | "authed";
type AdminTab = "photos" | "messages";

function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
}

/** Déclenche le téléchargement d'un blob dans le navigateur. */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-linear-to-br from-purple-950 via-purple-900 to-pink-900 p-4 pb-28">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-pink-500/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl"
      />
      <div className="relative z-10">{children}</div>
    </main>
  );
}

export default function AdminPage() {
  const [auth, setAuth] = useState<AuthState>("checking");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [zoomedPhoto, setZoomedPhoto] = useState<Photo | null>(null);

  const [loginCode, setLoginCode] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [activeTab, setActiveTab] = useState<AdminTab>("photos");

  const displayedPhotos = useMemo(
    () => photos.slice().reverse(),
    [photos]
  );

  const allSelected =
    displayedPhotos.length > 0 &&
    displayedPhotos.every((p) => selected.has(p.id));

  // Vérifie le token stocké au chargement (sans charger les photos avant auth)
  useEffect(() => {
    verifyAdminSession()
      .then((ok) => setAuth(ok ? "authed" : "guest"))
      .catch(() => setAuth("guest"));
  }, []);

  // Charge les photos et s'abonne au temps réel uniquement une fois authentifié
  useEffect(() => {
    if (auth !== "authed") return;

    const service = getPhotoService();
    service.listPhotos().then(setPhotos).catch(console.error);

    const unsubNew = service.onNewPhoto((photo) => {
      setPhotos((prev) =>
        prev.some((p) => p.id === photo.id) ? prev : [...prev, photo]
      );
    });
    const unsubRemoved = service.onPhotoRemoved((id) => {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setSelected((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setZoomedPhoto((prev) => (prev?.id === id ? null : prev));
    });

    return () => {
      unsubNew();
      unsubRemoved();
    };
  }, [auth]);

  useEffect(() => {
    if (!zoomedPhoto) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomedPhoto(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomedPhoto]);

  function forceLogout(message?: string) {
    clearAdminToken();
    setAuth("guest");
    setPhotos([]);
    setSelected(new Set());
    setZoomedPhoto(null);
    if (message) alert(message);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (failCount >= 5) {
      setLoginError("Trop de tentatives. Attends quelques secondes.");
      return;
    }

    setLoginBusy(true);
    setLoginError(null);
    try {
      await adminLogin(loginCode);
      setAuth("authed");
      setLoginCode("");
      setFailCount(0);
    } catch (err) {
      setFailCount((c) => c + 1);
      setLoginError(
        err instanceof Error ? err.message : "Code incorrect"
      );
      if (failCount + 1 >= 3) {
        setTimeout(() => setFailCount(0), 5000);
      }
    } finally {
      setLoginBusy(false);
    }
  }

  function handleLogout() {
    forceLogout();
  }

  function onAdminError(err: unknown): boolean {
    if (err instanceof AdminUnauthorizedError) {
      forceLogout(err.message);
      return true;
    }
    return handleAdminError(err);
  }

  const handleUnauthorized = useCallback(
    (err: unknown): boolean => onAdminError(err),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayedPhotos.map((p) => p.id)));
    }
  }

  async function handleHide(id: string) {
    if (!confirm("Masquer cette photo du mur ?")) return;
    try {
      await getPhotoService().hidePhoto(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setSelected((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err) {
      if (onAdminError(err)) return;
      console.error(err);
      alert("Erreur lors de la suppression");
    }
  }

  async function handleBulkExport() {
    const ids = [...selected];
    setBusy(true);
    try {
      const blob = await getPhotoService().exportPhotos(ids);
      downloadBlob(blob, "photos.zip");
    } catch (err) {
      if (onAdminError(err)) return;
      console.error(err);
      alert("Erreur lors du téléchargement");
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (
      !confirm(
        `Masquer ${ids.length} photo(s) du mur ? Cette action est irréversible.`
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await getPhotoService().hidePhotos(ids);
      setPhotos((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
    } catch (err) {
      if (onAdminError(err)) return;
      console.error(err);
      alert("Erreur lors de la suppression en masse");
    } finally {
      setBusy(false);
    }
  }

  if (auth === "checking") {
    return (
      <AdminShell>
        <p className="text-center text-purple-200 mt-20">Vérification...</p>
      </AdminShell>
    );
  }

  if (auth === "guest") {
    return (
      <AdminShell>
        <div className="mx-auto flex min-h-[70dvh] max-w-sm flex-col items-center justify-center gap-6">
          <h1 className="text-2xl font-bold text-white text-center">
            Administration
          </h1>
          <p className="text-purple-200 text-center text-sm">
            Entre le code admin pour accéder à la modération.
          </p>
          <form onSubmit={handleLogin} className="w-full space-y-4">
            <input
              type="password"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              placeholder="Code admin"
              autoComplete="current-password"
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-purple-300 ring-1 ring-white/20 backdrop-blur-sm focus:outline-none focus:ring-pink-400"
            />
            {loginError && (
              <p className="text-sm text-orange-300 text-center">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={loginBusy || !loginCode.trim()}
              className="w-full cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 py-3 font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 transition-transform"
            >
              {loginBusy ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
      </AdminShell>
    );
  }

  const selectedCount = selected.size;
  const hasSelection = selectedCount > 0;

  return (
    <AdminShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Administration</h1>
          <p className="text-purple-200">
            {activeTab === "photos"
              ? `${photos.length} photo(s) actuellement sur le mur`
              : "Messages privés des invités"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="cursor-pointer rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-purple-100 ring-1 ring-white/20 backdrop-blur-sm active:scale-95 transition-transform"
        >
          Se déconnecter
        </button>
      </div>

      <div className="mb-6 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("photos")}
          className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors active:scale-95 ${
            activeTab === "photos"
              ? "bg-linear-to-r from-pink-500 to-purple-500 text-white shadow"
              : "bg-white/10 text-purple-200 ring-1 ring-white/20"
          }`}
        >
          Photos du mur
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("messages")}
          className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors active:scale-95 ${
            activeTab === "messages"
              ? "bg-linear-to-r from-pink-500 to-purple-500 text-white shadow"
              : "bg-white/10 text-purple-200 ring-1 ring-white/20"
          }`}
        >
          Messages privés
        </button>
      </div>

      {activeTab === "messages" ? (
        <AdminMessagesTab onUnauthorized={handleUnauthorized} />
      ) : (
        <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleSelectAll}
          disabled={displayedPhotos.length === 0 || busy}
          className="cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow ring-1 ring-white/20 backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 transition-transform"
        >
          {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
        </button>
        {hasSelection && (
          <p className="text-sm text-purple-200">
            {selectedCount} photo(s) sélectionnée(s)
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {displayedPhotos.map((photo) => {
          const isSelected = selected.has(photo.id);
          return (
            <div
              key={photo.id}
              className={`relative rounded-lg overflow-hidden shadow-lg bg-white/5 ring-2 transition-colors ${
                isSelected ? "ring-pink-400" : "ring-white/10"
              }`}
            >
              <label className="absolute top-1 left-1 z-10 flex cursor-pointer items-center rounded-md bg-black/50 p-1.5 backdrop-blur-sm">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(photo.id)}
                  className="h-4 w-4 cursor-pointer accent-purple-600"
                  aria-label={`Sélectionner la photo ${photo.id}`}
                />
              </label>
              <button
                type="button"
                onClick={() => setZoomedPhoto(photo)}
                className="block w-full cursor-pointer"
                aria-label="Agrandir la photo"
              >
                <img
                  src={resolveUrl(photo.url)}
                  alt=""
                  className="w-full aspect-square object-cover transition-transform hover:scale-[1.02]"
                />
              </button>
              <button
                type="button"
                onClick={() => handleHide(photo.id)}
                disabled={busy}
                className="absolute top-1 right-1 cursor-pointer bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-full shadow disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 transition-transform"
              >
                Masquer
              </button>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 bg-purple-950/90 px-4 py-3 shadow-lg backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
          {hasSelection && (
            <span className="text-sm text-purple-200">
              {selectedCount} photo(s) sélectionnée(s)
            </span>
          )}
          <button
            type="button"
            onClick={handleBulkExport}
            disabled={!hasSelection || busy}
            className="cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-40 active:scale-95 transition-transform"
          >
            📥 Télécharger la sélection
          </button>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={!hasSelection || busy}
            className="cursor-pointer rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow disabled:cursor-not-allowed disabled:opacity-40 active:scale-95 transition-transform"
          >
            🗑️ Supprimer la sélection
          </button>
        </div>
      </div>
        </>
      )}

      {activeTab === "photos" && zoomedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setZoomedPhoto(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Photo agrandie"
        >
          <button
            type="button"
            onClick={() => setZoomedPhoto(null)}
            className="absolute top-4 right-4 cursor-pointer rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm active:scale-95 transition-transform"
          >
            ✕ Fermer
          </button>
          <img
            src={resolveUrl(zoomedPhoto.url)}
            alt=""
            className="max-h-[92vh] max-w-[96vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </AdminShell>
  );
}
