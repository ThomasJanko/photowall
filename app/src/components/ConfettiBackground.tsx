const CONFETTI_COLORS = [
  "#f472b6", // rose
  "#c084fc", // violet
  "#facc15", // jaune
  "#34d399", // vert
  "#60a5fa", // bleu
  "#fb7185", // corail
];

/**
 * Confettis générés de façon DÉTERMINISTE (pas de Math.random) : le même
 * rendu côté serveur et client évite tout mismatch d'hydratation.
 * Les delays négatifs remplissent l'écran dès le chargement.
 */
const CONFETTI_PIECES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 53 + 11) % 100,
  delay: -(((i * 37) % 90) / 10), // -0 → -8.9s
  duration: 7 + ((i * 29) % 50) / 10, // 7 → 11.9s
  size: 6 + ((i * 13) % 7), // 6 → 12px
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}));

/** Pluie de confettis CSS en continu, purement décorative. */
export function ConfettiBackground() {
  return (
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
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
