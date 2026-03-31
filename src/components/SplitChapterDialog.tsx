"use client";

import { useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SplitChapterDialogProps {
  lesson: { id: string; title: string; transcript: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (splitIndex: number, newTitle: string) => Promise<void>;
}

export function SplitChapterDialog({
  lesson,
  open,
  onOpenChange,
  onConfirm,
}: SplitChapterDialogProps) {
  const [splitIndex, setSplitIndex] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState(`${lesson.title} (phần 2)`);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transcript = lesson.transcript ?? "";
  const topContent = splitIndex !== null ? transcript.slice(0, splitIndex).trimEnd() : "";
  const bottomContent = splitIndex !== null ? transcript.slice(splitIndex).trimStart() : "";

  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  const canConfirm = splitIndex !== null && topContent.length > 0 && bottomContent.length > 0 && newTitle.trim().length > 0;

  const handleTextareaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    const pos = target.selectionStart;
    if (pos > 0 && pos < transcript.length) {
      setSplitIndex(pos);
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm || splitIndex === null) return;
    setLoading(true);
    try {
      await onConfirm(splitIndex, newTitle.trim());
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setSplitIndex(null);
      setNewTitle(`${lesson.title} (phần 2)`);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tách chương</DialogTitle>
          <DialogDescription>
            Nhấn vào vị trí trong nội dung để chọn điểm tách. Phần trên giữ nguyên, phần dưới thành chương mới.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          <textarea
            ref={textareaRef}
            readOnly
            value={transcript}
            onClick={handleTextareaClick}
            className="w-full h-48 text-xs font-mono p-3 border rounded-md resize-none cursor-text bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#A435F0]/30"
          />

          {splitIndex !== null && (
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">
                  Phần trên (giữ nguyên) — {wordCount(topContent)} từ
                </p>
                <p className="text-blue-600 dark:text-blue-400 line-clamp-3">{topContent.slice(0, 200)}...</p>
              </div>
              <div className="p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <p className="font-semibold text-amber-700 dark:text-amber-300 mb-1">
                  Phần dưới (chương mới) — {wordCount(bottomContent)} từ
                </p>
                <p className="text-amber-600 dark:text-amber-400 line-clamp-3">{bottomContent.slice(0, 200)}...</p>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Tên chương mới
            </label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nhập tên chương mới..."
              className="text-xs h-8"
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            className="cursor-pointer"
          >
            Hủy
          </Button>
          <Button
            size="sm"
            disabled={!canConfirm || loading}
            onClick={handleConfirm}
            className="bg-[#A435F0] hover:bg-[#8710D8] cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                Đang tách...
              </>
            ) : (
              "Tách"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
