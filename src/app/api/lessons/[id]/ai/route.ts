import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// M-21: Zod validation for AI data update
const AiUpdateSchema = z.object({
  summary: z.string().optional(),
  explanation: z.string().optional(),
  quiz: z.string().optional(),
  flashcards: z.string().optional(),
  exercises: z.string().optional(),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: "At least one AI field must be provided" }
);

export const PUT = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id!;
    const body = await req.json();

    const parsed = AiUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues },
        { status: 400 }
      );
    }

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

    const exists = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Upsert each provided field as a separate LessonArtifact record
    await Promise.all(
      Object.entries(data).map(([type, content]) =>
        prisma.lessonArtifact.upsert({
          where: { userId_lessonId_type: { userId, lessonId: id, type } },
          create: { userId, lessonId: id, type, content },
          update: { content },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[lesson-ai-put]", error);
    return NextResponse.json(
      { error: "Failed to update AI data" },
      { status: 500 }
    );
  }
});

export const GET = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id!;

    // Verify lesson ownership
    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
      select: { id: true },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const artifacts = await prisma.lessonArtifact.findMany({
      where: { lessonId: id, userId },
      select: { type: true, content: true },
    });

    const artifactMap = Object.fromEntries(artifacts.map((a) => [a.type, a.content]));
    const AI_FIELDS = ["summary", "explanation", "quiz", "flashcards", "exercises"] as const;

    return NextResponse.json(
      Object.fromEntries(AI_FIELDS.map((f) => [f, artifactMap[f] ?? null]))
    );
  } catch (error) {
    console.error("[lesson-ai]", error);
    return NextResponse.json(
      { error: "Failed to load AI data" },
      { status: 500 }
    );
  }
});
