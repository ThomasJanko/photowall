"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getPhotoService } from "@/lib/photoService";
import type { PlanningEvent } from "@/lib/types";
import { QuickNav } from "@/components/QuickNav";
import { ConfettiBackground } from "@/components/ConfettiBackground";
import { useEventConfig } from "@/components/EventThemeProvider";
import { buildNavLinks } from "@/lib/quickNavLinks";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { usePathname } from "next/navigation";
import { deferCallback } from "@/lib/deferCallback";
import { MapPin, Clock } from "lucide-react";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

// ─── helpers ────────────────────────────────────────────────────────────────

function resolveUrl(url: string) {
  if (!url) return url;
  if (url.startsWith("http")) return url;
  return `${SERVER_URL}${url}`;
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  } catch {
    return isoDate;
  }
}

function formatTime(time: string): string {
  return time; // already "HH:MM"
}

function isGuestSurprise(
  ev: PlanningEvent,
  isAdmin: boolean,
  allEvents: PlanningEvent[],
  now = Date.now()
): boolean {
  if (isAdmin || ev.surprise !== true) return false;
  if (isNow(ev, allEvents, now)) return false;
  return true;
}

/** Retourne true si l'événement est passé (date+heure < maintenant). */
function isPast(ev: PlanningEvent, now = Date.now()): boolean {
  return new Date(`${ev.date}T${ev.time}`).getTime() < now;
}

/** Retourne true si l'événement est "maintenant" (entre son heure de début et
 *  une heure après, ou jusqu'au prochain event). */
function isNow(
  ev: PlanningEvent,
  allEvents: PlanningEvent[],
  now = Date.now()
): boolean {
  const start = new Date(`${ev.date}T${ev.time}`).getTime();
  if (now < start) return false;

  // Cherche le prochain event
  const sorted = [...allEvents].sort(
    (a, b) =>
      new Date(`${a.date}T${a.time}`).getTime() -
      new Date(`${b.date}T${b.time}`).getTime()
  );
  const idx = sorted.findIndex((e) => e.id === ev.id);
  const next = sorted[idx + 1];
  const end = next
    ? new Date(`${next.date}T${next.time}`).getTime()
    : start + 60 * 60 * 1000;

  return now >= start && now < end;
}

/** Groupe les events par date (string YYYY-MM-DD). */
function groupByDate(events: PlanningEvent[]): Map<string, PlanningEvent[]> {
  const map = new Map<string, PlanningEvent[]>();
  for (const ev of events) {
    const list = map.get(ev.date) ?? [];
    list.push(ev);
    map.set(ev.date, list);
  }
  return map;
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function NowBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-bold text-green-300 ring-1 ring-green-400/40">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
      </span>
      En cours
    </span>
  );
}

function CountdownToNext({
  next,
  isAdmin,
  allEvents,
  now,
}: {
  next: PlanningEvent;
  isAdmin: boolean;
  allEvents: PlanningEvent[];
  now: number;
}) {
  const [diff, setDiff] = useState("");
  const hidden = isGuestSurprise(next, isAdmin, allEvents, now);

  useEffect(() => {
    function update() {
      const target = new Date(`${next.date}T${next.time}`).getTime();
      const delta = target - Date.now();
      if (delta <= 0) {
        setDiff("maintenant !");
        return;
      }
      const h = Math.floor(delta / 3_600_000);
      const m = Math.floor((delta % 3_600_000) / 60_000);
      const s = Math.floor((delta % 60_000) / 1_000);
      if (h > 0) setDiff(`dans ${h}h ${m.toString().padStart(2, "0")}min`);
      else if (m > 0) setDiff(`dans ${m}min ${s.toString().padStart(2, "0")}s`);
      else setDiff(`dans ${s}s`);
    }
    update();
    const id = setInterval(update, 1_000);
    return () => clearInterval(id);
  }, [next]);

  return (
    <div className="mx-auto mb-8 max-w-sm rounded-2xl bg-white/5 px-5 py-4 text-center ring-1 ring-white/15">
      <p className="mb-1 text-xs tracking-wider text-purple-300 uppercase">
        Prochain événement
      </p>
      <p className="text-lg font-bold text-white">
        {hidden ? "🎁" : (next.emoji ?? "📌")}{" "}
        {hidden ? "Surprise !" : next.title}
      </p>
      <p className="mt-1 text-2xl font-extrabold text-pink-300 tabular-nums">
        {diff}
      </p>
    </div>
  );
}

function DayDivider({ date }: { date: string }) {
  return (
    <div className="relative my-8 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/15" />
      <span className="shrink-0 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-purple-200 capitalize ring-1 ring-white/20">
        {formatDate(date)}
      </span>
      <div className="h-px flex-1 bg-white/15" />
    </div>
  );
}

