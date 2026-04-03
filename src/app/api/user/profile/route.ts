/**
 * PUT /api/user/profile — Update user display name.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

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
