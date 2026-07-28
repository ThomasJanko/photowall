"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QuickNav } from "@/components/QuickNav";
import { useEventConfig } from "@/components/EventThemeProvider";
import { buildNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { usePathname } from "next/navigation";
import { fetchLeaderboard, type LeaderboardEntry } from "@/lib/leaderboardApi";
import { getPhotoService } from "@/lib/photoService";
import { useToast } from "@/components/ToastProvider";
import { Camera } from "lucide-react";

function PlayerPodium({
  entry,
  rank,
  size,
}: {
  entry: LeaderboardEntry | undefined;
  rank: 1 | 2 | 3;
  size: "lg" | "sm";
}) {
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;
  const heights = { lg: "h-28 sm:h-36", sm: "h-20 sm:h-28" };
  const widths = { lg: "w-36 sm:w-44", sm: "w-28 sm:w-36" };

  if (!entry) {
    return <div className={`${widths[size]} opacity-0`} aria-hidden />;
  }

  return (
    <div
      className={`podium-reveal flex flex-col items-center gap-2 ${widths[size]}`}
      style={{
        animationDelay: rank === 1 ? "0.2s" : rank === 2 ? "0.45s" : "0.6s",
      }}
    >
      <span className="text-3xl sm:text-4xl">{medals[rank]}</span>
      <div
        className={`flex w-full flex-col items-center justify-end rounded-t-2xl bg-linear-to-t from-pink-600/80 to-purple-500/60 shadow-xl ring-2 ring-white/25 ${heights[size]} px-3 pt-4 pb-3`}
      >
        <p className="w-full truncate text-center text-sm font-bold text-white sm:text-base">
          {entry.pseudo}
        </p>
        <p className="text-2xl font-black text-amber-300 tabular-nums sm:text-3xl">
          {entry.points}
        </p>
        <p className="text-[10px] text-purple-200 sm:text-xs">
          pt{entry.points !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

export default function ClassementPage() {
  const pathname = usePathname();
  const { config } = useEventConfig();
  const isAdmin = useIsAdmin();
  const navLinks = useMemo(
    () => buildNavLinks(pathname, config.features, isAdmin),
    [pathname, config.features, isAdmin]
  );
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const toastShownRef = useRef(false);

  const enabled = config.features.leaderboard === true;

  useEffect(() => {
    if (!enabled) return;

    function refresh() {
      fetchLeaderboard()
        .then((list) => {
          setEntries(list);
          toastShownRef.current = false;
        })
        .catch((err) => {
          console.error(err);
          if (!toastShownRef.current) {
            showToast("Impossible de charger le classement", "error");
            toastShownRef.current = true;
          }
        })
        .finally(() => setLoading(false));
    }

    refresh();
    const interval = setInterval(refresh, 12_000);
    const unsub = getPhotoService().onChallengeVote?.(() => refresh());

    return () => {
      clearInterval(interval);
      unsub?.();
    };
  }, [enabled, showToast]);

  if (!enabled) {
    return (
      <main className="event-gradient-bg flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-2xl font-bold text-white">
          Classement non disponible
        </p>
        <Link
          href="/"
          className="rounded-full bg-white/10 px-6 py-3 text-purple-100 ring-1 ring-white/20"
        >
          ← Retour
        </Link>
        <QuickNav links={navLinks} position="bottom-left" />
      </main>
    );
  }

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(0, 10);

  return (
    <main className="event-gradient-bg min-h-dvh p-6 pb-24">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl">
            🏆 Classement des défis
          </h1>
          <p className="text-sm text-purple-200">
            +1 point par défi réussi (plus de votes ✅ que ❌)
          </p>
        </header>

        {loading && <p className="text-center text-purple-300">Chargement…</p>}

        {!loading && entries.length === 0 && (
          <p className="text-center text-purple-300">
            Pas encore de scores — relève un défi et fais voter la salle !
          </p>
        )}

        {top3.length >= 2 && (
          <div className="flex items-end justify-center gap-3 sm:gap-6">
            <PlayerPodium entry={top3[1]} rank={2} size="sm" />
            <PlayerPodium entry={top3[0]} rank={1} size="lg" />
            <PlayerPodium entry={top3[2]} rank={3} size="sm" />
          </div>
        )}

        {top3.length === 1 && top3[0] && (
          <div className="flex justify-center">
            <PlayerPodium entry={top3[0]} rank={1} size="lg" />
          </div>
        )}

        {rest.length > 0 && (
          <ol className="space-y-2">
            {rest.map((entry, i) => (
              <li
                key={entry.pseudo}
                className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 text-center font-bold text-purple-300 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-white">
                    {entry.pseudo}
                  </span>
                </span>
                <span className="font-bold text-amber-300 tabular-nums">
                  {entry.points} pt{entry.points !== 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-purple-300 underline-offset-4 hover:text-purple-200 hover:underline"
          >
            <Camera className="h-4 w-4 shrink-0" aria-hidden />
            Relever un défi
          </Link>
        </div>
      </div>

      <QuickNav links={navLinks} position="bottom-left" />
    </main>
  );
}
