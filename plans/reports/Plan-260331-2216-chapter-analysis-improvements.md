# Plan: Chapter Analysis Improvements

> **Scope**: Confidence scoring, new heuristics, AI fallback, re-split recovery
> **Date**: 2026-03-31
> **Status**: Draft
> **Ticket**: B-20 (detection improvements), B-21 (re-split recovery)

---

## Current State Summary

| Aspect | Status |
|--------|--------|
| `split-chapters.ts` | 325 LOC, 5 pattern families, no confidence scoring |
| `split-chapters.test.ts` | 484 LOC, 31 tests |
| `split.test.ts` (API) | 411 LOC |
| `splitConfig.useAI` | Accepted in schema, **never implemented** |
| Re-split | 409 block in confirm route, no bulk delete, no UI |
| `LessonList.tsx` | 289 LOC, used in `page.tsx:654`, has delete per-lesson |
| AI client | `src/lib/ai/client.ts` — `createAIClient(apiKey, baseUrl)` |
| Prisma cascade | Lesson → LessonProgress, FlashcardReview, ChatMessage (all CASCADE) |
| shadcn/ui available | alert-dialog, button, dialog, badge, input, separator, etc. |
| Split preview page | **None** — split flow is API-only, UI is in `page.tsx` |

---

## Phase 1: Confidence Scoring & New Heuristics

**Goal**: Each detected chapter boundary gets a confidence score (0–1). Add "Bài X", Roman numeral, and dash-separator patterns.

### 1.1 Refactor: Extract pattern matchers → `src/lib/split-patterns.ts` (NEW)

**Rationale**: `split-chapters.ts` is 325 LOC. Adding confidence + 3 new patterns would push it past 400+. Extract pattern logic into a separate module.

```
src/lib/split-patterns.ts (~120 LOC)
├── PatternMatch interface { lineIndex, lastLineIndex, title, hasSubtitle, confidence, patternType }
├── KEYWORD_HEADING pattern  (confidence: 0.95)
├── BAI_LESSON pattern       (confidence: 0.90) — NEW: "Bài 1", "Lesson 1"
├── ROMAN_NUMERAL pattern    (confidence: 0.80) — NEW: "I.", "II.", "III."
├── NUMBERED_HEADING pattern (confidence: 0.75)
├── MARKDOWN_H1 pattern      (confidence: 0.90)
├── ALL_CAPS pattern         (confidence: 0.60)
├── DASH_SEPARATOR pattern   (confidence: 0.40) — NEW: "---", "===", "***"
├── isSubtitleLine()         (moved from split-chapters.ts)
├── isAllCapsHeading()       (moved from split-chapters.ts)
└── Export: matchPatterns(lines: string[]) → PatternMatch[]
```

**Pattern details:**

| Pattern | Regex | Confidence | Notes |
|---------|-------|------------|-------|
| Keyword | `/^(chapter\|chương\|phần\|part)\s+\d+/i` | 0.95 | Existing, highest priority |
| Bài/Lesson | `/^(bài\|lesson)\s+\d+/i` | 0.90 | **NEW** — Vietnamese educational |
| Markdown H1 | `/^# (.+)$/` | 0.90 | Existing |
| Roman numeral | `/^(I{1,3}\|IV\|VI{0,3}\|IX\|X{0,3})[.)]\s+\S/i` | 0.80 | **NEW** — I. through XIII. |
| Numbered heading | `/^\d+(?:\.\d+)*[.)]\s+\S/` | 0.75 | Existing |
| ALL CAPS | `isAllCapsHeading()` | 0.60 | Existing |
| Dash separator | `/^[-=*]{3,}\s*$/` | 0.40 | **NEW** — section breaks |

**Family selection change**: Keep existing "first family ≥ 2 headings" logic but now each heading carries its confidence. Average confidence is returned for the whole detection.

### 1.2 Update: `src/lib/split-chapters.ts` → slim orchestrator (~180 LOC)

**Changes:**
- Import `matchPatterns` from `split-patterns.ts`
- Update `DetectedChapter` interface:
  ```ts
  export interface DetectedChapter {
    title: string;
    content: string;
    chapterNumber: number;
    wordCount: number;
    short: boolean;
    confidence: number;      // NEW: 0-1 per chapter
    patternType: string;     // NEW: which pattern matched
  }
  ```
- Update `detectChapters()` return type — add `DetectionResult`:
  ```ts
  export interface DetectionResult {
    chapters: DetectedChapter[];
    avgConfidence: number;      // NEW: average across all chapters
    method: 'heuristic' | 'fallback';
    patternFamily: string;      // NEW: which family won
  }
  ```
- **Breaking change**: `detectChapters()` returns `DetectionResult` instead of `DetectedChapter[]`
- Move `applyKeywordGuards`, subtitle join logic to use new `PatternMatch` from patterns module
- Keep guards (monotonic, minimum content) — they apply post-match

