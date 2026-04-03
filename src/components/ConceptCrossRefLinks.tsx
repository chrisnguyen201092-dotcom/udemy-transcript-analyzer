"use client";

import { BookOpen } from "lucide-react";

interface CrossRefChapter {
  id: string;
  title: string;
}

interface ConceptCrossRefLinksProps {
  /** Chapter list from glossary entry — the cross-reference data */
  chapters: CrossRefChapter[];
  /** Called when user clicks a chapter link */
  onNavigate: (chapterId: string) => void;
  /** Max number of chapters to display before collapsing */
  maxVisible?: number;
}

/**
 * Renders "Xem thêm ở: Chương X, Chương Y" cross-reference links.
 * Used inside KeyConceptsPanel and GlossaryPanel for book content.
 */
export function ConceptCrossRefLinks({
  chapters,
  onNavigate,
  maxVisible = 3,
}: ConceptCrossRefLinksProps) {
  if (!chapters || chapters.length === 0) return null;

  const visible = chapters.slice(0, maxVisible);
  const overflow = chapters.length - maxVisible;

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      <BookOpen className="w-3 h-3 text-amber-500 shrink-0" />
      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">
        Xem thêm ở:
      </span>
      {visible.map((ch, i) => (
        <button
          key={ch.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(ch.id);
          }}
          className="text-[10px] px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
          title={ch.title}
        >
          {ch.title.length > 24 ? ch.title.slice(0, 22) + "…" : ch.title}
          {i < visible.length - 1 && overflow === 0 ? "" : ""}
        </button>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-amber-500 dark:text-amber-500">
          và {overflow} chương khác
        </span>
      )}
    </div>
  );
}
