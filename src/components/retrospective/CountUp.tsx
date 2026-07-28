"use client";

import { useEffect, useState } from "react";

interface CountUpProps {
  target: number;
  durationMs?: number;
  className?: string;
}

/** Compteur animé (count-up) pour les chiffres du show. */
export function CountUp({
  target,
  durationMs = 2000,
  className = "",
}: CountUpProps) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frame: number;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return (
    <span className={`tabular-nums ${className}`}>
      {value.toLocaleString("fr-FR")}
    </span>
  );
}
