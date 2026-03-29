import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateTranscriptSchema = z.object({
  transcript: z.string(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { transcript } = UpdateTranscriptSchema.parse(await req.json());

    const lesson = await prisma.lesson.update({
      where: { id },
      data: { transcript },
    });

    return NextResponse.json(lesson);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update transcript" },
      { status: 500 }
    );
  }
}
