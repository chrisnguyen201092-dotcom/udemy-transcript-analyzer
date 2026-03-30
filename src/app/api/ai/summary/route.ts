import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";

const SummarySchema = z.object({
  lessonId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { lessonId, apiKey, baseUrl, model } = SummarySchema.parse(await req.json());

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: true },
    });

    if (!lesson?.transcript) {
      return NextResponse.json(
        { error: "No transcript available" },
        { status: 400 }
      );
    }

    const client = createAIClient(apiKey, baseUrl);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: getSystemPrompt("summary"),
        },
        {
          role: "user",
          content: `Tóm tắt bài học sau đây:\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung:\n${lesson.transcript}`,
        },
      ],
    });

    const raw = response.choices[0].message.content ?? "";
    const summary = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Persist to DB
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { summary },
    });

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[summary]", msg);
    return NextResponse.json(
      { error: `Failed to generate summary: ${msg}` },
      { status: 500 }
    );
  }
}