### 1.3 Update: `src/app/api/books/split/route.ts`

**Changes:**
- Adapt to `DetectionResult` return type
- Pass `confidence` and `patternType` per chapter in response
- Add `avgConfidence` to response JSON
- Generate smarter warnings:
  ```
  avgConfidence < 0.5 → "Độ tin cậy thấp (X%). Cân nhắc dùng AI phân tích."
  Any chapter confidence < 0.3 → "Chương 'X' có độ tin cậy thấp (Y%)"
  Mixed pattern types → "Phát hiện nhiều kiểu heading khác nhau, kết quả có thể không chính xác"
  ```
- Updated response shape:
  ```json
  {
    "method": "heuristic",
    "avgConfidence": 0.85,
    "patternFamily": "keyword",
    "chapters": [
      {
        "index": 1,
        "title": "Chương 1...",
        "wordCount": 1500,
        "content": "...",
        "confidence": 0.95,
        "patternType": "keyword"
      }
    ],
    "warnings": ["..."]
  }
  ```

### 1.4 Tests for Phase 1

**File**: `src/lib/__tests__/split-patterns.test.ts` (NEW, ~150 LOC)
- Test each new pattern independently (Bài X, Roman numeral, dash separator)
- Test confidence values are correct
- Test pattern priority ordering

**File**: `src/lib/__tests__/split-chapters.test.ts` (UPDATE)
- Update existing 31 tests to use `DetectionResult` shape (`.chapters` accessor)
- Add tests for `avgConfidence` calculation
- Add tests for mixed-pattern detection
- Add tests for new warning messages

**File**: `src/app/api/books/__tests__/split.test.ts` (UPDATE)
- Update API response assertions to include `confidence`, `avgConfidence`

---

## Phase 2: AI-Assisted Fallback

**Goal**: When `splitConfig.useAI === true` AND avgConfidence < 0.5, use OpenAI to analyze text structure.

### 2.1 Create: `src/lib/split-ai.ts` (NEW, ~120 LOC)

```ts
export interface AISplitResult {
  chapters: { title: string; startLine: number; endLine: number }[];
  model: string;
}

export async function detectChaptersWithAI(
  text: string,
  apiKey: string,
  baseUrl: string,
  model?: string
): Promise<AISplitResult>
```

**Implementation:**
- Use `createAIClient(apiKey, baseUrl)` from `src/lib/ai/client.ts`
- System prompt: structured output requesting chapter boundaries as JSON
- Send first ~3000 words of text (cost control) + line numbers
- Parse structured JSON response
- Model: use configured model from settings (same as other AI features)
- Timeout: 30s
- Error handling: return empty result on failure, let caller fall back to heuristic

**Prompt strategy:**
```
You are analyzing a book/document structure. Given the text with line numbers,
identify chapter/section boundaries. Return JSON:
{ "chapters": [{ "title": "...", "startLine": N, "endLine": M }] }
Only identify clear structural divisions. If unsure, return fewer chapters.
```

### 2.2 Update: `src/app/api/books/split/route.ts`

**Changes:**
- When `splitConfig.useAI === true`:
  1. Run heuristic detection first (always)
  2. If `avgConfidence < 0.5` OR `method === 'fallback'`:
     - Call `detectChaptersWithAI()`
     - Map AI result back to `DetectedChapter[]` with `confidence: 0.85`, `patternType: 'ai'`
     - Set `method: 'ai'`
  3. If AI fails, keep heuristic result
- Add AI-specific warnings:
  ```
  "Đang dùng AI để phân tích cấu trúc chương..."
  AI fail: "AI không thể phân tích, dùng kết quả heuristic"
  ```

### 2.3 Settings integration

**No new settings needed** — the app already has AI API key + base URL in settings (used by chat, quiz, summary, etc.). The `useAI` flag in `splitConfig` is the opt-in toggle.

### 2.4 Tests for Phase 2

**File**: `src/lib/__tests__/split-ai.test.ts` (NEW, ~100 LOC)
- Mock OpenAI SDK
- Test valid structured response parsing
- Test malformed AI response → graceful fallback
- Test timeout handling
- Test prompt construction

**File**: `src/app/api/books/__tests__/split.test.ts` (UPDATE)
- Add tests for `useAI: true` with low-confidence heuristic → AI called
- Add tests for `useAI: true` with high-confidence heuristic → AI NOT called
- Add tests for AI failure → heuristic fallback

---

## Phase 3: Re-Split Recovery

**Goal**: Allow users to delete all lessons and re-run chapter splitting for a book.

### 3.1 Create: `src/app/api/courses/[id]/lessons/bulk/route.ts` (NEW, ~60 LOC)

