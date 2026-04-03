"use client";

import { useState, useMemo } from "react";
import { Loader2, BookMarked, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GlossaryChapter {
  id: string;
  title: string;
}

interface GlossaryEntry {
  term: string;
  definition: string;
  chapters?: GlossaryChapter[];
  category?: string;
}

interface GlossaryPanelProps {
  glossary: GlossaryEntry[];
  isLoading: boolean;
  onGenerate: () => void;
  isConfigured: boolean;
  hasChaptersWithConcepts: boolean;
  elapsedSeconds?: number;
  onNavigateToChapter?: (chapterId: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  "khái niệm": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "phương pháp": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  "công cụ": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "lý thuyết": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "thuật ngữ": "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function GlossaryPanel({
  glossary,
  isLoading,
  onGenerate,
  isConfigured,
  hasChaptersWithConcepts,
  elapsedSeconds = 0,
  onNavigateToChapter,
}: GlossaryPanelProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Collect unique categories from glossary
  const categories = useMemo(() => {
    const cats = new Set(glossary.map((e) => e.category ?? "thuật ngữ"));
    return Array.from(cats).sort();
  }, [glossary]);

  // Filter by search + category
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return glossary.filter((entry) => {
      const matchSearch =
        !q ||
        entry.term.toLowerCase().includes(q) ||
        entry.definition.toLowerCase().includes(q);
      const matchCategory =
        !activeCategory || (entry.category ?? "thuật ngữ") === activeCategory;
      return matchSearch && matchCategory;
    });
  }, [glossary, search, activeCategory]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs">
          Đang tổng hợp bảng thuật ngữ...{elapsedSeconds > 0 && ` (${elapsedSeconds}s)`}
        </span>
      </div>
    );
  }

  if (glossary.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 text-center">
          <BookMarked className="w-5 h-5 mx-auto mb-2 text-amber-500/50" />
          {hasChaptersWithConcepts
            ? "Nhấn nút để AI tổng hợp bảng thuật ngữ toàn sách"
            : "Hãy trích xuất khái niệm từ các chương trước khi tạo bảng thuật ngữ"}
        </div>
        <Button
          onClick={onGenerate}
          disabled={!isConfigured || !hasChaptersWithConcepts}
          variant="outline"
          size="sm"
          className="cursor-pointer w-full text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20 rounded-lg h-8 text-xs"
        >
          Tạo Bảng thuật ngữ
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header with count + regenerate */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {filtered.length}/{glossary.length} thuật ngữ
        </span>
        <Button
          onClick={onGenerate}
          disabled={!isConfigured || !hasChaptersWithConcepts || isLoading}
          variant="ghost"
          size="sm"
          className="cursor-pointer text-[10px] text-gray-400 hover:text-amber-600 h-6"
        >
          Tạo lại
        </Button>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm thuật ngữ..."
          className="pl-7 h-8 text-xs rounded-lg border-gray-200 dark:border-gray-700"
        />
      </div>

      {/* Category filter badges */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
              activeCategory === null
                ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
                : "bg-gray-50 text-gray-500 border-gray-200 hover:border-amber-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
            }`}
          >
            Tất cả
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                activeCategory === cat
                  ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
                  : "bg-gray-50 text-gray-500 border-gray-200 hover:border-amber-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Glossary list */}
      <ScrollArea className="flex-1 min-h-[160px]">
        <div className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-4">
              Không tìm thấy thuật ngữ phù hợp
            </div>
          ) : (
            filtered.map((entry, i) => (
              <button
                key={`${entry.term}-${i}`}
                type="button"
                onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 p-3 hover:border-amber-200 dark:hover:border-amber-800 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2">
                  <Tag className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {entry.term}
                      </span>
                      {entry.category && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            CATEGORY_COLORS[entry.category] ?? CATEGORY_COLORS["thuật ngữ"]
                          }`}
                        >
                          {entry.category}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                      {entry.definition}
                    </p>
                    {/* Chapter references — visible when expanded or few entries */}
                    {(expandedIndex === i || filtered.length <= 5) &&
                      entry.chapters &&
                      entry.chapters.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-gray-400">Chương:</span>
                          {entry.chapters.map((ch) =>
                            onNavigateToChapter ? (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigateToChapter(ch.id);
                                }}
                                className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
                              >
                                {ch.title}
                              </button>
                            ) : (
                              <span
                                key={ch.id}
                                className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-400"
                              >
                                {ch.title}
                              </span>
                            )
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
