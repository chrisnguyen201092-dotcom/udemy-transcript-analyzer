# Master Improvement Plan — Nâng điểm tất cả specs lên 9.5+

## Mục tiêu
Nâng **tất cả** điểm đánh giá từ góc độ giáo dục (educational effectiveness) lên **9.5+/10** bằng cách:
1. Bổ sung các hệ thống học tập còn thiếu hoàn toàn (progress tracking, SRS, analytics, pre-assessment)
2. Sửa các spec hiện tại có lỗ hổng giáo dục (Chat không Socratic, Explain không adaptive, Roadmap không personalized)
3. Nâng cấp UX học tập (chat persistence, export, transcript search)

## Đánh giá hiện tại

| Spec | Điểm | Vấn đề chính |
|------|-------|--------------|
| PRD | 8.5 | Thiếu progress tracking, analytics |
| ai-summary | 7.5 | Word count contradiction (PRD: 600-2500 vs research: 300-500) |
| ai-explain | 7.0 | Không adaptive depth, không biết level người học |
| ai-chat | 6.5 | Claim "Socratic" nhưng chỉ là Q&A routing, không có guided questioning |
| ai-practice | 8.0 | Tốt nhất — Bloom's + SRS concept, nhưng thiếu SRS scheduler thực |
| ai-roadmap | 7.0 | Claim "personalized" nhưng zero user data input |
| ai-persistence | 7.5 | Solid edge cases |
| ai-settings | 6.0 | Chỉ functional, không educational |
| course-management | 7.0 | Good edge cases |
| lesson-management | 6.5 | Thiếu delete/reorder/rename lesson |
| upload-transcript | 7.0 | Parse logic clear |
| transcript | 6.0 | Quá simple — chỉ textarea, không search/highlight |

---

## Tier 1 — Core Learning Infrastructure (MỚI HOÀN TOÀN)

Những hệ thống này **không tồn tại** trong codebase hiện tại. Chúng là nền tảng để nâng điểm giáo dục.

### 1.1 Progress Tracking (`docs/specs/progress-tracking.md`) — NEW
**Điểm mục tiêu**: Nâng course-management & lesson-management lên 9.5+

**Lý do cần**: App hiện tại không có concept "lesson completion" hay "course progress". Người học không biết mình đã học đến đâu.

**Scope**:
- Data model: `LessonProgress` table (lessonId, completedAt, timeSpent, quizScore, flashcardMastery)
- Data model: `CourseProgress` table (courseId, completionPercent, streak, lastStudiedAt)
- API: `POST /api/lessons/[id]/progress` — mark complete, record time
- API: `GET /api/courses/[id]/progress` — get course progress summary
- UI: Checkmark trên lesson list, progress bar trên course card, streak counter
- Logic: Auto-mark complete khi đã xem summary + explain + đạt ≥70% quiz

**Prisma changes**:
```prisma
model LessonProgress {
  id          String   @id @default(cuid())
  lessonId    String
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  completed   Boolean  @default(false)
  completedAt DateTime?
  timeSpentMs Int      @default(0)
  quizScore   Float?   // 0.0-1.0
  flashcardsMastered Int @default(0)
  flashcardsTotal    Int @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([lessonId])
}

model CourseProgress {
  id              String   @id @default(cuid())
  courseId         String
  course           Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  completionPct   Float    @default(0)
  currentStreak   Int      @default(0)
  longestStreak   Int      @default(0)
  lastStudiedAt   DateTime?
  totalTimeSpentMs Int     @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([courseId])
}
```

### 1.2 SRS Scheduler (`docs/specs/srs-scheduler.md`) — NEW
**Điểm mục tiêu**: Nâng ai-practice từ 8.0 lên 9.5+

**Lý do cần**: Flashcards tồn tại nhưng không có spaced repetition scheduling. Người học không biết khi nào nên ôn tập lại.

