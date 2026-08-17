"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type { RaffleState } from "@/lib/types";
import { useToast } from "@/components/ToastProvider";
import { deferCallback } from "@/lib/deferCallback";
import { X } from "lucide-react";

const DEFAULT_STATE: RaffleState = {
  pool: [],
  drawnNames: [],
  currentDraw: null,
};

interface AdminRaffleTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

export function AdminRaffleTab({ onUnauthorized }: AdminRaffleTabProps) {
  const { showToast } = useToast();
  const [state, setState] = useState<RaffleState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [listInput, setListInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const remote = await getPhotoService().getRaffleState();
      setState(remote);
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast("État tirage indisponible", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    deferCallback(() => void load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = getPhotoService().onRaffleState(setState);
    return unsub;
  }, []);

  async function send(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      if (onUnauthorized(err)) return;
      console.error(err);
      showToast(
        err instanceof Error ? err.message : "Commande échouée",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  function parseListInput(): string[] {
    return listInput.split("\n").map((s) => s.trim()).filter(Boolean);
  }

  function definePool() {
    const names = parseListInput();
    if (names.length === 0) {
      showToast("La liste est vide", "error");
      return;
    }
    void send(async () => {
      await getPhotoService().sendRaffleCommand({ type: "setPool", names });
      setListInput("");
      showToast(`Liste définie (${names.length} personne(s))`, "success");
    });
  }

  function addToPool() {
    const names = parseListInput();
    if (names.length === 0) {
      showToast("Rien à ajouter", "error");
      return;
    }
    void send(async () => {
      await getPhotoService().sendRaffleCommand({ type: "addNames", names });
      setListInput("");
      showToast("Ajouté à la liste", "success");
    });
  }

  function removeFromPool(name: string) {
    void send(() =>
      getPhotoService().sendRaffleCommand({ type: "removeFromPool", name })
    );
  }

  function draw() {
    void send(async () => {
      await getPhotoService().sendRaffleCommand({ type: "draw" });
    });
  }

  function restoreAll() {
    void send(() => getPhotoService().sendRaffleCommand({ type: "restoreAll" }));
  }

  function clearAll() {
    if (!confirm("Tout réinitialiser (liste + historique) ?")) return;
    void send(() => getPhotoService().sendRaffleCommand({ type: "clear" }));
  }

  if (loading) return <p className="text-purple-200">Chargement…</p>;

  const total = state.pool.length + state.drawnNames.length;

  return (
    <div className="max-w-lg space-y-8 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">🎲 Tirage au sort</h2>
          <p className="mt-1 text-sm text-purple-200">
            Révélation en direct sur /wall à chaque tirage.
          </p>
        </div>
        <Link
          href="/wall"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-transform active:scale-95"
        >
          Ouvrir /wall →
        </Link>
      </div>

      {/* Saisie de la liste */}
      <section className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/15">
        <h3 className="text-sm font-semibold text-purple-200">
          Liste (un nom par ligne)
        </h3>
        <textarea
          value={listInput}
          onChange={(e) => setListInput(e.target.value)}
          rows={5}
          placeholder={"Alice\nBob\nCharlie..."}
          className="w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/20 placeholder:text-purple-300"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={definePool}
            disabled={busy || !listInput.trim()}
            className="cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Définir la liste
          </button>
          <button
            type="button"
            onClick={addToPool}
            disabled={busy || !listInput.trim()}
            className="cursor-pointer rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ajouter à la liste
          </button>
        </div>
        <p className="text-xs text-purple-400">
          « Définir la liste » remplace tout (efface l&apos;historique des
          tirages). « Ajouter » complète la liste actuelle sans y toucher.
        </p>
      </section>

      {/* Tirage */}
      <section className="space-y-4 rounded-2xl bg-white/5 p-6 text-center ring-1 ring-white/15">
        <p className="text-sm text-purple-200">
          {state.pool.length} personne{state.pool.length !== 1 ? "s" : ""} en
          jeu
          {total > 0 && ` sur ${total}`}
        </p>
        <button
          type="button"
          onClick={draw}
          disabled={busy || state.pool.length === 0}
          className="min-h-14 w-full cursor-pointer rounded-2xl bg-linear-to-r from-pink-500 to-purple-500 text-lg font-bold text-white shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          🎲 Tirer au sort
        </button>
        {state.currentDraw && (
          <p className="text-sm text-purple-200">
            Dernier tirage :{" "}
            <span className="font-bold text-white">
              {state.currentDraw.name}
            </span>
          </p>
        )}
      </section>

      {/* Personnes encore en jeu */}
      {state.pool.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-purple-200">
            Encore en jeu
          </h3>
          <ul className="flex flex-wrap gap-2">
            {state.pool.map((name) => (
              <li
                key={name}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 py-1.5 pr-1.5 pl-3 text-sm text-white ring-1 ring-white/20"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeFromPool(name)}
                  disabled={busy}
                  aria-label={`Retirer ${name} de la liste`}
                  className="rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  <X className="h-3 w-3 shrink-0" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Historique */}
      {state.drawnNames.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-purple-200">
            Déjà tirés ({state.drawnNames.length})
          </h3>
          <ol className="space-y-1.5">
            {state.drawnNames.map((name, i) => (
              <li
                key={`${name}-${i}`}
                className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-purple-100 ring-1 ring-white/10"
              >
                <span className="text-purple-400">{i + 1}.</span>
                {name}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Actions */}
      {total > 0 && (
        <section className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={restoreAll}
            disabled={busy || state.drawnNames.length === 0}
            className="min-h-12 flex-1 cursor-pointer rounded-2xl bg-white/10 px-4 text-sm font-bold text-white ring-1 ring-white/20 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ↺ Remettre tout le monde en jeu
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={busy}
            className="min-h-12 flex-1 cursor-pointer rounded-2xl bg-red-500/20 px-4 text-sm font-bold text-red-100 ring-1 ring-red-400/30 transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🗑️ Tout réinitialiser
          </button>
        </section>
      )}
    </div>
  );
}
