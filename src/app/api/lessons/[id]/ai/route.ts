import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: {
        summary: true,
        explanation: true,
        quiz: true,
        flashcards: true,
        exercises: true,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    return NextResponse.json({
      summary: lesson.summary ?? null,
      explanation: lesson.explanation ?? null,
      quiz: lesson.quiz ?? null,
      flashcards: lesson.flashcards ?? null,
      exercises: lesson.exercises ?? null,
    });
  } catch (error) {
    console.error("[lesson-ai]", error);
    return NextResponse.json(
      { error: "Failed to load AI data" },
      { status: 500 }
    );
  }
}
