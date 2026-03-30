"use client";

import { useState } from "react";
import { Plus, FileText, Trash2, Search } from "lucide-react";
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
}

export function LessonList({ lessons, selectedLessonId, onSelect, onAddLesson, onDelete }: LessonListProps) {
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = lessons.filter(l => normalize(l.title).includes(normalize(searchQuery)));
  const isFiltering = searchQuery.trim().length > 0;

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
          ) : (
            <ScrollArea className="flex-1">
              <ul className="flex flex-col gap-0.5">
                {filtered.map((lesson) => {
                  const isSelected = selectedLessonId === lesson.id;
                  return (
                    <li
                      key={lesson.id}
                      onClick={() => onSelect(lesson)}
                      className={`group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? "bg-[#A435F0]/10"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      }`}
                    >
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
                })}
              </ul>
            </ScrollArea>
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
