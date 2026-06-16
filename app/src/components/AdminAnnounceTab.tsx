"use client";

import { useState } from "react";
import { sendAnnouncement } from "@/lib/announcementApi";
import { useToast } from "@/components/ToastProvider";

const SUGGESTIONS = [
  { text: "Le gâteau arrive !", emoji: "🎂" },
  { text: "Photo de groupe dans 5 min !", emoji: "📸" },
  { text: "Bravo à la star de la soirée !", emoji: "🌟" },
  { text: "On passe à la piste de danse !", emoji: "💃" },
] as const;

/** Durée par défaut du bandeau sur /wall (secondes). */
const DEFAULT_DURATION_SEC = 8;
const MIN_DURATION_SEC = 3;
const MAX_DURATION_SEC = 30;

interface AdminAnnounceTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

export function AdminAnnounceTab({ onUnauthorized }: AdminAnnounceTabProps) {
  const { showToast } = useToast();
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState("");
  const [durationSec, setDurationSec] = useState(DEFAULT_DURATION_SEC);
  const [busy, setBusy] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setBusy(true);
    try {
      await sendAnnouncement({
        text: trimmed,
        emoji: emoji.trim() || undefined,
        durationMs: durationSec * 1000,
      });
      showToast("Annonce envoyée sur le mur", "success");
      setText("");
      setEmoji("");
    } catch (err) {
      if (onUnauthorized(err)) return;
      showToast(err instanceof Error ? err.message : "Envoi échoué", "error");
    } finally {
      setBusy(false);
    }
  }

  function applySuggestion(s: (typeof SUGGESTIONS)[number]) {
    setText(s.text);
    setEmoji(s.emoji);
  }

  return (
    <div className="max-w-lg space-y-6 pb-8">
      <p className="text-sm text-purple-200">
        L&apos;annonce s&apos;affiche en bandeau sur /wall pendant la durée
        choisie. Les invités hors du mur voient un popup «&nbsp;Nouvelle
        annonce&nbsp;» et peuvent y accéder même s&apos;ils arrivent en retard.
      </p>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => applySuggestion(s)}
            className="cursor-pointer rounded-full bg-white/10 px-3 py-1.5 text-xs text-purple-100 ring-1 ring-white/20 transition-transform active:scale-95 sm:text-sm"
          >
            {s.emoji} {s.text}
          </button>
        ))}
      </div>

      <form onSubmit={handleSend} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-purple-200">Message</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 200))}
            rows={3}
            placeholder="Ex: Le gâteau arrive !"
            className="w-full resize-none rounded-xl bg-white/10 px-4 py-3 text-white ring-1 ring-white/20 placeholder:text-purple-300"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-purple-200">Emoji (optionnel)</span>
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 8))}
            placeholder="🎂"
            className="w-24 rounded-xl bg-white/10 px-4 py-2 text-center text-white ring-1 ring-white/20"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-purple-200">
            Durée d&apos;affichage sur /wall (secondes)
          </span>
          <input
            type="number"
            min={MIN_DURATION_SEC}
            max={MAX_DURATION_SEC}
            value={durationSec}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isNaN(n)) return;
              setDurationSec(
                Math.min(MAX_DURATION_SEC, Math.max(MIN_DURATION_SEC, n))
              );
            }}
            className="w-24 rounded-xl bg-white/10 px-4 py-2 text-center text-white ring-1 ring-white/20"
          />
        </label>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-6 py-3 font-bold text-white shadow transition-transform active:scale-95 disabled:opacity-50"
          >
            {busy ? "Envoi…" : "Envoyer l'annonce"}
          </button>
        </div>
      </form>
    </div>
  );
}
