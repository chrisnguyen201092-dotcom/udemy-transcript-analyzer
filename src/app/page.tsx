"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { AddCoursePanel } from "@/components/AddCoursePanel";
import { CourseList } from "@/components/CourseList";
import { LessonList } from "@/components/LessonList";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { AIAssistantPanel } from "@/components/AIAssistantPanel";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import {
  SettingsModal,
  type SettingsStore,
  type AIProfile,
  activeProfile,
  loadStore,
  saveStore,
} from "@/components/SettingsModal";
import { ImportModal } from "@/components/ImportModal";
import { UploadModal } from "@/components/UploadModal";
import { OnboardingCard } from "@/components/OnboardingCard";
import { CollectionPanel } from "@/components/CollectionPanel";
import { Layers } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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

interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  udemyCookie: string;
}

interface UdemyCourse {
  id: number;
  title: string;
  url: string;
  num_lectures: number;
}

function HomeContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Multi-profile store
  // Initialize with a stable server-safe default to avoid hydration mismatch,
  // then hydrate from localStorage after mount.
  const [store, setStore] = useState<SettingsStore>({ profiles: [], activeId: "" });
  const [storeMounted, setStoreMounted] = useState(false);

  // Chat leave warning state
  const [chatMessageCount, setChatMessageCount] = useState(0);
  const [transcriptDirty, setTranscriptDirty] = useState(false);
  const [pendingLesson, setPendingLesson] = useState<Lesson | null>(null);
  const [showLessonWarning, setShowLessonWarning] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);
  const [showCourseWarning, setShowCourseWarning] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [udemyCourses, setUdemyCourses] = useState<UdemyCourse[]>([]);
  const [fetchingUdemy, setFetchingUdemy] = useState(false);
  const [udemyError, setUdemyError] = useState("");
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importProgress, setImportProgress] = useState("");
  const [explainSelectedText, setExplainSelectedText] = useState<string | null>(null);

  // Progress tracking
  const [courseProgress, setCourseProgress] = useState<{
    completionPct: number;
    currentStreak: number;
    longestStreak: number;
    totalTimeSpentMs: number;
  } | null>(null);
  const [lessonProgressMap, setLessonProgressMap] = useState<
    Record<string, { completed: boolean; quizScore: number | null }>
  >({});
  const lessonStartTimeRef = useRef<number>(Date.now());
  // Ref to access selectedLesson inside pagehide handler without stale closure
  const selectedLessonRef = useRef<Lesson | null>(null);
  // H-11: Guard against double-counting study time (pagehide + lesson switch in same tick)
  const timeSavedForLessonRef = useRef<string | null>(null);

  useEffect(() => {
    const s = loadStore();
    setStore(s);
    setStoreMounted(true);
    fetchCourses();
  }, []);

  // Fetch progress when course changes
  useEffect(() => {
    if (!selectedCourse) {
      setCourseProgress(null);
      setLessonProgressMap({});
      return;
    }
    const loadProgress = async () => {
      try {
        const res = await fetch(`/api/courses/${selectedCourse.id}/progress`);
        if (res.ok) {
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
            const map: Record<string, { completed: boolean; quizScore: number | null }> = {};
            for (const lp of data.lessonsProgress) {
              map[lp.lessonId] = { completed: lp.completed, quizScore: lp.quizScore ?? null };
            }
            setLessonProgressMap(map);
          }
        }
      } catch {
        // Silently fail
      }
    };
    loadProgress();
  }, [selectedCourse?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive current active profile for downstream consumers
  const profile: AIProfile = activeProfile(store);
  const settings: AISettings = {
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    model: profile.model,
    udemyCookie: profile.udemyCookie,
  };

  const fetchCourses = async () => {
    setCoursesLoading(true);
    try {
      const res = await fetch("/api/courses");
      if (res.status === 401) {
        // Session expired or invalid — redirect to login
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        toast.error("Lỗi khi tải danh sách courses");
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setCourses(list);

      // Auto-select course from ?courseId= query param (e.g. from dashboard)
      const courseId = searchParams.get("courseId");
      if (courseId && !selectedCourse) {
        const match = list.find((c: Course) => c.id === courseId);
        if (match) setSelectedCourse(match);
      }
    } catch {
      toast.error("Lỗi khi tải danh sách courses");
    } finally {
      setCoursesLoading(false);
    }
  };

  const handleSaveSettings = (newStore: SettingsStore) => {
    saveStore(newStore);
    setStore(newStore);
    setShowSettings(false);
  };

  const handleAddManualCourse = async (title: string) => {
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "", title }),
      });
      if (!res.ok) {
        toast.error("Lỗi khi tạo khóa học");
        return;
      }
      const data = await res.json();
      setCourses((prev) => [data, ...prev]);
      setSelectedCourse(data);
    } catch {
      toast.error("Lỗi khi tạo khóa học");
    }
  };

  const handleDeleteCourse = async (id: string) => {
    try {
      await fetch(`/api/courses/${id}`, { method: "DELETE" });
      toast.success("Đã xóa course");
      fetchCourses();
      if (selectedCourse?.id === id) {
        setSelectedCourse(null);
        setSelectedLesson(null);
      }
    } catch {
      toast.error("Lỗi khi xóa course");
    }
  };

  const handleRenameCourse = async (id: string, newTitle: string) => {
    try {
      const res = await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCourses((prev) => prev.map((c) => (c.id === id ? updated : c)));
        if (selectedCourse?.id === id) {
          setSelectedCourse(updated);
        }
        toast.success("Đã đổi tên course");
      }
    } catch {
      toast.error("Lỗi khi đổi tên course");
    }
  };

  const handleAddLesson = async (title: string) => {
    if (!selectedCourse) return;
    try {
      const res = await fetch(`/api/courses/${selectedCourse.id}/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        toast.error("Lỗi khi thêm bài học");
        return;
      }
      const data = await res.json();
      setSelectedCourse({
        ...selectedCourse,
        lessons: [...selectedCourse.lessons, data],
      });
    } catch {
      toast.error("Lỗi khi thêm bài học");
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
      toast.success("Đã xóa bài học");
      if (selectedCourse) {
        const updatedLessons = selectedCourse.lessons.filter((l) => l.id !== lessonId);
        setSelectedCourse({
          ...selectedCourse,
          lessons: updatedLessons,
        });
        if (selectedLesson?.id === lessonId) {
          setSelectedLesson(null);
        }
      }
    } catch {
      toast.error("Lỗi khi xóa bài học");
    }
  };

  const handleReSplit = async () => {
    if (!selectedCourse) return;
    try {
      const res = await fetch("/api/books/split/lessons", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: selectedCourse.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Lỗi khi xóa bài học");
      }
      toast.success("Đã xóa tất cả bài học. Bạn có thể chia chương lại.");
      setSelectedCourse({ ...selectedCourse, lessons: [] });
      setSelectedLesson(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi xóa bài học");
    }
  };

  const handleMergeLessons = async (lessonId1: string, lessonId2: string) => {
    if (!selectedCourse) return;
    try {
      const res = await fetch(`/api/courses/${selectedCourse.id}/lessons/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId1, lessonId2 }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Lỗi khi gộp chương");
      }
      const { merged, lessons } = await res.json();
      setSelectedCourse({ ...selectedCourse, lessons });
      // If selected lesson was the deleted one, switch to merged
      if (selectedLesson?.id === lessonId2) {
        setSelectedLesson(merged);
      } else if (selectedLesson?.id === lessonId1) {
        setSelectedLesson(merged);
      }
      toast.success("Đã gộp 2 chương thành công");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi gộp chương");
    }
  };

  const handleSplitLesson = async (lessonId: string, splitIndex: number, newTitle: string) => {
    if (!selectedCourse) return;
    try {
      const res = await fetch(`/api/courses/${selectedCourse.id}/lessons/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, splitIndex, newTitle }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Lỗi khi tách chương");
      }
      const { original, lessons } = await res.json();
      setSelectedCourse({ ...selectedCourse, lessons });
      // Refresh to show the updated original (top half)
      if (selectedLesson?.id === lessonId) {
        setSelectedLesson(original);
      }
      toast.success("Đã tách chương thành công");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lỗi khi tách chương");
    }
  };

  const handleReorderLessons = async (lessonIds: string[]) => {
    if (!selectedCourse) return;

    // Optimistic update: reorder lessons locally
    const reorderedLessons = lessonIds
      .map((id, index) => {
        const lesson = selectedCourse.lessons.find((l) => l.id === id);
        return lesson ? { ...lesson, order: index + 1 } : null;
      })
      .filter((l): l is Lesson => l !== null);

    const previousLessons = selectedCourse.lessons;
    setSelectedCourse({ ...selectedCourse, lessons: reorderedLessons });

    try {
      const res = await fetch(`/api/courses/${selectedCourse.id}/lessons/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonIds }),
      });
      if (!res.ok) {
        throw new Error("Reorder failed");
      }
      toast.success("Đã sắp xếp lại bài học");
    } catch {
      // Rollback on error
      setSelectedCourse({ ...selectedCourse, lessons: previousLessons });
      toast.error("Lỗi khi sắp xếp lại bài học");
    }
  };

  const handleToggleLessonComplete = async (lessonId: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });
      if (res.ok) {
        setLessonProgressMap((prev) => ({
          ...prev,
          [lessonId]: { ...prev[lessonId], completed, quizScore: prev[lessonId]?.quizScore ?? null },
        }));
        toast.success(completed ? "Đã đánh dấu hoàn thành" : "Đã bỏ đánh dấu");
        // Re-fetch course progress to update completion %
        if (selectedCourse) {
          const progressRes = await fetch(`/api/courses/${selectedCourse.id}/progress`);
          if (progressRes.ok) {
            const data = await progressRes.json();
            if (data.courseProgress) setCourseProgress({
              completionPct: data.courseProgress.completionPct,
              currentStreak: data.courseProgress.currentStreak,
              longestStreak: data.courseProgress.longestStreak,
              totalTimeSpentMs: data.courseProgress.totalTimeSpentMs,
            });
          }
        }
      }
    } catch {
      toast.error("Lỗi khi cập nhật tiến độ");
    }
  };

  const handleQuizComplete = async (lessonId: string, score: number) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, quizScore: score }),
      });
      if (res.ok) {
        setLessonProgressMap((prev) => ({
          ...prev,
          [lessonId]: { completed: true, quizScore: score },
        }));
        // Re-fetch course progress
        if (selectedCourse) {
          const progressRes = await fetch(`/api/courses/${selectedCourse.id}/progress`);
          if (progressRes.ok) {
            const data = await progressRes.json();
            if (data.courseProgress) setCourseProgress({
              completionPct: data.courseProgress.completionPct,
              currentStreak: data.courseProgress.currentStreak,
              longestStreak: data.courseProgress.longestStreak,
              totalTimeSpentMs: data.courseProgress.totalTimeSpentMs,
            });
          }
        }
      }
    } catch {
      // Silently fail
    }
  };

  // Keep ref in sync with selectedLesson for use in pagehide handler
  useEffect(() => {
    selectedLessonRef.current = selectedLesson;
  }, [selectedLesson]);

  // C-15: Save study time on page close using sendBeacon (survives page unload)
  useEffect(() => {
    const handlePageHide = () => {
      const lesson = selectedLessonRef.current;
      if (!lesson) return;
      // H-11: Skip if time was already saved for this lesson (e.g. during lesson switch)
      if (timeSavedForLessonRef.current === lesson.id) return;
      const deltaMs = Date.now() - lessonStartTimeRef.current;
      if (deltaMs <= 5000) return;
      navigator.sendBeacon(
        `/api/lessons/${lesson.id}/progress`,
        new Blob(
          [JSON.stringify({ deltaTimeMs: deltaMs })],
          { type: "application/json" }
        )
      );
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []); // empty deps — reads from refs only

  // H-21: Warn on browser back/forward when unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (chatMessageCount > 0 || transcriptDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [chatMessageCount, transcriptDirty]);

  const handleSelectLesson = (lesson: Lesson) => {
    // Track study time for current lesson before switching
    if (selectedLesson && selectedLesson.id !== lesson.id) {
      const deltaMs = Date.now() - lessonStartTimeRef.current;
      if (deltaMs > 5000) { // Only track if > 5 seconds
        // H-11: Mark time as saved to prevent pagehide double-counting
        timeSavedForLessonRef.current = selectedLesson.id;
        fetch(`/api/lessons/${selectedLesson.id}/progress`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deltaTimeMs: deltaMs }),
        }).catch(() => {}); // fire-and-forget
      }
    }

    if ((chatMessageCount > 0 || transcriptDirty) && selectedLesson && selectedLesson.id !== lesson.id) {
      setPendingLesson(lesson);
      setShowLessonWarning(true);
    } else {
      setSelectedLesson(lesson);
      setShowCollection(false);
      lessonStartTimeRef.current = Date.now();
      // H-11: Reset guard for new lesson
      timeSavedForLessonRef.current = null;
    }
  };

  const confirmLessonSwitch = () => {
    // Track time for current lesson
    if (selectedLesson) {
      const deltaMs = Date.now() - lessonStartTimeRef.current;
      if (deltaMs > 5000) {
        // H-11: Mark time as saved to prevent pagehide double-counting
        timeSavedForLessonRef.current = selectedLesson.id;
        fetch(`/api/lessons/${selectedLesson.id}/progress`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deltaTimeMs: deltaMs }),
        }).catch(() => {});
      }
    }
    if (pendingLesson) {
      setSelectedLesson(pendingLesson);
      setShowCollection(false);
    }
    setPendingLesson(null);
    setShowLessonWarning(false);
    lessonStartTimeRef.current = Date.now();
    // H-11: Reset guard for new lesson
    timeSavedForLessonRef.current = null;
  };

  const cancelLessonSwitch = () => {
    setPendingLesson(null);
    setShowLessonWarning(false);
  };

  const confirmCourseSwitch = () => {
    if (pendingCourse) {
      setSelectedCourse(pendingCourse);
      setSelectedLesson(null);
      setShowCollection(false);
    }
    setPendingCourse(null);
    setShowCourseWarning(false);
    lessonStartTimeRef.current = Date.now();
    timeSavedForLessonRef.current = null;
  };

  const cancelCourseSwitch = () => {
    setPendingCourse(null);
    setShowCourseWarning(false);
  };

  const handleSaveTranscript = async (lessonId: string, transcript: string) => {
    try {
      const res = await fetch(`/api/lessons/${lessonId}/transcript`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      // H-22: Check res.ok before treating as success
      if (!res.ok) {
        toast.error("Lỗi khi lưu transcript");
        return;
      }
      // Update all state sources so switching courses and coming back
      // shows the saved transcript (courses array, selectedCourse, selectedLesson).
      const updateLessons = (lessons: Lesson[]) =>
        lessons.map((l) => (l.id === lessonId ? { ...l, transcript } : l));

      setCourses((prev) =>
        prev.map((c) => ({
          ...c,
          lessons: updateLessons(c.lessons),
        }))
      );
      setSelectedCourse((prev) => {
        if (!prev) return prev;
        return { ...prev, lessons: updateLessons(prev.lessons) };
      });
      setSelectedLesson((prev) => {
        if (!prev || prev.id !== lessonId) return prev;
        return { ...prev, transcript };
      });
      toast.success("Đã lưu transcript");
    } catch {
      toast.error("Lỗi khi lưu transcript");
    }
  };

  const handleFetchUdemyCourses = useCallback(async (cookie: string) => {
    if (!cookie) {
      setUdemyError("Vui lòng nhập Udemy cookie trước.");
      return;
    }
    setFetchingUdemy(true);
    setUdemyError("");
    setUdemyCourses([]);
    try {
      const res = await fetch("/api/udemy/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUdemyError(data.error ?? "Không thể lấy danh sách courses");
        return;
      }
      setUdemyCourses(data.courses ?? []);
      if ((data.courses ?? []).length === 0) {
        setUdemyError("Không tìm thấy course nào.");
      }
    } catch {
      setUdemyError("Lỗi kết nối.");
    } finally {
      setFetchingUdemy(false);
    }
  }, []);

  const handleImportCourse = async (udemyCourse: UdemyCourse) => {
    if (importingId) return;
    setImportingId(udemyCourse.id);
    setImportProgress("Đang import...");
    try {
      const res = await fetch("/api/udemy/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: udemyCourse.id,
          cookie: settings.udemyCookie,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportProgress(`Lỗi: ${data.error ?? "Import thất bại"}`);
        toast.error(data.error ?? "Import thất bại");
        return;
      }
      setImportProgress(
        `Đã import "${data.title}" — ${data.lessonCount} bài học`
      );
      toast.success(`Đã import "${data.title}" — ${data.lessonCount} bài học`);
      fetchCourses();
    } catch {
      setImportProgress("Lỗi kết nối khi import.");
    } finally {
      setImportingId(null);
    }
  };

  // Defer isConfigured until after client hydration to prevent SSR mismatch
  const isConfigured = storeMounted && !!(settings.apiKey && settings.model);

  // ── Keyboard shortcuts ──

  const navigateLesson = (direction: "prev" | "next") => {
    if (!selectedCourse || !selectedLesson) return;
    const lessons = selectedCourse.lessons;
    const idx = lessons.findIndex((l) => l.id === selectedLesson.id);
    if (idx === -1) return;
    const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (nextIdx >= 0 && nextIdx < lessons.length) {
      handleSelectLesson(lessons[nextIdx]);
    }
  };

  useKeyboardShortcuts([
    {
      key: "alt+arrowup",
      handler: () => navigateLesson("prev"),
      description: "Bài trước",
    },
    {
      key: "alt+arrowdown",
      handler: () => navigateLesson("next"),
      description: "Bài tiếp",
    },
    {
      key: "ctrl+,",
      handler: () => setShowSettings(true),
      description: "Mở cài đặt",
    },
    {
      key: "escape",
      handler: () => {
        if (showSettings) setShowSettings(false);
        else if (showImport) setShowImport(false);
        else if (showUpload) setShowUpload(false);
        else if (showCollection) setShowCollection(false);
      },
      description: "Đóng modal",
    },
  ]);

  return (
    <div className="h-screen bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Topbar */}
      <Header
        user={user}
        currentModel={settings.model}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[272px] shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col overflow-y-auto bg-white dark:bg-gray-900">
          <div className="flex flex-col gap-5 p-4 pb-8">
            <AddCoursePanel
              hasUdemyCookie={!!settings.udemyCookie}
              onAddManual={handleAddManualCourse}
              onOpenImport={() => {
                setShowImport(true);
                handleFetchUdemyCourses(settings.udemyCookie);
              }}
              onOpenUpload={() => setShowUpload(true)}
              onOpenSettings={() => setShowSettings(true)}
            />

            <div className="h-px bg-gray-100 dark:bg-gray-800" />

            <CourseList
              courses={courses}
              loading={coursesLoading}
              selectedCourseId={selectedCourse?.id ?? null}
              onSelect={(c) => {
                if ((chatMessageCount > 0 || transcriptDirty) && selectedLesson && c.id !== selectedCourse?.id) {
                  setPendingCourse(c);
                  setShowCourseWarning(true);
                } else {
                  setSelectedCourse(c);
                  setSelectedLesson(null);
                  setShowCollection(false);
                }
              }}
              onDelete={handleDeleteCourse}
              onRename={handleRenameCourse}
              courseProgressMap={courseProgress && selectedCourse ? { [selectedCourse.id]: courseProgress.completionPct } : {}}
            />

            {courses.length === 0 && !coursesLoading && (
              <OnboardingCard
                onImport={() => {
                  setShowImport(true);
                  handleFetchUdemyCourses(settings.udemyCookie);
                }}
                onUpload={() => setShowUpload(true)}
                onAddManual={() => handleAddManualCourse("Khóa học mới")}
              />
            )}

            {selectedCourse && (
              <>
                <div className="h-px bg-gray-100 dark:bg-gray-800" />
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
                  onSelect={handleSelectLesson}
                  onAddLesson={handleAddLesson}
                  onDelete={handleDeleteLesson}
                  onReorder={handleReorderLessons}
                  progressMap={lessonProgressMap}
                  onToggleComplete={handleToggleLessonComplete}
                  onMerge={handleMergeLessons}
                  onSplit={handleSplitLesson}
                  onReSplit={handleReSplit}
                  contentType={selectedCourse.contentType}
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowCollection(!showCollection);
                    if (!showCollection) setSelectedLesson(null);
                  }}
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

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50/40 dark:bg-gray-900/40">
          {showCollection && selectedCourse ? (
            <CollectionPanel
              courseId={selectedCourse.id}
              courseTitle={selectedCourse.title}
              onNavigateToLesson={(lessonId) => {
                const lesson = selectedCourse.lessons.find((l) => l.id === lessonId);
                if (lesson) {
                  setSelectedLesson(lesson);
                  setShowCollection(false);
                }
              }}
              onClose={() => setShowCollection(false)}
            />
          ) : selectedLesson ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 p-6 h-full">
              <TranscriptPanel
                key={selectedLesson.id}
                lesson={selectedLesson}
                onSaveTranscript={handleSaveTranscript}
                onDirtyChange={setTranscriptDirty}
                onExplainSelection={(text) => setExplainSelectedText(text)}
              />
              <AIAssistantPanel
                lesson={selectedLesson}
                courseId={selectedCourse!.id}
                contentType={selectedCourse!.contentType}
                settings={settings}
                isConfigured={isConfigured}
                onOpenSettings={() => setShowSettings(true)}
                onChatCountChange={setChatMessageCount}
                externalExplainText={explainSelectedText}
                onExternalExplainHandled={() => setExplainSelectedText(null)}
                onQuizComplete={handleQuizComplete}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 p-6">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                <svg width="26" height="26" fill="none" viewBox="0 0 24 24" className="text-[#A435F0]">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-gray-800 dark:text-gray-200 font-semibold text-sm">
                  {selectedCourse
                    ? selectedCourse.lessons.length === 0
                      ? "Khóa học trống"
                      : "Chọn một bài học để bắt đầu"
                    : courses.length === 0
                      ? "Chưa có khóa học nào"
                      : "Chọn một course từ sidebar"}
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs max-w-xs leading-relaxed mt-1.5">
                  {selectedCourse
                    ? selectedCourse.lessons.length === 0
                      ? "Thêm bài học bằng cách upload file transcript hoặc tạo thủ công"
                      : "Chọn bài học bên trái để xem transcript và dùng AI assistant"
                    : courses.length === 0
                      ? "Bắt đầu bằng cách import từ Udemy, upload file, hoặc tạo khóa học thủ công"
                      : "Thêm hoặc chọn course từ danh sách bên trái để bắt đầu"}
                </p>
              </div>
              {/* Quick action buttons for empty states */}
              {!selectedCourse && courses.length === 0 && (
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImport(true);
                      handleFetchUdemyCourses(settings.udemyCookie);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                  >
                    Import từ Udemy
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#A435F0] text-white hover:bg-[#8710D8] cursor-pointer transition-colors"
                  >
                    Upload file
                  </button>
                </div>
              )}
              {selectedCourse && selectedCourse.lessons.length === 0 && (
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowUpload(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#A435F0] text-white hover:bg-[#8710D8] cursor-pointer transition-colors"
                  >
                    Upload transcript
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <SettingsModal
        open={showSettings}
        store={store}
        onSave={handleSaveSettings}
        onClose={() => setShowSettings(false)}
      />

      <ImportModal
        open={showImport}
        courses={udemyCourses}
        fetching={fetchingUdemy}
        error={udemyError}
        importingId={importingId}
        importProgress={importProgress}
        onClose={() => {
          setShowImport(false);
          setUdemyCourses([]);
          setUdemyError("");
          setImportProgress("");
        }}
        onRefresh={() => handleFetchUdemyCourses(settings.udemyCookie)}
        onImport={handleImportCourse}
      />

      <UploadModal
        open={showUpload}
        courseId={selectedCourse?.id ?? null}
        onClose={() => setShowUpload(false)}
        onUploadComplete={async (newCourseId: string) => {
          await fetchCourses();
          setShowUpload(false);
          // Auto-select the course that was just uploaded to
          const res = await fetch(`/api/courses/${newCourseId}`);
          if (res.ok) {
            const course = await res.json();
            setSelectedCourse(course);
            setSelectedLesson(null);
          }
        }}
      />

      <AlertDialog open={showLessonWarning} onOpenChange={(open) => {
        if (!open) setPendingLesson(null);
        setShowLessonWarning(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chuyển bài học?</AlertDialogTitle>
            <AlertDialogDescription>
              {transcriptDirty && chatMessageCount > 0
                ? "Bạn có thay đổi transcript chưa lưu và cuộc trò chuyện AI đang diễn ra. Chuyển bài học sẽ mất tất cả."
                : transcriptDirty
                  ? "Bạn có thay đổi transcript chưa lưu. Chuyển bài học sẽ mất các thay đổi này."
                  : "Bạn đang có cuộc trò chuyện với AI. Chuyển bài học sẽ mất toàn bộ lịch sử chat hiện tại."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLessonSwitch} className="cursor-pointer">Ở lại</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLessonSwitch} className="bg-[#A435F0] hover:bg-[#8710D8] cursor-pointer">
              Chuyển bài học
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Course switch warning dialog */}
      <AlertDialog open={showCourseWarning} onOpenChange={(open) => {
        if (!open) setPendingCourse(null);
        setShowCourseWarning(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chuyển khóa học?</AlertDialogTitle>
            <AlertDialogDescription>
              {transcriptDirty && chatMessageCount > 0
                ? "Bạn có thay đổi transcript chưa lưu và cuộc trò chuyện AI đang diễn ra. Chuyển khóa học sẽ mất tất cả."
                : transcriptDirty
                  ? "Bạn có thay đổi transcript chưa lưu. Chuyển khóa học sẽ mất các thay đổi này."
                  : "Bạn đang có cuộc trò chuyện với AI. Chuyển khóa học sẽ mất toàn bộ lịch sử chat hiện tại."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelCourseSwitch} className="cursor-pointer">Ở lại</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCourseSwitch} className="bg-[#A435F0] hover:bg-[#8710D8] cursor-pointer">
              Chuyển khóa học
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
