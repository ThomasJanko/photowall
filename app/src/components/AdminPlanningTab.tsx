"use client";

import { useCallback, useEffect, useState } from "react";
import { getPhotoService } from "@/lib/photoService";
import type { PlanningEvent, PlanningEventInput } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { Camera, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { deferCallback } from "@/lib/deferCallback";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

const PALETTE = [
  "#f472b6", // pink
  "#a78bfa", // violet
  "#60a5fa", // blue
  "#34d399", // green
  "#fbbf24", // amber
  "#fb923c", // orange
  "#f87171", // red
  "#e879f9", // fuchsia
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function blankForm(): PlanningEventInput {
  return {
    title: "",
    date: todayISO(),
    time: "20:00",
    duration: "",
    description: "",
    emoji: "🎉",
    color: PALETTE[0],
    location: "",
  };
}

interface AdminPlanningTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

export function AdminPlanningTab({ onUnauthorized }: AdminPlanningTabProps) {
  const { showToast } = useToast();
  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<PlanningEventInput>(blankForm());
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await getPhotoService().listPlanningEvents();
      setEvents(list);
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Chargement planning impossible", "error");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized, showToast]);

  useEffect(() => {
    deferCallback(() => void load());
  }, [load]);

  function openNew() {
    setForm(blankForm());
    setPhotoFile(null);
    setEditingId("new");
  }

  function openEdit(ev: PlanningEvent) {
    setForm({
      title: ev.title,
      date: ev.date,
      time: ev.time,
      duration: ev.duration ?? "",
      description: ev.description ?? "",
      emoji: ev.emoji ?? "🎉",
      color: ev.color ?? PALETTE[0],
      location: ev.location ?? "",
      photoUrl: ev.photoUrl,
    });
    setPhotoFile(null);
    setEditingId(ev.id);
  }

  function closeForm() {
    setEditingId(null);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      showToast("Titre requis", "error");
      return;
    }
    if (!form.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      showToast("Date invalide", "error");
      return;
    }
    if (!form.time.match(/^\d{2}:\d{2}$/)) {
      showToast("Heure invalide", "error");
      return;
    }

    setSaving(true);
    try {
      const service = getPhotoService();
      if (editingId === "new") {
        const created = await service.createPlanningEvent(form, photoFile ?? undefined);
        setEvents((prev) => [...prev, created]);
        showToast("Événement ajouté", "success");
      } else if (editingId) {
        const updated = await service.updatePlanningEvent(editingId, form, photoFile ?? undefined);
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        showToast("Événement mis à jour", "success");
      }
      closeForm();
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Sauvegarde échouée", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet événement ?")) return;
    setBusyId(id);
    try {
      await getPhotoService().deletePlanningEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      showToast("Supprimé", "success");
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Suppression échouée", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function moveEvent(id: string, dir: -1 | 1) {
    const sorted = [...events].sort((a, b) => {
      const da = `${a.date}T${a.time}`;
      const db = `${b.date}T${b.time}`;
      return da < db ? -1 : da > db ? 1 : a.order - b.order;
    });
    const idx = sorted.findIndex((e) => e.id === id);
    const next = idx + dir;
    if (next < 0 || next >= sorted.length) return;
    [sorted[idx], sorted[next]] = [sorted[next], sorted[idx]];
    const reindexed = sorted.map((e, i) => ({ ...e, order: i }));
    setEvents(reindexed);
    try {
      await getPhotoService().reorderPlanningEvents(reindexed);
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("Réordonnancement échoué", "error");
      await load();
    }
  }

  if (loading) return <p className="text-purple-200">Chargement…</p>;

  const sorted = [...events].sort((a, b) => {
    const da = `${a.date}T${a.time}`;
    const db = `${b.date}T${b.time}`;
    return da < db ? -1 : da > db ? 1 : a.order - b.order;
  });

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">
          Planning ({events.length} événement{events.length !== 1 ? "s" : ""})
        </h2>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-bold text-white"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Ajouter
        </button>
      </div>

      {/* ── Formulaire ── */}
      {editingId !== null && (
        <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/20 space-y-4">
          <h3 className="font-bold text-white">
            {editingId === "new" ? "Nouvel événement" : "Modifier l'événement"}
          </h3>

          <div className="grid gap-3 sm:grid-cols-[3rem_1fr]">
            <label className="block text-xs text-purple-200">
              Emoji
              <input
                value={form.emoji ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-center text-xl text-white ring-1 ring-white/20"
                maxLength={4}
              />
            </label>
            <label className="block text-xs text-purple-200">
              Titre *
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="ex: Repas de fête"
                className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-purple-200">
              Date *
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
              />
            </label>
            <label className="block text-xs text-purple-200">
              Heure *
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
              />
            </label>
            <label className="block text-xs text-purple-200">
              Durée
              <input
                value={form.duration ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                placeholder="ex: 1h30"
                className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
              />
            </label>
          </div>

          <label className="block text-xs text-purple-200">
            Lieu
            <input
              value={form.location ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="ex: Salle des fêtes, Jardin…"
              className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
            />
          </label>

          <label className="block text-xs text-purple-200">
            Description
            <textarea
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Détails, infos pratiques…"
              className="mt-1 w-full rounded-lg bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
            />
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-xs text-purple-200">
              Couleur
              <div className="mt-1 flex gap-1.5 flex-wrap">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                    className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: form.color === c ? `3px solid ${c}` : "2px solid transparent",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs text-white ring-1 ring-white/20">
              <Camera className="h-3.5 w-3.5 shrink-0" />
              {photoFile ? photoFile.name : "Photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {(form.photoUrl || photoFile) && !photoFile && form.photoUrl && (
            <img
              src={
                form.photoUrl.startsWith("http")
                  ? form.photoUrl
                  : `${SERVER_URL}${form.photoUrl}`
              }
              alt=""
              className="max-h-28 rounded-lg object-cover ring-1 ring-white/20"
            />
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-full bg-white/10 px-5 py-2 text-sm text-white ring-1 ring-white/20"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* ── Liste ── */}
      {sorted.length === 0 ? (
        <p className="text-sm text-purple-300">
          Aucun événement — ajoutez le programme de la soirée.
        </p>
      ) : (
        <div className="space-y-3">
          {sorted.map((ev, idx) => (
            <div
              key={ev.id}
              className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
              style={{ borderLeftWidth: 4, borderLeftColor: ev.color ?? PALETTE[0] }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{ev.emoji ?? "📌"}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{ev.title}</p>
                    <p className="text-xs text-purple-300">
                      {ev.date} — {ev.time}
                      {ev.duration ? ` · ${ev.duration}` : ""}
                      {ev.location ? ` · 📍 ${ev.location}` : ""}
                    </p>
                    {ev.description && (
                      <p className="mt-1 text-xs text-purple-200 line-clamp-2">
                        {ev.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveEvent(ev.id, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-purple-300 hover:text-white disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveEvent(ev.id, 1)}
                    disabled={idx === sorted.length - 1}
                    className="rounded p-1 text-purple-300 hover:text-white disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(ev)}
                    className="rounded px-2 py-1 text-xs text-purple-200 hover:text-white ring-1 ring-white/20"
                  >
                    Éditer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(ev.id)}
                    disabled={busyId === ev.id}
                    className="rounded p-1 text-red-300 hover:text-red-200 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
