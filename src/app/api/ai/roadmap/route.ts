import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";

const RoadmapSchema = z.object({
  courseId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { courseId, apiKey, baseUrl, model } = RoadmapSchema.parse(await req.json());

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          select: { title: true, order: true, transcript: true },
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    const lessonsWithTranscript = course.lessons.filter((l) => l.transcript);

    if (lessonsWithTranscript.length === 0) {
      return NextResponse.json(
        { error: "Khóa học chưa có transcript nào. Vui lòng import hoặc thêm transcript trước." },
        { status: 400 }
      );
    }

    // Build full course context: lesson list + all available transcripts
    const lessonList = course.lessons
      .map((l) => `  ${l.order}. ${l.title}${l.transcript ? "" : " (chưa có transcript)"}`)
      .join("\n");

    // Aggregate all transcripts with lesson headers (truncate each to ~4000 chars to stay within context limits)
    const MAX_PER_LESSON = 4000;
    const transcriptBlocks = lessonsWithTranscript
      .map((l) => {
        const t = l.transcript!;
        const truncated = t.length > MAX_PER_LESSON
          ? t.slice(0, MAX_PER_LESSON) + "\n... (transcript dài, đã rút gọn)"
          : t;
        return `--- Bài ${l.order}: ${l.title} ---\n${truncated}`;
      })
      .join("\n\n");

    const client = createAIClient(apiKey, baseUrl);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: getSystemPrompt("roadmap"),
        },
        {
          role: "user",
          content: `Phân tích TOÀN BỘ khóa học và đề xuất lộ trình học tập tối ưu cho TOÀN KHÓA:\n\nKhóa học: ${course.title}\nTổng số bài: ${course.lessons.length} (${lessonsWithTranscript.length} bài có transcript)\n\nDanh sách bài học:\n${lessonList}\n\nNội dung các bài học:\n${transcriptBlocks}`,
        },
      ],
    });

    const raw = response.choices[0].message.content ?? "";
    const roadmap = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Persist to Course (not Lesson)
    await prisma.course.update({
      where: { id: courseId },
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
