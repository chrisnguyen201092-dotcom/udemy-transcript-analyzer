import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const FileSchema = z.object({
  name: z.string().min(1),
  content: z.string(),
  type: z.string(),
});

const UploadSchema = z.object({
  courseId: z.string().min(1),
  files: z.array(FileSchema).min(1),
});

function parseVtt(text: string): string | null {
  const lines = text
    .split("\n")
    .filter(
      (l) =>
        l.trim() &&
        !l.startsWith("WEBVTT") &&
        !/^\d{2}:\d{2}/.test(l) &&
        !/^-->/.test(l)
    )
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) deduped.push(line);
  }
  return deduped.join(" ").trim() || null;
}

function parseSrt(text: string): string | null {
  const lines = text
    .split("\n")
    .filter(
      (l) =>
        l.trim() &&
        // Filter out sequence numbers (lines that are just a number)
        !/^\d+$/.test(l.trim()) &&
        // Filter out timestamp lines (00:00:00,000 --> 00:00:00,000)
        !/^\d{2}:\d{2}:\d{2},\d{3}\s*-->/.test(l.trim())
    )
    .map((l) => l.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] !== line) deduped.push(line);
  }
  return deduped.join(" ").trim() || null;
}

function parseTxt(text: string): string | null {
  return text.trim() || null;
}

function removeExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseId, files } = UploadSchema.parse(body);

    // Verify course exists
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json(
        { error: "Course không tồn tại" },
        { status: 404 }
      );
    }

    // Get current lesson count for ordering
    const existingCount = await prisma.lesson.count({
      where: { courseId },
    });

    const created: Array<{ id: string; title: string; order: number }> = [];
    const errors: Array<{ fileName: string; reason: string }> = [];
    let orderOffset = 0;

    for (const file of files) {
      let transcript: string | null = null;

      try {
        const ext = file.type.toLowerCase();
        switch (ext) {
          case ".vtt":
            transcript = parseVtt(file.content);
            break;
          case ".srt":
            transcript = parseSrt(file.content);
            break;
          case ".txt":
            transcript = parseTxt(file.content);
            break;
          default:
            transcript = parseTxt(file.content);
        }

        const title = removeExtension(file.name);
        const order = existingCount + orderOffset + 1;

        const lesson = await prisma.lesson.create({
          data: { courseId, title, order, transcript },
        });

        created.push({ id: lesson.id, title: lesson.title, order: lesson.order });
        orderOffset++;
      } catch (fileError) {
        const reason =
          fileError instanceof Error ? fileError.message : String(fileError);
        errors.push({ fileName: file.name, reason });
      }
    }

    return NextResponse.json({ created, errors });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Lỗi server khi upload" },
      { status: 500 }
    );
  }
}
