import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const users = await p.user.findMany();
  console.log("Users:", users.length);
  users.forEach((u) => console.log("  -", u.id, u.email, u.name));

  const models = [
    { name: "Course", total: await p.course.count(), nullUser: await p.course.count({ where: { userId: null } }) },
    { name: "LessonProgress", total: await p.lessonProgress.count(), nullUser: await p.lessonProgress.count({ where: { userId: null } }) },
    { name: "CourseProgress", total: await p.courseProgress.count(), nullUser: await p.courseProgress.count({ where: { userId: null } }) },
    { name: "FlashcardReview", total: await p.flashcardReview.count(), nullUser: await p.flashcardReview.count({ where: { userId: null } }) },
    { name: "LearnerProfile", total: await p.learnerProfile.count(), nullUser: await p.learnerProfile.count({ where: { userId: null } }) },
    { name: "ChatMessage", total: await p.chatMessage.count(), nullUser: await p.chatMessage.count({ where: { userId: null } }) },
  ];

  for (const m of models) {
    console.log(`${m.name}: total=${m.total}, nullUserId=${m.nullUser}`);
  }

  const artifacts = await p.lessonArtifact.count();
  console.log("LessonArtifacts:", artifacts);

  const lessonsWithAi = await p.lesson.count({
    where: {
      OR: [
        { summary: { not: null } },
        { explanation: { not: null } },
        { quiz: { not: null } },
        { flashcards: { not: null } },
        { exercises: { not: null } },
        { notes: { not: null } },
      ],
    },
  });
  console.log("Lessons with AI fields:", lessonsWithAi);
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
