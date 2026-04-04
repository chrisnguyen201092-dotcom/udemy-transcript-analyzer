import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { sanitizeFilename, escapeCSVField } from "@/lib/export-utils";

const VALID_TYPES = ["full-notes", "all-flashcards"] as const;
const VALID_FORMATS = ["markdown", "csv"] as const;

const CourseExportRequestSchema = z.object({
  type: z.enum(VALID_TYPES),
  format: z.enum(VALID_FORMATS),
});

function formatFullNotes(
  courseTitle: string,
  lessons: Array<{ title: string; summary: string | null; explanation: string | null }>
): string {
  const lines = [`# ${courseTitle} — Ghi chú\n`];
  for (const lesson of lessons) {
    if (lesson.summary === null && lesson.explanation === null) continue;
    lines.push(`## ${lesson.title}`);
    if (lesson.summary !== null) {
      lines.push("### Tóm tắt");
      lines.push(lesson.summary);
      lines.push("");
    }
    if (lesson.explanation !== null) {
      lines.push("### Giải thích");
      lines.push(lesson.explanation);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function formatAllFlashcardsCSV(
  lessons: Array<{ flashcards: string | null }>
): string {
  const allLines: string[] = [];
  for (const lesson of lessons) {
    if (lesson.flashcards === null) continue;
    try {
      const data = JSON.parse(lesson.flashcards);
      const cards = data.cards;
      if (cards && cards.length > 0) {
        for (const c of cards as Array<{ front: string; back: string }>) {
          allLines.push(`${escapeCSVField(c.front)};${escapeCSVField(c.back)}`);
        }
      }
    } catch {
      // skip unparseable lessons
    }
  }
  return allLines.join("\n");
}

export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing course id" }, { status: 400 });
    }
    const parseResult = CourseExportRequestSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "type hoặc format không hợp lệ" },
        { status: 400 }
      );
    }
    const { type, format } = parseResult.data;

    if (type === "full-notes" && format !== "markdown") {
      return NextResponse.json(
        { error: "full-notes chỉ hỗ trợ format markdown" },
        { status: 400 }
      );
    }

    if (type === "all-flashcards" && format !== "csv") {
      return NextResponse.json(
        { error: "all-flashcards chỉ hỗ trợ format csv" },
        { status: 400 }
      );
    }

    const course = await prisma.course.findFirst({
      where: { id, userId },
      select: {
        title: true,
        lessons: {
          select: { id: true, title: true },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Fetch all lesson artifacts for this course's lessons in one query
    const lessonIds = course.lessons.map((l) => l.id);
    const artifacts = await prisma.lessonArtifact.findMany({
      where: { lessonId: { in: lessonIds }, userId, type: { in: ["summary", "explanation", "flashcards"] } },
      select: { lessonId: true, type: true, content: true },
    });

    // Build per-lesson artifact map: lessonId → { summary, explanation, flashcards }
    const artifactsByLesson = new Map<string, Record<string, string>>();
    for (const a of artifacts) {
      if (!artifactsByLesson.has(a.lessonId)) artifactsByLesson.set(a.lessonId, {});
      artifactsByLesson.get(a.lessonId)![a.type] = a.content;
    }

    // Shape lessons with the fields the formatter functions expect
    const lessons = course.lessons.map((l) => {
      const map = artifactsByLesson.get(l.id) ?? {};
      return {
        title: l.title,
        summary: map["summary"] ?? null,
        explanation: map["explanation"] ?? null,
        flashcards: map["flashcards"] ?? null,
      };
    });

    let content: string;
    let contentType: string;
    let ext: string;

    if (type === "full-notes") {
      content = formatFullNotes(course.title, lessons);
      contentType = "text/markdown; charset=utf-8";
      ext = "md";
    } else {
      content = formatAllFlashcardsCSV(lessons);
      contentType = "text/csv; charset=utf-8";
      ext = "csv";
    }

    const filename = `${sanitizeFilename(course.title)}_${type}.${ext}`;

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[export-course]", error);
    return NextResponse.json(
      { error: "Lỗi server không xác định" },
      { status: 500 }
    );
  }
});
