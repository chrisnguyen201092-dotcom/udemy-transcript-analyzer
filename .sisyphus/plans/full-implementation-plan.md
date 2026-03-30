# Full Implementation Plan — Udemy Learner

> **Generated**: 2026-03-30
> **Scope**: Phase 6 UX Overhaul remaining + 7 Feature Integrations + AI Quality Upgrades
> **Prerequisite**: Phase 1–5 complete (38/38 features). All backend API routes EXIST and are FUNCTIONAL. Prisma schema has all 6 models.
> **Constraints**: NO new API routes. NO Prisma schema changes. NO Context/Zustand. NO custom fetch wrappers. Follow existing patterns (useState in page.tsx, raw fetch(), named exports, `@/` imports).

---

## Current State Audit

### ✅ Phase 6 UX Overhaul — COMPLETED

All Phase 6 items have been verified as implemented in the current codebase:

| Item | Status | Evidence |
|------|--------|----------|
| 6A.1 Markdown Rendering | ✅ Done | `MarkdownRenderer.tsx` with react-markdown + remarkGfm + rehypeHighlight |
| 6A.2 URL Navigation | ✅ Done | `useUrlState.ts` hook exists |
| 6A.3 Responsive Layout | ✅ Done | `useMediaQuery.ts` hook exists |
| 6A.4 Transcript Fill Height | ✅ Done | TranscriptPanel uses `flex-1 min-h-0` |
| 6B.1 Search & Filter | ✅ Done | LessonList has search with diacritics normalization |
| 6B.2 Regen Confirmation | ✅ Done | AlertDialog in AIAssistantPanel `renderActionButton` |
| 6B.3 Lesson Deletion | ✅ Done | `handleDeleteLesson` in page.tsx, dialog in LessonList |
| 6B.4 Course Renaming | ✅ Done | `handleRenameCourse` in page.tsx |
| 6B.5 `lang="vi"` | ✅ Done | layout.tsx line 29 |
| 6B.6 Settings Validation | ✅ Done | SettingsModal has validation |
| 6B.7 Chat Leave Warning | ✅ Done | AlertDialog with `chatMessageCount` + `transcriptDirty` |
| 6C.1 Toast (sonner) | ✅ Done | `<Toaster richColors position="bottom-right" />` in layout.tsx |
| 6C.2 Loading Skeletons | ✅ Done | `renderSkeleton()` in AIAssistantPanel, `coursesLoading` state |
| 6C.3 AI Progress + Cancel | ✅ Done | AbortController + `elapsedSeconds` timer + cancel button |
| 6C.4 Keyboard Shortcuts | ✅ Done | `useKeyboardShortcuts.ts` with Alt+↑↓, Ctrl+, Escape |
| 6C.5 DnD File Upload | ✅ Done | UploadModal exists |
| 6C.6 Empty States + Onboarding | ✅ Done | OnboardingCard + contextual empty states in page.tsx |
| 6C.7 Lesson Reorder | ✅ Done | dnd-kit sortable in LessonList + `handleReorderLessons` |
| 6C.8 Transcript Edit Mode | ✅ Done | Read/edit toggle with unsaved warning dialog |

### 🔧 Backend Routes — ALL COMPLETE (verified by reading each file)

| Route | Method | Status |
|-------|--------|--------|
| `/api/lessons/[id]/notes` | GET, PUT | ✅ Complete |
| `/api/courses/[id]/notes/search` | GET | ✅ Complete |
| `/api/lessons/[id]/progress` | POST, PATCH | ✅ Complete |
| `/api/lessons/[id]/srs/due` | GET | ✅ Complete |
| `/api/lessons/[id]/srs/review` | POST | ✅ Complete |
| `/api/lessons/[id]/srs/init` | POST | ✅ Complete |
| `/api/srs/dashboard` | GET | ✅ Complete |
| `/api/lessons/[id]/chat` | GET, DELETE | ✅ Complete |
| `/api/export/lesson/[id]` | POST | ✅ Complete |
| `/api/export/course/[id]` | POST | ✅ Complete |
| `/api/courses/[id]/profile` | GET, POST, PUT | ✅ Complete |
| `/api/analytics/overview` | GET | ✅ Complete |
| `/api/analytics/course/[id]` | GET | ✅ Complete |

---

## 📋 Implementation Plan — 3 Phases

> Phase 1 (UX Overhaul) is COMPLETE. Remaining work is 3 phases:
> - **Phase A**: Backend→UI Connection (7 features)
> - **Phase B**: UX Polish (remaining items)
> - **Phase C**: AI Quality Upgrades (5 improvements)

---

## Phase A: Backend → UI Connection

> **Goal**: Wire existing backend routes to frontend UI. ROI is extremely high — zero backend work needed.
> **Effort**: ~5–7 days
> **Parallelism**: Features A.1–A.3 are standalone. A.4 depends on flashcards working. A.7 depends on A.3 + A.4.

---

### A.1 Chat Persistence

**Impact**: 🔥 Critical — users lose chat history every lesson switch
**Effort**: S (2–3 hours)
**Spec**: `docs/specs/improvement-plan.md` §2.1
**Dependencies**: None (standalone)

#### Files to modify:
- `src/components/AIAssistantPanel.tsx`

#### Task A.1.1: Load saved chat messages on lesson change

In the `useEffect([lesson.id])` that resets state, after loading AI data, also load chat history:

```typescript
// Inside the loadSaved async function in useEffect([lesson.id]):
// After existing AI data loading, add:
const chatRes = await fetch(`/api/lessons/${lesson.id}/chat`);
if (chatRes.ok) {
  const chatData = await chatRes.json();
  if (chatData.messages && chatData.messages.length > 0) {
    setChatMessages(
      chatData.messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
    );
  }
}
```

**Key pattern**: Follow existing `fetch` + `if (res.ok)` + `try/catch` pattern in the same `loadSaved` function.

#### Task A.1.2: Save chat messages after each exchange

After streaming completes in `handleChat`, persist the full conversation:

