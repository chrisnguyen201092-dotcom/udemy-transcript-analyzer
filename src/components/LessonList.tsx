"use client";

import { useState } from "react";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

export function LessonList({ lessons, selectedLessonId, onSelect, onAddLesson }: LessonListProps) {
  const [newLessonTitle, setNewLessonTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newLessonTitle.trim();
    if (!trimmed) return;
    onAddLesson(trimmed);
    setNewLessonTitle("");
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-1">
        Bài học {lessons.length > 0 && <span className="font-normal normal-case tracking-normal">({lessons.length})</span>}
      </p>

      {lessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-5 gap-1.5 text-gray-400">
          <FileText className="w-5 h-5 opacity-30" />
          <p className="text-xs">Chưa có bài học nào</p>
        </div>
      ) : (
        <ScrollArea className="max-h-64">
          <ul className="flex flex-col gap-0.5">
            {lessons.map((lesson) => {
              const isSelected = selectedLessonId === lesson.id;
              return (
                <li
                  key={lesson.id}
                  onClick={() => onSelect(lesson)}
                  className={`flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors duration-100 ${
                    isSelected
                      ? "bg-[#A435F0]/10"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <span className="text-[10px] text-gray-400 mt-0.5 w-4 shrink-0 font-mono tabular-nums">
                    {lesson.order}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${isSelected ? "text-[#A435F0]" : "text-gray-800"}`}>
                      {lesson.title}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${lesson.transcript ? "text-emerald-600" : "text-gray-400"}`}>
                      {lesson.transcript ? "Có transcript" : "Chưa có transcript"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}

      <form onSubmit={handleSubmit} className="flex gap-1.5 pt-1">
        <Input
          value={newLessonTitle}
          onChange={(e) => setNewLessonTitle(e.target.value)}
          placeholder="Tên bài học..."
          className="flex-1 text-xs h-7 border-gray-200 focus-visible:ring-[#A435F0]/30"
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
