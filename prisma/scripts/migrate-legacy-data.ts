/**
 * Legacy Data Migration Script (v1.3 Multi-User Foundation)
 *
 * Assigns all records with NULL userId to the bootstrap user
 * (the first registered user). Run once after first user registration.
 *
 * Usage: npx tsx prisma/scripts/migrate-legacy-data.ts <userId>
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function migrateLegacyData(userId: string): Promise<void> {
  console.log(`\n🔄 Starting legacy data migration for user: ${userId}`);

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  // Create backup metadata for rollback tracking
  const timestamp = new Date().toISOString();
  console.log(`📋 Migration timestamp: ${timestamp}`);

  // Migrate each model in dependency order: Course first (parent), then children
  const models = [
    { name: "Course", fn: () => prisma.course.updateMany({ where: { userId: null }, data: { userId } }) },
    { name: "LessonProgress", fn: () => prisma.lessonProgress.updateMany({ where: { userId: null }, data: { userId } }) },
    { name: "CourseProgress", fn: () => prisma.courseProgress.updateMany({ where: { userId: null }, data: { userId } }) },
    { name: "FlashcardReview", fn: () => prisma.flashcardReview.updateMany({ where: { userId: null }, data: { userId } }) },
    { name: "LearnerProfile", fn: () => prisma.learnerProfile.updateMany({ where: { userId: null }, data: { userId } }) },
    { name: "ChatMessage", fn: () => prisma.chatMessage.updateMany({ where: { userId: null }, data: { userId } }) },
  ];

  let totalMigrated = 0;
  for (const { name, fn } of models) {
    const result = await fn();
    console.log(`  ✅ ${name}: ${result.count} records migrated`);
    totalMigrated += result.count;
  }

  // Verification: check no NULL userId records remain
  console.log("\n🔍 Verification:");
  const checks = [
    { name: "Course", count: await prisma.course.count({ where: { userId: null } }) },
    { name: "LessonProgress", count: await prisma.lessonProgress.count({ where: { userId: null } }) },
    { name: "CourseProgress", count: await prisma.courseProgress.count({ where: { userId: null } }) },
    { name: "FlashcardReview", count: await prisma.flashcardReview.count({ where: { userId: null } }) },
    { name: "LearnerProfile", count: await prisma.learnerProfile.count({ where: { userId: null } }) },
    { name: "ChatMessage", count: await prisma.chatMessage.count({ where: { userId: null } }) },
  ];

  let hasOrphans = false;
  for (const { name, count } of checks) {
    const status = count === 0 ? "✅" : "❌";
    console.log(`  ${status} ${name}: ${count} orphaned records`);
    if (count > 0) hasOrphans = true;
  }

  if (hasOrphans) {
    throw new Error("Migration incomplete — orphaned records remain with NULL userId");
  }

  console.log(`\n✅ Migration complete! ${totalMigrated} total records assigned to user ${userId}`);
}

// CLI entry point
const userId = process.argv[2];
if (!userId) {
  console.error("Usage: npx tsx prisma/scripts/migrate-legacy-data.ts <userId>");
  process.exit(1);
}

migrateLegacyData(userId)
  .catch((err) => {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
