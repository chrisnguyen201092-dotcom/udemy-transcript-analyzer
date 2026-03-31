"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Loader2, AlertCircle, Search, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface NotesEditorProps {
  lessonId: string;
  lessonTitle?: string;
  courseId?: string;
  /** Text to insert into the editor (e.g. from AI summary). Set to null after handled. */
  insertText?: string | null;
  /** Called after insertText has been processed */
  onInsertHandled?: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function NotesEditor({
  lessonId,
  courseId,
  insertText,
  onInsertHandled,
}: NotesEditorProps) {
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoSaveRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cross-lesson notes search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    lessonId: string;
    lessonTitle: string;
    lessonOrder: number;
    snippet: string;
  }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch notes when lesson changes
  const refetchNotes = () => {
    setIsLoading(true);
    setSaveStatus("idle");
    setLastSaved(null);
    setFetchError(false);
    skipAutoSaveRef.current = true;

    fetch(`/api/lessons/${lessonId}/notes`)
      .then((res) => {
        if (!res.ok) {
          setFetchError(true);
          setAutosaveEnabled(false);
          setIsLoading(false);
          return;
        }
        return res.json();
      })
      .then((data) => {
        if (data !== undefined) {
          setContent(data.notes ?? "");
          setIsLoading(false);
          setAutosaveEnabled(true);
          // Allow auto-save after next user edit
          setTimeout(() => {
            skipAutoSaveRef.current = false;
          }, 100);
        }
      })
      .catch(() => {
        setFetchError(true);
        setAutosaveEnabled(false);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setSaveStatus("idle");
    setLastSaved(null);
    setFetchError(false);
    setAutosaveEnabled(true);
    skipAutoSaveRef.current = true;

    fetch(`/api/lessons/${lessonId}/notes`)
      .then((res) => {
        if (!res.ok) {
          if (!cancelled) {
            setFetchError(true);
            setAutosaveEnabled(false);
            setIsLoading(false);
          }
          return undefined;
        }
        return res.json();
      })
      .then((data) => {
        if (data !== undefined && !cancelled) {
          setContent(data.notes ?? "");
          setIsLoading(false);
          // Allow auto-save after next user edit
          setTimeout(() => {
            skipAutoSaveRef.current = false;
          }, 100);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFetchError(true);
          setAutosaveEnabled(false);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // Handle insertText from parent (e.g. "Lưu vào ghi chú" button from chat)
  useEffect(() => {
    if (!insertText || isLoading) return;

    setContent((prev) => {
      const separator = prev.trim() ? "\n\n---\n\n" : "";
      return prev + separator + insertText;
    });
    onInsertHandled?.();

    // Focus textarea and scroll to bottom
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.scrollTop = ta.scrollHeight;
      }
    }, 50);
  }, [insertText, isLoading, onInsertHandled]);

  const saveNotes = useCallback(
    async (text: string) => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/lessons/${lessonId}/notes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: text }),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaveStatus("saved");
        setLastSaved(new Date());
        setTimeout(
          () => setSaveStatus((s) => (s === "saved" ? "idle" : s)),
          2000
        );
      } catch {
        setSaveStatus("error");
      }
    },
    [lessonId]
  );

  // Auto-save with 1s debounce
  useEffect(() => {
    if (!autosaveEnabled) return;
    if (skipAutoSaveRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNotes(content);
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, saveNotes, autosaveEnabled]);

  // Cross-lesson search with debounce
  useEffect(() => {
    if (!courseId || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/courses/${courseId}/notes/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, courseId]);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 flex-1">
        <Skeleton className="h-4 w-[40%]" />
        <Skeleton className="flex-1 min-h-[200px]" />
        <Skeleton className="h-3 w-[30%]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Fetch error banner */}
      {fetchError && (
        <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs bg-destructive/10 text-destructive">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Failed to load notes. Autosave disabled to prevent data loss.</span>
          </div>
          <button
            type="button"
            onClick={refetchNotes}
            className="shrink-0 underline underline-offset-2 hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
      {/* Save status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Đang lưu...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="w-3 h-3 text-green-500" />
              <span className="text-green-600 dark:text-green-400">Đã lưu</span>
            </>
          )}
          {saveStatus === "error" && (
            <>
              <AlertCircle className="w-3 h-3 text-red-500" />
              <span className="text-red-600 dark:text-red-400">Lỗi lưu</span>
            </>
          )}
          {saveStatus === "idle" && lastSaved && (
            <span>
              Lưu lần cuối:{" "}
              {lastSaved.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {courseId && (
            <button
              type="button"
              onClick={() => {
                setShowSearch(!showSearch);
                if (showSearch) {
                  setSearchQuery("");
                  setSearchResults([]);
                }
              }}
              className={`p-1 rounded transition-colors cursor-pointer ${
                showSearch
                  ? "text-[#A435F0] bg-purple-50 dark:bg-purple-900/20"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
              title="Tìm trong ghi chú các bài"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="text-xs text-gray-400 dark:text-gray-500">
            {wordCount} từ · {charCount} ký tự
          </div>
        </div>
      </div>

      {/* Cross-lesson notes search */}
      {showSearch && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm trong ghi chú các bài..."
              className="pl-8 pr-8 text-xs h-8 border-gray-200 dark:border-gray-700"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {searchLoading && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400 px-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Đang tìm...
            </div>
          )}
          {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
            <div className="text-xs text-gray-400 px-1">
              Không tìm thấy ghi chú nào.
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {searchResults.map((r) => (
                <div
                  key={r.lessonId}
                  className="px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  title={`Bài ${r.lessonOrder}: ${r.lessonTitle}`}
                >
                  <div className="font-medium text-gray-700 dark:text-gray-300 truncate">
                    {r.lessonOrder}. {r.lessonTitle}
                  </div>
                  <div className="text-gray-400 mt-0.5 line-clamp-2">
                    {r.snippet}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Ghi chú của bạn cho bài học này..."
        className="flex-1 min-h-[200px] resize-none text-sm bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-800 rounded-xl p-3.5 focus-visible:ring-[#A435F0]/30"
      />
    </div>
  );
}