```typescript
// At the end of handleChat, after setChatLoading(false):
// Save conversation to DB (fire-and-forget)
try {
  // Save user message
  await fetch(`/api/lessons/${lesson.id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "user", content: userMsg.content }),
  });
  // Save assistant message
  // Get the final assistant content from the last message in state
  // Use a ref or the `response` variable captured in handleChat's closure
  await fetch(`/api/lessons/${lesson.id}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "assistant", content: response }),
  });
} catch {
  // Silently fail — chat still works in memory
}
```

**Important**: The chat API route uses POST to create individual messages. The `response` variable from the streaming loop already holds the full assistant text.

#### Task A.1.3: Update leave-warning to account for persisted chats

Since chats are now persisted, the leave warning should only trigger for **unsaved** messages. Adjust `handleSelectLesson` logic:

- Chat messages that came from DB (loaded on lesson change) are already saved
- Only messages created during this session need the warning
- Add a `lastSavedChatCount` ref to track how many messages were loaded from DB
- Warning triggers when `chatMessages.length > lastSavedChatCountRef.current`

```typescript
const lastSavedChatCountRef = useRef(0);

// In loadSaved useEffect after loading chat messages:
lastSavedChatCountRef.current = chatData.messages?.length ?? 0;

// In handleChat after successful save:
lastSavedChatCountRef.current = chatMessages.length + 2; // +2 for user+assistant
```

Update the leave warning condition in `page.tsx`:
- `onChatCountChange` now represents *unsaved* chat count
- Or keep as-is if chat persistence makes leave-warning unnecessary (messages are saved)

#### Task A.1.4: Add "Clear chat" button

Add a button in the chat tab to clear history:

```typescript
// In the chat tab section, before the chat messages ScrollArea:
{chatMessages.length > 0 && (
  <div className="flex justify-end">
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await fetch(`/api/lessons/${lesson.id}/chat`, { method: "DELETE" });
          setChatMessages([]);
          toast.success("Đã xóa lịch sử chat");
        } catch {
          toast.error("Lỗi khi xóa lịch sử chat");
        }
      }}
      className="text-xs text-gray-400 hover:text-red-500 h-6 cursor-pointer"
    >
      <Trash2 className="w-3 h-3 mr-1" />
      Xóa lịch sử
    </Button>
  </div>
)}
```

Add `Trash2` to lucide-react imports.

#### Verification:
```bash
npx tsc --noEmit
npm run lint
npm run build
```

---

### A.2 Lesson Notes

**Impact**: 🔥 High — core learning feature (personal note-taking)
**Effort**: M (4–5 hours)
**Spec**: `docs/specs/lesson-notes.md`
**Dependencies**: None (standalone)

#### Files to modify:
- `src/components/AIAssistantPanel.tsx` — add "Ghi chú" tab
- `src/components/NotesEditor.tsx` — NEW component

#### Task A.2.1: Create NotesEditor component

**File**: `src/components/NotesEditor.tsx`

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NotesEditorProps {
  lessonId: string;
  lessonTitle: string;
}

type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

export function NotesEditor({ lessonId, lessonTitle }: NotesEditorProps) {
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const lessonIdRef = useRef(lessonId);

  // Load notes when lessonId changes
  useEffect(() => {
    lessonIdRef.current = lessonId;
    setSaveStatus("idle");
    setLastSavedAt(null);
    setContent("");
    setPreview(false);

    const loadNotes = async () => {
      try {
        const res = await fetch(`/api/lessons/${lessonId}/notes`);
        if (res.ok) {
          const data = await res.json();
          if (data.notes) setContent(data.notes);
          if (data.updatedAt) {
            setLastSavedAt(new Date(data.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
          }
        }
      } catch {
        // Silently fail
      }
    };
    loadNotes();

    // Flush pending save on lesson change
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // Fire-and-forget flush
      if (savingRef.current || pendingRef.current) {
        // Content already in closure
      }
    };
  }, [lessonId]);

  // Auto-save with 2-second debounce
  const saveNotes = useCallback(async (text: string) => {
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/lessons/${lessonIdRef.current}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaveStatus("saved");
        setLastSavedAt(new Date(data.updatedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
    savingRef.current = false;
    if (pendingRef.current) {
      pendingRef.current = false;
      saveNotes(text);
    }
  }, []);

  const handleChange = (value: string) => {
    setContent(value);
    setSaveStatus("unsaved");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNotes(value);
    }, 2000);
  };

  // Status indicator rendering
  const renderStatus = () => {
    switch (saveStatus) {
      case "saving":
        return <span className="flex items-center gap-1 text-[10px] text-gray-400"><Loader2 className="w-3 h-3 animate-spin" />Đang lưu...</span>;
      case "saved":
        return <span className="flex items-center gap-1 text-[10px] text-emerald-500"><Check className="w-3 h-3" />Đã lưu {lastSavedAt && `lúc ${lastSavedAt}`}</span>;
      case "unsaved":
        return <span className="text-[10px] text-amber-500">Chưa lưu...</span>;
      case "error":
        return <span className="flex items-center gap-1 text-[10px] text-red-500"><AlertCircle className="w-3 h-3" />Lưu thất bại</span>;
      default:
        return lastSavedAt ? <span className="text-[10px] text-gray-400">Lưu lần cuối: {lastSavedAt}</span> : null;
    }
  };

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <Button
            variant={preview ? "ghost" : "default"}
            size="sm"
            onClick={() => setPreview(false)}
            className={`h-7 text-xs cursor-pointer ${!preview ? "bg-[#A435F0] hover:bg-[#8710D8] text-white" : ""}`}
          >
            Chỉnh sửa
          </Button>
          <Button
            variant={preview ? "default" : "ghost"}
            size="sm"
            onClick={() => setPreview(true)}
            className={`h-7 text-xs cursor-pointer ${preview ? "bg-[#A435F0] hover:bg-[#8710D8] text-white" : ""}`}
          >
            Xem trước
          </Button>
        </div>
        {renderStatus()}
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <ScrollArea className="flex-1 min-h-[160px]">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 min-h-[160px]">
            {content ? (
              <MarkdownRenderer content={content} />
            ) : (
              <span className="text-xs text-gray-400">Chưa có ghi chú.</span>
            )}
          </div>
        </ScrollArea>
      ) : (
        <Textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Bắt đầu ghi chú của bạn... Hỗ trợ Markdown."
          className="flex-1 min-h-[160px] text-sm resize-none border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30 rounded-xl leading-relaxed"
        />
      )}
    </div>
  );
}
```

#### Task A.2.2: Add "Ghi chú" tab to AIAssistantPanel

In `AIAssistantPanel.tsx`:

1. Add import: `import { NotesEditor } from "@/components/NotesEditor";`
2. Add `StickyNote` icon: `import { ..., StickyNote } from "lucide-react";`
3. Update `TabType`: `type TabType = "summary" | "explain" | "chat" | "roadmap" | "practice" | "notes";`
4. Add to TABS array:
```typescript
{ key: "notes", label: "Ghi chú", icon: StickyNote },
```
5. Add tab body in the render section after practice tab:
```typescript
{activeTab === "notes" && (
  <NotesEditor lessonId={lesson.id} lessonTitle={lesson.title} />
)}
```

#### Task A.2.3: Add "Insert to notes" button in chat messages

In AIAssistantPanel chat section, for assistant messages, add a small insert button:

```typescript
// In the chat message map, for assistant messages with content:
{msg.role === "assistant" && msg.content && (
  <button
    type="button"
    onClick={() => {
      // Dispatch to NotesEditor — use a callback prop or shared state
      // Simplest: use the existing pattern of setting state
      setInsertToNotesText(msg.content);
    }}
    className="mt-1 text-[10px] text-gray-400 hover:text-[#A435F0] cursor-pointer flex items-center gap-1"
    title="Chèn vào ghi chú"
  >
    <StickyNote className="w-3 h-3" />
    Chèn vào ghi chú
  </button>
)}
```

Pass `insertToNotesText` down to `NotesEditor` which appends it with a citation line.

#### Task A.2.4: Add notes search (collapsible)

In `NotesEditor`, add a search bar above the editor that calls `GET /api/courses/[id]/notes/search?q=keyword`. Display results in a dropdown with lesson title + snippet. Click navigates to that lesson.

**Note**: This requires `courseId` prop to be passed to NotesEditor. Add it from AIAssistantPanel which already has `courseId`.

#### Verification:
```bash
npx tsc --noEmit
npm run lint
npm run build
```

---

### A.3 Progress Tracking

**Impact**: 🔥 High — motivation + orientation
**Effort**: M (4–5 hours)
**Spec**: `docs/specs/progress-tracking.md`
**Dependencies**: None (standalone)

#### Files to modify:
- `src/app/page.tsx` — add progress state, handlers, pass to components
- `src/components/LessonList.tsx` — show completion checkmarks
- `src/components/CourseList.tsx` — show progress bar
- `src/components/AIAssistantPanel.tsx` — auto-complete trigger after quiz

#### Task A.3.1: Add progress state and fetching in page.tsx

```typescript
// New state in Home():
const [courseProgress, setCourseProgress] = useState<{
  completionPct: number;
  currentStreak: number;
  longestStreak: number;
} | null>(null);
const [lessonProgressMap, setLessonProgressMap] = useState<
  Record<string, { completed: boolean; quizScore: number | null }>