**Scope**:
- Algorithm: SM-2 (SuperMemo 2) — đã proven, đơn giản, phù hợp SQLite
- Data model: `FlashcardReview` table (cardIndex, lessonId, easinessFactor, interval, repetitions, nextReviewAt, lastQuality)
- API: `GET /api/lessons/[id]/srs/due` — lấy các thẻ cần ôn hôm nay
- API: `POST /api/lessons/[id]/srs/review` — ghi nhận kết quả ôn tập
- API: `GET /api/srs/dashboard` — tổng hợp thẻ due across all lessons
- UI: Badge "X thẻ cần ôn" trên lesson list, SRS review mode trong FlashcardDeck
- SM-2 formula:
  ```
  if quality >= 3 (correct):
    if repetitions == 0: interval = 1
    if repetitions == 1: interval = 6
    else: interval = round(interval * easinessFactor)
    repetitions += 1
  else (incorrect):
    repetitions = 0
    interval = 1
  
  easinessFactor = max(1.3, EF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
  nextReviewAt = now + interval days
  ```
- Quality scale: 0-5 (0=complete blackout, 3=correct with difficulty, 5=perfect)
- UI mapping: 3 buttons — "Quên" (quality=1), "Khó" (quality=3), "Dễ" (quality=5)

**Prisma changes**:
```prisma
model FlashcardReview {
  id             String   @id @default(cuid())
  lessonId       String
  lesson         Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  cardIndex      Int      // index trong flashcards JSON array
  easinessFactor Float    @default(2.5)
  interval       Int      @default(0) // days
  repetitions    Int      @default(0)
  nextReviewAt   DateTime @default(now())
  lastQuality    Int      @default(0) // 0-5
  totalReviews   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@unique([lessonId, cardIndex])
}
```

### 1.3 Learning Analytics Dashboard (`docs/specs/learning-analytics.md`) — NEW
**Điểm mục tiêu**: Tạo hệ thống mới, nâng tổng thể educational value

**Lý do cần**: Người học không có cách nào nhìn lại hành trình học tập. Không có data-driven insights.

**Scope**:
- API: `GET /api/analytics/overview` — tổng hợp metrics
- API: `GET /api/analytics/course/[id]` — metrics per course
- Metrics: completion rate, time spent per lesson, quiz score distribution, flashcard retention rate, streak history, study frequency heatmap
- UI: Dashboard page hoặc panel — charts (progress over time, quiz scores, retention curve)
- Không cần library chart nặng — dùng simple HTML/CSS bars hoặc lightweight lib

**Data sources** (không cần thêm table, aggregate từ existing):
- `LessonProgress` → completion rate, time spent
- `FlashcardReview` → retention rate, mastery curve
- `CourseProgress` → streak, overall progress

### 1.4 Pre-Assessment / Knowledge Profile (`docs/specs/pre-assessment.md`) — NEW
**Điểm mục tiêu**: Nâng ai-roadmap từ 7.0 lên 9.5+

**Lý do cần**: Roadmap claims "personalized" nhưng biết ZERO about the learner. Không biết trình độ, mục tiêu, thời gian available.

**Scope**:
- UI: Modal khi lần đầu mở roadmap hoặc course — 3-5 câu hỏi nhanh
- Questions: 
  1. Trình độ hiện tại (Beginner / Intermediate / Advanced)
  2. Mục tiêu học (Career change / Skill upgrade / Hobby / Exam prep)
  3. Thời gian available (30min/day, 1h/day, 2h+/day)
  4. Kiến thức đã biết (checklist of topics from course outline)
  5. Preferred learning style (Theory first / Hands-on first / Mixed)
- Data model: `LearnerProfile` table hoặc JSON field trên Course
- Integration: Profile data → injected into Roadmap prompt → actually personalized output
- Lưu per-course (vì mỗi course có context khác)

**Prisma changes**:
```prisma
model LearnerProfile {
  id              String   @id @default(cuid())
  courseId         String
  course           Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  level           String   // beginner | intermediate | advanced
  goal            String   // career_change | skill_upgrade | hobby | exam_prep
  dailyTimeMin    Int      // minutes per day
  knownTopics     String?  // JSON array of topic strings
  learningStyle   String   // theory_first | hands_on | mixed
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([courseId])
}
```

---

## Tier 2 — Fix Existing Specs (SỬA LỖI GIÁO DỤC)

