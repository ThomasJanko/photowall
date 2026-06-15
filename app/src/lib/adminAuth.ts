import { emitToast } from "./toastBus";

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

export const ADMIN_TOKEN_KEY = "admin:token";

/** Erreur levée quand le serveur renvoie 401 sur une action admin. */
export class AdminUnauthorizedError extends Error {
  constructor(message = "Session expirée, reconnecte-toi") {
    super(message);
    this.name = "AdminUnauthorizedError";
  }
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

/** Headers à joindre aux requêtes admin (hide, export, etc.). */
export function adminAuthHeaders(): Record<string, string> {
  const token = getAdminToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function loginUrl(): string {
  const backend = process.env.NEXT_PUBLIC_BACKEND ?? "local";
  return backend === "supabase"
    ? "/api/admin/login"
    : `${SERVER_URL}/api/admin/login`;
}

function verifyUrl(): string {
  const backend = process.env.NEXT_PUBLIC_BACKEND ?? "local";
  return backend === "supabase"
    ? "/api/admin/verify"
    : `${SERVER_URL}/api/admin/verify`;
}

/** Envoie le code admin au serveur et stocke le token reçu. */
export async function adminLogin(code: string): Promise<void> {
  const res = await fetch(loginUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Code incorrect");
  }

  const { token } = (await res.json()) as { token: string };
  setAdminToken(token);
}

/** Vérifie que le token stocké est encore valide. */
export async function verifyAdminSession(): Promise<boolean> {
  const token = getAdminToken();
  if (!token) return false;

  const res = await fetch(verifyUrl(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

/** fetch admin avec token ; 401 → déconnexion automatique. */
export async function adminFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  const auth = adminAuthHeaders();
  for (const [key, value] of Object.entries(auth)) {
    headers.set(key, value);
  }
  if (
    init?.body &&
    !headers.has("Content-Type") &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearAdminToken();
    throw new AdminUnauthorizedError();
  }
  return res;
}

export function handleAdminError(err: unknown): boolean {
  if (err instanceof AdminUnauthorizedError) {
    emitToast(err.message, "error");
    return true;
  }
  return false;
}