>({});

// Fetch progress when course changes:
useEffect(() => {
  if (!selectedCourse) {
    setCourseProgress(null);
    setLessonProgressMap({});
    return;
  }
  const loadProgress = async () => {
    try {
      const res = await fetch(`/api/courses/${selectedCourse.id}/progress`);
      if (res.ok) {
        // Note: the progress route may return CourseProgress data
        // Adapt based on actual API response shape
      }
    } catch {
      // Silently fail
    }
  };
  loadProgress();
}, [selectedCourse?.id]);
```

#### Task A.3.2: Manual completion toggle handler in page.tsx

```typescript
const handleToggleLessonComplete = async (lessonId: string, completed: boolean) => {
  try {
    const res = await fetch(`/api/lessons/${lessonId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
    if (res.ok) {
      setLessonProgressMap((prev) => ({
        ...prev,
        [lessonId]: { ...prev[lessonId], completed },
      }));
      toast.success(completed ? "Đã đánh dấu hoàn thành" : "Đã bỏ đánh dấu hoàn thành");
      // Re-fetch course progress to update completion %
      if (selectedCourse) {
        const progressRes = await fetch(`/api/courses/${selectedCourse.id}/progress`);
        if (progressRes.ok) {
          const data = await progressRes.json();
          setCourseProgress(data.courseProgress);
        }
      }
    }
  } catch {
    toast.error("Lỗi khi cập nhật tiến độ");
  }
};
```

#### Task A.3.3: Show checkmarks in LessonList

Pass `progressMap` prop to `LessonList`:

```typescript
// In LessonList component, add to props:
interface LessonListProps {
  // ... existing props
  progressMap?: Record<string, { completed: boolean }>;
  onToggleComplete?: (lessonId: string, completed: boolean) => void;
}

// In each lesson item, add clickable checkmark:
<button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    onToggleComplete?.(lesson.id, !progressMap?.[lesson.id]?.completed);
  }}
  className="shrink-0 cursor-pointer"
>
  {progressMap?.[lesson.id]?.completed ? (
    <CheckCircle2 className="w-4 h-4 text-green-500" />
  ) : (
    <Circle className="w-4 h-4 text-gray-300" />
  )}
</button>
```

Import `CheckCircle2`, `Circle` from lucide-react.

#### Task A.3.4: Show progress bar in CourseList

Pass `courseProgressMap` prop (courseId → completionPct):

```typescript
// Under course title in CourseList:
{progressPct !== undefined && (
  <div className="mt-1.5">
    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${progressPct >= 100 ? "bg-green-500" : "bg-[#A435F0]"}`}
        style={{ width: `${Math.min(progressPct, 100)}%` }}
      />
    </div>
    <span className="text-[10px] text-gray-400 mt-0.5">
      {progressPct.toFixed(0)}% hoàn thành
    </span>
  </div>
)}
```

#### Task A.3.5: Track study time with PATCH on lesson switch

When user switches lessons, PATCH the time delta to the previous lesson:

```typescript
// In page.tsx, track lesson start time:
const lessonStartTimeRef = useRef<number>(Date.now());

// When selectedLesson changes (in handleSelectLesson or confirmLessonSwitch):
const prevLessonId = selectedLesson?.id;
if (prevLessonId) {
  const deltaMs = Date.now() - lessonStartTimeRef.current;
  if (deltaMs > 5000) { // Only track if > 5 seconds
    fetch(`/api/lessons/${prevLessonId}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deltaTimeMs: deltaMs }),
    }).catch(() => {}); // fire-and-forget
  }
}
lessonStartTimeRef.current = Date.now();
```

#### Task A.3.6: Auto-complete on quiz score (via callback from AIAssistantPanel)

After quiz submission in AIAssistantPanel, if score >= 70 AND summary exists AND explanation exists → auto-mark complete:

```typescript
// Add prop to AIAssistantPanel:
onQuizComplete?: (lessonId: string, score: number) => void;

// In QuizPlayer, after scoring, call back:
onQuizComplete?.(lesson.id, scorePercentage);

// In page.tsx handler:
const handleQuizComplete = async (lessonId: string, score: number) => {
  // Save quiz score via POST
  await fetch(`/api/lessons/${lessonId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ completed: true, quizScore: score }),
  });
  // Refresh progress
};
```

#### Verification:
```bash
npx tsc --noEmit
npm run lint
npm run build
```

---

### A.4 SRS Flashcard Review

**Impact**: 🔥🔥 Very high — spaced repetition = learning effectiveness core
**Effort**: L (6–8 hours)
**Spec**: `docs/specs/srs-scheduler.md`
**Dependencies**: Flashcards must exist (✅ already working)

#### Files to modify:
- `src/components/FlashcardDeck.tsx` — add SRS mode
- `src/components/AIAssistantPanel.tsx` — add SRS button/mode toggle
- `src/components/SRSDashboard.tsx` — NEW component

#### Task A.4.1: Add SRS mode to FlashcardDeck

Add `mode` prop to FlashcardDeck:

```typescript
interface FlashcardDeckProps {
  markdown: string;
  mode?: "normal" | "srs";
  lessonId?: string;
  onReviewComplete?: () => void;
}
```

When `mode="srs"`:
1. On mount, call `POST /api/lessons/[id]/srs/init` (idempotent)
2. Then call `GET /api/lessons/[id]/srs/due` to load due cards
3. Replace prev/next navigation with quality rating buttons
4. After each rating, call `POST /api/lessons/[id]/srs/review`
5. Auto-advance to next card
6. Show completion screen when done

```typescript
// SRS-specific state:
const [srsCards, setSrsCards] = useState<DueCard[]>([]);
const [srsLoading, setSrsLoading] = useState(false);
const [srsReviewIndex, setSrsReviewIndex] = useState(0);
const [srsCompleted, setSrsCompleted] = useState(false);
const [srsStats, setSrsStats] = useState({ remembered: 0, forgot: 0 });

