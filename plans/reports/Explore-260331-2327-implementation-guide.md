# IMPLEMENTATION GUIDE: Merge & Split Chapters

## EXISTING PATTERNS TO FOLLOW

### 1. Reorder Pattern (BEST REFERENCE)
**File:** `src/app/api/courses/[id]/lessons/reorder/route.ts`

```typescript
// 1. Input validation with Zod
const ReorderSchema = z.object({
  lessonIds: z.array(z.string().min(1)).min(1),
});

// 2. Atomic update with Prisma $transaction
await prisma.$transaction(
  lessonIds.map((lessonId, index) =>
    prisma.lesson.update({
      where: { id: lessonId },
      data: { order: index + 1 },
    })
  )
);
```

**Frontend:** `src/app/page.tsx` handleReorderLessons()
```typescript
// 1. Optimistic update
const reorderedLessons = lessonIds.map((id, index) => ({
  ...lesson, order: index + 1
}));
const previousLessons = selectedCourse.lessons;
setSelectedCourse({ ...selectedCourse, lessons: reorderedLessons });

// 2. API call
const res = await fetch(`/api/courses/${id}/lessons/reorder`, {
  method: "PATCH",
  body: JSON.stringify({ lessonIds }),
});

// 3. Error handling (revert)
if (!res.ok) {
  setSelectedCourse({ ...selectedCourse, lessons: previousLessons });
}
```

### 2. Delete Pattern
**API:** Cascading delete with Prisma
```typescript
await prisma.lesson.delete({ where: { id } });
// Automatically deletes:
// - LessonProgress (cascade)
// - FlashcardReview (cascade)
// - ChatMessage (cascade)
```

### 3. Add Pattern
**Creates with auto-incremented order**
```typescript
const lastLesson = await prisma.lesson.findFirst({
  where: { courseId: id },
  orderBy: { order: "desc" },
});

const lesson = await prisma.lesson.create({
  data: {
    courseId: id,
    title,
    transcript,
    order: (lastLesson?.order || 0) + 1,
  },
});
```

---

## SPLIT ENDPOINT DESIGN

### API: POST /api/lessons/{id}/split

**Input:**
```typescript
interface SplitRequest {
  splitPoints: Array<{
    position: number;  // Character position in transcript, OR
    atKeyword?: string;  // Split at keyword/pattern
    title?: string;    // Custom title for new lesson
  }>;
}
```

**Output:**
```typescript
interface SplitResponse {
  lessons: Lesson[];  // Original (modified) + new lessons
}
```

**Implementation:**
```typescript
export async function POST(req, { params: { id } }) {
  const { splitPoints } = SplitSchema.parse(await req.json());
  
  // 1. Fetch original lesson
  const original = await prisma.lesson.findUnique({ where: { id } });
  
  // 2. Get course for context
  const course = await prisma.course.findUnique({
    where: { id: original.courseId },
    include: { lessons: true },
  });
  
  // 3. Split transcript into segments
  const segments = splitTranscript(original.transcript, splitPoints);
  
  // 4. Transaction: Update original + create new lessons
  const results = await prisma.$transaction(async (tx) => {
    // Update original lesson (first segment)
    const updated = await tx.lesson.update({
      where: { id },
      data: { transcript: segments[0].content },
    });
    
    // Find max order
    const maxOrder = Math.max(...course.lessons.map(l => l.order));
    
    // Create new lessons
    const created = [];
    for (let i = 1; i < segments.length; i++) {
      const newLesson = await tx.lesson.create({
        data: {
          courseId: original.courseId,
          title: segments[i].title || `${original.title} (Part ${i + 1})`,
          transcript: segments[i].content,
          order: maxOrder + i,
          chapterNumber: original.chapterNumber,
        },
      });
      created.push(newLesson);
    }
    
    return [updated, ...created];
  });
  
  return NextResponse.json({ lessons: results });
}
```

**Helper:**
```typescript
function splitTranscript(
  transcript: string,
  splitPoints: Array<{ position: number } | { atKeyword: string }>
) {
  const segments = [];
  let lastPos = 0;
  
  const positions = splitPoints
    .map(sp => 'position' in sp ? sp.position : transcript.indexOf(sp.atKeyword))
    .filter(p => p > 0)
    .sort((a, b) => a - b);
  
  for (const pos of positions) {
    segments.push(transcript.slice(lastPos, pos).trim());
    lastPos = pos;
  }
  segments.push(transcript.slice(lastPos).trim());
  
  return segments.map(content => ({ content, title: null }));
}
```

---

## MERGE ENDPOINT DESIGN

### API: POST /api/courses/{id}/lessons/merge

**Input:**
```typescript
interface MergeRequest {
  lessonIds: string[];  // Ordered list of lessons to merge
}
```

**Output:**
```typescript
interface MergeResponse {
  lesson: Lesson;  // The merged lesson
}
```

