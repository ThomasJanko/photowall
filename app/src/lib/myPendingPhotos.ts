const STORAGE_KEY = "my-pending-photos";

export function getMyPendingPhotoIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function addMyPendingPhoto(id: string): void {
  const ids = getMyPendingPhotoIds();
  if (ids.includes(id)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, id]));
}

export function removeMyPendingPhoto(id: string): void {
  const next = getMyPendingPhotoIds().filter((x) => x !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function countMyPendingPhotos(): number {
  return getMyPendingPhotoIds().length;
}
