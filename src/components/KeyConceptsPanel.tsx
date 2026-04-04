"use client";

import { useState } from "react";
import { Loader2, BookOpen, Tag, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConceptCrossRefLinks } from "@/components/ConceptCrossRefLinks";
import { CATEGORY_COLORS } from "@/lib/category-colors";

interface Concept {
  term: string;
  definition: string;
  category?: string;
  relatedTerms?: string[];
}

interface GlossaryEntry {
  term: string;
  chapters?: { id: string; title: string }[];
}

interface KeyConceptsPanelProps {
  concepts: Concept[];
  isLoading: boolean;
  onExtract: () => void;
  isConfigured: boolean;
  hasTranscript: boolean;
  elapsedSeconds: number;
  /** Optional glossary data to provide chapter cross-reference links */
  glossary?: GlossaryEntry[];
  /** Called when user clicks a cross-reference chapter link */
  onNavigateToChapter?: (chapterId: string) => void;
}

export function KeyConceptsPanel({
  concepts,
  isLoading,
  onExtract,
  isConfigured,
  hasTranscript,
  elapsedSeconds,
  glossary,
  onNavigateToChapter,
}: KeyConceptsPanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Build a lookup map: term (lowercase) → chapters array from glossary
  const glossaryMap = glossary
    ? new Map(glossary.map((g) => [g.term.toLowerCase(), g.chapters ?? []]))
    : null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-xs">
          Đang trích xuất khái niệm...{elapsedSeconds > 0 && ` (${elapsedSeconds}s)`}
        </span>
      </div>
    );
  }

  if (concepts.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 text-center">
          <BookOpen className="w-5 h-5 mx-auto mb-2 text-amber-500/50" />
          Nhấn nút để AI trích xuất khái niệm chính từ chương này
        </div>
        <Button
          onClick={onExtract}
          disabled={!hasTranscript || !isConfigured}
          variant="outline"
          size="sm"
          className="cursor-pointer w-full text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/20 rounded-lg h-8 text-xs"
        >
          Trích xuất khái niệm
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {concepts.length} khái niệm
        </span>
        <Button
          onClick={onExtract}
          disabled={!hasTranscript || !isConfigured || isLoading}
          variant="ghost"
          size="sm"
          className="cursor-pointer text-[10px] text-gray-400 hover:text-amber-600 h-6"
        >
          Trích xuất lại
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-[160px]">
        <div className="flex flex-col gap-2">
          {concepts.map((c, i) => (
            <button
              key={c.term}
              type="button"
              onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
              className="w-full text-left bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-800 p-3 hover:border-amber-200 dark:hover:border-amber-800 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-2">
                <Tag className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {c.term}
                    </span>
                    {c.category && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[c.category] ?? CATEGORY_COLORS["thuật ngữ"]}`}
                      >
                        {c.category}
                      </span>
                    )}
                  </div>
                  {(expandedIndex === i || concepts.length <= 5) && (
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                      {c.definition}
                    </p>
                  )}
                  {expandedIndex === i && c.relatedTerms && c.relatedTerms.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      {c.relatedTerms.map((rt, j) => (
                        <span
                          key={j}
                          className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400"
                        >
                          {rt}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Cross-reference links from glossary */}
                  {(expandedIndex === i || concepts.length <= 5) &&
                    glossaryMap &&
                    onNavigateToChapter && (() => {
                      const chapters = glossaryMap.get(c.term.toLowerCase()) ?? [];
                      return chapters.length > 1 ? (
                        <ConceptCrossRefLinks
                          chapters={chapters}
                          onNavigate={onNavigateToChapter}
                        />
                      ) : null;
                    })()
                  }
                </div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
