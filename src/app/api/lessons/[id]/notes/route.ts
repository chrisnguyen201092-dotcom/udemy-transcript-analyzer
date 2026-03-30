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
      select: { id: true, notes: true, updatedAt: true },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      lessonId: lesson.id,
      notes: lesson.notes,
      updatedAt: lesson.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to get lesson notes:", error);
    return NextResponse.json(
      { error: "Failed to get lesson notes" },
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

    const body = await req.json();
    if (typeof body.notes !== "string") {
      return NextResponse.json(
        { error: "notes field is required and must be a string" },
        { status: 400 }
      );
    }

    const exists = await prisma.lesson.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!exists) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.lesson.update({
      where: { id },
      data: { notes: body.notes },
      select: { id: true, notes: true, updatedAt: true },
    });

    return NextResponse.json({
      id: updated.id,
      notes: updated.notes,
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Failed to save lesson notes:", error);
    return NextResponse.json(
      { error: "Failed to save lesson notes" },
      { status: 500 }
    );
  }
}
