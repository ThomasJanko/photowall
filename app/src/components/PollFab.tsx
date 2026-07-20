"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { useEventConfig } from "@/components/EventThemeProvider";
import {
  fetchCurrentPoll,
  onPollSocketReconnect,
  subscribePollEvents,
} from "@/lib/pollService";
import { hasVotedPoll } from "@/lib/pollVoted";
import type { PollSession } from "@/lib/types/poll";

function msUntilExpiry(session: PollSession, durationMs: number): number | null {
  if (session.status !== "closed") return null;
  const closedAt = session.closedAt ?? session.createdAt;
  return closedAt + durationMs - Date.now();
}

/** Pastille flottante discrète — pointe vers /sondage, ne duplique plus le vote inline. */
export function PollFab() {
  const { config } = useEventConfig();
  const [session, setSession] = useState<PollSession | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = config.features.livePolls === true;
  const resultsDuration = config.pollResultsDurationMs ?? 60_000;

  const dismiss = useCallback(() => {
    setSession(null);
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
  }, []);

  const applySession = useCallback(
    (s: PollSession | null) => {
      if (expiryTimer.current) {
        clearTimeout(expiryTimer.current);
        expiryTimer.current = null;
      }
      if (!s) {
        setSession(null);
        return;
      }

      const remaining = msUntilExpiry(s, resultsDuration);
      if (remaining !== null && remaining <= 0) {
        setSession(null);
        return;
      }

      setSession(s);
      if (remaining !== null) {
        expiryTimer.current = setTimeout(dismiss, remaining);
      }
    },
    [resultsDuration, dismiss]
  );

  useEffect(() => {
    if (!enabled) return;

    fetchCurrentPoll().then(applySession).catch(console.error);

    const unsubscribe = subscribePollEvents({
      onNew: applySession,
      onUpdate: applySession,
      onResults: applySession,
      onClosed: applySession,
    });
    const unsubscribeReconnect = onPollSocketReconnect(() => {
      fetchCurrentPoll().then(applySession).catch(console.error);
    });

    return () => {
      unsubscribe();
      unsubscribeReconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, []);

  if (!enabled || !session) return null;

  const needsVote =
    session.phase === "voting" && !hasVotedPoll(session.currentQuestion.id);
  const label = needsVote
    ? "Sondage en cours"
    : session.phase === "results"
      ? "Résultats"
      : "Sondage ✓";

  return (
    <Link
      href="/sondage"
      aria-label="Ouvrir le sondage"
      className={`fixed right-4 bottom-6 z-50 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-2xl transition-transform active:scale-95 ${
        needsVote
          ? "animate-pulse bg-linear-to-r from-pink-500 to-purple-500 text-white"
          : "bg-black/60 text-white ring-1 ring-white/25 backdrop-blur-sm"
      }`}
    >
      <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
