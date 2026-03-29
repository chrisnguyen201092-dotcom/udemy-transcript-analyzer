"use client";

import { useState, useEffect, useCallback } from "react";

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [manualTranscript, setManualTranscript] = useState("");

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<AISettings>(DEFAULT_SETTINGS);
  const [models, setModels] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [modelsError, setModelsError] = useState("");

  // Udemy import state
  const [showImport, setShowImport] = useState(false);
  const [udemyCourses, setUdemyCourses] = useState<UdemyCourse[]>([]);
  const [fetchingUdemy, setFetchingUdemy] = useState(false);
  const [udemyError, setUdemyError] = useState("");
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importProgress, setImportProgress] = useState("");

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setDraftSettings(s);
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    const res = await fetch("/api/courses");
    const data = await res.json();
    setCourses(data);
  };

  const fetchModels = useCallback(async (draft: AISettings) => {
    if (!draft.baseUrl || !draft.apiKey) return;
    setFetchingModels(true);
    setModelsError("");
    try {
      const res = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: draft.baseUrl, apiKey: draft.apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModelsError(data.error ?? "Failed to fetch models");
        setModels([]);
      } else {
        setModels(data.models ?? []);
        if (data.models?.length && !data.models.includes(draft.model)) {
          setDraftSettings((prev) => ({ ...prev, model: data.models[0] }));
        }
      }
    } catch {
      setModelsError("Network error");
    } finally {
      setFetchingModels(false);
    }
  }, []);

  const handleFetchUdemyCourses = async (cookie: string) => {
    if (!cookie) { setUdemyError("Vui lòng nhập Udemy cookie trước."); return; }
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
      if (!res.ok) { setUdemyError(data.error ?? "Không thể lấy danh sách courses"); return; }
      setUdemyCourses(data.courses ?? []);
      if ((data.courses ?? []).length === 0) setUdemyError("Không tìm thấy course nào.");
    } catch {
      setUdemyError("Lỗi kết nối.");
    } finally {
      setFetchingUdemy(false);
    }
  };

  const handleImportCourse = async (udemyCourse: UdemyCourse) => {
    if (importingId) return;
    setImportingId(udemyCourse.id);
    setImportProgress("Đang import...");
    try {
      const res = await fetch("/api/udemy/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: udemyCourse.id, cookie: settings.udemyCookie }),
      });
      const data = await res.json();
      if (!res.ok) { setImportProgress(`Lỗi: ${data.error ?? "Import thất bại"}`); return; }
      setImportProgress(`✅ Đã import "${data.title}" — ${data.lessonCount} bài học`);
      fetchCourses();
    } catch {
      setImportProgress("Lỗi kết nối khi import.");
    } finally {
      setImportingId(null);
    }
  };

  const handleOpenSettings = () => {
    setModels([]);
    setModelsError("");
    setShowSettings(true);
    // Pre-load models if settings already exist
    if (settings.baseUrl && settings.apiKey) {
      fetchModels(settings);
    }
  };

  const handleSaveSettings = () => {
    saveSettings(draftSettings);
    setSettings(draftSettings);
    setShowSettings(false);
  };

  const handleAddManualCourse = async () => {
    const title = prompt("Nhập tên course:");
    if (!title) return;

    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "", title }),
    });
    const data = await res.json();
    if (res.ok) {
      setCourses([data, ...courses]);
      setSelectedCourse(data);
    }
  };

  const handleAddLesson = async () => {
    if (!selectedCourse) return;
    const title = prompt("Nhập tên bài học:");
    if (!title) return;

    const res = await fetch(`/api/courses/${selectedCourse.id}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelectedCourse({ ...selectedCourse, lessons: [...selectedCourse.lessons, data] });
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (confirm("Delete this course?")) {
      await fetch(`/api/courses/${id}`, { method: "DELETE" });
      fetchCourses();
      if (selectedCourse?.id === id) setSelectedCourse(null);
    }
  };

  const requireSettings = (): boolean => {
    if (!settings.apiKey || !settings.model) {
      alert("Vui lòng cấu hình API Key và chọn Model trong Settings (⚙️) trước.");
      return false;
    }
    return true;
  };

  const handleSummary = async () => {
    if (!selectedLesson || !requireSettings()) return;
    setLoadingCourse(true);
    setChatMessages([]); // Clear chat thread for single-response mode
    setAiResponse("Đang tạo tóm tắt...");
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLesson.id,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        }),
      });
      const data = await res.json();
      setAiResponse(data.summary || data.error);
    } catch {
      setAiResponse("Lỗi khi tạo tóm tắt");
    }
    setLoadingCourse(false);
  };

  const handleExplain = async () => {
    if (!selectedLesson || !requireSettings()) return;
    setLoadingCourse(true);
    setChatMessages([]); // Clear chat thread for single-response mode
    setAiResponse("Đang giải thích...");
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLesson.id,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        }),
      });
      const data = await res.json();
      setAiResponse(data.explanation || data.error);
    } catch {
      setAiResponse("Lỗi khi giải thích");
    }
    setLoadingCourse(false);
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLesson || !chatInput.trim() || !requireSettings()) return;
    const userMessage = chatInput.trim();
    setChatInput("");
    setChatLoading(true);

    // Append user message to history immediately
    const updatedMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: userMessage },
    ];
    setChatMessages(updatedMessages);
    setAiResponse(""); // Clear single-response area during chat mode

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLesson.id,
          messages: updatedMessages,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        const errMsg = err.error ?? "Lỗi khi chat";
        setChatMessages([...updatedMessages, { role: "assistant", content: `❌ ${typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg)}` }]);
        setChatLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantResponse += decoder.decode(value);
          // Live-update the assistant message in-place
          setChatMessages([
            ...updatedMessages,
            { role: "assistant", content: assistantResponse },
          ]);
        }
      }

      // Final state with complete response
      setChatMessages([
        ...updatedMessages,
        { role: "assistant", content: assistantResponse },
      ]);
    } catch {
      setChatMessages([...updatedMessages, { role: "assistant", content: "❌ Lỗi kết nối khi chat" }]);
    }
    setChatLoading(false);
  };

  const handleSaveManualTranscript = async () => {
    if (!selectedLesson || !manualTranscript) return;
    await fetch(`/api/lessons/${selectedLesson.id}/transcript`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: manualTranscript }),
    });
    const updatedLesson = { ...selectedLesson, transcript: manualTranscript };
    setSelectedLesson(updatedLesson);
    if (selectedCourse) {
      const updatedLessons = selectedCourse.lessons.map((l) =>
        l.id === updatedLesson.id ? updatedLesson : l
      );
      setSelectedCourse({ ...selectedCourse, lessons: updatedLessons });
    }
    alert("Transcript saved!");
  };

  const isConfigured = !!(settings.apiKey && settings.model);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Udemy Transcript Analyzer</h1>
          <button
            onClick={handleOpenSettings}
            title="AI Settings"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              isConfigured
                ? "bg-white border-green-400 text-green-700 hover:bg-green-50"
                : "bg-white border-orange-400 text-orange-600 hover:bg-orange-50"
            }`}
          >
            <span>⚙️</span>
            <span>{isConfigured ? `Model: ${settings.model}` : "Configure AI"}</span>
            {!isConfigured && <span className="text-orange-500">●</span>}
          </button>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-800">AI Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Base URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={draftSettings.baseUrl}
                    onChange={(e) =>
                      setDraftSettings((p) => ({ ...p, baseUrl: e.target.value }))
                    }
                    placeholder="https://api.openai.com/v1"
                    className="w-full p-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    OpenAI-compatible endpoint (OpenAI, Together, Groq, Ollama, LM Studio…)
                  </p>
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={draftSettings.apiKey}
                    onChange={(e) =>
                      setDraftSettings((p) => ({ ...p, apiKey: e.target.value }))
                    }
                    placeholder="sk-..."
                    className="w-full p-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Divider */}
                <div className="border-t pt-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Udemy Import</p>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Udemy Cookie <span className="text-gray-400 font-normal">(access_token)</span>
                  </label>
                  <input
                    type="password"
                    value={draftSettings.udemyCookie}
                    onChange={(e) =>
                      setDraftSettings((p) => ({ ...p, udemyCookie: e.target.value }))
                    }
                    placeholder="Paste access_token từ udemy.com..."
                    className="w-full p-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    F12 → Application → Cookies → udemy.com → copy giá trị <code>access_token</code>
                  </p>
                </div>

                {/* Fetch Models Button */}
                <button
                  onClick={() => fetchModels(draftSettings)}
                  disabled={fetchingModels || !draftSettings.baseUrl || !draftSettings.apiKey}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {fetchingModels ? "Đang tải models..." : "🔄 Lấy danh sách Models"}
                </button>

                {modelsError && (
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{modelsError}</p>
                )}

                {/* Model Dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  {models.length > 0 ? (
                    <select
                      value={draftSettings.model}
                      onChange={(e) =>
                        setDraftSettings((p) => ({ ...p, model: e.target.value }))
                      }
                      className="w-full p-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— chọn model —</option>
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={draftSettings.model}
                      onChange={(e) =>
                        setDraftSettings((p) => ({ ...p, model: e.target.value }))
                      }
                      placeholder="gpt-4o (nhập tay hoặc tải danh sách)"
                      className="w-full p-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={!draftSettings.apiKey || !draftSettings.model}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Lưu Settings
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Course */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Thêm Course</h2>

            {/* Import from Udemy */}
            <div className="mb-4">
              <h3 className="font-medium text-sm mb-2 text-orange-600">📥 Import từ Udemy</h3>
              {settings.udemyCookie ? (
                <button
                  onClick={() => { setShowImport(true); handleFetchUdemyCourses(settings.udemyCookie); }}
                  className="w-full bg-orange-500 text-white p-2 rounded hover:bg-orange-600 text-sm"
                >
                  🎓 Chọn Course từ Udemy
                </button>
              ) : (
                <button
                  onClick={handleOpenSettings}
                  className="w-full bg-orange-100 text-orange-700 border border-orange-300 p-2 rounded text-sm hover:bg-orange-200"
                >
                  ⚙️ Cấu hình Udemy Cookie trước
                </button>
              )}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-medium text-sm mb-2 text-green-600">Tạo thủ công</h3>
              <button
                onClick={handleAddManualCourse}
                className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700"
              >
                + Tạo Course Mới
              </button>
            </div>
          </div>

          {/* Course List */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Danh sách Courses</h2>
            {courses.length === 0 ? (
              <p className="text-gray-500">Chưa có course nào</p>
            ) : (
              <ul className="space-y-2">
                {courses.map((course) => (
                  <li
                    key={course.id}
                    className={`p-3 rounded cursor-pointer ${
                      selectedCourse?.id === course.id
                        ? "bg-blue-100 border-blue-500"
                        : "bg-gray-50 hover:bg-gray-100"
                    } border`}
                    onClick={() => {
                      setSelectedCourse(course);
                      setSelectedLesson(null);
                      setChatMessages([]);
                      setAiResponse("");
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium truncate">{course.title}</p>
                        <p className="text-xs text-gray-500">{course.lessons.length} lessons</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCourse(course.id);
                        }}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Xóa
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Lesson List */}
          {selectedCourse && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Danh sách Lessons</h2>
              <button
                onClick={handleAddLesson}
                className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 mb-3"
              >
                + Thêm Bài Học
              </button>
              <ul className="space-y-2 max-h-96 overflow-y-auto">
                {selectedCourse.lessons.map((lesson) => (
                  <li
                    key={lesson.id}
                    className={`p-3 rounded cursor-pointer ${
                      selectedLesson?.id === lesson.id
                        ? "bg-green-100 border-green-500"
                        : "bg-gray-50 hover:bg-gray-100"
                    } border`}
                    onClick={() => {
                      setSelectedLesson(lesson);
                      setManualTranscript(lesson.transcript || "");
                      setChatMessages([]);
                      setAiResponse("");
                    }}
                  >
                    <p className="font-medium text-sm">
                      {lesson.order}. {lesson.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {lesson.transcript ? "✓ Có transcript" : "✗ Chưa có transcript"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Lesson Detail */}
        {selectedLesson && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transcript */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">
                Transcript: {selectedLesson.title}
              </h2>
              {selectedLesson.transcript ? (
                <div className="bg-gray-50 p-3 rounded text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {selectedLesson.transcript}
                </div>
              ) : (
                <div>
                  <p className="text-red-500 mb-2">
                    Chưa có transcript. Bạn có thể paste thủ công:
                  </p>
                  <textarea
                    value={manualTranscript}
                    onChange={(e) => setManualTranscript(e.target.value)}
                    placeholder="Paste transcript here..."
                    className="w-full p-2 border rounded h-48"
                  />
                  <button
                    onClick={handleSaveManualTranscript}
                    className="mt-2 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Lưu Transcript
                  </button>
                </div>
              )}
            </div>

            {/* AI Assistant */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                {!isConfigured && (
                  <button
                    onClick={handleOpenSettings}
                    className="text-xs text-orange-600 underline"
                  >
                    ⚠️ Chưa cấu hình
                  </button>
                )}
                {isConfigured && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                    {settings.model}
                  </span>
                )}
              </div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={handleSummary}
                  disabled={!selectedLesson.transcript || loadingCourse}
                  className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400"
                >
                  Tóm tắt
                </button>
                <button
                  onClick={handleExplain}
                  disabled={!selectedLesson.transcript || loadingCourse}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  Giải thích
                </button>
              </div>
              <form onSubmit={handleChat} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Hỏi về bài học..."
                  className="flex-1 p-2 border rounded"
                  disabled={!selectedLesson.transcript}
                />
                <button
                  type="submit"
                  disabled={!selectedLesson.transcript || chatLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Gửi
                </button>
              </form>
              <div className="bg-gray-50 p-3 rounded min-h-48 max-h-[32rem] overflow-y-auto text-sm">
                {chatMessages.length > 0 ? (
                  <div className="space-y-3">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap ${
                            msg.role === "user"
                              ? "bg-blue-600 text-white"
                              : "bg-white border border-gray-200 text-gray-800"
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && chatMessages[chatMessages.length - 1]?.role === "user" && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-400">
                          Đang trả lời...
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">
                    {aiResponse || "AI response will appear here..."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Udemy Import Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">🎓 Import từ Udemy</h2>
              <button onClick={() => { setShowImport(false); setUdemyCourses([]); setUdemyError(""); setImportProgress(""); }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {fetchingUdemy && (
                <div className="text-center py-8 text-gray-500">⏳ Đang lấy danh sách courses...</div>
              )}
              {udemyError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded mb-4">{udemyError}</div>
              )}
              {importProgress && (
                <div className={`text-sm p-3 rounded mb-4 ${importProgress.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                  {importProgress}
                </div>
              )}
              {udemyCourses.length > 0 && (
                <ul className="space-y-2">
                  {udemyCourses.map((c) => (
                    <li key={c.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-medium text-sm truncate">{c.title}</p>
                        <p className="text-xs text-gray-400">{c.num_lectures} bài học</p>
                      </div>
                      <button
                        onClick={() => handleImportCourse(c)}
                        disabled={importingId === c.id}
                        className="shrink-0 bg-orange-500 text-white px-3 py-1.5 rounded text-sm hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {importingId === c.id ? "Đang import..." : "Import"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-4 border-t flex justify-between items-center">
              <button
                onClick={() => handleFetchUdemyCourses(settings.udemyCookie)}
                disabled={fetchingUdemy}
                className="text-sm text-blue-600 hover:underline disabled:text-gray-400"
              >
                🔄 Tải lại
              </button>
              <button
                onClick={() => { setShowImport(false); setUdemyCourses([]); setUdemyError(""); setImportProgress(""); }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
