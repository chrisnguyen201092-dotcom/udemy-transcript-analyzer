import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, type ContentType } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";

// M-11: Module-level map to deduplicate concurrent AI calls for the same lesson+mode
const inFlightGenerations = new Map<string, Promise<void>>();

const PracticeSchema = z.object({
  lessonId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  mode: z.enum(["quiz", "flashcards", "exercises"]),
  force: z.boolean().optional(),
  lessonIndex: z.number().int().min(0).optional(),
  totalLessons: z.number().int().min(1).optional(),
});

const USER_PROMPTS: Record<string, string> = {
  quiz: "Tạo quiz kiểm tra kiến thức cho bài học sau đây:",
  flashcards: "Tạo bộ flashcard ôn tập cho bài học sau đây:",
  exercises: "Tạo bài tập thực hành cho bài học sau đây:",
};

const DB_FIELD: Record<string, "quiz" | "flashcards" | "exercises"> = {
  quiz: "quiz",
  flashcards: "flashcards",
  exercises: "exercises",
};

export async function POST(req: NextRequest) {
  try {
    const { lessonId, apiKey, baseUrl, model, mode, force, lessonIndex, totalLessons } = PracticeSchema.parse(
      await req.json()
    );

    let safeBaseUrl: string;
    try {
      safeBaseUrl = validateBaseUrl(baseUrl);
    } catch {
      return Response.json({ error: "Invalid configuration" }, { status: 400 });
    }

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

    // Cache guard — return JSON for cached results
    const cached = lesson[DB_FIELD[mode]];
    if (cached && !force) {
      return NextResponse.json({ result: cached, mode });
    }

    // M-11: If another request is already generating this mode for this lesson, wait then re-check cache
    const cacheKey = `${mode}-${lessonId}`;
    if (inFlightGenerations.has(cacheKey)) {
      await inFlightGenerations.get(cacheKey)!.catch(() => {});
      const refreshed = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { [DB_FIELD[mode]]: true } });
      const refreshedValue = refreshed?.[DB_FIELD[mode]];
      if (refreshedValue) {
        return NextResponse.json({ result: refreshedValue, mode, cached: true });
      }
    }

    const contentType = (lesson.course.contentType ?? "course") as ContentType;

    const client = createAIClient(apiKey, safeBaseUrl);

    const learnerContext = 
      lessonIndex !== undefined && totalLessons !== undefined
        ? `\n\nBối cảnh người học: Bài học ${lessonIndex + 1} của ${totalLessons} bài.`
        : "";

    const openaiStream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: getSystemPrompt(mode, contentType),
        },
        {
          role: "user",
          content: `${USER_PROMPTS[mode]}\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung:\n${lesson.transcript}${learnerContext}`,
        },
      ],
      stream: true,
    });

    const { stream, fullText } = createThinkFilteredStream(openaiStream);

    // Best-effort DB persistence after stream completes
    const generationPromise = fullText.then(async (result) => {
      if (!result) return;
      try {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: { [DB_FIELD[mode]]: result },
        });
      } catch (dbError) {
        console.error("[practice] DB persistence failed:", dbError);
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
}
