import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, type ContentType } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";
import { withAuth } from "@/lib/auth";

// M-11: Module-level map to deduplicate concurrent AI calls for the same lesson+mode
const inFlightGenerations = new Map<string, Promise<void>>();

// C-4: Prevent oversized transcripts from exceeding LLM context limits
const MAX_TRANSCRIPT_CHARS = 50_000;

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


export const POST = withAuth(async (req, { userId }) => {
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

    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, course: { userId } },
      include: { course: true },
    });

    if (!lesson?.transcript) {
      return NextResponse.json(
        { error: "No transcript available" },
        { status: 400 }
      );
    }

    // Cache guard — return JSON for cached results
    const cachedArtifact = await prisma.lessonArtifact.findUnique({
      where: { userId_lessonId_type: { userId, lessonId, type: mode } },
      select: { content: true },
    });
    if (cachedArtifact?.content && !force) {
      return NextResponse.json({ result: cachedArtifact.content, mode });
    }

    // M-11: If another request is already generating this mode for this lesson, wait then re-check cache
    const cacheKey = `${mode}-${userId}-${lessonId}`;
    if (inFlightGenerations.has(cacheKey)) {
      await inFlightGenerations.get(cacheKey)!.catch(() => {});
      const refreshed = await prisma.lessonArtifact.findUnique({
        where: { userId_lessonId_type: { userId, lessonId, type: mode } },
        select: { content: true },
      });
      if (refreshed?.content) {
        return NextResponse.json({ result: refreshed.content, mode, cached: true });
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
          content: `${USER_PROMPTS[mode]}\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung:\n${lesson.transcript.slice(0, MAX_TRANSCRIPT_CHARS)}${learnerContext}`,
        },
      ],
      stream: true,
    });

    const { stream, fullText } = createThinkFilteredStream(openaiStream);

    // Best-effort DB persistence after stream completes
    const generationPromise = fullText.then(async (result) => {
      if (!result) return;
      try {
        await prisma.lessonArtifact.upsert({
          where: { userId_lessonId_type: { userId, lessonId, type: mode } },
          create: { userId, lessonId, type: mode, content: result },
          update: { content: result },
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
});
