import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { createThinkFilteredStream, STREAM_HEADERS } from "@/lib/ai/stream";

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
          content: getSystemPrompt(mode),
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
    fullText.then(async (result) => {
      if (!result) return;
      try {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: { [DB_FIELD[mode]]: result },
        });
      } catch (dbError) {
        console.error("[practice] DB persistence failed:", dbError);
      }
    });

    return new Response(stream, { headers: STREAM_HEADERS });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[practice]", msg);
    return NextResponse.json(
      { error: `Failed to generate practice content: ${msg}` },
      { status: 500 }
    );
  }
}
