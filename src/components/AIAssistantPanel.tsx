"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, AlertCircle, FileText, BookOpen, MessageCircle, Map, GraduationCap, StickyNote, BarChart3, Lightbulb, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ExportDropdown } from "@/components/ExportDropdown";
import { NotesEditor } from "@/components/NotesEditor";
import { KeyConceptsPanel } from "@/components/KeyConceptsPanel";
import { GlossaryPanel } from "@/components/GlossaryPanel";
import { StudyPlanPanel } from "@/components/StudyPlanPanel";
import { AnalyticsCourseDetail } from "@/components/AnalyticsCourseDetail";
import { SummaryTab, ExplainTab, RoadmapTab, PracticeTab, ChatTab } from "@/components/ai-assistant";
import { useAIGeneration } from "@/hooks/use-ai-generation";
import { useChatHistory } from "@/hooks/use-chat-history";
import { usePracticeMode } from "@/hooks/use-practice-mode";
import { useAIActions } from "@/hooks/use-ai-actions";
import type { Lesson, AISettings } from "@/types/course";

// ── Types ──────────────────────────────────────────────────────────────────────

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
  onNavigateToChapter?: (chapterId: string) => void;
}

type TabType = "summary" | "explain" | "chat" | "roadmap" | "notes" | "practice" | "analytics" | "concepts" | "glossary" | "study-plan";

