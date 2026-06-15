"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEventConfig } from "@/components/EventThemeProvider";
import { PollResults } from "@/components/PollResults";
import {
  fetchDisplayPoll,
  subscribePollEvents,
  votePoll,
} from "@/lib/pollService";
import {
  clearPollMinimized,
  isPollMinimized,
  setPollMinimized,
} from "@/lib/pollMinimized";
import { hasVotedPoll, markPollVoted } from "@/lib/pollVoted";
import type { Poll } from "@/lib/types/poll";
import { useToast } from "@/components/ToastProvider";

export type PollScreenId = "home" | "wall";

interface PollModalProps {
  screen: PollScreenId;
}

function msUntilResultsExpiry(
  poll: Poll,
  durationMs: number
): number | null {
  if (poll.status !== "closed") return null;
  const closedAt = poll.closedAt ?? poll.createdAt;
  return closedAt + durationMs - Date.now();
}

/** Modal sondage repliable — résultats éphémères après clôture. */
export function PollModal({ screen }: PollModalProps) {
  const { config } = useEventConfig();
  const { showToast } = useToast();
  const [poll, setPoll] = useState<Poll | null>(null);
  const [open, setOpen] = useState(false);
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultsCountdown, setResultsCountdown] = useState<number | null>(
    null
  );
  const lastPollId = useRef<string | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enabled =
    config.features.livePolls && (config.pollScreens?.[screen] ?? false);
  const resultsDuration = config.pollResultsDurationMs ?? 60_000;

  const dismissPoll = useCallback(() => {
    setPoll(null);
    setOpen(false);
    setResultsCountdown(null);
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  }, []);

  const scheduleExpiry = useCallback(
    (p: Poll) => {
      if (expiryTimer.current) {
        clearTimeout(expiryTimer.current);
        expiryTimer.current = null;
      }

      const remaining = msUntilResultsExpiry(p, resultsDuration);
      if (remaining === null) return;

      if (remaining <= 0) {
        dismissPoll();
        return;
      }

      setResultsCountdown(Math.ceil(remaining / 1000));
      expiryTimer.current = setTimeout(() => dismissPoll(), remaining);
    },
    [resultsDuration, dismissPoll]
  );

  function applyPoll(p: Poll | null, forceOpen = false) {
    if (!p) {
      dismissPoll();
      return;
    }

    const remaining = msUntilResultsExpiry(p, resultsDuration);
    if (p.status === "closed" && remaining !== null && remaining <= 0) {
      dismissPoll();
      return;
    }

    setPoll(p);
    const hasVoted = hasVotedPoll(p.id);
    setVoted(hasVoted);

    const isNew = p.id !== lastPollId.current;
    const justClosed = p.status === "closed" && forceOpen;

    if (isNew || justClosed) {
      lastPollId.current = p.id;
      clearPollMinimized(p.id);
      setOpen(true);
    } else {
      setOpen(!isPollMinimized(p.id));
    }

    if (p.status === "closed") scheduleExpiry(p);
  }

  useEffect(() => {
    if (!enabled) return;

    fetchDisplayPoll()
      .then((p) => applyPoll(p))
      .catch(console.error);

    return subscribePollEvents({
      onNew: (p) => {
        setResultsCountdown(null);
        applyPoll(p, true);
      },
      onUpdate: (p) => {
        setPoll(p);
        if (hasVotedPoll(p.id)) setVoted(true);
      },
      onClosed: (p) => applyPoll(p, true),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resultsDuration]);

  // Compte à rebours visuel pendant l'affichage des résultats
  useEffect(() => {
    if (resultsCountdown === null || resultsCountdown <= 0) return;
    const tick = setInterval(() => {
      setResultsCountdown((s) => (s !== null && s > 1 ? s - 1 : null));
    }, 1000);
    return () => clearInterval(tick);
  }, [resultsCountdown]);

  // Après vote : réduire automatiquement pour laisser place au reste
  useEffect(() => {
    if (!poll || poll.status !== "active" || !voted || !open) return;
    const t = setTimeout(() => {
      setOpen(false);
      setPollMinimized(poll.id, true);
    }, 2500);
    return () => clearTimeout(t);
  }, [poll, voted, open]);

  useEffect(() => {
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, []);

  if (!enabled || !poll) return null;

  const isActive = poll.status === "active";
  const isClosed = poll.status === "closed";
  const showResults = isClosed;
  const showVoting = isActive && !voted;

  function handleMinimize() {
    setOpen(false);
    setPollMinimized(poll!.id, true);
  }

  function handleOpen() {
    setOpen(true);
    setPollMinimized(poll!.id, false);
  }

  async function handleVote(optionId: string) {
    if (!poll || busy || !isActive) return;
    setBusy(true);
    try {
      await votePoll(poll.id, optionId);
      markPollVoted(poll.id);
      setVoted(true);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Vote impossible",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  const fabLabel = isClosed
    ? "📊 Résultats"
    : voted
      ? "📊 Sondage ✓"
      : "📊 Sondage";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Ouvrir le sondage"
          className={`fixed bottom-6 right-4 z-50 cursor-pointer rounded-full px-4 py-3 text-sm font-bold shadow-2xl active:scale-95 transition-transform ${
            isActive && !voted
              ? "bg-linear-to-r from-pink-500 to-purple-500 text-white animate-pulse"
              : "bg-black/60 text-white ring-1 ring-white/25 backdrop-blur-sm"
          }`}
        >
          {fabLabel}
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Sondage"
          onClick={handleMinimize}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-linear-to-b from-purple-950/95 to-purple-900/95 p-5 shadow-2xl ring-1 ring-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-pink-300">
                  📊{" "}
                  {isClosed
                    ? "Résultats"
                    : voted
                      ? "Vote enregistré"
                      : "Sondage en cours"}
                </p>
                <h2 className="mt-1 text-lg font-bold leading-snug text-white">
                  {poll.question}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleMinimize}
                aria-label="Réduire le sondage"
                className="cursor-pointer shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-sm text-purple-100 ring-1 ring-white/20 active:scale-95 transition-transform"
              >
                ─
              </button>
            </div>

            {showResults && (
              <>
                <PollResults poll={poll} />
                {resultsCountdown !== null && resultsCountdown > 0 && (
                  <p className="mt-3 text-center text-xs text-purple-400">
                    Fermeture dans {resultsCountdown}s…
                  </p>
                )}
              </>
            )}

            {showVoting && (
              <div className="flex flex-col gap-2">
                {poll.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleVote(opt.id)}
                    disabled={busy}
                    className="cursor-pointer rounded-xl bg-white/10 px-4 py-3 text-left font-semibold text-white ring-1 ring-white/20 active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {isActive && voted && !showResults && (
              <p className="rounded-xl bg-green-400/15 px-4 py-3 text-center text-sm font-medium text-green-200 ring-1 ring-green-400/30">
                Merci, ton vote a été enregistré ✓
                <br />
                <span className="text-green-300/80">
                  Les résultats seront révélés à la fin.
                </span>
              </p>
            )}

          </div>
        </div>
      )}
    </>
  );
}
