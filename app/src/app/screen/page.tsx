"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { getPhotoService } from "@/lib/photoService";
import type { ScreenCommand, ScreenPath } from "@/lib/types";
import { deferCallback } from "@/lib/deferCallback";
import { ConfettiBurstOverlay } from "@/components/ConfettiBackground";
import { ScreenModeContext } from "@/lib/screenMode";

const OSD_HIDE_MS = 3_000;
const SCROLL_STEP = 300;
/** Musique d'ambiance optionnelle (laisser vide si aucun fichier). */
const AMBIENT_MUSIC_SRC = "/music/retrospective.mp3";

const WallPage = dynamic(() => import("@/app/wall/page"), { ssr: false });
const PlanningPage = dynamic(() => import("@/app/planning/page"), {
  ssr: false,
});
const TimelinePage = dynamic(() => import("@/app/timeline/page"), {
  ssr: false,
});
const CountdownPage = dynamic(() => import("@/app/countdown/page"), {
  ssr: false,
});
const ClassementPage = dynamic(() => import("@/app/classement/page"), {
  ssr: false,
});
const RetrospectivePage = dynamic(() => import("@/app/retrospective/page"), {
  ssr: false,
});

function renderCurrentView(path: ScreenPath) {
  const views: Record<ScreenPath, ComponentType> = {
    "/wall": WallPage,
    "/planning": PlanningPage,
    "/timeline": TimelinePage,
    "/countdown": CountdownPage,
    "/classement": ClassementPage,
    "/retrospective": RetrospectivePage,
  };
  const View = views[path] ?? WallPage;
  return <View />;
}

