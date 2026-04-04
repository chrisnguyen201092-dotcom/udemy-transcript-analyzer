"use client";

import { useState } from "react";
import { Plus, FileText, Search, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";
import { getLabels } from "@/lib/content-type-labels";
import { normalizeText } from "@/lib/string-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { SortableLessonItem } from "@/components/SortableLessonItem";

interface Lesson {
  id: string;
  title: string;
  order: number;
  transcript: string | null;
}

interface LessonListProps {
  lessons: Lesson[];
  selectedLessonId: string | null;
  onSelect: (lesson: Lesson) => void;
  onAddLesson: (title: string) => void;
  onDelete?: (lessonId: string) => void;
  onReorder?: (lessonIds: string[]) => void;
  progressMap?: Record<string, { completed: boolean }>;
  onToggleComplete?: (lessonId: string, completed: boolean) => void;
  /** When provided, shows a "Re-split" button for book courses. */
  onReSplit?: () => Promise<void>;
  /** Merge two adjacent lessons into one. */
  onMerge?: (lessonId1: string, lessonId2: string) => Promise<void>;
  /** Split a lesson at the given character index. */
  onSplit?: (lessonId: string, splitIndex: number, newTitle: string) => Promise<void>;
  /** Course content type — merge/split/re-split buttons only show for 'book'. */
  contentType?: string;
}

export function LessonList({ lessons, selectedLessonId, onSelect, onAddLesson, onDelete, onReorder, progressMap, onToggleComplete, onReSplit, onMerge, onSplit, contentType }: LessonListProps) {
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [reSplitLoading, setReSplitLoading] = useState(false);

  const filtered = lessons.filter(l => normalizeText(l.title).includes(normalizeText(searchQuery)));
  const isFiltering = searchQuery.trim().length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(lessons, oldIndex, newIndex);
    onReorder(reordered.map((l) => l.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLessonTitle.trim();
    if (!trimmed) return;
    onAddLesson(trimmed);
    setNewLessonTitle("");
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
        {getLabels(contentType).lesson} {lessons.length > 0 && <span className="font-normal normal-case tracking-normal">({filtered.length}/{lessons.length})</span>}
      </p>

      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-5 gap-1.5 text-gray-400 dark:text-gray-500">
          <FileText className="w-5 h-5 opacity-30" />
          <p className="text-xs">{getLabels(contentType).noLessons}</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={getLabels(contentType).searchPlaceholder}
              className="text-xs h-7 pl-7 border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
            />
          </div>

          {isFiltering && filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-gray-400 dark:text-gray-500">
              <p className="text-xs">Không tìm thấy</p>
            </div>
          ) : isFiltering ? (
            // When filtering, don't show DnD — just a plain list
            <ScrollArea className="flex-1">
              <ul className="flex flex-col gap-0.5">
                {filtered.map((lesson, i) => (
                  <SortableLessonItem
                    key={lesson.id}
                    lesson={lesson}
                    isSelected={selectedLessonId === lesson.id}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    progressMap={progressMap}
                    onToggleComplete={onToggleComplete}
                    nextLesson={filtered[i + 1]}
                    onMerge={onMerge}
                    onSplit={onSplit}
                    contentType={contentType}
                  />
                ))}
              </ul>
            </ScrollArea>
          ) : (
            // Full list with DnD
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <ScrollArea className="flex-1">
                  <ul className="flex flex-col gap-0.5">
                    {lessons.map((lesson, i) => (
                      <SortableLessonItem
                        key={lesson.id}
                        lesson={lesson}
                        isSelected={selectedLessonId === lesson.id}
                        onSelect={onSelect}
                        onDelete={onDelete}
                        progressMap={progressMap}
                        onToggleComplete={onToggleComplete}
                        nextLesson={lessons[i + 1]}
                        onMerge={onMerge}
                        onSplit={onSplit}
                        contentType={contentType}
                      />
                    ))}
                  </ul>
                </ScrollArea>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      <form onSubmit={handleSubmit} className="flex gap-1.5 pt-1">
        <Input
          value={newLessonTitle}
          onChange={(e) => setNewLessonTitle(e.target.value)}
          placeholder={getLabels(contentType).lessonPlaceholder}
          className="flex-1 text-xs h-7 border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!newLessonTitle.trim()}
          className="h-7 w-7 p-0 cursor-pointer bg-[#A435F0] hover:bg-[#8710D8] shrink-0"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </form>

      {onReSplit && contentType === "book" && lessons.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger
            className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-md transition-colors cursor-pointer w-full mt-1"
          >
            <RefreshCw className="w-3 h-3" />
            Chia lại chương
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Chia lại chương?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tất cả <strong>{lessons.length}</strong> bài học hiện tại sẽ bị xóa, bao gồm tiến độ học, ghi chú, quiz và lịch sử chat. Bạn sẽ cần chia chương lại từ đầu.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">Huỷ</AlertDialogCancel>
              <AlertDialogAction
                disabled={reSplitLoading}
                onClick={async () => {
                  setReSplitLoading(true);
                  try {
                    await onReSplit();
                  } finally {
                    setReSplitLoading(false);
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 cursor-pointer"
              >
                {reSplitLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Đang xóa...
                  </>
                ) : (
                  "Xóa và chia lại"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
