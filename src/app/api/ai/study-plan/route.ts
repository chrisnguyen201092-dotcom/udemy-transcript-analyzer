import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getSystemPrompt, type ContentType } from "@/lib/ai/prompts";
import { createAIClient } from "@/lib/ai/client";
import { validateBaseUrl } from "@/lib/security/validateBaseUrl";
import { withAuth } from "@/lib/auth";

const StudyPlanRequestSchema = z.object({
  courseId: z.string(),
  availableDays: z.number().int().min(1).max(90),
  hoursPerDay: z.number().min(0.5).max(12),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  model: z.string().min(1),
});

const StudyPlanDaySchema = z.object({
  day: z.number().int().positive(),
  chapters: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      estimatedMinutes: z.number().positive(),
    })
  ),
  goals: z.string(),
});

const StudyPlanSchema = z.object({
  days: z.array(StudyPlanDaySchema),
  summary: z.string().optional().default(""),
});

export const POST = withAuth(async (req, { userId }) => {
  try {
    const { courseId, availableDays, hoursPerDay, apiKey, baseUrl, model } =
      StudyPlanRequestSchema.parse(await req.json());

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
          select: { id: true, title: true, transcript: true, order: true },
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
        { error: "Study plan only available for books" },
        { status: 400 }
      );
    }

    if (course.lessons.length === 0) {
      return NextResponse.json(
        { error: "No chapters found for this book" },
        { status: 400 }
      );
    }

    const client = createAIClient(apiKey, safeBaseUrl);

    // Build chapter list with word count estimates from transcript length
    const chapterSummaries = course.lessons.map((lesson) => {
      const wordCount = lesson.transcript
        ? Math.round(lesson.transcript.split(/\s+/).length)
        : 500; // default estimate for chapters without transcript
      return { id: lesson.id, title: lesson.title, wordCount };
    });

    const availableMinutes = Math.round(hoursPerDay * 60);

    const userMessage = `Tạo kế hoạch đọc sách: "${course.title}"

Thông tin người đọc:
- Số ngày có sẵn: ${availableDays} ngày
- Thời gian mỗi ngày: ${hoursPerDay} giờ (${availableMinutes} phút)

Danh sách chương (theo thứ tự):
${JSON.stringify(chapterSummaries, null, 2)}

Hãy phân bổ TẤT CẢ ${chapterSummaries.length} chương vào ${availableDays} ngày.`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: getSystemPrompt("study-plan", "book") },
        { role: "user", content: userMessage },
      ],
    });

    const rawText = response.choices[0]?.message?.content ?? "";

    // Parse JSON object from AI response (may be wrapped in ```json ... ```)
    let plan: z.infer<typeof StudyPlanSchema>;
    try {
      // Try to extract JSON object
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON object found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);
      plan = StudyPlanSchema.parse(parsed);
    } catch (parseErr) {
      console.error("[study-plan] JSON parse failed:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: rawText },
        { status: 500 }
      );
    }

    return NextResponse.json({ plan });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues }, { status: 400 });
    }
    console.error("[AI Study Plan Error]", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
});
