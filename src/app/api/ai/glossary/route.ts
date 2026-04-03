import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, type ContentType } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";
import { withAuth } from "@/lib/auth";

const GlossaryRequestSchema = z.object({
  courseId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  force: z.boolean().optional(),
});

const GlossaryItemSchema = z.object({
  term: z.string(),
  definition: z.string(),
  chapters: z
    .array(z.object({ id: z.string(), title: z.string() }))
    .optional()
    .default([]),
  category: z.string().optional().default("thuật ngữ"),
});

export const POST = withAuth(async (req, { userId }) => {
  try {
    const { courseId, apiKey, baseUrl, model, force } =
      GlossaryRequestSchema.parse(await req.json());

    let safeBaseUrl: string;
    try {
      safeBaseUrl = validateBaseUrl(baseUrl);
    } catch {
      return Response.json({ error: "Invalid configuration" }, { status: 400 });
    }

    // Verify course belongs to user and is a book
    const course = await prisma.course.findFirst({
      where: { id: courseId, userId },
      include: {
        lessons: {
          select: { id: true, title: true, keyConcepts: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 400 });
    }

    const contentType = (course.contentType ?? "course") as ContentType;
    if (contentType !== "book") {
      return NextResponse.json(
        { error: "Glossary only available for books" },
        { status: 400 },
      );
    }

    // Check that at least one lesson has keyConcepts
    const lessonsWithConcepts = course.lessons.filter((l) => l.keyConcepts);
    if (lessonsWithConcepts.length === 0) {
      return NextResponse.json(
        {
          error:
            "No chapters have key concepts yet. Please extract concepts from chapters first.",
        },
        { status: 400 },
      );
    }

    // Cache guard — return cached glossary if not forcing regeneration
    if (course.glossary && !force) {
      try {
        const cached = JSON.parse(course.glossary);
        return NextResponse.json({ glossary: cached });
      } catch {
        // Invalid cached data — fall through to regenerate
      }
    }

    const client = createAIClient(apiKey, safeBaseUrl);

    // Build aggregated input: all chapters' concepts tagged with chapter info
    const aggregatedInput = lessonsWithConcepts
      .map((lesson) => {
        let concepts: unknown[] = [];
        try {
          concepts = JSON.parse(lesson.keyConcepts!);
        } catch {
          return null;
        }
        return `Chương: ${lesson.title} (id: ${lesson.id})\n${JSON.stringify(concepts, null, 2)}`;
      })
      .filter(Boolean)
      .join("\n\n---\n\n");

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: getSystemPrompt("glossary", "book") },
        {
          role: "user",
          content: `Tổng hợp bảng thuật ngữ toàn sách: ${course.title}\n\nDanh sách khái niệm từ các chương:\n\n${aggregatedInput}`,
        },
      ],
    });

    const rawText = response.choices[0]?.message?.content ?? "";

    // Parse JSON array from AI response (may be wrapped in ```json ... ```)
    let glossary: z.infer<typeof GlossaryItemSchema>[] = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        glossary = z.array(GlossaryItemSchema).parse(parsed);
      }
    } catch (parseErr) {
      console.error("[glossary] JSON parse failed:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: rawText },
        { status: 500 },
      );
    }

    // Only persist non-empty results to avoid caching AI failures
    if (glossary.length > 0) {
      await prisma.course.update({
        where: { id: courseId },
        data: { glossary: JSON.stringify(glossary) },
      });
    }

    return NextResponse.json({ glossary });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[AI Glossary Error]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
