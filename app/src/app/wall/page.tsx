"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { PollFab } from "@/components/PollFab";
import { ChallengeBadge } from "@/components/ChallengeBadge";
import { PhotoLightbox, type Floater } from "@/components/PhotoLightbox";
import { useEventConfig } from "@/components/EventThemeProvider";
import {
  fetchActiveChallenges,
  type PublicChallenge,
} from "@/lib/challengesApi";
import { QuickNav } from "@/components/QuickNav";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { buildNavLinks } from "@/lib/quickNavLinks";
import { useScreenMode } from "@/lib/screenMode";
import { usePathname } from "next/navigation";
import type { AnnouncementEvent } from "@/lib/types";
import { announcementRemainingMs } from "@/lib/announcementUtils";
import { Camera } from "lucide-react";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/** Clé localStorage mémorisant les réactions posées par CET appareil. */
const MY_REACTIONS_KEY = "wall:my-reactions";
/** Votes réussi/échec par appareil (format photoId:success|fail). */
const MY_CHALLENGE_VOTES_KEY = "wall:my-challenge-votes";
/** Durée de vie d'un emoji flottant (aligné sur l'animation CSS). */
const FLOATER_LIFETIME_MS = 1700;
/** Durée de l'animation de sortie du bandeau d'annonce (ms). */
const ANNOUNCEMENT_EXIT_MS = 400;
/** Nombre max de cartes photo rendues dans la grille (state `photos` reste complet). */
const MAX_RENDERED_PHOTOS = 60;
/** Marge avant l'ouverture du mur pour le skew d'horloge (spotlight initial). */
const SPOTLIGHT_GRACE_MS = 3000;

/**
 * Fusionne la réponse GET /api/photos avec queue/photos courantes sans
 * écraser les photos en attente de spotlight ni les ignorer si le GET
 * les inclut avant le socket.
 */
function mergeListPhotosWithSpotlightState(
  list: Photo[],
  prevQueue: Photo[],
  prevPhotos: Photo[],
  spotlightEnabled: boolean,
  wallOpenTime: number,
  socketPhotoIds: ReadonlySet<string>
): { photos: Photo[]; queue: Photo[] } {
  const listById = new Map(list.map((p) => [p.id, p]));
  const queueIds = new Set(prevQueue.map((p) => p.id));
  const nextQueue = [...prevQueue];

  if (spotlightEnabled) {
    for (const p of list) {
      if (queueIds.has(p.id)) continue;
      const isNewSinceOpen = p.createdAt >= wallOpenTime - SPOTLIGHT_GRACE_MS;
      const seenViaSocket = socketPhotoIds.has(p.id);
      if (isNewSinceOpen && !seenViaSocket) {
        nextQueue.push(p);
        queueIds.add(p.id);
      }
    }
  }

  const allQueueIds = new Set(nextQueue.map((p) => p.id));
  const refreshedQueue = nextQueue
    .map((p) => listById.get(p.id) ?? p)
    .sort((a, b) => a.createdAt - b.createdAt);

  const gridMap = new Map<string, Photo>();
  for (const p of prevPhotos) {
    if (!allQueueIds.has(p.id)) gridMap.set(p.id, p);
  }
  for (const p of list) {
    if (!allQueueIds.has(p.id)) gridMap.set(p.id, p);
  }

  return { photos: Array.from(gridMap.values()), queue: refreshedQueue };
}

/** Préfixe les URLs relatives (mode local: /uploads/xxx.jpg) avec le serveur. */
function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
}

/**
 * Réactions déjà posées par cet appareil, lues depuis localStorage.
 * Sans risque pour l'hydratation : la grille n'est rendue qu'après le
 * chargement des photos, donc jamais dans le HTML serveur.
 */
