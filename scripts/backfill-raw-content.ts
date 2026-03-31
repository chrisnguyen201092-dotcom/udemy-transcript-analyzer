/**
 * One-time migration script: backfill Course.rawContent for legacy courses.
 *
 * Reconstructs full text from lesson transcripts for courses that:
 * - Have contentType === 'book'
 * - Have rawContent === null
 * - Have at least one lesson
 *
 * Reconstruction rules:
 * - Join transcripts by "\n\n---\n\n" separator (visual chapter break)
 * - Order strictly by lesson.order ASC (deterministic)
 * - Skip lessons with transcript === null (warn in output)
 * - Prefix each chapter: "# {lesson.title}\n\n{transcript}"
 *
 * Best-effort warning: Reconstructed content may differ from original file
 * due to parsing/editing. Consider re-uploading for exact match.
 *
 * Usage: npx tsx scripts/backfill-raw-content.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface BackfillResult {
  courseId: string;
  courseTitle: string;
  lessonCount: number;
  nullTranscripts: number;
  totalChars: number;
  status: "backfilled" | "skipped_no_lessons" | "skipped_all_null" | "error";
  error?: string;
}

async function backfill(): Promise<void> {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Backfill rawContent for legacy book courses  ║");
  console.log("╚══════════════════════════════════════════════╝\n");

  // Find all book courses without rawContent
  const courses = await prisma.course.findMany({
    where: {
      contentType: "book",
      rawContent: null,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (courses.length === 0) {
    console.log("✅ No courses need backfilling. All book courses already have rawContent.");
    return;
  }

  console.log(`Found ${courses.length} course(s) to backfill.\n`);

  const results: BackfillResult[] = [];

  for (const course of courses) {
    try {
      const lessons = await prisma.lesson.findMany({
        where: { courseId: course.id },
        orderBy: { order: "asc" },
        select: {
          title: true,
          transcript: true,
          order: true,
        },
      });

      if (lessons.length === 0) {
        results.push({
          courseId: course.id,
          courseTitle: course.title ?? "Untitled",
          lessonCount: 0,
          nullTranscripts: 0,
          totalChars: 0,
          status: "skipped_no_lessons",
        });
        continue;
      }

      const nullCount = lessons.filter((l) => l.transcript === null).length;

      if (nullCount === lessons.length) {
        results.push({
          courseId: course.id,
          courseTitle: course.title ?? "Untitled",
          lessonCount: lessons.length,
          nullTranscripts: nullCount,
          totalChars: 0,
          status: "skipped_all_null",
        });
        continue;
      }

      // Reconstruct full text
      const sections: string[] = [];
      for (const lesson of lessons) {
        if (lesson.transcript === null) {
          console.warn(
            `  ⚠ Course "${course.title}" — Lesson #${lesson.order} "${lesson.title}" has null transcript, skipping.`
          );
          continue;
        }
        sections.push(`# ${lesson.title}\n\n${lesson.transcript}`);
      }

      const rawContent = sections.join("\n\n---\n\n");

      await prisma.course.update({
        where: { id: course.id },
        data: { rawContent },
      });

      results.push({
        courseId: course.id,
        courseTitle: course.title ?? "Untitled",
        lessonCount: lessons.length,
        nullTranscripts: nullCount,
        totalChars: rawContent.length,
        status: "backfilled",
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      results.push({
        courseId: course.id,
        courseTitle: course.title ?? "Untitled",
        lessonCount: 0,
        nullTranscripts: 0,
        totalChars: 0,
        status: "error",
        error: reason,
      });
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log("\n─── Results ───\n");

  const backfilled = results.filter((r) => r.status === "backfilled");
  const skipped = results.filter((r) => r.status.startsWith("skipped"));
  const errors = results.filter((r) => r.status === "error");

  for (const r of results) {
    const icon =
      r.status === "backfilled" ? "✅" :
      r.status === "error" ? "❌" : "⏭️";
    console.log(
      `${icon} ${r.courseTitle} (${r.courseId}): ${r.status}` +
      (r.status === "backfilled" ? ` — ${r.lessonCount} lessons, ${r.totalChars} chars` : "") +
      (r.nullTranscripts > 0 ? ` (${r.nullTranscripts} null transcripts)` : "") +
      (r.error ? ` — ${r.error}` : "")
    );
  }

  console.log(`\n─── Summary ───`);
  console.log(`Backfilled: ${backfilled.length}`);
  console.log(`Skipped:    ${skipped.length}`);
  console.log(`Errors:     ${errors.length}`);

  if (backfilled.length > 0) {
    console.log(
      "\n⚠️  Best-effort warning: Reconstructed content may differ from original file " +
      "due to parsing/editing. Consider re-uploading for exact match."
    );
  }
}

backfill()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