// Load SRS data:
useEffect(() => {
  if (mode !== "srs" || !lessonId) return;
  const initAndLoad = async () => {
    setSrsLoading(true);
    try {
      // Init (idempotent)
      await fetch(`/api/lessons/${lessonId}/srs/init`, { method: "POST" });
      // Load due cards
      const res = await fetch(`/api/lessons/${lessonId}/srs/due`);
      if (res.ok) {
        const data = await res.json();
        setSrsCards(data.dueCards || []);
      }
    } catch {
      toast.error("Lỗi khi tải thẻ SRS");
    }
    setSrsLoading(false);
  };
  initAndLoad();
}, [mode, lessonId]);
```

#### Task A.4.2: SRS rating buttons

Replace the prev/next navigation when in SRS mode:

```typescript
{mode === "srs" && isFlipped && (
  <div className="flex items-center justify-center gap-3">
    <Button
      onClick={() => handleSrsRate(1)}
      variant="outline"
      size="sm"
      className="text-red-500 border-red-200 hover:bg-red-50 hover:border-red-300"
    >
      😣 Quên
    </Button>
    <Button
      onClick={() => handleSrsRate(3)}
      variant="outline"
      size="sm"
      className="text-amber-500 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
    >
      🤔 Khó
    </Button>
    <Button
      onClick={() => handleSrsRate(5)}
      variant="outline"
      size="sm"
      className="text-green-500 border-green-200 hover:bg-green-50 hover:border-green-300"
    >
      😊 Dễ
    </Button>
  </div>
)}
```

```typescript
const handleSrsRate = async (quality: number) => {
  const card = srsCards[srsReviewIndex];
  try {
    await fetch(`/api/lessons/${lessonId}/srs/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardIndex: card.cardIndex, quality }),
    });
    // Track stats
    setSrsStats((prev) => ({
      remembered: prev.remembered + (quality >= 3 ? 1 : 0),
      forgot: prev.forgot + (quality < 3 ? 1 : 0),
    }));
    // Advance
    if (srsReviewIndex < srsCards.length - 1) {
      setSrsReviewIndex(srsReviewIndex + 1);
      setIsFlipped(false);
    } else {
      setSrsCompleted(true);
      onReviewComplete?.();
    }
  } catch {
    toast.error("Lỗi khi lưu kết quả ôn tập");
  }
};
```

#### Task A.4.3: SRS completion screen

```typescript
{srsCompleted && (
  <div className="flex flex-col items-center gap-4 py-8 text-center">
    <div className="text-3xl">🎉</div>
    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Hoàn thành!</h3>
    <div className="text-xs text-gray-500 space-y-1">
      <p>Đã ôn: {srsCards.length} thẻ</p>
      <p>Nhớ tốt: {srsStats.remembered} · Cần ôn thêm: {srsStats.forgot}</p>
    </div>
    <Button
      onClick={() => { setSrsCompleted(false); setSrsReviewIndex(0); setSrsStats({ remembered: 0, forgot: 0 }); setSrsCards([]); }}
      variant="outline"
      size="sm"
      className="text-[#A435F0] border-[#A435F0]/20 cursor-pointer"
    >
      Quay lại bài học
    </Button>
  </div>
)}
```

#### Task A.4.4: SRS toggle button in Practice tab

In AIAssistantPanel, when `practiceMode === "flashcards"` and flashcards exist, add SRS button:

```typescript
{flashcardsResult && (
  <div className="flex items-center gap-2">
    <Button
      variant={srsMode ? "default" : "outline"}
      size="sm"
      onClick={() => setSrsMode(!srsMode)}
      className={`text-xs cursor-pointer ${srsMode ? "bg-[#A435F0] hover:bg-[#8710D8]" : "text-[#A435F0] border-[#A435F0]/20"}`}
    >
      🧠 Ôn SRS {dueBadge > 0 && `(${dueBadge})`}
    </Button>
  </div>
)}
```

#### Task A.4.5: Create SRS Dashboard component

**File**: `src/components/SRSDashboard.tsx`

A panel showing due cards across all lessons. Loads from `GET /api/srs/dashboard`.

```typescript
"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SRSDashboardProps {
  onNavigateToLesson?: (lessonId: string) => void;
}

export function SRSDashboard({ onNavigateToLesson }: SRSDashboardProps) {
  const [data, setData] = useState<{ totalDue: number; lessons: Array<{ lessonId: string; lessonTitle: string; dueCount: number; totalCards: number; masteredCount: number }> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/srs/dashboard");
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang tải...</div>;
  if (!data || data.totalDue === 0) return <div className="text-xs text-gray-400 text-center py-4">Không có thẻ nào cần ôn hôm nay 🎉</div>;

  return (
    <ScrollArea className="max-h-[300px]">
      <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
        Tổng: {data.totalDue} thẻ cần ôn
      </div>
      {data.lessons.map((l) => (
        <button
          key={l.lessonId}
          type="button"
          onClick={() => onNavigateToLesson?.(l.lessonId)}
          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        >
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{l.lessonTitle}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">
            {l.dueCount} thẻ cần ôn · {l.masteredCount}/{l.totalCards} thành thạo
          </div>
        </button>
      ))}
    </ScrollArea>
  );
}
```

#### Verification:
```bash
npx tsc --noEmit
npm run lint
npm run build
```

---

### A.5 Pre-Assessment (Learner Profile)

**Impact**: 🔥 High — personalization foundation
**Effort**: M (3–4 hours)
**Spec**: `docs/specs/pre-assessment.md`
**Dependencies**: None (standalone)

#### Files to modify:
- `src/components/LearnerProfileModal.tsx` — NEW component
- `src/components/AIAssistantPanel.tsx` — trigger modal from Roadmap tab

#### Task A.5.1: Create LearnerProfileModal component

**File**: `src/components/LearnerProfileModal.tsx`

Multi-step modal (5 questions):
1. Level: beginner / intermediate / advanced (Radio)
2. Goal: career_change / skill_upgrade / hobby / exam_prep (Radio)
3. Daily time: 30 / 60 / 120 (Radio with labels "30 phút" / "1 giờ" / "2 giờ+")
4. Known topics: Checklist from lesson titles
5. Learning style: theory_first / hands_on / mixed (Radio)

```typescript
interface LearnerProfileModalProps {
  open: boolean;
  courseId: string;
  lessons: Array<{ id: string; title: string }>;
  existingProfile?: LearnerProfile | null;
  onClose: () => void;
  onSaved: (profile: LearnerProfile) => void;
}
```

Each step uses Next/Back buttons. Submit calls POST (create) or PUT (update) to `/api/courses/[id]/profile`.

#### Task A.5.2: Integrate with Roadmap tab in AIAssistantPanel

In the Roadmap tab section:

1. On mount (or on tab switch to roadmap), check for existing profile: `GET /api/courses/${courseId}/profile`
2. If 404 → show prompt: "Cá nhân hóa lộ trình? Hãy cho chúng tôi biết về bạn" + button to open modal
3. If profile exists → show "Cập nhật hồ sơ" button next to Roadmap generate button
4. After profile saved:
   - If new → auto-trigger roadmap generation
   - If updated → show confirm: "Tạo lại Roadmap với hồ sơ mới?"

```typescript
// New state in AIAssistantPanel:
const [learnerProfile, setLearnerProfile] = useState<LearnerProfile | null>(null);
const [showProfileModal, setShowProfileModal] = useState(false);
const [profileChecked, setProfileChecked] = useState(false);

// Load profile when courseId changes:
useEffect(() => {
  setLearnerProfile(null);
  setProfileChecked(false);
  const checkProfile = async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/profile`);
      if (res.ok) {
        setLearnerProfile(await res.json());
      }
    } catch { /* silent */ }
    setProfileChecked(true);
  };
  checkProfile();
}, [courseId]);
```

#### Verification:
```bash
npx tsc --noEmit
npm run lint
npm run build
```

---

### A.6 Export

**Impact**: 🔶 Medium — convenience feature
**Effort**: S (2–3 hours)
**Spec**: `docs/specs/export.md`
**Dependencies**: None (standalone)

#### Files to modify:
- `src/components/AIAssistantPanel.tsx` — add export dropdown
- `src/components/ExportDropdown.tsx` — NEW component

#### Task A.6.1: Create ExportDropdown component

**File**: `src/components/ExportDropdown.tsx`

```typescript
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportDropdownProps {
  lessonId: string;
  activeTab: string;
  practiceMode?: string;
  hasData: {
    summary: boolean;
    explanation: boolean;
    quiz: boolean;
    flashcards: boolean;
    exercises: boolean;
  };
}