**Implementation:**
```typescript
export async function POST(req, { params: { id } }) {
  const { lessonIds } = MergeSchema.parse(await req.json());
  
  // 1. Fetch lessons in order
  const lessons = await prisma.lesson.findMany({
    where: { id: { in: lessonIds } },
  });
  
  // Sort by original order
  const orderedLessons = lessonIds.map(id =>
    lessons.find(l => l.id === id)
  ).filter(Boolean);
  
  // 2. Concatenate transcripts
  const mergedTranscript = orderedLessons
    .map(l => l.transcript || "")
    .filter(t => t.length > 0)
    .join("

---

");
  
  // 3. Transaction
  const result = await prisma.$transaction(async (tx) => {
    // Update first lesson with merged content
    const merged = await tx.lesson.update({
      where: { id: lessonIds[0] },
      data: {
        transcript: mergedTranscript,
        title: `${orderedLessons[0].title} (Merged)`,
      },
    });
    
    // Delete other lessons
    await tx.lesson.deleteMany({
      where: { id: { in: lessonIds.slice(1) } },
    });
    
    // Get remaining lessons for reordering
    const remaining = await tx.lesson.findMany({
      where: { courseId: id },
      orderBy: { order: "asc" },
    });
    
    // Reorder all
    for (let i = 0; i < remaining.length; i++) {
      await tx.lesson.update({
        where: { id: remaining[i].id },
        data: { order: i + 1 },
      });
    }
    
    return merged;
  });
  
  return NextResponse.json({ lesson: result });
}
```

---

## FRONTEND HANDLERS (page.tsx)

### handleMergeLessons(lessonIds: string[])
```typescript
const handleMergeLessons = async (lessonIds: string[]) => {
  if (!selectedCourse) return;
  
  // Optimistic update
  const merged = selectedCourse.lessons.filter(l => !lessonIds.includes(l.id));
  const mergedLesson = selectedCourse.lessons.find(l => l.id === lessonIds[0]);
  if (mergedLesson) {
    merged.unshift({ ...mergedLesson, title: `${mergedLesson.title} (Merged)` });
    merged.sort((a, b) => a.order - b.order);
  }
  
  const previousLessons = selectedCourse.lessons;
  setSelectedCourse({ ...selectedCourse, lessons: merged });
  
  try {
    const res = await fetch(`/api/courses/${selectedCourse.id}/lessons/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonIds }),
    });
    
    if (!res.ok) throw new Error("Merge failed");
    const data = await res.json();
    
    // Refresh with server response
    const updated = selectedCourse.lessons.map(l =>
      l.id === data.lesson.id ? data.lesson : l
    ).filter(l => !lessonIds.slice(1).includes(l.id));
    
    setSelectedCourse({ ...selectedCourse, lessons: updated });
    toast.success("Đã gộp bài học");
  } catch (error) {
    setSelectedCourse({ ...selectedCourse, lessons: previousLessons });
    toast.error("Lỗi khi gộp bài học");
  }
};
```

### handleSplitLesson(lessonId: string, splitPoints: any[])
```typescript
const handleSplitLesson = async (lessonId: string, splitPoints: any[]) => {
  if (!selectedCourse) return;
  
  const lesson = selectedCourse.lessons.find(l => l.id === lessonId);
  if (!lesson) return;
  
  const previousLessons = selectedCourse.lessons;
  
  // Optimistic: replace 1 lesson with N placeholders
  const newLessons = [
    { ...lesson, title: `${lesson.title} (Part 1)` },
    ...splitPoints.map((_, i) => ({
      id: `temp-${i}`,
      courseId: selectedCourse.id,
      title: `${lesson.title} (Part ${i + 2})`,
      order: lesson.order + i + 1,
      transcript: null,
    })),
  ];
  
  setSelectedCourse({
    ...selectedCourse,
    lessons: selectedCourse.lessons.map(l =>
      l.id === lessonId ? newLessons[0] : l
    ).concat(newLessons.slice(1)),
  });
  
  try {
    const res = await fetch(`/api/lessons/${lessonId}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ splitPoints }),
    });
    
    if (!res.ok) throw new Error("Split failed");
    const data = await res.json();
    
    // Refresh with real lessons
    const allIds = new Set([...previousLessons.map(l => l.id), ...data.lessons.map(l => l.id)]);
    const updated = previousLessons
      .filter(l => !allIds.has(lessonId) || data.lessons.find(nl => nl.id === l.id))
      .concat(data.lessons.filter(l => !previousLessons.find(pl => pl.id === l.id)));
    
    setSelectedCourse({ ...selectedCourse, lessons: updated });
    toast.success("Đã tách bài học");
  } catch (error) {
    setSelectedCourse({ ...selectedCourse, lessons: previousLessons });
    toast.error("Lỗi khi tách bài học");
  }
};
```

---

## UI INTEGRATION (LessonList.tsx)

Add buttons to \`SortableLessonItem\`:
```typescript
{onMerge && (
  <button onClick={() => onMerge(lesson.id)} title="Merge with next">
    <Combine className="w-3 h-3" />
  </button>
)}

{onSplit && (
  <button onClick={() => onSplit(lesson.id)} title="Split lesson">
    <Split className="w-3 h-3" />
  </button>
)}
```

Pass handlers from page.tsx:
```typescript
<LessonList
  onMerge={handleMergeLessons}
  onSplit={handleSplitLesson}
  // ... other props
/>
```

---

## TESTING CHECKLIST

- [ ] Split with 0, 1, 2+ split points
- [ ] Merge 2, 3+ lessons
- [ ] Optimistic update works
- [ ] Error handling reverts state
- [ ] Order numbers are sequential after split/merge
- [ ] LessonProgress is handled (cascading delete on split?)
- [ ] Flashcards are handled
- [ ] Chat history is preserved or deleted appropriately
- [ ] Re-split still works after merge/split
