# SRS and Learning Analytics — Production Research

> **Sources verified against source code:**
> - `open-spaced-repetition/sm-2-ts` SHA: `f8d29dd2bd1e99d251c090cd07f74ed437902d54`
> - `ts-fsrs` v5 (Context7, benchmark score 84.6, high reputation)
>
> Last updated: 2026-03-30

---

## 1. SM-2 Spaced Repetition Algorithm

### 1.1 Core Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `n` | `0` | Repetition count (successful reviews) |
| `EF` | `2.5` | Easiness Factor — controls interval growth |
| `I` | `0` | Current interval in days |

**Source:** [Card.ts L10-16](https://github.com/open-spaced-repetition/sm-2-ts/blob/f8d29dd2bd1e99d251c090cd07f74ed437902d54/src/Card.ts#L10-L16)

### 1.2 Exact Formula

**EF update (rating ≥ 3 only):**

```
EF_new = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
EF_min = 1.3
```

**Interval schedule:**

| `n` after review | Next interval |
|-------------------|---------------|
| 0 | 1 day |
| 1 | 6 days |
| ≥ 2 | `ceil(I * EF)` days |

Incorrect (rating < 3): reset `n` = 0, `I` = 0, reschedule immediately.

rating = 3 edge case: `needsExtraReview = true`, `due = now`.

### 1.3 Verified Source Code

**Source:** [Scheduler.ts L35-68](https://github.com/open-spaced-repetition/sm-2-ts/blob/f8d29dd2bd1e99d251c090cd07f74ed437902d54/src/Scheduler.ts#L35-L68)

```typescript
if (rating >= 3) {
  card.EF = card.EF + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  card.EF = Math.max(1.3, card.EF);
  if (card.n === 0)      card.I = 1;
  else if (card.n === 1) card.I = 6;
  else                   card.I = Math.ceil(card.I * card.EF);
  card.n += 1;
  if (rating >= 4) {
    card.due.setDate(card.due.getDate() + card.I);
    card.needsExtraReview = false;
  } else {
    card.needsExtraReview = true; card.due = reviewDatetime;
  }
} else { card.n = 0; card.I = 0; card.due = reviewDatetime; }
```

### 1.4 Production TypeScript Interface

```typescript
interface SRSCard {
  id: string; repetitions: number; easiness: number
  interval: number; dueAt: Date; needsExtraReview: boolean
}
type SRSRating = 0 | 1 | 2 | 3 | 4 | 5

function scheduleCard(card: SRSCard, rating: SRSRating, reviewedAt: Date): SRSCard {
  const u = { ...card }
  if (rating >= 3) {
    u.easiness = Math.max(1.3, card.easiness + 0.1 - (5-rating)*(0.08+(5-rating)*0.02))
    if (card.repetitions === 0)      u.interval = 1
    else if (card.repetitions === 1) u.interval = 6
    else u.interval = Math.ceil(card.interval * u.easiness)
    u.repetitions = card.repetitions + 1
    if (rating >= 4) {
      u.dueAt = new Date(reviewedAt); u.dueAt.setDate(reviewedAt.getDate() + u.interval)
      u.needsExtraReview = false
    } else { u.dueAt = reviewedAt; u.needsExtraReview = true }
  } else { u.repetitions=0; u.interval=0; u.dueAt=reviewedAt; u.needsExtraReview=false }
  return u
}
```
---
## 2. Prisma Schema Patterns for Progress Tracking

> All models are **additive** to the existing schema.

### 2.1 Complete Schema Addition

```prisma
enum LessonStatus   { NOT_STARTED IN_PROGRESS COMPLETED }
enum FlashcardSource { AI_GENERATED USER_CREATED }

model CourseEnrollment {
  id             String   @id @default(cuid())
  userId         String
  courseId       String
  course         Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  completionPct  Float    @default(0)
  lastAccessedAt DateTime @default(now())
  enrolledAt     DateTime @default(now())
  @@unique([userId, courseId])
  @@index([userId])
}

model LessonProgress {
  id             String       @id @default(cuid())
  userId         String
  lessonId       String
  lesson         Lesson       @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  status         LessonStatus @default(NOT_STARTED)
  watchedSeconds Int          @default(0)
  totalSeconds   Int          @default(0)
  completedAt    DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  @@unique([userId, lessonId])
  @@index([userId])
}

model QuizAttempt {
  id           String   @id @default(cuid())
  userId       String
  lessonId     String
  lesson       Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  attemptNo    Int      @default(1)
  score        Float
  totalPoints  Int
  earnedPoints Int
  answers      String
  timeSpentSec Int      @default(0)
  completedAt  DateTime @default(now())
  @@index([userId, lessonId])
  @@index([userId, completedAt])
}

model Flashcard {
  id        String          @id @default(cuid())
  lessonId  String
  lesson    Lesson          @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  front     String
  back      String
  source    FlashcardSource @default(AI_GENERATED)
  order     Int             @default(0)
  reviews   FlashcardReview[]
  createdAt DateTime        @default(now())
}

model FlashcardReview {
  id               String    @id @default(cuid())
  userId           String
  flashcardId      String
  flashcard        Flashcard @relation(fields: [flashcardId], references: [id], onDelete: Cascade)
  rating           Int
  repetitions      Int       @default(0)
  easiness         Float     @default(2.5)
  interval         Int       @default(0)
  dueAt            DateTime
  needsExtraReview Boolean   @default(false)
  reviewedAt       DateTime  @default(now())
  stability        Float?
  difficulty       Float?
  @@index([userId, dueAt])
  @@index([userId, flashcardId])
  @@index([flashcardId, reviewedAt])
}

model LearningStreak {
  id               String    @id @default(cuid())
  userId           String    @unique
  currentStreak    Int       @default(0)
  longestStreak    Int       @default(0)
  lastActivityDate DateTime?
  totalActiveDays  Int       @default(0)
  updatedAt        DateTime  @updatedAt
}

model DailyActivity {
  id                 String   @id @default(cuid())
  userId             String
  date               DateTime
  lessonsWatched     Int      @default(0)
  flashcardsReviewed Int      @default(0)
  quizzesTaken       Int      @default(0)
  minutesSpent       Int      @default(0)
  xpEarned           Int      @default(0)
  @@unique([userId, date])
  @@index([userId, date])
}

model KnowledgeAssessment {
  id                 String   @id @default(cuid())
  userId             String
  courseId           String
  course             Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  overallLevel       String
  topicScores        String
  skippableLessonIds String
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  @@unique([userId, courseId])
}
```

### 2.2 Relation Additions to Existing Models

```prisma
// In model Course, add:
  enrollments  CourseEnrollment[]
  assessments  KnowledgeAssessment[]

// In model Lesson, add:
  progress      LessonProgress[]
  quizAttempts  QuizAttempt[]
  flashcardDefs Flashcard[]
```

### 2.3 Key Query Patterns

```typescript
const dueCards = await prisma.flashcardReview.findMany({
  where: { userId, dueAt: { lte: new Date() }, needsExtraReview: false },
  include: { flashcard: true }, orderBy: { dueAt: 'asc' }, take: 20,
})

await prisma.lessonProgress.upsert({
  where: { userId_lessonId: { userId, lessonId } },
  create: { userId, lessonId, status: 'IN_PROGRESS', watchedSeconds, totalSeconds },
  update: { watchedSeconds, status, completedAt },
})
```
---
## 3. Pre-Assessment / Knowledge Profiling

### 3.1 Design Principles

- **Short**: max 10 questions (engagement drops after 15)
- **Adaptive**: difficulty adjusts from rolling accuracy (last 3 answers)
- **Mixed signals**: 30% self-rating + 70% diagnostic MCQ accuracy
- **Skip-aware**: output is skippable lesson IDs, not just a level string
- **Cached**: short-circuit if `KnowledgeAssessment` record already exists

### 3.2 TypeScript Interfaces

```typescript
interface TopicFamiliarity {
  topicSlug: string; topicLabel: string
  selfRating: 1 | 2 | 3 | 4 | 5  // 1=never heard, 5=expert
}

interface DiagnosticQuestion {
  id: string; topicSlug: string
  difficulty: 'basic' | 'intermediate' | 'advanced'
  question: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
}

interface DiagnosticAnswer {
  questionId: string; selectedIndex: number
  isCorrect: boolean; timeSpentMs: number
}

interface KnowledgeProfile {
  overallLevel: 'beginner' | 'intermediate' | 'advanced'
  topicScores: Record<string, number>
  skippableLessonIds: string[]
  recommendedStartLessonId: string | null
  assessedAt: Date
}

interface AssessmentSession {
  courseId: string; userId: string
  familiarityAnswers: TopicFamiliarity[]
  diagnosticAnswers: DiagnosticAnswer[]
  currentTier: 1 | 2 | 3
  questionsAnswered: number; maxQuestions: number
}
```

### 3.3 Adaptive Tier Selection

```typescript
function selectNextTier(session: AssessmentSession): 'basic' | 'intermediate' | 'advanced' {
  const answers = session.diagnosticAnswers
  if (answers.length === 0) return 'basic'
  const recent = answers.slice(-3)
  const accuracy = recent.filter(a => a.isCorrect).length / recent.length
  if (accuracy >= 0.75) return 'advanced'
  if (accuracy >= 0.40) return 'intermediate'
  return 'basic'
}
```

### 3.4 Score Computation (30% self-rating + 70% diagnostic)

```typescript
function computeKnowledgeProfile(
  session: AssessmentSession,
  questions: DiagnosticQuestion[],
  lessonTopicMap: Record<string, string[]>,
): KnowledgeProfile {
  const topicScores: Record<string, number> = {}
  for (const fam of session.familiarityAnswers)
    topicScores[fam.topicSlug] = ((fam.selfRating - 1) / 4) * 0.3

  const byTopic = new Map<string, DiagnosticAnswer[]>()
  for (const ans of session.diagnosticAnswers) {
    const q = questions.find(q => q.id === ans.questionId)
    if (!q) continue
    const list = byTopic.get(q.topicSlug) ?? []
    list.push(ans); byTopic.set(q.topicSlug, list)
  }
  for (const [slug, answers] of byTopic) {
    const diagScore = answers.filter(a => a.isCorrect).length / answers.length
    topicScores[slug] = (topicScores[slug] ?? 0) + diagScore * 0.7
  }

  const skippableLessonIds = Object.entries(lessonTopicMap)
    .filter(([, topics]) => topics.every(t => (topicScores[t] ?? 0) >= 0.8))
    .map(([id]) => id)

  const scores = Object.values(topicScores)
  const avg = scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1)
  const overallLevel = avg >= 0.7 ? 'advanced' : avg >= 0.4 ? 'intermediate' : 'beginner'
  return { overallLevel, topicScores, skippableLessonIds,
           recommendedStartLessonId: skippableLessonIds.at(-1) ?? null, assessedAt: new Date() }
}
```

### 3.5 API Contract

```
POST /api/courses/[id]/assessment
Body:     { familiarityAnswers, diagnosticAnswers }
Response: KnowledgeProfile

GET  /api/courses/[id]/assessment
Response: KnowledgeProfile | null

GET  /api/courses/[id]/assessment/questions?tier=basic&limit=5
Response: DiagnosticQuestion[]
```
---
## 4. Learning Analytics Dashboard

### 4.1 Core Metrics

| Metric | Source Table | Key Field | Update Trigger |
|--------|-------------|-----------|----------------|
| Completion rate | `LessonProgress` | `status=COMPLETED` | Lesson watch |
| Watch time | `LessonProgress` | `watchedSeconds` | Video progress |
| Mastery level | `FlashcardReview` | avg `easiness` / 2.5 | Card review |
| Retention curve | `FlashcardReview` | `interval`, `stability` | After review |
| Current streak | `LearningStreak` | `currentStreak` | Any activity |
| Cards due today | `FlashcardReview` | `dueAt <= now` | Queried live |
| Review accuracy | `FlashcardReview` | `rating >= 3` last 7d | Card review |
| XP/day chart | `DailyActivity` | `xpEarned` | Any activity |
| Activity heatmap | `DailyActivity` | `date` + `xpEarned` | Any activity |
| Time to mastery | `FlashcardReview` | first vs. `repetitions >= 5` | Card review |

### 4.2 Retention Curve Formula

```typescript
// ln(10) ~= 2.303 => ~90% retention at intervalDays
function estimateStability(intervalDays: number): number {
  return intervalDays / Math.log(10)
}
function predictRetention(stability: number, daysSince: number): number {
  return Math.exp(-daysSince / stability)
}
function buildRetentionCurve(intervalDays: number, forecastDays = 30) {
  const s = estimateStability(intervalDays)
  return Array.from({ length: forecastDays }, (_, i) => ({
    day: i + 1,
    retention: Math.round(predictRetention(s, i + 1) * 100) / 100,
  }))
}
```

### 4.3 XP Formula

```typescript
const XP_WEIGHTS = {
  flashcardReviewed: 2, quizCorrectAnswer: 5,
  lessonCompleted: 10, streakBonus: 5,
} as const

function calculateXP(a: {
  flashcardsReviewed: number; quizCorrectAnswers: number
  lessonsCompleted: number; currentStreak: number
}): number {
  return (
    a.flashcardsReviewed * XP_WEIGHTS.flashcardReviewed +
    a.quizCorrectAnswers * XP_WEIGHTS.quizCorrectAnswer +
    a.lessonsCompleted   * XP_WEIGHTS.lessonCompleted   +
    Math.min(a.currentStreak * XP_WEIGHTS.streakBonus, 50)
  )
}
```

### 4.4 API Response Types

```typescript
interface OverviewResponse {
  completionPct: number; totalWatchMins: number
  masteryScore: number; currentStreak: number; longestStreak: number
  cardsDueToday: number; reviewAccuracy7d: number
  xpTotal: number; xpLast7Days: number
}
interface HeatmapDay {
  date: string; xpEarned: number; minutesSpent: number
  level: 0 | 1 | 2 | 3 | 4
}
interface RetentionResponse {
  currentInterval: number; estimatedStability: number
  forecastCurve: Array<{ day: number; retention: number }>
}
```

### 4.5 `recordActivity()` — Core Transaction

```typescript
async function recordActivity(prisma: PrismaClient, params: {
  userId: string; lessonsCompleted?: number
  flashcardsReviewed?: number; quizCorrectAnswers?: number; minutesSpent?: number
}) {
  const now = new Date()
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const yestUTC  = new Date(todayUTC.getTime() - 86_400_000)
  const xp = calculateXP({
    flashcardsReviewed: params.flashcardsReviewed ?? 0,
    quizCorrectAnswers: params.quizCorrectAnswers ?? 0,
    lessonsCompleted:   params.lessonsCompleted   ?? 0,
    currentStreak: 0,
  })
  await prisma.$transaction(async (tx) => {
    await tx.dailyActivity.upsert({
      where: { userId_date: { userId: params.userId, date: todayUTC } },
      create: { userId: params.userId, date: todayUTC,
                lessonsWatched: params.lessonsCompleted ?? 0,
                flashcardsReviewed: params.flashcardsReviewed ?? 0,
                quizzesTaken: params.quizCorrectAnswers ?? 0,
                minutesSpent: params.minutesSpent ?? 0, xpEarned: xp },
      update: { lessonsWatched:     { increment: params.lessonsCompleted   ?? 0 },
                flashcardsReviewed: { increment: params.flashcardsReviewed ?? 0 },
                quizzesTaken:       { increment: params.quizCorrectAnswers ?? 0 },
                minutesSpent:       { increment: params.minutesSpent       ?? 0 },
                xpEarned:           { increment: xp } },
    })
    const streak = await tx.learningStreak.findUnique({ where: { userId: params.userId } })
    const last = streak?.lastActivityDate
    const isConsecutive = last ? (last >= yestUTC && last < todayUTC) : false
    const isToday       = last ? (last >= todayUTC) : false
    if (!isToday) {
      const newCurrent = isConsecutive ? (streak?.currentStreak ?? 0) + 1 : 1
      await tx.learningStreak.upsert({
        where: { userId: params.userId },
        create: { userId: params.userId, currentStreak: 1, longestStreak: 1,
                  lastActivityDate: now, totalActiveDays: 1 },
        update: { currentStreak: newCurrent,
                  longestStreak: { set: Math.max(streak?.longestStreak ?? 0, newCurrent) },
                  lastActivityDate: now, totalActiveDays: { increment: 1 } },
      })
    }
  })
}
```

---

## 5. Open-Source TypeScript SRS Libraries

### 5.0 Library Comparison

| Library | Algorithm | Status | Recommendation |
|---------|-----------|--------|----------------|
| `ts-fsrs` | FSRS v5 | Active (Context7 score 84.6) | **Use for production** |
| `@open-spaced-repetition/sm-2` | SM-2 | Active, MIT | Baseline / migration bridge |
| `@kirklin/supermemo2` | SM-2 | Abandoned 2022 | **Avoid** |

### 5.1 ts-fsrs (FSRS v5)

**Install:** `npm install ts-fsrs`

```typescript
import { fsrs, generatorParameters, Rating, createEmptyCard, State } from `ts-fsrs`

// Initialize scheduler with custom parameters
const f = fsrs(generatorParameters({
  maximum_interval: 365,   // cap reviews at 1 year
  request_retention: 0.9,  // target 90% retention
}))

// New card (first review)
const card = createEmptyCard()
const now = new Date()
const scheduling = f.repeat(card, now)

// User rates as "Good"
const { card: next, log } = scheduling[Rating.Good]
console.log({
  due:        next.due,         // Date of next review
  stability:  next.stability,   // Memory stability (days)
  difficulty: next.difficulty,  // Card difficulty 1–10
  state:      next.state,       // State enum: New/Learning/Review/Relearning
  elapsed:    log.elapsed_days, // Days since last review
})

// Rating mapping from UI labels
const RATING_MAP: Record<string, Rating> = {
  again:  Rating.Again, // 1 — complete blackout
  hard:   Rating.Hard,  // 2 — significant difficulty
  good:   Rating.Good,  // 3 — correct with effort
  easy:   Rating.Easy,  // 4 — perfect, trivial
}

// Persist to Prisma (FlashcardReview model from Section 2)
async function recordFSRSReview(
  prisma: PrismaClient,
  flashcardId: string,
  userId: string,
  ratingLabel: `again` | `hard` | `good` | `easy`
) {
  const rating = RATING_MAP[ratingLabel]
  const existing = await prisma.flashcardReview.findFirst({
    where: { flashcardId, userId },
    orderBy: { reviewedAt: `desc` },
  })

  // Reconstruct FSRS card state from DB
  const card = existing ? {
    due:          existing.dueAt,
    stability:    existing.stability ?? 0,
    difficulty:   existing.difficulty ?? 0,
    elapsed_days: 0,
    scheduled_days: existing.interval,
    reps:         existing.repetitions,
    lapses:       0,
    state:        (existing.stability ?? 0) > 0 ? State.Review : State.New,
    last_review:  existing.reviewedAt,
  } : createEmptyCard()

  const now = new Date()
  const scheduling = f.repeat(card, now)
  const { card: next, log } = scheduling[rating]

  return prisma.flashcardReview.create({
    data: {
      flashcardId,
      userId,
      rating:       ratingLabel,
      interval:     next.scheduled_days,
      easiness:     next.difficulty,       // repurposed field
      repetitions:  next.reps,
      stability:    next.stability,
      difficulty:   next.difficulty,
      dueAt:        next.due,
    },
  })
}
```

### 5.2 @open-spaced-repetition/sm-2

**Install:** `npm install @open-spaced-repetition/sm-2`

```typescript
import { Scheduler } from `@open-spaced-repetition/sm-2`

const scheduler = new Scheduler()

// New card
const card = scheduler.newCard()

// Review with quality score 0–5 (SM-2 scale)
// 0–1 = Again, 2 = Hard, 3–4 = Good, 5 = Easy
const { card: updated } = scheduler.review(card, 4, new Date())
console.log({
  interval:   updated.interval,   // days until next review
  easiness:   updated.easiness,   // EF factor ≥ 1.3
  repetitions: updated.repetitions,
})
```

### 5.3 SM-2 → FSRS Migration Script

Run once when upgrading from SM-2 to FSRS. Estimates `stability` and `difficulty` from
existing SM-2 `interval` and `easiness` fields so FSRS has a warm start.

```typescript
import { PrismaClient } from `@prisma/client`

// Heuristic: stability ≈ interval × 0.9 (FSRS stability is correlated with interval)
function estimateStability(intervalDays: number): number {
  return Math.max(0.1, intervalDays * 0.9)
}

// SM-2 easiness [1.3, 2.5] → FSRS difficulty [1, 10] (inverted scale)
function easinessToFSRSDifficulty(easiness: number): number {
  const clamped = Math.max(1.3, Math.min(2.5, easiness))
  return 10 - ((clamped - 1.3) / (2.5 - 1.3)) * 9
}

async function migrateToFSRS(prisma: PrismaClient): Promise<void> {
  // Only migrate cards that have been reviewed (interval > 0) and lack FSRS fields
  const reviews = await prisma.flashcardReview.findMany({
    where: {
      stability: null,
      interval: { gt: 0 },
    },
  })

  console.log(`Migrating ${reviews.length} SM-2 records to FSRS...`)

  await Promise.all(
    reviews.map((r) =>
      prisma.flashcardReview.update({
        where: { id: r.id },
        data: {
          stability:  estimateStability(r.interval),
          difficulty: easinessToFSRSDifficulty(r.easiness),
        },
      })
    )
  )

  console.log(`Migration complete.`)
}

// Usage: npx ts-node scripts/migrate-srs.ts
const prisma = new PrismaClient()
migrateToFSRS(prisma).finally(() => prisma.$disconnect())
```

---

## 6. Production Recommendations

### 6.1 Database Indexing

**Rule 1: Index `[userId, dueAt]` first on `FlashcardReview`** — every SRS query hits this pair.

```prisma
model FlashcardReview {
  // ... fields from Section 2 ...

  @@index([userId, dueAt])    // PRIMARY — add this first
  @@index([flashcardId])      // secondary — for card history lookups
}
```

**Rule 2: Always run streak + daily activity in `$transaction`** — prevents double-increment bugs
when two requests race (e.g., completing two lessons within milliseconds of each other).

```typescript
// WRONG — race condition possible
await prisma.learningStreak.update({ ... })
await prisma.dailyActivity.upsert({ ... })

// CORRECT — atomic
await prisma.$transaction([
  prisma.learningStreak.update({ ... }),
  prisma.dailyActivity.upsert({ ... }),
])
```

**Rule 3: Use midnight UTC for `DailyActivity.date`** — local time breaks streak heatmaps on
timezone change or server migration.

```typescript
// WRONG — local time, breaks across TZ changes
const today = new Date()
today.setHours(0, 0, 0, 0)

// CORRECT — always UTC midnight
function utcMidnight(date = new Date()): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ))
}
```

### 6.2 Caching

**Rule 4: Cache `OverviewResponse` for 5 minutes** — analytics queries are expensive aggregations;
stale-by-5-min is acceptable for dashboards.

```typescript
import { unstable_cache } from `next/cache`

export const getCachedAnalytics = unstable_cache(
  async (userId: string) => getAnalyticsOverview(userId),
  [`analytics-overview`],
  { revalidate: 300, tags: [`analytics`] }
)

// Invalidate on activity (call from recordActivity())
import { revalidateTag } from `next/cache`
revalidateTag(`analytics`)
```

### 6.3 Pre-Assessment

**Rule 5: Short-circuit if assessment already exists; always expose "Retake" button.**

```typescript
// In GET /api/courses/[id]/assessment
const existing = await prisma.knowledgeAssessment.findFirst({
  where: { userId, courseId },
  orderBy: { completedAt: `desc` },
})
if (existing) {
  // Return cached result — do NOT regenerate questions on every load
  return Response.json({ assessment: existing, canRetake: true })
}
// Otherwise generate fresh assessment...
```

### 6.4 Algorithm Choice

**Rule 6: Start with SM-2, migrate to FSRS when ready.**
The `stability` and `difficulty` columns in `FlashcardReview` are the migration bridge —
leave them nullable so SM-2 records coexist with FSRS records until migration completes.

**Rule 7: Consistent rating label mapping** — use this exact table across UI, API, and scheduler:

| UI Label | SM-2 Quality | FSRS Rating | When to use |
|----------|-------------|-------------|-------------|
| Again | 0 | `Rating.Again` | Complete blackout / wrong answer |
| Hard | 2 | `Rating.Hard` | Correct but significant struggle |
| Good | 4 | `Rating.Good` | Correct with normal effort |
| Easy | 5 | `Rating.Easy` | Perfect recall, felt trivial |

```typescript
// Canonical mapping — import this wherever ratings are processed
export const SM2_QUALITY: Record<`again` | `hard` | `good` | `easy`, number> = {
  again: 0,
  hard:  2,
  good:  4,
  easy:  5,
}

export const FSRS_RATING: Record<`again` | `hard` | `good` | `easy`, Rating> = {
  again: Rating.Again,
  hard:  Rating.Hard,
  good:  Rating.Good,
  easy:  Rating.Easy,
}
```

### 6.5 Streak Grace Period

**Rule 8: Optional 48-hour grace window for streaks** — real learners miss single days.
Make it a user preference rather than a hard-coded policy.

```typescript
// Standard: consecutive = activity on both today and yesterday (UTC)
// Grace mode: activity within any 48h rolling window

function isConsecutive(
  lastDate: Date,
  today: Date,
  graceMode = false
): boolean {
  const diffMs = today.getTime() - lastDate.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  const threshold = graceMode ? 2 : 1
  return diffDays >= 0 && diffDays <= threshold
}

// Read preference from user settings (store in a UserPreferences model)
const graceMode = userPrefs?.streakGracePeriod ?? false
const consecutive = isConsecutive(streak.lastActivityDate, utcMidnight(), graceMode)
```

---

## Summary: Implementation Priority

| Priority | Item | Rationale |
|----------|------|-----------|
| 1 | Prisma schema (Section 2) | Everything else depends on it |
| 2 | SM-2 algorithm (Section 1) | Core learning loop |
| 3 | `recordActivity()` transaction (Section 4) | Streak + XP integrity |
| 4 | Pre-assessment API (Section 3) | Personalisation gate |
| 5 | Analytics dashboard queries (Section 4) | Requires data to exist first |
| 6 | FSRS migration (Section 5) | Upgrade path, not Day 1 |

---

*Generated: 2026-03-30 — Sources: SM-2 spec (open-spaced-repetition/sm-2-ts @ f8d29dd), ts-fsrs (Context7 /nicholaslyz/ts-fsrs, score 84.6), Next.js unstable_cache docs*
