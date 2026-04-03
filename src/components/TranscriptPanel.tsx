"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  FileText,
  Check,
  Pencil,
  X,
  Copy,
  Search,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getLabels } from "@/lib/content-type-labels";

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

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

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
  // ── Core state ──
  const [draft, setDraft] = useState(lesson.transcript || "");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Search state ──
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const matchRefs = useRef<(HTMLElement | null)[]>([]);

  // ── Copy state ──
  const [justCopied, setJustCopied] = useState(false);

  // ── Word count (debounced) ──
  const [debouncedText, setDebouncedText] = useState(lesson.transcript || "");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Floating explain button ──
  const [floatingBtn, setFloatingBtn] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // ── Unsaved-changes dialog ──
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const isDirty = editing && draft !== (lesson.transcript || "");
  const currentText = editing ? draft : (lesson.transcript || "");

  // ── Refs for auto-save on unmount ──
  const draftRef = useRef(draft);
  const isDirtyRef = useRef(isDirty);
  const lessonIdRef = useRef(lesson.id);
  const onSaveRef = useRef(onSaveTranscript);
  draftRef.current = draft;
  isDirtyRef.current = isDirty;
  lessonIdRef.current = lesson.id;
  onSaveRef.current = onSaveTranscript;

  // ── Auto-save on unmount (course/lesson switch) ──
  useEffect(() => {
    return () => {
      if (isDirtyRef.current && draftRef.current.trim()) {
        onSaveRef.current(lessonIdRef.current, draftRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Notify parent of dirty state ──
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // ── Debounce word count update ──
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedText(currentText);
    }, 300);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [currentText]);

  const wordCount = useMemo(() => countWords(debouncedText), [debouncedText]);
  const charCount = useMemo(() => debouncedText.length, [debouncedText]);

  // ── Search matches ──
  const searchMatches = useMemo(() => {
    if (!searchQuery || !currentText) return [];
    try {
      const regex = new RegExp(escapeRegex(searchQuery), "gi");
      const matches: { start: number; end: number }[] = [];
      let m: RegExpExecArray | null;
      while ((m = regex.exec(currentText)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length });
      }
      return matches;
    } catch {
      return [];
    }
  }, [searchQuery, currentText]);

  // Reset active match when query or matches change
  useEffect(() => {
    setActiveMatchIndex(0);
  }, [searchQuery]);

  // Scroll active match into view
  useEffect(() => {
    if (searchMatches.length > 0 && matchRefs.current[activeMatchIndex]) {
      matchRefs.current[activeMatchIndex]?.scrollIntoView?.({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeMatchIndex, searchMatches.length]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+F → open search
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      // F3 → next match
      if (e.key === "F3" && showSearch) {
        e.preventDefault();
        if (e.shiftKey) {
          navigateMatch("prev");
        } else {
          navigateMatch("next");
        }
      }
      // Escape → close search
      if (e.key === "Escape" && showSearch) {
        e.preventDefault();
        closeSearch();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showSearch, searchMatches.length, activeMatchIndex]);

  // ── Handlers ──

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    await onSaveTranscript(lesson.id, draft);
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancel = () => {
    setDraft(lesson.transcript || "");
    setEditing(false);
  };

  const startEditing = () => {
    setDraft(lesson.transcript || "");
    setEditing(true);
  };

  const handleExitEdit = () => {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      setEditing(false);
    }
  };

  const handleSaveAndExit = async () => {
    setShowUnsavedDialog(false);
    await handleSave();
  };

  const handleExitWithoutSave = () => {
    setShowUnsavedDialog(false);
    setDraft(lesson.transcript || "");
    setEditing(false);
  };

  const handleCancelDialog = () => {
    setShowUnsavedDialog(false);
  };

  // ── Copy ──
  const handleCopy = useCallback(async () => {
    const textToCopy = currentText;
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`Đã sao chép ${getLabels(contentType).content.toLowerCase()}!`);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      try {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        toast.success(`Đã sao chép ${getLabels(contentType).content.toLowerCase()}!`);
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      } catch {
        toast.error("Không thể copy. Vui lòng dùng Ctrl+A và Ctrl+C.");
      }
    }
  }, [currentText]);

  // ── Search navigation ──
  const navigateMatch = useCallback(
    (direction: "next" | "prev") => {
      if (searchMatches.length === 0) return;
      setActiveMatchIndex((prev) => {
        if (direction === "next") {
          return (prev + 1) % searchMatches.length;
        }
        return (prev - 1 + searchMatches.length) % searchMatches.length;
      });
    },
    [searchMatches.length]
  );

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    setActiveMatchIndex(0);
  };

  // ── Floating explain (text selection) ──
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !onExplainSelection) {
      setFloatingBtn(null);
      return;
    }
    const text = selection.toString().trim();
    if (!text) {
      setFloatingBtn(null);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = transcriptRef.current?.getBoundingClientRect();
    if (!containerRect) {
      setFloatingBtn(null);
      return;
    }
    // Position relative to container
    let x = rect.left - containerRect.left + rect.width / 2;
    let y = rect.top - containerRect.top - 40;
    // Clamp within container bounds
    x = Math.max(60, Math.min(x, containerRect.width - 60));
    if (y < 0) y = rect.bottom - containerRect.top + 8;
    setFloatingBtn({ x, y, text });
  }, [onExplainSelection]);

  // Listen for mouseup on transcript area
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    const handler = () => setTimeout(handleTextSelection, 10);
    el.addEventListener("mouseup", handler);
    // Clear floating button when clicking outside
    const docHandler = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) {
        setFloatingBtn(null);
      }
    };
    document.addEventListener("mousedown", docHandler);
    return () => {
      el.removeEventListener("mouseup", handler);
      document.removeEventListener("mousedown", docHandler);
    };
  }, [handleTextSelection]);

  const handleExplainClick = () => {
    if (!floatingBtn || !onExplainSelection) return;
    let text = floatingBtn.text.replace(/[\n\t]+/g, " ").trim();
    if (text.length > 2000) {
      text = text.slice(0, 2000) + " [đoạn được cắt bớt]";
    }
    onExplainSelection(text);
    setFloatingBtn(null);
    window.getSelection()?.removeAllRanges();
  };

  // ── Render highlighted transcript (read mode with search) ──
  const renderHighlightedText = () => {
    const text = lesson.transcript || "";
    if (!searchQuery || searchMatches.length === 0) {
      return (
        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed pr-3">
          {text}
        </div>
      );
    }

    // Build segments
    matchRefs.current = [];
    const segments: React.ReactNode[] = [];
    let lastIndex = 0;

    searchMatches.forEach((match, i) => {
      // Text before match
      if (match.start > lastIndex) {
        segments.push(
          <span key={`text-${i}`}>
            {text.slice(lastIndex, match.start)}
          </span>
        );
      }
      // Match highlight
      const isActive = i === activeMatchIndex;
      segments.push(
        <mark
          key={`match-${i}`}
          ref={(el) => {
            matchRefs.current[i] = el;
          }}
          className={
            isActive
              ? "bg-orange-300 dark:bg-orange-600 text-inherit rounded-sm px-px"
              : "bg-yellow-200 dark:bg-yellow-700 text-inherit rounded-sm px-px"
          }
        >
          {text.slice(match.start, match.end)}
        </mark>
      );
      lastIndex = match.end;
    });

    // Remaining text
    if (lastIndex < text.length) {
      segments.push(
        <span key="text-end">{text.slice(lastIndex)}</span>
      );
    }

    return (
      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed pr-3">
        {segments}
      </div>
    );
  };

  // ── Main render ──

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {getLabels(contentType).content}
            </h2>
            {/* Mode badge */}
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 font-medium ${
                editing
                  ? "border-amber-300 text-amber-600 dark:text-amber-400"
                  : "border-emerald-300 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {editing ? "Đang sửa" : "Đang đọc"}
            </Badge>
            {isDirty && (
              <span
                className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                title="Có thay đổi chưa lưu"
              />
            )}
            {saved && (
              <span className="text-[10px] text-emerald-600 font-medium">
                Đã lưu!
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
            {lesson.title}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Search toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowSearch(!showSearch);
              if (!showSearch) {
                setTimeout(() => searchInputRef.current?.focus(), 50);
              } else {
                closeSearch();
              }
            }}
            className="h-7 w-7 p-0 text-gray-400 hover:text-[#A435F0] cursor-pointer"
            title="Tìm kiếm (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </Button>

          {/* Copy button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={!currentText}
            className="h-7 w-7 p-0 text-gray-400 hover:text-[#A435F0] cursor-pointer"
            title="Sao chép toàn bộ transcript"
          >
            {justCopied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </Button>

          {/* Edit / Exit-edit toggle */}
          {lesson.transcript && !editing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startEditing}
              className="h-7 gap-1.5 text-xs text-gray-500 hover:text-[#A435F0] cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
              Chỉnh sửa
            </Button>
          )}

          {editing && (
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExitEdit}
                className="h-7 gap-1 text-xs text-gray-500 hover:text-red-500 cursor-pointer"
              >
                <X className="w-3 h-3" />
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!draft.trim() || saving || !isDirty}
                className="h-7 gap-1 text-xs cursor-pointer bg-[#A435F0] hover:bg-[#8710D8]"
              >
                {saving ? (
                  "Đang lưu..."
                ) : (
                  <>
                    <Check className="w-3 h-3" />
                    Lưu
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Tìm kiếm trong ${getLabels(contentType).content.toLowerCase()}...`}
            className={`flex-1 text-xs h-7 ${
              searchQuery && searchMatches.length === 0
                ? "border-red-300 focus-visible:ring-red-300"
                : "border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
            }`}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                navigateMatch(e.shiftKey ? "prev" : "next");
              }
            }}
          />
          <span className="text-[10px] text-gray-400 whitespace-nowrap min-w-[60px] text-center">
            {searchQuery
              ? searchMatches.length > 0
                ? `${activeMatchIndex + 1} / ${searchMatches.length} kết quả`
                : "0 kết quả"
              : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMatch("prev")}
            disabled={searchMatches.length === 0}
            className="h-6 w-6 p-0 text-gray-400 cursor-pointer"
            title="Trước đó (Shift+F3)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateMatch("next")}
            disabled={searchMatches.length === 0}
            className="h-6 w-6 p-0 text-gray-400 cursor-pointer"
            title="Tiếp theo (F3)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={closeSearch}
            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500 cursor-pointer"
            title="Đóng (Escape)"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Body */}
      <div
        ref={transcriptRef}
        className="flex-1 min-h-0 flex flex-col p-5 relative"
      >
        {lesson.transcript ? (
          editing ? (
            // Edit mode
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 min-h-[300px] text-sm resize-none border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30 rounded-xl leading-relaxed"
            />
          ) : (
            // Read mode (with search highlighting)
            <ScrollArea className="flex-1 min-h-0">
              {renderHighlightedText()}
            </ScrollArea>
          )
        ) : (
          // No transcript — always show editor
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
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Saved!
                </>
              ) : saving ? (
                "Đang lưu..."
              ) : (
                "Lưu Transcript"
              )}
            </Button>
          </div>
        )}

        {/* Floating explain button */}
        {floatingBtn && onExplainSelection && (
          <button
            type="button"
            onClick={handleExplainClick}
            className="absolute z-50 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-lg hover:bg-purple-50 dark:hover:bg-purple-950 hover:border-[#A435F0]/40 transition-all cursor-pointer animate-in fade-in duration-150"
            style={{
              left: `${floatingBtn.x}px`,
              top: `${floatingBtn.y}px`,
              transform: "translateX(-50%)",
            }}
          >
            <Sparkles className="w-3 h-3 text-[#A435F0]" />
            <span className="text-gray-700 dark:text-gray-300">
              Giải thích đoạn này
            </span>
          </button>
        )}
      </div>

      {/* Footer — word count & char count */}
      <div className="flex items-center justify-end px-5 py-2 border-t border-gray-100 dark:border-gray-800">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {formatNumber(wordCount)} từ &middot; {formatNumber(charCount)} ký tự
        </span>
      </div>

      {/* Unsaved changes AlertDialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thay đổi chưa lưu</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có thay đổi chưa lưu. Bạn muốn lưu trước khi thoát chế độ
              chỉnh sửa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleCancelDialog}
              className="cursor-pointer"
            >
              Hủy
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={handleExitWithoutSave}
              className="cursor-pointer"
            >
              Thoát không lưu
            </Button>
            <AlertDialogAction
              onClick={handleSaveAndExit}
              className="bg-[#A435F0] hover:bg-[#8710D8] cursor-pointer"
            >
              Lưu và thoát
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
