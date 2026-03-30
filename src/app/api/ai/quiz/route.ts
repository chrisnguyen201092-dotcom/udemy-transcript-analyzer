import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";

const PracticeSchema = z.object({
  lessonId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  mode: z.enum(["quiz", "flashcards", "exercises"]),
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
    const { lessonId, apiKey, baseUrl, model, mode } = PracticeSchema.parse(
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

    const client = createAIClient(apiKey, baseUrl);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: getSystemPrompt(mode),
        },
        {
          role: "user",
          content: `${USER_PROMPTS[mode]}\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung:\n${lesson.transcript}`,
        },
      ],
    });

    const raw = response.choices[0].message.content ?? "";
    const result = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Persist to DB
    await prisma.lesson.update({
      where: { id: lessonId },
      data: { [DB_FIELD[mode]]: result },
    });

    return NextResponse.json({ result, mode });
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
