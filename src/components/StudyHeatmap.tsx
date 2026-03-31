"use client";

import { useMemo } from "react";

interface StudyHeatmapProps {
  data: Array<{ date: string; lessonsCompleted: number }>;
}

function getColorClass(count: number): string {
  if (count === 0) return "bg-gray-100 dark:bg-gray-800";
  if (count <= 2) return "bg-[#A435F0]/20";
  if (count <= 5) return "bg-[#A435F0]/50";
  return "bg-[#A435F0]";
}

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""] as const;
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function StudyHeatmap({ data }: StudyHeatmapProps) {
  const { grid, monthLabels } = useMemo(() => {
    // Build a map of date -> lessonsCompleted
    const dateMap = new Map<string, number>();
    for (const d of data) {
      dateMap.set(d.date, d.lessonsCompleted);
    }

    // Build 52 weeks × 7 days grid (364 cells, most recent = rightmost)
    const today = new Date();
    const cells: Array<{ date: string; count: number; dayOfWeek: number }> = [];

    // Go back 363 days from today using local timezone
    const totalDays = 52 * 7; // 364 cells
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays + 1);

    // Adjust to start from the nearest Monday
    const startDay = startDate.getDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    startDate.setDate(startDate.getDate() + mondayOffset);

    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      // Use toLocaleDateString("sv") for local timezone date (yyyy-MM-dd)
      const dateStr = d.toLocaleDateString("sv");
      const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0..Sun=6
      cells.push({
        date: dateStr,
        count: dateMap.get(dateStr) ?? 0,
        dayOfWeek,
      });
    }

    // Organize into weeks (columns)
    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }

    // Calculate month labels
    const labels: Array<{ label: string; weekIndex: number }> = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const firstCell = weeks[w][0];
      if (!firstCell) continue;
      const month = new Date(firstCell.date).getMonth();
      if (month !== lastMonth) {
        labels.push({ label: MONTH_NAMES[month], weekIndex: w });
        lastMonth = month;
      }
    }

    return { grid: weeks, monthLabels: labels };
  }, [data]);

  return (
    <div className="w-full overflow-x-auto">
      {/* Month labels */}
      <div className="flex ml-[30px]" style={{ gap: "3px" }}>
        {Array.from({ length: 52 }).map((_, i) => {
          const label = monthLabels.find((m) => m.weekIndex === i);
          return (
            <div
              key={i}
              className="text-[9px] text-gray-400 dark:text-gray-500"
              style={{ width: "11px", textAlign: "left" }}
            >
              {label ? label.label : ""}
            </div>
          );
        })}
      </div>

      <div className="flex" style={{ gap: "3px" }}>
        {/* Day labels */}
        <div
          className="flex flex-col justify-between shrink-0"
          style={{ width: "27px", gap: "3px" }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="text-[9px] text-gray-400 dark:text-gray-500 leading-none"
              style={{ height: "11px", display: "flex", alignItems: "center" }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex" style={{ gap: "3px" }}>
          {grid.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col" style={{ gap: "3px" }}>
              {week.map((cell, dIdx) => (
                <div
                  key={`${wIdx}-${dIdx}`}
                  className={`rounded-[2px] ${getColorClass(cell.count)}`}
                  style={{ width: "11px", height: "11px" }}
                  title={`${cell.date}: ${cell.count} bài học`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-2 ml-[30px]">
        <span className="text-[9px] text-gray-400 dark:text-gray-500">Ít</span>
        <div
          className="rounded-[2px] bg-gray-100 dark:bg-gray-800"
          style={{ width: "11px", height: "11px" }}
        />
        <div
          className="rounded-[2px] bg-[#A435F0]/20"
          style={{ width: "11px", height: "11px" }}
        />
        <div
          className="rounded-[2px] bg-[#A435F0]/50"
          style={{ width: "11px", height: "11px" }}
        />
        <div
          className="rounded-[2px] bg-[#A435F0]"
          style={{ width: "11px", height: "11px" }}
        />
        <span className="text-[9px] text-gray-400 dark:text-gray-500">Nhiều</span>
      </div>
    </div>
  );
}
