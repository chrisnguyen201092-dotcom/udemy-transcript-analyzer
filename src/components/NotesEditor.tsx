"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  insertText,
  onInsertHandled,
}: NotesEditorProps) {
  const [content, setContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoSaveRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch notes when lesson changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setSaveStatus("idle");
    setLastSaved(null);
    skipAutoSaveRef.current = true;

    fetch(`/api/lessons/${lessonId}/notes`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
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
          setContent("");
          setIsLoading(false);
          skipAutoSaveRef.current = false;
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
    if (skipAutoSaveRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveNotes(content);
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [content, saveNotes]);

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
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {wordCount} từ · {charCount} ký tự
        </div>
      </div>

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