function loadMyReactions(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MY_REACTIONS_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function loadMyChallengeVotes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(MY_CHALLENGE_VOTES_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function FloatersOverlay({ floaters }: { readonly floaters: Floater[] }) {
  return (
    <>
      {floaters.map((f) => (
        <span
          key={f.id}
          className="reaction-float pointer-events-none absolute bottom-2 text-3xl md:text-4xl"
          style={{ left: `${f.left}%` }}
        >
          {f.emoji}
        </span>
      ))}
    </>
  );
}

export default function WallPage() {
  const pathname = usePathname();
  const { config, accent } = useEventConfig();
  const isAdmin = useIsAdmin();
  const screenMode = useScreenMode();
  const {
    spotlightDurationMs,
    reactionCooldownMs,
    features,
    reactionEmojis,
    eventName,
    welcomeMessage,
  } = config;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [challenges, setChallenges] = useState<PublicChallenge[]>([]);
  const [queue, setQueue] = useState<Photo[]>([]);
  const [viewerPhotoId, setViewerPhotoId] = useState<string | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [cooldowns, setCooldowns] = useState<Set<string>>(new Set());
  const [myReactions, setMyReactions] = useState<Set<string>>(loadMyReactions);
  const [myChallengeVotes, setMyChallengeVotes] =
    useState<Set<string>>(loadMyChallengeVotes);
  const [connected, setConnected] = useState(true);
  const [announcement, setAnnouncement] = useState<AnnouncementEvent | null>(
    null
  );
  const [announcementLeaving, setAnnouncementLeaving] = useState(false);

  const knownIds = useRef(new Set<string>());
  const socketPhotoIdsRef = useRef(new Set<string>());
  const queueRef = useRef<Photo[]>([]);
  const photosRef = useRef<Photo[]>([]);
  const featuresRef = useRef(features);
  const floaterSeq = useRef(0);
  const spotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcementHideRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const announcementExitRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const spotlight = features.spotlight ? (queue[0] ?? null) : null;

  const viewerPhoto = useMemo(() => {
    if (!viewerPhotoId) return null;
    return (
      photos.find((p) => p.id === viewerPhotoId) ??
      queue.find((p) => p.id === viewerPhotoId) ??
      null
    );
  }, [viewerPhotoId, photos, queue]);

  /** Grille : les N plus récentes, la plus récente en premier. */
  const displayedPhotos = useMemo(
    () =>
      [...photos]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, MAX_RENDERED_PHOTOS),
    [photos]
  );
  const isGridTruncated = photos.length > MAX_RENDERED_PHOTOS;

  const challengeById = useMemo(() => {
    const map = new Map<string, PublicChallenge>();
    for (const c of challenges) map.set(c.id, c);
    return map;
  }, [challenges]);

  function resolveChallengeLabel(challengeId: string) {
    const c = challengeById.get(challengeId);
    return c
      ? { label: c.label, emoji: c.emoji }
      : { label: "Défi supprimé", emoji: undefined };
  }

  /** Retire le spotlight courant de la queue et l'ajoute à la grille (client local). */
  const completeSpotlight = useCallback((photo: Photo) => {
    if (spotlightTimerRef.current) {
      clearTimeout(spotlightTimerRef.current);
      spotlightTimerRef.current = null;
    }
    setPhotos((prev) =>
      prev.some((p) => p.id === photo.id) ? prev : [...prev, photo]
    );
    setQueue((prev) => prev.filter((p) => p.id !== photo.id));
  }, []);

  const navLinks = useMemo(
    () => buildNavLinks(pathname, features, isAdmin),
    [pathname, features, isAdmin]
  );

  function clearAnnouncementTimers() {
    if (announcementHideRef.current) {
      clearTimeout(announcementHideRef.current);
      announcementHideRef.current = null;
    }
    if (announcementExitRef.current) {
      clearTimeout(announcementExitRef.current);
      announcementExitRef.current = null;
    }
  }

  const showAnnouncement = useCallback((payload: AnnouncementEvent) => {
    const remainingMs = announcementRemainingMs(payload);
    if (remainingMs <= 0) return;

    clearAnnouncementTimers();
    setAnnouncementLeaving(false);
    setAnnouncement(payload);

    announcementHideRef.current = setTimeout(() => {
      setAnnouncementLeaving(true);
      announcementExitRef.current = setTimeout(() => {
        setAnnouncement(null);
        setAnnouncementLeaving(false);
      }, ANNOUNCEMENT_EXIT_MS);
    }, remainingMs);
  }, []);

  function applyReactions(photoId: string, reactions: Record<string, number>) {
    const update = (list: Photo[]) =>
      list.map((p) => (p.id === photoId ? { ...p, reactions } : p));
    setPhotos(update);
    setQueue(update);
  }

  function spawnFloater(photoId: string, emoji: string) {
    const id = ++floaterSeq.current;
    const left = 15 + Math.random() * 70;
    setFloaters((prev) => [...prev, { id, photoId, emoji, left }]);
    setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== id));
    }, FLOATER_LIFETIME_MS);
  }

  function persistMyReactions(next: Set<string>) {
    setMyReactions(next);
    try {
      localStorage.setItem(MY_REACTIONS_KEY, JSON.stringify([...next]));
    } catch {
      // Stockage plein/indisponible
    }
  }

  function applyChallengeVotes(
    photoId: string,
    challengeVotes: { success: number; fail: number }
  ) {
    const update = (list: Photo[]) =>
      list.map((p) => (p.id === photoId ? { ...p, challengeVotes } : p));
    setPhotos(update);
    setQueue(update);
  }

  function persistMyChallengeVotes(next: Set<string>) {
    setMyChallengeVotes(next);
    try {
      localStorage.setItem(MY_CHALLENGE_VOTES_KEY, JSON.stringify([...next]));
    } catch {
      // Stockage plein/indisponible
    }
  }

  useEffect(() => {
    fetchActiveChallenges()
      .then(setChallenges)
      .catch(() => setChallenges([]));
  }, []);

  useEffect(() => {
    const service = getPhotoService();
    const wallOpenTime = Date.now();

    service
      .listPhotos()
      .then((list) => {
        const merged = mergeListPhotosWithSpotlightState(
          list,
          queueRef.current,
          photosRef.current,
          featuresRef.current.spotlight,
          wallOpenTime,
          socketPhotoIdsRef.current
        );
        list.forEach((p) => knownIds.current.add(p.id));
        setPhotos(merged.photos);
        setQueue(merged.queue);
      })
      .catch(console.error);

    const unsubNew = service.onNewPhoto((photo) => {
      if (knownIds.current.has(photo.id)) return;
      knownIds.current.add(photo.id);
      socketPhotoIdsRef.current.add(photo.id);
      if (featuresRef.current.spotlight) {
        setQueue((prev) =>
          prev.some((p) => p.id === photo.id) ? prev : [...prev, photo]
        );
      } else {
        setPhotos((prev) =>
          prev.some((p) => p.id === photo.id) ? prev : [...prev, photo]
        );
      }
    });

    const unsubRemoved = service.onPhotoRemoved((id) => {
      knownIds.current.delete(id);
      socketPhotoIdsRef.current.delete(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setQueue((prev) => prev.filter((p) => p.id !== id));
    });

    const unsubReaction = service.onReaction(
      ({ photoId, emoji, reactions, action }) => {
        if (!featuresRef.current.reactions) return;
        applyReactions(photoId, reactions);
        if (action === "add") spawnFloater(photoId, emoji);
      }
    );

    const unsubChallengeVote = service.onChallengeVote?.(
      ({ photoId, challengeVotes }) => {
        applyChallengeVotes(photoId, challengeVotes);
      }
    );

    const unsubConnection = service.onConnectionChange?.(setConnected);

    const unsubAnnouncement = service.onAnnouncement(showAnnouncement);

    return () => {
      unsubNew();
      unsubRemoved();
      unsubReaction?.();
      unsubChallengeVote?.();
      unsubConnection?.();
      unsubAnnouncement();
      clearAnnouncementTimers();
    };
  }, [showAnnouncement]);

  useEffect(() => {
    void getPhotoService()
      .getCurrentAnnouncement()
      .then((current) => {
        if (current) showAnnouncement(current);
      });
  }, [showAnnouncement]);

  useEffect(() => {
    if (!spotlight) return;
    const current = spotlight;
    spotlightTimerRef.current = setTimeout(() => {
      spotlightTimerRef.current = null;
      completeSpotlight(current);
    }, spotlightDurationMs);
    return () => {
      if (spotlightTimerRef.current) {
        clearTimeout(spotlightTimerRef.current);
        spotlightTimerRef.current = null;
      }
    };
  }, [spotlight?.id, spotlightDurationMs, completeSpotlight]);

  async function handleReact(photoId: string, emoji: string) {
    const key = `${photoId}:${emoji}`;
    if (cooldowns.has(key)) return;

    setCooldowns((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setCooldowns((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, reactionCooldownMs);

    const isRemoval = myReactions.has(key);
    const next = new Set(myReactions);
    if (isRemoval) next.delete(key);
    else next.add(key);
    persistMyReactions(next);

    const delta = isRemoval ? -1 : 1;
    const bump = (list: Photo[]) =>
      list.map((p) =>
        p.id === photoId
          ? {
              ...p,
              reactions: {
                ...p.reactions,
                [emoji]: Math.max(0, (p.reactions?.[emoji] ?? 0) + delta),
              },
            }
          : p
      );
    setPhotos(bump);
    setQueue(bump);

    try {
      if (isRemoval) {
        await getPhotoService().unreact(photoId, emoji);
      } else {
        await getPhotoService().react(photoId, emoji);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleChallengeVote(
    photoId: string,
    vote: "success" | "fail"
  ) {
    const key = `${photoId}:${vote}`;
    const oppositeKey = `${photoId}:${vote === "success" ? "fail" : "success"}`;
    if (cooldowns.has(key)) return;

    setCooldowns((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setCooldowns((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, reactionCooldownMs);

    const hadThis = myChallengeVotes.has(key);
    const hadOpposite = myChallengeVotes.has(oppositeKey);
    const nextVotes = new Set(myChallengeVotes);

    const bump = (list: Photo[]) =>
      list.map((p) => {
        if (p.id !== photoId) return p;
        const cv = {
          success: p.challengeVotes?.success ?? 0,
          fail: p.challengeVotes?.fail ?? 0,
        };
        if (hadThis) cv[vote] = Math.max(0, cv[vote] - 1);
        else {
          if (hadOpposite)
            cv[vote === "success" ? "fail" : "success"] = Math.max(
              0,
              cv[vote === "success" ? "fail" : "success"] - 1
            );
          cv[vote] += 1;
        }
        return { ...p, challengeVotes: cv };
      });

    if (hadThis) {
      nextVotes.delete(key);
    } else {
      nextVotes.delete(oppositeKey);
      nextVotes.add(key);
    }
    persistMyChallengeVotes(nextVotes);
    setPhotos(bump);
    setQueue(bump);

    const service = getPhotoService();
    if (!service.voteChallenge) return;

    try {
      if (hadThis) {
        await service.voteChallenge(photoId, vote, "remove");
      } else {
        if (hadOpposite) {
          await service.voteChallenge(
            photoId,
            vote === "success" ? "fail" : "success",
            "remove"
          );
        }
        await service.voteChallenge(photoId, vote, "add");
      }
    } catch (err) {
      console.error(err);
    }
  }

  function ChallengeVoteButtons({ photo }: { photo: Photo }) {
    if (!photo.challengeId) return null;
    const success = photo.challengeVotes?.success ?? 0;
    const fail = photo.challengeVotes?.fail ?? 0;
    const mineSuccess = myChallengeVotes.has(`${photo.id}:success`);
    const mineFail = myChallengeVotes.has(`${photo.id}:fail`);

    return (
      <div className="flex flex-wrap justify-center gap-1.5">
        <button
          type="button"
          onClick={() => handleChallengeVote(photo.id, "success")}
          disabled={cooldowns.has(`${photo.id}:success`)}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs ring-1 transition-transform active:scale-90 disabled:opacity-40 ${
            mineSuccess
              ? "bg-green-500/40 text-white ring-green-300/60"
              : "bg-white/10 text-purple-100 ring-white/15"
          }`}
        >
          ✅ {success}
        </button>
        <button
          type="button"
          onClick={() => handleChallengeVote(photo.id, "fail")}
          disabled={cooldowns.has(`${photo.id}:fail`)}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs ring-1 transition-transform active:scale-90 disabled:opacity-40 ${
            mineFail
              ? "bg-red-500/40 text-white ring-red-300/60"
              : "bg-white/10 text-purple-100 ring-white/15"
          }`}
        >
          ❌ {fail}
        </button>
      </div>
    );
  }

  return (
    <main className="event-gradient-bg min-h-screen overflow-hidden p-4 transition-all duration-2000 ease-in-out">
      {features.confetti && <ConfettiBackground accent={accent} />}

      {announcement && (
        <AnnouncementBanner
          announcement={announcement}
          leaving={announcementLeaving}
        />
      )}

      <PollFab />

      {!connected && (
        <div
          role="status"
          className="pulse-soft fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-orange-200 ring-1 ring-orange-400/30 backdrop-blur-sm"
        >
          🔌 Reconnexion en cours...
        </div>
      )}

      <div className="relative z-10">
        <h1 className="mb-6 text-center text-3xl font-bold text-white drop-shadow-lg md:text-5xl">
          {eventName}
        </h1>

        {photos.length === 0 && !spotlight ? (
          <p className="mt-20 text-center text-xl text-purple-200">
            {welcomeMessage}
          </p>
        ) : (
          <>
            {isGridTruncated && (
              <p className="mb-4 text-center text-sm text-purple-300/90 tabular-nums">
                📷 {photos.length} photo{photos.length !== 1 ? "s" : ""} · les{" "}
                {MAX_RENDERED_PHOTOS} plus récentes affichées
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {displayedPhotos.map((photo) => {
                const challengeInfo = photo.challengeId
                  ? resolveChallengeLabel(photo.challengeId)
                  : null;
                return (
                  <div
                    key={photo.id}
                    className="photo-pop-in flex flex-col gap-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => setViewerPhotoId(photo.id)}
                      className="relative aspect-square overflow-hidden rounded-xl text-left shadow-2xl ring-2 ring-white/20 transition-transform active:scale-[0.98]"
                    >
                      <img
                        src={resolveUrl(photo.url)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="pointer-events-none h-full w-full object-cover"
                      />
                      {challengeInfo && (
                        <ChallengeBadge
                          label={challengeInfo.label}
                          emoji={challengeInfo.emoji}
                        />
                      )}
                      {features.reactions && (
                        <FloatersOverlay
                          floaters={floaters.filter(
                            (f) => f.photoId === photo.id
                          )}
                        />
                      )}
                    </button>
                    {features.reactions && (
                      <div className="flex flex-wrap justify-center gap-x-1 gap-y-1">
                        {reactionEmojis.map((emoji) => {
                          const mine = myReactions.has(`${photo.id}:${emoji}`);
                          return (
                            <button
                              key={emoji}
                              onClick={() => handleReact(photo.id, emoji)}
                              disabled={cooldowns.has(`${photo.id}:${emoji}`)}
                              title={mine ? "Retirer ma réaction" : "Réagir"}
                              className={`flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 ring-1 transition-transform active:scale-90 disabled:opacity-40 sm:gap-1 sm:px-2 sm:py-1 ${
                                mine
                                  ? "bg-pink-500/40 ring-pink-300/60"
                                  : "bg-white/10 ring-white/15"
                              }`}
                            >
                              <span className="text-xs sm:text-sm">
                                {emoji}
                              </span>
                              <span
                                className={`text-[10px] tabular-nums sm:text-xs ${
                                  mine
                                    ? "font-semibold text-white"
                                    : "text-purple-200"
                                }`}
                              >
                                {photo.reactions?.[emoji] ?? 0}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {photo.challengeId && (
                      <ChallengeVoteButtons photo={photo} />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {!screenMode && (
        <Link
          href="/"
          className="fixed right-6 bottom-6 z-40 inline-flex items-center gap-2 rounded-full bg-white/90 px-6 py-3 font-semibold text-purple-900 shadow-2xl transition-transform active:scale-95"
        >
          <Camera className="h-4 w-4 shrink-0" aria-hidden />
          Prendre une photo
        </Link>
      )}


      <QuickNav links={navLinks} position="bottom-left" />

      {spotlight && (
        <PhotoLightbox
          photo={spotlight}
          onClose={() => completeSpotlight(spotlight)}
          challengeInfo={
            spotlight.challengeId
              ? resolveChallengeLabel(spotlight.challengeId)
              : undefined
          }
          reactionEmojis={[...reactionEmojis]}
          features={features}
          floaters={floaters}
          onReact={handleReact}
          myReactions={myReactions}
          reactionCooldowns={cooldowns}
          zIndexClass="z-50"
          animate
        />
      )}

      {viewerPhoto && (
        <PhotoLightbox
          photo={viewerPhoto}
          onClose={() => setViewerPhotoId(null)}
          challengeInfo={
            viewerPhoto.challengeId
              ? resolveChallengeLabel(viewerPhoto.challengeId)
              : undefined
          }
          reactionEmojis={[...reactionEmojis]}
          features={features}
          floaters={floaters}
          onReact={handleReact}
          myReactions={myReactions}
          reactionCooldowns={cooldowns}
          zIndexClass="z-[60]"
          animate={false}
        />
      )}
    </main>
  );
}