const TABS: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: "summary",    label: "Tóm tắt",   icon: FileText },
  { key: "explain",    label: "Giải thích", icon: BookOpen },
  { key: "chat",       label: "Chat",       icon: MessageCircle },
  { key: "roadmap",    label: "Lộ trình",   icon: Map },
  { key: "notes",      label: "Ghi chú",    icon: StickyNote },
  { key: "practice",   label: "Luyện tập",  icon: GraduationCap },
  { key: "concepts",   label: "Khái niệm",  icon: Lightbulb },
  { key: "glossary",   label: "Thuật ngữ",  icon: BookOpen },
  { key: "study-plan", label: "Kế hoạch",   icon: Calendar },
  { key: "analytics",  label: "Thống kê",   icon: BarChart3 },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function AIAssistantPanel({
  lesson, courseId, contentType, settings, isConfigured,
  onOpenSettings, onChatCountChange, externalExplainText,
  onExternalExplainHandled, onQuizComplete, onNavigateToChapter,
}: AIAssistantPanelProps) {
  const [activeTab, setActiveTab]         = useState<TabType>("summary");
  const [summaryResult, setSummaryResult] = useState("");
  const [explainResult, setExplainResult] = useState("");
  const [roadmapResult, setRoadmapResult] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [chatLoading, setChatLoading]     = useState(false);
  const [summaryMode, setSummaryMode]     = useState<"quick" | "detailed">("detailed");
  const [explainDepth, setExplainDepth]   = useState<"simple" | "standard" | "deep">("standard");
  const [socraticMode, setSocraticMode]   = useState(false);
  const [dbLoading, setDbLoading]         = useState(false);
  const [insertToNotesText, setInsertToNotesText] = useState<string | null>(null);
  const [learnerProfile, setLearnerProfile] = useState<{
    level: string; goal: string; dailyTimeMin: number; knownTopics: string[]; learningStyle: string;
  } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileChecked, setProfileChecked]     = useState(false);
  const [conceptsResult, setConceptsResult]     = useState<Array<{ term: string; definition: string; category?: string; relatedTerms?: string[] }>>([]);
  const [conceptsLoading, setConceptsLoading]   = useState(false);
  const [glossaryResult, setGlossaryResult]     = useState<Array<{ term: string; definition: string; chapters?: { id: string; title: string }[]; category?: string }>>([]);
  const [glossaryLoading, setGlossaryLoading]   = useState(false);
  const [hasKeyConcepts, setHasKeyConcepts]     = useState(false);

  const lessonIdRef  = useRef(lesson.id);
  const hasTranscript = !!lesson.transcript;

  const ai       = useAIGeneration();
  const chat     = useChatHistory({ lessonId: lesson.id, onChatCountChange });
  const practice = usePracticeMode({ lessonId: lesson.id, flashcardsResult: "" });

  const actions = useAIActions({
    lessonId: lesson.id, courseId, hasTranscript, isConfigured,
    summaryMode, explainDepth, socraticMode,
    conceptsResultLength: conceptsResult.length, glossaryResultLength: glossaryResult.length,
    settings, contentType, lessonIdRef, ai, chat, practice,
    setSummaryResult, setSummaryLoading, setExplainResult, setExplainLoading,
    setRoadmapResult, setRoadmapLoading, setChatLoading,
    setConceptsResult, setConceptsLoading, setHasKeyConcepts,
    setGlossaryResult, setGlossaryLoading,
  });

  useEffect(() => { lessonIdRef.current = lesson.id; }, [lesson.id]);
  useEffect(() => () => { ai.cleanup(); }, [ai]);

  // Reset + load persisted data when lesson changes
  useEffect(() => {
    setSummaryResult(""); setExplainResult(""); chat.resetChat(); practice.resetPractice(); setConceptsResult([]);
    const controller = new AbortController();
    setDbLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/lessons/${lesson.id}/ai`, { signal: controller.signal });
        if (res.ok) {
          const data = await res.json();
          if (data.summary)     setSummaryResult(data.summary);
          if (data.explanation) setExplainResult(data.explanation);
          practice.loadFromDb(data);
        }
      } catch (err) { if (err instanceof Error && err.name === "AbortError") return; }
      await chat.loadFromDb(controller.signal);
      setDbLoading(false);
    })();
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // Load course-level data
  useEffect(() => {
    setRoadmapResult(""); setGlossaryResult([]); setHasKeyConcepts(false);
    fetch(`/api/courses/${courseId}/ai`).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (data.roadmap) setRoadmapResult(data.roadmap);
      if (data.hasKeyConcepts) setHasKeyConcepts(true);
      if (data.glossary) { try { const p = JSON.parse(data.glossary); if (Array.isArray(p)) setGlossaryResult(p); } catch { /* ignore */ } }
    }).catch(() => undefined);
    setLearnerProfile(null); setProfileChecked(false);
    fetch(`/api/courses/${courseId}/profile`).then(async (res) => {
      if (res.ok) setLearnerProfile(await res.json());
    }).catch(() => undefined).finally(() => setProfileChecked(true));
  }, [courseId]);

  // Handle external explain request (from TranscriptPanel highlight-to-explain)
  useEffect(() => {
    if (!externalExplainText || !isConfigured || explainLoading) return;
    const controller = new AbortController();
    setActiveTab("explain"); setExplainLoading(true); setExplainResult("");
    (async () => {
      try {
        const res = await fetch("/api/ai/explain", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id, apiKey: settings.apiKey, baseUrl: settings.baseUrl, model: settings.model, ...(contentType ? { contentType } : {}), selectedText: externalExplainText, force: true }),
          signal: controller.signal,
        });
        const result = await ai.readStreamOrJson(res, "explanation", setExplainResult, controller.signal);
        if (!result) setExplainResult("Không có kết quả.");
      } catch (err) { if (err instanceof Error && err.name === "AbortError") return; setExplainResult("Lỗi khi giải thích."); }
      setExplainLoading(false); onExternalExplainHandled?.();
    })();
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalExplainText]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const sharedProps = { dbLoading, elapsedSeconds: ai.elapsedSeconds, cancelGeneration: ai.cancelGeneration };
  const visibleTabs = TABS.filter((t) =>
    (t.key !== "concepts" && t.key !== "glossary" && t.key !== "study-plan") || contentType === "book"
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-[#A435F0]/10 flex items-center justify-center shrink-0">
            <Zap className="w-3.5 h-3.5 text-[#A435F0]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Assistant</h2>
            {isConfigured && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{settings.model}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!["chat","notes","analytics","concepts","glossary","study-plan"].includes(activeTab) && (
            <ExportDropdown lessonId={lesson.id} courseId={courseId} activeTab={activeTab} practiceMode={practice.practiceMode}
              hasData={{ summary: !!summaryResult, explanation: !!explainResult, quiz: !!practice.quizResult, flashcards: !!practice.flashcardsResult, exercises: !!practice.exercisesResult }} />
          )}
          {dbLoading && <Loader2 className="w-3.5 h-3.5 text-gray-300 animate-spin" />}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-100 dark:border-gray-800 px-5">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              activeTab === key ? "text-[#A435F0] border-[#A435F0]" : "text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-gray-300"
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col gap-4 p-5">
        {!isConfigured && (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-800 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Chưa cấu hình AI.{" "}<button onClick={onOpenSettings} className="underline font-semibold cursor-pointer hover:text-amber-900">Cấu hình ngay</button></span>
          </div>
        )}
        {!hasTranscript && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /><span>Bài học này chưa có transcript.</span>
          </div>
        )}

        {activeTab === "summary"    && <SummaryTab summaryMode={summaryMode} setSummaryMode={setSummaryMode} summaryResult={summaryResult} summaryLoading={summaryLoading} isConfigured={isConfigured} hasTranscript={hasTranscript} onGenerate={actions.handleSummary} {...sharedProps} />}
        {activeTab === "explain"    && <ExplainTab explainDepth={explainDepth} setExplainDepth={setExplainDepth} explainResult={explainResult} explainLoading={explainLoading} isConfigured={isConfigured} hasTranscript={hasTranscript} onGenerate={actions.handleExplain} {...sharedProps} />}
        {activeTab === "roadmap"    && <RoadmapTab courseId={courseId} roadmapResult={roadmapResult} roadmapLoading={roadmapLoading} isConfigured={isConfigured} profileChecked={profileChecked} learnerProfile={learnerProfile} showProfileModal={showProfileModal} setShowProfileModal={setShowProfileModal} setLearnerProfile={setLearnerProfile} onGenerate={actions.handleRoadmap} {...sharedProps} />}
        {activeTab === "notes"      && <NotesEditor lessonId={lesson.id} lessonTitle={lesson.title} courseId={courseId} insertText={insertToNotesText} onInsertHandled={() => setInsertToNotesText(null)} />}
        {activeTab === "practice"   && (
          <PracticeTab lessonId={lesson.id} practiceMode={practice.practiceMode} setPracticeMode={practice.setPracticeMode}
            quizResult={practice.quizResult} flashcardsResult={practice.flashcardsResult} exercisesResult={practice.exercisesResult}
            quizLoading={practice.quizLoading} flashcardsLoading={practice.flashcardsLoading} exercisesLoading={practice.exercisesLoading}
            srsMode={practice.srsMode} setSrsMode={practice.setSrsMode} dueBadge={practice.dueBadge} setDueBadge={practice.setDueBadge}
            setFlashcardsResult={practice.setFlashcardsResult} isConfigured={isConfigured} hasTranscript={hasTranscript}
            onGenerate={actions.handlePractice} onQuizComplete={onQuizComplete} {...sharedProps} />
        )}
        {activeTab === "chat"       && (
          <ChatTab lessonId={lesson.id} chatMessages={chat.chatMessages} chatInput={chat.chatInput} setChatInput={chat.setChatInput}
            chatLoading={chatLoading} chatEndRef={chat.chatEndRef} socraticMode={socraticMode} setSocraticMode={setSocraticMode}
            isConfigured={isConfigured} hasTranscript={hasTranscript} onSubmit={actions.handleChat}
            onClearHistory={async () => { const ok = await chat.clearHistory(); if (ok) toast.success("Đã xóa lịch sử chat"); else toast.error("Lỗi khi xóa lịch sử chat"); }}
            onInsertToNotes={(content) => { setInsertToNotesText(content); setActiveTab("notes"); toast.success("Đã chèn vào ghi chú"); }} />
        )}
        {activeTab === "concepts"   && contentType === "book" && <KeyConceptsPanel concepts={conceptsResult} isLoading={conceptsLoading} onExtract={actions.handleConcepts} isConfigured={isConfigured} hasTranscript={hasTranscript} elapsedSeconds={ai.elapsedSeconds} glossary={glossaryResult} onNavigateToChapter={onNavigateToChapter} />}
        {activeTab === "glossary"   && contentType === "book" && <GlossaryPanel glossary={glossaryResult} isLoading={glossaryLoading} onGenerate={actions.handleGlossary} isConfigured={isConfigured} hasChaptersWithConcepts={hasKeyConcepts || conceptsResult.length > 0} elapsedSeconds={ai.elapsedSeconds} onNavigateToChapter={onNavigateToChapter} />}
        {activeTab === "study-plan" && contentType === "book" && <StudyPlanPanel courseId={courseId} isConfigured={isConfigured} apiKey={settings.apiKey} baseUrl={settings.baseUrl} model={settings.model} onNavigateToChapter={onNavigateToChapter} />}
        {activeTab === "analytics"  && <AnalyticsCourseDetail courseId={courseId} />}
      </div>
    </div>
  );
}
