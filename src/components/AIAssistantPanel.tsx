"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  AlertCircle,
  Zap,
  FileText,
  BookOpen,
  MessageCircle,
  Map,
  Loader2,
  GraduationCap,
  StickyNote,
  Trash2,
  X,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { QuizPlayer } from "@/components/QuizPlayer";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ExerciseList } from "@/components/ExerciseList";
import { NotesEditor } from "@/components/NotesEditor";
import { LearnerProfileModal } from "@/components/LearnerProfileModal";
import { ExportDropdown } from "@/components/ExportDropdown";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { AnalyticsCourseDetail } from "@/components/AnalyticsCourseDetail";

// ── Types ──────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  order: number;
  transcript: string | null;
}

interface AISettings {
  baseUrl: string;
  apiKey: string;
  model: string;
  udemyCookie: string;
}

interface AIAssistantPanelProps {
  lesson: Lesson;
  courseId: string;
  contentType?: string;
  settings: AISettings;
  isConfigured: boolean;
  onOpenSettings: () => void;
  onChatCountChange?: (count: number) => void;
  externalExplainText?: string | null;
  onExternalExplainHandled?: () => void;
  onQuizComplete?: (lessonId: string, score: number) => void;
}

type TabType = "summary" | "explain" | "chat" | "roadmap" | "notes" | "practice" | "analytics";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_HISTORY = 20;

const TABS: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: "summary", label: "Tóm tắt", icon: FileText },
  { key: "explain", label: "Giải thích", icon: BookOpen },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "roadmap", label: "Lộ trình", icon: Map },
  { key: "notes", label: "Ghi chú", icon: StickyNote },
  { key: "practice", label: "Luyện tập", icon: GraduationCap },
  { key: "analytics", label: "Thống kê", icon: BarChart3 },
];

// ── Component ──────────────────────────────────────────────────

