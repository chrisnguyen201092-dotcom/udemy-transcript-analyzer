import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/prompts";

const RoadmapSchema = z.object({
  lessonId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { lessonId, apiKey, baseUrl, model } = RoadmapSchema.parse(await req.json());

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { course: { include: { lessons: { orderBy: { order: "asc" }, select: { title: true, order: true } } } } },
    });

    if (!lesson?.transcript) {
      return NextResponse.json(
        { error: "No transcript available" },
        { status: 400 }
      );
    }

    // Build course context: list all lessons so AI can see the full curriculum
    const lessonList = lesson.course.lessons
      .map((l) => `  ${l.order}. ${l.title}`)
      .join("\n");

    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl.replace(/\/$/, ""),
    });

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: getSystemPrompt("roadmap"),
        },
        {
          role: "user",
          content: `Phân tích bài học sau và đề xuất lộ trình học tập tối ưu:\n\nKhóa học: ${lesson.course.title}\nDanh sách bài học trong khóa:\n${lessonList}\n\nBài học hiện tại: ${lesson.title} (bài ${lesson.order})\nNội dung bài học:\n${lesson.transcript}`,
        },
      ],
    });

    const raw = response.choices[0].message.content ?? "";
    const roadmap = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Persist to DB
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { roadmap },
    });

    return NextResponse.json({ roadmap });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[roadmap]", msg);
    return NextResponse.json(
      { error: `Failed to generate roadmap: ${msg}` },
      { status: 500 }
    );
  }
}
