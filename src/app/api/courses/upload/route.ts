import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { parseVtt, parseSrt, parseTxt, removeExtension } from "@/lib/parse-transcript";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

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

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const parsed = UploadSchema.parse(body);
    const { files } = parsed;

    // Reject PDF/EPUB — these belong in the book upload flow
    const bookExts = [".pdf", ".epub"];
    const bookFile = files.find((f) => bookExts.some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (bookFile) {
      return NextResponse.json(
        { error: "PDF/EPUB không hỗ trợ trong transcript upload. Dùng 'Upload sách' để upload PDF/EPUB." },
        { status: 400 },
      );
    }

    let resolvedCourseId: string;
    let isNewCourse = false;

    if (parsed.courseId) {
      const course = await prisma.course.findFirst({
        where: { id: parsed.courseId, userId },
      });
      if (!course) {
        return NextResponse.json({ error: "Course không tồn tại" }, { status: 404 });
      }
      resolvedCourseId = parsed.courseId;
    } else {
      const newCourse = await prisma.course.create({
        data: { userId, title: parsed.courseTitle!, url: `manual:${randomUUID()}` },
      });
      resolvedCourseId = newCourse.id;
      isNewCourse = true;
    }

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

    if (isNewCourse && created.length === 0) {
      await prisma.course.delete({ where: { id: resolvedCourseId } }).catch(() => {});
      return NextResponse.json({ error: "Không parse được file nào" }, { status: 400 });
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
});
