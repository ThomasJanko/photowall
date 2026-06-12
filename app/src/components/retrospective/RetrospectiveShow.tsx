"use client";

import Link from "next/link";
import type { Photo } from "@/lib/types";
import type { RetrospectiveStats } from "@/lib/retrospectiveStats";
import type { Scene } from "@/lib/retrospectiveScenes";
import { useShowTimeline } from "./useShowTimeline";
import {
  IntroScene,
  StarReactionScene,
  Top3Scene,
  FirstLastScene,
  RhythmScene,
  ChallengeMostAttemptedScene,
  ChallengeMostSuccessfulScene,
  ChallengeMostFailedScene,
  ChallengeLeaderboardScene,
  SlideshowScene,
  ClosingScene,
} from "./RetrospectiveScenes";

interface RetrospectiveShowProps {
  scenes: Scene[];
  stats: RetrospectiveStats;
  photos: Photo[];
  eventTitle: string;
  closingMessage: string;
  active: boolean;
}

export function RetrospectiveShow({
  scenes,
  stats,
  photos,
  eventTitle,
  closingMessage,
  active,
}: RetrospectiveShowProps) {
  const {
    currentScene,
    paused,
    visible,
    finished,
    togglePause,
    skipScene,
  } = useShowTimeline({ scenes, active });

  const sceneProps = {
    stats,
    photos,
    eventTitle,
    closingMessage,
    paused,
  };

  function renderScene() {
    if (!currentScene) return null;

    switch (currentScene.type) {
      case "intro":
        return <IntroScene {...sceneProps} />;
      case "starReaction":
        return <StarReactionScene {...sceneProps} />;
      case "top3":
        return <Top3Scene {...sceneProps} />;
      case "firstLast":
        return <FirstLastScene {...sceneProps} />;
      case "rhythm":
        return <RhythmScene {...sceneProps} />;
      case "challengeMostAttempted":
        return <ChallengeMostAttemptedScene {...sceneProps} />;
      case "challengeMostSuccessful":
        return <ChallengeMostSuccessfulScene {...sceneProps} />;
      case "challengeMostFailed":
        return <ChallengeMostFailedScene {...sceneProps} />;
      case "challengeLeaderboard":
        return <ChallengeLeaderboardScene {...sceneProps} />;
      case "slideshow":
        return <SlideshowScene {...sceneProps} />;
      case "closing":
        return <ClosingScene {...sceneProps} />;
      default:
        return null;
    }
  }

  const isSlideshow = currentScene?.type === "slideshow";

  return (
    <div className="relative min-h-dvh w-full bg-black overflow-hidden">
      <div
        className={`relative min-h-dvh w-full transition-opacity duration-500 ${
          visible ? "opacity-100" : "opacity-0"
        } ${isSlideshow ? "" : "flex items-center justify-center event-gradient-bg"}`}
      >
        {renderScene()}
      </div>

      {!finished && (
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? "Reprendre" : "Pause"}
            className="cursor-pointer rounded-full bg-black/50 px-4 py-2 text-sm text-white/80 ring-1 ring-white/20 backdrop-blur-sm hover:text-white active:scale-95 transition-transform"
          >
            {paused ? "▶" : "⏸"}
          </button>
          <button
            type="button"
            onClick={skipScene}
            aria-label="Scène suivante"
            className="cursor-pointer rounded-full bg-black/50 px-4 py-2 text-sm text-white/80 ring-1 ring-white/20 backdrop-blur-sm hover:text-white active:scale-95 transition-transform"
          >
            ⏭
          </button>
          <Link
            href="/wall"
            className="rounded-full bg-black/50 px-4 py-2 text-sm text-white/80 ring-1 ring-white/20 backdrop-blur-sm hover:text-white active:scale-95 transition-transform"
          >
            Quitter
          </Link>
        </div>
      )}

      {finished && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/90">
          <p className="text-3xl sm:text-5xl font-bold text-white">Merci pour cette soirée ✨</p>
          <Link
            href="/wall"
            className="rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-8 py-4 text-lg font-bold text-white shadow-xl active:scale-95 transition-transform"
          >
            Retour au mur
          </Link>
        </div>
      )}
    </div>
  );
}
