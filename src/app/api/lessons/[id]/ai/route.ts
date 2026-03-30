import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Only allow updating specific AI fields
    const allowedFields = ["summary", "explanation", "quiz", "flashcards", "exercises"] as const;
    const data: Record<string, string> = {};
    for (const field of allowedFields) {
      if (typeof body[field] === "string") {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update. Allowed: summary, explanation, quiz, flashcards, exercises" },
        { status: 400 }
      );
    }

    const exists = await prisma.lesson.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    await prisma.lesson.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[lesson-ai-put]", error);
    return NextResponse.json(
      { error: "Failed to update AI data" },
      { status: 500 }
    );
  }
}

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
