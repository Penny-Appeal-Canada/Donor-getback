import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

// lib/auth.ts transitively imports the Prisma client (via lib/db.ts), which
// isn't Edge-compatible, so this middleware runs on the Node.js runtime
// instead of the Edge default (stable since Next 15.2).
export const runtime = "nodejs";

const PUBLIC_PATHS = ["/login", "/api/auth/", "/api/webhooks/", "/thank-you"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const email = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (email) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