```ts
// DELETE /api/courses/[id]/lessons/bulk
// Deletes ALL lessons for a course (cascade: progress, flashcards, chat)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Verify course exists
  // 2. Count existing lessons (return 404 if 0)
  // 3. prisma.lesson.deleteMany({ where: { courseId: id } })
  //    → Prisma CASCADE handles LessonProgress, FlashcardReview, ChatMessage
  // 4. Return { success: true, deletedCount: N }
}
```

**Why `deleteMany`**: Prisma's `deleteMany` with CASCADE relations handles all child records atomically. No need for manual transaction.

### 3.2 Update: `src/components/LessonList.tsx`

**Changes** (add ~30 LOC):
- Add new prop: `onResplit?: () => void`
- Add "Chia lại chương" button in the header area (next to search/add)
- Only show when `lessons.length > 0`
- Button uses `AlertDialog` (already imported) for confirmation:
  ```
  Title: "Chia lại chương?"
  Description: "Tất cả bài học hiện tại sẽ bị xóa, bao gồm:
  • Lịch sử chat AI
  • Flashcard và tiến độ ôn tập
  • Quiz và điểm số
  • Ghi chú cá nhân

  Hành động này không thể hoàn tác."

  Cancel: "Hủy"
  Confirm: "Xóa và chia lại" (red button)
  ```

**Updated interface:**
```ts
interface LessonListProps {
  lessons: Lesson[];
  selectedLessonId: string | null;
  onSelect: (lesson: Lesson) => void;
  onAddLesson: (title: string) => void;
  onDelete?: (lessonId: string) => void;
  onReorder?: (lessonIds: string[]) => void;
  progressMap?: Record<string, { completed: boolean }>;
  onToggleComplete?: (lessonId: string, completed: boolean) => void;
  onResplit?: () => void;  // NEW
}
```

### 3.3 Update: `src/app/page.tsx`

**Changes** (add ~25 LOC):
- Add `handleResplit` function:
  ```ts
  const handleResplit = async () => {
    if (!selectedCourse) return;
    try {
      // 1. Bulk delete all lessons
      await fetch(\`/api/courses/\${selectedCourse.id}/lessons/bulk\`, {
        method: 'DELETE',
      });
      // 2. Update local state — clear lessons
      setSelectedCourse({ ...selectedCourse, lessons: [] });
      setSelectedLesson(null);
      // 3. Trigger book upload/split flow (open split dialog/panel)
    } catch (error) {
      console.error('Resplit error:', error);
    }
  };
  ```
- Pass `onResplit={handleResplit}` to `<LessonList>`
- Only pass `onResplit` when `selectedCourse.contentType === 'book'`

### 3.4 Update: `src/app/api/books/split/confirm/route.ts`

**No changes needed** — after bulk delete, the 409 check (`existingCount > 0`) will pass since lessons are already deleted. The flow is:
1. User clicks "Chia lại chương"
2. Confirm dialog → bulk DELETE
3. Redirect to split preview (re-upload/re-parse)
4. User confirms → POST /split/confirm succeeds (no 409)

### 3.5 Tests for Phase 3

**File**: `src/app/api/courses/__tests__/bulk-delete.test.ts` (NEW, ~80 LOC)
- Test successful bulk delete with cascade
- Test 404 when course doesn't exist
- Test response when no lessons exist
- Test that related data (progress, flashcards, chat) is deleted

---

## File Change Summary

| File | Action | Phase | Est. LOC |
|------|--------|-------|----------|
| `src/lib/split-patterns.ts` | **CREATE** | 1 | ~120 |
| `src/lib/split-chapters.ts` | **MODIFY** (slim down) | 1 | 325→~180 |
| `src/app/api/books/split/route.ts` | **MODIFY** | 1+2 | ~+30 |
| `src/lib/split-ai.ts` | **CREATE** | 2 | ~120 |
| `src/app/api/courses/[id]/lessons/bulk/route.ts` | **CREATE** | 3 | ~60 |
| `src/components/LessonList.tsx` | **MODIFY** | 3 | 289→~320 |
| `src/app/page.tsx` | **MODIFY** | 3 | ~+25 |
| `src/lib/__tests__/split-patterns.test.ts` | **CREATE** | 1 | ~150 |
| `src/lib/__tests__/split-chapters.test.ts` | **MODIFY** | 1 | ~+50 |
| `src/app/api/books/__tests__/split.test.ts` | **MODIFY** | 1+2 | ~+60 |
| `src/lib/__tests__/split-ai.test.ts` | **CREATE** | 2 | ~100 |
| `src/app/api/courses/__tests__/bulk-delete.test.ts` | **CREATE** | 3 | ~80 |

**Total new files**: 5
**Total modified files**: 5
**Estimated new LOC**: ~795

