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
      className={`flex shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform ${
        selected ? "opacity-100" : "opacity-85"
      }`}
    >
      <span
        className={`relative h-[60px] w-[60px] overflow-hidden rounded-xl ring-2 transition-shadow ${
          selected
            ? "ring-pink-400 shadow-lg shadow-pink-500/30"
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
    <div className="w-full -mx-1 px-1">
      <p className="mb-2 text-center text-xs font-medium text-purple-200/90">
        Filtres
      </p>
      <div className="scrollbar-none flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory touch-pan-x">
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
