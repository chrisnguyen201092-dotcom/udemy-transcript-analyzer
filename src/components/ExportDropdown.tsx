"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileText, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

interface ExportDropdownProps {
  lessonId: string;
  courseId: string;
  activeTab: string;
  practiceMode: string;
  hasData: {
    summary: boolean;
    explanation: boolean;
    quiz: boolean;
    flashcards: boolean;
    exercises: boolean;
  };
}

interface ExportOption {
  label: string;
  type: string;
  format: string;
  icon: React.ElementType;
  scope: "lesson" | "course";
}

export function ExportDropdown({
  lessonId,
  courseId,
  activeTab,
  practiceMode,
  hasData,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const getExportOptions = (): ExportOption[] => {
    const options: ExportOption[] = [];

    if (activeTab === "summary" && hasData.summary) {
      options.push(
        { label: "Tóm tắt (Markdown)", type: "summary", format: "markdown", icon: FileText, scope: "lesson" },
        { label: "Tóm tắt (Text)", type: "summary", format: "csv", icon: FileText, scope: "lesson" },
      );
    }

    if (activeTab === "explain" && hasData.explanation) {
      options.push(
        { label: "Giải thích (Markdown)", type: "explanation", format: "markdown", icon: FileText, scope: "lesson" },
        { label: "Giải thích (Text)", type: "explanation", format: "csv", icon: FileText, scope: "lesson" },
      );
    }

    if (activeTab === "practice") {
      if (practiceMode === "quiz" && hasData.quiz) {
        options.push(
          { label: "Quiz (Markdown)", type: "quiz", format: "markdown", icon: FileSpreadsheet, scope: "lesson" },
          { label: "Quiz (Text)", type: "quiz", format: "csv", icon: FileSpreadsheet, scope: "lesson" },
        );
      }
      if (practiceMode === "flashcards" && hasData.flashcards) {
        options.push(
          { label: "Flashcard (Markdown)", type: "flashcards", format: "markdown", icon: FileSpreadsheet, scope: "lesson" },
          { label: "Flashcard (Text)", type: "flashcards", format: "csv", icon: FileSpreadsheet, scope: "lesson" },
        );
      }
      if (practiceMode === "exercises" && hasData.exercises) {
        options.push(
          { label: "Bài tập (Markdown)", type: "exercises", format: "markdown", icon: FileSpreadsheet, scope: "lesson" },
          { label: "Bài tập (Text)", type: "exercises", format: "csv", icon: FileSpreadsheet, scope: "lesson" },
        );
      }
    }

    return options;
  };

  const handleExport = async (option: ExportOption) => {
    const key = `${option.type}-${option.format}`;
    setExporting(key);
    try {
      const exportUrl = option.scope === "lesson"
        ? `/api/export/lesson/${lessonId}`
        : `/api/export/course/${courseId}`;
      const res = await fetch(exportUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: option.type, format: option.format }),
      });

      if (!res.ok) {
        toast.error("Lỗi khi xuất file");
        setExporting(null);
        return;
      }

      const blob = await res.blob();
      const filename = `${option.type}.${option.format}`;
      const url = URL.createObjectURL(blob);
      try {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } finally {
        URL.revokeObjectURL(url);
      }
      toast.success(`Đã xuất ${option.label}`);
    } catch {
      toast.error("Lỗi khi xuất file");
    }
    setExporting(null);
    setOpen(false);
  };

  const options = getExportOptions();

  if (options.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setOpen(!open)}
        variant="ghost"
        size="sm"
        className="cursor-pointer h-7 w-7 p-0 text-gray-400 hover:text-[#A435F0]"
        title="Xuất nội dung"
      >
        <Download className="w-3.5 h-3.5" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1.5">
          <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              Xuất nội dung
            </p>
          </div>
          {options.map((option) => {
            const Icon = option.icon;
            const key = `${option.type}-${option.format}`;
            const isExporting = exporting === key;
            return (
              <button
                key={key}
                onClick={() => handleExport(option)}
                disabled={isExporting}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A435F0]" />
                ) : (
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                )}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
