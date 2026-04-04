/**
 * use-course-navigation — course/lesson selection, URL sync, progress tracking,
 * study-time accounting, and lesson navigation (prev/next).
 *
 * All CRUD mutations are delegated to use-course-crud.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { Course, Lesson, CourseProgress, LessonProgressEntry } from "@/types/course";
import { useCourseCrud, type UseCourseCrudReturn } from "@/hooks/use-course-crud";

export interface UseCourseNavigationReturn extends UseCourseCrudReturn {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  coursesLoading: boolean;
  fetchCourses: (signal?: AbortSignal) => Promise<void>;
  selectedCourse: Course | null;
  setSelectedCourse: React.Dispatch<React.SetStateAction<Course | null>>;
  selectedLesson: Lesson | null;
  setSelectedLesson: React.Dispatch<React.SetStateAction<Lesson | null>>;
  courseProgress: CourseProgress | null;
  setCourseProgress: React.Dispatch<React.SetStateAction<CourseProgress | null>>;
  lessonProgressMap: Record<string, LessonProgressEntry>;
  setLessonProgressMap: React.Dispatch<React.SetStateAction<Record<string, LessonProgressEntry>>>;
  saveStudyTime: (lessonId: string) => void;
  lessonStartTimeRef: React.MutableRefObject<number>;
  timeSavedForLessonRef: React.MutableRefObject<string | null>;
  resetLessonTimer: () => void;
  navigateLesson: (direction: "prev" | "next", onSelect: (lesson: Lesson) => void) => void;
}

export function useCourseNavigation(): UseCourseNavigationReturn {
  const searchParams = useSearchParams();

  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null);
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, LessonProgressEntry>>({});

  // Capture courseId once at mount — searchParams object is unstable across renders
  const initialCourseIdRef = useRef(searchParams.get("courseId"));

  const lessonStartTimeRef = useRef<number>(Date.now());
  const selectedLessonRef = useRef<Lesson | null>(null);
  const timeSavedForLessonRef = useRef<string | null>(null);

  // Keep ref in sync for pagehide handler (avoids stale closure)
  useEffect(() => {
    selectedLessonRef.current = selectedLesson;
  }, [selectedLesson]);

  // C-15: Save study time on page close via sendBeacon (survives unload)
  useEffect(() => {
    const handlePageHide = () => {
      const lesson = selectedLessonRef.current;
      if (!lesson) return;
      if (timeSavedForLessonRef.current === lesson.id) return; // H-11: guard double-count
      const deltaMs = Date.now() - lessonStartTimeRef.current;
      if (deltaMs <= 5000) return;
      navigator.sendBeacon(
        `/api/lessons/${lesson.id}/progress`,
        new Blob([JSON.stringify({ deltaTimeMs: deltaMs })], { type: "application/json" })
      );
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  // H-11: Fire-and-forget study time save, guards < 5s and double-count
  const saveStudyTime = useCallback((lessonId: string) => {
    const deltaMs = Date.now() - lessonStartTimeRef.current;
    if (deltaMs <= 5000) return;
    timeSavedForLessonRef.current = lessonId;
    fetch(`/api/lessons/${lessonId}/progress`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deltaTimeMs: deltaMs }),
    }).catch(() => {});
  }, []);

  const resetLessonTimer = useCallback(() => {
    lessonStartTimeRef.current = Date.now();
    timeSavedForLessonRef.current = null;
  }, []);

  const fetchCourses = useCallback(async (signal?: AbortSignal) => {
    setCoursesLoading(true);
    try {
      const res = await fetch("/api/courses?include=lessons", { signal });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) { toast.error("Lỗi khi tải danh sách courses"); return; }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setCourses(list);
      const courseId = initialCourseIdRef.current;
      if (courseId) {
        setSelectedCourse((current) => {
          if (current) return current;
          return list.find((c: Course) => c.id === courseId) ?? null;
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("Lỗi khi tải danh sách courses");
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchCourses(controller.signal);
    return () => controller.abort();
  }, [fetchCourses]);

  // Load progress when selected course changes
  useEffect(() => {
    if (!selectedCourse) { setCourseProgress(null); setLessonProgressMap({}); return; }
    const controller = new AbortController();
    const loadProgress = async () => {
      try {
        const res = await fetch(`/api/courses/${selectedCourse.id}/progress`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (data.courseProgress) {
          setCourseProgress({
            completionPct: data.courseProgress.completionPct,
            currentStreak: data.courseProgress.currentStreak,
            longestStreak: data.courseProgress.longestStreak,
            totalTimeSpentMs: data.courseProgress.totalTimeSpentMs,
          });
        }
        if (data.lessonsProgress) {
          const map: Record<string, LessonProgressEntry> = {};
          for (const lp of data.lessonsProgress) {
            map[lp.lessonId] = { completed: lp.completed, quizScore: lp.quizScore ?? null };
          }
          setLessonProgressMap(map);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        /* Silently fail */
      }
    };
    loadProgress();
    return () => controller.abort();
  }, [selectedCourse]);

  const navigateLesson = useCallback(
    (direction: "prev" | "next", onSelect: (lesson: Lesson) => void) => {
      if (!selectedCourse || !selectedLesson) return;
      const lessons = selectedCourse.lessons;
      const idx = lessons.findIndex((l) => l.id === selectedLesson.id);
      if (idx === -1) return;
      const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < lessons.length) onSelect(lessons[nextIdx]);
    },
    [selectedCourse, selectedLesson]
  );

  // Delegate all CRUD to use-course-crud
  const crud = useCourseCrud({
    setCourses,
    setSelectedCourse,
    setSelectedLesson,
    fetchCourses,
    progressSetters: { setLessonProgressMap, setCourseProgress },
  });

  return {
    courses, setCourses, coursesLoading, fetchCourses,
    selectedCourse, setSelectedCourse,
    selectedLesson, setSelectedLesson,
    courseProgress, setCourseProgress,
    lessonProgressMap, setLessonProgressMap,
    saveStudyTime, lessonStartTimeRef, timeSavedForLessonRef, resetLessonTimer,
    navigateLesson,
    ...crud,
  };
}
