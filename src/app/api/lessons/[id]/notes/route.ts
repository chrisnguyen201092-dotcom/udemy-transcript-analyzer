import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export const GET = withAuth(async (_req, { userId, params }) => {
  try {
    const id = params?.id!;

    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
      select: { id: true, updatedAt: true },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    const artifact = await prisma.lessonArtifact.findUnique({
      where: { userId_lessonId_type: { userId, lessonId: id, type: "notes" } },
      select: { content: true, updatedAt: true },
    });

    return NextResponse.json({
      lessonId: lesson.id,
      notes: artifact?.content ?? null,
      updatedAt: (artifact?.updatedAt ?? lesson.updatedAt).toISOString(),
    });
  } catch (error) {
    console.error("Failed to get lesson notes:", error);
    return NextResponse.json(
      { error: "Failed to get lesson notes" },
      { status: 500 }
    );
  }
});

export const PUT = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id!;

    const body = await req.json();
    if (typeof body.notes !== "string") {
      return NextResponse.json(
        { error: "notes field is required and must be a string" },
        { status: 400 }
      );
    }

    const exists = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    const artifact = await prisma.lessonArtifact.upsert({
      where: { userId_lessonId_type: { userId, lessonId: id, type: "notes" } },
      create: { userId, lessonId: id, type: "notes", content: body.notes },
      update: { content: body.notes },
      select: { content: true, updatedAt: true },
    });

    return NextResponse.json({
      id,
      notes: artifact.content,
      updatedAt: artifact.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to save lesson notes:", error);
    return NextResponse.json(
      { error: "Failed to save lesson notes" },
      { status: 500 }
    );
  }
});
