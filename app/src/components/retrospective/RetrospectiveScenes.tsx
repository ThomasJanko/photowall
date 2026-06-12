"use client";

import { useEffect, useState } from "react";
import type { Photo } from "@/lib/types";
import type { RetrospectiveStats } from "@/lib/retrospectiveStats";
import {
  formatPhotoTime,
  photoReactionTotal,
} from "@/lib/retrospectiveStats";
import { CountUp } from "./CountUp";
import { SLIDESHOW_INTERVAL_MS } from "@/lib/retrospectiveScenes";

// Pluie d'emoji déterministe (pas de Math.random)
const EMOJI_RAIN_PIECES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 29 + 5) % 100,
  delay: -(((i * 19) % 40) / 10),
  duration: 2.5 + ((i * 13) % 20) / 10,
  size: 1.2 + ((i * 7) % 10) / 10,
  drift: ((i % 5) - 2) * 12,
}));

const CLOSING_BURST_PIECES = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37 + 3) % 100,
  delay: -(((i * 11) % 30) / 10),
  duration: 2 + ((i * 17) % 25) / 10,
  size: 8 + ((i * 9) % 10),
  color: ["#facc15", "#f472b6", "#c084fc", "#34d399", "#60a5fa", "#fb923c"][
    i % 6
  ],
  round: i % 3 === 0,
}));

interface SceneProps {
  stats: RetrospectiveStats;
  photos: Photo[];
  eventTitle: string;
  closingMessage: string;
  paused?: boolean;
}

