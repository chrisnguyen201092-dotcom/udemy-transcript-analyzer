import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id!;

    const course = await prisma.course.findFirst({
      where: { id, userId },
      select: { roadmap: true, glossary: true },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const [profile, courseProgress, lessonsWithConcepts] = await Promise.all([
      prisma.learnerProfile.findFirst({ where: { courseId: id, userId } }),
      prisma.courseProgress.findFirst({ where: { courseId: id, userId } }),
      prisma.lesson.count({ where: { courseId: id, keyConcepts: { not: null } } }),
    ]);

    return NextResponse.json({
      roadmap: course.roadmap ?? null,
      glossary: course.glossary ?? null,
      hasKeyConcepts: lessonsWithConcepts > 0,
      hasProfile: profile !== null,
      progressPercent: courseProgress?.completionPct ?? 0,
    });
  } catch (error) {
    console.error("[course-ai]", error);
    return NextResponse.json(
      { error: "Failed to load course AI data" },
      { status: 500 }
    );
  }
});
