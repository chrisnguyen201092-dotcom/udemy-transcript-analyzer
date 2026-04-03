/**
 * Dashboard page — Post-login landing page with personalized widgets.
 */

"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { ContinueLearningWidget } from "@/components/dashboard/continue-learning-widget";
import { SrsDueWidget } from "@/components/dashboard/srs-due-widget";
import { StudyStatsWidget } from "@/components/dashboard/study-stats-widget";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
  continueLearning: Array<{
    id: string;
    title: string;
    contentType: string;
    lastAccessedAt: string | null;
    totalLessons: number;
    completedLessons: number;
    progress: number;
  }>;
  srsDue: number;
  stats: {
    totalCourses: number;
    completedLessons: number;
    totalLessons: number;
    totalArtifacts: number;
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // Silently fail — widgets will show empty states
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const greeting = user?.name
    ? `Chào ${user.name.split(" ")[0]}!`
    : "Chào bạn!";

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-72 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const isEmpty = !data || data.stats.totalCourses === 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {greeting}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEmpty
            ? "Bắt đầu bằng cách thêm khoá học đầu tiên"
            : "Tiếp tục hành trình học tập của bạn"}
        </p>
      </div>

      {isEmpty ? (
        <EmptyDashboard />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <ContinueLearningWidget courses={data!.continueLearning} />
          </div>
          <SrsDueWidget count={data!.srsDue} />
          <StudyStatsWidget stats={data!.stats} />
        </div>
      )}
    </div>
  );
}
