/**
 * Authentication helper for API routes (v1.3 Multi-User Foundation)
 *
 * Phase 7: Real JWT validation from HttpOnly cookie.
 * Uses LRU cache for tokenVersion checks to minimize DB hits.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, SESSION_COOKIE, type TokenPayload } from "@/lib/jwt";
import { LRUCache } from "@/lib/lru-cache";

/** Cached tokenVersion per userId (TTL 60s, max 1000 users) */
const tokenVersionCache = new LRUCache<number>(1000, 60_000);

/**
 * Extract authenticated user from JWT cookie.
 * Verifies signature, expiration, and tokenVersion against DB (with LRU cache).
 */
export async function getSessionUser(
  req: NextRequest
): Promise<TokenPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload?.userId) return null;

  // Check tokenVersion (revocation) with LRU cache
  let dbVersion = tokenVersionCache.get(payload.userId);
  if (dbVersion === undefined) {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true },
    });
    if (!user) return null;
    dbVersion = user.tokenVersion;
    tokenVersionCache.set(payload.userId, dbVersion);
  }

  if (payload.tokenVersion !== dbVersion) {
    tokenVersionCache.delete(payload.userId);
    return null;
  }

  return payload;
}

/**
 * Convenience: extract just the userId string.
 */
export async function getAuthUserId(
  req: NextRequest
): Promise<string | null> {
  const session = await getSessionUser(req);
  return session?.userId ?? null;
}

/**
 * Invalidate cached tokenVersion for a user (call after logout/password change).
 */
export function invalidateUserCache(userId: string): void {
  tokenVersionCache.delete(userId);
}

/**
 * Wrap an API route handler with authentication.
 * Returns 401 if no authenticated user found.
 */
export function withAuth(
  handler: (
    req: NextRequest,
    ctx: { userId: string; params?: Record<string, string> }
  ) => Promise<Response>
) {
  return async (
    req: NextRequest,
    routeCtx?: { params?: Promise<Record<string, string>> }
  ): Promise<Response> => {
    const userId = await getAuthUserId(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const params = routeCtx?.params ? await routeCtx.params : undefined;
    return handler(req, { userId, params });
  };
}
