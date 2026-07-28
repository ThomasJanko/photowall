import crypto from "crypto";

/** Token dérivé du code admin (jamais le code en clair côté client). */
export function createAdminToken(adminCode: string): string {
  return crypto
    .createHash("sha256")
    .update(`mur-admin:${adminCode}`)
    .digest("hex");
}

export function verifyAdminToken(
  token: string,
  adminCode: string | undefined
): boolean {
  if (!adminCode || !token) return false;
  return token === createAdminToken(adminCode);
}

export function getAdminCode(): string | undefined {
  return process.env.ADMIN_CODE?.trim() || undefined;
}

export function extractBearerToken(
  authorization: string | undefined,
  xAdminToken: string | string[] | undefined
): string | undefined {
  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7);
  }
  if (typeof xAdminToken === "string") return xAdminToken;
  return undefined;
}
