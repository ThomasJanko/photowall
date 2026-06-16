"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type {
  TimelineEra,
  TimelineEntry,
  TimelinePageSettings,
} from "@/lib/types";
import { DEFAULT_TIMELINE_PAGE_SETTINGS } from "@/lib/types";
import { PseudoGate } from "@/components/PseudoGate";
import { QuickNav } from "@/components/QuickNav";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { useEventConfig } from "@/components/EventThemeProvider";
import { buildNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { usePathname } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { deferCallback } from "@/lib/deferCallback";
import {
  TimelineEraCard,
  TimelineUnassignedEntries,
} from "@/components/timeline/TimelineEraCard";
import { AddTimelineMemoryModal } from "@/components/timeline/AddTimelineMemoryModal";
import { TimelineImageLightbox } from "@/components/timeline/TimelineImageLightbox";

export default function TimelinePage() {
  const pathname = usePathname();
  const { config, accent } = useEventConfig();
  const isAdmin = useIsAdmin();
  const { showToast } = useToast();
  const enabled = config.features.timeline === true;

  const navLinks = useMemo(
    () => buildNavLinks(pathname, config.features, isAdmin),
    [pathname, config.features, isAdmin]
  );

  const [eras, setEras] = useState<TimelineEra[]>([]);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [pageSettings, setPageSettings] = useState<TimelinePageSettings>(
    DEFAULT_TIMELINE_PAGE_SETTINGS
  );
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{
    src: string;
    caption?: string;
  } | null>(null);

  const moderationEnabled = config.features.moderationRequired === true;

  const entriesByEra = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    const unassigned: TimelineEntry[] = [];
    for (const entry of entries) {
      if (entry.eraId) {
        const list = map.get(entry.eraId) ?? [];
        list.push(entry);
        map.set(entry.eraId, list);
      } else {
        unassigned.push(entry);
      }
    }
    return { map, unassigned };
  }, [entries]);

  const loadData = useCallback(async () => {
    const service = getPhotoService();
    if (!service.listTimelineEras || !service.listTimelineEntries) {
      setLoading(false);
      return;
    }
    try {
      const [eraList, entryList, page] = await Promise.all([
        service.listTimelineEras(),
        service.listTimelineEntries(),
        service.listTimelinePageSettings?.() ?? DEFAULT_TIMELINE_PAGE_SETTINGS,
      ]);
      setEras(eraList);
      setEntries(entryList);
      setPageSettings(page);
    } catch (err) {
      console.error(err);
      showToast("Impossible de charger la frise", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!enabled) {
      deferCallback(() => setLoading(false));
      return;
    }
    deferCallback(() => void loadData());
  }, [enabled, loadData]);

  useEffect(() => {
    if (!enabled) return;
    const service = getPhotoService();

    const unsubNew = service.onNewTimelineEntry?.((entry) => {
      setEntries((prev) =>
        prev.some((e) => e.id === entry.id) ? prev : [...prev, entry]
      );
    });

    const unsubEras = service.onTimelineErasUpdated?.((next) => {
      setEras(next);
    });

    const unsubPage = service.onTimelinePageUpdated?.((next) => {
      setPageSettings(next);
    });

    return () => {
      unsubNew?.();
      unsubEras?.();
      unsubPage?.();
    };
  }, [enabled]);

  async function handleAddMemory(data: {
    text: string;
    author: string;
    eraId: string | null;
    photo?: Blob;
  }) {
    const service = getPhotoService();
    if (!service.addTimelineEntry) return;

    const entry = await service.addTimelineEntry(data);
    if (entry.approved !== false) {
      setEntries((prev) =>
        prev.some((e) => e.id === entry.id) ? prev : [...prev, entry]
      );
      showToast("Souvenir publié !", "success");
    } else {
      showToast("Souvenir envoyé — en attente de validation", "success");
    }
  }

  if (!enabled) {
    return (
      <main className="event-gradient-bg flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-4xl">🕰️</p>
        <h1 className="text-2xl font-bold text-white">Frise non disponible</h1>
        <p className="max-w-sm text-purple-200">
          Cette page n&apos;est pas activée pour l&apos;instant.
        </p>
        <Link
          href="/"
          className="rounded-full bg-white/10 px-6 py-3 font-semibold text-white ring-1 ring-white/20"
        >
          ← Retour à l&apos;accueil
        </Link>
      </main>
    );
  }

  return (
    <PseudoGate>
      <main className="event-gradient-bg relative min-h-dvh pb-28">
        {config.features.confetti && <ConfettiBackground accent={accent} />}

        <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:py-12 lg:mx-0 lg:ml-8 lg:max-w-4xl xl:ml-12 xl:max-w-5xl">
          <header className="mb-10 text-center">
            <p className="mb-2 text-4xl">{pageSettings.emoji}</p>
            <h1 className="text-3xl font-extrabold text-white drop-shadow sm:text-4xl">
              {pageSettings.title}
            </h1>
            <p className="mt-2 text-sm text-purple-200 sm:text-base">
              {pageSettings.subtitle}
            </p>
          </header>

          {loading ? (
            <p className="text-center text-purple-200">Chargement…</p>
          ) : eras.length === 0 ? (
            <p className="text-center text-purple-200">
              La frise sera bientôt disponible…
            </p>
          ) : (
            <div className="relative">
              <div
                className="pointer-events-none absolute top-0 bottom-0 left-[1.15rem] w-0.5 bg-white/15"
                aria-hidden
              />
              {eras.map((era, index) => (
                <TimelineEraCard
                  key={era.id}
                  era={era}
                  index={index}
                  entries={entriesByEra.map.get(era.id) ?? []}
                  onPhotoClick={(src, caption) => setLightbox({ src, caption })}
                />
              ))}
              <TimelineUnassignedEntries
                entries={entriesByEra.unassigned}
                onPhotoClick={(src, caption) => setLightbox({ src, caption })}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-linear-to-r from-pink-500 to-purple-500 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-pink-900/40 transition-transform active:scale-95"
        >
          ✨ Ajouter un souvenir
        </button>

        <QuickNav links={navLinks} position="bottom-left" />

        <AddTimelineMemoryModal
          open={modalOpen}
          eras={eras}
          moderationEnabled={moderationEnabled}
          onClose={() => setModalOpen(false)}
          onSubmit={handleAddMemory}
        />

        {lightbox && (
          <TimelineImageLightbox
            src={lightbox.src}
            caption={lightbox.caption}
            onClose={() => setLightbox(null)}
          />
        )}
      </main>
    </PseudoGate>
  );
}
