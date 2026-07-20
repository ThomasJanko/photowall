"use client";

import { useCallback, useEffect, useState } from "react";
import { PollResults } from "@/components/PollResults";
import { useEventConfig } from "@/components/EventThemeProvider";
import {
  closePollApi,
  createQuickPoll,
  createQuizPoll,
  fetchActivePollAdmin,
  nextQuestionApi,
  revealResults,
  subscribePollEvents,
} from "@/lib/pollService";
import { updateEventConfigApi } from "@/lib/eventConfigApi";
import type { AdminPollSession } from "@/lib/types/poll";
import {
  ArrowRight,
  CheckCircle2,
  Gamepad2,
  Plus,
  Radio,
  RotateCcw,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { deferCallback } from "@/lib/deferCallback";

interface AdminPollTabProps {
  onUnauthorized: (err: unknown) => boolean;
}

interface QuizQuestionDraft {
  question: string;
  options: string[];
}

function emptyQuestion(): QuizQuestionDraft {
  return { question: "", options: ["", ""] };
}

export function AdminPollTab({ onUnauthorized }: AdminPollTabProps) {
  const { config, refreshConfig } = useEventConfig();
  const [builderMode, setBuilderMode] = useState<"quick" | "quiz">("quick");

  // Sondage rapide
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  // Grand sondage (quiz)
  const [quizTitle, setQuizTitle] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionDraft[]>([
    emptyQuestion(),
  ]);

  // Partagé quick + quiz : afficher les % en direct pendant le vote
  const [liveResults, setLiveResults] = useState(false);

  const [resultsSeconds, setResultsSeconds] = useState(
    Math.round((config.pollResultsDurationMs ?? 60_000) / 1000)
  );
  const [session, setSession] = useState<AdminPollSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    deferCallback(() => {
      setResultsSeconds(
        Math.round((config.pollResultsDurationMs ?? 60_000) / 1000)
      );
    });
  }, [config.pollResultsDurationMs]);

  const refresh = useCallback(() => {
    fetchActivePollAdmin()
      .then(setSession)
      .catch((err) => {
        if (onUnauthorized(err)) return;
        console.error(err);
      });
  }, [onUnauthorized]);

  useEffect(() => {
    refresh();
    return subscribePollEvents({
      onNew: refresh,
      onUpdate: refresh,
      onResults: refresh,
      onClosed: refresh,
    });
  }, [refresh]);

  async function handleResultsDurationChange(seconds: number) {
    const clamped = Math.max(10, Math.min(300, seconds));
    setResultsSeconds(clamped);
    try {
      await updateEventConfigApi({ pollResultsDurationMs: clamped * 1000 });
      await refreshConfig();
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    }
  }

  // ── Sondage rapide ──────────────────────────────────────────────────────

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

  async function handleLaunchQuick(e: React.FormEvent) {
    e.preventDefault();
    const trimmedQ = question.trim();
    const trimmedOpts = options.map((o) => o.trim()).filter(Boolean);

    if (!trimmedQ || trimmedOpts.length < 2) {
      setFeedback("Question + minimum 2 options requises");
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const s = await createQuickPoll(trimmedQ, trimmedOpts, liveResults);
      setSession(s);
      setQuestion("");
      setOptions(["", ""]);
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  // ── Grand sondage (quiz) ────────────────────────────────────────────────

  function updateQuizQuestion(index: number, value: string) {
    setQuizQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, question: value } : q))
    );
  }

  function updateQuizOption(qIndex: number, oIndex: number, value: string) {
    setQuizQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) }
          : q
      )
    );
  }

  function addQuizOption(qIndex: number) {
    setQuizQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, options: [...q.options, ""] } : q))
    );
  }

  function removeQuizOption(qIndex: number, oIndex: number) {
    setQuizQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex && q.options.length > 2
          ? { ...q, options: q.options.filter((_, j) => j !== oIndex) }
          : q
      )
    );
  }

  function addQuizQuestion() {
    setQuizQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuizQuestion(index: number) {
    setQuizQuestions((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== index) : prev
    );
  }

  function resetQuizBuilder() {
    setQuizTitle("");
    setQuizQuestions([emptyQuestion()]);
  }

  const canLaunchQuiz = quizQuestions.every(
    (q) =>
      q.question.trim().length > 0 &&
      q.options.filter((o) => o.trim()).length >= 2
  );

  async function handleLaunchQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!canLaunchQuiz) {
      setFeedback("Chaque question a besoin d'un texte + minimum 2 options");
      return;
    }

    const payload = quizQuestions.map((q) => ({
      question: q.question.trim(),
      options: q.options.map((o) => o.trim()).filter(Boolean),
    }));

    setBusy(true);
    setFeedback(null);
    try {
      const s = await createQuizPoll(
        payload,
        quizTitle.trim() || undefined,
        liveResults
      );
      setSession(s);
      resetQuizBuilder();
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  // ── Contrôle du sondage actif ───────────────────────────────────────────

  async function handleReveal() {
    if (!session) return;
    setBusy(true);
    setFeedback(null);
    try {
      setSession(await revealResults(session.id));
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleNext() {
    if (!session) return;
    setBusy(true);
    setFeedback(null);
    try {
      setSession(await nextQuestionApi(session.id));
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(confirmMessage?: string) {
    if (!session) return;
    if (confirmMessage && !confirm(confirmMessage)) return;
    setBusy(true);
    setFeedback(null);
    try {
      setSession(await closePollApi(session.id));
    } catch (err) {
      if (onUnauthorized(err)) return;
      setFeedback(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const canLaunchQuick =
    !busy &&
    question.trim().length > 0 &&
    options.filter((o) => o.trim()).length >= 2;

  const isQuiz = session?.mode === "quiz";
  const isLastQuestion =
    !!session && session.currentIndex + 1 >= session.questions.length;

  return (
    <div className="max-w-lg space-y-6 pb-8">
      <p className="text-sm text-purple-200">
        Sondage rapide (1 question) ou grand sondage type Kahoot (plusieurs
        questions enchaînées). Les invités votent une fois par question ; les
        résultats ne s&apos;affichent qu&apos;après révélation.
      </p>

      <fieldset className="space-y-2 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
        <legend className="px-1 text-sm font-semibold text-purple-200">
          Affichage des résultats
        </legend>
        <label className="flex flex-wrap items-center gap-2 text-sm text-white">
          <span className="text-purple-200">
            Durée d&apos;affichage après clôture
          </span>
          <input
            type="number"
            min={10}
            max={300}
            value={resultsSeconds}
            onChange={(e) => setResultsSeconds(Number(e.target.value) || 60)}
            onBlur={() => handleResultsDurationChange(resultsSeconds)}
            className="w-20 rounded-lg bg-white/10 px-2 py-1 text-center ring-1 ring-white/20 focus:ring-pink-400 focus:outline-none"
          />
          <span className="text-purple-300">secondes</span>
        </label>
      </fieldset>

      {session ? (
        <div className="space-y-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p
                className={`flex flex-wrap items-center gap-2 text-xs font-semibold ${
                  session.status === "active" ? "text-green-300" : "text-purple-300"
                }`}
              >
                <span>
                  {session.status === "active" ? "● Sondage actif" : "Sondage terminé"}
                  {isQuiz && " · Kahoot"}
                </span>
                {session.liveResults && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold text-pink-200 ring-1 ring-pink-400/30">
                    <Radio className="h-3 w-3 shrink-0" aria-hidden />
                    EN DIRECT
                  </span>
                )}
              </p>
              {isQuiz && session.title && (
                <p className="mt-1 text-xs text-purple-300">{session.title}</p>
              )}
              {isQuiz && (
                <p className="mt-0.5 text-xs text-purple-400">
                  Question {session.currentIndex + 1}/{session.questions.length}
                </p>
              )}
              <h3 className="mt-1 text-lg font-bold text-white">
                {session.questions[session.currentIndex].question}
              </h3>
              <p className="mt-1 text-xs text-purple-400">
                {session.phase === "results"
                  ? "Résultats révélés aux invités"
                  : session.liveResults
                    ? "Vote en cours — % visibles en direct pour les invités"
                    : "Vote en cours — résultats masqués pour les invités"}
              </p>
            </div>
          </div>

          <PollResults
            question={session.questions[session.currentIndex]}
            highlightWinner={session.phase === "results"}
          />

          {session.status === "active" ? (
            <div className="flex flex-wrap gap-2">
              {isQuiz && session.phase === "voting" && (
                <button
                  type="button"
                  onClick={handleReveal}
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Révéler les résultats
                </button>
              )}

              {isQuiz && session.phase === "results" && !isLastQuestion && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  Question suivante
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </button>
              )}

              {isQuiz && session.phase === "results" && isLastQuestion && (
                <button
                  type="button"
                  onClick={() => handleClose()}
                  disabled={busy}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                  Terminer le sondage
                </button>
              )}

              {!isQuiz && session.phase === "voting" && (
                <button
                  type="button"
                  onClick={() =>
                    handleClose("Clôturer et révéler les résultats maintenant ?")
                  }
                  disabled={busy}
                  className="cursor-pointer rounded-full bg-red-600/90 px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  Clôturer et révéler
                </button>
              )}

              {isQuiz && !(session.phase === "results" && isLastQuestion) && (
                <button
                  type="button"
                  onClick={() =>
                    handleClose(
                      "Arrêter le sondage maintenant ? Les invités verront les derniers résultats affichés."
                    )
                  }
                  disabled={busy}
                  className="cursor-pointer rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-purple-200 ring-1 ring-white/20 transition-transform active:scale-95 disabled:opacity-50"
                >
                  Arrêter maintenant
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSession(null)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-transform active:scale-95"
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
              Lancer un nouveau sondage
            </button>
          )}

          <p className="text-xs text-purple-400">
            Aperçu admin uniquement — les invités ne voient les chiffres
            qu&apos;après révélation.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setBuilderMode("quick")}
              className={`cursor-pointer rounded-2xl p-4 text-left ring-1 transition-colors ${
                builderMode === "quick"
                  ? "bg-linear-to-br from-pink-500/25 to-purple-500/25 ring-pink-400/50"
                  : "bg-white/5 ring-white/10 hover:bg-white/10"
              }`}
            >
              <Zap className="mb-1.5 h-5 w-5 shrink-0 text-pink-300" aria-hidden />
              <p className="text-sm font-bold text-white">Sondage rapide</p>
              <p className="mt-0.5 text-xs text-purple-300">
                1 question, résultat immédiat
              </p>
            </button>
            <button
              type="button"
              onClick={() => setBuilderMode("quiz")}
              className={`cursor-pointer rounded-2xl p-4 text-left ring-1 transition-colors ${
                builderMode === "quiz"
                  ? "bg-linear-to-br from-pink-500/25 to-purple-500/25 ring-pink-400/50"
                  : "bg-white/5 ring-white/10 hover:bg-white/10"
              }`}
            >
              <Gamepad2
                className="mb-1.5 h-5 w-5 shrink-0 text-pink-300"
                aria-hidden
              />
              <p className="text-sm font-bold text-white">Grand sondage</p>
              <p className="mt-0.5 text-xs text-purple-300">
                Plusieurs questions, façon Kahoot
              </p>
            </button>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <input
              type="checkbox"
              checked={liveResults}
              onChange={(e) => setLiveResults(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-pink-500"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <Radio className="h-4 w-4 shrink-0 text-pink-300" aria-hidden />
                Résultats en direct
              </span>
              <span className="mt-0.5 block text-xs text-purple-300">
                Les invités voient les % évoluer pendant le vote, sans
                attendre la révélation. Désactivé = suspense classique.
              </span>
            </span>
          </label>

          {builderMode === "quick" ? (
            <form onSubmit={handleLaunchQuick} className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm text-purple-200">Question</span>
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
                  placeholder="Ex: Quelle chanson pour ouvrir le bal ?"
                  className="w-full rounded-xl bg-white/10 px-4 py-3 text-white ring-1 ring-white/20 placeholder:text-purple-400 focus:ring-pink-400 focus:outline-none"
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
                      className="min-w-0 flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-white ring-1 ring-white/20 placeholder:text-purple-400 focus:ring-pink-400 focus:outline-none"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="shrink-0 cursor-pointer rounded-lg bg-white/10 px-3 text-purple-200 ring-1 ring-white/20 transition-transform active:scale-95"
                        aria-label="Supprimer l'option"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-purple-300 underline underline-offset-2"
                >
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  Ajouter une option
                </button>
              </fieldset>

              <button
                type="submit"
                disabled={!canLaunchQuick}
                className="cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-6 py-3 font-bold text-white shadow transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Lancement…" : "Lancer le sondage"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLaunchQuiz} className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm text-purple-200">
                  Titre du sondage (optionnel)
                </span>
                <input
                  type="text"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value.slice(0, 100))}
                  placeholder="Ex: Culture générale sur la star du soir"
                  className="w-full rounded-xl bg-white/10 px-4 py-3 text-white ring-1 ring-white/20 placeholder:text-purple-400 focus:ring-pink-400 focus:outline-none"
                />
              </label>

              <div className="space-y-4">
                {quizQuestions.map((q, qIndex) => (
                  <div
                    key={qIndex}
                    className="space-y-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-purple-300">
                        Question {qIndex + 1}
                      </span>
                      {quizQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuizQuestion(qIndex)}
                          className="shrink-0 cursor-pointer rounded-lg bg-white/10 p-1.5 text-purple-200 ring-1 ring-white/20 transition-transform active:scale-95"
                          aria-label="Supprimer la question"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={q.question}
                      onChange={(e) =>
                        updateQuizQuestion(qIndex, e.target.value.slice(0, 200))
                      }
                      placeholder="Intitulé de la question"
                      className="w-full rounded-xl bg-white/10 px-4 py-2.5 text-white ring-1 ring-white/20 placeholder:text-purple-400 focus:ring-pink-400 focus:outline-none"
                    />

                    <div className="space-y-2">
                      {q.options.map((opt, oIndex) => (
                        <div key={oIndex} className="flex gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) =>
                              updateQuizOption(
                                qIndex,
                                oIndex,
                                e.target.value.slice(0, 100)
                              )
                            }
                            placeholder={`Option ${oIndex + 1}`}
                            className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm text-white ring-1 ring-white/20 placeholder:text-purple-400 focus:ring-pink-400 focus:outline-none"
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeQuizOption(qIndex, oIndex)}
                              className="shrink-0 cursor-pointer rounded-lg bg-white/10 px-2.5 text-purple-200 ring-1 ring-white/20 transition-transform active:scale-95"
                              aria-label="Supprimer l'option"
                            >
                              <X className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addQuizOption(qIndex)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs text-purple-300 underline underline-offset-2"
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Option
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addQuizQuestion}
                className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-purple-300 underline underline-offset-2"
              >
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Ajouter une question
              </button>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={!canLaunchQuiz || busy}
                  className="cursor-pointer rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-6 py-3 font-bold text-white shadow transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy
                    ? "Lancement…"
                    : `Lancer le grand sondage (${quizQuestions.length} question${
                        quizQuestions.length > 1 ? "s" : ""
                      })`}
                </button>
                <button
                  type="button"
                  onClick={resetQuizBuilder}
                  className="cursor-pointer rounded-full bg-white/10 px-4 py-3 text-sm font-semibold text-purple-200 ring-1 ring-white/20 transition-transform active:scale-95"
                >
                  Réinitialiser
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {feedback && <p className="text-sm text-purple-200">{feedback}</p>}
    </div>
  );
}