export default function ScreenPage() {
  const [currentPath, setCurrentPath] = useState<ScreenPath>("/wall");
  const [volume, setVolume] = useState(0.5);
  const [zoom, setZoom] = useState(1);
  const [showOsd, setShowOsd] = useState(true);
  const [connected, setConnected] = useState(true);
  /** false = overlay "Tap pour activer" visible (débloque l'autoplay navigateur) */
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const osdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showOsdBriefly = useCallback(() => {
    setShowOsd(true);
    if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    osdTimerRef.current = setTimeout(() => {
      setShowOsd(false);
      osdTimerRef.current = null;
    }, OSD_HIDE_MS);
  }, []);

  const applyVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolume(clamped);
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = clamped;
    audio.muted = clamped === 0;
  }, []);

  /**
   * Débloque l'autoplay navigateur via un geste utilisateur explicite.
   * On play+pause l'audio (silencieux) pour "pré-autoriser" les futurs .play().
   */
  function handleUnlockAudio() {
    const audio = audioRef.current;
    if (!audio) { setAudioUnlocked(true); return; }
    audio.muted = true;
    audio.play()
      .then(() => { audio.pause(); audio.muted = false; })
      .catch(() => {})
      .finally(() => setAudioUnlocked(true));
  }

  const executeCommand = useCallback(
    (cmd: ScreenCommand) => {
      switch (cmd.type) {
        case "navigate":
          setCurrentPath(cmd.path);
          showOsdBriefly();
          break;
        case "scroll": {
          const el = scrollContainerRef.current;
          if (!el) break;
          const amount = cmd.amount ?? SCROLL_STEP;
          if (cmd.direction === "top") {
            el.scrollTo({ top: 0, behavior: "smooth" });
          } else if (cmd.direction === "bottom") {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
          } else if (cmd.direction === "up") {
            el.scrollBy({ top: -amount, behavior: "smooth" });
          } else {
            el.scrollBy({ top: amount, behavior: "smooth" });
          }
          showOsdBriefly();
          break;
        }
        case "volume":
          applyVolume(cmd.value);
          showOsdBriefly();
          break;
        case "zoom":
          setZoom(Math.max(0.5, Math.min(2, cmd.level)));
          showOsdBriefly();
          break;
        case "fullscreen":
          void document.documentElement.requestFullscreen().catch(() => {});
          showOsdBriefly();
          break;
        case "action":
          if (cmd.name === "confetti:burst") {
            window.dispatchEvent(new CustomEvent("screen:confetti"));
            showOsdBriefly();
          }
          if (cmd.name === "audio:play") {
            const audio = audioRef.current;
            if (audio) {
              audio.play().then(() => setIsPlaying(true)).catch(console.warn);
            }
            showOsdBriefly();
          }
          if (cmd.name === "audio:stop") {
            const audio = audioRef.current;
            if (audio) {
              audio.pause();
              audio.currentTime = 0;
              setIsPlaying(false);
            }
            showOsdBriefly();
          }
          if (cmd.name === "audio:toggle") {
            const audio = audioRef.current;
            if (audio) {
              if (audio.paused) {
                audio.play().then(() => setIsPlaying(true)).catch(console.warn);
              } else {
                audio.pause();
                setIsPlaying(false);
              }
            }
            showOsdBriefly();
          }
          if (cmd.name === "retrospective:start") {
            setCurrentPath("/retrospective");
            // Lance la musique depuis l'audio du screen (déjà débloqué par l'overlay)
            const audio = audioRef.current;
            if (audio && AMBIENT_MUSIC_SRC) {
              audio.src = AMBIENT_MUSIC_SRC;
              audio.currentTime = 0;
              audio.volume = volume;
              audio.muted = false;
              audio.loop = true;
              audio.play().then(() => setIsPlaying(true)).catch(console.warn);
            }
            // Signale à la page rétrospective de passer le start-screen
            deferCallback(() => {
              window.dispatchEvent(new CustomEvent("retrospective:autostart"));
            });
            showOsdBriefly();
          }
          break;
        default:
          break;
      }
    },
    [applyVolume, showOsdBriefly]
  );

  useEffect(() => {
    deferCallback(() => {
      void getPhotoService()
        .getScreenState()
        .then((state) => {
          setCurrentPath(state.path);
          applyVolume(state.volume);
          setZoom(state.zoom);
          showOsdBriefly();
        })
        .catch(console.error);
    });
  }, [applyVolume, showOsdBriefly]);

  useEffect(() => {
    const service = getPhotoService();
    const unsubCmd = service.onScreenCommand(executeCommand);
    const unsubConn = service.onConnectionChange((isConnected) => {
      setConnected(isConnected);
      if (isConnected) {
        void service.getScreenState().then((state) => {
          setCurrentPath(state.path);
          applyVolume(state.volume);
          setZoom(state.zoom);
        });
      }
    });
    return () => {
      unsubCmd();
      unsubConn();
      if (osdTimerRef.current) clearTimeout(osdTimerRef.current);
    };
  }, [applyVolume, executeCommand]);

  // Init audio au montage uniquement — ne pas re-set src à chaque changement de volume
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !AMBIENT_MUSIC_SRC) return;
    audio.src = AMBIENT_MUSIC_SRC;
    audio.loop = true;
    audio.volume = volume;
    audio.muted = volume === 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionnellement vide

  // Mise à jour volume sans toucher au src (évite de couper la musique)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = volume === 0;
  }, [volume]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <ConfettiBurstOverlay />

      {/* Overlay d'activation audio (obligatoire pour débloquer l'autoplay navigateur) */}
      {!audioUnlocked && (
        <div
          className="absolute inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-4 bg-black/90 backdrop-blur-sm"
          onClick={handleUnlockAudio}
        >
          <p className="text-5xl">📺</p>
          <p className="text-2xl font-bold text-white">Écran prêt</p>
          <p className="text-purple-300">Appuyez n&apos;importe où pour activer le son</p>
        </div>
      )}

      <ScreenModeContext.Provider value={true}>
        <div
          ref={scrollContainerRef}
          className="scrollbar-none"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {renderCurrentView(currentPath)}
        </div>
      </ScreenModeContext.Provider>

      {showOsd && (
        <div className="pointer-events-none absolute right-4 bottom-4 rounded-xl bg-black/60 px-3 py-2 text-xs text-white/60 backdrop-blur-sm transition-opacity">
          📺 {currentPath} · {isPlaying ? "▶" : "⏸"} · 🔊{" "}
          {Math.round(volume * 100)}% · 🔍 {Math.round(zoom * 100)}%
        </div>
      )}

      {!connected && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <p className="rounded-2xl bg-black/70 px-6 py-4 text-lg font-semibold text-white ring-1 ring-white/20">
            📡 Reconnexion…
          </p>
        </div>
      )}

      <audio ref={audioRef} loop className="hidden" />
    </div>
  );
}
