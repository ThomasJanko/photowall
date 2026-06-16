"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createChallengeApi,
  deleteChallengeApi,
  fetchAllChallenges,
  updateChallengeApi,
  type AdminChallenge,
} from "@/lib/challengesApi";
import { Plus } from "lucide-react";
import { deferCallback } from "@/lib/deferCallback";

interface AdminChallengesTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

export function AdminChallengesTab({
  onUnauthorized,
}: AdminChallengesTabProps) {
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("");

  const load = useCallback(async () => {
    try {
      const list = await fetchAllChallenges();
      setChallenges(list);
    } catch (err) {
      if (onUnauthorized(err)) return;
      console.error(err);
      setFeedback("Impossible de charger les défis");
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    deferCallback(() => void load());
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const created = await createChallengeApi(newLabel, newEmoji || undefined);
      setChallenges((prev) => [...prev, created]);
      setNewLabel("");
      setNewEmoji("");
      setFeedback("Défi ajouté");
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(
    id: string,
    patch: Partial<Pick<AdminChallenge, "label" | "emoji" | "active">>
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      const updated = await updateChallengeApi(id, patch);
      setChallenges((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (
      !confirm(
        "Supprimer ce défi ? Les photos déjà liées garderont leur référence (affichées comme « Défi supprimé » sur le mur)."
      )
    ) {
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await deleteChallengeApi(id);
      setChallenges((prev) => prev.filter((c) => c.id !== id));
      setFeedback("Défi supprimé");
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-purple-200">Chargement des défis…</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-purple-300">
        Gère les défis proposés sur la page d&apos;upload. Désactive un défi
        pour le retirer sans supprimer l&apos;historique des photos.
      </p>

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs text-purple-300">Label</label>
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ex: Photo avec un inconnu"
            className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/20 focus:ring-pink-400 focus:outline-none"
          />
        </div>
        <div className="w-20">
          <label className="mb-1 block text-xs text-purple-300">Emoji</label>
          <input
            type="text"
            value={newEmoji}
            onChange={(e) => setNewEmoji(e.target.value.slice(0, 4))}
            placeholder="🎯"
            className="w-full rounded-xl bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/20 focus:ring-pink-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !newLabel.trim()}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-5 py-2 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Ajouter
        </button>
      </form>

      {feedback && <p className="text-sm text-pink-200">{feedback}</p>}

      <ul className="space-y-3">
        {challenges.map((c) => (
          <li
            key={c.id}
            className={`rounded-xl p-4 ring-1 ${
              c.active
                ? "bg-white/5 ring-white/15"
                : "bg-black/20 opacity-70 ring-white/10"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                defaultValue={c.emoji ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== (c.emoji ?? "")) {
                    handleUpdate(c.id, { emoji: v });
                  }
                }}
                placeholder="🎯"
                className="w-14 rounded-lg bg-white/10 px-2 py-1.5 text-center text-sm text-white ring-1 ring-white/20"
              />
              <input
                type="text"
                defaultValue={c.label}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== c.label) handleUpdate(c.id, { label: v });
                }}
                className="min-w-[160px] flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white ring-1 ring-white/20"
              />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-purple-200">
                <input
                  type="checkbox"
                  checked={c.active}
                  onChange={(e) =>
                    handleUpdate(c.id, { active: e.target.checked })
                  }
                  className="h-4 w-4 accent-pink-500"
                />
                Actif
              </label>
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                disabled={busy}
                className="cursor-pointer rounded-full bg-red-600/80 px-3 py-1.5 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>

      {challenges.length === 0 && (
        <p className="text-sm text-purple-300">
          Aucun défi — ajoute-en un ou relance le serveur pour migrer depuis la
          config par défaut.
        </p>
      )}
    </div>
  );
}
