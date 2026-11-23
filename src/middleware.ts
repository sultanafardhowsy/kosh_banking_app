import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * UX-only redirects: send signed-out visitors to /login.
 * This is NOT the security boundary — it only checks that a session cookie
 * exists. Real checks happen in every API handler (requireRole / ownership)
 * and in each role's layout (server-side role check).
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/accounts",
  "/transfer",
  "/transactions",
  "/requests",
  "/loans",
  "/cards",
  "/notifications",
  "/profile",
  "/staff",
  "/admin",
];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  if (!getSessionCookie(req)) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
