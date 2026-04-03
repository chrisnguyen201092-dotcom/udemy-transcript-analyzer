/**
 * GET /api/auth/me — Return current authenticated user info.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        preferences: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Parse preferences from JSON string to object for the client
    let preferences: Record<string, unknown> = {};
    if (user.preferences) {
      try {
        const parsed = JSON.parse(user.preferences);
        preferences = typeof parsed === "object" && parsed !== null ? parsed : {};
      } catch {
        preferences = {};
      }
    }

    return NextResponse.json({
      user: { ...user, preferences },
    });
  } catch (err) {
    console.error("[auth/me]", err);
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
}
