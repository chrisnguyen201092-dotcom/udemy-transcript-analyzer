import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, type ContentType } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";
import { withAuth } from "@/lib/auth";

const ConceptsSchema = z.object({
  lessonId: z.string(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  force: z.boolean().optional(),
});

const ConceptItemSchema = z.object({
  term: z.string(),
  definition: z.string(),
  category: z.string().optional().default("thuật ngữ"),
  relatedTerms: z.array(z.string()).optional().default([]),
});

export const POST = withAuth(async (req, { userId }) => {
  try {
    const { lessonId, apiKey, baseUrl, model, force } = ConceptsSchema.parse(await req.json());

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
      return NextResponse.json({ error: "No transcript available" }, { status: 400 });
    }

    // Only for book content type
    const contentType = (lesson.course.contentType ?? "course") as ContentType;
    if (contentType !== "book") {
      return NextResponse.json(
        { error: "Key concepts only available for books" },
        { status: 400 },
      );
    }

    // Cache guard — return cached concepts if not forcing regeneration
    if (lesson.keyConcepts && !force) {
      try {
        const cached = JSON.parse(lesson.keyConcepts);
        return NextResponse.json({ concepts: cached });
      } catch {
        // Invalid cached data — fall through to regenerate
      }
    }

    const client = createAIClient(apiKey, safeBaseUrl);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: getSystemPrompt("concepts", contentType) },
        {
          role: "user",
          content: `Trích xuất khái niệm chính từ chương sách:\n\nSách: ${lesson.course.title}\nChương: ${lesson.title}\nNội dung:\n${lesson.transcript}`,
        },
      ],
    });

    const rawText = response.choices[0]?.message?.content ?? "";

    // Parse JSON array from AI response (may be wrapped in ```json ... ```)
    let concepts: z.infer<typeof ConceptItemSchema>[] = [];
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        concepts = z.array(ConceptItemSchema).parse(parsed);
      }
    } catch (parseErr) {
      console.error("[concepts] JSON parse failed:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: rawText },
        { status: 500 },
      );
    }

    // Only persist non-empty results to avoid caching AI failures
    if (concepts.length > 0) {
      await prisma.lesson.update({
        where: { id: lessonId },
        data: { keyConcepts: JSON.stringify(concepts) },
      });
    }

    return NextResponse.json({ concepts });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[AI Concepts Error]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
