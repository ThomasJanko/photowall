"use client";

import { Suspense, useCallback, useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { PollModal } from "@/components/PollModal";
import { ChallengeBadge } from "@/components/ChallengeBadge";
import { PhotoLightbox, type Floater } from "@/components/PhotoLightbox";
import { useEventConfig } from "@/components/EventThemeProvider";
import { fetchActiveChallenges, type PublicChallenge } from "@/lib/challengesApi";
import { QuickNav } from "@/components/QuickNav";
import { withAdminLink, useIsAdmin } from "@/lib/useIsAdmin";
import type { AnnouncementEvent } from "@/lib/types";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/** Clé localStorage mémorisant les réactions posées par CET appareil. */
const MY_REACTIONS_KEY = "wall:my-reactions";
/** Votes réussi/échec par appareil (format photoId:success|fail). */
const MY_CHALLENGE_VOTES_KEY = "wall:my-challenge-votes";
const DEEPLINK_KEY = "wall:deeplink-photo";
/** Durée de vie d'un emoji flottant (aligné sur l'animation CSS). */
const FLOATER_LIFETIME_MS = 1700;
/** Durée de l'animation de sortie du bandeau d'annonce (ms). */
const ANNOUNCEMENT_EXIT_MS = 400;
/** Nombre max de cartes photo rendues dans la grille (state `photos` reste complet). */
const MAX_RENDERED_PHOTOS = 60;

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
  return (
    <Suspense fallback={null}>
      <WallPageContent />
    </Suspense>
  );
}

function WallPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { config, accent } = useEventConfig();
  const isAdmin = useIsAdmin();
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
  const orphanViewerPhotoRef = useRef<Photo | null>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [cooldowns, setCooldowns] = useState<Set<string>>(new Set());
  const [myReactions, setMyReactions] = useState<Set<string>>(loadMyReactions);
  const [myChallengeVotes, setMyChallengeVotes] = useState<Set<string>>(
    loadMyChallengeVotes
  );
  const [connected, setConnected] = useState(true);
  const [announcement, setAnnouncement] = useState<AnnouncementEvent | null>(
    null
  );
  const [announcementLeaving, setAnnouncementLeaving] = useState(false);

  const knownIds = useRef(new Set<string>());
  const floaterSeq = useRef(0);
  const spotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepLinkHandledRef = useRef<string | null>(null);
  const photosLoadedRef = useRef(false);
  const announcementHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcementExitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spotlight = features.spotlight ? (queue[0] ?? null) : null;

  const viewerPhoto = useMemo(() => {
    if (!viewerPhotoId) return null;
    const fromState =
      photos.find((p) => p.id === viewerPhotoId) ??
      queue.find((p) => p.id === viewerPhotoId);
    if (fromState) {
      orphanViewerPhotoRef.current = null;
      return fromState;
    }
    if (orphanViewerPhotoRef.current?.id === viewerPhotoId) {
      return orphanViewerPhotoRef.current;
    }
    return null;
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

  function findPhotoById(id: string): Photo | null {
    const inPhotos = photos.find((p) => p.id === id);
    if (inPhotos) return inPhotos;
    const inQueue = queue.find((p) => p.id === id);
    if (inQueue) return inQueue;
    try {
      const raw = sessionStorage.getItem(DEEPLINK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Photo;
        if (parsed.id === id) return parsed;
      }
    } catch {
      // sessionStorage illisible
    }
    return null;
  }

  function openDeepLinkPhoto(photoId: string) {
    if (deepLinkHandledRef.current === photoId) return;
    const found = findPhotoById(photoId);
    if (found) {
      if (
        !photos.some((p) => p.id === photoId) &&
        !queue.some((p) => p.id === photoId)
      ) {
        orphanViewerPhotoRef.current = found;
      }
      setViewerPhotoId(photoId);
    }
    cleanupDeepLink(photoId);
  }

  function cleanupDeepLink(photoId: string) {
    deepLinkHandledRef.current = photoId;
    try {
      sessionStorage.removeItem(DEEPLINK_KEY);
    } catch {
      // ignore
    }
    router.replace("/wall", { scroll: false });
  }

  const navLinks = useMemo(
    () =>
      withAdminLink(
        [
          ...(features.countdown
            ? [{ href: "/countdown", label: "Compte à rebours", icon: "⏳" }]
            : []),
          ...(features.retrospective
            ? [{ href: "/retrospective", label: "Rétrospective", icon: "🎬" }]
            : []),
          ...(features.leaderboard
            ? [{ href: "/classement", label: "Classement", icon: "🏆" }]
            : []),
          ...(features.qrPage
            ? [{ href: "/qr", label: "QR code", icon: "📱" }]
            : []),
          ...(features.privateMessages
            ? [{ href: "/message", label: "Message privé", icon: "💌" }]
            : []),
        ],
        isAdmin
      ),
    [features, isAdmin]
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

  function showAnnouncement(payload: AnnouncementEvent) {
    clearAnnouncementTimers();
    setAnnouncementLeaving(false);
    setAnnouncement(payload);

    announcementHideRef.current = setTimeout(() => {
      setAnnouncementLeaving(true);
      announcementExitRef.current = setTimeout(() => {
        setAnnouncement(null);
        setAnnouncementLeaving(false);
      }, ANNOUNCEMENT_EXIT_MS);
    }, payload.durationMs);
  }

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
      list.map((p) =>
        p.id === photoId ? { ...p, challengeVotes } : p
      );
    setPhotos(update);
    setQueue(update);
  }

  function persistMyChallengeVotes(next: Set<string>) {
    setMyChallengeVotes(next);
    try {
      localStorage.setItem(
        MY_CHALLENGE_VOTES_KEY,
        JSON.stringify([...next])
      );
    } catch {
      // Stockage plein/indisponible
    }
  }

  useEffect(() => {
    fetchActiveChallenges().then(setChallenges).catch(() => setChallenges([]));
  }, []);

  useEffect(() => {
    const service = getPhotoService();

    service
      .listPhotos()
      .then((list) => {
        list.forEach((p) => knownIds.current.add(p.id));
        setPhotos(list);
        photosLoadedRef.current = true;
        const photoId = searchParams.get("photo");
        if (photoId && deepLinkHandledRef.current !== photoId) {
          openDeepLinkPhoto(photoId);
        }
      })
      .catch(console.error);

    const unsubNew = service.onNewPhoto((photo) => {
      if (knownIds.current.has(photo.id)) return;
      knownIds.current.add(photo.id);
      if (features.spotlight) {
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
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setQueue((prev) => prev.filter((p) => p.id !== id));
    });

    const unsubReaction = features.reactions
      ? service.onReaction(({ photoId, emoji, reactions, action }) => {
          applyReactions(photoId, reactions);
          if (action === "add") spawnFloater(photoId, emoji);
        })
      : undefined;

    const unsubChallengeVote = service.onChallengeVote?.(
      ({ photoId, challengeVotes }) => {
        applyChallengeVotes(photoId, challengeVotes);
      }
    );

    const unsubConnection = service.onConnectionChange?.(setConnected);

    const unsubAnnouncement = service.onAnnouncement?.(showAnnouncement);

    return () => {
      unsubNew();
      unsubRemoved();
      unsubReaction?.();
      unsubChallengeVote?.();
      unsubConnection?.();
      unsubAnnouncement?.();
      clearAnnouncementTimers();
    };
  }, []);

  /** Deep link ?photo=id depuis NewPhotoPopup (sessionStorage) ou URL directe. */
  useEffect(() => {
    const photoId = searchParams.get("photo");
    if (!photoId || deepLinkHandledRef.current === photoId) return;

    const fromStorage = (() => {
      try {
        const raw = sessionStorage.getItem(DEEPLINK_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Photo;
        return parsed.id === photoId ? parsed : null;
      } catch {
        return null;
      }
    })();

    if (fromStorage) {
      orphanViewerPhotoRef.current = fromStorage;
      setViewerPhotoId(photoId);
      cleanupDeepLink(photoId);
      return;
    }

    if (!photosLoadedRef.current) return;

    openDeepLinkPhoto(photoId);
  }, [searchParams, photos, queue, router]);

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
          if (hadOpposite) cv[vote === "success" ? "fail" : "success"] = Math.max(
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
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs ring-1 active:scale-90 transition-transform disabled:opacity-40 ${
            mineSuccess
              ? "bg-green-500/40 ring-green-300/60 text-white"
              : "bg-white/10 ring-white/15 text-purple-100"
          }`}
        >
          ✅ {success}
        </button>
        <button
          type="button"
          onClick={() => handleChallengeVote(photo.id, "fail")}
          disabled={cooldowns.has(`${photo.id}:fail`)}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs ring-1 active:scale-90 transition-transform disabled:opacity-40 ${
            mineFail
              ? "bg-red-500/40 ring-red-300/60 text-white"
              : "bg-white/10 ring-white/15 text-purple-100"
          }`}
        >
          ❌ {fail}
        </button>
      </div>
    );
  }

  return (
    <main className="event-gradient-bg min-h-screen transition-all duration-2000 ease-in-out p-4 overflow-hidden">
      {features.confetti && <ConfettiBackground accent={accent} />}

      {announcement && (
        <AnnouncementBanner
          announcement={announcement}
          leaving={announcementLeaving}
        />
      )}

      <PollModal screen="wall" />

      {!connected && (
        <div
          role="status"
          className="pulse-soft fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm text-orange-200 ring-1 ring-orange-400/30 backdrop-blur-sm"
        >
          🔌 Reconnexion en cours...
        </div>
      )}

      <div className="relative z-10">
        <h1 className="text-center text-white text-3xl md:text-5xl font-bold mb-6 drop-shadow-lg">
          {eventName}
        </h1>

        {photos.length === 0 && !spotlight ? (
          <p className="text-center text-purple-200 text-xl mt-20">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {displayedPhotos.map((photo) => {
              const challengeInfo = photo.challengeId
                ? resolveChallengeLabel(photo.challengeId)
                : null;
              return (
              <div key={photo.id} className="photo-pop-in flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setViewerPhotoId(photo.id)}
                  className="relative aspect-square rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/20 text-left active:scale-[0.98] transition-transform"
                >
                  <img
                    src={resolveUrl(photo.url)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover pointer-events-none"
                  />
                  {challengeInfo && (
                    <ChallengeBadge
                      label={challengeInfo.label}
                      emoji={challengeInfo.emoji}
                    />
                  )}
                  {features.reactions && (
                    <FloatersOverlay
                      floaters={floaters.filter((f) => f.photoId === photo.id)}
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
                          className={`flex shrink-0 items-center gap-0.5 sm:gap-1 rounded-full px-1.5 py-0.5 sm:px-2 sm:py-1 ring-1 active:scale-90 transition-transform disabled:opacity-40 ${
                            mine
                              ? "bg-pink-500/40 ring-pink-300/60"
                              : "bg-white/10 ring-white/15"
                          }`}
                        >
                          <span className="text-xs sm:text-sm">{emoji}</span>
                          <span
                            className={`text-[10px] sm:text-xs tabular-nums ${
                              mine
                                ? "text-white font-semibold"
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
                {photo.challengeId && <ChallengeVoteButtons photo={photo} />}
              </div>
            );
            })}
            </div>
          </>
        )}
      </div>

      <Link
        href="/"
        className="fixed bottom-6 right-6 z-40 rounded-full bg-white/90 text-purple-900 font-semibold px-6 py-3 shadow-2xl active:scale-95 transition-transform"
      >
        📷 Prendre une photo
      </Link>

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
          zIndexClass="z-50"
          animate
        />
      )}

      {viewerPhoto && (
        <PhotoLightbox
          photo={viewerPhoto}
          onClose={() => {
            setViewerPhotoId(null);
            orphanViewerPhotoRef.current = null;
          }}
          challengeInfo={
            viewerPhoto.challengeId
              ? resolveChallengeLabel(viewerPhoto.challengeId)
              : undefined
          }
          reactionEmojis={[...reactionEmojis]}
          features={features}
          floaters={floaters}
          zIndexClass="z-[60]"
          animate={false}
        />
      )}
    </main>
  );
}
