import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getExplainPrompt, type ExplainDepth, type CodeRatio } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";

const ExplainSchema = z
  .object({
    lessonId: z.string(),
    apiKey: z.string().min(1),
    baseUrl: z.string().url(),
    model: z.string().min(1),
    force: z.boolean().optional(),
    lessonIndex: z.number().int().min(0).optional(),
    totalLessons: z.number().int().min(1).optional(),
    depth: z
      .enum(["simple", "standard", "deep"])
      .optional()
      .default("standard"),
    selectedText: z.string().optional(),
  })
  .refine((data) => data.selectedText === undefined || data.selectedText.length > 0, {
    message: "selectedText must not be empty",
    path: ["selectedText"],
  });

function classifyCodeRatio(transcript: string): CodeRatio {
  const lines = transcript.split("\n");
  const codeLines = lines.filter(
    (l) => /^(\s{4,}|\t)|```|`[^`]+`/.test(l)
  ).length;
  const ratio = codeLines / lines.length;
  if (ratio >= 0.4) return "code-heavy";
  if (ratio <= 0.2) return "theory-heavy";
  return "hybrid";
}

export async function POST(req: NextRequest) {
  try {
    const parsed = ExplainSchema.parse(await req.json());
    const {
      lessonId,
      apiKey,
      baseUrl,
      model,
      force,
      lessonIndex,
      totalLessons,
      selectedText,
    } = parsed;
    let depth: ExplainDepth = parsed.depth;

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

    // Cache guard — only for non-selectedText mode
    if (!selectedText && lesson.explanation && !force) {
      return NextResponse.json({
        explanation: lesson.explanation,
        depthActual: depth,
      });
    }

    // Auto-downgrade: deep → standard if transcript < 200 words
    const wordCount = lesson.transcript.split(/\s+/).length;
    if (depth === "deep" && wordCount < 200) {
      depth = "standard";
    }

    // Classify code ratio
    const codeRatio = classifyCodeRatio(lesson.transcript);

    // Fetch LearnerProfile (optional, no error if missing or model not available)
    let learnerProfile: { level: string } | null = null;
    try {
      learnerProfile = await prisma.learnerProfile.findUnique({
        where: { courseId: lesson.courseId },
      });
    } catch {
      // LearnerProfile model may not exist yet — gracefully ignore
    }

    // Build system prompt
    const systemPrompt = getExplainPrompt(
      depth,
      codeRatio,
      learnerProfile?.level ?? undefined,
      selectedText,
    );

    const client = createAIClient(apiKey, baseUrl);

    const learnerContext =
      lessonIndex !== undefined && totalLessons !== undefined
        ? `\n\nBối cảnh người học: Bài học ${lessonIndex + 1} của ${totalLessons} bài.`
        : "";

    // Build user message
    let userContent: string;
    if (selectedText) {
      userContent = `Giải thích đoạn được chọn sau:\n\nĐoạn được chọn: ${selectedText}\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nTranscript đầy đủ (context nền):\n${lesson.transcript}${learnerContext}`;
    } else {
      userContent = `Giải thích chi tiết bài học sau:\n\nKhóa học: ${lesson.course.title}\nTiêu đề bài học: ${lesson.title}\nNội dung bài học:\n${lesson.transcript}${learnerContext}`;
    }

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const raw = response.choices[0].message.content ?? "";
    const explanation = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // Persist to DB only when NOT in selectedText mode
    if (!selectedText) {
      await prisma.lesson.update({
        where: { id: lessonId },
        data: { explanation },
      });
    }

    return NextResponse.json({ explanation, depthActual: depth });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[explain]", msg);
    return NextResponse.json(
      { error: `Failed to generate explanation: ${msg}` },
      { status: 500 }
    );
  }
}
