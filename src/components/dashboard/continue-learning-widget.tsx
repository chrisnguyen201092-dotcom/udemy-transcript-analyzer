/**
 * ContinueLearningWidget — Shows recent courses with progress bars.
 */

"use client";

import Link from "next/link";
import { BookOpen, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CourseItem {
  id: string;
  title: string;
  contentType: string;
  lastAccessedAt: string | null;
  totalLessons: number;
  completedLessons: number;
  progress: number;
}

interface ContinueLearningWidgetProps {
  courses: CourseItem[];
}

function timeAgo(date: string | null): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h trước`;
  const days = Math.floor(hours / 24);
  return `${days}d trước`;
}

export function ContinueLearningWidget({ courses }: ContinueLearningWidgetProps) {
  if (courses.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#A435F0]" />
          Tiếp tục học
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {courses.slice(0, 5).map((course) => (
          <Link
            key={course.id}
            href={`/?courseId=${course.id}`}
            className="block p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">
                  {course.title}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>
                    {course.completedLessons}/{course.totalLessons} bài
                  </span>
                  {course.lastAccessedAt && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {timeAgo(course.lastAccessedAt)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-xs font-medium text-[#A435F0] shrink-0">
                {course.progress}%
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#A435F0] rounded-full transition-all"
                style={{ width: `${course.progress}%` }}
              />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
