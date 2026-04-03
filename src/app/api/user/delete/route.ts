/**
 * DELETE /api/user/delete — Permanently delete user account and all data.
 * Uses Prisma's onDelete: Cascade to remove all related records.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, invalidateUserCache } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/jwt";

export const DELETE = withAuth(async (_req: NextRequest, { userId }) => {
  try {
    await prisma.user.delete({
      where: { id: userId },
    });

    invalidateUserCache(userId);

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
    console.error("[user/delete]", err);
    return NextResponse.json(
      { error: "Account deletion failed" },
      { status: 500 }
    );
  }
});
