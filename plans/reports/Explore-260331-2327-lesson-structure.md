# Lesson Structure & Chapter Merge/Split Feature — Codebase Exploration Report

**Date:** 2026-03-31 | **Scope:** Lesson data model, rendering, CRUD API, state management, split-chapters logic

---

## 1. LESSON DATA MODEL (Prisma Schema)

**File:** `prisma/schema.prisma` (lines 27–47)

### Lesson Model Fields
- **id**: String (cuid, primary key)
- **courseId**: String (foreign key)
- **title**: String (required, lesson name)
- **order**: Int (sequence 1, 2, 3...)
- **chapterNumber**: Int? (optional)
- **pageRange**: String? (for books)
- **transcript**: String? (lesson content)
- **summary**: String? (AI-generated)
- **explanation**: String? (educational text)
- **quiz**: String? (quiz content)
- **flashcards**: String? (flashcard data)
- **exercises**: String? (homework)
- **notes**: String? (student notes)
- **createdAt, updatedAt**: DateTime
- **progress**: LessonProgress? (completion tracking)
- **flashcardReviews**: FlashcardReview[] (SRS history)
- **chatMessages**: ChatMessage[] (discussion history)

### Course Model (relevant fields)
- **id**: String (cuid)
- **title**: String
- **contentType**: String ("course" or "book")
- **rawContent**: String? (original pre-split source, immutable)
- **lessons**: Lesson[] (1:N relationship)

### Key Observations for Merge/Split
- **order field:** Integer, used for sequencing. Reorder updates this incrementally.
- **transcript field:** String, contains lesson content. This is what gets split from Course.rawContent.
- **chapterNumber:** Optional; allows tracking source chapter during splits.
- **contentType:** Distinguishes "book" from "course" (relevant for re-split feature).
- **Cascading delete:** Enabled on Course → Lesson relationship.

---

## 2. LESSON LIST COMPONENT (src/components/LessonList.tsx)

**File Path:** `src/components/LessonList.tsx` (340 lines)

### Props Interface
```typescript
interface LessonListProps {
  lessons: Lesson[];
  selectedLessonId: string | null;
  onSelect: (lesson: Lesson) => void;
  onAddLesson: (title: string) => void;
  onDelete?: (lessonId: string) => void;
  onReorder?: (lessonIds: string[]) => void;
  progressMap?: Record<string, { completed: boolean }>;
  onToggleComplete?: (lessonId: string, completed: boolean) => void;
  onReSplit?: () => Promise<void>;
  contentType?: string;
}
```

### UI Actions & Patterns
1. **Drag-and-drop reordering:** @dnd-kit library
   - DndContext + SortableContext + useSortable hook
   - handleDragEnd() calls onReorder(reorderedIds)
   - Disabled when filtering/searching

2. **Per-lesson item actions:**
   - Grip handle (drag trigger)
   - Completion checkbox (green when done)
   - Order badge (shows lesson.order)
   - Title + "Có transcript" / "Chưa có transcript" indicator
   - Delete button (trash, hover-visible, with confirmation)

3. **Lesson add form:** Input + Plus button
   - handleSubmit() validates and calls onAddLesson(title)

4. **Re-split button:** (amber, dangerous action)
   - Shows only if: onReSplit && contentType === "book" && lessons.length > 0
   - Confirmation dialog warns all lessons + progress will be deleted
   - Sets reSplitLoading state

5. **Search/filter:**
   - Normalizes Vietnamese diacritics
   - Real-time filtering

### Patterns
- **Optimistic UI:** Changes reflect immediately; server confirms async
- **State isolation:** LessonList is presentation component; state managed by parent

---

## 3. LESSON CRUD API ENDPOINTS

### POST /api/courses/[id]/lessons (Create)
**File:** `src/app/api/courses/[id]/lessons/route.ts`
- Input: { title: string (1-200), transcript?: string }
- Logic: Finds last lesson, increments order
- Returns: Full Lesson object with order auto-incremented

### PUT /api/lessons/[id] (Update Title)
**File:** `src/app/api/lessons/[id]/route.ts`
- Input: { title: string (1-200) }
- Updates: title field only
- Returns: Updated Lesson

### PUT /api/lessons/[id]/transcript (Update Transcript)
**File:** `src/app/api/lessons/[id]/transcript/route.ts`
- Input: { transcript: string }
- Updates: transcript field only
- Returns: Updated Lesson

### DELETE /api/lessons/[id] (Delete)
**File:** `src/app/api/lessons/[id]/route.ts`
- Cascading delete removes:
  - LessonProgress records
  - FlashcardReview records
  - ChatMessage records

### PATCH /api/courses/[id]/lessons/reorder (Reorder)
**File:** `src/app/api/courses/[id]/lessons/reorder/route.ts`
- Input: { lessonIds: string[] }
- Logic: Uses Prisma $transaction() for atomicity
- Sets: order = index + 1 for each lesson
- Returns: { success: true }

---

## 4. STATE MANAGEMENT (page.tsx)

