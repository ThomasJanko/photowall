"use client";

import {
  DEFAULT_PHOTO_FILTER_ID,
  PHOTO_FILTERS,
  getPhotoFilter,
  VIGNETTE_OVERLAY_CLASS,
} from "@/lib/photoFilters";

interface PhotoFilterPickerProps {
  previewUrl: string;
  selectedId: string;
  onSelect: (filterId: string) => void;
}

function FilterThumbnail({
  previewUrl,
  filterId,
  label,
  selected,
  onSelect,
}: {
  previewUrl: string;
  filterId: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const filter = getPhotoFilter(filterId);
  const filterStyle = filter.css ? { filter: filter.css } : undefined;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Filtre ${label}`}
      className={`flex shrink-0 flex-col items-center gap-1.5 transition-transform active:scale-95 ${
        selected ? "opacity-100" : "opacity-85"
      }`}
    >
      <span
        className={`relative h-[60px] w-[60px] overflow-hidden rounded-xl ring-2 transition-shadow ${
          selected
            ? "shadow-lg shadow-pink-500/30 ring-pink-400"
            : "ring-white/25"
        }`}
      >
        <img
          src={previewUrl}
          alt=""
          className="h-full w-full object-cover"
          style={filterStyle}
          draggable={false}
        />
        {filter.vignette && (
          <span className={VIGNETTE_OVERLAY_CLASS} aria-hidden />
        )}
      </span>
      <span
        className={`max-w-[64px] truncate text-[11px] font-medium ${
          selected ? "text-white" : "text-purple-200"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

/** Bandeau horizontal de filtres couleur avec mini-previews. */
export function PhotoFilterPicker({
  previewUrl,
  selectedId,
  onSelect,
}: PhotoFilterPickerProps) {
  return (
    <div className="-mx-1 w-full px-1">
      <p className="mb-2 text-center text-xs font-medium text-purple-200/90">
        Filtres
      </p>
      <div className="flex touch-pan-x snap-x snap-mandatory scrollbar-none gap-3 overflow-x-auto pb-1">
        {PHOTO_FILTERS.map((f) => (
          <div key={f.id} className="snap-start">
            <FilterThumbnail
              previewUrl={previewUrl}
              filterId={f.id}
              label={f.label}
              selected={selectedId === f.id}
              onSelect={() => onSelect(f.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
