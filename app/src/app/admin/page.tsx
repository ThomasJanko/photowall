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
import { AdminConfigTab } from "@/components/AdminConfigTab";
import { AdminAnnounceTab } from "@/components/AdminAnnounceTab";
import { AdminPollTab } from "@/components/AdminPollTab";
import { AdminPendingTab } from "@/components/AdminPendingTab";
import { QuickNav } from "@/components/QuickNav";
import { useEventConfig } from "@/components/EventThemeProvider";
import {
  getMessagesLastSeen,
  listPrivateMessages,
  markMessagesSeen,
} from "@/lib/privateMessages";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

type AuthState = "checking" | "guest" | "authed";
type AdminTab = "photos" | "pending" | "messages" | "poll" | "config" | "announce";

const ADMIN_NAV_LINKS = [
  { href: "/", label: "Accueil", icon: "🏠" },
  { href: "/wall", label: "Mur", icon: "🖼️" },
] as const;

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
    <main className="relative min-h-dvh overflow-hidden event-gradient-bg p-4 pb-28">
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

function AdminTabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors active:scale-95 ${
        active
          ? "bg-linear-to-r from-pink-500 to-purple-500 text-white shadow"
          : "bg-white/10 text-purple-200 ring-1 ring-white/20"
      }`}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-white shadow">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

export default function AdminPage() {
  const { config } = useEventConfig();
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
  const [pendingCount, setPendingCount] = useState(0);
  const [newMessageCount, setNewMessageCount] = useState(0);

  const showPendingTab =
    config.features.moderationRequired || pendingCount > 0;

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

  // Compteur nouveaux messages privés (badge onglet)
  useEffect(() => {
    if (auth !== "authed" || !config.features.privateMessages) return;

    function refreshNewMessageCount() {
      if (activeTab === "messages") {
        markMessagesSeen();
        setNewMessageCount(0);
        return;
      }

      listPrivateMessages()
        .then((msgs) => {
          const lastSeen = getMessagesLastSeen();
          setNewMessageCount(
            msgs.filter((m) => m.createdAt > lastSeen).length
          );
        })
        .catch(() => {});
    }

    refreshNewMessageCount();
    const interval = setInterval(refreshNewMessageCount, 12_000);
    const unsub = getPhotoService().onNewPrivateMessage?.(() =>
      refreshNewMessageCount()
    );

    return () => {
      clearInterval(interval);
      unsub?.();
    };
  }, [auth, activeTab, config.features.privateMessages]);

  // Compteur photos en attente (badge onglet + visibilité)
  useEffect(() => {
    if (auth !== "authed") return;

    const service = getPhotoService();
    if (!service.listPendingPhotos) return;

    function refreshCount() {
      service.listPendingPhotos!()
        .then((list) => setPendingCount(list.length))
        .catch(() => {});
    }

    refreshCount();
    const interval = setInterval(refreshCount, 12_000);
    const unsub = service.onPendingPhoto?.(() => refreshCount());

    return () => {
      clearInterval(interval);
      unsub?.();
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
              : activeTab === "pending"
                ? `${pendingCount} photo(s) en attente de validation`
                : activeTab === "messages"
                  ? "Messages privés des invités"
                  : activeTab === "poll"
                    ? "Sondage live invités"
                    : activeTab === "announce"
                    ? "Annonce live sur le mur"
                    : "Configuration de l'événement"}
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

      <div className="mb-6 -mx-4 overflow-x-auto px-4 py-2 [scrollbar-width:thin]">
        <div className="flex w-max gap-2 pb-1">
        <AdminTabButton
          active={activeTab === "photos"}
          onClick={() => setActiveTab("photos")}
        >
          Photos du mur
        </AdminTabButton>
        {showPendingTab && (
          <AdminTabButton
            active={activeTab === "pending"}
            onClick={() => setActiveTab("pending")}
            badge={pendingCount}
          >
            🕓 À valider
          </AdminTabButton>
        )}
        {config.features.privateMessages && (
          <AdminTabButton
            active={activeTab === "messages"}
            onClick={() => setActiveTab("messages")}
            badge={newMessageCount}
          >
            Messages privés
          </AdminTabButton>
        )}
        <AdminTabButton
          active={activeTab === "announce"}
          onClick={() => setActiveTab("announce")}
        >
          📣 Annonce
        </AdminTabButton>
        <AdminTabButton
          active={activeTab === "poll"}
          onClick={() => setActiveTab("poll")}
        >
          📊 Sondage
        </AdminTabButton>
        <AdminTabButton
          active={activeTab === "config"}
          onClick={() => setActiveTab("config")}
        >
          ⚙️ Configuration
        </AdminTabButton>
        </div>
      </div>

      {activeTab === "messages" ? (
        <AdminMessagesTab
          onUnauthorized={handleUnauthorized}
          onCountChange={setNewMessageCount}
        />
      ) : activeTab === "config" ? (
        <AdminConfigTab onUnauthorized={handleUnauthorized} />
      ) : activeTab === "announce" ? (
        <AdminAnnounceTab onUnauthorized={handleUnauthorized} />
      ) : activeTab === "poll" ? (
        <AdminPollTab onUnauthorized={handleUnauthorized} />
      ) : activeTab === "pending" ? (
        <AdminPendingTab
          onUnauthorized={handleUnauthorized}
          onCountChange={setPendingCount}
        />
      ) : (
        <>
      {config.features.adminBulkActions && (
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
      )}

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
              {config.features.adminBulkActions && (
                <label className="absolute top-1 left-1 z-10 flex cursor-pointer items-center rounded-md bg-black/50 p-1.5 backdrop-blur-sm">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(photo.id)}
                    className="h-4 w-4 cursor-pointer accent-purple-600"
                    aria-label={`Sélectionner la photo ${photo.id}`}
                  />
                </label>
              )}
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

      {config.features.adminBulkActions && (
        <div
          className="fixed bottom-0 inset-x-0 z-20 border-t border-white/10 px-4 py-3 shadow-lg backdrop-blur-md"
          style={{
            background:
              "color-mix(in srgb, var(--event-gradient-from) 90%, transparent)",
          }}
        >
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
      )}
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

      <QuickNav links={[...ADMIN_NAV_LINKS]} position="bottom-left" variant="dark" />
    </AdminShell>
  );
}
