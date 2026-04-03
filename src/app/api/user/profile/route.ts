/**
 * GET/PUT /api/user/profile — Read or update user profile.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

/** GET — Return current user profile */
export const GET = withAuth(async (_req: NextRequest, { userId }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ user });
});

const ProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export const PUT = withAuth(async (req: NextRequest, { userId }) => {
  try {
    const body = ProfileSchema.parse(await req.json());

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: body.name },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[user/profile]", err);
    return NextResponse.json(
      { error: "Profile update failed" },
      { status: 500 }
    );
  }
});
