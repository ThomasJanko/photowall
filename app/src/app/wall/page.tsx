"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/** Durée d'affichage plein écran d'une nouvelle photo (ms). */
const SPOTLIGHT_DURATION_MS = 10_000;

/** Préfixe les URLs relatives (mode local: /uploads/xxx.jpg) avec le serveur. */
function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
}

export default function WallPage() {
  // Photos déjà installées dans la grille
  const [photos, setPhotos] = useState<Photo[]>([]);
  // Nouvelles photos en attente : la première de la file est affichée en plein écran
  const [queue, setQueue] = useState<Photo[]>([]);

  const knownIds = useRef(new Set<string>());

  const spotlight = queue[0] ?? null;

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
      setQueue((prev) => [...prev, photo]);
    });

    const unsubRemoved = service.onPhotoRemoved((id) => {
      knownIds.current.delete(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      setQueue((prev) => prev.filter((p) => p.id !== id));
    });

    return () => {
      unsubNew();
      unsubRemoved();
    };
  }, []);

  // Après 10s en plein écran, la photo en tête de file rejoint la grille
  useEffect(() => {
    if (!spotlight) return;
    const timer = setTimeout(() => {
      setPhotos((prev) =>
        prev.some((p) => p.id === spotlight.id) ? prev : [...prev, spotlight]
      );
      setQueue((prev) => prev.filter((p) => p.id !== spotlight.id));
    }, SPOTLIGHT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [spotlight]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-pink-900 p-4 overflow-hidden">
      <h1 className="text-center text-white text-3xl md:text-5xl font-bold mb-6 drop-shadow-lg">
        🎉 Joyeux 25 ans ! 🎉
      </h1>

      {photos.length === 0 && !spotlight ? (
        <p className="text-center text-purple-200 text-xl mt-20">
          En attente des premières photos... scanne le QR code pour
          participer 📱
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="photo-pop-in aspect-square rounded-xl overflow-hidden shadow-2xl ring-2 ring-white/20"
            >
              <img
                src={resolveUrl(photo.url)}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

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
          <img
            src={resolveUrl(spotlight.url)}
            alt=""
            className="max-w-full max-h-full rounded-2xl shadow-2xl ring-4 ring-white/30 object-contain"
          />
        </div>
      )}
    </main>
  );
}
