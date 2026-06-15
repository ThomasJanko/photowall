"use client";

import { useCallback, useEffect, useState } from "react";
import { getPhotoService } from "@/lib/photoService";
import type { TimelineEra, TimelineEntry, TimelinePageSettings } from "@/lib/types";
import { DEFAULT_TIMELINE_PAGE_SETTINGS } from "@/lib/types";
import { adminFetch } from "@/lib/adminAuth";
import { resolveMediaUrl, eraAccentColor } from "@/lib/timelineUtils";
import { useEventConfig } from "@/components/EventThemeProvider";
import { useToast } from "@/components/ToastProvider";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

interface AdminTimelineTabProps {
  onUnauthorized: (err: unknown) => boolean;
  onPendingCountChange?: (count: number) => void;
}

function newEra(order: number): TimelineEra {
  return {
    id: crypto.randomUUID(),
    label: "Nouvelle période",
    period: "2000 – 2005",
    order,
  };
}

export function AdminTimelineTab({
  onUnauthorized,
  onPendingCountChange,
}: AdminTimelineTabProps) {
  const { config } = useEventConfig();
  const { showToast } = useToast();
  const moderation = config.features.moderationRequired === true;

  const [eras, setEras] = useState<TimelineEra[]>([]);
  const [pageSettings, setPageSettings] = useState<TimelinePageSettings>(
    DEFAULT_TIMELINE_PAGE_SETTINGS
  );
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [pending, setPending] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const service = getPhotoService();
    try {
      const [eraList, entryList, page] = await Promise.all([
        service.listTimelineEras?.() ?? [],
        service.listTimelineEntries?.() ?? [],
        service.listTimelinePageSettings?.() ?? DEFAULT_TIMELINE_PAGE_SETTINGS,
      ]);
      setEras(eraList);
      setEntries(entryList);
      setPageSettings(page);

      if (moderation && service.listPendingTimelineEntries) {
        const p = await service.listPendingTimelineEntries();
        setPending(p);
        onPendingCountChange?.(p.length);
      } else {
        setPending([]);
        onPendingCountChange?.(0);
      }
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Chargement timeline impossible", "error");
    } finally {
      setLoading(false);
    }
  }, [moderation, onPendingCountChange, onUnauthorized, showToast]);

  useEffect(() => {
    load();
    const service = getPhotoService();
    const unsubPending = service.onPendingTimelineEntry?.(() => load());
    return () => unsubPending?.();
  }, [load]);

  function updateEra(id: string, patch: Partial<TimelineEra>) {
    setEras((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
    );
  }

  function moveEra(id: string, dir: -1 | 1) {
    setEras((prev) => {
      const idx = prev.findIndex((e) => e.id === id);
      if (idx < 0) return prev;
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy.map((e, i) => ({ ...e, order: i }));
    });
  }

  function removeEra(id: string) {
    if (!confirm("Supprimer cette période ?")) return;
    setEras((prev) =>
      prev.filter((e) => e.id !== id).map((e, i) => ({ ...e, order: i }))
    );
  }

  async function uploadEraPhoto(id: string, file: File) {
    const form = new FormData();
    form.append("photo", file);
    try {
      const res = await adminFetch(`${SERVER_URL}/api/timeline/eras/photo`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload échoué");
      const { photoUrl } = (await res.json()) as { photoUrl: string };
      updateEra(id, { photoUrl });
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Upload photo échoué", "error");
    }
  }

  async function handleSaveEras() {
    const service = getPhotoService();
    if (!service.saveTimelineEras) return;
    setSaving(true);
    try {
      const saved = await service.saveTimelineEras(eras, pageSettings);
      setEras(saved);
      showToast("Frise enregistrée", "success");
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Enregistrement échoué", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveEntry(id: string) {
    const service = getPhotoService();
    if (!service.approveTimelineEntry) return;
    setBusyEntryId(id);
    try {
      await service.approveTimelineEntry(id);
      showToast("Souvenir validé", "success");
      await load();
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Validation échouée", "error");
    } finally {
      setBusyEntryId(null);
    }
  }

  async function handleDeleteEntry(id: string) {
    if (!confirm("Supprimer ce souvenir ?")) return;
    const service = getPhotoService();
    if (!service.removeTimelineEntry) return;
    setBusyEntryId(id);
    try {
      await service.removeTimelineEntry(id);
      showToast("Souvenir supprimé", "success");
      await load();
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Suppression échouée", "error");
    } finally {
      setBusyEntryId(null);
    }
  }

  if (loading) {
    return <p className="text-purple-200">Chargement…</p>;
  }

  return (
    <div className="space-y-8 pb-8">
      {moderation && pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-amber-200">
            🕓 Souvenirs à valider ({pending.length})
          </h2>
          {pending.map((entry) => (
            <EntryAdminRow
              key={entry.id}
              entry={entry}
              busy={busyEntryId === entry.id}
              onApprove={() => handleApproveEntry(entry.id)}
              onDelete={() => handleDeleteEntry(entry.id)}
              showApprove
            />
          ))}
        </section>
      )}

      <section className="space-y-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/15">
        <h2 className="text-lg font-bold text-white">En-tête de la page</h2>
        <div className="grid gap-3 sm:grid-cols-[4rem_1fr]">
          <label className="block text-xs text-purple-200">
            Emoji
            <input
              value={pageSettings.emoji}
              onChange={(e) =>
                setPageSettings((prev) => ({ ...prev, emoji: e.target.value }))
              }
              className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-center text-xl text-white ring-1 ring-white/20"
            />
          </label>
          <label className="block text-xs text-purple-200">
            Titre
            <input
              value={pageSettings.title}
              onChange={(e) =>
                setPageSettings((prev) => ({ ...prev, title: e.target.value }))
              }
              className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
            />
          </label>
        </div>
        <label className="block text-xs text-purple-200">
          Sous-titre
          <input
            value={pageSettings.subtitle}
            onChange={(e) =>
              setPageSettings((prev) => ({ ...prev, subtitle: e.target.value }))
            }
            className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
          />
        </label>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white">Périodes de la frise</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setEras((prev) => [...prev, newEra(prev.length)])
              }
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20"
            >
              + Période
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveEras}
              className="rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer la frise"}
            </button>
          </div>
        </div>

        {eras.length === 0 && (
          <p className="text-purple-300 text-sm">
            Aucune période — ajoutez-en pour construire la frise.
          </p>
        )}

        {eras.map((era, index) => (
          <div
            key={era.id}
            className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/15 space-y-3"
            style={{ borderLeftColor: eraAccentColor(era.color, index), borderLeftWidth: 4 }}
          >
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => moveEra(era.id, -1)} className="text-sm px-2">↑</button>
              <button type="button" onClick={() => moveEra(era.id, 1)} className="text-sm px-2">↓</button>
              <button type="button" onClick={() => removeEra(era.id)} className="text-sm text-red-300 ml-auto">Supprimer</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-purple-200">
                Titre
                <input
                  value={era.label}
                  onChange={(e) => updateEra(era.id, { label: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
                />
              </label>
              <label className="block text-xs text-purple-200">
                Période
                <input
                  value={era.period}
                  onChange={(e) => updateEra(era.id, { period: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
                />
              </label>
            </div>
            <label className="block text-xs text-purple-200">
              Description
              <textarea
                value={era.description ?? ""}
                onChange={(e) => updateEra(era.id, { description: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs text-purple-200">
                Couleur
                <input
                  type="color"
                  value={era.color ?? eraAccentColor(undefined, index)}
                  onChange={(e) => updateEra(era.id, { color: e.target.value })}
                  className="ml-2 h-8 w-12 cursor-pointer rounded border-0 bg-transparent"
                />
              </label>
              <label className="cursor-pointer rounded-full bg-white/10 px-3 py-2 text-xs text-white ring-1 ring-white/20">
                📷 Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadEraPhoto(era.id, f);
                  }}
                />
              </label>
            </div>
            {era.photoUrl && (
              <img
                src={resolveMediaUrl(era.photoUrl)}
                alt=""
                className="max-h-32 rounded-lg object-cover ring-1 ring-white/20"
              />
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">
          Souvenirs publiés ({entries.length})
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-purple-300">Aucun souvenir invité pour l&apos;instant.</p>
        ) : (
          entries.map((entry) => (
            <EntryAdminRow
              key={entry.id}
              entry={entry}
              busy={busyEntryId === entry.id}
              onDelete={() => handleDeleteEntry(entry.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}

function EntryAdminRow({
  entry,
  busy,
  onDelete,
  onApprove,
  showApprove,
}: {
  entry: TimelineEntry;
  busy: boolean;
  onDelete: () => void;
  onApprove?: () => void;
  showApprove?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <p className="text-sm text-purple-50 whitespace-pre-wrap">{entry.text}</p>
      {entry.photoUrl && (
        <img
          src={resolveMediaUrl(entry.photoUrl)}
          alt=""
          className="mt-2 max-h-24 rounded-lg object-cover"
        />
      )}
      <p className="mt-1 text-xs text-purple-400">— {entry.author}</p>
      <div className="mt-2 flex gap-2">
        {showApprove && onApprove && (
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-200 ring-1 ring-green-400/30 disabled:opacity-50"
          >
            Valider
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-200 ring-1 ring-red-400/30 disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
