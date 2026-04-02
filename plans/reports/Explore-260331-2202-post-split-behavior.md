# Post-Confirmation Chapter Splitting Behavior Analysis

**Date:** 2026-03-31 | **Status:** Complete

---

## Executive Summary

After a user confirms chapter splitting in the Udemy Learner app, the system creates immutable Lesson records. There is **NO** built-in "re-split" or "edit chapters" flow once confirmation is done. Users must manually delete all lessons and start over if they want to re-analyze.

---

## 1. Can Users Edit/Rename/Reorder Chapters After Confirmation?

### ✅ **YES — But Only Individual Lessons**

After `POST /api/books/split/confirm` succeeds, chapters become **Lesson records** in the database. Users can then edit individual lessons:

| Operation | Supported | Details |
|-----------|-----------|---------|
| **Rename** | ✅ YES | `PATCH /api/lessons/[id]` with new `title` |
| **Reorder** | ✅ YES | `PUT /api/courses/[id]/lessons/reorder` (drag-drop) |
| **Delete** | ✅ YES | `DELETE /api/lessons/[id]` (cascades AI data) |
| **Edit inline** | ✅ YES | Double-click title → inline edit mode |

**UI Behavior:**
- Hover over lesson → kebab menu (three-dot icon) appears
- Options: "Đổi tên" (Rename), "Xóa" (Delete)
- Drag handle visible → drag-drop to reorder (when 2+ lessons)
- Double-click title → editable input field

**Spec Reference:** `docs/specs/lesson-management.md`

---

## 2. Can Users Re-Split or Re-Analyze a Book After Chapters Are Created?

### ❌ **NO — 409 Conflict Error**

Once lessons are created, attempting to call `POST /api/books/split/confirm` again returns:

```
HTTP 409 Conflict
{
  "error": "Sách đã có bài học. Xóa bài học hiện tại trước khi chia lại chương."
}
```

**Code Location:** `src/app/api/books/split/confirm.ts`
```typescript
const existingCount = await prisma.lesson.count({
  where: { courseId: parsed.bookId }
});
if (existingCount > 0) {
  return NextResponse.json(
    { error: "Sách đã có bài học. Xóa bài học hiện tại trước khi chia lại chương." },
    { status: 409 }
  );
}
```

**Limitation:** There is **NO dedicated re-split endpoint**. The system prevents accidental overwrites but doesn't provide a smooth recovery path.

---

## 3. Is There a "Delete All Lessons and Re-Split" Flow?

### ✅ **Partial — Manual Workaround Only**

**Current Implementation:**
- ✅ Users can delete individual lessons via `DELETE /api/lessons/[id]`
- ✅ UI shows delete confirmation dialog with cascade warning
- ❌ No bulk delete UI
- ❌ No "re-split from scratch" button
- ❌ Users must manually delete each lesson one-by-one

**Spec Note:** `docs/specs/lesson-management.md` (Spec: UX Overhaul > 6B.3 Lesson Deletion)
```
- Dialog warns: "Toàn bộ dữ liệu AI và tiến độ của bài học này sẽ bị xóa vĩnh viễn."
- Cascade delete: AI results, chat messages, flashcard reviews, exercise data
```

**Gap:** After deleting all lessons, there's no obvious way to re-trigger the book splitting flow. Users would need to know to re-upload the book or find a re-split button (not documented in current specs).

---

## 4. API Routes for Lesson CRUD

### ✅ **All CRUD Operations Supported**

| Method | Endpoint | Function | Response |
|--------|----------|----------|----------|
| `POST` | `/api/courses/[id]/lessons` | Create lesson | 201 with lesson data |
| `GET` | `/api/courses` | List lessons (nested) | 200 with course + lessons |
| `PATCH` | `/api/lessons/[id]` | Update title | 200 with updated title |
| `PUT` | `/api/courses/[id]/lessons/reorder` | Bulk reorder | 200 success |
| `DELETE` | `/api/lessons/[id]` | Delete lesson | 200 with `deletedId` |

**Spec Reference:** `docs/specs/lesson-management.md` (Lesson Management API Contract)

---

## 5. UI Components for Post-Split Editing

### **LessonList Component** (`src/components/LessonList.tsx`)

**Features:**
- Vertical list of lessons (number + title)
- Active lesson highlighted
- Hover → kebab menu (Rename, Delete)
- Drag handle visible for reordering
- Double-click → inline edit mode
- Delete dialog with cascade warning

**Constraints:**
- Drag handle only visible when 2+ lessons exist
- Cannot merge/split lessons via UI (only rename/delete)
- No "re-analyze" or "redo splitting" button

---

## 6. Edge Cases & Limitations

### **Current Behavior (v2.0 Tier 2)**

| Scenario | Current Behavior | Issue |
|----------|------------------|-------|
| User changes mind after confirming split | Must delete all lessons manually | ❌ No bulk delete UI |
| User wants to re-split with different heuristic | 409 error + must delete lessons first | ❌ Cumbersome workflow |
| User accidentally confirms wrong chapters | Can rename/reorder individually | ⚠️ Tedious if many changes needed |
| Empty course after deletion | Shows "Thêm bài học đầu tiên" prompt | ✅ Handles gracefully |
| Multiple lessons with same title | Allowed (distinguished by ID) | ⚠️ May confuse users |

---

## 7. Post-Confirmation User Flow (Documented)

**From PRD Flow 9:**
```
1. POST /api/books/split/confirm → creates Lesson records
2. Modal closes
3. Sidebar updates with new lesson list
4. User can now:
   ✅ Rename individual lessons (PATCH /api/lessons/[id])
   ✅ Reorder lessons (PUT /api/courses/[id]/lessons/reorder)
   ✅ Delete lessons (DELETE /api/lessons/[id])
   ✅ Add more lessons manually (POST /api/courses/[id]/lessons)
   ❌ Re-split the entire book
   ❌ Bulk re-analyze
```

---

## Summary Table

| Question | Answer | Spec File |
|----------|--------|-----------|
| Edit/rename chapters after confirmation? | ✅ Via lesson APIs | `lesson-management.md` |
| Re-split after confirmation? | ❌ 409 error | `book-chapter-splitting.md` |
| Delete all and start over? | ⚠️ Manual delete only | `lesson-management.md` |
| Post-split lesson CRUD? | ✅ Full CRUD | `lesson-management.md` |
| Edit chapters UI component? | ✅ LessonList | `lesson-management.md` (UI Notes) |
| Re-analyze endpoint? | ❌ Not implemented | — |

---

## Recommendations for Enhancement

If users frequently need to re-split:

1. **Add "Bulk Delete Lessons" UI** with cascade confirmation
2. **Add "Re-analyze Book" button** that:
   - Deletes all lessons
   - Triggers `/api/books/split` again
   - Skips the "already has lessons" check
3. **Document the workaround** in help/onboarding
4. **Track re-split requests** to identify if this is a common pain point

---

**Sources:**
- `docs/specs/book-chapter-splitting.md` — B-17 to B-19, API Contract, Edge Cases
- `docs/specs/lesson-management.md` — Lesson CRUD, UI Notes, Deletion flow
- `src/app/api/books/split/confirm.ts` — 409 conflict logic
- `src/app/api/lessons/` — Lesson CRUD endpoints
- PRD Flow 9 — Post-split user journey
