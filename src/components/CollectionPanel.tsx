"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  StickyNote,
  Layers,
  ChevronDown,
  ChevronRight,
  Search,
  Loader2,
  BookOpen,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

// ── Types ──────────────────────────────────────────────────────

interface CollectionItem {
  lessonId: string;
  lessonTitle: string;
  lessonOrder: number;
  content: string;
  updatedAt: string;
}

interface CollectionData {
  courseId: string;
  courseTitle: string;
  notes: CollectionItem[];
  flashcards: CollectionItem[];
  stats: {
    totalNotes: number;
    totalFlashcards: number;
    totalLessons: number;
  };
}

interface CollectionPanelProps {
  courseId: string;
  courseTitle: string;
  onNavigateToLesson?: (lessonId: string) => void;
  onClose?: () => void;
}

type CollectionTab = "notes" | "flashcards";

// ── Component ──────────────────────────────────────────────────

export function CollectionPanel({
  courseId,
  courseTitle,
  onNavigateToLesson,
  onClose,
}: CollectionPanelProps) {
  const [activeTab, setActiveTab] = useState<CollectionTab>("notes");
  const [data, setData] = useState<CollectionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(
    new Set()
  );

  const fetchCollection = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/collection`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json: CollectionData = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  const toggleLesson = (lessonId: string) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  const items =
    activeTab === "notes" ? data?.notes ?? [] : data?.flashcards ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    return items.filter(
      (item) =>
        item.lessonTitle
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 p-5 pb-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
              <Layers className="w-4 h-4 text-[#A435F0]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Bộ sưu tập
              </h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate max-w-[260px]">
                {courseTitle}
              </p>
            </div>
          </div>
          {onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 border-gray-200 dark:border-gray-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {/* Stats */}
        {data && !isLoading && (
          <div className="flex gap-3 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <StickyNote className="w-3 h-3" />
              <span>
                {data.stats.totalNotes}/{data.stats.totalLessons} bài có ghi
                chú
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <BookOpen className="w-3 h-3" />
              <span>
                {data.stats.totalFlashcards}/{data.stats.totalLessons} bài có
                flashcard
              </span>
            </div>
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
          {(
            [
              {
                key: "notes" as const,
                label: "Ghi chú",
                icon: StickyNote,
                count: data?.stats.totalNotes ?? 0,
              },
              {
                key: "flashcards" as const,
                label: "Flashcard",
                icon: BookOpen,
                count: data?.stats.totalFlashcards ?? 0,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "bg-[#A435F0] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {!isLoading && (
                <span
                  className={`text-[10px] px-1 rounded-full ${
                    activeTab === tab.key
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        {!isLoading && items.length > 0 && (
          <div className="relative mt-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === "notes"
                  ? "Tìm trong ghi chú..."
                  : "Tìm trong flashcard..."
              }
              className="pl-8 h-8 text-xs bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-10 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                {activeTab === "notes" ? (
                  <StickyNote className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                ) : (
                  <BookOpen className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                {searchQuery
                  ? "Không tìm thấy kết quả"
                  : activeTab === "notes"
                    ? "Chưa có ghi chú nào"
                    : "Chưa có flashcard nào"}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {searchQuery
                  ? "Thử từ khóa khác"
                  : activeTab === "notes"
                    ? "Vào từng bài học và thêm ghi chú ở tab Ghi chú"
                    : "Vào từng bài học và tạo flashcard ở tab Luyện tập"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((item) => {
                const isExpanded = expandedLessons.has(item.lessonId);
                return (
                  <div
                    key={`${activeTab}-${item.lessonId}`}
                    className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900"
                  >
                    {/* Lesson header - use div instead of button to avoid nested button */}
                    <div
                      onClick={() => toggleLesson(item.lessonId)}
                      className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                          <span className="text-gray-400 dark:text-gray-500 mr-1">
                            #{item.lessonOrder}
                          </span>
                          {item.lessonTitle}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                          {activeTab === "notes"
                            ? `${item.content.length} ký tự`
                            : `${countFlashcards(item.content)} thẻ`}
                          {" · "}
                          {formatRelativeTime(item.updatedAt)}
                        </p>
                      </div>
                      {onNavigateToLesson && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToLesson(item.lessonId);
                          }}
                          className="shrink-0 text-[10px] text-[#A435F0] hover:text-[#8710D8] font-medium cursor-pointer px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
                        >
                          Đi tới bài
                        </button>
                      )}
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 dark:border-gray-800 p-3.5">
                        {activeTab === "notes" ? (
                          <div className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                            {item.content}
                          </div>
                        ) : (
                          <FlashcardDeck markdown={item.content} lessonId={item.lessonId} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────

function countFlashcards(markdown: string): number {
  const matches = markdown.match(/^####\s+Thẻ\s+\d+/gm);
  return matches ? matches.length : 0;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHr < 24) return `${diffHr} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
