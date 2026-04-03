/**
 * Dashboard page — Post-login landing page with personalized widgets.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ContinueLearningWidget } from "@/components/dashboard/continue-learning-widget";
import { SrsDueWidget } from "@/components/dashboard/srs-due-widget";
import { StudyStatsWidget } from "@/components/dashboard/study-stats-widget";
import { EmptyDashboard } from "@/components/dashboard/empty-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, BookOpen, Clock, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLabels } from "@/lib/content-type-labels";

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
  const [error, setError] = useState(false);

  const fetchDashboard = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        setData(await res.json());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {greeting}
        </h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Không thể tải dữ liệu dashboard. Vui lòng thử lại.
            </p>
            <Button
              onClick={fetchDashboard}
              variant="outline"
              className="gap-2 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              Thử lại
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isEmpty = !data || data.stats.totalCourses === 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {greeting}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEmpty
              ? "Bắt đầu bằng cách thêm khoá học đầu tiên"
              : "Tiếp tục hành trình học tập của bạn"}
          </p>
        </div>
        <Link href="/">
          <Button className="gap-2 bg-[#A435F0] hover:bg-[#8710D8] text-white cursor-pointer">
            <Plus className="h-4 w-4" />
            Thêm nguồn
          </Button>
        </Link>
      </div>

      {isEmpty ? (
        <EmptyDashboard />
      ) : (
        <div className="space-y-6">
          {/* Continue Learning + Stats row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <ContinueLearningWidget courses={data!.continueLearning} />
            </div>
            <SrsDueWidget count={data!.srsDue} />
            <StudyStatsWidget stats={data!.stats} />
          </div>

          {/* My Courses section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#A435F0]" />
                  Khoá học của tôi
                </CardTitle>
                <Link href="/" className="text-sm text-[#A435F0] hover:underline">
                  Xem tất cả →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data!.continueLearning.map((course) => (
                  <Link
                    key={course.id}
                    href={`/?courseId=${course.id}`}
                    className="block p-4 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {course.contentType === "book" ? (
                        <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <Play className="w-3.5 h-3.5 text-[#A435F0] shrink-0" />
                      )}
                      <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                        {course.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{course.completedLessons}/{course.totalLessons} {getLabels(course.contentType).lesson.toLowerCase()}</span>
                      <span>·</span>
                      <span>{course.progress}%</span>
                    </div>
                    <div className="mt-2 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#A435F0] rounded-full"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#A435F0]" />
                Hoạt động gần đây
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center py-6">
                Hoạt động học tập sẽ hiển thị tại đây khi bạn bắt đầu học.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
