"use client";

import { useEffect, useState } from "react";
import {
  eventConfig as defaultEventConfig,
  type EventConfig,
  type FeatureFlags,
} from "@/config/event";
import {
  fetchEventConfig,
  resetEventConfigApi,
  updateEventConfigApi,
} from "@/lib/eventConfigApi";
import { useEventConfig } from "@/components/EventThemeProvider";

interface AdminConfigTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

const FEATURE_LABELS: Record<keyof FeatureFlags, string> = {
  reactions: "Réactions emoji (/wall)",
  confetti: "Confettis",
  spotlight: "Spotlight nouvelles photos",
  countdown: "Page compte à rebours",
  retrospective: "Page rétrospective",
  privateMessages: "Messages privés",
  qrPage: "Page QR code",
  timeBasedTheme: "Thème selon l'heure",
  adminBulkActions: "Actions groupées admin (photos)",
  moderationRequired: "Modération des uploads (file d'attente admin)",
};

type FormState = Omit<EventConfig, "reactionEmojis"> & {
  reactionEmojis: string[];
};

function configToForm(cfg: EventConfig): FormState {
  return {
    ...cfg,
    reactionEmojis: [...cfg.reactionEmojis],
  };
}

export function AdminConfigTab({ onUnauthorized }: AdminConfigTabProps) {
  const { refreshConfig } = useEventConfig();
  const [form, setForm] = useState<FormState>(() => configToForm(defaultEventConfig));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchEventConfig()
      .then((cfg) => setForm(configToForm(cfg)))
      .catch(() => setFeedback({ type: "err", text: "Chargement impossible" }))
      .finally(() => setLoading(false));
  }, []);

  function setThemeField(key: keyof EventConfig["theme"], value: string) {
    setForm((f) => ({
      ...f,
      theme: { ...f.theme, [key]: value },
    }));
  }

  function setFeature(key: keyof FeatureFlags, value: boolean) {
    setForm((f) => ({
      ...f,
      features: { ...f.features, [key]: value },
    }));
  }

  function addEmoji() {
    setForm((f) => ({ ...f, reactionEmojis: [...f.reactionEmojis, ""] }));
  }

  function updateEmoji(index: number, value: string) {
    setForm((f) => {
      const next = [...f.reactionEmojis];
      next[index] = value;
      return { ...f, reactionEmojis: next };
    });
  }

  function removeEmoji(index: number) {
    setForm((f) => ({
      ...f,
      reactionEmojis: f.reactionEmojis.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);

    const emojis = form.reactionEmojis.map((s) => s.trim()).filter(Boolean);
    if (emojis.length === 0) {
      setFeedback({ type: "err", text: "Au moins un emoji de réaction requis" });
      setBusy(false);
      return;
    }

    const payload: Partial<EventConfig> = {
      eventName: form.eventName,
      welcomeMessage: form.welcomeMessage,
      celebrationText: form.celebrationText,
      countdownTarget: form.countdownTarget,
      reactionEmojis: emojis,
      spotlightDurationMs: Math.round(form.spotlightDurationMs),
      reactionCooldownMs: Math.round(form.reactionCooldownMs),
      theme: form.theme,
      features: form.features,
    };

    try {
      const saved = await updateEventConfigApi(payload);
      setForm(configToForm(saved));
      await refreshConfig();
      setFeedback({
        type: "ok",
        text: "Configuration enregistrée. Rechargez les pages invités (mur, etc.) pour appliquer les changements.",
      });
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "Erreur lors de la sauvegarde",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (
      !confirm(
        "Réinitialiser toute la configuration aux valeurs par défaut du code ?"
      )
    ) {
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const saved = await resetEventConfigApi();
      setForm(configToForm(saved));
      await refreshConfig();
      setFeedback({
        type: "ok",
        text: "Configuration réinitialisée. Rechargez les pages invités.",
      });
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback({ type: "err", text: "Réinitialisation échouée" });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-center text-purple-200 mt-10">Chargement…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-8 pb-8">
      <p className="rounded-xl bg-amber-400/10 text-amber-200 text-sm px-4 py-3 ring-1 ring-amber-400/25">
        Les pages déjà ouvertes (mur, accueil, etc.) doivent être rechargées
        pour appliquer textes, thème et feature flags. Pas de mise à jour
        temps réel sur la config.
      </p>

      {feedback && (
        <p
          className={`rounded-xl text-sm px-4 py-3 ring-1 ${
            feedback.type === "ok"
              ? "bg-green-400/10 text-green-200 ring-green-400/25"
              : "bg-orange-400/15 text-orange-200 ring-orange-400/30"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <fieldset className="space-y-3">
        <legend className="text-lg font-bold text-white">Général</legend>
        <label className="block space-y-1">
          <span className="text-sm text-purple-200">Nom de l&apos;événement</span>
          <input
            value={form.eventName}
            onChange={(e) =>
              setForm((f) => ({ ...f, eventName: e.target.value }))
            }
            className="w-full rounded-xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-purple-200">Message d&apos;attente (/wall)</span>
          <textarea
            value={form.welcomeMessage}
            onChange={(e) =>
              setForm((f) => ({ ...f, welcomeMessage: e.target.value }))
            }
            rows={2}
            className="w-full resize-none rounded-xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-purple-200">Texte célébration (/countdown)</span>
          <input
            value={form.celebrationText}
            onChange={(e) =>
              setForm((f) => ({ ...f, celebrationText: e.target.value }))
            }
            className="w-full rounded-xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-bold text-white">Thème</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["gradientFrom", "Dégradé début"],
              ["gradientVia", "Dégradé milieu"],
              ["gradientTo", "Dégradé fin"],
              ["accent", "Accent"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={form.theme[key]}
                onChange={(e) => setThemeField(key, e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent"
              />
              <span className="text-xs text-purple-200 flex-1">{label}</span>
              <span className="text-xs text-purple-300 font-mono">
                {form.theme[key]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-bold text-white">Réactions</legend>
        <p className="text-xs text-purple-400">
          Changer les emojis en cours de soirée ne met pas à jour les compteurs
          déjà stockés sur les photos existantes.
        </p>
        <ul className="space-y-2">
          {form.reactionEmojis.map((emoji, i) => (
            <li key={i} className="flex gap-2">
              <input
                value={emoji}
                onChange={(e) => updateEmoji(i, e.target.value)}
                placeholder="Emoji"
                className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
              />
              <button
                type="button"
                onClick={() => removeEmoji(i)}
                disabled={form.reactionEmojis.length <= 1}
                className="rounded-lg bg-red-600/80 px-3 text-sm text-white disabled:opacity-40"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={addEmoji}
          className="text-sm text-purple-200 underline underline-offset-2"
        >
          + Ajouter un emoji
        </button>
        <label className="block space-y-1">
          <span className="text-sm text-purple-200">
            Cooldown entre clics (secondes)
          </span>
          <input
            type="number"
            min={0.5}
            step={0.1}
            value={form.reactionCooldownMs / 1000}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                reactionCooldownMs:
                  Math.max(500, parseFloat(e.target.value) * 1000) || 1500,
              }))
            }
            className="w-32 rounded-xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-bold text-white">Animation</legend>
        <label className="block space-y-1">
          <span className="text-sm text-purple-200">
            Durée spotlight (secondes)
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={form.spotlightDurationMs / 1000}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                spotlightDurationMs:
                  Math.max(1000, parseFloat(e.target.value) * 1000) || 10000,
              }))
            }
            className="w-32 rounded-xl bg-white/10 px-3 py-2 text-white ring-1 ring-white/20"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-lg font-bold text-white mb-2">Fonctionnalités</legend>
        {(Object.keys(FEATURE_LABELS) as (keyof FeatureFlags)[]).map((key) => (
          <label
            key={key}
            className="flex items-center gap-3 cursor-pointer text-purple-100"
          >
            <input
              type="checkbox"
              checked={form.features[key]}
              onChange={(e) => setFeature(key, e.target.checked)}
              className="h-4 w-4 accent-pink-500"
            />
            {FEATURE_LABELS[key]}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-6 py-3 font-bold text-white shadow disabled:opacity-50 active:scale-95 transition-transform"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="cursor-pointer rounded-full bg-white/10 px-5 py-3 text-sm font-semibold text-purple-100 ring-1 ring-white/20 disabled:opacity-50"
        >
          Réinitialiser aux valeurs par défaut
        </button>
      </div>
    </form>
  );
}
