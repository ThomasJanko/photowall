const PSEUDO_KEY = "guest:pseudo";

export function getGuestPseudo(): string | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(PSEUDO_KEY)?.trim();
  return v && v.length >= 2 ? v : null;
}

export function setGuestPseudo(pseudo: string): void {
  localStorage.setItem(PSEUDO_KEY, pseudo.trim().slice(0, 20));
}

export function validatePseudo(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 20) return null;
  return trimmed;
}
