import { Router } from "express";
import {
  createSession,
  getActiveSession,
  getDisplaySession,
  voteOnCurrentQuestion,
  revealCurrentQuestion,
  nextQuestion,
  closeSession,
  type PollSessionRow,
  type QuestionInput,
} from "../pollDb";
import { getConfig } from "../configDb";
import { getIo } from "../io";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

/** Vue invité : question courante seulement (pas de spoil des suivantes), votes masqués pendant le vote. */
function toPublicSession(row: PollSessionRow) {
  const q = row.questions[row.currentIndex];
  const revealed = row.phase === "results" || row.liveResults;
  const totalVotes = q.options.reduce((sum, o) => sum + o.votes, 0);

  return {
    id: row.id,
    mode: row.mode,
    title: row.title,
    status: row.status,
    phase: row.phase,
    liveResults: row.liveResults,
    currentIndex: row.currentIndex,
    totalQuestions: row.questions.length,
    currentQuestion: {
      id: q.id,
      question: q.question,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        votes: revealed ? o.votes : 0,
      })),
    },
    currentQuestionVotes: totalVotes,
    createdAt: row.createdAt,
    closedAt: row.closedAt,
  };
}

/** Vue admin : toutes les questions, vrais compteurs en permanence. */
function toAdminSession(row: PollSessionRow) {
  return {
    id: row.id,
    mode: row.mode,
    title: row.title,
    status: row.status,
    phase: row.phase,
    liveResults: row.liveResults,
    currentIndex: row.currentIndex,
    questions: row.questions,
    createdAt: row.createdAt,
    closedAt: row.closedAt,
  };
}

function parseQuestions(input: unknown): QuestionInput[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;

  const questions: QuestionInput[] = [];
  for (const raw of input) {
    if (
      !raw ||
      typeof raw !== "object" ||
      typeof (raw as { question?: unknown }).question !== "string" ||
      !(raw as { question: string }).question.trim()
    ) {
      return null;
    }
    const options = (raw as { options?: unknown }).options;
    if (
      !Array.isArray(options) ||
      options.length < 2 ||
      !options.every((o) => typeof o === "string" && o.trim().length > 0)
    ) {
      return null;
    }
    questions.push({
      question: (raw as { question: string }).question,
      options: options.map((o) => (o as string).trim()),
    });
  }
  return questions;
}

router.get("/active", requireAdmin, (_req, res) => {
  const session = getActiveSession();
  res.json(session ? toAdminSession(session) : null);
});

router.get("/current", (_req, res) => {
  const duration = getConfig().pollResultsDurationMs ?? 60_000;
  const session = getDisplaySession(duration);
  res.json(session ? toPublicSession(session) : null);
});

/** Sondage rapide — une seule question. */
router.post("/quick", requireAdmin, (req, res) => {
  const question: unknown = req.body?.question;
  const options: unknown = req.body?.options;
  const liveResults = req.body?.liveResults === true;

  const questions = parseQuestions([{ question, options }]);
  if (!questions) {
    return res
      .status(400)
      .json({ error: "Question + minimum 2 options requises" });
  }

  const session = createSession("quick", questions, undefined, liveResults);
  const publicSession = toPublicSession(session);
  getIo().emit("poll:new", publicSession);
  res.status(201).json(toAdminSession(session));
});

/** Grand sondage type quiz — plusieurs questions enchaînées. */
router.post("/quiz", requireAdmin, (req, res) => {
  const title: unknown = req.body?.title;
  const questions = parseQuestions(req.body?.questions);
  const liveResults = req.body?.liveResults === true;

  if (!questions) {
    return res.status(400).json({
      error:
        "Au moins une question, chacune avec minimum 2 options, est requise",
    });
  }

  const session = createSession(
    "quiz",
    questions,
    typeof title === "string" ? title : undefined,
    liveResults
  );
  const publicSession = toPublicSession(session);
  getIo().emit("poll:new", publicSession);
  res.status(201).json(toAdminSession(session));
});

router.post("/:id/vote", (req, res) => {
  const { id } = req.params;
  const questionId: unknown = req.body?.questionId;
  const optionId: unknown = req.body?.optionId;

  if (typeof questionId !== "string" || typeof optionId !== "string") {
    return res.status(400).json({ error: "questionId + optionId requis" });
  }

  const updated = voteOnCurrentQuestion(id, questionId, optionId);
  if (!updated) {
    return res.status(409).json({
      error: "Vote impossible (sondage clos, question changée, ou option inconnue)",
    });
  }

  const publicSession = toPublicSession(updated);
  getIo().emit("poll:update", publicSession);
  res.json(publicSession);
});

router.post("/:id/reveal", requireAdmin, (req, res) => {
  const { id } = req.params;
  const revealed = revealCurrentQuestion(id);
  if (!revealed) {
    return res.status(404).json({ error: "Sondage actif introuvable" });
  }

  const publicSession = toPublicSession(revealed);
  getIo().emit("poll:results", publicSession);
  res.json(toAdminSession(revealed));
});

router.post("/:id/next", requireAdmin, (req, res) => {
  const { id } = req.params;
  const advanced = nextQuestion(id);
  if (!advanced) {
    return res
      .status(409)
      .json({ error: "Pas de question suivante ou sondage introuvable" });
  }

  const publicSession = toPublicSession(advanced);
  getIo().emit("poll:new", publicSession);
  res.json(toAdminSession(advanced));
});

router.post("/:id/close", requireAdmin, (req, res) => {
  const { id } = req.params;
  const closed = closeSession(id);
  if (!closed) {
    return res.status(404).json({ error: "Sondage actif introuvable" });
  }

  const publicSession = toPublicSession(closed);
  getIo().emit("poll:closed", publicSession);
  res.json(toAdminSession(closed));
});

export default router;
