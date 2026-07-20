"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  Hourglass,
  PartyPopper,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { PollResults } from "@/components/PollResults";
import { QuickNav } from "@/components/QuickNav";
import { useEventConfig } from "@/components/EventThemeProvider";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { buildNavLinks } from "@/lib/quickNavLinks";
import {
  fetchCurrentPoll,
  onPollSocketReconnect,
  subscribePollEvents,
  votePoll,
} from "@/lib/pollService";
import { hasVotedPoll, markPollVoted } from "@/lib/pollVoted";
import { useToast } from "@/components/ToastProvider";
import type { PollSession } from "@/lib/types/poll";

/** Page dédiée sondage live — un seul écran, vote une fois, résultats en direct via WebSocket. */
export default function SondagePage() {
  const pathname = usePathname();
  const { config, accent } = useEventConfig();
  const isAdmin = useIsAdmin();
  const { showToast } = useToast();
  const enabled = config.features.livePolls === true;

  const navLinks = useMemo(
    () => buildNavLinks(pathname, config.features, isAdmin),
    [pathname, config.features, isAdmin]
  );

  const [session, setSession] = useState<PollSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [voted, setVoted] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastQuestionId = useRef<string | null>(null);

  function applySession(s: PollSession | null) {
    setSession(s);
    if (!s) {
      lastQuestionId.current = null;
      setVoted(false);
      return;
    }
    if (s.currentQuestion.id !== lastQuestionId.current) {
      lastQuestionId.current = s.currentQuestion.id;
      setVoted(hasVotedPoll(s.currentQuestion.id));
    }
  }

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchCurrentPoll()
      .then((s) => {
        if (!cancelled) applySession(s);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

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
      cancelled = true;
      unsubscribe();
      unsubscribeReconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  async function handleVote(optionId: string) {
    if (!session || busy) return;
    setBusy(true);
    try {
      const updated = await votePoll(
        session.id,
        session.currentQuestion.id,
        optionId
      );
      markPollVoted(session.currentQuestion.id);
      setVoted(true);
      setSession(updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Vote impossible", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <main className="event-gradient-bg flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-4xl">🗳️</p>
        <h1 className="text-2xl font-bold text-white">
          Sondages non disponibles
        </h1>
        <p className="max-w-sm text-purple-200">
          Cette page n&apos;est pas encore activée.
        </p>
        <Link
          href="/"
          className="rounded-full bg-white/10 px-6 py-3 font-semibold text-white ring-1 ring-white/20"
        >
          ← Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  const phase = session?.phase;
  const isClosed = session?.status === "closed";
  const showResults = phase === "results";
  const showVoting = phase === "voting" && !voted;
  const showWaitingAfterVote = phase === "voting" && voted;
  const isQuiz = session?.mode === "quiz";
  const showLiveResults =
    phase === "voting" && session?.liveResults === true;

  return (
    <main className="event-gradient-bg relative min-h-dvh pb-28">
      {config.features.confetti && <ConfettiBackground accent={accent} />}

      <div className="relative z-10 mx-auto max-w-lg px-4 py-8 sm:py-12">
        <header className="mb-8 text-center">
          <p className="mb-2 text-4xl">🗳️</p>
          <h1 className="text-3xl font-extrabold text-white drop-shadow sm:text-4xl">
            Sondage
          </h1>
          <p className="mt-2 text-sm text-purple-200">{config.eventName}</p>
        </header>

        {loading ? (
          <p className="text-center text-purple-200">Chargement…</p>
        ) : !session ? (
          <div className="rounded-2xl bg-white/5 px-6 py-16 text-center ring-1 ring-white/15">
            <Hourglass
              className="mx-auto mb-4 h-10 w-10 animate-pulse text-purple-300"
              aria-hidden
            />
            <p className="text-lg font-semibold text-white">
              En attente du prochain sondage…
            </p>
            <p className="mt-2 text-sm text-purple-300">
              Reste sur cette page, elle se met à jour toute seule ✨
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-linear-to-b from-purple-950/70 to-purple-900/70 p-5 shadow-2xl ring-1 ring-white/15 sm:p-6">
            {/* Meta : titre quiz + progression */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-pink-300 uppercase">
                <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {isClosed
                  ? "Sondage terminé"
                  : showResults
                    ? "Résultats"
                    : "Vote en cours"}
              </p>
              {isQuiz && (
                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-purple-200 ring-1 ring-white/15">
                  Question {session.currentIndex + 1}/{session.totalQuestions}
                </span>
              )}
            </div>

            {isQuiz && session.title && (
              <p className="mb-1 text-xs font-medium text-purple-300">
                {session.title}
              </p>
            )}

            <h2 className="mb-5 text-xl leading-snug font-bold text-white">
              {session.currentQuestion.question}
            </h2>

            {/* Compteur live de réponses (sans révéler la répartition) */}
            {!showResults && (
              <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-purple-300 ring-1 ring-white/10">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {session.currentQuestionVotes} réponse
                {session.currentQuestionVotes !== 1 ? "s" : ""} pour l&apos;instant
              </p>
            )}

            {showVoting && (
              <div className="flex flex-col gap-2.5">
                {session.currentQuestion.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleVote(opt.id)}
                    disabled={busy}
                    className="cursor-pointer rounded-xl bg-white/10 px-4 py-3.5 text-left font-semibold text-white ring-1 ring-white/20 transition-transform active:scale-[0.98] disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))}
                {showLiveResults && (
                  <div className="mt-2">
                    <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-pink-300 uppercase">
                      <Radio className="h-3 w-3 shrink-0" aria-hidden />
                      En direct
                    </p>
                    <PollResults question={session.currentQuestion} />
                  </div>
                )}
              </div>
            )}

            {showWaitingAfterVote && (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-400/15 px-4 py-4 text-center ring-1 ring-green-400/30">
                  <CheckCircle2
                    className="mx-auto mb-2 h-6 w-6 text-green-300"
                    aria-hidden
                  />
                  <p className="text-sm font-medium text-green-200">
                    Vote enregistré ✓
                  </p>
                  {!showLiveResults && (
                    <p className="mt-1 text-xs text-green-300/80">
                      Les résultats arrivent dans quelques instants…
                    </p>
                  )}
                </div>
                {showLiveResults && (
                  <div>
                    <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-pink-300 uppercase">
                      <Radio className="h-3 w-3 shrink-0" aria-hidden />
                      En direct
                    </p>
                    <PollResults question={session.currentQuestion} />
                  </div>
                )}
              </div>
            )}

            {showResults && (
              <>
                <PollResults
                  question={session.currentQuestion}
                  highlightWinner
                />
                {isClosed ? (
                  <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-center text-sm font-medium text-purple-200 ring-1 ring-white/10">
                    <PartyPopper
                      className="h-4 w-4 shrink-0 text-pink-300"
                      aria-hidden
                    />
                    Merci d&apos;avoir participé !
                  </div>
                ) : (
                  <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-purple-400">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    La prochaine question arrive bientôt…
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <QuickNav links={navLinks} position="bottom-left" />
    </main>
  );
}
