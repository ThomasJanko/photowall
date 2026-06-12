"use client";

import { useState } from "react";
import { sendAnnouncement } from "@/lib/announcementApi";

const SUGGESTIONS = [
  { text: "Le gâteau arrive !", emoji: "🎂" },
  { text: "Photo de groupe dans 5 min !", emoji: "📸" },
  { text: "Bravo à la star de la soirée !", emoji: "🌟" },
  { text: "On passe à la piste de danse !", emoji: "💃" },
] as const;

interface AdminAnnounceTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

export function AdminAnnounceTab({ onUnauthorized }: AdminAnnounceTabProps) {
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setBusy(true);
    setSent(false);
    try {
      await sendAnnouncement({
        text: trimmed,
        emoji: emoji.trim() || undefined,
      });
      setSent(true);
      setText("");
      setEmoji("");
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      if (onUnauthorized(err)) return;
      alert(err instanceof Error ? err.message : "Envoi échoué");
    } finally {
      setBusy(false);
    }
  }

  function applySuggestion(s: (typeof SUGGESTIONS)[number]) {
    setText(s.text);
    setEmoji(s.emoji);
    setSent(false);
  }

  return (
    <div className="max-w-lg space-y-6 pb-8">
      <p className="text-sm text-purple-200">
        L&apos;annonce s&apos;affiche en bandeau sur /wall pendant ~8 secondes,
        en temps réel pour tous les invités connectés.
      </p>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => applySuggestion(s)}
            className="cursor-pointer rounded-full bg-white/10 px-3 py-1.5 text-xs sm:text-sm text-purple-100 ring-1 ring-white/20 active:scale-95 transition-transform"
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
            className="w-full resize-none rounded-xl bg-white/10 px-4 py-3 text-white placeholder:text-purple-300 ring-1 ring-white/20"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-purple-200">Emoji (optionnel)</span>
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 8))}
            placeholder="🎂"
            className="w-24 rounded-xl bg-white/10 px-4 py-2 text-white text-center ring-1 ring-white/20"
          />
        </label>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-6 py-3 font-bold text-white shadow disabled:opacity-50 active:scale-95 transition-transform"
          >
            {busy ? "Envoi…" : "Envoyer l'annonce"}
          </button>
          {sent && (
            <span className="text-sm text-green-300 font-medium">
              ✓ Annonce envoyée
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