---

## Implementation Order

```
Phase 1 (Detection) ─────────────────────────────────────
  1.1  Create split-patterns.ts (extract + new patterns)
  1.2  Refactor split-chapters.ts → use split-patterns
  1.3  Update split route (confidence in response)
  1.4  Write/update tests → run vitest

Phase 2 (AI Fallback) ───────────────────────────────────
  2.1  Create split-ai.ts
  2.2  Wire into split route (useAI flow)
  2.3  Write tests with mocked OpenAI

Phase 3 (Re-Split) ──────────────────────────────────────
  3.1  Create bulk delete API
  3.2  Add re-split button to LessonList
  3.3  Wire handleResplit in page.tsx
  3.4  Write bulk delete tests
```

Phases are independent — Phase 3 can be done in parallel with Phase 1/2.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking `detectChapters()` return type | **HIGH** | Update all 31 existing tests first; use `result.chapters` accessor pattern; run full test suite after each change |
| Roman numeral false positives ("I." as list item vs chapter) | **MEDIUM** | Require punctuation after numeral (`I.` or `I)`) + following non-empty text; only activate as family if ≥ 2 matches |
| AI fallback cost/latency | **LOW** | Only triggered when `useAI: true` AND avgConfidence < 0.5; send only first ~3000 words; 30s timeout |
| Dash separator over-detection | **MEDIUM** | Low confidence (0.40); only used as fallback when no other family reaches ≥ 2; require exactly `---`/`===`/`***` (3+ chars, nothing else on line) |
| Bulk delete data loss | **HIGH** | Confirmation dialog with explicit list of what gets deleted; red destructive button; no "undo" — make this very clear in dialog text |
| `split-chapters.ts` refactor breaks imports | **LOW** | Only `split/route.ts` imports `detectChapters`; single consumer; easy to verify |
| `LessonList.tsx` approaching 320 LOC | **LOW** | Still under limit; `SortableLessonItem` sub-component could be extracted later if needed |

---

## Verification Steps

### After Phase 1
- [ ] `npx vitest run src/lib/__tests__/split-patterns.test.ts` — all new pattern tests pass
- [ ] `npx vitest run src/lib/__tests__/split-chapters.test.ts` — all 31+ tests pass (adapted to new return type)
- [ ] `npx vitest run src/app/api/books/__tests__/split.test.ts` — API tests pass with confidence fields
- [ ] Manual: upload Vietnamese PDF with "Bài 1", "Bài 2" headings → chapters detected
- [ ] Manual: upload text with Roman numeral headings → chapters detected
- [ ] Verify response JSON includes `confidence` per chapter and `avgConfidence`

### After Phase 2
- [ ] `npx vitest run src/lib/__tests__/split-ai.test.ts` — AI mock tests pass
- [ ] Manual: upload unstructured text → low avgConfidence → toggle useAI → AI chapters returned
- [ ] Manual: AI API down/timeout → graceful fallback to heuristic result
- [ ] Verify AI is NOT called when heuristic confidence > 0.5

### After Phase 3
- [ ] `npx vitest run src/app/api/courses/__tests__/bulk-delete.test.ts` — bulk delete tests pass
- [ ] Manual: book with lessons → click "Chia lại chương" → confirm → lessons deleted
- [ ] Manual: verify cascade — progress, flashcards, chat messages all deleted
- [ ] Manual: after bulk delete → re-split flow works → confirm creates new lessons (no 409)
- [ ] Manual: cancel dialog → no deletion occurs

### Full regression
- [ ] `npx vitest run` — entire test suite green
- [ ] No TypeScript errors: `npx tsc --noEmit`

---

## Unresolved Questions

1. **Split preview UI**: There is no dedicated split preview page (flow is API-only). Where does the re-split redirect to after bulk delete? Options:
   - (a) Re-open the book upload dialog with the existing book content pre-loaded
   - (b) Create a new `/books/[id]/split` page for re-split preview
   - (c) Trigger the split API directly with stored content (if transcript is saved)
   → **Recommendation**: Option (c) if transcript is stored in Lesson records; Option (a) if not.

2. **Content preservation**: After split+confirm, is the original full-text content stored anywhere (Course record? separate field?)? If not, re-split requires re-uploading the file. This affects the re-split UX significantly.

3. **AI model selection**: Should the AI fallback use a specific model (e.g., `gpt-4o-mini` for cost) or the user's configured model? The user might have a local/proxy model that does not support structured output well.
   → **Recommendation**: Default to `gpt-4o-mini` with override via settings.

4. **LessonList file naming**: Current file is `LessonList.tsx` (PascalCase) but constraint says kebab-case. Should we rename to `lesson-list.tsx` during this work?
   → **Recommendation**: Out of scope — rename in a separate PR to avoid noise.
