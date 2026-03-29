"use client";

import { useState } from "react";
import { Bot, Send, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export function AIAssistantPanel({
  lesson,
  settings,
  isConfigured,
  onOpenSettings,
}: AIAssistantPanelProps) {
  const [aiResponse, setAiResponse] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);

  const hasTranscript = !!lesson.transcript;

  const handleSummary = async () => {
    if (!hasTranscript || !isConfigured) return;
    setLoading(true);
    setAiResponse("Đang tạo tóm tắt...");
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        }),
      });
      const data = await res.json();
      setAiResponse(data.summary || data.error || "Không có kết quả.");
    } catch {
      setAiResponse("Lỗi khi tạo tóm tắt.");
    }
    setLoading(false);
  };

  const handleExplain = async () => {
    if (!hasTranscript || !isConfigured) return;
    setLoading(true);
    setAiResponse("Đang giải thích...");
    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
        }),
      });
      const data = await res.json();
      setAiResponse(data.explanation || data.error || "Không có kết quả.");
    } catch {
      setAiResponse("Lỗi khi giải thích.");
    }
    setLoading(false);
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasTranscript || !chatInput.trim() || !isConfigured) return;
    setChatLoading(true);
    setAiResponse("Đang trả lời...");
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          message: chatInput,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          model: settings.model,
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
          setAiResponse(response);
        }
      }
    } catch {
      setAiResponse("Lỗi khi chat.");
    }
    setChatLoading(false);
    setChatInput("");
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#A435F0]/10 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-[#A435F0]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
            {isConfigured && (
              <p className="text-xs text-gray-400 mt-0.5">{settings.model}</p>
            )}
          </div>
        </div>
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

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleSummary}
            disabled={!hasTranscript || !isConfigured || loading}
            variant="outline"
            size="sm"
            className="cursor-pointer flex-1 text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 rounded-lg h-8 text-xs"
          >
            Tóm tắt
          </Button>
          <Button
            onClick={handleExplain}
            disabled={!hasTranscript || !isConfigured || loading}
            variant="outline"
            size="sm"
            className="cursor-pointer flex-1 text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 rounded-lg h-8 text-xs"
          >
            Giải thích
          </Button>
        </div>

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
            disabled={!hasTranscript || !isConfigured || chatLoading || !chatInput.trim()}
            className="cursor-pointer h-8 w-8 p-0 bg-[#A435F0] hover:bg-[#8710D8] shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>

        {/* AI Response */}
        <ScrollArea className="flex-1 min-h-[160px]">
          <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-xl border border-gray-100 p-3.5 min-h-[160px]">
            {aiResponse || (
              <span className="text-gray-400">Kết quả AI sẽ hiển thị ở đây...</span>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
