import { NextResponse } from "next/server";
import {
  createAdminToken,
  getAdminCode,
} from "@/lib/adminToken";

/**
 * Connexion admin (mode Supabase / Next.js).
 * En mode local, la route Express /api/admin/login est utilisée à la place.
 */
export async function POST(req: Request) {
  const adminCode = getAdminCode();
  if (!adminCode) {
    return NextResponse.json({ error: "Admin non configuré" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  if (typeof body?.code !== "string" || body.code !== adminCode) {
    return NextResponse.json({ error: "Code incorrect" }, { status: 401 });
  }

  return NextResponse.json({ token: createAdminToken(adminCode) });
}
