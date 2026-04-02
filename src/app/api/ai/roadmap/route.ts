import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, type ContentType } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";
import { withAuth } from "@/lib/auth";

// M-11: Module-level map to deduplicate concurrent AI calls for the same course
const inFlightGenerations = new Map<string, Promise<void>>();

const RoadmapSchema = z.object({
  courseId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  force: z.boolean().optional(),
});

export const POST = withAuth(async (req, { userId }) => {
  try {
    const { courseId, apiKey, baseUrl, model, force } = RoadmapSchema.parse(await req.json());

    let safeBaseUrl: string;
    try {
      safeBaseUrl = validateBaseUrl(baseUrl);
    } catch {
      return Response.json({ error: "Invalid configuration" }, { status: 400 });
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, userId },
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

    // M-11: If another request is already generating this roadmap, wait then re-check cache
    const cacheKey = `roadmap-${courseId}`;
    if (inFlightGenerations.has(cacheKey)) {
      await inFlightGenerations.get(cacheKey)!.catch(() => {});
      const refreshed = await prisma.course.findFirst({ where: { id: courseId, userId }, select: { roadmap: true } });
      if (refreshed?.roadmap) {
        return NextResponse.json({ roadmap: refreshed.roadmap, cached: true });
      }
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
      prisma.learnerProfile.findFirst({ where: { courseId, userId } }),
      prisma.lessonProgress.findMany({
        where: { lessonId: { in: lessonIds }, userId },
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

    const client = createAIClient(apiKey, safeBaseUrl);

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
    const generationPromise = fullText.then(async (roadmap) => {
      if (!roadmap) return;
      try {
        await prisma.course.update({
          where: { id: courseId },
          data: { roadmap },
        });
      } catch (dbError) {
        console.error("[roadmap] DB persistence failed:", dbError);
      }
    }).finally(() => {
      inFlightGenerations.delete(cacheKey);
    });
    inFlightGenerations.set(cacheKey, generationPromise);

    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[AI Route Error]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