### 2.1 Fix AI Chat → True Socratic Method (`docs/specs/ai-chat.md`) — UPDATE
**Điểm hiện tại**: 6.5 → **Mục tiêu**: 9.5+

**Vấn đề**: Chat hiện tại chỉ là Q&A routing — phân loại câu hỏi rồi trả lời trực tiếp. Không có Socratic questioning.

**Cần thêm vào spec**:
- **Socratic mode toggle**: User chọn "Trả lời trực tiếp" vs "Dẫn dắt suy nghĩ" (default: trực tiếp cho câu hỏi factual, Socratic cho câu hỏi conceptual)
- **Guided questioning pattern**: Khi ở mode Socratic:
  1. AI phân tích gap in understanding
  2. Hỏi 1 câu dẫn dắt (không cho đáp án)
  3. Dựa trên câu trả lời → hỏi câu tiếp hoặc xác nhận đúng
  4. Sau 3 rounds nếu vẫn stuck → reveal answer + explanation
- **Chat history persistence** (move from Tier 3): Lưu vào DB thay vì chỉ React state
- **Conversation summary**: Khi history > 10 turns → AI tóm tắt conversation so far

**Prompt changes**: Thêm Socratic instruction set vào CHAT_SYSTEM_PROMPT

**Prisma changes**:
```prisma
model ChatMessage {
  id        String   @id @default(cuid())
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  role      String   // user | assistant | system
  content   String
  createdAt DateTime @default(now())
}
```

### 2.2 Fix AI Explain → Adaptive Depth (`docs/specs/ai-explain.md`) — UPDATE
**Điểm hiện tại**: 7.0 → **Mục tiêu**: 9.5+

**Vấn đề**: Explain output cùng một depth cho mọi người, không biết trình độ learner.

**Cần thêm vào spec**:
- **Depth selector**: 3 levels — "Giải thích đơn giản" / "Giải thích chuẩn" (default) / "Giải thích chuyên sâu"
  - Đơn giản: ELI5 style, nhiều analogy, ít jargon
  - Chuẩn: Format hiện tại
  - Chuyên sâu: Thêm edge cases, performance implications, internals
- **Integration with LearnerProfile**: Nếu có profile → auto-select depth level
- **API change**: Thêm `depth` param: `"simple" | "standard" | "deep"`
- **Prompt change**: Inject depth instruction vào system prompt dynamically

### 2.3 Fix AI Summary → Resolve Word Count (`docs/specs/ai-summary.md`) — UPDATE
**Điểm hiện tại**: 7.5 → **Mục tiêu**: 9.5+

**Vấn đề**: PRD says 600-2500 words, prompt says 600-2500, but educational research docs say 300-500. Contradiction.

**Resolution**: Giữ 600-2500 vì spec đã implement theo đó và nó phù hợp với mục tiêu "hiểu bài mà không cần xem lại video". Cập nhật spec để:
- Clarify: word count là MINIMUM, không phải target — dài hơn nếu content phong phú
- Thêm **summary mode selector**: "Tóm tắt nhanh" (300-500 words, bullet points) vs "Tóm tắt chi tiết" (600-2500+, default, full format)
- Thêm **key takeaways section**: Top 3 điểm quan trọng nhất ở đầu summary — cho người muốn skim

### 2.4 Fix AI Roadmap → Actually Personalized (`docs/specs/ai-roadmap.md`) — UPDATE
**Điểm hiện tại**: 7.0 → **Mục tiêu**: 9.5+

**Vấn đề**: Roadmap chỉ phân tích course content, không biết gì về người học.

**Cần thêm vào spec**:
- **Integrate LearnerProfile** (from 1.4): Inject profile data vào roadmap prompt
  - Level → adjust difficulty progression
  - Goal → adjust emphasis (career: focus practical skills; hobby: focus exploration)
  - Daily time → adjust timeline realism
  - Known topics → skip/condense known material
  - Learning style → adjust theory vs practice ratio
- **Progress-aware**: Nếu có LessonProgress data → roadmap shows what's done vs remaining
- **Re-generate option**: Khi profile changes → prompt user to regenerate roadmap

