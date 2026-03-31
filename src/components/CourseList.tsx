"use client";

import { useState, useRef } from "react";
import { Trash2, BookOpen, Search, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  contentType: string;
  author?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  lessons: Lesson[];
  createdAt: string;
}

interface CourseListProps {
  courses: Course[];
  loading?: boolean;
  selectedCourseId: string | null;
  onSelect: (course: Course) => void;
  onDelete: (id: string) => void;
  onRename?: (id: string, newTitle: string) => void;
  courseProgressMap?: Record<string, number>;
}

export function CourseList({ courses, loading, selectedCourseId, onSelect, onDelete, onRename, courseProgressMap }: CourseListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  // M-15: Prevent double rename when Enter triggers blur
  const isSubmittingRef = useRef(false);

  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filtered = courses.filter(c => normalize(c.title).includes(normalize(searchQuery)));
  const isFiltering = searchQuery.trim().length > 0;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
        Courses {courses.length > 0 && <span className="font-normal normal-case tracking-normal">({filtered.length}/{courses.length})</span>}
      </p>

      {loading ? (
        <div className="flex flex-col gap-2 px-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5 px-2.5 py-2">
              <Skeleton className="h-3.5 w-[85%]" />
              <Skeleton className="h-2.5 w-12" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 gap-1.5 text-gray-400 dark:text-gray-500">
          <BookOpen className="w-6 h-6 opacity-30" />
          <p className="text-xs">Chưa có khóa học / sách nào</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm courses..."
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
                {filtered.map((course) => {
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
                        {editingId === course.id ? (
                          <Input
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const trimmed = editTitle.trim();
                                if (trimmed && trimmed !== course.title && onRename) {
                                  // M-15: Mark submitting to prevent blur from double-firing
                                  isSubmittingRef.current = true;
                                  onRename(course.id, trimmed);
                                }
                                setEditingId(null);
                                isSubmittingRef.current = false;
                              } else if (e.key === "Escape") {
                                setEditingId(null);
                              }
                            }}
                            onBlur={() => {
                              // M-15: Skip if Enter already handled rename
                              if (isSubmittingRef.current) return;
                              const trimmed = editTitle.trim();
                              if (trimmed && trimmed !== course.title && onRename) {
                                onRename(course.id, trimmed);
                              }
                              setEditingId(null);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="text-xs h-6 px-1.5 border-[#A435F0]/30 focus-visible:ring-[#A435F0]/30"
                          />
                        ) : (
                          <p className={`text-xs font-medium truncate ${isSelected ? "text-[#A435F0]" : "text-gray-800 dark:text-gray-200"}`}>
                            {course.title}
                            {course.contentType === "book" && (
                              <span className="inline-flex items-center ml-1 px-1 py-0.5 rounded text-[9px] font-medium bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">📖</span>
                            )}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {course.lessons.length} {course.contentType === "book" ? "chương" : "bài học"}
                        </p>
                        {course.contentType === "book" && course.author && (
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">{course.author}</p>
                        )}
                        {(() => {
                          const progressPct = courseProgressMap?.[course.id];
                          if (progressPct === undefined || progressPct === null) return null;
                          return (
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
                          );
                        })()}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        {onRename && editingId !== course.id && (
                          <button
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 cursor-pointer text-gray-400 hover:text-[#A435F0] hover:bg-[#A435F0]/5 rounded-md transition-all flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(course.id);
                              setEditTitle(course.title);
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 cursor-pointer text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-md transition-all flex items-center justify-center"
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
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </>
      )}
    </div>
  );
}
