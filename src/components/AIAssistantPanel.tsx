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
  X,
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
  settings: AISettings;
  isConfigured: boolean;
  onOpenSettings: () => void;
  onChatCountChange?: (count: number) => void;
  externalExplainText?: string | null;
  onExternalExplainHandled?: () => void;
}

type TabType = "summary" | "explain" | "chat" | "roadmap" | "practice";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const TABS: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: "summary", label: "Tóm tắt", icon: FileText },
  { key: "explain", label: "Giải thích", icon: BookOpen },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "roadmap", label: "Lộ trình", icon: Map },
  { key: "practice", label: "Luyện tập", icon: GraduationCap },
];

// ── Component ──────────────────────────────────────────────────

export function AIAssistantPanel({
  lesson,
  courseId,
  settings,
  isConfigured,
  onOpenSettings,
  onChatCountChange,
  externalExplainText,
  onExternalExplainHandled,
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

  // Persistence loading flag
  const [dbLoading, setDbLoading] = useState(false);

  // AI generation progress
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref for auto-scroll in chat
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hasTranscript = !!lesson.transcript;

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
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopGenTimer();
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
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

    // Load saved AI data from DB (lesson-level: summary + explanation + practice)
    const loadSaved = async () => {
      setDbLoading(true);
      try {
        const res = await fetch(`/api/lessons/${lesson.id}/ai`);
        if (res.ok) {
          const data = await res.json();
          if (data.summary) setSummaryResult(data.summary);
          if (data.explanation) setExplainResult(data.explanation);
          if (data.quiz) setQuizResult(data.quiz);
          if (data.flashcards) setFlashcardsResult(data.flashcards);
          if (data.exercises) setExercisesResult(data.exercises);
        }
      } catch {
        // Silently fail — user can regenerate
      } finally {
        setDbLoading(false);
      }
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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Report chat message count to parent (for leave-warning)
  useEffect(() => {
    onChatCountChange?.(chatMessages.length);
  }, [chatMessages.length, onChatCountChange]);

  // ── Handle external explain request (from TranscriptPanel highlight-to-explain) ──
  useEffect(() => {
    if (!externalExplainText || !isConfigured || explainLoading) return;
    setActiveTab("explain");
    setExplainLoading(true);
    setExplainResult("Đang giải thích đoạn đã chọn...");
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
        });
        const data = await res.json();
        setExplainResult(data.explanation || data.error || "Không có kết quả.");
      } catch {
        setExplainResult("Lỗi khi giải thích.");
      }
      setExplainLoading(false);
      onExternalExplainHandled?.();
    };
    doExplain();
  }, [externalExplainText]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── API helpers ──

  const apiBody = useCallback(
    () => ({
      lessonId: lesson.id,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
      model: settings.model,
    }),
    [lesson.id, settings.apiKey, settings.baseUrl, settings.model]
  );

  const handleSummary = async () => {
    if (!hasTranscript || !isConfigured || summaryLoading) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setSummaryLoading(true);
    setSummaryResult("");
    startGenTimer();
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody()),
        signal: controller.signal,
      });
      const data = await res.json();
      setSummaryResult(data.summary || data.error || "Không có kết quả.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setSummaryResult("");
        toast.info("Đã hủy tạo tóm tắt");
      } else {
        setSummaryResult("Lỗi khi tạo tóm tắt.");
        toast.error("Lỗi khi tạo tóm tắt");
      }
    }
    abortControllerRef.current = null;
    stopGenTimer();
    setSummaryLoading(false);
  };

  const handleExplain = async () => {
    if (!hasTranscript || !isConfigured || explainLoading) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setExplainLoading(true);
    setExplainResult("");
    startGenTimer();
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody()),
        signal: controller.signal,
      });
      const data = await res.json();
      setExplainResult(data.explanation || data.error || "Không có kết quả.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setExplainResult("");
        toast.info("Đã hủy giải thích");
      } else {
        setExplainResult("Lỗi khi giải thích.");
        toast.error("Lỗi khi giải thích");
      }
    }
    abortControllerRef.current = null;
    stopGenTimer();
    setExplainLoading(false);
  };

  const handleRoadmap = async () => {
    if (!isConfigured || roadmapLoading) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
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
      const data = await res.json();
      setRoadmapResult(data.roadmap || data.error || "Không có kết quả.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setRoadmapResult("");
        toast.info("Đã hủy tạo lộ trình");
      } else {
        setRoadmapResult("Lỗi khi tạo lộ trình.");
        toast.error("Lỗi khi tạo lộ trình");
      }
    }
    abortControllerRef.current = null;
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

    const controller = new AbortController();
    abortControllerRef.current = controller;
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
      const data = await res.json();
      setResult(data.result || data.error || "Không có kết quả.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setResult("");
        toast.info("Đã hủy tạo nội dung");
      } else {
        setResult("Lỗi khi tạo nội dung luyện tập.");
        toast.error("Lỗi khi tạo nội dung luyện tập");
      }
    }
    abortControllerRef.current = null;
    stopGenTimer();
    setLoading(false);
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTranscript || !chatInput.trim() || !isConfigured || chatLoading)
      return;

    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput("");
    setChatLoading(true);

    // Add placeholder assistant message for streaming
    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setChatMessages([...updatedMessages, assistantMsg]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...apiBody(),
          messages: updatedMessages,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let response = "";

      if (reader) {
        while (true) {
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
    } catch {
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

    setChatLoading(false);
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
          <MarkdownRenderer content={content} />
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
        {dbLoading && (
          <Loader2 className="w-3.5 h-3.5 text-gray-300 animate-spin" />
        )}
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
      <div className="flex-1 flex flex-col gap-4 p-5">
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
            {renderActionButton(
              "Tạo lộ trình toàn khóa",
              "Tạo lại lộ trình",
              !!roadmapResult,
              roadmapLoading,
              handleRoadmap,
              true, // course-level: no transcript required
            )}
            {renderResult(
              roadmapResult,
              "Nhấn nút để AI phân tích toàn khóa và đề xuất lộ trình học tập...",
              roadmapLoading
            )}
          </>
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
                  <QuizPlayer markdown={quizResult} />
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
                  <FlashcardDeck markdown={flashcardsResult} />
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
                          <MarkdownRenderer content={msg.content} />
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

            {/* Chat input */}
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
          </>
        )}
      </div>
    </div>
  );
}
