"use client";

import { Layers } from "lucide-react";
import { AddCoursePanel } from "@/components/AddCoursePanel";
import { CourseList } from "@/components/CourseList";
import { LessonList } from "@/components/LessonList";
import { OnboardingCard } from "@/components/OnboardingCard";
import type { Course, Lesson, CourseProgress, LessonProgressEntry } from "@/types/course";

interface CourseSidebarProps {
  // Course list
  courses: Course[];
  coursesLoading: boolean;
  selectedCourse: Course | null;
  selectedLesson: Lesson | null;
  // Progress
  courseProgress: CourseProgress | null;
  lessonProgressMap: Record<string, LessonProgressEntry>;
  // UI state
  showCollection: boolean;
  // Course actions
  onSelectCourse: (course: Course) => void;
  onDeleteCourse: (id: string) => void;
  onRenameCourse: (id: string, newTitle: string) => void;
  onAddManualCourse: (title: string) => void;
  // Lesson actions
  onSelectLesson: (lesson: Lesson) => void;
  onAddLesson: (title: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onReorderLessons: (lessonIds: string[]) => void;
  onToggleLessonComplete: (lessonId: string, completed: boolean) => void;
  onMergeLessons: (lessonId1: string, lessonId2: string) => Promise<void>;
  onSplitLesson: (lessonId: string, splitIndex: number, newTitle: string) => Promise<void>;
  onReSplit: () => Promise<void>;
  // Modal triggers
  onOpenSettings: () => void;
  onToggleCollection: () => void;
}

/**
 * Left sidebar: course list, lesson list, progress, and collection toggle.
 */
export function CourseSidebar({
  courses,
  coursesLoading,
  selectedCourse,
  selectedLesson,
  courseProgress,
  lessonProgressMap,
  showCollection,
  onSelectCourse,
  onDeleteCourse,
  onRenameCourse,
  onAddManualCourse,
  onSelectLesson,
  onAddLesson,
  onDeleteLesson,
  onReorderLessons,
  onToggleLessonComplete,
  onMergeLessons,
  onSplitLesson,
  onReSplit,
  onOpenSettings,
  onToggleCollection,
}: CourseSidebarProps) {
  return (
    <aside className="w-[272px] shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-y-auto bg-white dark:bg-gray-900">
      <div className="flex flex-col gap-5 p-4 pb-8">
        <AddCoursePanel
          onAddManual={onAddManualCourse}
        />

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        <CourseList
          courses={courses}
          loading={coursesLoading}
          selectedCourseId={selectedCourse?.id ?? null}
          onSelect={onSelectCourse}
          onDelete={onDeleteCourse}
          onRename={onRenameCourse}
          courseProgressMap={
            courseProgress && selectedCourse
              ? { [selectedCourse.id]: courseProgress.completionPct }
              : {}
          }
        />

        {courses.length === 0 && !coursesLoading && (
          <OnboardingCard
            onAddManual={() => onAddManualCourse("Khóa học mới")}
          />
        )}

        {selectedCourse && (
          <>
            <div className="h-px bg-gray-100 dark:bg-gray-800" />

            {/* Streak display */}
            {courseProgress && courseProgress.currentStreak > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5">
                <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <span>🔥</span>
                  <span className="font-medium">{courseProgress.currentStreak} ngày liên tiếp</span>
                </div>
                {courseProgress.longestStreak > courseProgress.currentStreak && (
                  <span className="text-[10px] text-gray-400">
                    Kỷ lục: {courseProgress.longestStreak}
                  </span>
                )}
              </div>
            )}

            {/* Progress bar */}
            {courseProgress && courseProgress.completionPct > 0 && (
              <div className="px-3 pb-1">
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                  <span>Tiến độ</span>
                  <span>{Math.round(courseProgress.completionPct)}%</span>
                </div>
                <div className="w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#A435F0] rounded-full transition-all duration-500"
                    style={{ width: `${courseProgress.completionPct}%` }}
                  />
                </div>
              </div>
            )}

            <LessonList
              lessons={selectedCourse.lessons}
              selectedLessonId={selectedLesson?.id ?? null}
              onSelect={onSelectLesson}
              onAddLesson={onAddLesson}
              onDelete={onDeleteLesson}
              onReorder={onReorderLessons}
              progressMap={lessonProgressMap}
              onToggleComplete={onToggleLessonComplete}
              onMerge={onMergeLessons}
              onSplit={onSplitLesson}
              onReSplit={onReSplit}
              contentType={selectedCourse.contentType}
            />

            {/* Collection toggle button */}
            <button
              type="button"
              onClick={onToggleCollection}
              className={`flex items-center gap-2 px-3 py-2 mt-2 text-xs font-medium rounded-lg transition-colors cursor-pointer w-full ${
                showCollection
                  ? "bg-[#A435F0] text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Bộ sưu tập
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
