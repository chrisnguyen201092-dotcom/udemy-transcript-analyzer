/**
 * Create bootstrap user for dev environment, then run legacy migration + artifact extraction.
 * Usage: npx tsx prisma/scripts/bootstrap-and-migrate.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Create bootstrap user if none exists
  let user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    console.log("📦 Creating bootstrap user...");
    user = await prisma.user.create({
      data: {
        email: "admin@inkgest.dev",
        passwordHash: "$2b$10$placeholder-hash-for-dev-only",
        name: "Admin (Dev)",
      },
    });
    console.log(`  ✅ Created user: ${user.id} (${user.email})`);
  } else {
    console.log(`📦 Bootstrap user already exists: ${user.id} (${user.email})`);
  }

  // 2. Run legacy data migration (assign NULL userId records to bootstrap user)
  console.log(`\n🔄 Migrating legacy data to user: ${user.id}`);
  const models = [
    { name: "Course", fn: () => prisma.course.updateMany({ where: { userId: null }, data: { userId: user!.id } }) },
    { name: "LessonProgress", fn: () => prisma.lessonProgress.updateMany({ where: { userId: null }, data: { userId: user!.id } }) },
    { name: "CourseProgress", fn: () => prisma.courseProgress.updateMany({ where: { userId: null }, data: { userId: user!.id } }) },
    { name: "FlashcardReview", fn: () => prisma.flashcardReview.updateMany({ where: { userId: null }, data: { userId: user!.id } }) },
    { name: "LearnerProfile", fn: () => prisma.learnerProfile.updateMany({ where: { userId: null }, data: { userId: user!.id } }) },
    { name: "ChatMessage", fn: () => prisma.chatMessage.updateMany({ where: { userId: null }, data: { userId: user!.id } }) },
  ];

  let total = 0;
  for (const { name, fn } of models) {
    const result = await fn();
    console.log(`  ✅ ${name}: ${result.count} records migrated`);
    total += result.count;
  }
  console.log(`  📊 Total: ${total} records`);

  // 3. Extract lesson artifacts
  console.log("\n🔄 Extracting lesson artifacts...");
  const AI_FIELDS = ["summary", "explanation", "quiz", "flashcards", "exercises", "notes"] as const;
  const lessons = await prisma.lesson.findMany({
    where: { OR: AI_FIELDS.map((f) => ({ [f]: { not: null } })) },
    include: { course: { select: { userId: true } } },
  });

  let created = 0;
  for (const lesson of lessons) {
    const userId = lesson.course.userId;
    if (!userId) continue;

    for (const field of AI_FIELDS) {
      const content = lesson[field as keyof typeof lesson] as string | null;
      if (!content) continue;

      await prisma.lessonArtifact.upsert({
        where: { userId_lessonId_type: { userId, lessonId: lesson.id, type: field } },
        create: { userId, lessonId: lesson.id, type: field, content },
        update: { content },
      });
      created++;
    }

    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { summary: null, explanation: null, quiz: null, flashcards: null, exercises: null, notes: null },
    });
  }
  console.log(`  ✅ ${created} artifacts created from ${lessons.length} lessons`);

  // 4. Verify
  console.log("\n🔍 Verification:");
  const nullChecks = [
    { name: "Course", count: await prisma.course.count({ where: { userId: null } }) },
    { name: "LessonProgress", count: await prisma.lessonProgress.count({ where: { userId: null } }) },
    { name: "CourseProgress", count: await prisma.courseProgress.count({ where: { userId: null } }) },
    { name: "FlashcardReview", count: await prisma.flashcardReview.count({ where: { userId: null } }) },
    { name: "LearnerProfile", count: await prisma.learnerProfile.count({ where: { userId: null } }) },
    { name: "ChatMessage", count: await prisma.chatMessage.count({ where: { userId: null } }) },
  ];

  let allClean = true;
  for (const { name, count } of nullChecks) {
    const ok = count === 0;
    console.log(`  ${ok ? "✅" : "❌"} ${name}: ${count} orphaned`);
    if (!ok) allClean = false;
  }

  const artCount = await prisma.lessonArtifact.count();
  const remainingAi = await prisma.lesson.count({
    where: { OR: AI_FIELDS.map((f) => ({ [f]: { not: null } })) },
  });
  console.log(`  ✅ Artifacts: ${artCount}`);
  console.log(`  ${remainingAi === 0 ? "✅" : "❌"} Remaining AI fields: ${remainingAi}`);

  if (allClean && remainingAi === 0) {
    console.log("\n✅ All migrations complete! Ready for non-nullable userId.");
  } else {
    console.log("\n⚠️ Some issues remain — check above.");
  }
}

main()
  .catch((e) => { console.error("❌ Failed:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
