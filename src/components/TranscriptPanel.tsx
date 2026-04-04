"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getLabels } from "@/lib/content-type-labels";
import { useTranscriptDraft } from "@/hooks/use-transcript-draft";
import { useTranscriptSearch } from "@/hooks/use-transcript-search";
import {
  TranscriptHighlightedBody,
  TranscriptFloatingExplainButton,
  TranscriptSearchBar,
  TranscriptUnsavedDialog,
  TranscriptPanelHeader,
} from "@/components/transcript-body-parts";

// ── Types ──────────────────────────────────────────────────────

interface Lesson {
  id: string;
  title: string;
  order: number;
  transcript: string | null;
}

interface TranscriptPanelProps {
  lesson: Lesson;
  contentType?: string;
  onSaveTranscript: (lessonId: string, transcript: string) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onExplainSelection?: (selectedText: string) => void;
}

// ── Helpers ────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString("vi-VN");
}

// ── Component ──────────────────────────────────────────────────

/**
 * TranscriptPanel — must be rendered with `key={lesson.id}` from parent
 * so that React fully remounts on lesson change, resetting all local state.
 */
export function TranscriptPanel({
  lesson,
  contentType,
  onSaveTranscript,
  onDirtyChange,
  onExplainSelection,
}: TranscriptPanelProps) {
  const currentTextForSearch = lesson.transcript || "";

  const {
    draft, editing, saving, saved, isDirty, wordCount, charCount,
    setDraft, startEditing, handleSave, handleCancel,
  } = useTranscriptDraft({
    lessonId: lesson.id,
    initialTranscript: lesson.transcript,
    onSaveTranscript,
    onDirtyChange,
  });

  const {
    showSearch, searchQuery, activeMatchIndex, searchMatches,
    searchInputRef, matchRefs,
    setShowSearch, setSearchQuery, navigateMatch, closeSearch,
  } = useTranscriptSearch(currentTextForSearch);

  // ── Copy state ──
  const [justCopied, setJustCopied] = useState(false);

  // ── Unsaved-changes dialog ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // ── Floating explain button ──
  const [floatingBtn, setFloatingBtn] = useState<{ x: number; y: number; text: string } | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const currentText = editing ? draft : (lesson.transcript || "");

  // ── Handlers ──

  const handleExitEdit = () => {
    if (isDirty) setShowUnsavedDialog(true);
    else { handleCancel(); }
  };

  const handleSaveAndExit = async () => {
    setShowUnsavedDialog(false);
    await handleSave();
  };

  const handleExitWithoutSave = () => {
    setShowUnsavedDialog(false);
    handleCancel();
  };

  // ── Copy ──
  const handleCopy = useCallback(async () => {
    if (!currentText) return;
    const label = getLabels(contentType).content.toLowerCase();
    const showSuccess = () => { toast.success(`Đã sao chép ${label}!`); setJustCopied(true); setTimeout(() => setJustCopied(false), 2000); };
    try {
      await navigator.clipboard.writeText(currentText);
      showSuccess();
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = currentText; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
        showSuccess();
      } catch { toast.error("Không thể copy. Vui lòng dùng Ctrl+A và Ctrl+C."); }
    }
  }, [currentText, contentType]);

  // ── Floating explain (text selection) ──
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !onExplainSelection) {
      setFloatingBtn(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text) { setFloatingBtn(null); return; }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = transcriptRef.current?.getBoundingClientRect();
    if (!containerRect) { setFloatingBtn(null); return; }
    let x = rect.left - containerRect.left + rect.width / 2;
    let y = rect.top - containerRect.top - 40;
    x = Math.max(60, Math.min(x, containerRect.width - 60));
    if (y < 0) y = rect.bottom - containerRect.top + 8;
    setFloatingBtn({ x, y, text });
  }, [onExplainSelection]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const handler = () => setTimeout(handleTextSelection, 10);
    const docHandler = (e: MouseEvent) => { if (!el.contains(e.target as Node)) setFloatingBtn(null); };
    el.addEventListener("mouseup", handler);
    document.addEventListener("mousedown", docHandler);
    return () => { el.removeEventListener("mouseup", handler); document.removeEventListener("mousedown", docHandler); };
  }, [handleTextSelection]);

  const handleExplainClick = () => {
    if (!floatingBtn || !onExplainSelection) return;
    let text = floatingBtn.text.replace(/[\n\t]+/g, " ").trim();
    if (text.length > 2000) text = text.slice(0, 2000) + " [đoạn được cắt bớt]";
    onExplainSelection(text);
    setFloatingBtn(null);
    window.getSelection()?.removeAllRanges();
  };

  // ── Render highlighted transcript (read mode with search) ──
  // Extracted to TranscriptHighlightedBody in transcript-body-parts.tsx

  // ── Main render ──

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <TranscriptPanelHeader
        lessonTitle={lesson.title}
        contentType={contentType}
        editing={editing}
        isDirty={isDirty}
        saved={saved}
        draft={draft}
        saving={saving}
        currentText={currentText}
        justCopied={justCopied}
        showSearch={showSearch}
        searchInputRef={searchInputRef}
        onToggleSearch={() => { setShowSearch(!showSearch); if (showSearch) closeSearch(); }}
        onCopy={handleCopy}
        onStartEditing={startEditing}
        onExitEdit={handleExitEdit}
        onSave={handleSave}
      />

      {/* Search bar */}
      {showSearch && (
        <TranscriptSearchBar
          searchQuery={searchQuery}
          searchMatches={searchMatches}
          activeMatchIndex={activeMatchIndex}
          searchInputRef={searchInputRef}
          contentLabel={getLabels(contentType).content.toLowerCase()}
          onQueryChange={setSearchQuery}
          onNavigate={navigateMatch}
          onClose={closeSearch}
        />
      )}

      {/* Body */}
      <div ref={transcriptRef} className="flex-1 min-h-0 flex flex-col p-5 relative">
        {lesson.transcript ? (
          editing ? (
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 min-h-[300px] text-sm resize-none border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30 rounded-xl leading-relaxed"
            />
          ) : (
            <TranscriptHighlightedBody
              text={lesson.transcript || ""}
              searchQuery={searchQuery}
              searchMatches={searchMatches}
              activeMatchIndex={activeMatchIndex}
              matchRefs={matchRefs}
            />
          )
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-800 rounded-xl px-3 py-2.5">
              Chưa có {getLabels(contentType).content.toLowerCase()}. Paste nội dung bên dưới để lưu thủ công.
            </p>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Paste transcript here..."
              className="h-56 text-sm resize-none border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30 rounded-xl"
            />
            <Button
              onClick={handleSave}
              disabled={!draft.trim() || saving}
              className="self-end gap-2 cursor-pointer bg-[#A435F0] hover:bg-[#8710D8] rounded-lg h-8 text-xs px-4"
            >
              {saved ? <><Check className="w-3.5 h-3.5" />Saved!</> : saving ? "Đang lưu..." : "Lưu Transcript"}
            </Button>
          </div>
        )}

        {/* Floating explain button */}
        {floatingBtn && onExplainSelection && (
          <TranscriptFloatingExplainButton
            x={floatingBtn.x}
            y={floatingBtn.y}
            onClick={handleExplainClick}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end px-5 py-2 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {formatNumber(wordCount)} từ &middot; {formatNumber(charCount)} ký tự
        </span>
      </div>

      {/* Unsaved changes dialog */}
      <TranscriptUnsavedDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onCancel={() => setShowUnsavedDialog(false)}
        onExitWithoutSave={handleExitWithoutSave}
        onSaveAndExit={handleSaveAndExit}
      />
    </div>
  );
}
