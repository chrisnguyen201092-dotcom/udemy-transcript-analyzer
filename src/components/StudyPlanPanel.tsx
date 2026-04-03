"use client";

import { useState } from "react";
import { Loader2, Calendar, Clock, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StudyPlanChapter {
  id: string;
  title: string;
  estimatedMinutes: number;
}

interface StudyPlanDay {
  day: number;
  chapters: StudyPlanChapter[];
  goals: string;
}

interface StudyPlan {
  days: StudyPlanDay[];
  summary?: string;
}

interface StudyPlanPanelProps {
  courseId: string;
  isConfigured: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  onNavigateToChapter?: (chapterId: string) => void;
}

/**
 * Study plan panel for book content — lets the user specify available days
 * and hours/day, then shows an AI-generated day-by-day reading schedule.
 */
export function StudyPlanPanel({
  courseId,
  isConfigured,
  apiKey,
  baseUrl,
  model,
  onNavigateToChapter,
}: StudyPlanPanelProps) {
  const [availableDays, setAvailableDays] = useState(7);
  const [hoursPerDay, setHoursPerDay] = useState(1);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!isConfigured || isLoading) return;
    setIsLoading(true);
    setError(null);
    setPlan(null);
    setElapsedSeconds(0);

    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);

    try {
      const res = await fetch("/api/ai/study-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          availableDays,
          hoursPerDay,
          apiKey,
          baseUrl,
          model,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to generate study plan");
      }

      const data = (await res.json()) as { plan: StudyPlan };
      setPlan(data.plan);
      // Auto-expand first day
      if (data.plan.days.length > 0) setExpandedDay(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tạo kế hoạch");
    } finally {
      clearInterval(timer);
      setIsLoading(false);
    }
  };

  const totalMinutes = plan?.days.reduce(
    (sum, d) => sum + d.chapters.reduce((s, c) => s + c.estimatedMinutes, 0),
    0
  ) ?? 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Input form */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <Label className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              Số ngày
            </Label>
            <Input
              type="number"
              min={1}
              max={90}
              value={availableDays}
              onChange={(e) => setAvailableDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))}
              className="h-8 text-xs border-amber-200 dark:border-amber-700 focus-visible:ring-amber-400/30"
              disabled={isLoading}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <Label className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              Giờ/ngày
            </Label>
            <Input
              type="number"
              min={0.5}
              max={12}
              step={0.5}
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Math.max(0.5, Math.min(12, parseFloat(e.target.value) || 0.5)))}
              className="h-8 text-xs border-amber-200 dark:border-amber-700 focus-visible:ring-amber-400/30"
              disabled={isLoading}
            />
          </div>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={!isConfigured || isLoading}
          size="sm"
          className="cursor-pointer w-full bg-amber-500 hover:bg-amber-600 text-white text-xs h-8"
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Đang tạo kế hoạch...{elapsedSeconds > 0 && ` (${elapsedSeconds}s)`}
            </span>
          ) : plan ? (
            "Tạo lại kế hoạch"
          ) : (
            "Tạo kế hoạch đọc"
          )}
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-lg p-2.5">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!plan && !isLoading && !error && (
        <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 text-center">
          <Calendar className="w-5 h-5 mx-auto mb-2 text-amber-500/50" />
          Nhập số ngày và giờ học mỗi ngày, AI sẽ tạo lịch đọc phù hợp cho bạn
        </div>
      )}

      {/* Plan results */}
      {plan && (
        <div className="flex flex-col gap-2">
          {/* Summary bar */}
          <div className="flex items-center gap-2 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3 h-3 shrink-0" />
            <span className="flex-1">{plan.summary || `${plan.days.length} ngày · ~${Math.round(totalMinutes / 60)}h tổng`}</span>
            <Clock className="w-3 h-3 shrink-0" />
            <span>{plan.days.length > 0 ? Math.round(totalMinutes / plan.days.length) : 0} phút/ngày</span>
          </div>

          {/* Day cards */}
          <ScrollArea className="flex-1 min-h-[160px]">
            <div className="flex flex-col gap-1.5">
              {plan.days.map((day) => {
                const isExpanded = expandedDay === day.day;
                const dayMinutes = day.chapters.reduce((s, c) => s + c.estimatedMinutes, 0);
                return (
                  <div
                    key={day.day}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden"
                  >
                    {/* Day header — always visible */}
                    <button
                      type="button"
                      onClick={() => setExpandedDay(isExpanded ? null : day.day)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
                    >
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded px-1.5 py-0.5 shrink-0">
                        Ngày {day.day}
                      </span>
                      <span className="flex-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                        {day.chapters.length} chương · {dayMinutes} phút
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      )}
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="px-3 pb-2.5 flex flex-col gap-2">
                        {/* Goal */}
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 italic leading-relaxed border-t border-gray-100 dark:border-gray-700 pt-2">
                          🎯 {day.goals}
                        </p>
                        {/* Chapter list */}
                        <div className="flex flex-col gap-1">
                          {day.chapters.map((ch) => (
                            <div
                              key={ch.id}
                              className="flex items-center gap-2"
                            >
                              <BookOpen className="w-3 h-3 text-amber-500 shrink-0" />
                              {onNavigateToChapter ? (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToChapter(ch.id)}
                                  className="flex-1 text-[11px] text-left text-amber-700 dark:text-amber-400 hover:underline cursor-pointer truncate"
                                  title={ch.title}
                                >
                                  {ch.title}
                                </button>
                              ) : (
                                <span className="flex-1 text-[11px] text-gray-700 dark:text-gray-300 truncate" title={ch.title}>
                                  {ch.title}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 shrink-0">
                                {ch.estimatedMinutes}p
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
