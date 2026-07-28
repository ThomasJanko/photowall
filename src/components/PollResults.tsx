import type { PollQuestion } from "@/lib/types/poll";

interface PollResultsProps {
  question: PollQuestion;
  /** Met en avant l'option gagnante (résultats définitifs). */
  highlightWinner?: boolean;
}

/** Barres de progression des résultats (partagé admin / page sondage). */
export function PollResults({
  question,
  highlightWinner = false,
}: PollResultsProps) {
  const total = question.options.reduce((sum, o) => sum + o.votes, 0);
  const maxVotes = Math.max(0, ...question.options.map((o) => o.votes));
  const hasWinner = highlightWinner && total > 0;

  return (
    <div className="space-y-2.5">
      {question.options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        const isWinner = hasWinner && opt.votes === maxVotes && maxVotes > 0;
        return (
          <div
            key={opt.id}
            className={
              isWinner
                ? "podium-reveal-flash rounded-xl bg-white/5 p-1.5 ring-1 ring-yellow-300/40"
                : ""
            }
          >
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="flex items-center gap-1 text-white/90">
                {isWinner && <span aria-hidden>👑</span>}
                {opt.label}
              </span>
              <span className="shrink-0 text-purple-200 tabular-nums">
                {pct}% ({opt.votes})
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isWinner
                    ? "bg-linear-to-r from-yellow-400 to-pink-500"
                    : "bg-linear-to-r from-pink-500 to-purple-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-right text-xs text-purple-400">
        {total} vote{total !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
