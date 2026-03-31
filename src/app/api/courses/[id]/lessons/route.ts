import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateLessonSchema = z.object({
  title: z.string().min(1).max(200),
  transcript: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { title, transcript } = CreateLessonSchema.parse(await req.json());

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
}
