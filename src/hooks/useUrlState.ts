"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

interface UrlState {
  courseId: string | null;
  lessonId: string | null;
  tab: string | null;
}

/**
 * Syncs app navigation state (course, lesson, tab) with URL search params.
 * Supports browser Back/Forward, bookmarking, and sharing.
 *
 * Usage:
 *   const { state, setCourseId, setLessonId, setTab, setAll } = useUrlState();
 */
export function useUrlState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state: UrlState = useMemo(
    () => ({
      courseId: searchParams.get("course"),
      lessonId: searchParams.get("lesson"),
      tab: searchParams.get("tab"),
    }),
    [searchParams]
  );

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const setCourseId = useCallback(
    (courseId: string | null) => {
      // When changing course, clear lesson and tab
      updateParams({ course: courseId, lesson: null, tab: null });
    },
    [updateParams]
  );

  const setLessonId = useCallback(
    (lessonId: string | null) => {
      updateParams({ lesson: lessonId });
    },
    [updateParams]
  );

  const setTab = useCallback(
    (tab: string | null) => {
      updateParams({ tab });
    },
    [updateParams]
  );

  const setAll = useCallback(
    (courseId: string | null, lessonId: string | null, tab: string | null) => {
      updateParams({ course: courseId, lesson: lessonId, tab });
    },
    [updateParams]
  );

  return { state, setCourseId, setLessonId, setTab, setAll };
}
