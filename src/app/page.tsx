"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/Header";
import { AddCoursePanel } from "@/components/AddCoursePanel";
import { CourseList } from "@/components/CourseList";
import { LessonList } from "@/components/LessonList";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { AIAssistantPanel } from "@/components/AIAssistantPanel";
import { SettingsModal } from "@/components/SettingsModal";
import { ImportModal } from "@/components/ImportModal";

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

const SETTINGS_KEY = "udemy_ai_settings";
const DEFAULT_SETTINGS: AISettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  udemyCookie: "",
};

function loadSettings(): AISettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: AISettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [udemyCourses, setUdemyCourses] = useState<UdemyCourse[]>([]);
  const [fetchingUdemy, setFetchingUdemy] = useState(false);
  const [udemyError, setUdemyError] = useState("");
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importProgress, setImportProgress] = useState("");

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const res = await fetch("/api/courses");
    const data = await res.json();
    setCourses(data);
  };

  const handleSaveSettings = (draft: AISettings) => {
    saveSettings(draft);
    setSettings(draft);
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
    await fetch(`/api/courses/${id}`, { method: "DELETE" });
    fetchCourses();
    if (selectedCourse?.id === id) {
      setSelectedCourse(null);
      setSelectedLesson(null);
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

  const handleSaveTranscript = async (lessonId: string, transcript: string) => {
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
        return;
      }
      setImportProgress(
        `Đã import "${data.title}" — ${data.lessonCount} bài học`
      );
      fetchCourses();
    } catch {
      setImportProgress("Lỗi kết nối khi import.");
    } finally {
      setImportingId(null);
    }
  };

  const isConfigured = !!(settings.apiKey && settings.model);

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Topbar */}
      <Header
        isConfigured={isConfigured}
        currentModel={settings.model}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[272px] shrink-0 border-r border-gray-100 flex flex-col overflow-y-auto bg-white">
          <div className="flex flex-col gap-5 p-4 pb-8">
            <AddCoursePanel
              hasUdemyCookie={!!settings.udemyCookie}
              onAddManual={handleAddManualCourse}
              onOpenImport={() => {
                setShowImport(true);
                handleFetchUdemyCourses(settings.udemyCookie);
              }}
              onOpenSettings={() => setShowSettings(true)}
            />

            <div className="h-px bg-gray-100" />

            <CourseList
              courses={courses}
              selectedCourseId={selectedCourse?.id ?? null}
              onSelect={(c) => {
                setSelectedCourse(c);
                setSelectedLesson(null);
              }}
              onDelete={handleDeleteCourse}
            />

            {selectedCourse && (
              <>
                <div className="h-px bg-gray-100" />
                <LessonList
                  lessons={selectedCourse.lessons}
                  selectedLessonId={selectedLesson?.id ?? null}
                  onSelect={setSelectedLesson}
                  onAddLesson={handleAddLesson}
                />
              </>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50/40">
          {selectedLesson ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 p-6 h-full">
              <TranscriptPanel
                lesson={selectedLesson}
                onSaveTranscript={handleSaveTranscript}
              />
              <AIAssistantPanel
                lesson={selectedLesson}
                settings={settings}
                isConfigured={isConfigured}
                onOpenSettings={() => setShowSettings(true)}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" className="text-[#5B5BD6]">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-gray-800 font-medium text-sm">
                {selectedCourse ? "Chọn một bài học để bắt đầu" : "Chọn một course từ sidebar"}
              </p>
              <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
                {selectedCourse
                  ? "Chọn bài học bên trái để xem transcript và dùng AI assistant"
                  : "Thêm hoặc chọn course từ danh sách bên trái để bắt đầu"}
              </p>
            </div>
          )}
        </main>
      </div>

      <SettingsModal
        open={showSettings}
        initialSettings={settings}
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
    </div>
  );
}