### 2.5 Fix Lesson Management → Full CRUD (`docs/specs/lesson-management.md`) — UPDATE
**Điểm hiện tại**: 6.5 → **Mục tiêu**: 9.5+

**Vấn đề**: Chỉ có create (via upload/import) và read. Không thể delete, rename, reorder individual lessons.

**Cần thêm vào spec**:
- **DELETE lesson**: `DELETE /api/lessons/[id]` — cascade delete AI results + progress
- **RENAME lesson**: `PATCH /api/lessons/[id]` — update title
- **REORDER lessons**: `PUT /api/courses/[id]/lessons/reorder` — accept `[{id, order}]` array
- **UI**: Drag-to-reorder trong lesson list, context menu (rename, delete), confirmation dialog

### 2.6 Fix Transcript View → Interactive (`docs/specs/transcript.md`) — UPDATE
**Điểm hiện tại**: 6.0 → **Mục tiêu**: 9.5+

**Vấn đề**: Transcript là textarea thô. Không search, không highlight, không link.

**Cần thêm vào spec**:
- **Search**: Ctrl+F style search within transcript
- **Highlight**: Select text → "Giải thích đoạn này" hoặc "Hỏi về đoạn này" → sends selected text to Explain/Chat tab
- **Word count display**: Show word count of transcript
- **Copy button**: Copy toàn bộ hoặc selected text
- **Read-only mode vs Edit mode**: Toggle giữa xem và sửa

---

## Tier 3 — Enhancements (NÂNG CẤP UX)

### 3.1 Export System (`docs/specs/export.md`) — NEW
**Scope**:
- Export summary/explain/quiz/flashcards to Markdown file
- Export flashcards to Anki-compatible CSV
- Export entire course notes to single PDF-friendly Markdown

### 3.2 Lesson Notes (`docs/specs/lesson-notes.md`) — NEW
**Scope**:
- Personal notes per lesson (separate from transcript)
- Rich text or Markdown editor
- Data model: `notes` field on Lesson or separate `LessonNote` table

---

## Implementation Order

Phụ thuộc (dependencies) quyết định thứ tự:

```
Phase 1: Data Foundation
  1.1 Progress Tracking (schema + API) — no deps
  1.2 SRS Scheduler (schema + API) — depends on flashcards existing ✓
  1.4 Pre-Assessment (schema + API) — no deps

Phase 2: Spec Fixes (can parallel)
  2.5 Lesson Management CRUD — no deps
  2.6 Transcript View — no deps
  2.3 Summary mode selector — no deps
  2.2 Explain adaptive depth — benefits from 1.4 LearnerProfile
  2.1 Chat Socratic + persistence — no deps
  2.4 Roadmap personalization — depends on 1.4 LearnerProfile

Phase 3: Analytics & Visualization
  1.3 Learning Analytics Dashboard — depends on 1.1 + 1.2

Phase 4: Enhancements
  3.1 Export — depends on AI results existing ✓
  3.2 Lesson Notes — no deps
```

## Estimated Effort

| Item | New Code | Tests | Total |
|------|----------|-------|-------|
| 1.1 Progress Tracking | Medium | Medium | ~4h |
| 1.2 SRS Scheduler | Medium | High | ~5h |
| 1.3 Learning Analytics | Medium | Medium | ~4h |
| 1.4 Pre-Assessment | Low | Low | ~2h |
| 2.1 Chat Socratic | High | Medium | ~4h |
| 2.2 Explain Depth | Low | Low | ~2h |
| 2.3 Summary Mode | Low | Low | ~1h |
| 2.4 Roadmap Personal | Low | Low | ~2h |
| 2.5 Lesson CRUD | Medium | Medium | ~3h |
| 2.6 Transcript View | Medium | Low | ~3h |
| 3.1 Export | Medium | Medium | ~3h |
| 3.2 Lesson Notes | Low | Low | ~2h |
| **TOTAL** | | | **~35h** |

## Workflow per item
1. Write/update spec in `docs/specs/` (follow format from `01-spec.md`)
2. Write tests (follow patterns from `02-test.md`)
3. Implement (follow `03-implement.md`)
4. Verify tests pass
5. Run `npm run build` + `npm run lint`
