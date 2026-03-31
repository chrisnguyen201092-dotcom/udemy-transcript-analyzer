"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface SRSLesson {
  lessonId: string;
  lessonTitle: string;
  dueCount: number;
  totalCards: number;
  masteredCount: number;
}

interface SRSDashboardData {
  totalDue: number;
  lessons: SRSLesson[];
}

interface SRSDashboardProps {
  onNavigateToLesson?: (lessonId: string) => void;
}

export function SRSDashboard({ onNavigateToLesson }: SRSDashboardProps) {
  const [data, setData] = useState<SRSDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/srs/dashboard", { signal: controller.signal });
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        toast.error("Lỗi khi tải dữ liệu SRS");
      }
      setLoading(false);
    };
    loadDashboard();
    return () => controller.abort();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <Loader2 className="w-4 h-4 animate-spin text-[#A435F0]" />
        <span className="text-xs text-gray-500">Đang tải tổng quan SRS...</span>
      </div>
    );
  }

  if (!data || data.lessons.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <BookOpen className="w-8 h-8 text-gray-300" />
        <p className="text-xs text-gray-500">Chưa có dữ liệu SRS. Hãy tạo flashcard và bắt đầu ôn tập!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="bg-gradient-to-br from-[#A435F0]/5 to-purple-100/30 dark:from-gray-800 dark:to-gray-800/50 border border-[#A435F0]/20 dark:border-gray-700 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Tổng quan ôn tập
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {data.totalDue > 0
                ? `${data.totalDue} thẻ cần ôn hôm nay`
                : "Không có thẻ nào cần ôn 🎉"}
            </p>
          </div>
          <div className="text-2xl font-bold text-[#A435F0]">{data.totalDue}</div>
        </div>
      </div>

      {/* Lesson list */}
      <div className="space-y-2">
        {data.lessons.map((lesson) => {
          const progress = lesson.totalCards > 0
            ? Math.round((lesson.masteredCount / lesson.totalCards) * 100)
            : 0;
          return (
            <div
              key={lesson.lessonId}
              className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                    {lesson.lessonTitle}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-gray-500">
                      {lesson.totalCards} thẻ
                    </span>
                    <span className="text-[10px] text-green-600 dark:text-green-400">
                      ✓ {lesson.masteredCount} thuộc
                    </span>
                    {lesson.dueCount > 0 && (
                      <span className="text-[10px] text-orange-600 dark:text-orange-400">
                        ⏰ {lesson.dueCount} cần ôn
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#A435F0] rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                {lesson.dueCount > 0 && onNavigateToLesson && (
                  <Button
                    onClick={() => onNavigateToLesson(lesson.lessonId)}
                    variant="outline"
                    size="sm"
                    className="shrink-0 text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 cursor-pointer text-xs"
                  >
                    Ôn tập
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
