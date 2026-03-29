"use client";

import { useState } from "react";
import { Check, FileText } from "lucide-react";
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
}

export function TranscriptPanel({ lesson, onSaveTranscript }: TranscriptPanelProps) {
  const [draft, setDraft] = useState(lesson.transcript || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    await onSaveTranscript(lesson.id, draft);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5 text-gray-500" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">Transcript</h2>
          <p className="text-xs text-gray-400 truncate mt-0.5">{lesson.title}</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5">
        {lesson.transcript ? (
          <ScrollArea className="h-80">
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pr-3">
              {lesson.transcript}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              Chưa có transcript. Paste nội dung bên dưới để lưu thủ công.
            </p>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Paste transcript here..."
              className="h-56 text-sm resize-none border-gray-200 focus-visible:ring-[#5B5BD6]/30 rounded-xl"
            />
            <Button
              onClick={handleSave}
              disabled={!draft.trim() || saving}
              className="self-end gap-2 cursor-pointer bg-[#5B5BD6] hover:bg-[#4F4DC4] rounded-lg h-8 text-xs px-4"
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
