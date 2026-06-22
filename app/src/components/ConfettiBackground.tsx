"use client";

import { useEffect, useState } from "react";

const CONFETTI_COLORS = [
  "#f472b6",
  "#c084fc",
  "#facc15",
  "#34d399",
  "#60a5fa",
  "#fb7185",
];

const CONFETTI_PIECES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 53 + 11) % 100,
  delay: -(((i * 37) % 90) / 10),
  duration: 7 + ((i * 29) % 50) / 10,
  size: 6 + ((i * 13) % 7),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}));

const BURST_PIECES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 37 + 5) % 100,
  delay: -(((i * 19) % 30) / 10),
  duration: 2 + ((i * 13) % 25) / 10,
  size: 8 + ((i * 9) % 10),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}));

/** Burst ponctuel (télécommande écran), même sans ConfettiBackground monté. */
export function ConfettiBurstOverlay() {
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    function onBurst() {
      setBurstKey((k) => k + 1);
    }
    window.addEventListener("screen:confetti", onBurst);
    return () => window.removeEventListener("screen:confetti", onBurst);
  }, []);

  if (burstKey === 0) return null;

  return (
    <div
      key={burstKey}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[200] overflow-hidden"
    >
      {BURST_PIECES.map((p, i) => (
        <span
          key={i}
          className={`confetti-piece absolute ${
            p.round ? "rounded-full" : "rounded-[2px]"
          }`}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Pluie de confettis CSS en continu, purement décorative.
 * Écoute `screen:confetti` pour un burst ponctuel (télécommande écran).
 */
export function ConfettiBackground({ accent }: { readonly accent?: string }) {
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    function onBurst() {
      setBurstKey((k) => k + 1);
    }
    window.addEventListener("screen:confetti", onBurst);
    return () => window.removeEventListener("screen:confetti", onBurst);
  }, []);

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        {CONFETTI_PIECES.map((p, i) => (
          <span
            key={i}
            className={`confetti-piece absolute ${
              p.round ? "rounded-full" : "rounded-[2px]"
            }`}
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              backgroundColor: accent && i % 3 === 0 ? accent : p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      {burstKey > 0 && (
        <div
          key={burstKey}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
        >
          {BURST_PIECES.map((p, i) => (
            <span
              key={i}
              className={`confetti-piece absolute ${
                p.round ? "rounded-full" : "rounded-[2px]"
              }`}
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 1.6,
                backgroundColor: p.color,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
