"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  StickyNote,
  Layers,
  Search,
  BookOpen,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CollectionItemList } from "@/components/CollectionItemList";

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
  // M-6: Distinguish fetch error from empty state
  const [fetchError, setFetchError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(
    new Set()
  );

  const fetchCollection = useCallback(async () => {
    setIsLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/courses/${courseId}/collection`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json: CollectionData = await res.json();
      setData(json);
    } catch {
      // M-6: Set error flag so UI can distinguish error from empty
      setFetchError(true);
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

  const items = useMemo(
    () => (activeTab === "notes" ? data?.notes ?? [] : data?.flashcards ?? []),
    [activeTab, data]
  );

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
          ) : fetchError ? (
            // M-6: Show distinct error message with retry button
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <p className="text-sm text-red-500 dark:text-red-400 font-medium">
                Lỗi tải dữ liệu. Thử lại?
              </p>
              <button
                type="button"
                onClick={fetchCollection}
                className="text-xs text-[#A435F0] underline underline-offset-2 hover:no-underline cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <CollectionItemList
              items={filtered}
              activeTab={activeTab}
              expandedLessons={expandedLessons}
              searchQuery={searchQuery}
              onToggleLesson={toggleLesson}
              onNavigateToLesson={onNavigateToLesson}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
