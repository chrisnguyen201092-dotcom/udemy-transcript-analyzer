import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["summary", "explanation", "quiz", "flashcards", "exercises"] as const;
type ExportType = (typeof VALID_TYPES)[number];
const VALID_FORMATS = ["markdown", "csv"] as const;
type ExportFormat = (typeof VALID_FORMATS)[number];

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[^\x20-\x7E]/g, "")
      .replace(/[/\\:*?"<>|]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 100) || "export"
  );
}

function escapeCSVField(value: string): string {
  // M-19: Prevent spreadsheet formula injection (=, +, -, @, tab, CR)
  if (/^[=+\-@\t\r]/.test(value)) {
    value = "'" + value;
  }
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function escapeMdTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function formatSummary(title: string, content: string): string {
  return `# ${title}\n\n${content}`;
}

function formatExplanation(title: string, content: string): string {
  return `# ${title} — Giải thích\n\n${content}`;
}

function formatQuiz(title: string, quizJson: string): string {
  const data = JSON.parse(quizJson);
  const questions = data.questions;
  if (!questions || questions.length === 0) {
    return `# ${title} — Quiz\n\nKhông có dữ liệu`;
  }
  const lines = [`# ${title} — Quiz\n`];
  questions.forEach(
    (
      q: {
        question: string;
        options?: string[];
        answer: string;
        explanation?: string;
      },
      i: number
    ) => {
      lines.push(`## Câu ${i + 1}: ${q.question}`);
      if (q.options) {
        const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
        q.options.forEach((opt: string, j: number) => {
          lines.push(`- ${labels[j]}) ${opt}`);
        });
      }
      lines.push(`- **Đáp án đúng: ${q.answer}**`);
      if (q.explanation) {
        lines.push(`> ${q.explanation}`);
      }
      lines.push("");
    }
  );
  return lines.join("\n");
}

function formatFlashcardsCSV(flashcardsJson: string): string {
  const data = JSON.parse(flashcardsJson);
  const cards = data.cards;
  if (!cards || cards.length === 0) return "";
  return cards
    .map((c: { front: string; back: string }) => {
      return `${escapeCSVField(c.front)};${escapeCSVField(c.back)}`;
    })
    .join("\n");
}

function formatFlashcardsMarkdown(
  title: string,
  flashcardsJson: string
): string {
  const data = JSON.parse(flashcardsJson);
  const cards = data.cards;
  const lines = [
    `# ${title} — Flashcards\n`,
    "| Mặt trước | Mặt sau |",
    "|---|---|",
  ];
  if (cards && cards.length > 0) {
    cards.forEach((c: { front: string; back: string }) => {
      lines.push(`| ${escapeMdTable(c.front)} | ${escapeMdTable(c.back)} |`);
    });
  }
  return lines.join("\n");
}

function formatExercises(title: string, exercisesJson: string): string {
  const data = JSON.parse(exercisesJson);
  const exercises = data.exercises;
  if (!exercises || exercises.length === 0) {
    return `# ${title} — Bài tập\n\nKhông có dữ liệu`;
  }
  const lines = [`# ${title} — Bài tập\n`];
  exercises.forEach(
    (
      ex: {
        title: string;
        description: string;
        hints?: string[];
        solution?: string;
      },
      i: number
    ) => {
      lines.push(`## Bài tập ${i + 1}: ${ex.title}`);
      lines.push(ex.description);
      lines.push("");
      if (ex.hints && ex.hints.length > 0) {
        lines.push(`**Gợi ý:** ${ex.hints.join(", ")}`);
        lines.push("");
      }
      if (ex.solution) {
        lines.push("**Lời giải:**");
        lines.push(ex.solution);
        lines.push("");
      }
    }
  );
  return lines.join("\n");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { type, format } = body as {
      type: string;
      format: string;
    };

    if (
      !type ||
      !format ||
      !VALID_TYPES.includes(type as ExportType) ||
      !VALID_FORMATS.includes(format as ExportFormat)
    ) {
      return NextResponse.json(
        { error: "type hoặc format không hợp lệ" },
        { status: 400 }
      );
    }

    if (format === "csv" && type !== "flashcards") {
      return NextResponse.json(
        { error: "Chỉ flashcards hỗ trợ format CSV" },
        { status: 400 }
      );
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id },
      select: {
        title: true,
        summary: true,
        explanation: true,
        quiz: true,
        flashcards: true,
        exercises: true,
      },
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    const fieldMap: Record<ExportType, string | null | undefined> = {
      summary: lesson.summary,
      explanation: lesson.explanation,
      quiz: lesson.quiz,
      flashcards: lesson.flashcards,
      exercises: lesson.exercises,
    };

    const fieldValue = fieldMap[type as ExportType];
    if (fieldValue === null || fieldValue === undefined) {
      return NextResponse.json(
        {
          error: `Dữ liệu chưa được tạo. Vui lòng tạo ${type} trước khi xuất.`,
        },
        { status: 404 }
      );
    }

    let content: string;
    let contentType: string;
    let ext: string;

    const exportType = type as ExportType;
    const exportFormat = format as ExportFormat;

    if (exportType === "summary") {
      content = formatSummary(lesson.title, fieldValue);
      contentType = "text/markdown; charset=utf-8";
      ext = "md";
    } else if (exportType === "explanation") {
      content = formatExplanation(lesson.title, fieldValue);
      contentType = "text/markdown; charset=utf-8";
      ext = "md";
    } else if (exportType === "quiz") {
      content = formatQuiz(lesson.title, fieldValue);
      contentType = "text/markdown; charset=utf-8";
      ext = "md";
    } else if (exportType === "flashcards") {
      if (exportFormat === "csv") {
        content = formatFlashcardsCSV(fieldValue);
        contentType = "text/csv; charset=utf-8";
        ext = "csv";
      } else {
        content = formatFlashcardsMarkdown(lesson.title, fieldValue);
        contentType = "text/markdown; charset=utf-8";
        ext = "md";
      }
    } else {
      // exercises
      content = formatExercises(lesson.title, fieldValue);
      contentType = "text/markdown; charset=utf-8";
      ext = "md";
    }

    const filename = `${sanitizeFilename(lesson.title)}_${type}.${ext}`;

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Dữ liệu JSON trong DB bị lỗi" },
        { status: 500 }
      );
    }
    console.error("[export-lesson]", error);
    return NextResponse.json(
      { error: "Lỗi server không xác định" },
      { status: 500 }
    );
  }
}
