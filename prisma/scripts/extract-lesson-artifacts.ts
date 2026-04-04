/**
 * LessonArtifact Extraction Script (v1.3 Multi-User Foundation)
 *
 * Extracts AI-generated content (summary, explanation, quiz, flashcards,
 * exercises, notes) from Lesson table into per-user LessonArtifact records.
 * After extraction, nullifies the original Lesson fields.
 *
 * Usage: npx tsx prisma/scripts/extract-lesson-artifacts.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const AI_FIELDS = [
  "summary",
  "explanation",
  "quiz",
  "flashcards",
  "exercises",
  "notes",
] as const;

async function extractLessonArtifacts(): Promise<void> {
  console.log("\n🔄 Starting LessonArtifact extraction...");

  // Find all lessons that have at least one non-null AI field
  const lessons = await prisma.lesson.findMany({
    where: {
      OR: AI_FIELDS.map((field) => ({ [field]: { not: null } })),
    },
    include: {
      course: { select: { userId: true } },
    },
  });

  console.log(`📋 Found ${lessons.length} lessons with AI content`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const lesson of lessons) {
    const userId = lesson.course.userId;
    if (!userId) {
      console.warn(`  ⚠️ Lesson ${lesson.id} — course has no userId, skipping`);
      skipped++;
      continue;
    }

    try {
      // Transaction per lesson: only nullify if ALL upserts succeed
      await prisma.$transaction(async (tx) => {
        for (const field of AI_FIELDS) {
          const content = lesson[field as keyof typeof lesson] as string | null;
          if (!content) continue;

          await tx.lessonArtifact.upsert({
            where: {
              userId_lessonId_type: {
                userId,
                lessonId: lesson.id,
                type: field,
              },
            },
            create: {
              userId,
              lessonId: lesson.id,
              type: field,
              content,
            },
            update: {
              content,
            },
          });
          created++;
        }

        // Nullify original fields only after all upserts succeed
        await tx.lesson.update({
          where: { id: lesson.id },
          data: {
            summary: null,
            explanation: null,
            quiz: null,
            flashcards: null,
            exercises: null,
            notes: null,
          },
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Lesson ${lesson.id}: ${msg}`);
      errors++;
    }
  }

  // Verification
  console.log("\n🔍 Verification:");
  const artifactCount = await prisma.lessonArtifact.count();
  const remainingLessonsWithAi = await prisma.lesson.count({
    where: {
      OR: AI_FIELDS.map((field) => ({ [field]: { not: null } })),
    },
  });

  console.log(`  ✅ LessonArtifact records created: ${artifactCount}`);
  console.log(`  ${remainingLessonsWithAi === 0 ? "✅" : "❌"} Lessons with remaining AI fields: ${remainingLessonsWithAi}`);
  console.log(`  📊 Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);

  if (remainingLessonsWithAi > 0) {
    console.warn("⚠️ Some lessons still have AI fields — check courses without userId");
  }

  console.log("\n✅ Extraction complete!");
}

extractLessonArtifacts()
  .catch((err) => {
    console.error("❌ Extraction failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
