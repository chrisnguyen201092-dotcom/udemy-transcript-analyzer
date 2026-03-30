# Pre-assessment flow example for adaptive learning

Flow:
1) Collect student context and target domain (subject, level).
2) Present 8-12 quick multiple-choice items covering key topics with immediate feedback.
3) Compute per-topic proficiency (0-100) and an overall readiness score.
4) Generate an initial learning plan with recommended decks/skills and optional mastery goals.
5) Persist results to Prisma models and seed an initial adaptive schedule.

Code sketch (TypeScript – API handler outline):
```ts
type Question = { id:string; topic:string; difficulty: 'easy'|'med'|'hard'; prompt:string; options:string[]; answer:string };

async function runPreAssessment(answers: Record<string,string>): Promise<{proficiency:Record<string,number>; readiness:number}> {
  // naive scoring by topic
  const topics = new Set<string>(Object.values(answers)); // placeholder
  const proficiency: Record<string,number> = {};
  // ... compute based on correctness, difficulty, time, etc.
  topics.forEach(t => proficiency[t] = Math.floor(Math.random()*40 + 60));
  const readiness = Math.min(100, Object.values(proficiency).reduce((a,b)=>a+b,0)/Math.max(1, topics.size));
  return { proficiency, readiness };
}
```

This pattern is common across LMS like QuestionAI-style flows and Quizizz-like pre-assessments.
