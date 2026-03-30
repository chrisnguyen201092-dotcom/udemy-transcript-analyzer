"use client";

import { Trash2, BookOpen } from "lucide-react";
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

interface Course {
  id: string;
  url: string;
  title: string;
  lessons: Lesson[];
  createdAt: string;
}

interface CourseListProps {
  courses: Course[];
  selectedCourseId: string | null;
  onSelect: (course: Course) => void;
  onDelete: (id: string) => void;
}

export function CourseList({ courses, selectedCourseId, onSelect, onDelete }: CourseListProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
        Courses {courses.length > 0 && <span className="font-normal normal-case tracking-normal">({courses.length})</span>}
      </p>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-gray-400 dark:text-gray-500">
          <BookOpen className="w-6 h-6 opacity-30" />
          <p className="text-xs">Chưa có course nào</p>
        </div>
      ) : (
        <ScrollArea className="max-h-64">
          <ul className="flex flex-col gap-0.5">
            {courses.map((course) => {
              const isSelected = selectedCourseId === course.id;
              return (
                <li
                  key={course.id}
                  onClick={() => onSelect(course)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors duration-100 ${
                    isSelected
                      ? "bg-[#A435F0]/10 text-[#A435F0]"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isSelected ? "text-[#A435F0]" : "text-gray-800 dark:text-gray-200"}`}>
                      {course.title}
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {course.lessons.length} bài học
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger
                      className="h-6 w-6 shrink-0 ml-1 opacity-0 group-hover:opacity-100 cursor-pointer text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-md transition-all flex items-center justify-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="w-3 h-3" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xóa course?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Hành động này không thể hoàn tác. Course &ldquo;{course.title}&rdquo; và tất cả bài học sẽ bị xóa vĩnh viễn.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Huỷ</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(course.id)}
                          className="bg-red-600 hover:bg-red-700 cursor-pointer"
                        >
                          Xóa
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      )}
    </div>
  );
}
