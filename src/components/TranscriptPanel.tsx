"use client";

import { useState, useEffect } from "react";
import { Check, FileText, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Lesson {
  id: string;
  title: string;
  order: number;
  transcript: string | null;
}

interface TranscriptPanelProps {
  lesson: Lesson;
  onSaveTranscript: (lessonId: string, transcript: string) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * TranscriptPanel — must be rendered with `key={lesson.id}` from parent
 * so that React fully remounts on lesson change, resetting all local state.
 */
export function TranscriptPanel({ lesson, onSaveTranscript, onDirtyChange }: TranscriptPanelProps) {
  const [draft, setDraft] = useState(lesson.transcript || "");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = editing && draft !== (lesson.transcript || "");

  // Notify parent of dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Transcript</h2>
            {isDirty && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Có thay đổi chưa lưu" />
            )}
            {saved && (
              <span className="text-[10px] text-emerald-600 font-medium">Đã lưu!</span>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{lesson.title}</p>
        </div>

        {/* Toggle edit button — only when transcript exists */}
        {lesson.transcript && !editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={startEditing}
            className="h-7 gap-1.5 text-xs text-gray-500 hover:text-[#A435F0] cursor-pointer shrink-0"
          >
            <Pencil className="w-3 h-3" />
            Chỉnh sửa
          </Button>
        )}

        {/* Save / Cancel buttons in edit mode */}
        {editing && (
          <div className="flex gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
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

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col p-5">
        {lesson.transcript ? (
          editing ? (
            // Edit mode
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 min-h-[300px] text-sm resize-none border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30 rounded-xl leading-relaxed"
            />
          ) : (
            // Read mode
            <ScrollArea className="flex-1 min-h-0">
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed pr-3">
                {lesson.transcript}
              </div>
            </ScrollArea>
          )
        ) : (
          // No transcript — always show editor
          <div className="flex flex-col gap-3">
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-800 rounded-xl px-3 py-2.5">
              Chưa có transcript. Paste nội dung bên dưới để lưu thủ công.
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
      </div>
    </div>
  );
}