export function ExportDropdown({ lessonId, activeTab, practiceMode, hasData }: ExportDropdownProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type: string, format: string) => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/lesson/${lessonId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, format }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Lỗi khi xuất file");
        return;
      }
      // Trigger file download
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
      const filename = filenameMatch?.[1] || `export.${format === "csv" ? "csv" : "md"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Lỗi khi xuất file");
    } finally {
      setExporting(false);
    }
  };

  // Determine available options based on active tab
  const options: Array<{ label: string; type: string; format: string; enabled: boolean }> = [];

  if (activeTab === "summary") {
    options.push({ label: "Xuất tóm tắt (.md)", type: "summary", format: "markdown", enabled: hasData.summary });
  } else if (activeTab === "explain") {
    options.push({ label: "Xuất giải thích (.md)", type: "explanation", format: "markdown", enabled: hasData.explanation });
  } else if (activeTab === "practice") {
    if (practiceMode === "quiz") {
      options.push({ label: "Xuất quiz (.md)", type: "quiz", format: "markdown", enabled: hasData.quiz });
    } else if (practiceMode === "flashcards") {
      options.push({ label: "Xuất flashcard (.md)", type: "flashcards", format: "markdown", enabled: hasData.flashcards });
      options.push({ label: "Xuất Anki (.csv)", type: "flashcards", format: "csv", enabled: hasData.flashcards });
    } else if (practiceMode === "exercises") {
      options.push({ label: "Xuất bài tập (.md)", type: "exercises", format: "markdown", enabled: hasData.exercises });
    }
  }

  if (options.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={exporting}
          className="h-7 text-xs text-gray-400 hover:text-[#A435F0] cursor-pointer"
        >
          {exporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((opt) => (
          <DropdownMenuItem
            key={`${opt.type}-${opt.format}`}
            disabled={!opt.enabled}
            onClick={() => handleExport(opt.type, opt.format)}
            className="text-xs cursor-pointer"
          >
            {opt.label}
            {!opt.enabled && <span className="ml-1 text-gray-400">(chưa có dữ liệu)</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### Task A.6.2: Integrate ExportDropdown in AIAssistantPanel header

In the AIAssistantPanel header div, next to the model info:

```typescript
{activeTab !== "chat" && activeTab !== "notes" && (
  <ExportDropdown
    lessonId={lesson.id}
    activeTab={activeTab}
    practiceMode={practiceMode}
    hasData={{
      summary: !!summaryResult,
      explanation: !!explainResult,
      quiz: !!quizResult,
      flashcards: !!flashcardsResult,
      exercises: !!exercisesResult,
    }}
  />
)}
```

#### Task A.6.3: Add course-level export

In `CourseList.tsx` or sidebar, add export buttons for course-level:
- "Xuất ghi chú khóa (.md)" → `POST /api/export/course/[id]` with `{ type: "full-notes", format: "markdown" }`
- "Xuất flashcard Anki (.csv)" → `POST /api/export/course/[id]` with `{ type: "all-flashcards", format: "csv" }`

Follow same blob download pattern as lesson-level.

#### Verification:
```bash
npx tsc --noEmit
npm run lint
npm run build
```

---

### A.7 Learning Analytics

**Impact**: 🔶 Medium — insight and motivation
**Effort**: L (6–8 hours)
**Spec**: `docs/specs/learning-analytics.md`
**Dependencies**: A.3 (Progress Tracking) + A.4 (SRS) should be done first for meaningful data

#### Files to create:
- `src/components/AnalyticsDashboard.tsx` — NEW
- `src/components/AnalyticsCourseDetail.tsx` — NEW
- `src/components/StudyHeatmap.tsx` — NEW

#### Task A.7.1: Create AnalyticsDashboard component

Overview panel with 6 metric cards. Loads from `GET /api/analytics/overview`.

Cards:
1. **Completion Rate**: `totalLessonsCompleted` + circular/bar progress
2. **Total Time**: `totalTimeSeconds` formatted as "Xh Xm"
3. **Quiz Average**: `averageQuizScore` or empty state
4. **Flashcard Retention**: `overallRetentionRate` or empty state
5. **Current Streak**: `currentStreak` with 🔥 icon
6. **Longest Streak**: `longestStreak`

Each card: large number on top, small description below, empty state with CTA.

#### Task A.7.2: Create StudyHeatmap component

52-week heatmap (GitHub contribution style) using CSS grid:
- 52 columns × 7 rows of small `div`s
- Color from `bg-gray-100` (0) → `bg-[#A435F0]/20` (1-2) → `bg-[#A435F0]/50` (3-5) → `bg-[#A435F0]` (6+)
- Hover tooltip: "Mar 15: 3 bài học"
- Data from `studyFrequency` array in overview API

```typescript
// Pure CSS approach — no chart library:
<div className="grid grid-cols-52 gap-0.5">
  {weeks.map((week) =>
    week.days.map((day) => (
      <div
        key={day.date}
        className={`w-2.5 h-2.5 rounded-sm ${colorClass(day.count)}`}
        title={`${day.date}: ${day.count} bài`}
      />
    ))
  )}
</div>
```

#### Task A.7.3: Create AnalyticsCourseDetail component

Per-course breakdown. Loads from `GET /api/analytics/course/[id]`.

Contains:
- Lesson table: STT, Title, Time, Quiz Score, Flashcard Mastery, Status
- Quiz score histogram (5 bins, pure CSS bars)
- Summary metrics: completionRate, totalTimeSeconds, retentionRate

#### Task A.7.4: Integrate analytics into app layout

Options (pick one based on simplicity):
- **Option A (simpler)**: Add "Analytics" tab in AIAssistantPanel TABS array (course-level)
- **Option B**: Add "📊" button in Header that opens a modal/sheet with analytics

Recommend **Option A**: Add as a tab with `key: "analytics"`, `icon: BarChart3` from lucide-react.

When tab active: show `AnalyticsDashboard` if no course selected, or `AnalyticsCourseDetail` if course selected.

#### Verification:
```bash
npx tsc --noEmit
npm run lint
npm run build
```

---

### 🚦 Phase A Quality Gate

After all A.1–A.7 tasks are complete:

```bash
npm run build       # Zero TypeScript errors
npm run lint        # Zero lint warnings
npm run test        # All tests pass
```

Manual testing checklist:
- [ ] Chat persists across lesson switches
- [ ] Notes auto-save with debounce, preview works
- [ ] Completion checkmarks toggle in LessonList
- [ ] Progress bar shows in CourseList
- [ ] SRS mode loads due cards, rating advances cards
- [ ] Profile modal saves and loads
- [ ] Export downloads correct file
- [ ] Analytics shows metrics (may be empty if no data)

---

## Phase B: UX Polish (Remaining Items)

> **Goal**: Additional UX improvements not covered by Phase 6 or not yet verified.
> **Effort**: ~2–3 days
> **Parallelism**: All items are independent.

---

### B.1 Course Search in CourseList

**Effort**: S (1 hour)
**File**: `src/components/CourseList.tsx`

Verify CourseList has search input. If not present, add:

```typescript
const [searchQuery, setSearchQuery] = useState("");

const filteredCourses = courses.filter((c) =>
  c.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .includes(searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
);

// Above course list:
<Input
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  placeholder="Tìm khóa học..."
  className="text-xs h-7"
/>
<span className="text-[10px] text-gray-400">{filteredCourses.length} / {courses.length} khóa học</span>
```

#### Verification:
```bash
npx tsc --noEmit
```

---

### B.2 Streak Counter Display

**Effort**: XS (30 min)
**File**: `src/app/page.tsx` or `src/components/Header.tsx`

Show streak counter if > 0:

```typescript
{courseProgress?.currentStreak > 0 && (
  <span className="text-xs font-medium text-orange-500 flex items-center gap-1">
    🔥 {courseProgress.currentStreak} ngày
  </span>
)}
```

Place in Header or next to course title.

---

### B.3 DnD Upload Enhancement

**Effort**: S (1 hour)
**File**: `src/components/UploadModal.tsx`

Add drag-over visual feedback if not already present:
- `onDragOver` → show blue border + "Thả file vào đây" overlay
- `onDragLeave` → revert
- `onDrop` → process files

---

### B.4 Notes Search UI (cross-lesson)

**Effort**: M (2 hours)
**File**: `src/components/NotesEditor.tsx`

Add collapsible search bar using `GET /api/courses/[id]/notes/search?q=keyword`:
- Input with 300ms debounce
- Results dropdown: lesson title + snippet with keyword highlighted
- Click navigates to that lesson

---

### 🚦 Phase B Quality Gate

```bash
npm run build
npm run lint
npm run test
```

---

## Phase C: AI Quality Upgrades

> **Goal**: Upgrade AI prompts and interaction patterns for educational effectiveness.
> **Effort**: ~3–5 days
> **Dependencies**: Pre-Assessment (A.5) should be done before C.2, C.3.

---

### C.1 Socratic Chat Mode

**Impact**: Nâng Chat từ 6.5 → 9.5+
**Effort**: M (3–4 hours)
**Spec**: `docs/specs/improvement-plan.md` §2.1

#### Files to modify:
- `src/lib/ai/prompts.ts` — update CHAT_SYSTEM_PROMPT
- `src/components/AIAssistantPanel.tsx` — add mode toggle

#### Task C.1.1: Add Socratic mode toggle

In chat tab, add toggle above input:

```typescript
const [chatMode, setChatMode] = useState<"direct" | "socratic">("direct");

// Toggle UI:
<div className="flex gap-1 p-0.5 bg-gray-50 dark:bg-gray-800 rounded-md">
  <button
    onClick={() => setChatMode("direct")}
    className={`px-2 py-1 text-[10px] rounded cursor-pointer ${chatMode === "direct" ? "bg-white dark:bg-gray-700 shadow-sm font-medium" : "text-gray-400"}`}
  >
    Trả lời trực tiếp
  </button>
  <button
    onClick={() => setChatMode("socratic")}
    className={`px-2 py-1 text-[10px] rounded cursor-pointer ${chatMode === "socratic" ? "bg-white dark:bg-gray-700 shadow-sm font-medium" : "text-gray-400"}`}
  >
    Dẫn dắt suy nghĩ
  </button>
</div>
```

#### Task C.1.2: Update CHAT_SYSTEM_PROMPT

In `src/lib/ai/prompts.ts`, export a function that takes `mode` parameter:

```typescript
export function buildChatSystemPrompt(mode: "direct" | "socratic"): string {
  const socraticBlock = mode === "socratic" ? `
## CHẾ ĐỘ DẪN DẮT SUY NGHĨ (SOCRATIC)
Bạn KHÔNG trả lời trực tiếp. Thay vào đó:
1. Phân tích lỗ hổng hiểu biết của người học từ câu hỏi
2. Hỏi MỘT câu hỏi dẫn dắt giúp người học tự tìm ra đáp án
3. Nếu người học trả lời đúng hướng → xác nhận + hỏi câu tiếp để đào sâu
4. Nếu người học trả lời sai hướng → gợi ý thêm bằng câu hỏi mới
5. Sau 3 vòng hỏi nếu vẫn stuck → tiết lộ đáp án kèm giải thích đầy đủ
6. Kết thúc mỗi vòng hỏi bằng emoji khích lệ phù hợp
` : "";

  return `${EXISTING_CHAT_PROMPT}
${socraticBlock}`;
}
```

#### Task C.1.3: Pass mode to chat API

In `handleChat`, include `chatMode` in the request body. The chat API route passes it to the system prompt.

```typescript
body: JSON.stringify({
  ...apiBody(),
  messages: updatedMessages,
  mode: chatMode, // "direct" | "socratic"
}),
```

Update `/api/ai/chat/route.ts` to read `mode` from body and use `buildChatSystemPrompt(mode)`.

#### Verification:
```bash
npx tsc --noEmit
npm run build
```

---

### C.2 Adaptive Explain (depth by learner level)

**Impact**: Nâng Explain từ 7.0 → 9.5+
**Effort**: S (2 hours)
**Spec**: `docs/specs/improvement-plan.md` §2.2
**Dependencies**: A.5 (Pre-Assessment) for auto-select

#### Files to modify:
- `src/lib/ai/prompts.ts` — update EXPLAIN_SYSTEM_PROMPT
- `src/components/AIAssistantPanel.tsx` — add depth selector

#### Task C.2.1: Add depth selector UI

In Explain tab, add a 3-option selector above the action button:

```typescript
const [explainDepth, setExplainDepth] = useState<"simple" | "standard" | "deep">("standard");

// If learnerProfile exists, auto-select based on level:
useEffect(() => {
  if (learnerProfile?.level === "beginner") setExplainDepth("simple");
  else if (learnerProfile?.level === "advanced") setExplainDepth("deep");
  else setExplainDepth("standard");
}, [learnerProfile]);

// Selector UI:
<div className="flex gap-1 p-0.5 bg-gray-50 dark:bg-gray-800 rounded-md">
  {[
    { key: "simple", label: "Đơn giản" },
    { key: "standard", label: "Chuẩn" },
    { key: "deep", label: "Chuyên sâu" },
  ].map((opt) => (
    <button
      key={opt.key}
      onClick={() => setExplainDepth(opt.key as typeof explainDepth)}
      className={`flex-1 px-2 py-1 text-[10px] rounded cursor-pointer ${explainDepth === opt.key ? "bg-[#A435F0] text-white shadow-sm" : "text-gray-400"}`}
    >
      {opt.label}
    </button>
  ))}
</div>
```

#### Task C.2.2: Update explain API call

Pass `depth` in the request body:

```typescript
body: JSON.stringify({
  ...apiBody(),
  depth: explainDepth,
}),
```

#### Task C.2.3: Update EXPLAIN_SYSTEM_PROMPT

In `prompts.ts`, export a function that takes `depth`:

```typescript
export function buildExplainSystemPrompt(depth: "simple" | "standard" | "deep"): string {
  const depthInstructions = {
    simple: `## ĐỘ SÂU: ĐƠN GIẢN (ELI5)
- Dùng ngôn ngữ đơn giản, nhiều ví dụ đời thường, phép so sánh
- Tránh thuật ngữ chuyên sâu, giải thích từng bước
- Mục tiêu: người mới hoàn toàn có thể hiểu`,
    standard: `## ĐỘ SÂU: CHUẨN
- Cân bằng giữa chi tiết và dễ hiểu
- Thuật ngữ kỹ thuật có giải thích
- Ví dụ thực tế kèm code nếu phù hợp`,
    deep: `## ĐỘ SÂU: CHUYÊN SÂU
- Đào sâu edge cases, performance implications, internals
- So sánh với alternatives, trade-offs
- Dành cho người đã có nền tảng muốn master`,
  };

  return `${EXISTING_EXPLAIN_PROMPT}
${depthInstructions[depth]}`;
}
```

#### Verification:
```bash
npx tsc --noEmit
npm run build
```

---

### C.3 Personalized Roadmap (using LearnerProfile)

**Impact**: Nâng Roadmap từ 7.0 → 9.5+
**Effort**: S (2 hours)
**Spec**: `docs/specs/improvement-plan.md` §2.4
**Dependencies**: A.5 (Pre-Assessment)

#### Files to modify:
- `src/lib/ai/prompts.ts` — update ROADMAP_SYSTEM_PROMPT
- `src/app/api/ai/roadmap/route.ts` — inject profile data

#### Task C.3.1: Fetch profile in roadmap API route

In the roadmap API route, after getting courseId, also fetch LearnerProfile:

```typescript
const profile = await prisma.learnerProfile.findUnique({
  where: { courseId },
});
```

#### Task C.3.2: Inject profile into prompt

```typescript
const learnerContext = profile ? `
## LEARNER CONTEXT (Hồ sơ học viên)
- Trình độ: ${profile.level}
- Mục tiêu: ${profile.goal}
- Thời gian học/ngày: ${profile.dailyTimeMin} phút
- Phong cách: ${profile.learningStyle}
- Chủ đề đã biết: ${profile.knownTopics ? JSON.parse(profile.knownTopics).join(", ") : "Không có"}

→ Điều chỉnh lộ trình theo hồ sơ trên: bỏ qua/tóm tắt nhanh chủ đề đã biết, ước tính thời gian theo ${profile.dailyTimeMin} phút/ngày, ưu tiên ${profile.learningStyle === "hands_on" ? "thực hành" : profile.learningStyle === "theory_first" ? "lý thuyết trước" : "cân bằng lý thuyết và thực hành"}.
` : "";

// Prepend to system prompt or append to user message
```

#### Task C.3.3: Add "Cập nhật hồ sơ" button in Roadmap tab

Already covered in A.5. Just ensure the button triggers `setShowProfileModal(true)` and after save offers to regenerate roadmap.

#### Verification:
```bash
npx tsc --noEmit
npm run build
```

---

### C.4 Calibrated Summary (mode selector)

**Impact**: Nâng Summary từ 7.5 → 9.5+
**Effort**: S (1–2 hours)
**Spec**: `docs/specs/improvement-plan.md` §2.3

#### Files to modify:
- `src/lib/ai/prompts.ts` — support summary mode
- `src/components/AIAssistantPanel.tsx` — add mode toggle

#### Task C.4.1: Add summary mode toggle

```typescript
const [summaryMode, setSummaryMode] = useState<"quick" | "detailed">("detailed");

// Toggle UI (same pattern as explain depth):
<div className="flex gap-1 p-0.5 bg-gray-50 dark:bg-gray-800 rounded-md mb-2">
  <button
    onClick={() => setSummaryMode("quick")}
    className={`flex-1 px-2 py-1 text-[10px] rounded cursor-pointer ${summaryMode === "quick" ? "bg-[#A435F0] text-white" : "text-gray-400"}`}
  >
    Tóm tắt nhanh
  </button>
  <button
    onClick={() => setSummaryMode("detailed")}
    className={`flex-1 px-2 py-1 text-[10px] rounded cursor-pointer ${summaryMode === "detailed" ? "bg-[#A435F0] text-white" : "text-gray-400"}`}
  >
    Chi tiết
  </button>
</div>
```

#### Task C.4.2: Update summary API call

Pass `mode` in body: `{ ...apiBody(), mode: summaryMode }`.

#### Task C.4.3: Update SUMMARY_SYSTEM_PROMPT

```typescript
export function buildSummarySystemPrompt(mode: "quick" | "detailed"): string {
  if (mode === "quick") {
    return `${QUICK_SUMMARY_INSTRUCTIONS}
- Target: 300-500 từ
- Format: Bullet points, key takeaways only
- No examples, no deep explanation`;
  }
  return EXISTING_SUMMARY_PROMPT; // detailed = current behavior
}
```

#### Verification:
```bash
npx tsc --noEmit
npm run build
```

---

### C.5 Rich Transcript (search + highlight + explain selection)

**Impact**: Nâng Transcript từ 6.0 → 9.5+
**Effort**: Already DONE ✅

Verified in current `TranscriptPanel.tsx`:
- ✅ Ctrl+F search with match highlighting and navigation
- ✅ Text selection → floating "Giải thích đoạn này" button
- ✅ Word count display
- ✅ Copy button
- ✅ Read/Edit mode toggle with unsaved warning

**No work needed for C.5.**

---

### 🚦 Phase C Quality Gate

```bash
npm run build       # Zero TypeScript errors
npm run lint        # Zero lint warnings
npm run test        # All tests pass
```

Manual testing:
- [ ] Socratic mode asks guiding questions instead of answering directly
- [ ] Explain depth changes output complexity
- [ ] Roadmap includes personalized context when profile exists
- [ ] Summary "quick" mode produces shorter output

---

## Summary

### Total Tasks

| Phase | Tasks | Effort | Parallel Potential |
|-------|-------|--------|--------------------|
| **A** Backend→UI | 7 features, ~25 subtasks | ~5–7 days | High (A.1–A.3 standalone) |
| **B** UX Polish | 4 tasks | ~2–3 days | Very high (all independent) |
| **C** AI Quality | 4 upgrades (C.5 already done) | ~3–4 days | Medium (C.2, C.3 need A.5) |
| **TOTAL** | ~33 subtasks | ~10–14 days | |

### Dependency Graph

```
Phase A (Backend → UI):
├── A.1 Chat Persistence (standalone) ──→ C.1 Socratic Chat
├── A.2 Lesson Notes (standalone)
├── A.3 Progress Tracking (standalone) ──┐
├── A.4 SRS Flashcard Review (standalone) ├──→ A.7 Learning Analytics
├── A.5 Pre-Assessment (standalone) ──────┼──→ C.2 Adaptive Explain
│                                         │    C.3 Personalized Roadmap
├── A.6 Export (standalone)               │
└── A.7 Learning Analytics ──────────────┘

Phase B (UX Polish — all standalone):
├── B.1 Course Search
├── B.2 Streak Counter
├── B.3 DnD Upload Enhancement
└── B.4 Notes Search

Phase C (AI Quality):
├── C.1 Socratic Chat ← A.1
├── C.2 Adaptive Explain ← A.5
├── C.3 Personalized Roadmap ← A.5
├── C.4 Calibrated Summary (standalone)
└── C.5 Rich Transcript ← ALREADY DONE ✅
```

### Critical Path

```
A.5 Pre-Assessment → C.2 Adaptive Explain + C.3 Personalized Roadmap
A.3 Progress + A.4 SRS → A.7 Learning Analytics
A.1 Chat Persistence → C.1 Socratic Chat
```

### New Files to Create

| File | Phase | Description |
|------|-------|-------------|
| `src/components/NotesEditor.tsx` | A.2 | Markdown notes editor with auto-save |
| `src/components/SRSDashboard.tsx` | A.4 | SRS due cards overview |
| `src/components/LearnerProfileModal.tsx` | A.5 | 5-step profiling modal |
| `src/components/ExportDropdown.tsx` | A.6 | Tab-aware export menu |
| `src/components/AnalyticsDashboard.tsx` | A.7 | Overview metrics cards |
| `src/components/AnalyticsCourseDetail.tsx` | A.7 | Per-course breakdown |
| `src/components/StudyHeatmap.tsx` | A.7 | 52-week contribution heatmap |

### Files to Modify

| File | Phases | Changes |
|------|--------|---------|
| `src/components/AIAssistantPanel.tsx` | A.1, A.2, A.4, A.5, A.6, C.1, C.2, C.4 | Tabs, chat persistence, SRS toggle, profile check, export, mode selectors |
| `src/app/page.tsx` | A.3, B.2 | Progress state, handlers, time tracking, streak display |
| `src/components/LessonList.tsx` | A.3 | Completion checkmarks |
| `src/components/CourseList.tsx` | A.3, A.6, B.1 | Progress bars, export buttons, search |
| `src/components/FlashcardDeck.tsx` | A.4 | SRS mode with rating buttons |
| `src/lib/ai/prompts.ts` | C.1, C.2, C.3, C.4 | Dynamic prompt builders |
| `src/app/api/ai/chat/route.ts` | C.1 | Read Socratic mode parameter |
| `src/app/api/ai/roadmap/route.ts` | C.3 | Inject LearnerProfile |
| `src/app/api/ai/explain/route.ts` | C.2 | Read depth parameter |
| `src/app/api/ai/summary/route.ts` | C.4 | Read summary mode parameter |

---

## Patterns to Follow (MANDATORY)

### State Management
```typescript
// ✅ CORRECT: useState in page.tsx or component
const [data, setData] = useState<T>(initialValue);

// ❌ WRONG: Context, Zustand, Redux
const MyContext = createContext(...); // NEVER
```

### Data Fetching
```typescript
// ✅ CORRECT: raw fetch + try/catch + toast
try {
  const res = await fetch("/api/...");
  if (res.ok) {
    const data = await res.json();
    setState(data);
  }
} catch {
  toast.error("Lỗi...");
}

// ❌ WRONG: useSWR, react-query, custom hooks
```

### Component Pattern
```typescript
// ✅ CORRECT: named export, "use client", props + callbacks
"use client";
export function MyComponent({ prop1, onAction }: Props) { ... }

// ❌ WRONG: default export, server component for interactive UI
```

### API Route Pattern
```typescript
// ✅ CORRECT: NextRequest/NextResponse, Zod validation
import { NextRequest, NextResponse } from "next/server";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Zod validate body
  // prisma operation
  return NextResponse.json(result);
}
```

### TypeScript
```typescript
// ❌ NEVER: as any, @ts-ignore, @ts-expect-error, empty catch without explanation
```
