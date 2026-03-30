import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { parseVtt, parseSrt, parseTxt, removeExtension } from "@/lib/parse-transcript";
import { z } from "zod";

const FileSchema = z.object({
  name: z.string().min(1),
  content: z.string(),
  type: z.string(),
});

const UploadSchema = z.object({
  courseId: z.string().min(1).optional(),
  courseTitle: z.string().min(1).optional(),
  files: z.array(FileSchema).min(1),
}).refine((d) => d.courseId || d.courseTitle, {
  message: "courseId hoặc courseTitle là bắt buộc",
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UploadSchema.parse(body);
    const { files } = parsed;

    // Resolve or create the course
    let resolvedCourseId: string;

    if (parsed.courseId) {
      const course = await prisma.course.findUnique({ where: { id: parsed.courseId } });
      if (!course) {
        return NextResponse.json({ error: "Course không tồn tại" }, { status: 404 });
      }
      resolvedCourseId = parsed.courseId;
    } else {
      // courseTitle is guaranteed by the refine above
      const newCourse = await prisma.course.create({
        data: { title: parsed.courseTitle!, url: `manual:${randomUUID()}` },
      });
      resolvedCourseId = newCourse.id;
    }

    // Get current lesson count for ordering
    const existingCount = await prisma.lesson.count({
      where: { courseId: resolvedCourseId },
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
          data: { courseId: resolvedCourseId, title, order, transcript },
        });

        created.push({ id: lesson.id, title: lesson.title, order: lesson.order });
        orderOffset++;
      } catch (fileError) {
        const reason =
          fileError instanceof Error ? fileError.message : String(fileError);
        errors.push({ fileName: file.name, reason });
      }
    }

    return NextResponse.json({ courseId: resolvedCourseId, created, errors });
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
