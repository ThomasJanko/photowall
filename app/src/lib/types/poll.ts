/**
 * Modèle des sondages live.
 *
 * Un sondage ("session") peut être :
 * - "quick"  : une seule question, flux simple lancer → voter → clôturer
 *   (révèle et clôture en une seule action, comme avant).
 * - "quiz"   : plusieurs questions enchaînées par l'admin façon Kahoot
 *   (lancer → voter → révéler → question suivante → ... → terminer).
 */

export type PollMode = "quick" | "quiz";
export type PollSessionStatus = "active" | "closed";
/** Phase de la question courante : en cours de vote, ou résultats révélés. */
export type QuestionPhase = "voting" | "results";

export interface PollOption {
  id: string;
  label: string;
  /** Nombre de votes. Masqué (0) côté invité tant que phase === "voting". */
  votes: number;
}

export interface PollQuestion {
  id: string;
  question: string;
  options: PollOption[];
}

/** Sondage tel que vu par les invités (question courante uniquement — pas de spoil). */
export interface PollSession {
  id: string;
  mode: PollMode;
  title?: string;
  status: PollSessionStatus;
  phase: QuestionPhase;
  /** Si true, les % sont visibles pendant le vote (pas seulement après révélation). */
  liveResults: boolean;
  currentIndex: number;
  totalQuestions: number;
  currentQuestion: PollQuestion;
  /** Somme des votes de la question courante, visible même pendant le vote. */
  currentQuestionVotes: number;
  createdAt: number;
  closedAt?: number;
}

/** Sondage complet tel que vu par l'admin (toutes les questions, vrais compteurs). */
export interface AdminPollSession {
  id: string;
  mode: PollMode;
  title?: string;
  status: PollSessionStatus;
  phase: QuestionPhase;
  liveResults: boolean;
  currentIndex: number;
  questions: PollQuestion[];
  createdAt: number;
  closedAt?: number;
}

export interface PollQuestionInput {
  question: string;
  options: string[];
}
