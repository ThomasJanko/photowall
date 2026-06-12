export type PollStatus = "draft" | "active" | "closed";

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  status: PollStatus;
  createdAt: number;
  closedAt?: number;
}
