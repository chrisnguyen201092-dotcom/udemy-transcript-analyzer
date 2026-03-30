import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";

const ExplainSchema = z.object({
  lessonId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  force: z.boolean().optional(),
  lessonIndex: z.number().int().min(0).optional(),
  totalLessons: z.number().int().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { lessonId, apiKey, baseUrl, model, force, lessonIndex, totalLessons } = ExplainSchema.parse(await req.json());

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

    if (lesson.explanation && !force) {
      return NextResponse.json({ explanation: lesson.explanation });
    }

    const client = createAIClient(apiKey, baseUrl);

    const learnerContext = 
      lessonIndex !== undefined && totalLessons !== undefined
        ? `\n\nBối cảnh người học: Bài học ${lessonIndex + 1} của ${totalLessons} bài.`
        : "";

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: getSystemPrompt("explain"),
        },
        {
          role: "user",
          content: `Giải thích chi tiết bài học sau:\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung bài học:\n${lesson.transcript}${learnerContext}`,
        },
      ],
    });

    const raw = response.choices[0].message.content ?? "";
    const explanation = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Persist to DB
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { explanation },
    });

    return NextResponse.json({ explanation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[explain]", msg);
    return NextResponse.json(
      { error: `Failed to generate explanation: ${msg}` },
      { status: 500 }
    );
  }
}
