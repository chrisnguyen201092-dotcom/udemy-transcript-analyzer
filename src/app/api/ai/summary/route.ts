import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";

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

    const client = createAIClient(apiKey, baseUrl);

    const learnerContext = 
      lessonIndex !== undefined && totalLessons !== undefined
        ? `\n\nBối cảnh người học: Bài học ${lessonIndex + 1} của ${totalLessons} bài.`
        : "";

    const openaiStream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: getSystemPrompt(mode === "quick" ? "summary-quick" : "summary"),
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
    fullText.then(async (summary) => {
      if (!summary) return;
      try {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: { summary },
        });
      } catch (dbError) {
        console.error("[summary] DB persistence failed:", dbError);
      }
    });

    return new Response(stream, { headers: STREAM_HEADERS });
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
