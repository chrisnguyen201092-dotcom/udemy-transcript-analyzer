import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, type ContentType } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";

// M-11: Module-level map to deduplicate concurrent AI calls for the same lesson
const inFlightGenerations = new Map<string, Promise<void>>();

const SummarySchema = z.object({
  lessonId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  force: z.boolean().optional(),
  mode: z.enum(["quick", "detailed"]).optional().default("detailed"),
  lessonIndex: z.number().int().min(0).optional(),
  totalLessons: z.number().int().min(1).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { lessonId, apiKey, baseUrl, model, force, mode, lessonIndex, totalLessons } = SummarySchema.parse(await req.json());

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
    if (lesson.summary && !force) {
      return NextResponse.json({ summary: lesson.summary });
    }

    // M-11: If another request is already generating this summary, wait for it then re-check cache
    const cacheKey = `summary-${lessonId}`;
    if (inFlightGenerations.has(cacheKey)) {
      await inFlightGenerations.get(cacheKey)!.catch(() => {});
      const refreshed = await prisma.lesson.findUnique({ where: { id: lessonId }, select: { summary: true } });
      if (refreshed?.summary) {
        return NextResponse.json({ summary: refreshed.summary, cached: true });
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
          content: getSystemPrompt(mode === "quick" ? "summary-quick" : "summary", contentType),
        },
        {
          role: "user",
          content: `Tóm tắt bài học sau đây:\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung:\n${lesson.transcript}${learnerContext}`,
        },
      ],
      stream: true,
    });

    const { stream, fullText } = createThinkFilteredStream(openaiStream);

    // Best-effort DB persistence after stream completes
    const generationPromise = fullText.then(async (summary) => {
      if (!summary) return;
      try {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: { summary },
        });
      } catch (dbError) {
        console.error("[summary] DB persistence failed:", dbError);
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
