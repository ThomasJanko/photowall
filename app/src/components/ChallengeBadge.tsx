interface ChallengeBadgeProps {
  label: string;
  emoji?: string;
  compact?: boolean;
}

/** Tag défi affiché sur une photo (/wall). */
export function ChallengeBadge({ label, emoji, compact }: ChallengeBadgeProps) {
  return (
    <span
      className={`pointer-events-none absolute top-1.5 left-1.5 z-10 flex max-w-[85%] items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-white ring-1 ring-white/25 backdrop-blur-sm ${
        compact ? "text-[10px]" : "text-xs"
      }`}
      title={label}
    >
      <span>🎯</span>
      {emoji && <span>{emoji}</span>}
      <span className="truncate font-semibold">{label}</span>
    </span>
  );
}
