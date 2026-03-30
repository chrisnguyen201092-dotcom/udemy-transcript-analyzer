"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
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

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Multi-profile store
  const [store, setStore] = useState<SettingsStore>(() => loadStore());

  // Chat leave warning state
  const [chatMessageCount, setChatMessageCount] = useState(0);
  const [transcriptDirty, setTranscriptDirty] = useState(false);
  const [pendingLesson, setPendingLesson] = useState<Lesson | null>(null);
  const [showLessonWarning, setShowLessonWarning] = useState(false);

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

  useEffect(() => {
    const s = loadStore();
    setStore(s);
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
      const data = await res.json();
      setCourses(data);
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
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "", title }),
    });
    const data = await res.json();
    if (res.ok) {
      setCourses((prev) => [data, ...prev]);
      setSelectedCourse(data);
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
    const res = await fetch(`/api/courses/${selectedCourse.id}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelectedCourse({
        ...selectedCourse,
        lessons: [...selectedCourse.lessons, data],
      });
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

  const handleSelectLesson = (lesson: Lesson) => {
    // Track study time for current lesson before switching
    if (selectedLesson && selectedLesson.id !== lesson.id) {
      const deltaMs = Date.now() - lessonStartTimeRef.current;
      if (deltaMs > 5000) { // Only track if > 5 seconds
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
    }
  };

  const confirmLessonSwitch = () => {
    // Track time for current lesson
    if (selectedLesson) {
      const deltaMs = Date.now() - lessonStartTimeRef.current;
      if (deltaMs > 5000) {
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
  };

  const cancelLessonSwitch = () => {
    setPendingLesson(null);
    setShowLessonWarning(false);
  };

  const handleSaveTranscript = async (lessonId: string, transcript: string) => {
    try {
      await fetch(`/api/lessons/${lessonId}/transcript`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const updatedLesson = { ...selectedLesson!, transcript };
      setSelectedLesson(updatedLesson);
      if (selectedCourse) {
        setSelectedCourse({
          ...selectedCourse,
          lessons: selectedCourse.lessons.map((l) =>
            l.id === lessonId ? updatedLesson : l
          ),
        });
      }
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

  const isConfigured = !!(settings.apiKey && settings.model);

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
        isConfigured={isConfigured}
        profileName={profile.name}
        currentModel={settings.model}
        onOpenSettings={() => setShowSettings(true)}
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
                setSelectedCourse(c);
                setSelectedLesson(null);
                setShowCollection(false);
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
                <LessonList
                  lessons={selectedCourse.lessons}
                  selectedLessonId={selectedLesson?.id ?? null}
                  onSelect={handleSelectLesson}
                  onAddLesson={handleAddLesson}
                  onDelete={handleDeleteLesson}
                  onReorder={handleReorderLessons}
                  progressMap={lessonProgressMap}
                  onToggleComplete={handleToggleLessonComplete}
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

      <AlertDialog open={showLessonWarning} onOpenChange={setShowLessonWarning}>
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
    </div>
  );
}
