/**
 * Next.js Middleware — Route protection for Inkgest v1.3.
 *
 * - Public auth pages (/login, /register, etc.): redirect to /dashboard if JWT valid
 * - Protected pages: redirect to /login?redirect={pathname} if no JWT
 * - Protected API routes: return 401 JSON if no JWT
 * - JWT check is signature + expiry only (tokenVersion validated in withAuth)
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "inkgest_session";

/** Pages that should redirect to /dashboard when user is already authenticated */
const PUBLIC_AUTH_PAGES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);

/** API routes that don't require authentication */
const PUBLIC_API_ROUTES = new Set([
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
]);

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function isValidJwt(token: string): Promise<boolean> {
  try {
    const secret = getJwtSecret();
    if (!secret) return false; // fail closed — no secret means no valid tokens
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const hasValidToken = token ? await isValidJwt(token) : false;

  // 1. Public auth pages: redirect authenticated users to /dashboard
  if (PUBLIC_AUTH_PAGES.has(pathname)) {
    if (hasValidToken) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // 2. Public API routes: always allow
  if (PUBLIC_API_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // 3. Protected API routes: return 401 JSON
  if (pathname.startsWith("/api/")) {
    if (!hasValidToken) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 4. Protected pages: redirect to /login
  if (!hasValidToken) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)",
  ],
};
