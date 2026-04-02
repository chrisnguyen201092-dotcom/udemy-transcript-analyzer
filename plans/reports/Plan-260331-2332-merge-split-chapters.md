# Plan: Merge + Split Chapter Functionality

**Date**: 2026-03-31 | **Status**: Draft  
**Scope**: API endpoints, page.tsx handlers, LessonList UI, tests

---

## Context

Users cannot fix incorrectly split chapters without deleting content or re-splitting from scratch. This adds **Merge** (combine 2 adjacent chapters) and **Split** (divide 1 chapter at a cursor point).

### Key Decisions
- **Merge**: keeps first lesson's related data; second cascade-deleted
- **Split**: original keeps related data (top half); new lesson for bottom half
- Both only for `contentType === "book"` | Vietnamese UI strings
- AI fields (summary, explanation, quiz, flashcards, exercises) cleared on both ops (stale after content change)

---

## Phase 1 — API Endpoints

### 1A. Merge: `POST /api/courses/[id]/lessons/merge`

**File**: `src/app/api/courses/[id]/lessons/merge/route.ts`

```
Zod schema: { lessonId1: string, lessonId2: string }

Validation:
- Both lessons exist, belong to courseId
- lesson2.order === lesson1.order + 1 (adjacent)

$transaction:
1. Fetch both lessons
2. Update lesson1: transcript = (t1 ?? "") + "\n\n" + (t2 ?? ""), trim
   Clear: summary, explanation, quiz, flashcards, exercises → null
3. Delete lesson2 (cascade: progress, flashcards, chat)
4. Reorder remaining: findMany({courseId}) → update order = index+1

Response: { merged: Lesson, lessons: Lesson[] }
```

Pattern: follows reorder route (`$transaction` + Zod + NextRequest/NextResponse).

### 1B. Split: `POST /api/courses/[id]/lessons/split`

**File**: `src/app/api/courses/[id]/lessons/split/route.ts`

```
Zod schema: { lessonId: string, splitIndex: z.number().int().positive(), newTitle: z.string().min(1).max(200) }

Validation:
- Lesson exists, belongs to courseId
- Has non-null non-empty transcript
- 0 < splitIndex < transcript.length

$transaction:
1. topContent = transcript.slice(0, splitIndex).trimEnd()
2. bottomContent = transcript.slice(splitIndex).trimStart()
3. Both halves must be non-empty
4. Update original: transcript=topContent, clear AI fields
5. Create new lesson: title=newTitle, transcript=bottomContent, order=original.order+1
6. Bump order+1 for all lessons after the split point

Response: { original: Lesson, created: Lesson, lessons: Lesson[] }
```

---

## Phase 2 — Frontend Handlers (`src/app/page.tsx`)

### 2A. `handleMergeLessons(lessonId1, lessonId2)`

```
Pattern: matches handleDeleteLesson (no optimistic update, behind AlertDialog)
1. POST /api/courses/{id}/lessons/merge
2. On success: setSelectedCourse with returned lessons[]
3. If selectedLesson was either lesson → switch to merged lesson
4. toast.success("Đã gộp 2 chương thành công")
5. On error: toast.error(message)
```

### 2B. `handleSplitLesson(lessonId, splitIndex, newTitle)`

```
Pattern: same as merge handler
1. POST /api/courses/{id}/lessons/split
2. On success: setSelectedCourse with returned lessons[]
3. If selectedLesson was split → refresh to original (top half)
4. toast.success("Đã tách chương thành công")
5. On error: toast.error(message)
```

### 2C. Wire to LessonList

```tsx
<LessonList
  // ...existing props
  onMerge={handleMergeLessons}
  onSplit={handleSplitLesson}
/>
```

---

## Phase 3 — UI (`src/components/LessonList.tsx`)

### 3A. New Props

```typescript
interface LessonListProps {
  // ...existing
  onMerge?: (lessonId1: string, lessonId2: string) => Promise<void>;
  onSplit?: (lessonId: string, splitIndex: number, newTitle: string) => Promise<void>;
}
```

### 3B. Merge — "Gộp xuống" Button per Lesson

**Location**: `SortableLessonItem`, beside delete button  
**Visible when**: `contentType === "book"` + `onMerge` provided + not last lesson + has transcript

