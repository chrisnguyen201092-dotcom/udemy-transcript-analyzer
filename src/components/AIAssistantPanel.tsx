"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  Send,
  AlertCircle,
  Zap,
  FileText,
  BookOpen,
  MessageCircle,
  Map,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  settings: AISettings;
  isConfigured: boolean;
  onOpenSettings: () => void;
}

type TabType = "summary" | "explain" | "chat" | "roadmap";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const TABS: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: "summary", label: "Tóm tắt", icon: FileText },
  { key: "explain", label: "Giải thích", icon: BookOpen },
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "roadmap", label: "Lộ trình", icon: Map },
];

// ── Component ──────────────────────────────────────────────────

export function AIAssistantPanel({
  lesson,
  settings,
  isConfigured,
  onOpenSettings,
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

  // Persistence loading flag
  const [dbLoading, setDbLoading] = useState(false);

  // Ref for auto-scroll in chat
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hasTranscript = !!lesson.transcript;

  // ── Reset + load persisted data when lesson changes ──

  useEffect(() => {
    // Reset all state
    setSummaryResult("");
    setExplainResult("");
    setRoadmapResult("");
    setChatMessages([]);
    setChatInput("");

    // Load saved AI data from DB
    const loadSaved = async () => {
      setDbLoading(true);
      try {
        const res = await fetch(`/api/lessons/${lesson.id}/ai`);
        if (res.ok) {
          const data = await res.json();
          if (data.summary) setSummaryResult(data.summary);
          if (data.explanation) setExplainResult(data.explanation);
          if (data.roadmap) setRoadmapResult(data.roadmap);
        }
      } catch {
        // Silently fail — user can regenerate
      } finally {
        setDbLoading(false);
      }
    };

    loadSaved();
  }, [lesson.id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

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
    setSummaryLoading(true);
    setSummaryResult("Đang tạo tóm tắt...");
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody()),
      });
      const data = await res.json();
      setSummaryResult(data.summary || data.error || "Không có kết quả.");
    } catch {
      setSummaryResult("Lỗi khi tạo tóm tắt.");
    }
    setSummaryLoading(false);
  };

  const handleExplain = async () => {
    if (!hasTranscript || !isConfigured || explainLoading) return;
    setExplainLoading(true);
    setExplainResult("Đang giải thích...");
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody()),
      });
      const data = await res.json();
      setExplainResult(data.explanation || data.error || "Không có kết quả.");
    } catch {
      setExplainResult("Lỗi khi giải thích.");
    }
    setExplainLoading(false);
  };

  const handleRoadmap = async () => {
    if (!hasTranscript || !isConfigured || roadmapLoading) return;
    setRoadmapLoading(true);
    setRoadmapResult("Đang tạo lộ trình...");
    try {
      const res = await fetch("/api/ai/roadmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody()),
      });
      const data = await res.json();
      setRoadmapResult(data.roadmap || data.error || "Không có kết quả.");
    } catch {
      setRoadmapResult("Lỗi khi tạo lộ trình.");
    }
    setRoadmapLoading(false);
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
    }

    setChatLoading(false);
  };

  // ── Render helpers ──

  const renderResult = (
    content: string,
    placeholder: string,
    isLoading: boolean
  ) => (
    <ScrollArea className="flex-1 min-h-[160px]">
      <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl border border-gray-100 p-3.5 min-h-[160px]">
        {isLoading && !content ? (
          <span className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Đang xử lý...
          </span>
        ) : content ? (
          content
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
      </div>
    </ScrollArea>
  );

  const renderActionButton = (
    label: string,
    existingLabel: string,
    hasResult: boolean,
    isLoading: boolean,
    onClick: () => void
  ) => (
    <Button
      onClick={onClick}
      disabled={!hasTranscript || !isConfigured || isLoading}
      variant="outline"
      size="sm"
      className="cursor-pointer w-full text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 rounded-lg h-8 text-xs"
    >
      {isLoading ? (
        <span className="flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Đang xử lý...
        </span>
      ) : hasResult ? (
        existingLabel
      ) : (
        label
      )}
    </Button>
  );

  // ── Main render ──

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#A435F0]/10 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-[#A435F0]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              AI Assistant
            </h2>
            {isConfigured && (
              <p className="text-xs text-gray-400 mt-0.5">{settings.model}</p>
            )}
          </div>
        </div>
        {dbLoading && (
          <Loader2 className="w-3.5 h-3.5 text-gray-300 animate-spin" />
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-100 px-5">
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
                  : "text-gray-400 border-transparent hover:text-gray-600"
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
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
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
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
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

        {/* Tab: Roadmap */}
        {activeTab === "roadmap" && (
          <>
            {renderActionButton(
              "Tạo lộ trình học tập",
              "Tạo lại lộ trình",
              !!roadmapResult,
              roadmapLoading,
              handleRoadmap
            )}
            {renderResult(
              roadmapResult,
              "Nhấn nút để AI đề xuất lộ trình học tập...",
              roadmapLoading
            )}
          </>
        )}

        {/* Tab: Chat */}
        {activeTab === "chat" && (
          <>
            {/* Chat messages */}
            <ScrollArea className="flex-1 min-h-[160px]">
              <div className="flex flex-col gap-2.5 min-h-[160px]">
                {chatMessages.length === 0 && (
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100 p-3.5 text-center">
                    Hỏi bất cứ điều gì về bài học...
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-[#A435F0] text-white"
                          : "bg-gray-50 border border-gray-100 text-gray-700"
                      }`}
                    >
                      {msg.content ||
                        (chatLoading && i === chatMessages.length - 1 ? (
                          <span className="flex items-center gap-1.5 text-gray-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Đang trả lời...
                          </span>
                        ) : null)}
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
                className="flex-1 text-xs h-8 border-gray-200 focus-visible:ring-[#A435F0]/30"
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
