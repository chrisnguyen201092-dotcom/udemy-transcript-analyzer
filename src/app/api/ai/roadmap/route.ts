import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, type ContentType } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";

const RoadmapSchema = z.object({
  courseId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  force: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { courseId, apiKey, baseUrl, model, force } = RoadmapSchema.parse(await req.json());

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, order: true, transcript: true },
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Cache guard — return JSON for cached results
    if (course.roadmap && !force) {
      return NextResponse.json({ roadmap: course.roadmap });
    }

    const lessonsWithTranscript = course.lessons.filter((l) => l.transcript);

    if (lessonsWithTranscript.length === 0) {
      return NextResponse.json(
        { error: "Khóa học chưa có transcript nào. Vui lòng import hoặc thêm transcript trước." },
        { status: 400 }
      );
    }

    // ── Fetch LearnerProfile + LessonProgress (optional, after cache guard) ──
    const lessonIds = course.lessons.map((l) => l.id);

    const [profile, progressRecords] = await Promise.all([
      prisma.learnerProfile.findUnique({ where: { courseId } }),
      prisma.lessonProgress.findMany({
        where: { lessonId: { in: lessonIds } },
      }),
    ]);

    // Build profile context string (Vietnamese)
    let profileContext = "";
    if (profile) {
      const lines = [
        `\n\nHồ sơ người học:`,
        `- Trình độ: ${profile.level}`,
        `- Mục tiêu: ${profile.goal}`,
        `- Thời gian học/ngày: ${profile.dailyTimeMin} phút`,
      ];
      if (profile.knownTopics) {
        try {
          const topics = JSON.parse(profile.knownTopics) as string[];
          if (topics.length > 0) {
            lines.push(`- Các chủ đề đã biết: ${topics.join(", ")}`);
          }
        } catch {
          // Invalid JSON — skip knownTopics
        }
      }
      lines.push(`- Phong cách học: ${profile.learningStyle}`);
      profileContext = lines.join("\n");
    }

    // Build progress context string
    let progressContext = "";
    const completedProgress = progressRecords.filter((p) => p.completed);
    if (completedProgress.length > 0) {
      const completedLessons = course.lessons.filter((l) =>
        completedProgress.some((p) => p.lessonId === l.id)
      );
      const completedTitles = completedLessons
        .map((l) => `  ✅ ${l.title}`)
        .join("\n");
      progressContext = `\n\nTiến độ hiện tại:\n- Đã hoàn thành: ${completedProgress.length}/${course.lessons.length} bài\n- Bài đã xong:\n${completedTitles}\nHãy đánh dấu bài đã hoàn thành bằng ✅ và gợi ý bài tiếp theo.`;
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

    const contentType = (course.contentType ?? "course") as ContentType;

    const client = createAIClient(apiKey, baseUrl);

    const openaiStream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: getSystemPrompt("roadmap", contentType),
        },
        {
          role: "user",
          content: `Phân tích TOÀN BỘ khóa học và đề xuất lộ trình học tập tối ưu cho TOÀN KHÓA:\n\nKhóa học: ${course.title}\nTổng số bài: ${course.lessons.length} (${lessonsWithTranscript.length} bài có transcript)\n\nDanh sách bài học:\n${lessonList}\n\nNội dung các bài học:\n${transcriptBlocks}${profileContext}${progressContext}`,
        },
      ],
      stream: true,
    });

    const { stream, fullText } = createThinkFilteredStream(openaiStream);

    // Best-effort DB persistence after stream completes
    fullText.then(async (roadmap) => {
      if (!roadmap) return;
      try {
        await prisma.course.update({
          where: { id: courseId },
          data: { roadmap },
        });
      } catch (dbError) {
        console.error("[roadmap] DB persistence failed:", dbError);
      }
    });

    return new Response(stream, { headers: STREAM_HEADERS });
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