export function IntroScene({ stats, eventTitle }: SceneProps) {
  return (
    <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-8 px-6 text-center">
      <p className="text-2xl sm:text-4xl md:text-5xl font-bold text-pink-300 retrospective-glow-text">
        ✨ Rétrospective ✨
      </p>
      <h1 className="text-4xl sm:text-6xl md:text-8xl font-extrabold text-white drop-shadow-2xl max-w-5xl leading-tight">
        {eventTitle || "La soirée"}
      </h1>
      <div className="mt-4 flex flex-wrap justify-center gap-10 sm:gap-16">
        <div className="flex flex-col items-center">
          <CountUp
            target={stats.totalPhotos}
            className="text-6xl sm:text-8xl md:text-9xl font-black text-white"
          />
          <span className="mt-2 text-lg sm:text-2xl text-purple-200">
            photo{stats.totalPhotos !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <CountUp
            target={stats.totalReactions}
            className="text-6xl sm:text-8xl md:text-9xl font-black text-amber-300"
          />
          <span className="mt-2 text-lg sm:text-2xl text-purple-200">
            réaction{stats.totalReactions !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

export function StarReactionScene({ stats }: SceneProps) {
  return (
    <div className="retrospective-scene-enter relative flex flex-col items-center justify-center gap-6 px-6 text-center overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {EMOJI_RAIN_PIECES.map((p, i) => (
          <span
            key={i}
            className="emoji-rain-piece absolute select-none"
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}rem`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              ["--emoji-drift" as string]: `${p.drift}px`,
            }}
          >
            {stats.starEmoji}
          </span>
        ))}
      </div>
      <p className="relative z-10 text-xl sm:text-3xl font-semibold text-purple-200">
        Réaction star de la soirée
      </p>
      <span
        className="relative z-10 retrospective-star-emoji"
        role="img"
        aria-label={stats.starEmoji}
      >
        {stats.starEmoji}
      </span>
      <p className="relative z-10 text-4xl sm:text-6xl font-black text-white tabular-nums">
        <CountUp target={stats.starEmojiCount} durationMs={1500} />
        <span className="ml-3 text-2xl sm:text-4xl font-bold text-purple-200">
          fois
        </span>
      </p>
    </div>
  );
}

function PodiumSlot({
  photo,
  rank,
  size,
}: {
  photo: Photo | undefined;
  rank: 1 | 2 | 3;
  size: "lg" | "md" | "sm";
}) {
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;
  const heights = { lg: "h-48 sm:h-64 md:h-72", md: "h-36 sm:h-48", sm: "h-36 sm:h-48" };
  const widths = { lg: "w-44 sm:w-56 md:w-64", md: "w-32 sm:w-40", sm: "w-32 sm:w-40" };

  if (!photo) {
    return (
      <div className={`flex flex-col items-center opacity-0 ${widths[size]}`} aria-hidden />
    );
  }

  return (
    <div
      className={`podium-reveal flex flex-col items-center gap-3 ${widths[size]}`}
      style={{ animationDelay: rank === 1 ? "0.2s" : rank === 2 ? "0.45s" : "0.6s" }}
    >
      <span className="text-3xl sm:text-5xl">{medals[rank]}</span>
      <div
        className={`podium-reveal-flash relative overflow-hidden rounded-2xl ring-4 ring-white/30 shadow-2xl ${heights[size]} w-full`}
      >
        <img src={photo.url} alt="" className="h-full w-full object-cover" />
      </div>
      <p className="text-lg sm:text-2xl font-bold text-amber-300 tabular-nums">
        {photoReactionTotal(photo)} réactions
      </p>
    </div>
  );
}

export function Top3Scene({ stats }: SceneProps) {
  const [first, second, third] = stats.top3Photos;
  const showPodium = stats.top3Photos.length >= 2;

  if (!showPodium && first) {
    return (
      <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-6 px-6">
        <p className="text-2xl sm:text-4xl font-bold text-white">Photo la plus aimée</p>
        <div className="podium-reveal-flash max-h-[60vh] max-w-2xl overflow-hidden rounded-3xl ring-4 ring-amber-400/60 shadow-2xl">
          <img src={first.url} alt="" className="max-h-[60vh] w-full object-contain" />
        </div>
        <p className="text-3xl font-black text-amber-300">
          {photoReactionTotal(first)} réactions
        </p>
      </div>
    );
  }

  return (
    <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-8 px-4">
      <p className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white text-center">
        🏆 Top {Math.min(3, stats.top3Photos.length)} photos
      </p>
      <div className="flex items-end justify-center gap-3 sm:gap-6 md:gap-10 w-full max-w-5xl">
        <PodiumSlot photo={second} rank={2} size="sm" />
        <PodiumSlot photo={first} rank={1} size="lg" />
        <PodiumSlot photo={third} rank={3} size="sm" />
      </div>
    </div>
  );
}

export function FirstLastScene({ stats }: SceneProps) {
  const { firstPhoto, lastPhoto } = stats;
  if (!firstPhoto) return null;

  const same = firstPhoto.id === lastPhoto?.id;

  return (
    <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-8 px-6">
      <p className="text-2xl sm:text-4xl font-bold text-white text-center">
        {same ? "La photo de la soirée" : "Première & dernière photo"}
      </p>
      <div className={`flex flex-wrap justify-center gap-8 ${same ? "" : "max-w-6xl"}`}>
        <div className="flex flex-col items-center gap-3">
          {!same && (
            <span className="text-lg sm:text-2xl text-pink-300 font-semibold">
              🌅 Première · {formatPhotoTime(firstPhoto.createdAt)}
            </span>
          )}
          <div className="overflow-hidden rounded-2xl ring-2 ring-white/25 shadow-xl max-h-[45vh]">
            <img
              src={firstPhoto.url}
              alt=""
              className="max-h-[45vh] max-w-[min(90vw,28rem)] object-contain"
            />
          </div>
        </div>
        {!same && lastPhoto && (
          <div className="flex flex-col items-center gap-3">
            <span className="text-lg sm:text-2xl text-purple-300 font-semibold">
              🌙 Dernière · {formatPhotoTime(lastPhoto.createdAt)}
            </span>
            <div className="overflow-hidden rounded-2xl ring-2 ring-white/25 shadow-xl max-h-[45vh]">
              <img
                src={lastPhoto.url}
                alt=""
                className="max-h-[45vh] max-w-[min(90vw,28rem)] object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function RhythmScene({ stats }: SceneProps) {
  const max = Math.max(...stats.hourlyBuckets.map((b) => b.count), 1);

  return (
    <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-10 px-6 w-full max-w-4xl mx-auto">
      <p className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white text-center">
        📈 Le rythme de la soirée
      </p>
      <div className="flex items-end justify-center gap-2 sm:gap-4 w-full h-48 sm:h-64">
        {stats.hourlyBuckets.map((bucket) => (
          <div
            key={bucket.label}
            className="flex flex-1 flex-col items-center gap-2 min-w-0"
          >
            <span className="text-sm sm:text-lg font-bold text-amber-300 tabular-nums">
              {bucket.count}
            </span>
            <div
              className="retrospective-bar-grow w-full max-w-16 rounded-t-lg bg-linear-to-t from-pink-600 to-purple-400 ring-1 ring-white/20"
              style={{ height: `${(bucket.count / max) * 100}%`, minHeight: "8%" }}
            />
            <span className="text-xs sm:text-sm text-purple-300 truncate w-full text-center">
              {bucket.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChallengeMostAttemptedScene({ stats }: SceneProps) {
  const item = stats.challengeStats.mostAttempted;
  if (!item) return null;

  return (
    <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-2xl sm:text-4xl font-bold text-white">
        🎯 Défi le plus relevé
      </p>
      <p className="text-4xl sm:text-6xl">{item.emoji ?? "🎯"}</p>
      <p className="text-xl sm:text-3xl font-semibold text-pink-200 max-w-2xl">
        {item.label}
      </p>
      <p className="text-5xl sm:text-7xl font-black text-amber-300 tabular-nums">
        <CountUp target={item.count} durationMs={1200} />
        <span className="ml-2 text-2xl sm:text-3xl text-purple-200">
          photo{item.count !== 1 ? "s" : ""}
        </span>
      </p>
    </div>
  );
}

export function ChallengeMostSuccessfulScene({ stats }: SceneProps) {
  const item = stats.challengeStats.mostSuccessful;
  if (!item) return null;

  return (
    <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-6 px-6">
      <p className="text-2xl sm:text-4xl font-bold text-white text-center">
        🏆 Défi le plus réussi
      </p>
      <p className="text-sm sm:text-lg text-purple-200 text-center">
        {item.emoji && <span className="mr-1">{item.emoji}</span>}
        {item.label}
      </p>
      <div className="podium-reveal-flash max-h-[50vh] max-w-xl overflow-hidden rounded-3xl ring-4 ring-green-400/50 shadow-2xl">
        <img
          src={item.photo.url}
          alt=""
          className="max-h-[50vh] w-full object-contain"
        />
      </div>
      <p className="text-2xl sm:text-4xl font-black text-green-300">
        ✅ {item.success} · ❌ {item.fail}
      </p>
    </div>
  );
}

export function ChallengeMostFailedScene({ stats }: SceneProps) {
  const item = stats.challengeStats.mostFailed;
  if (!item) return null;

  return (
    <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-6 px-6">
      <p className="text-2xl sm:text-4xl font-bold text-white text-center">
        😅 Défi le plus raté
      </p>
      <p className="text-sm sm:text-lg text-purple-200 text-center max-w-lg">
        On rigole bien — bravo pour le courage !
      </p>
      <div className="max-h-[45vh] max-w-md overflow-hidden rounded-3xl ring-4 ring-orange-400/40 shadow-2xl">
        <img
          src={item.photo.url}
          alt=""
          className="max-h-[45vh] w-full object-contain"
        />
      </div>
      <p className="text-xl sm:text-2xl text-orange-200">
        {item.emoji && <span className="mr-1">{item.emoji}</span>}
        {item.label}
      </p>
      <p className="text-3xl font-black text-orange-300 tabular-nums">
        ❌ {item.failCount} vote{item.failCount !== 1 ? "s" : ""} échec
      </p>
    </div>
  );
}

function AwardsPodiumSlot({
  entry,
  rank,
  size,
}: {
  entry: { pseudo: string; points: number } | undefined;
  rank: 1 | 2 | 3;
  size: "lg" | "sm";
}) {
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" } as const;
  const heights = { lg: "h-32 sm:h-40", sm: "h-24 sm:h-32" };
  const widths = { lg: "w-40 sm:w-48", sm: "w-32 sm:w-40" };

  if (!entry) {
    return <div className={`${widths[size]} opacity-0`} aria-hidden />;
  }

  return (
    <div
      className={`podium-reveal flex flex-col items-center gap-2 ${widths[size]}`}
      style={{
        animationDelay: rank === 1 ? "0.25s" : rank === 2 ? "0.5s" : "0.65s",
      }}
    >
      <span className="text-4xl sm:text-5xl">{medals[rank]}</span>
      <div
        className={`flex w-full flex-col items-center justify-end rounded-t-2xl bg-linear-to-t from-amber-600/90 to-yellow-400/70 ring-2 ring-white/30 shadow-2xl ${heights[size]} px-2 pb-3`}
      >
        <p className="truncate w-full text-center text-sm sm:text-base font-bold text-white">
          {entry.pseudo}
        </p>
        <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">
          {entry.points}
        </p>
      </div>
    </div>
  );
}

export function ChallengeLeaderboardScene({ stats }: SceneProps) {
  const top = stats.challengeStats.leaderboardTop3;
  if (top.length === 0) return null;

  const [first, second, third] = top;

  if (top.length === 1 && first) {
    return (
      <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-8 px-6">
        <p className="text-2xl sm:text-5xl font-extrabold text-white text-center">
          🏅 Champion des défis
        </p>
        <AwardsPodiumSlot entry={first} rank={1} size="lg" />
      </div>
    );
  }

  return (
    <div className="retrospective-scene-enter flex flex-col items-center justify-center gap-8 px-4">
      <p className="text-2xl sm:text-5xl font-extrabold text-white text-center retrospective-glow-text">
        🏅 Podium des joueurs
      </p>
      <div className="flex items-end justify-center gap-4 sm:gap-8 w-full max-w-3xl">
        <AwardsPodiumSlot entry={second} rank={2} size="sm" />
        <AwardsPodiumSlot entry={first} rank={1} size="lg" />
        <AwardsPodiumSlot entry={third} rank={3} size="sm" />
      </div>
    </div>
  );
}

export function SlideshowScene({ photos, paused }: SceneProps) {
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const evenIsCurrent = index % 2 === 0;
  const current = count > 0 ? photos[index % count] : null;
  const previous = count > 0 ? photos[(index - 1 + count) % count] : null;
  const slotA = evenIsCurrent ? current : previous;
  const slotB = evenIsCurrent ? previous : current;

  useEffect(() => {
    if (count < 2 || paused) return;
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, SLIDESHOW_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [count, paused]);

  useEffect(() => {
    if (!photos || count < 2) return;
    const next = photos[(index + 1) % count];
    const img = new Image();
    img.src = next.url;
  }, [index, photos, count]);

  if (!current) return null;

  return (
    <div className="absolute inset-0 event-gradient-bg">
      {slotA && (
        <img
          src={slotA.url}
          alt=""
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ease-in-out ${
            evenIsCurrent ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {slotB && count > 1 && (
        <img
          src={slotB.url}
          alt=""
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-700 ease-in-out ${
            evenIsCurrent ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xl sm:text-2xl text-white/60 font-semibold">
        Nos souvenirs 📸
      </p>
    </div>
  );
}

export function ClosingScene({ closingMessage }: SceneProps) {
  return (
    <div className="retrospective-scene-enter relative flex flex-col items-center justify-center gap-8 px-6 text-center overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {CLOSING_BURST_PIECES.map((p, i) => (
          <span
            key={i}
            className={`closing-burst-piece absolute ${
              p.round ? "rounded-full" : "rounded-[2px]"
            }`}
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.5,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>
      <p className="relative z-10 text-4xl sm:text-6xl md:text-8xl font-extrabold text-white closing-message-pop max-w-5xl leading-tight drop-shadow-2xl">
        {closingMessage}
      </p>
      <p className="relative z-10 text-2xl sm:text-4xl animate-pulse">🎉✨🎂</p>
    </div>
  );
}
