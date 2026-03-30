import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const course = await prisma.course.findUnique({ where: { id } });
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

    const existing = await prisma.learnerProfile.findUnique({
      where: { courseId: id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Profile already exists for this course. Use PUT to update." },
        { status: 409 }
      );
    }

    const { level, goal, dailyTimeMin, knownTopics, learningStyle } = parsed.data;

    const profile = await prisma.learnerProfile.create({
      data: {
        courseId: id,
        level,
        goal,
        dailyTimeMin,
        knownTopics: knownTopics ? JSON.stringify(knownTopics) : null,
        learningStyle,
      },
    });

    return NextResponse.json(formatProfile(profile), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const profile = await prisma.learnerProfile.findUnique({
      where: { courseId: id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(formatProfile(profile));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get profile" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const existing = await prisma.learnerProfile.findUnique({
      where: { courseId: id },
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
      where: { courseId: id },
      data: {
        level,
        goal,
        dailyTimeMin,
        knownTopics: knownTopics ? JSON.stringify(knownTopics) : null,
        learningStyle,
      },
    });

    return NextResponse.json(formatProfile(profile));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
