/**
 * GET /api/user/preferences — Get user preferences.
 * PUT /api/user/preferences — Update user preferences (merge, not replace).
 *
 * Note: preferences is stored as String? in Prisma (JSON blob).
 * We JSON.parse on read and JSON.stringify on write.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

/** Safely parse preferences string into object */
function parsePrefs(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Strict schema — only known preference fields are accepted */
const PreferencesSchema = z
  .object({
    language: z.string().optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    autoplay: z.boolean().optional(),
    playbackSpeed: z.number().min(0.25).max(4).optional(),
    subtitles: z.boolean().optional(),
    emailNotifications: z.boolean().optional(),
    aiModel: z.string().optional(),
  })
  .strict();

export const GET = withAuth(async (_req: NextRequest, { userId }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  return NextResponse.json({ preferences: parsePrefs(user?.preferences) });
});

export const PUT = withAuth(async (req: NextRequest, { userId }) => {
  try {
    const raw = await req.json();

    // Validate against known preference fields only
    const parsed = PreferencesSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const body = parsed.data;

    // Merge with existing preferences
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const merged = {
      ...parsePrefs(current?.preferences),
      ...body,
    };

    const user = await prisma.user.update({
      where: { id: userId },
      data: { preferences: JSON.stringify(merged) },
      select: { preferences: true },
    });

    return NextResponse.json({ preferences: parsePrefs(user.preferences) });
  } catch (err) {
    console.error("[user/preferences]", err);
    return NextResponse.json(
      { error: "Preferences update failed" },
      { status: 500 }
    );
  }
});
