"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { useEventConfig } from "@/components/EventThemeProvider";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/** Clé localStorage mémorisant les réactions posées par CET appareil. */
const MY_REACTIONS_KEY = "wall:my-reactions";
/** Durée de vie d'un emoji flottant (aligné sur l'animation CSS). */
const FLOATER_LIFETIME_MS = 1700;

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

interface Floater {
  id: number;
  photoId: string;
  emoji: string;
  left: number;
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
  const { config, accent } = useEventConfig();
  const {
    spotlightDurationMs,
    reactionCooldownMs,
    features,
    reactionEmojis,
    eventName,
    welcomeMessage,
  } = config;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [queue, setQueue] = useState<Photo[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [cooldowns, setCooldowns] = useState<Set<string>>(new Set());
  const [myReactions, setMyReactions] = useState<Set<string>>(loadMyReactions);
  const [connected, setConnected] = useState(true);

  const knownIds = useRef(new Set<string>());
  const floaterSeq = useRef(0);

  const spotlight = features.spotlight ? (queue[0] ?? null) : null;

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

  useEffect(() => {
    const service = getPhotoService();

    service
      .listPhotos()
      .then((list) => {
        list.forEach((p) => knownIds.current.add(p.id));
        setPhotos(list);
      })
      .catch(console.error);

    const unsubNew = service.onNewPhoto((photo) => {
      if (knownIds.current.has(photo.id)) return;
      knownIds.current.add(photo.id);
      if (features.spotlight) {
        setQueue((prev) => [...prev, photo]);
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

    const unsubConnection = service.onConnectionChange?.(setConnected);

    return () => {
      unsubNew();
      unsubRemoved();
      unsubReaction?.();
      unsubConnection?.();
    };
  }, []);

  useEffect(() => {
    if (!spotlight) return;
    const timer = setTimeout(() => {
      setPhotos((prev) =>
        prev.some((p) => p.id === spotlight.id) ? prev : [...prev, spotlight]
      );
      setQueue((prev) => prev.filter((p) => p.id !== spotlight.id));
    }, spotlightDurationMs);
    return () => clearTimeout(timer);
  }, [spotlight]);

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

  return (
    <main className="event-gradient-bg min-h-screen transition-all duration-2000 ease-in-out p-4 overflow-hidden">
      {features.confetti && <ConfettiBackground accent={accent} />}

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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {photos.map((photo) => (
              <div key={photo.id} className="photo-pop-in flex flex-col gap-1.5">
                <div className="relative aspect-square rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/20">
                  <img
                    src={resolveUrl(photo.url)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {features.reactions && (
                    <FloatersOverlay
                      floaters={floaters.filter((f) => f.photoId === photo.id)}
                    />
                  )}
                </div>
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
              </div>
            ))}
          </div>
        )}
      </div>

      <Link
        href="/"
        className="fixed bottom-6 right-6 z-40 rounded-full bg-white/90 text-purple-900 font-semibold px-6 py-3 shadow-2xl active:scale-95 transition-transform"
      >
        📷 Prendre une photo
      </Link>

      {spotlight && (
        <div
          key={spotlight.id}
          className="spotlight-pop-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 md:p-12"
        >
          <div className="relative flex max-h-full max-w-full items-center justify-center">
            <img
              src={resolveUrl(spotlight.url)}
              alt=""
              className="max-w-full max-h-[82vh] rounded-2xl shadow-2xl ring-4 ring-white/30 object-contain"
            />
            {features.reactions && (
              <div className="absolute bottom-2 md:bottom-3 left-1/2 flex w-max max-w-[90vw] -translate-x-1/2 flex-wrap justify-center gap-1.5 md:gap-2">
                {reactionEmojis.map((emoji) => (
                  <span
                    key={emoji}
                    className="flex shrink-0 items-center gap-1 md:gap-1.5 rounded-full bg-black/60 px-2 py-1 md:px-3 md:py-1.5 text-white backdrop-blur-sm ring-1 ring-white/20"
                  >
                    <span className="text-base md:text-xl">{emoji}</span>
                    <span className="text-xs md:text-base tabular-nums">
                      {spotlight.reactions?.[emoji] ?? 0}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {features.reactions && (
              <FloatersOverlay
                floaters={floaters.filter((f) => f.photoId === spotlight.id)}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