function PlanningCard({
  event,
  allEvents,
  isCurrentEvent,
  isAdmin,
  isRevealing,
  now,
  cardRef,
}: {
  event: PlanningEvent;
  allEvents: PlanningEvent[];
  isCurrentEvent: boolean;
  isAdmin: boolean;
  isRevealing?: boolean;
  now: number;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const past = isPast(event, now);
  const hidden = isGuestSurprise(event, isAdmin, allEvents, now);
  const color = hidden ? "#e879f9" : (event.color ?? "#f472b6");
  const displayEmoji = hidden ? "🎁" : (event.emoji ?? "📌");
  const displayTitle = hidden ? "Surprise !" : event.title;

  return (
    <div
      ref={cardRef}
      className={`relative rounded-2xl p-4 ring-1 transition-all duration-500 ${
        isRevealing
          ? "planning-reveal-pop bg-white/10 shadow-lg shadow-black/20 ring-white/30"
          : hidden
            ? "planning-surprise-card ring-pink-400/30"
            : isCurrentEvent
              ? "bg-white/10 shadow-lg shadow-black/20 ring-white/30"
              : past
                ? "bg-white/3 opacity-60 ring-white/8"
                : "bg-white/5 ring-white/15"
      }`}
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      {/* Indicateur "En cours" */}
      {isCurrentEvent && (
        <div className="absolute -top-3 left-4">
          <NowBadge />
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Emoji + heure */}
        <div className="flex w-12 shrink-0 flex-col items-center">
          <span className={`text-3xl ${hidden ? "animate-pulse" : ""}`}>
            {displayEmoji}
          </span>
          <span
            className="mt-1 font-mono text-xs font-bold tabular-nums"
            style={{ color }}
          >
            {formatTime(event.time)}
          </span>
          {event.duration && !hidden && (
            <span className="mt-0.5 text-[10px] text-purple-400">
              {event.duration}
            </span>
          )}
        </div>

        {/* Contenu */}
        <div className="min-w-0 flex-1">
          <h3
            className={`text-base font-bold ${past && !hidden ? "text-purple-300" : "text-white"}`}
          >
            {displayTitle}
          </h3>

          {hidden && (
            <p className="mt-1 text-sm text-purple-300 italic">
              Quelque chose de spécial t&apos;attend…
            </p>
          )}

          {!hidden && event.location && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-purple-300">
              <MapPin className="h-3 w-3 shrink-0" />
              {event.location}
            </p>
          )}

          {!hidden && event.description && (
            <p className="mt-1.5 text-sm leading-relaxed text-purple-200">
              {event.description}
            </p>
          )}

          {!hidden && event.photoUrl && (
            <img
              src={resolveUrl(event.photoUrl)}
              alt={event.title}
              className="mt-3 max-h-52 w-full rounded-xl object-cover ring-1 ring-white/15"
            />
          )}
        </div>

        {/* Pastille passé */}
        {past && !isCurrentEvent && (
          <span className="shrink-0 text-lg text-white/30">✓</span>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function PlanningPage() {
  const pathname = usePathname();
  const { config, accent } = useEventConfig();
  const isAdmin = useIsAdmin();
  const enabled = config.features.planning === true;

  const navLinks = useMemo(
    () => buildNavLinks(pathname, config.features, isAdmin),
    [pathname, config.features, isAdmin]
  );

  const [events, setEvents] = useState<PlanningEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealingIds, setRevealingIds] = useState<Set<string>>(
    () => new Set()
  );
  const [now, setNow] = useState(() => Date.now());
  const nowRef = useRef<HTMLDivElement>(null);
  const eventsRef = useRef(events);
  const guestSurpriseHiddenRef = useRef<Map<string, boolean>>(new Map());
  eventsRef.current = events;

  const loadData = useCallback(async () => {
    try {
      const list = await getPhotoService().listPlanningEvents();
      setEvents(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      deferCallback(() => setLoading(false));
      return;
    }
    deferCallback(() => void loadData());
  }, [enabled, loadData]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [enabled]);

  // Temps réel
  useEffect(() => {
    if (!enabled) return;
    const service = getPhotoService();
    const u1 = service.onPlanningNew?.((ev) => {
      setEvents((prev) =>
        prev.some((e) => e.id === ev.id)
          ? prev
          : [...prev, ev].sort((a, b) =>
              `${a.date}T${a.time}` < `${b.date}T${b.time}` ? -1 : 1
            )
      );
    });
    const u2 = service.onPlanningUpdated?.((ev) => {
      const old = eventsRef.current.find((e) => e.id === ev.id);
      if (old?.surprise && !ev.surprise) {
        deferCallback(() => {
          setRevealingIds((ids) => new Set(ids).add(ev.id));
          setTimeout(() => {
            setRevealingIds((ids) => {
              const next = new Set(ids);
              next.delete(ev.id);
              return next;
            });
          }, 700);
        });
      }
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? ev : e)));
    });
    const u3 = service.onPlanningRemoved?.((payload) => {
      setEvents((prev) => prev.filter((e) => e.id !== payload.id));
    });
    const u4 = service.onPlanningList?.((list) => {
      setEvents(list);
    });
    return () => {
      u1?.();
      u2?.();
      u3?.();
      u4?.();
    };
  }, [enabled]);

  // Scroll vers "maintenant" au chargement
  useEffect(() => {
    if (!loading && nowRef.current) {
      nowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading]);

  const sorted = useMemo(
    () =>
      [...events].sort((a, b) => {
        const da = `${a.date}T${a.time}`;
        const db = `${b.date}T${b.time}`;
        return da < db ? -1 : da > db ? 1 : a.order - b.order;
      }),
    [events]
  );

  const currentEventId = useMemo(
    () => sorted.find((ev) => isNow(ev, sorted, now))?.id ?? null,
    [sorted, now]
  );

  const nextEvent = useMemo(
    () =>
      sorted.find((ev) => new Date(`${ev.date}T${ev.time}`).getTime() > now),
    [sorted, now]
  );

  const byDate = useMemo(() => groupByDate(sorted), [sorted]);

  useEffect(() => {
    if (isAdmin) return;
    for (const ev of sorted) {
      const hidden = isGuestSurprise(ev, false, sorted, now);
      const wasHidden = guestSurpriseHiddenRef.current.get(ev.id);
      if (wasHidden === true && !hidden && ev.surprise) {
        deferCallback(() => {
          setRevealingIds((ids) => new Set(ids).add(ev.id));
          setTimeout(() => {
            setRevealingIds((ids) => {
              const next = new Set(ids);
              next.delete(ev.id);
              return next;
            });
          }, 700);
        });
      }
      guestSurpriseHiddenRef.current.set(ev.id, hidden);
    }
  }, [sorted, now, isAdmin]);

  if (!enabled) {
    return (
      <main className="event-gradient-bg flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
        <p className="text-4xl">📅</p>
        <h1 className="text-2xl font-bold text-white">
          Planning non disponible
        </h1>
        <p className="max-w-sm text-purple-200">
          Cette page n&apos;est pas encore activée.
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
    <main className="event-gradient-bg relative min-h-dvh pb-28">
      {config.features.confetti && <ConfettiBackground accent={accent} />}

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8 sm:py-12">
        {/* Header */}
        <header className="mb-8 text-center">
          <p className="mb-2 text-4xl">📅</p>
          <h1 className="text-3xl font-extrabold text-white drop-shadow sm:text-4xl">
            Programme
          </h1>
          <p className="mt-2 text-sm text-purple-200">{config.eventName}</p>
        </header>

        {loading ? (
          <p className="text-center text-purple-200">Chargement…</p>
        ) : sorted.length === 0 ? (
          <div className="py-16 text-center text-purple-300">
            <p className="mb-4 text-5xl">🎉</p>
            <p className="text-lg font-semibold text-white">
              Le programme arrive bientôt…
            </p>
          </div>
        ) : (
          <>
            {/* Countdown vers le prochain event */}
            {nextEvent && !currentEventId && (
              <CountdownToNext
                next={nextEvent}
                isAdmin={isAdmin}
                allEvents={sorted}
                now={now}
              />
            )}

            {/* Timeline par jour */}
            {Array.from(byDate.entries()).map(([date, dayEvents]) => (
              <div key={date}>
                <DayDivider date={date} />

                {/* Ligne verticale */}
                <div className="relative">
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 left-[1.625rem] w-0.5 bg-white/10"
                    aria-hidden
                  />

                  <div className="space-y-4 pl-1">
                    {dayEvents.map((ev) => {
                      const isCurrent = ev.id === currentEventId;
                      return (
                        <PlanningCard
                          key={ev.id}
                          event={ev}
                          allEvents={sorted}
                          isCurrentEvent={isCurrent}
                          isAdmin={isAdmin}
                          isRevealing={revealingIds.has(ev.id)}
                          now={now}
                          cardRef={isCurrent ? nowRef : undefined}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <QuickNav links={navLinks} position="bottom-left" />
    </main>
  );
}
