import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken, signSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

/** GET /api/auth/callback?token=...&next=/ */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const next = req.nextUrl.searchParams.get("next") ?? "/";

  const email = token ? await consumeLoginToken(token) : null;
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=invalid", req.url));
  }

  const session = await signSession(email);
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
