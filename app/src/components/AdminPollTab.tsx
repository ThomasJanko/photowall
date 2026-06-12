"use client";

import { useEffect, useState } from "react";
import { PollResults } from "@/components/PollResults";
import { useEventConfig } from "@/components/EventThemeProvider";
import {
  closePollApi,
  createPoll,
  fetchActivePoll,
  subscribePollEvents,
} from "@/lib/pollService";
import { updateEventConfigApi } from "@/lib/eventConfigApi";
import type { PollScreens } from "@/config/event";
import type { Poll } from "@/lib/types/poll";

const SCREEN_LABELS: Record<keyof PollScreens, string> = {
  home: "Accueil (/)",
  wall: "Mur (/wall)",
};

interface AdminPollTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

export function AdminPollTab({ onUnauthorized }: AdminPollTabProps) {
  const { config, refreshConfig } = useEventConfig();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [screens, setScreens] = useState<PollScreens>(config.pollScreens);
  const [resultsSeconds, setResultsSeconds] = useState(
    Math.round((config.pollResultsDurationMs ?? 60_000) / 1000)
  );
  const [activePoll, setActivePoll] = useState<Poll | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setScreens(config.pollScreens);
    setResultsSeconds(
      Math.round((config.pollResultsDurationMs ?? 60_000) / 1000)
    );
  }, [config.pollScreens, config.pollResultsDurationMs]);

  useEffect(() => {
    fetchActivePoll()
      .then(setActivePoll)
      .catch((err) => {
        if (onUnauthorized(err)) return;
        console.error(err);
      });

    return subscribePollEvents({
      onNew: setActivePoll,
      onUpdate: setActivePoll,
      onClosed: () => setActivePoll(null),
    });
  }, [onUnauthorized]);

  async function handleResultsDurationChange(seconds: number) {
    const clamped = Math.max(10, Math.min(300, seconds));
    setResultsSeconds(clamped);
    try {
      await updateEventConfigApi({
        pollResultsDurationMs: clamped * 1000,
      });
      await refreshConfig();
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleScreenToggle(key: keyof PollScreens, value: boolean) {
    const next = { ...screens, [key]: value };
    setScreens(next);
    try {
      await updateEventConfigApi({ pollScreens: next });
      await refreshConfig();
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    }
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    const trimmedQ = question.trim();
    const trimmedOpts = options.map((o) => o.trim()).filter(Boolean);

    if (!trimmedQ || trimmedOpts.length < 2) {
      setFeedback("Question + minimum 2 options requises");
      return;
    }

    if (!screens.home && !screens.wall) {
      setFeedback("Sélectionne au moins un écran");
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const poll = await createPoll(trimmedQ, trimmedOpts);
      setActivePoll(poll);
      setQuestion("");
      setOptions(["", ""]);
      setFeedback("Sondage lancé !");
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!activePoll) return;
    if (!confirm("Clôturer le sondage et révéler les résultats ?")) return;

    setBusy(true);
    setFeedback(null);
    try {
      await closePollApi(activePoll.id);
      setActivePoll(null);
      setFeedback("Sondage clôturé — résultats visibles sur les écrans");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const canLaunch =
    !busy &&
    question.trim().length > 0 &&
    options.filter((o) => o.trim()).length >= 2;

  return (
    <div className="max-w-lg space-y-6 pb-8">
      <p className="text-sm text-purple-200">
        Question → vote → résultats à la clôture → disparition automatique.
        Les invités ne voient pas les chiffres avant la fin.
      </p>

      <fieldset className="space-y-2 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <legend className="px-1 text-sm font-semibold text-purple-200">
          Affichage des résultats
        </legend>
        <label className="flex flex-wrap items-center gap-2 text-sm text-white">
          <span className="text-purple-200">Durée après clôture</span>
          <input
            type="number"
            min={10}
            max={300}
            value={resultsSeconds}
            onChange={(e) =>
              setResultsSeconds(Number(e.target.value) || 60)
            }
            onBlur={() => handleResultsDurationChange(resultsSeconds)}
            className="w-20 rounded-lg bg-white/10 px-2 py-1 text-center ring-1 ring-white/20 focus:outline-none focus:ring-pink-400"
          />
          <span className="text-purple-300">secondes</span>
        </label>
      </fieldset>

      <fieldset className="space-y-2 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <legend className="px-1 text-sm font-semibold text-purple-200">
          Écrans affichés
        </legend>
        {(Object.keys(SCREEN_LABELS) as (keyof PollScreens)[]).map((key) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-3 text-sm text-white"
          >
            <input
              type="checkbox"
              checked={screens[key]}
              onChange={(e) => handleScreenToggle(key, e.target.checked)}
              className="h-4 w-4 accent-pink-500"
            />
            {SCREEN_LABELS[key]}
          </label>
        ))}
      </fieldset>

      {activePoll ? (
        <div className="space-y-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-green-300">
                ● Sondage actif
              </p>
              <h3 className="mt-1 text-lg font-bold text-white">
                {activePoll.question}
              </h3>
              <p className="mt-1 text-xs text-purple-400">
                Résultats masqués pour les invités
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={busy}
              className="cursor-pointer rounded-full bg-red-600/90 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 active:scale-95 transition-transform"
            >
              Clôturer
            </button>
          </div>
          <PollResults poll={activePoll} />
          <p className="text-xs text-purple-400">
            Aperçu admin uniquement — les invités ne voient pas ces chiffres.
          </p>
        </div>
      ) : (
        <form onSubmit={handleLaunch} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm text-purple-200">Question</span>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
              placeholder="Ex: Quelle chanson pour ouvrir le bal ?"
              className="w-full rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-purple-400 ring-1 ring-white/20 focus:outline-none focus:ring-pink-400"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm text-purple-200">Options</legend>
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value.slice(0, 100))}
                  placeholder={`Option ${i + 1}`}
                  className="min-w-0 flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-white placeholder:text-purple-400 ring-1 ring-white/20 focus:outline-none focus:ring-pink-400"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    className="cursor-pointer shrink-0 rounded-lg bg-white/10 px-3 text-purple-200 ring-1 ring-white/20 active:scale-95 transition-transform"
                    aria-label="Supprimer l'option"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="cursor-pointer text-sm text-purple-300 underline underline-offset-2"
            >
              + Ajouter une option
            </button>
          </fieldset>

          <button
            type="submit"
            disabled={!canLaunch}
            className="cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-6 py-3 font-bold text-white shadow disabled:cursor-not-allowed disabled:opacity-50 active:scale-95 transition-transform"
          >
            {busy ? "Lancement…" : "Lancer le sondage"}
          </button>
        </form>
      )}

      {feedback && <p className="text-sm text-purple-200">{feedback}</p>}
    </div>
  );
}
