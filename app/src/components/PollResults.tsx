import type { Poll } from "@/lib/types/poll";

interface PollResultsProps {
  poll: Poll;
}

/** Barres de progression des résultats (partagé admin / invités / mur). */
export function PollResults({ poll }: PollResultsProps) {
  const total = poll.options.reduce((sum, o) => sum + o.votes, 0);

  return (
    <div className="space-y-2.5">
      {poll.options.map((opt) => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        return (
          <div key={opt.id}>
            <div className="mb-1 flex justify-between gap-2 text-sm">
              <span className="text-white/90">{opt.label}</span>
              <span className="shrink-0 text-purple-200 tabular-nums">
                {pct}% ({opt.votes})
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-linear-to-r from-pink-500 to-purple-500 transition-all duration-500 ease-out"
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