**File:** `src/app/page.tsx` (1000+ lines)

### Key State Variables
```typescript
const [courses, setCourses] = useState<Course[]>([]);
const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
const [transcriptDirty, setTranscriptDirty] = useState(false);
```

### Lesson Handlers

#### handleAddLesson(title: string) — Lines 235–255
- POST to /api/courses/{courseId}/lessons
- Appends new lesson to selectedCourse.lessons
- Pattern: Optimistic local update

#### handleDeleteLesson(lessonId: string) — Lines 257–274
- DELETE /api/lessons/{lessonId}
- Filters lesson from selectedCourse.lessons
- Clears selectedLesson if deleted

#### handleReorderLessons(lessonIds: string[]) — Lines 296–325
- **Optimistic update:** Locally reorders lessons first (with updated order field)
- PATCH /api/courses/{courseId}/lessons/reorder
- Reverts to previousLessons on error
- Shows success toast

#### handleSelectLesson(lesson: Lesson)
- Sets selectedLesson, loads for editing
- Tracks study time

#### handleReSplit() — Lines 276–295
- DELETE /api/books/split/lessons
- Re-runs detectChapters() on Course.rawContent
- Creates fresh lessons

---

## 5. CHAPTER SPLIT LOGIC (src/lib/split-chapters.ts)

**File:** `src/lib/split-chapters.ts` (244 lines)

### Main Function: detectChapters(text: string) → DetectionResult

**Returns:**
```typescript
interface DetectionResult {
  chapters: DetectedChapter[];
  avgConfidence: number;      // 0-1 average
  method: "heuristic" | "fallback";
  patternFamily: PatternType | "fallback" | "mixed";
}

interface DetectedChapter {
  title: string;              // Heading text
  content: string;            // Chapter body
  chapterNumber: number;      // Sequential (1, 2, 3...)
  wordCount: number;
  short: boolean;             // true if < 200 words
  confidence: number;         // 0-1 score
  patternType: PatternType | "fallback";
}
```

### Pattern Priority (highest → lowest confidence)
1. keyword: "Chapter 1", "Lesson 1", "Part I"
2. lesson: "Lesson 2.3"
3. markdown-h1: "# Heading"
4. roman: "I.", "II.", "III."
5. numbered: "1.", "1.2"
6. all-caps: "ALL CAPS HEADING"
7. dash-separator: "---" or "==="

**Fallback:** If no pattern with ≥2 matches, treat entire text as 1 chapter (confidence=0)

### Guards Applied
- **Monotonic guard:** Discard heading if number ≤ highest seen
- **Minimum content guard:** Discard heading with zero body lines (unless subtitle-merged)

### Pattern Matching (from split-patterns.ts)
- KEYWORD_HEADING_RE, KEYWORD_NUMBER_RE
- LESSON_HEADING_RE, LESSON_NUMBER_RE
- MARKDOWN_H1_RE = /^# (.+)$/
- ROMAN_HEADING_RE (matches I, II, III, IV, etc.)
- NUMBERED_HEADING_RE = /^\d+(?:\.\d+)*[.)]\s+\S/
- isAllCapsHeading() helper
- isSubtitleLine() helper (uppercase + spacing)

---

## ARCHITECTURE FOR MERGE/SPLIT FEATURES

### SPLIT (one lesson → multiple)
**New API:** POST /api/lessons/{id}/split
- **Input:** 
  - lessonId: string
  - splitPoints: Array of positions or keywords
- **Algorithm:** Split lesson.transcript at positions
- **Output:** Array of new Lesson objects
- **Side effects:** Update order for remaining lessons

### MERGE (multiple lessons → one)
**New API:** POST /api/courses/{id}/lessons/merge
- **Input:**
  - lessonIds: string[] (ordered list of IDs to merge)
- **Algorithm:** Concatenate transcripts in order
- **Output:** Single merged Lesson object
- **Side effects:**
  - Delete merged lessons
  - Reorder remaining lessons
  - Handle LessonProgress aggregation
  - Handle flashcards (merge or discard?)

### State Sync Strategy
- Follow existing pattern: **Optimistic update** + **server confirmation**
- LessonList re-renders immediately
- Revert on error
- Toast feedback (success/error)

### UI Integration Points
1. **LessonList:** Add merge/split action buttons
2. **page.tsx:** Add handleMergeLessons, handleSplitLesson handlers
3. **Context menu or editor panel:** Where to trigger?

---

## UNRESOLVED QUESTIONS

1. **Merge UI:** Where should merge controls appear? Context menu on LessonList? Editor panel?
2. **Split UI:** How to define split points? Position picker in editor? Keyword-based sections?
3. **Conflict handling:** What if user edits lesson A, then tries to merge A+B?
4. **Progress handling:** When merging, how to aggregate LessonProgress records?
5. **Flashcard handling:** Merge flashcards from both lessons or discard?
6. **Chat history:** How to handle ChatMessages when merging?
7. **Transcript dirty flag:** How to handle transcriptDirty when splitting/merging?
