"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Zap } from "lucide-react";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { AIAssistantPanel } from "@/components/AIAssistantPanel";
import { CollectionPanel } from "@/components/CollectionPanel";
import type { Course, Lesson, AISettings } from "@/types/course";

interface LessonContentAreaProps {
  selectedCourse: Course | null;
  selectedLesson: Lesson | null;
  showCollection: boolean;
  settings: AISettings;
  isConfigured: boolean;
  explainSelectedText: string | null;
  courses: Course[];
  // Callbacks
  onSaveTranscript: (lessonId: string, transcript: string) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
  onExplainSelection: (text: string) => void;
  onExplainHandled: () => void;
  onChatCountChange: (count: number) => void;
  onQuizComplete: (lessonId: string, score: number) => void;
  onNavigateToChapter: (chapterId: string) => void;
  onNavigateToLesson: (lessonId: string) => void;
  onCloseCollection: () => void;
  onOpenSettings: () => void;
}

type MainTab = "transcript" | "ai";

const MAIN_TABS: { key: MainTab; label: string; icon: React.ElementType }[] = [
  { key: "transcript", label: "Transcript", icon: FileText },
  { key: "ai",         label: "AI Assistant", icon: Zap },
];

/**
 * Main content area with tab navigation: Transcript | AI Assistant.
 * When a lesson is selected, shows a prominent tab bar at the top.
 * Guards all .lessons accesses with ?? [] to prevent undefined crashes.
 */
export function LessonContentArea({
  selectedCourse,
  selectedLesson,
  showCollection,
  settings,
  isConfigured,
  explainSelectedText,
  courses,
  onSaveTranscript,
  onDirtyChange,
  onExplainSelection,
  onExplainHandled,
  onChatCountChange,
  onQuizComplete,
  onNavigateToChapter,
  onNavigateToLesson,
  onCloseCollection,
  onOpenSettings,
}: LessonContentAreaProps) {
  const [activeTab, setActiveTab] = useState<MainTab>("transcript");

  if (showCollection && selectedCourse) {
    return (
      <CollectionPanel
        courseId={selectedCourse.id}
        courseTitle={selectedCourse.title}
        onNavigateToLesson={onNavigateToLesson}
        onClose={onCloseCollection}
      />
    );
  }

  if (selectedLesson) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* ── Tab bar ── */}
        <div className="flex-none border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4">
          <div className="flex gap-0">
            {MAIN_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === key
                    ? "border-[#A435F0] text-[#A435F0]"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-hidden">
          {activeTab === "transcript" ? (
            <div className="h-full overflow-y-auto p-5">
              <TranscriptPanel
                key={selectedLesson.id}
                lesson={selectedLesson}
                contentType={selectedCourse?.contentType}
                onSaveTranscript={onSaveTranscript}
                onDirtyChange={onDirtyChange}
                onExplainSelection={(text) => {
                  onExplainSelection(text);
                  setActiveTab("ai"); // auto-switch to AI when explaining selection
                }}
              />
            </div>
          ) : (
            <div className="h-full overflow-y-auto p-5">
              <AIAssistantPanel
                lesson={selectedLesson}
                courseId={selectedCourse!.id}
                contentType={selectedCourse!.contentType}
                settings={settings}
                isConfigured={isConfigured}
                onOpenSettings={onOpenSettings}
                onChatCountChange={onChatCountChange}
                externalExplainText={explainSelectedText}
                onExternalExplainHandled={onExplainHandled}
                onQuizComplete={onQuizComplete}
                onNavigateToChapter={onNavigateToChapter}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Empty state
  const lessons = selectedCourse?.lessons ?? [];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4 p-6">
      <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24" className="text-[#A435F0]">
          <path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <p className="text-gray-800 dark:text-gray-200 font-semibold text-sm">
          {selectedCourse
            ? lessons.length === 0
              ? "Khóa học trống"
              : "Chọn một bài học để bắt đầu"
            : courses.length === 0
              ? "Chưa có khóa học nào"
              : "Chọn một course từ sidebar"}
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-xs max-w-xs leading-relaxed mt-1.5">
          {selectedCourse
            ? lessons.length === 0
              ? "Thêm bài học qua tab Import ở trên"
              : "Chọn bài học bên trái để xem transcript và dùng AI assistant"
            : courses.length === 0
              ? "Bắt đầu bằng cách vào tab Import để thêm khóa học"
              : "Thêm hoặc chọn course từ danh sách bên trái để bắt đầu"}
        </p>
        {(courses.length === 0 || (selectedCourse && lessons.length === 0)) && (
          <Link
            href="/import"
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#A435F0] text-white hover:bg-[#8710D8] transition-colors"
          >
            Đi đến Import
          </Link>
        )}
      </div>
    </div>
  );
}
