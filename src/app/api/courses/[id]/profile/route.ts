import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

const ProfileSchema = z.object({
  level: z.enum(["beginner", "intermediate", "advanced"]),
  goal: z.enum(["career_change", "skill_upgrade", "hobby", "exam_prep"]),
  dailyTimeMin: z.union([z.literal(30), z.literal(60), z.literal(120)]),
  knownTopics: z.array(z.string()).optional(),
  learningStyle: z.enum(["theory_first", "hands_on", "mixed"]),
});

function formatProfile(profile: {
  id: string;
  courseId: string;
  level: string;
  goal: string;
  dailyTimeMin: number;
  knownTopics: string | null;
  learningStyle: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...profile,
    knownTopics: profile.knownTopics
      ? JSON.parse(profile.knownTopics)
      : [],
  };
}

export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id ?? "";

    const course = await prisma.course.findFirst({ where: { id, userId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = ProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { level, goal, dailyTimeMin, knownTopics, learningStyle } = parsed.data;

    let profile;
    try {
      profile = await prisma.learnerProfile.create({
        data: {
          userId,
          courseId: id,
          level,
          goal,
          dailyTimeMin,
          knownTopics: knownTopics ? JSON.stringify(knownTopics) : null,
          learningStyle,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'P2002') {
        return NextResponse.json(
          { error: "Profile already exists for this course. Use PUT to update." },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json(formatProfile(profile), { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
});

export const GET = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id ?? "";

    const course = await prisma.course.findFirst({ where: { id, userId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const profile = await prisma.learnerProfile.findFirst({
      where: { courseId: id, userId },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(formatProfile(profile));
  } catch {
    return NextResponse.json(
      { error: "Failed to get profile" },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id ?? "";

    const course = await prisma.course.findFirst({ where: { id, userId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const existing = await prisma.learnerProfile.findFirst({
      where: { courseId: id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = ProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { level, goal, dailyTimeMin, knownTopics, learningStyle } = parsed.data;

    const profile = await prisma.learnerProfile.update({
      where: { id: existing.id },
      data: {
        level,
        goal,
        dailyTimeMin,
        knownTopics: knownTopics ? JSON.stringify(knownTopics) : null,
        learningStyle,
      },
    });

    return NextResponse.json(formatProfile(profile));
  } catch {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
});
