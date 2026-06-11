import { NextResponse } from "next/server";
import {
  getAdminCode,
  verifyAdminToken,
  extractBearerToken,
} from "@/lib/adminToken";

/**
 * Vérifie le token admin (mode Supabase).
 * Pour une sécurité robuste en prod Supabase, ajouter des RLS policies
 * + Supabase Auth — ce niveau suffit pour un événement ponctuel.
 */
export async function GET(req: Request) {
  const adminCode = getAdminCode();
  const token = extractBearerToken(
    req.headers.get("authorization") ?? undefined,
    req.headers.get("x-admin-token") ?? undefined
  );

  if (!verifyAdminToken(token ?? "", adminCode)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
