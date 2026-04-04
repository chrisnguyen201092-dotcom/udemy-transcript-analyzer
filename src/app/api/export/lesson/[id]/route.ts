import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";
import { sanitizeFilename, escapeCSVField } from "@/lib/export-utils";

const ExportRequestSchema = z.object({
  type: z.enum(["summary", "explanation", "quiz", "flashcards", "exercises"]),
  format: z.enum(["markdown", "csv"]),
});

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
    (q: { question: string; options?: string[]; answer: string; explanation?: string }, i: number) => {
      lines.push(`## Câu ${i + 1}: ${q.question}`);
      if (q.options) {
        const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
        q.options.forEach((opt: string, j: number) => {
          lines.push(`- ${labels[j]}) ${opt}`);
        });
      }
      lines.push(`- **Đáp án đúng: ${q.answer}**`);
      if (q.explanation) lines.push(`> ${q.explanation}`);
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
    .map((c: { front: string; back: string }) =>
      `${escapeCSVField(c.front)};${escapeCSVField(c.back)}`
    )
    .join("\n");
}

function formatFlashcardsMarkdown(title: string, flashcardsJson: string): string {
  const data = JSON.parse(flashcardsJson);
  const cards = data.cards;
  const lines = [`# ${title} — Flashcards\n`, "| Mặt trước | Mặt sau |", "|---|---|"];
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
    (ex: { title: string; description: string; hints?: string[]; solution?: string }, i: number) => {
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

export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "Missing lesson id" }, { status: 400 });
    }
    const parseResult = ExportRequestSchema.safeParse(await req.json());
    if (!parseResult.success) {
      return NextResponse.json({ error: "type hoặc format không hợp lệ" }, { status: 400 });
    }
    const { type, format } = parseResult.data;

    if (format === "csv" && type !== "flashcards") {
      return NextResponse.json({ error: "Chỉ flashcards hỗ trợ format CSV" }, { status: 400 });
    }

    // Verify lesson belongs to a course owned by userId
    const lesson = await prisma.lesson.findFirst({
      where: { id, course: { userId } },
      select: { title: true },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const ARTIFACT_TYPES = ["summary", "explanation", "quiz", "flashcards", "exercises"];
    const artifacts = await prisma.lessonArtifact.findMany({
      where: { lessonId: id, userId, type: { in: ARTIFACT_TYPES } },
      select: { type: true, content: true },
    });
    const artifactMap = Object.fromEntries(artifacts.map((a) => [a.type, a.content]));

    const fieldValue = artifactMap[type] ?? null;
    if (fieldValue === null || fieldValue === undefined) {
      return NextResponse.json(
        { error: `Dữ liệu chưa được tạo. Vui lòng tạo ${type} trước khi xuất.` },
        { status: 404 }
      );
    }

    let content: string;
    let contentType: string;
    let ext: string;

    if (type === "summary") {
      content = formatSummary(lesson.title, fieldValue);
      contentType = "text/markdown; charset=utf-8";
      ext = "md";
    } else if (type === "explanation") {
      content = formatExplanation(lesson.title, fieldValue);
      contentType = "text/markdown; charset=utf-8";
      ext = "md";
    } else if (type === "quiz") {
      content = formatQuiz(lesson.title, fieldValue);
      contentType = "text/markdown; charset=utf-8";
      ext = "md";
    } else if (type === "flashcards") {
      if (format === "csv") {
        content = formatFlashcardsCSV(fieldValue);
        contentType = "text/csv; charset=utf-8";
        ext = "csv";
      } else {
        content = formatFlashcardsMarkdown(lesson.title, fieldValue);
        contentType = "text/markdown; charset=utf-8";
        ext = "md";
      }
    } else {
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
      return NextResponse.json({ error: "Dữ liệu JSON trong DB bị lỗi" }, { status: 500 });
    }
    console.error("[export-lesson]", error);
    return NextResponse.json({ error: "Lỗi server không xác định" }, { status: 500 });
  }
});
