import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { z } from "zod";

const Schema = z.object({
  courseId: z.number().int().positive(),
  cookie: z.string().min(1),
});

interface CurriculumItem {
  _class: string;
  id: number;
  title: string;
  object_index: number;
  asset?: {
    captions?: Array<{
      locale_id: string;
      url: string;
      source: string;
    }>;
  };
}

async function fetchTranscript(captionUrl: string): Promise<string | null> {
  try {
    const res = await fetch(captionUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    // VTT format → strip timestamps and tags, join lines
    const lines = text
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("WEBVTT") && !/^\d{2}:\d{2}/.test(l) && !/^-->/.test(l))
      .map((l) => l.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);
    // Deduplicate consecutive identical lines (VTT repeats)
    const deduped: string[] = [];
    for (const line of lines) {
      if (deduped[deduped.length - 1] !== line) deduped.push(line);
    }
    return deduped.join(" ").trim() || null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { courseId, cookie } = Schema.parse(await req.json());

    // 1. Fetch course info
    const courseInfoRes = await fetch(
      `https://www.udemy.com/api-2.0/courses/${courseId}/?fields[course]=id,title,url`,
      {
        headers: { Authorization: `Bearer ${cookie}` },
        cache: "no-store",
      }
    );
    if (!courseInfoRes.ok) {
      return NextResponse.json({ error: "Không thể lấy thông tin course. Kiểm tra lại access_token." }, { status: 400 });
    }
    const courseInfo = await courseInfoRes.json();
    const courseTitle: string = courseInfo.title ?? `Udemy Course ${courseId}`;
    const courseUrl: string = `https://www.udemy.com${courseInfo.url ?? ""}`;

    // 2. Fetch all curriculum items (paginated)
    const allItems: CurriculumItem[] = [];
    let nextPage: string | null =
      `https://www.udemy.com/api-2.0/courses/${courseId}/cached-subscriber-curriculum-items/` +
      `?page_size=200&fields[lecture]=id,title,object_index,asset&fields[asset]=captions`;

    while (nextPage) {
      const r: Response = await fetch(nextPage, {
        headers: { Authorization: `Bearer ${cookie}` },
        cache: "no-store",
      });
      if (!r.ok) break;
      const d: { results?: CurriculumItem[]; next?: string | null } = await r.json();
      allItems.push(...(d.results ?? []));
      nextPage = d.next ?? null;
    }

    // 3. Filter only lectures
    const lectures = allItems.filter((item) => item._class === "lecture");

    // 4. Upsert course in DB
    const existingCourse = await prisma.course.findFirst({ where: { url: courseUrl } });
    const dbCourse = existingCourse
      ? await prisma.course.update({ where: { id: existingCourse.id }, data: { title: courseTitle } })
      : await prisma.course.create({ data: { url: courseUrl, title: courseTitle } });

    // Delete existing lessons to re-import fresh
    if (existingCourse) {
      await prisma.lesson.deleteMany({ where: { courseId: dbCourse.id } });
    }

    // 5. For each lecture: fetch transcript if available, then save
    let importedCount = 0;
    for (const lecture of lectures) {
      let transcript: string | null = null;

      const captions = lecture.asset?.captions ?? [];
      // Prefer English, then any
      const caption =
        captions.find((c) => c.locale_id === "en_US") ??
        captions.find((c) => c.locale_id?.startsWith("en")) ??
        captions[0] ??
        null;

      if (caption?.url) {
        transcript = await fetchTranscript(caption.url);
      }

      await prisma.lesson.create({
        data: {
          courseId: dbCourse.id,
          title: lecture.title,
          order: lecture.object_index,
          transcript,
        },
      });
      importedCount++;
    }

    return NextResponse.json({
      title: courseTitle,
      lessonCount: importedCount,
      courseId: dbCourse.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: "Lỗi server khi import" }, { status: 500 });
  }
}
