import { Target } from "lucide-react";

interface ChallengeBadgeProps {
  label: string;
  emoji?: string;
  compact?: boolean;
  /** Coin absolu sur vignette (défaut) vs flux normal pour lightbox */
  floating?: boolean;
}

/** Tag défi affiché sur une photo (/wall). */
export function ChallengeBadge({
  label,
  emoji,
  compact,
  floating = true,
}: ChallengeBadgeProps) {
  return (
    <span
      className={`pointer-events-none z-10 inline-flex max-w-full items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-white ring-1 ring-white/25 backdrop-blur-sm ${
        floating
          ? `absolute top-1.5 left-1.5 max-w-[85%] ${
              compact ? "text-[10px]" : "text-xs"
            }`
          : `text-sm sm:text-base ${compact ? "text-xs" : ""}`
      }`}
      title={label}
    >
      {emoji ? (
        <span aria-hidden>{emoji}</span>
      ) : (
        <Target className="h-3 w-3 shrink-0" aria-hidden />
      )}
      <span
        className={`leading-tight font-semibold ${floating ? "truncate" : ""}`}
      >
        {label}
      </span>
    </span>
  );
}
