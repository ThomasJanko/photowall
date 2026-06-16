"use client";

import type { Challenge } from "@/config/event";
import { Camera, Target } from "lucide-react";

interface ChallengePickerProps {
  challenges: readonly Challenge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  completedIds: string[];
}

/** Liste de défis sélectionnables (chips) sur la page d'upload. */
export function ChallengePicker({
  challenges,
  selectedId,
  onSelect,
  completedIds,
}: ChallengePickerProps) {
  if (challenges.length === 0) return null;

  const completedCount = completedIds.length;

  return (
    <section className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-purple-200">
          <Target className="h-4 w-4 shrink-0" aria-hidden />
          Défis photo
        </h2>
        <p className="text-xs text-purple-400 tabular-nums">
          {completedCount}/{challenges.length} relevé
          {completedCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex max-h-[250px] scrollbar-none flex-wrap gap-2 overflow-y-auto overscroll-contain py-2 pl-2">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-left text-xs font-medium ring-1 transition-colors active:scale-95 sm:text-sm ${
            selectedId === null
              ? "bg-pink-500/30 text-white ring-pink-300/60"
              : "bg-white/10 text-purple-100 ring-white/20"
          }`}
        >
          <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Photo libre
        </button>

        {challenges.map((c) => {
          const done = completedIds.includes(c.id);
          const selected = selectedId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`cursor-pointer rounded-full px-3 py-2 text-left text-xs font-medium ring-1 transition-colors active:scale-95 sm:text-sm ${
                selected
                  ? "bg-pink-500/30 text-white ring-pink-300/60"
                  : done
                    ? "bg-green-500/15 text-green-100 ring-green-400/30"
                    : "bg-white/10 text-purple-100 ring-white/20"
              }`}
            >
              {done && <span className="mr-1">✅</span>}
              {c.emoji && <span className="mr-1">{c.emoji}</span>}
              {c.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
