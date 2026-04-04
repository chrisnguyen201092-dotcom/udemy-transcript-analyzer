"use client";

import { useState, Suspense, useSyncExternalStore } from "react";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useCourseNavigation } from "@/hooks/use-course-navigation";
import { useDirtyGuard } from "@/hooks/use-dirty-guard";
import { useUdemyImport } from "@/hooks/use-udemy-import";
import { CourseSidebar } from "@/components/course-sidebar";
import { LessonContentArea } from "@/components/lesson-content-area";
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
import { LessonWarningDialog, CourseWarningDialog } from "@/components/dirty-guard-dialogs";
import type { Course, Lesson } from "@/types/course";

function HomeContent() {
  const { user } = useAuth();

  // ── Settings store (multi-profile, hydrated from localStorage after mount) ──
  const store = useSyncExternalStore(
    (cb) => { window.addEventListener("settings-store-update", cb); return () => window.removeEventListener("settings-store-update", cb); },
    () => loadStore(),
    () => ({ profiles: [], activeId: "" } as SettingsStore)
  );


  const profile: AIProfile = activeProfile(store);
  const settings = {
    baseUrl: profile.baseUrl,
    apiKey: profile.apiKey,
    model: profile.model,
    udemyCookie: profile.udemyCookie,
  };
  // Defer until after hydration to prevent SSR mismatch
  const isConfigured = !!(settings.apiKey && settings.model);

  // ── Modal visibility ──
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<"transcript" | "book">("transcript");
  const [showCollection, setShowCollection] = useState(false);

  // ── Explain-selection bridge (TranscriptPanel → AIAssistantPanel) ──
  const [explainSelectedText, setExplainSelectedText] = useState<string | null>(null);

  // ── Core navigation + CRUD ──
  const nav = useCourseNavigation();

  // ── Dirty guard (unsaved transcript / active AI chat) ──
  const dirty = useDirtyGuard({
    onConfirmLesson: (lesson: Lesson) => {
      nav.saveStudyTime(nav.selectedLesson!.id);
      nav.setSelectedLesson(lesson);
      setShowCollection(false);
      nav.resetLessonTimer();
    },
    onConfirmCourse: (course: Course) => {
      nav.setSelectedCourse(course);
      nav.setSelectedLesson(null);
      setShowCollection(false);
      nav.resetLessonTimer();
    },
  });

  // ── Udemy import ──
  const udemy = useUdemyImport(nav.fetchCourses);

  // ── Navigation handlers (bridge dirty guard + nav hook) ──
  const handleSelectLesson = (lesson: Lesson) => {
    if (nav.selectedLesson && nav.selectedLesson.id !== lesson.id) {
      nav.saveStudyTime(nav.selectedLesson.id);
    }
    const deferred = !dirty.requestLessonSwitch(lesson, nav.selectedLesson);
    if (!deferred) {
      nav.setSelectedLesson(lesson);
      setShowCollection(false);
      nav.resetLessonTimer();
    }
  };

  const handleSelectCourse = (course: Course) => {
    const deferred = !dirty.requestCourseSwitch(course, nav.selectedCourse, nav.selectedLesson);
    if (!deferred) {
      nav.setSelectedCourse(course);
      nav.setSelectedLesson(null);
      setShowCollection(false);
    }
  };

  const handleOpenImport = () => {
    setShowImport(true);
    udemy.handleFetchUdemyCourses(settings.udemyCookie);
  };

  const handleToggleCollection = () => {
    setShowCollection((prev) => {
      if (!prev) nav.setSelectedLesson(null);
      return !prev;
    });
  };

  // ── Keyboard shortcuts ──
  useKeyboardShortcuts([
    {
      key: "alt+arrowup",
      handler: () => nav.navigateLesson("prev", handleSelectLesson),
      description: "Bài trước",
    },
    {
      key: "alt+arrowdown",
      handler: () => nav.navigateLesson("next", handleSelectLesson),
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
      <Header user={user} currentModel={settings.model} />

      <div className="flex flex-1 overflow-hidden">
        <CourseSidebar
          courses={nav.courses}
          coursesLoading={nav.coursesLoading}
          selectedCourse={nav.selectedCourse}
          selectedLesson={nav.selectedLesson}
          courseProgress={nav.courseProgress}
          lessonProgressMap={nav.lessonProgressMap}
          showCollection={showCollection}
          hasUdemyCookie={!!settings.udemyCookie}
          onSelectCourse={handleSelectCourse}
          onDeleteCourse={nav.handleDeleteCourse}
          onRenameCourse={nav.handleRenameCourse}
          onAddManualCourse={nav.handleAddManualCourse}
          onSelectLesson={handleSelectLesson}
          onAddLesson={nav.handleAddLesson}
          onDeleteLesson={nav.handleDeleteLesson}
          onReorderLessons={nav.handleReorderLessons}
          onToggleLessonComplete={nav.handleToggleLessonComplete}
          onMergeLessons={nav.handleMergeLessons}
          onSplitLesson={nav.handleSplitLesson}
          onReSplit={nav.handleReSplit}
          onOpenImport={handleOpenImport}
          onOpenUploadTranscript={() => { setUploadMode("transcript"); setShowUpload(true); }}
          onOpenUploadBook={() => { setUploadMode("book"); setShowUpload(true); }}
          onOpenSettings={() => setShowSettings(true)}
          onToggleCollection={handleToggleCollection}
        />

        <main className="flex-1 overflow-y-auto bg-gray-50/40 dark:bg-gray-900/40">
          <LessonContentArea
            selectedCourse={nav.selectedCourse}
            selectedLesson={nav.selectedLesson}
            showCollection={showCollection}
            settings={settings}
            isConfigured={isConfigured}
            explainSelectedText={explainSelectedText}
            courses={nav.courses}
            onSaveTranscript={nav.handleSaveTranscript}
            onDirtyChange={dirty.setTranscriptDirty}
            onExplainSelection={setExplainSelectedText}
            onExplainHandled={() => setExplainSelectedText(null)}
            onChatCountChange={dirty.setChatMessageCount}
            onQuizComplete={nav.handleQuizComplete}
            onNavigateToChapter={(chapterId) => {
              const target = nav.selectedCourse?.lessons.find((l) => l.id === chapterId);
              if (target) nav.setSelectedLesson(target);
            }}
            onNavigateToLesson={(lessonId) => {
              const lesson = nav.selectedCourse?.lessons.find((l) => l.id === lessonId);
              if (lesson) { nav.setSelectedLesson(lesson); setShowCollection(false); }
            }}
            onCloseCollection={() => setShowCollection(false)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenImport={handleOpenImport}
            onOpenUpload={() => { setUploadMode("transcript"); setShowUpload(true); }}
          />
        </main>
      </div>

      {/* ── Modals ── */}
      <SettingsModal
        open={showSettings}
        store={store}
        onSave={(newStore: SettingsStore) => {
          saveStore(newStore);
          window.dispatchEvent(new Event("settings-store-update"));
          setShowSettings(false);
        }}
        onClose={() => setShowSettings(false)}
      />

      <ImportModal
        open={showImport}
        courses={udemy.udemyCourses}
        fetching={udemy.fetchingUdemy}
        error={udemy.udemyError}
        importingId={udemy.importingId}
        importProgress={udemy.importProgress}
        onClose={() => { setShowImport(false); udemy.resetImportState(); }}
        onRefresh={() => udemy.handleFetchUdemyCourses(settings.udemyCookie)}
        onImport={(c) => udemy.handleImportCourse(c, settings.udemyCookie)}
      />

      <UploadModal
        open={showUpload}
        courseId={nav.selectedCourse?.id ?? null}
        initialMode={uploadMode}
        onClose={() => setShowUpload(false)}
        onUploadComplete={async (newCourseId: string) => {
          await nav.fetchCourses();
          setShowUpload(false);
          const res = await fetch(`/api/courses/${newCourseId}`);
          if (res.ok) {
            const course = await res.json();
            nav.setSelectedCourse(course);
            nav.setSelectedLesson(null);
          }
        }}
      />

      {/* ── Dirty-guard warning dialogs ── */}
      <LessonWarningDialog
        open={dirty.showLessonWarning}
        transcriptDirty={dirty.transcriptDirty}
        chatMessageCount={dirty.chatMessageCount}
        onCancel={dirty.cancelLessonSwitch}
        onConfirm={dirty.confirmLessonSwitch}
      />
      <CourseWarningDialog
        open={dirty.showCourseWarning}
        transcriptDirty={dirty.transcriptDirty}
        chatMessageCount={dirty.chatMessageCount}
        onCancel={dirty.cancelCourseSwitch}
        onConfirm={dirty.confirmCourseSwitch}
      />
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
