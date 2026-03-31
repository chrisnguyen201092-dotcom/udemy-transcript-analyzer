"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StudyHeatmap } from "@/components/StudyHeatmap";

interface OverviewData {
  totalCourses: number;
  totalLessonsCompleted: number;
  totalTimeSeconds: number;
  averageQuizScore: number | null;
  overallRetentionRate: number | null;
  currentStreak: number;
  longestStreak: number;
  studyFrequency: Array<{ date: string; lessonsCompleted: number }>;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // M-28: Send timezone offset so server can bucket dates in user's local time
        const tzOffset = new Date().getTimezoneOffset();
        const res = await fetch(`/api/analytics/overview?tzOffset=${tzOffset}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Không thể tải dữ liệu thống kê");
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
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-100 dark:border-gray-800 p-3"
            >
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-5 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-40 mt-2" />
        <Skeleton className="h-[100px] w-full" />
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

  const metrics = [
    {
      icon: "📚",
      label: "Bài học hoàn thành",
      value: String(data.totalLessonsCompleted),
    },
    {
      icon: "⏱️",
      label: "Tổng thời gian học",
      value: formatTime(data.totalTimeSeconds),
    },
    {
      icon: "📝",
      label: "Điểm quiz TB",
      value:
        data.averageQuizScore !== null
          ? `${Math.round(data.averageQuizScore)}%`
          : "—",
    },
    {
      icon: "🧠",
      label: "Tỉ lệ nhớ SRS",
      value:
        data.overallRetentionRate !== null
          ? `${Math.round(data.overallRetentionRate)}%`
          : "—",
    },
    {
      icon: "🔥",
      label: "Streak hiện tại",
      value: `${data.currentStreak} ngày`,
    },
    {
      icon: "🏆",
      label: "Streak dài nhất",
      value: `${data.longestStreak} ngày`,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{m.icon}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">
                {m.label}
              </span>
            </div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {/* Study heatmap */}
      <div>
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          📊 Hoạt động học tập
        </h3>
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
          <StudyHeatmap data={data.studyFrequency} />
        </div>
      </div>
    </div>
  );
}
