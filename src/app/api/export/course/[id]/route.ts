import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["full-notes", "all-flashcards"] as const;
type CourseExportType = (typeof VALID_TYPES)[number];
const VALID_FORMATS = ["markdown", "csv"] as const;
type CourseExportFormat = (typeof VALID_FORMATS)[number];

function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 100);
}

function escapeCSVField(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function formatFullNotes(
  courseTitle: string,
  lessons: Array<{
    title: string;
    summary: string | null;
    explanation: string | null;
  }>
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
          allLines.push(
            `${escapeCSVField(c.front)};${escapeCSVField(c.back)}`
          );
        }
      }
    } catch {
      // skip unparseable lessons
    }
  }

  return allLines.join("\n");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { type, format } = body as { type: string; format: string };

    if (
      !type ||
      !format ||
      !VALID_TYPES.includes(type as CourseExportType) ||
      !VALID_FORMATS.includes(format as CourseExportFormat)
    ) {
      return NextResponse.json(
        { error: "type hoặc format không hợp lệ" },
        { status: 400 }
      );
    }

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

    const course = await prisma.course.findUnique({
      where: { id },
      select: {
        title: true,
        lessons: {
          select: {
            title: true,
            summary: true,
            explanation: true,
            flashcards: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    let content: string;
    let contentType: string;
    let ext: string;

    if (type === "full-notes") {
      content = formatFullNotes(course.title, course.lessons);
      contentType = "text/markdown; charset=utf-8";
      ext = "md";
    } else {
      // all-flashcards
      content = formatAllFlashcardsCSV(course.lessons);
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
}
