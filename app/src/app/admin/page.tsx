"use client";

import { useEffect, useState } from "react";
import { getPhotoService } from "@/lib/photoService";
import type { Photo } from "@/lib/types";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

function resolveUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
}

export default function AdminPage() {
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    const service = getPhotoService();
    service.listPhotos().then(setPhotos).catch(console.error);

    const unsubNew = service.onNewPhoto((photo) => {
      setPhotos((prev) =>
        prev.some((p) => p.id === photo.id) ? prev : [...prev, photo]
      );
    });
    const unsubRemoved = service.onPhotoRemoved((id) => {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    });

    return () => {
      unsubNew();
      unsubRemoved();
    };
  }, []);

  async function handleHide(id: string) {
    if (!confirm("Masquer cette photo du mur ?")) return;
    try {
      await getPhotoService().hidePhoto(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression");
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-1">Administration</h1>
      <p className="text-gray-600 mb-4">
        {photos.length} photo(s) actuellement sur le mur
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {photos
          .slice()
          .reverse()
          .map((photo) => (
            <div
              key={photo.id}
              className="relative rounded-lg overflow-hidden shadow bg-white"
            >
              <img
                src={resolveUrl(photo.url)}
                alt=""
                className="w-full aspect-square object-cover"
              />
              <button
                onClick={() => handleHide(photo.id)}
                className="absolute top-1 right-1 bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-full shadow"
              >
                Masquer
              </button>
            </div>
          ))}
      </div>
    </main>
  );
}
