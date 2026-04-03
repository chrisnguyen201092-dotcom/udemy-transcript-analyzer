/**
 * StudyStatsWidget — Summary statistics for the user's learning.
 */

"use client";

import { BarChart3, BookMarked, Layers, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StudyStatsWidgetProps {
  stats: {
    totalCourses: number;
    completedLessons: number;
    totalLessons: number;
    totalArtifacts: number;
  };
}

export function StudyStatsWidget({ stats }: StudyStatsWidgetProps) {
  const statItems = [
    {
      label: "Khoá học",
      value: stats.totalCourses,
      icon: BookMarked,
    },
    {
      label: "Bài đã học",
      value: stats.completedLessons,
      icon: Layers,
    },
    {
      label: "Tài liệu AI",
      value: stats.totalArtifacts,
      icon: Sparkles,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#A435F0]" />
          Thống kê
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {statItems.map((item) => (
            <div key={item.label} className="text-center">
              <item.icon className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {item.value}
              </p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
