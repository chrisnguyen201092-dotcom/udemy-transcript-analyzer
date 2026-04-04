import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { withAuth } from "@/lib/auth";

const Schema = z.object({
  courseId: z.number().int().positive(),
  cookie: z.string().min(1),
});

const UDEMY_API_ORIGIN = "https://www.udemy.com";

// H-12/H-20: validates pagination URLs stay on udemy.com
function validateUdemyNextUrl(nextUrl: string | null | undefined): string | null {
  if (!nextUrl) return null;
  try {
    const parsed = new URL(nextUrl);
    if (parsed.origin !== UDEMY_API_ORIGIN) {
      console.warn(`[Udemy Import] Blocked redirect to: ${parsed.origin}`);
      return null;
    }
    return nextUrl;
  } catch {
    return null;
  }
}

// H-17: only fetch captions from udemy.com or udemycdn.com over HTTPS
function isAllowedCaptionUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname.endsWith(".udemy.com") || parsed.hostname.endsWith(".udemycdn.com"))
    );
  } catch {
    return false;
  }
}

interface CurriculumItem {
  _class: string;
  id: number;
  title: string;
  object_index: number;
  asset?: {
    captions?: Array<{ locale_id: string; url: string; source: string }>;
  };
}

async function fetchTranscript(captionUrl: string): Promise<string | null> {
  try {
    const res = await fetch(captionUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("WEBVTT") && !/^\d{2}:\d{2}/.test(l) && !/^-->/.test(l))
      .map((l) => l.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean);
    const deduped: string[] = [];
    for (const line of lines) {
      if (deduped[deduped.length - 1] !== line) deduped.push(line);
    }
    return deduped.join(" ").trim() || null;
  } catch {
    return null;
  }
}

export const POST = withAuth(async (req, { userId }) => {
  try {
    const { courseId, cookie } = Schema.parse(await req.json());

    const courseInfoRes = await fetch(
      `https://www.udemy.com/api-2.0/courses/${courseId}/?fields[course]=id,title,url`,
      { headers: { Authorization: `Bearer ${cookie}` }, cache: "no-store" }
    );
    if (!courseInfoRes.ok) {
      return NextResponse.json(
        { error: "Không thể lấy thông tin course. Kiểm tra lại access_token." },
        { status: 400 }
      );
    }
    const courseInfo = await courseInfoRes.json();
    const courseTitle: string = courseInfo.title ?? `Udemy Course ${courseId}`;
    const courseUrl: string = `https://www.udemy.com${courseInfo.url ?? ""}`;

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
      nextPage = validateUdemyNextUrl(d.next ?? null);
    }

    const lectures = allItems.filter((item) => item._class === "lecture");

    if (lectures.length === 0) {
      return NextResponse.json(
        { error: "No lectures found — import aborted." },
        { status: 400 }
      );
    }

    const transcriptMap = new Map<number, string | null>();
    for (let i = 0; i < lectures.length; i++) {
      const lecture = lectures[i];
      const captions = lecture.asset?.captions ?? [];
      const caption =
        captions.find((c) => c.locale_id === "en_US") ??
        captions.find((c) => c.locale_id?.startsWith("en")) ??
        captions[0] ??
        null;

      if (caption?.url) {
        if (!isAllowedCaptionUrl(caption.url)) {
          console.warn("[Udemy Import] Skipping non-Udemy caption URL:", caption.url);
          transcriptMap.set(i, null);
        } else {
          transcriptMap.set(i, await fetchTranscript(caption.url));
        }
      } else {
        transcriptMap.set(i, null);
      }
    }

    const { importedCount, dbCourseId } = await prisma.$transaction(async (tx) => {
      const existingCourse = await tx.course.findFirst({
        where: { url: courseUrl, userId },
      });

      if (existingCourse) {
        const existingLessonCount = await tx.lesson.count({ where: { courseId: existingCourse.id } });
        if (existingLessonCount > 0 && lectures.length < existingLessonCount * 0.5) {
          throw new Error(
            `Suspicious reduction: new fetch returned ${lectures.length} lectures but DB has ${existingLessonCount}. Import aborted.`
          );
        }
      }

      const dbCourse = existingCourse
        ? await tx.course.update({ where: { id: existingCourse.id }, data: { title: courseTitle } })
        : await tx.course.create({ data: { userId, url: courseUrl, title: courseTitle } });

      if (existingCourse) {
        await tx.lesson.deleteMany({ where: { courseId: dbCourse.id } });
      }

      let count = 0;
      for (let i = 0; i < lectures.length; i++) {
        const lecture = lectures[i];
        await tx.lesson.create({
          data: {
            courseId: dbCourse.id,
            title: lecture.title,
            order: lecture.object_index,
            transcript: transcriptMap.get(i) ?? null,
          },
        });
        count++;
      }

      return { importedCount: count, dbCourseId: dbCourse.id };
    });

    return NextResponse.json({
      title: courseTitle,
      lessonCount: importedCount,
      courseId: dbCourseId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Suspicious reduction")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ error: "Lỗi server khi import" }, { status: 500 });
  }
});
