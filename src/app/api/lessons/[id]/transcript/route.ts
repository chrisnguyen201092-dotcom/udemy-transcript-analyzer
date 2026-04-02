import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

const UpdateTranscriptSchema = z.object({
  transcript: z.string(),
});

export const PUT = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id!;
    const { transcript } = UpdateTranscriptSchema.parse(await req.json());

    // Verify lesson belongs to a course owned by this user
    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
    });
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const updated = await prisma.lesson.update({
      where: { id },
      data: { transcript },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update transcript" },
      { status: 500 }
    );
  }
});
