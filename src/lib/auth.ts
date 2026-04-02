/**
 * Authentication helper for API routes (v1.3 Multi-User Foundation)
 *
 * Phase 6: Stub that returns first user or null (no JWT yet).
 * Phase 7: Will implement real JWT validation from HttpOnly cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Result of auth extraction — userId or null if unauthenticated */
export type AuthResult = { userId: string } | null;

/**
 * Extract authenticated userId from request.
 *
 * Phase 6 (current): Returns the first User in DB, or null if no users exist.
 * Phase 7 (future): Will parse JWT from `inkgest_session` cookie, validate
 *   signature + tokenVersion, and return userId.
 */
export async function getAuthUserId(
  _req: NextRequest
): Promise<string | null> {
  // STUB: Return first user in DB (bootstrap user)
  // TODO(phase-7): Replace with JWT cookie parsing + validation
  const user = await prisma.user.findFirst({
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return user?.id ?? null;
}

/**
 * Wrap an API route handler with authentication.
 * Returns 401 if no authenticated user found.
 *
 * Usage:
 * ```ts
 * export const GET = withAuth(async (req, { userId }) => {
 *   const courses = await prisma.course.findMany({ where: { userId } });
 *   return NextResponse.json(courses);
 * });
 * ```
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