UX:
1. Hover → `ChevronsDown` icon button ("Gộp xuống")
2. Click → AlertDialog:
   - Title: "Gộp chương"
   - Desc: `Gộp "{title1}" với "{title2}"? Nội dung sẽ được nối. Dữ liệu học tập của chương 2 sẽ bị xóa.`
   - Action: "Gộp" (amber btn) | Cancel: "Hủy"
3. Confirm → `onMerge(lesson.id, nextLesson.id)` + loading spinner

**Data flow**: Pass `nextLesson` to each `SortableLessonItem`:
```tsx
{sortedLessons.map((lesson, i) => (
  <SortableLessonItem
    nextLesson={sortedLessons[i + 1]}
    onMerge={onMerge}
    onSplit={onSplit}
    contentType={contentType}
    ...
  />
))}
```

### 3C. Split — "Tách chương" Button + SplitChapterDialog

**Location**: `SortableLessonItem`, beside merge button  
**Visible when**: `contentType === "book"` + `onSplit` provided + has transcript

UX:
1. Hover → `Scissors` icon button ("Tách chương")
2. Click → Opens `SplitChapterDialog` (inline component in LessonList.tsx)

**SplitChapterDialog** (uses shadcn `Dialog`, not AlertDialog — it's a form):
```typescript
Props: { lesson, open, onOpenChange, onConfirm: (splitIndex, newTitle) => Promise<void> }
State: splitIndex (null), newTitle (default: "{title} (phần 2)"), loading

Body:
- <textarea readOnly> showing full transcript
- Click sets cursor → splitIndex = selectionStart
- Visual: top half vs bottom half word count preview
- Input: new chapter title

Footer: "Hủy" | "Tách" (disabled until splitIndex set + title non-empty)
```

**Character-level split via textarea cursor**: user clicks in the readonly textarea, `onClick` captures `e.target.selectionStart` as splitIndex. Simple, precise, no custom editor needed. Show a preview of the two halves below.

---

## Phase 4 — Tests

### 4A. Merge Tests: `src/app/api/courses/__tests__/merge.test.ts`

Pattern: matches `reorder.test.ts` (vi.hoisted mockPrisma, vi.mock, NextRequest helper)

| # | Test Case |
|---|-----------|
| 1 | Merges adjacent lessons — transcripts concatenated, second deleted, orders renumbered |
| 2 | Returns 400 if not adjacent (order gap) |
| 3 | Returns 400 if different courses |
| 4 | Returns 404 if either lesson not found |
| 5 | Returns 400 for invalid Zod body |
| 6 | Clears AI fields on merged lesson |
| 7 | Handles null transcripts (null + "text" → "text") |

### 4B. Split Tests: `src/app/api/courses/__tests__/split.test.ts`

| # | Test Case |
|---|-----------|
| 1 | Splits at valid index — original updated, new created, orders correct |
| 2 | Returns 400 if splitIndex ≤ 0 or ≥ length |
| 3 | Returns 400 if no transcript |
| 4 | Returns 404 if lesson not found |
| 5 | Returns 400 for invalid Zod body |
| 6 | New lesson has null AI fields |
| 7 | Original AI fields cleared |
| 8 | Subsequent lesson orders incremented |

---

## File Manifest

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/courses/[id]/lessons/merge/route.ts` | **Create** | Merge API |
| `src/app/api/courses/[id]/lessons/split/route.ts` | **Create** | Split API |
| `src/app/api/courses/__tests__/merge.test.ts` | **Create** | Merge tests (7 cases) |
| `src/app/api/courses/__tests__/split.test.ts` | **Create** | Split tests (8 cases) |
| `src/app/page.tsx` | **Edit** | +handleMergeLessons, +handleSplitLesson, wire props |
| `src/components/LessonList.tsx` | **Edit** | +merge/split buttons, +SplitChapterDialog, +props |

**Total**: 4 new files, 2 edited files

---

## Unresolved Questions

1. **Split UX precision**: Character-level (textarea cursor) vs paragraph-level? → **Recommend textarea cursor** — precise, simple, KISS.
2. **Merge separator**: Plain `\n\n` vs visual marker `--- merged ---`? → **Recommend `\n\n`** — KISS, user can edit transcript after.
3. **Null transcript merge**: `(t1 ?? "") + "\n\n" + (t2 ?? "")` then `.trim()` handles all null combos.
