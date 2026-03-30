import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        roadmap: true,
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    return NextResponse.json({
      roadmap: course.roadmap ?? null,
    });
  } catch (error) {
    console.error("[course-ai]", error);
    return NextResponse.json(
      { error: "Failed to load course AI data" },
      { status: 500 }
    );
  }
}
