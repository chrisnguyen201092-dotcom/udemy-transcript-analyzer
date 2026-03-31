"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LessonDetail {
  lessonId: string;
  title: string;
  completed: boolean;
  timeSeconds: number;
  quizScore: number | null;
  flashcardsMastered: number;
  flashcardsTotal: number;
  completedAt: string | null;
}

interface CourseDetailData {
  courseId: string;
  courseName: string;
  completionRate: number;
  totalTimeSeconds: number;
  averageQuizScore: number | null;
  lessons: LessonDetail[];
  quizScoreDistribution: Array<{ bin: string; count: number }>;
  retentionRate: number | null;
  masteredCardCount: number;
  dueCardCount: number;
  averageEaseFactor: number | null;
}

interface AnalyticsCourseDetailProps {
  courseId: string;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimeShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AnalyticsCourseDetail({ courseId }: AnalyticsCourseDetailProps) {
  const [data, setData] = useState<CourseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics/course/${courseId}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Không thể tải dữ liệu thống kê khóa học");
        const json = await res.json();
        setData(json);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Lỗi không xác định");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-100 dark:border-gray-800 p-2.5"
            >
              <Skeleton className="h-3 w-12 mb-1.5" />
              <Skeleton className="h-5 w-10" />
            </div>
          ))}
        </div>
        <Skeleton className="h-[100px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2.5">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const totalFlashcards = data.lessons.reduce(
    (sum, l) => sum + l.flashcardsTotal,
    0
  );

  const topMetrics = [
    {
      label: "Hoàn thành",
      value: `${Math.round(data.completionRate)}%`,
    },
    {
      label: "Thời gian",
      value: formatTime(data.totalTimeSeconds),
    },
    {
      label: "Quiz TB",
      value:
        data.averageQuizScore !== null
          ? `${Math.round(data.averageQuizScore)}%`
          : "—",
    },
    {
      label: "Flashcard",
      value:
        totalFlashcards > 0
          ? `${data.masteredCardCount}/${totalFlashcards}`
          : "—",
    },
  ];

  // Quiz histogram
  const maxCount = Math.max(
    ...data.quizScoreDistribution.map((d) => d.count),
    1
  );
  const allZero = data.quizScoreDistribution.every((d) => d.count === 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Top metric cards */}
      <div className="grid grid-cols-4 gap-2">
        {topMetrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5 text-center"
          >
            <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
              {m.label}
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Quiz score histogram */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
          📊 Phân bố điểm quiz
        </h3>
        {allZero ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            Chưa có dữ liệu quiz
          </div>
        ) : (
          <div className="flex items-end justify-center gap-3">
            {data.quizScoreDistribution.map((bin) => {
              const height = (bin.count / maxCount) * 80;
              return (
                <div
                  key={bin.bin}
                  className="flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                    {bin.count}
                  </span>
                  <div
                    className="w-8 rounded-t bg-[#A435F0] min-h-[2px]"
                    style={{ height: `${Math.max(height, 2)}px` }}
                  />
                  <span className="text-[9px] text-gray-400 dark:text-gray-500">
                    {bin.bin}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lesson table */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 p-3 pb-0">
          📋 Chi tiết bài học
        </h3>
        <ScrollArea className="max-h-[300px]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 w-8">
                  STT
                </th>
                <th className="text-left py-2 px-3 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  Tên bài
                </th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 w-14">
                  Thời gian
                </th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 w-12">
                  Quiz
                </th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 w-16">
                  Flashcard
                </th>
                <th className="text-center py-2 px-3 text-[10px] font-medium text-gray-400 dark:text-gray-500 w-12">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {data.lessons.map((lesson, idx) => (
                <tr
                  key={lesson.lessonId}
                  className="border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                >
                  <td className="py-1.5 px-3 text-gray-400 dark:text-gray-500">
                    {idx + 1}
                  </td>
                  <td className="py-1.5 px-3 text-gray-700 dark:text-gray-300 truncate max-w-[140px]">
                    {lesson.title}
                  </td>
                  <td className="py-1.5 px-3 text-right text-gray-500 dark:text-gray-400">
                    {formatTimeShort(lesson.timeSeconds)}
                  </td>
                  <td className="py-1.5 px-3 text-right text-gray-500 dark:text-gray-400">
                    {lesson.quizScore !== null
                      ? `${Math.round(lesson.quizScore)}%`
                      : "—"}
                  </td>
                  <td className="py-1.5 px-3 text-right text-gray-500 dark:text-gray-400">
                    {lesson.flashcardsTotal > 0
                      ? `${lesson.flashcardsMastered}/${lesson.flashcardsTotal}`
                      : "—"}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    {lesson.completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mx-auto" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </div>
    </div>
  );
}
