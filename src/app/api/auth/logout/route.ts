/**
 * POST /api/auth/logout — Clear session cookie and increment tokenVersion.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, invalidateUserCache } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);

    if (session?.userId) {
      // Increment tokenVersion to invalidate all existing tokens
      await prisma.user.update({
        where: { id: session.userId },
        data: { tokenVersion: { increment: 1 } },
      });
      invalidateUserCache(session.userId);
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (err) {
    console.error("[auth/logout]", err);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
