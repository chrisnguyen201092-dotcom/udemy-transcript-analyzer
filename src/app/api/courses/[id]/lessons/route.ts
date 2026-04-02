import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

const CreateLessonSchema = z.object({
  title: z.string().min(1).max(200),
  transcript: z.string().optional(),
});

export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id!;
    const { title, transcript } = CreateLessonSchema.parse(await req.json());

    // Verify course ownership
    const course = await prisma.course.findFirst({ where: { id, userId } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const lastLesson = await prisma.lesson.findFirst({
      where: { courseId: id },
      orderBy: { order: "desc" },
    });

    const lesson = await prisma.lesson.create({
      data: {
        courseId: id,
        title,
        transcript: transcript || null,
        order: (lastLesson?.order || 0) + 1,
      },
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  }
});
