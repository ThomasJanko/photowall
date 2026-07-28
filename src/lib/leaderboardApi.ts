const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

export interface LeaderboardEntry {
  pseudo: string;
  points: number;
  challengesWon: number;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${SERVER_URL}/api/leaderboard`);
  if (!res.ok) throw new Error(`Classement indisponible (${res.status})`);
  return res.json();
}
