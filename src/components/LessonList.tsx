"use client";

import { useState } from "react";
import { Plus, FileText, Trash2, Search, GripVertical } from "lucide-react";
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
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
}

function SortableLessonItem({
  lesson,
  isSelected,
  onSelect,
  onDelete,
}: {
  lesson: Lesson;
  isSelected: boolean;
  onSelect: (lesson: Lesson) => void;
  onDelete?: (lessonId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(lesson)}
      className={`group flex items-start gap-1 px-1.5 py-2 rounded-lg cursor-pointer transition-colors duration-100 ${
        isSelected
          ? "bg-[#A435F0]/10"
          : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <button
        type="button"
        className="mt-0.5 shrink-0 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3" />
      </button>

      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 w-4 shrink-0 font-mono tabular-nums">
        {lesson.order}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium leading-snug ${isSelected ? "text-[#A435F0]" : "text-gray-800 dark:text-gray-200"}`}>
          {lesson.title}
        </p>
        <p className={`text-[10px] mt-0.5 ${lesson.transcript ? "text-emerald-600" : "text-gray-400 dark:text-gray-500"}`}>
          {lesson.transcript ? "Có transcript" : "Chưa có transcript"}
        </p>
      </div>

      {onDelete && (
        <AlertDialog>
          <AlertDialogTrigger
            className="h-6 w-6 shrink-0 ml-1 opacity-0 group-hover:opacity-100 cursor-pointer text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-md transition-all flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-3 h-3" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xóa bài học?</AlertDialogTitle>
              <AlertDialogDescription>
                Hành động này không thể hoàn tác. Bài học &ldquo;{lesson.title}&rdquo; sẽ bị xóa vĩnh viễn.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">Huỷ</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => onDelete(lesson.id)}
                className="bg-red-600 hover:bg-red-700 cursor-pointer"
              >
                Xóa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </li>
  );
}

export function LessonList({ lessons, selectedLessonId, onSelect, onAddLesson, onDelete, onReorder }: LessonListProps) {
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = lessons.filter(l => normalize(l.title).includes(normalize(searchQuery)));
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
        Bài học {lessons.length > 0 && <span className="font-normal normal-case tracking-normal">({filtered.length}/{lessons.length})</span>}
      </p>

      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-5 gap-1.5 text-gray-400 dark:text-gray-500">
          <FileText className="w-5 h-5 opacity-30" />
          <p className="text-xs">Chưa có bài học nào</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm bài học..."
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
                {filtered.map((lesson) => (
                  <SortableLessonItem
                    key={lesson.id}
                    lesson={lesson}
                    isSelected={selectedLessonId === lesson.id}
                    onSelect={onSelect}
                    onDelete={onDelete}
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
                    {lessons.map((lesson) => (
                      <SortableLessonItem
                        key={lesson.id}
                        lesson={lesson}
                        isSelected={selectedLessonId === lesson.id}
                        onSelect={onSelect}
                        onDelete={onDelete}
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
          placeholder="Tên bài học..."
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
    </div>
  );
}
