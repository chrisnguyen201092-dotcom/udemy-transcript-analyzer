import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ReorderSchema = z.object({
  lessonIds: z.array(z.string().min(1)).min(1),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { lessonIds } = ReorderSchema.parse(await req.json());

    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // H-8: Verify ALL lesson IDs actually belong to this course
    const verifiedCount = await prisma.lesson.count({
      where: { id: { in: lessonIds }, courseId: id },
    });
    if (verifiedCount !== lessonIds.length) {
      return NextResponse.json(
        { error: "Some lessons don't belong to this course" },
        { status: 400 }
      );
    }

    // Update order for each lesson in a transaction
    await prisma.$transaction(
      lessonIds.map((lessonId, index) =>
        prisma.lesson.update({
          where: { id: lessonId },
          data: { order: index + 1 },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Failed to reorder lessons" }, { status: 500 });
  }
}