export function AIAssistantPanel({
  lesson,
  courseId,
  contentType,
  settings,
  isConfigured,
  onOpenSettings,
  onChatCountChange,
  externalExplainText,
  onExternalExplainHandled,
  onQuizComplete,
}: AIAssistantPanelProps) {
  // Tab
  const [activeTab, setActiveTab] = useState<TabType>("summary");

  // Isolated results per tab
  const [summaryResult, setSummaryResult] = useState("");
  const [explainResult, setExplainResult] = useState("");
  const [roadmapResult, setRoadmapResult] = useState("");

  // Chat state (fully isolated)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const lastSavedChatCountRef = useRef(0);

  // Loading states per tab
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  // Practice tab state
  const [quizResult, setQuizResult] = useState("");
  const [flashcardsResult, setFlashcardsResult] = useState("");
  const [exercisesResult, setExercisesResult] = useState("");
  const [quizLoading, setQuizLoading] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [practiceMode, setPracticeMode] = useState<"quiz" | "flashcards" | "exercises">("quiz");

  // SRS state
  const [srsMode, setSrsMode] = useState(false);
  const [dueBadge, setDueBadge] = useState(0);

  // AI mode selectors
  const [socraticMode, setSocraticMode] = useState(false);
  const [explainDepth, setExplainDepth] = useState<"simple" | "standard" | "deep">("standard");
  const [summaryMode, setSummaryMode] = useState<"quick" | "detailed">("detailed");

  // Learner profile state
  const [learnerProfile, setLearnerProfile] = useState<{
    level: string;
    goal: string;
    dailyTimeMin: number;
    knownTopics: string[];
    learningStyle: string;
  } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  // Persistence loading flag
  const [dbLoading, setDbLoading] = useState(false);

  // Notes state
  const [notesContent, setNotesContent] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [insertToNotesText, setInsertToNotesText] = useState<string | null>(null);

  // AI generation progress
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // [Fix H-3] Per-action abort controllers (keyed by action name)
  const abortControllersRef = useRef<Record<string, AbortController>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // [Fix CRIT-1] Track current lessonId via ref so streaming closures can detect lesson switches
  const lessonIdRef = useRef(lesson.id);

  // Ref for auto-scroll in chat
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hasTranscript = !!lesson.transcript;

  // [Fix CRIT-1] Keep lessonIdRef in sync with the current lesson prop
  useEffect(() => {
    lessonIdRef.current = lesson.id;
  }, [lesson.id]);

  // ── Generation timer helpers ──

  const startGenTimer = () => {
    setElapsedSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  };

  const stopGenTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedSeconds(0);
  };

  const cancelGeneration = () => {
    // [Fix H-3] Abort ALL active controllers
    Object.values(abortControllersRef.current).forEach((c) => c.abort());
    abortControllersRef.current = {};
    stopGenTimer();
  };

  // [Fix H-3] Create (and cancel any existing) controller for a given action key
  const createAbortController = (key: string): AbortController => {
    abortControllersRef.current[key]?.abort();
    const controller = new AbortController();
    abortControllersRef.current[key] = controller;
    return controller;
  };

  const clearAbortController = (key: string) => {
    delete abortControllersRef.current[key];
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // [Fix H-3] Abort all active controllers on unmount
      Object.values(abortControllersRef.current).forEach((c) => c.abort());
      abortControllersRef.current = {};
    };
  }, []);

  // ── Reset + load persisted data when lesson changes ──

  useEffect(() => {
    // Reset lesson-scoped state
    setSummaryResult("");
    setExplainResult("");
    setChatMessages([]);
    setChatInput("");
    setQuizResult("");
    setFlashcardsResult("");
    setExercisesResult("");
    setNotesContent("");
    setSrsMode(false);
    lastSavedChatCountRef.current = 0;

    // Load saved AI data from DB (lesson-level: summary + explanation + practice)
    const loadSaved = async () => {
      const controller = new AbortController();
      setDbLoading(true);
      try {
        const res = await fetch(`/api/lessons/${lesson.id}/ai`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.summary) setSummaryResult(data.summary);
          if (data.explanation) setExplainResult(data.explanation);
          if (data.quiz) setQuizResult(data.quiz);
          if (data.flashcards) setFlashcardsResult(data.flashcards);
          if (data.exercises) setExercisesResult(data.exercises);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Silently fail — user can regenerate
      }
      // Load chat history
      try {
        const chatRes = await fetch(`/api/lessons/${lesson.id}/chat`, { signal: controller.signal });
        if (chatRes.ok) {
          const chatData = await chatRes.json();
          if (Array.isArray(chatData) && chatData.length > 0) {
            setChatMessages((prev) => {
              const mapped = chatData.map((m: { role: string; content: string }) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
              }));
              const updated = mapped;
              return updated.length > MAX_HISTORY ? updated.slice(updated.length - MAX_HISTORY) : updated;
            });
            lastSavedChatCountRef.current = chatData.length;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Silently fail
      }
      // Load notes
      try {
        const notesRes = await fetch(`/api/lessons/${lesson.id}/notes`, { signal: controller.signal });
        if (notesRes.ok) {
          const notesData = await notesRes.json();
          if (notesData.notes) setNotesContent(notesData.notes);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Silently fail
      } finally {
        setDbLoading(false);
      }
      return () => controller.abort();
    };

    loadSaved();
  }, [lesson.id]);

  // ── Load course-level roadmap when courseId changes ──

  useEffect(() => {
    setRoadmapResult("");

    const loadCourseAI = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/ai`);
        if (res.ok) {
          const data = await res.json();
          if (data.roadmap) setRoadmapResult(data.roadmap);
        }
      } catch {
        // Silently fail
      }
    };

    loadCourseAI();
  }, [courseId]);

  // ── Load learner profile when courseId changes ──

  useEffect(() => {
    setLearnerProfile(null);
    setProfileChecked(false);
    const checkProfile = async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/profile`);
        if (res.ok) {
          const data = await res.json();
          setLearnerProfile(data);
        }
      } catch {
        // silent
      }
      setProfileChecked(true);
    };
    checkProfile();
  }, [courseId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Load SRS due count when flashcards are available
  useEffect(() => {
    if (!flashcardsResult) return;
    const loadDue = async () => {
      try {
        const res = await fetch(`/api/lessons/${lesson.id}/srs/due`);
        if (res.ok) {
          const data = await res.json();
          setDueBadge(data.dueCards?.length || 0);
        }
      } catch {
        // silent
      }
    };
    loadDue();
  }, [flashcardsResult, lesson.id]);

  // Report unsaved chat message count to parent (for leave-warning)
  useEffect(() => {
    const unsavedCount = chatMessages.length - lastSavedChatCountRef.current;
    onChatCountChange?.(unsavedCount > 0 ? unsavedCount : 0);
  }, [chatMessages.length, onChatCountChange]);

  // ── Handle external explain request (from TranscriptPanel highlight-to-explain) ──
  useEffect(() => {
    if (!externalExplainText || !isConfigured || explainLoading) return;
    // [Fix H-2] AbortController so fetch is cancelled if effect re-runs or component unmounts
    const controller = new AbortController();
    setActiveTab("explain");
    setExplainLoading(true);
    setExplainResult("");
    const doExplain = async () => {
      try {
        const res = await fetch("/api/ai/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...apiBody(),
            selectedText: externalExplainText,
            force: true,
          }),
          signal: controller.signal,
        });
        const result = await readStreamOrJson(
          res, "explanation", setExplainResult, controller.signal,
        );
        if (!result) setExplainResult("Không có kết quả.");
      } catch (err) {
        // [Fix H-2] Suppress abort errors — expected on cleanup
        if (err instanceof Error && err.name === "AbortError") return;
        setExplainResult("Lỗi khi giải thích.");
      }
      setExplainLoading(false);
      onExternalExplainHandled?.();
    };
    doExplain();
    // [Fix H-2] Cancel in-flight fetch on cleanup
    return () => controller.abort();
  }, [externalExplainText]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── API helpers ──

  const apiBody = useCallback(
    () => ({
      lessonId: lesson.id,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
      ...(contentType ? { contentType } : {}),
    }),
    [lesson.id, settings.apiKey, settings.baseUrl, settings.model, contentType]
  );

  /**
   * Reads a streaming response progressively, calling onChunk with the
   * accumulated text after each chunk. If the response is JSON (cached),
   * it extracts the value using jsonKey and returns it directly.
   */
  const readStreamOrJson = async (
    res: Response,
    jsonKey: string,
    onChunk: (accumulated: string) => void,
    signal?: AbortSignal,
  ): Promise<string> => {
    // Check if response is JSON (cached result) or streaming
    const contentType = res.headers.get("Content-Type") || "";
    const isStreaming = res.headers.get("X-Content-Type") === "streaming"
      || contentType.startsWith("text/plain");

    if (!isStreaming) {
      // JSON response (cached or error)
      const data = await res.json();
      if (data.error) return data.error;
      const value = data[jsonKey] || "Không có kết quả.";
      onChunk(value);
      return value;
    }

    // Streaming response — read progressively
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";

    if (reader) {
      while (true) {
        if (signal?.aborted) {
          reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value);
        onChunk(accumulated);
      }
    }

    return accumulated;
  };

  const handleSummary = async () => {
    if (!hasTranscript || !isConfigured || summaryLoading) return;
    // [Fix H-3] Per-action abort controller
    const controller = createAbortController('summary');
    setSummaryLoading(true);
    setSummaryResult("");
    startGenTimer();
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...apiBody(), mode: summaryMode }),
        signal: controller.signal,
      });
      const result = await readStreamOrJson(
        res, "summary", setSummaryResult, controller.signal,
      );
      if (!result) setSummaryResult("Không có kết quả.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setSummaryResult("");
        toast.info("Đã hủy tạo tóm tắt");
      } else {
        setSummaryResult("Lỗi khi tạo tóm tắt.");
        toast.error("Lỗi khi tạo tóm tắt");
      }
    }
    clearAbortController('summary');
    stopGenTimer();
    setSummaryLoading(false);
  };

  const handleExplain = async () => {
    if (!hasTranscript || !isConfigured || explainLoading) return;
    // [Fix H-3] Per-action abort controller
    const controller = createAbortController('explain');
    setExplainLoading(true);
    setExplainResult("");
    startGenTimer();
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...apiBody(), depth: explainDepth }),
        signal: controller.signal,
      });
      const result = await readStreamOrJson(
        res, "explanation", setExplainResult, controller.signal,
      );
      if (!result) setExplainResult("Không có kết quả.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setExplainResult("");
        toast.info("Đã hủy giải thích");
      } else {
        setExplainResult("Lỗi khi giải thích.");
        toast.error("Lỗi khi giải thích");
      }
    }
    clearAbortController('explain');
    stopGenTimer();
    setExplainLoading(false);
  };

  const handleRoadmap = async () => {
    if (!isConfigured || roadmapLoading) return;
    // [Fix H-3] Per-action abort controller
    const controller = createAbortController('roadmap');
    setRoadmapLoading(true);
    setRoadmapResult("");
    startGenTimer();
    try {
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        }),
        signal: controller.signal,
      });
      const result = await readStreamOrJson(
        res, "roadmap", setRoadmapResult, controller.signal,
      );
      if (!result) setRoadmapResult("Không có kết quả.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setRoadmapResult("");
        toast.info("Đã hủy tạo lộ trình");
      } else {
        setRoadmapResult("Lỗi khi tạo lộ trình.");
        toast.error("Lỗi khi tạo lộ trình");
      }
    }
    clearAbortController('roadmap');
    stopGenTimer();
    setRoadmapLoading(false);
  };

  const handlePractice = async () => {
    if (!hasTranscript || !isConfigured) return;

    const setLoading =
      practiceMode === "quiz"
        ? setQuizLoading
        : practiceMode === "flashcards"
          ? setFlashcardsLoading
          : setExercisesLoading;
    const setResult =
      practiceMode === "quiz"
        ? setQuizResult
        : practiceMode === "flashcards"
          ? setFlashcardsResult
          : setExercisesResult;

    const isCurrentlyLoading =
      practiceMode === "quiz"
        ? quizLoading
        : practiceMode === "flashcards"
          ? flashcardsLoading
          : exercisesLoading;

    if (isCurrentlyLoading) return;

    // [Fix H-3] Per-action abort controller (keyed by practice mode)
    const controller = createAbortController(`practice-${practiceMode}`);
    setLoading(true);
    setResult("");
    startGenTimer();
    try {
      const res = await fetch("/api/ai/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...apiBody(), mode: practiceMode }),
        signal: controller.signal,
      });
      const result = await readStreamOrJson(
        res, "result", setResult, controller.signal,
      );
      if (!result) setResult("Không có kết quả.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setResult("");
        toast.info("Đã hủy tạo nội dung");
      } else {
        setResult("Lỗi khi tạo nội dung luyện tập.");
        toast.error("Lỗi khi tạo nội dung luyện tập");
      }
    }
    clearAbortController(`practice-${practiceMode}`);
    stopGenTimer();
    setLoading(false);
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTranscript || !chatInput.trim() || !isConfigured || chatLoading)
      return;

    const currentLessonId = lesson.id; // Capture lessonId at call time
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    // Add placeholder assistant message for streaming
    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setChatMessages([...updatedMessages, assistantMsg]);

    // [Fix H-3] Per-action abort controller for chat
    const controller = createAbortController('chat');
    let finalResponse = "";

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...apiBody(),
          messages: updatedMessages,
          socraticMode,
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let response = "";

      if (reader) {
        while (true) {
          // [Fix CRIT-1] Guard: if lesson switched mid-stream, cancel and discard
          if (lessonIdRef.current !== currentLessonId) {
            reader.cancel();
            break;
          }
          const { done, value } = await reader.read();
          if (done) break;
          response += decoder.decode(value);
          // Update last assistant message in real-time
          setChatMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: response };
            return copy;
          });
        }
      }
      finalResponse = response;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setChatMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Lỗi khi chat. Vui lòng thử lại.",
        };
        return copy;
      });
      toast.error("Lỗi khi chat");
    }

    clearAbortController('chat');
    setChatLoading(false);

    // [Fix CRIT-1] Discard DB persistence if lessonId changed during streaming
    if (lessonIdRef.current !== currentLessonId) {
      return;
    }

    // Persist chat messages to DB (fire-and-forget)
    if (finalResponse) {
      try {
        await fetch(`/api/lessons/${lesson.id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content: userMsg.content }),
        });
        await fetch(`/api/lessons/${lesson.id}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: finalResponse }),
        });
        lastSavedChatCountRef.current = chatMessages.length + 2;
      } catch {
        // Silently fail — chat still works in memory
      }
    }
  };

  // ── Render helpers ──

  const renderSkeleton = () => (
    <div className="flex flex-col gap-3 p-3.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 min-h-[160px]">
      <Skeleton className="h-4 w-[70%]" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-[90%]" />
      <Skeleton className="h-3 w-[60%]" />
      <div className="mt-2 flex flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-[80%]" />
      </div>
    </div>
  );

  const renderResult = (
    content: string,
    placeholder: string,
    isLoading: boolean
  ) => (
    <ScrollArea className="flex-1 min-h-[160px]">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 min-h-[160px]">
        {dbLoading && !content && !isLoading ? (
          renderSkeleton()
        ) : isLoading && !content ? (
          <div className="flex flex-col gap-2.5">
            <span className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Đang tạo...{elapsedSeconds > 0 && ` (${elapsedSeconds}s)`}
            </span>
            <button
              onClick={cancelGeneration}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors w-fit cursor-pointer"
            >
              <X className="w-3 h-3" />
              Hủy
            </button>
          </div>
        ) : content ? (
          <>
            <MarkdownRenderer content={content} />
            {isLoading && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <Loader2 className="w-3 h-3 animate-spin text-[#A435F0]" />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Đang tạo...{elapsedSeconds > 0 && ` (${elapsedSeconds}s)`}
                </span>
                <button
                  onClick={cancelGeneration}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer ml-auto"
                >
                  <X className="w-3 h-3" />
                  Hủy
                </button>
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}
      </div>
    </ScrollArea>
  );

  const renderActionButton = (
    label: string,
    existingLabel: string,
    hasResult: boolean,
    isLoading: boolean,
    onClick: () => void,
    skipTranscriptCheck = false,
  ) => {
    const isDisabled = (!skipTranscriptCheck && !hasTranscript) || !isConfigured || isLoading;
    const buttonContent = isLoading ? (
      <span className="flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        Đang tạo...{elapsedSeconds > 0 && ` (${elapsedSeconds}s)`}
      </span>
    ) : hasResult ? (
      existingLabel
    ) : (
      label
    );

    // When loading, show cancel button alongside
    if (isLoading) {
      return (
        <div className="flex gap-1.5">
          <Button
            disabled
            variant="outline"
            size="sm"
            className="flex-1 text-[#A435F0] border-[#A435F0]/20 rounded-lg h-8 text-xs"
          >
            {buttonContent}
          </Button>
          <Button
            onClick={cancelGeneration}
            variant="outline"
            size="sm"
            className="cursor-pointer h-8 px-2.5 text-xs text-gray-400 hover:text-red-500 hover:border-red-200 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      );
    }

    // When cached content exists, wrap with confirmation dialog
    if (hasResult && !isLoading) {
      return (
        <AlertDialog>
          <AlertDialogTrigger
            disabled={isDisabled}
            className="cursor-pointer w-full text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 rounded-lg h-8 text-xs inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors border bg-background shadow-xs"
          >
            {buttonContent}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tạo lại nội dung?</AlertDialogTitle>
              <AlertDialogDescription>
                Nội dung hiện tại sẽ bị thay thế bằng kết quả mới từ AI.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="cursor-pointer">Huỷ</AlertDialogCancel>
              <AlertDialogAction
                onClick={onClick}
                className="bg-[#A435F0] hover:bg-[#8710D8] cursor-pointer"
              >
                Tạo lại
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );
    }

    // First generation — no dialog needed
    return (
      <Button
        onClick={onClick}
        disabled={isDisabled}
        variant="outline"
        size="sm"
        className="cursor-pointer w-full text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 rounded-lg h-8 text-xs"
      >
        {buttonContent}
      </Button>
    );
  };

  // ── Main render ──

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#A435F0]/10 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-[#A435F0]" />
          </div>
          <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              AI Assistant
            </h2>
            {isConfigured && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{settings.model}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab !== "chat" && activeTab !== "notes" && activeTab !== "analytics" && (
            <ExportDropdown
              lessonId={lesson.id}
              courseId={courseId}
              activeTab={activeTab}
              practiceMode={practiceMode}
              hasData={{
                summary: !!summaryResult,
                explanation: !!explainResult,
                quiz: !!quizResult,
                flashcards: !!flashcardsResult,
                exercises: !!exercisesResult,
              }}
            />
          )}
          {dbLoading && (
            <Loader2 className="w-3.5 h-3.5 text-gray-300 animate-spin" />
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 px-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
                isActive
                  ? "text-[#A435F0] border-[#A435F0]"
                  : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col gap-4 p-5">
        {/* Warnings */}
        {!isConfigured && (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-800 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Chưa cấu hình AI.{" "}
              <button
                onClick={onOpenSettings}
                className="underline font-semibold cursor-pointer hover:text-amber-900"
              >
                Cấu hình ngay
              </button>
            </span>
          </div>
        )}

        {!hasTranscript && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Bài học này chưa có transcript.</span>
          </div>
        )}

        {/* Tab: Summary */}
        {activeTab === "summary" && (
          <>
            {/* Summary mode selector */}
            <div className="flex gap-1.5 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
              {([
                { key: "detailed" as const, label: "Chi tiết", desc: "Tóm tắt đầy đủ" },
                { key: "quick" as const, label: "Ngắn gọn", desc: "3-5 điểm chính" },
              ]).map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => setSummaryMode(mode.key)}
                  title={mode.desc}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    summaryMode === mode.key
                      ? "bg-[#A435F0] text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {renderActionButton(
              "Tạo tóm tắt",
              "Tạo lại tóm tắt",
              !!summaryResult,
              summaryLoading,
              handleSummary
            )}
            {renderResult(
              summaryResult,
              "Nhấn nút để AI tóm tắt bài học...",
              summaryLoading
            )}
          </>
        )}

        {/* Tab: Explain */}
        {activeTab === "explain" && (
          <>
            {/* Explain depth selector */}
            <div className="flex gap-1.5 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
              {([
                { key: "simple" as const, label: "Đơn giản", desc: "ELI5 — giải thích cơ bản" },
                { key: "standard" as const, label: "Chuẩn", desc: "Feynman Technique" },
                { key: "deep" as const, label: "Chuyên sâu", desc: "Edge cases, trade-offs" },
              ]).map((d) => (
                <button
                  key={d.key}
                  onClick={() => setExplainDepth(d.key)}
                  title={d.desc}
                  className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    explainDepth === d.key
                      ? "bg-[#A435F0] text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {renderActionButton(
              "Giải thích bài học",
              "Giải thích lại",
              !!explainResult,
              explainLoading,
              handleExplain
            )}
            {renderResult(
              explainResult,
              "Nhấn nút để AI giải thích bài học...",
              explainLoading
            )}
          </>
        )}

        {/* Tab: Roadmap (course-level — không cần transcript của bài hiện tại) */}
        {activeTab === "roadmap" && (
          <>
            {/* Learner Profile prompt */}
            {profileChecked && !learnerProfile && (
              <div className="bg-gradient-to-br from-[#A435F0]/5 to-purple-100/30 dark:from-gray-800 dark:to-gray-800/50 border border-[#A435F0]/20 dark:border-gray-700 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-1">
                  🎯 Cá nhân hóa lộ trình?
                </p>
                <p className="text-[10px] text-gray-500 mb-3">
                  Hãy cho chúng tôi biết về bạn để AI tạo lộ trình phù hợp nhất.
                </p>
                <Button
                  onClick={() => setShowProfileModal(true)}
                  size="sm"
                  className="cursor-pointer bg-[#A435F0] hover:bg-[#8710D8] text-white text-xs"
                >
                  Tạo hồ sơ học viên
                </Button>
              </div>
            )}

            {/* Roadmap action buttons */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                {renderActionButton(
                  "Tạo lộ trình toàn khóa",
                  "Tạo lại lộ trình",
                  !!roadmapResult,
                  roadmapLoading,
                  handleRoadmap,
                  true, // course-level: no transcript required
                )}
              </div>
              {learnerProfile && (
                <Button
                  onClick={() => setShowProfileModal(true)}
                  variant="outline"
                  size="sm"
                  className="cursor-pointer text-[10px] text-gray-500 border-gray-200 dark:border-gray-700 hover:text-[#A435F0] hover:border-[#A435F0]/20 shrink-0 h-8"
                >
                  Cập nhật hồ sơ
                </Button>
              )}
            </div>

            {renderResult(
              roadmapResult,
              "Nhấn nút để AI phân tích toàn khóa và đề xuất lộ trình học tập...",
              roadmapLoading
            )}

            {/* Learner Profile Modal */}
            <LearnerProfileModal
              open={showProfileModal}
              courseId={courseId}
              existingProfile={learnerProfile}
              onClose={() => setShowProfileModal(false)}
              onSaved={(profile) => {
                const wasNew = !learnerProfile;
                setLearnerProfile(profile);
                if (wasNew) {
                  toast.success("Hồ sơ đã tạo! Đang tạo lộ trình cá nhân...");
                  handleRoadmap();
                } else {
                  toast.success("Hồ sơ đã cập nhật. Bạn có thể tạo lại lộ trình.");
                }
              }}
            />
          </>
        )}

        {/* Tab: Notes */}
        {activeTab === "notes" && (
          <NotesEditor
            lessonId={lesson.id}
            lessonTitle={lesson.title}
            courseId={courseId}
            insertText={insertToNotesText}
            onInsertHandled={() => setInsertToNotesText(null)}
          />
        )}

        {/* Tab: Practice */}
        {activeTab === "practice" && (
          <>
            {/* Sub-mode selector */}
            <div className="flex gap-1.5 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
              {([
                { key: "quiz" as const, label: "Quiz", icon: "📝" },
                { key: "flashcards" as const, label: "Flashcard", icon: "🃏" },
                { key: "exercises" as const, label: "Bài tập", icon: "🏋️" },
              ]).map((mode) => (
                <button
                  key={mode.key}
                  onClick={() => setPracticeMode(mode.key)}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    practiceMode === mode.key
                      ? "bg-[#A435F0] text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <span className="text-xs">{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Action button */}
            {practiceMode === "quiz" &&
              renderActionButton(
                "Tạo Quiz",
                "Tạo lại Quiz",
                !!quizResult,
                quizLoading,
                handlePractice
              )}
            {practiceMode === "flashcards" &&
              renderActionButton(
                "Tạo Flashcard",
                "Tạo lại Flashcard",
                !!flashcardsResult,
                flashcardsLoading,
                handlePractice
              )}
            {/* SRS toggle for flashcards */}
            {practiceMode === "flashcards" && flashcardsResult && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setSrsMode(!srsMode)}
                  variant={srsMode ? "default" : "outline"}
                  size="sm"
                  className={`text-xs cursor-pointer ${
                    srsMode
                      ? "bg-[#A435F0] hover:bg-[#8710D8] text-white"
                      : "text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5"
                  }`}
                >
                  🧠 Ôn tập SRS
                  {dueBadge > 0 && !srsMode && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                      {dueBadge}
                    </span>
                  )}
                </Button>
                {srsMode && (
                  <span className="text-[10px] text-gray-400">
                    Chế độ ôn tập thông minh
                  </span>
                )}
              </div>
            )}
            {practiceMode === "exercises" &&
              renderActionButton(
                "Tạo bài tập",
                "Tạo lại bài tập",
                !!exercisesResult,
                exercisesLoading,
                handlePractice
              )}

            {/* Result display */}
            {practiceMode === "quiz" &&
              (dbLoading && !quizResult && !quizLoading ? (
                renderSkeleton()
              ) : quizLoading ? (
                renderResult(
                  "",
                  "Nhấn nút để AI tạo quiz kiểm tra kiến thức...",
                  true
                )
              ) : quizResult ? (
                <ScrollArea className="flex-1 min-h-[160px]">
                  <QuizPlayer markdown={quizResult} onComplete={(score) => onQuizComplete?.(lesson.id, score)} />
                </ScrollArea>
              ) : (
                renderResult(
                  "",
                  "Nhấn nút để AI tạo quiz kiểm tra kiến thức...",
                  false
                )
              ))}
            {practiceMode === "flashcards" &&
              (dbLoading && !flashcardsResult && !flashcardsLoading ? (
                renderSkeleton()
              ) : flashcardsLoading ? (
                renderResult(
                  "",
                  "Nhấn nút để AI tạo flashcard ôn tập...",
                  true
                )
              ) : flashcardsResult ? (
                <ScrollArea className="flex-1 min-h-[160px]">
                  <FlashcardDeck
                    markdown={flashcardsResult}
                    mode={srsMode ? "srs" : "normal"}
                    lessonId={lesson.id}
                    onFlashcardsChange={(newMarkdown) => {
                      setFlashcardsResult(newMarkdown);
                      fetch(`/api/lessons/${lesson.id}/ai`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ flashcards: newMarkdown }),
                      }).catch(() => {
                        toast.error("Lỗi khi lưu flashcard");
                      });
                    }}
                    onReviewComplete={() => {
                      setDueBadge(0);
                      toast.success("Hoàn thành ôn tập SRS!");
                    }}
                  />
                </ScrollArea>
              ) : (
                renderResult(
                  "",
                  "Nhấn nút để AI tạo flashcard ôn tập...",
                  false
                )
              ))}
            {practiceMode === "exercises" &&
              (dbLoading && !exercisesResult && !exercisesLoading ? (
                renderSkeleton()
              ) : exercisesLoading ? (
                renderResult(
                  "",
                  "Nhấn nút để AI tạo bài tập thực hành...",
                  true
                )
              ) : exercisesResult ? (
                <ScrollArea className="flex-1 min-h-[160px]">
                  <ExerciseList markdown={exercisesResult} />
                </ScrollArea>
              ) : (
                renderResult(
                  "",
                  "Nhấn nút để AI tạo bài tập thực hành...",
                  false
                )
              ))}
          </>
        )}

        {/* Tab: Chat */}
        {activeTab === "chat" && (
          <>
            {chatMessages.length > 0 && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await fetch(`/api/lessons/${lesson.id}/chat`, { method: "DELETE" });
                      setChatMessages([]);
                      lastSavedChatCountRef.current = 0;
                      toast.success("Đã xóa lịch sử chat");
                    } catch {
                      toast.error("Lỗi khi xóa lịch sử chat");
                    }
                  }}
                  className="text-xs text-gray-400 hover:text-red-500 h-6 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Xóa lịch sử
                </Button>
              </div>
            )}
            {/* Chat messages */}
            <ScrollArea className="flex-1 min-h-[160px]">
              <div className="flex flex-col gap-2.5 min-h-[160px]">
                {chatMessages.length === 0 && (
                  <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 text-center">
                    Hỏi bất cứ điều gì về bài học...
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#A435F0] text-white whitespace-pre-wrap"
                          : "bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {msg.content ? (
                        msg.role === "assistant" ? (
                          <>
                            <MarkdownRenderer content={msg.content} />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInsertToNotesText(msg.content);
                                setActiveTab("notes");
                                toast.success("Đã chèn vào ghi chú");
                              }}
                              className="mt-1 text-[10px] text-gray-400 hover:text-[#A435F0] cursor-pointer flex items-center gap-1"
                              title="Chèn vào ghi chú"
                            >
                              <StickyNote className="w-3 h-3" />
                              Chèn vào ghi chú
                            </button>
                          </>
                        ) : (
                          msg.content
                        )
                      ) : (
                        chatLoading && i === chatMessages.length - 1 ? (
                          <span className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Đang trả lời...
                          </span>
                        ) : null
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Socratic mode toggle + Chat input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSocraticMode(!socraticMode)}
                  className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors cursor-pointer border ${
                    socraticMode
                      ? "bg-[#A435F0]/10 text-[#A435F0] border-[#A435F0]/30"
                      : "text-gray-400 border-gray-200 dark:border-gray-700 hover:text-gray-600 hover:border-gray-300"
                  }`}
                  title={socraticMode ? "AI dẫn dắt tư duy thay vì trả lời thẳng" : "Bật chế độ dẫn dắt tư duy (Socratic)"}
                >
                  🧠 Socratic
                </button>
                {socraticMode && (
                  <span className="text-[10px] text-gray-400">AI sẽ dẫn dắt bạn tự tìm câu trả lời</span>
                )}
              </div>
              <form onSubmit={handleChat} className="flex gap-1.5">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Hỏi về bài học..."
                disabled={!hasTranscript || !isConfigured}
                className="flex-1 text-xs h-8 border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
              />
              <Button
                type="submit"
                size="sm"
                disabled={
                  !hasTranscript ||
                  !isConfigured ||
                  chatLoading ||
                  !chatInput.trim()
                }
                className="cursor-pointer h-8 w-8 p-0 bg-[#A435F0] hover:bg-[#8710D8] shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
            </div>
          </>
        )}

        {/* Tab: Analytics */}
        {activeTab === "analytics" && (
          <AnalyticsCourseDetail courseId={courseId} />
        )}
      </div>
    </div>
  );
}
