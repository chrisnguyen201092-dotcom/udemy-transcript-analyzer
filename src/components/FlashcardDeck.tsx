"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Eye, Loader2, RotateCw, Plus, X } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { parseFlashcards } from "@/lib/flashcard-parser";
import { useSrsReview } from "@/hooks/use-srs-review";
import { FlashcardSrsView } from "@/components/flashcard-srs-view";

// ── Types ──────────────────────────────────────────────────────

interface FlashcardDeckProps {
  markdown: string;
  mode?: "normal" | "srs";
  lessonId?: string;
  onFlashcardsChange?: (newMarkdown: string) => void;
  onReviewComplete?: () => void;
}

// ── Add-card inline form ────────────────────────────────────────

interface AddCardFormProps {
  onAdd: (front: string, back: string, hint: string, mnemonic: string) => void;
  onClose: () => void;
}

function AddCardForm({ onAdd, onClose }: AddCardFormProps) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [hint, setHint] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!front.trim() || !back.trim()) return;
    setSaving(true);
    onAdd(front.trim(), back.trim(), hint.trim(), mnemonic.trim());
    setSaving(false);
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">Thêm thẻ mới</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Mặt trước *</label>
        <Textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="Câu hỏi hoặc khái niệm..." className="text-sm min-h-[60px] resize-none" />
      </div>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Mặt sau *</label>
        <Textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Câu trả lời hoặc giải thích..." className="text-sm min-h-[60px] resize-none" />
      </div>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Gợi ý (tuỳ chọn)</label>
        <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Gợi ý nhỏ..." className="text-sm" />
      </div>
      <div>
        <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">Mnemonic (tuỳ chọn)</label>
        <Input value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} placeholder="Mẹo ghi nhớ..." className="text-sm" />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!front.trim() || !back.trim() || saving}
        className="w-full bg-[#A435F0] hover:bg-[#8710D8] text-white text-xs cursor-pointer"
      >
        {saving ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Đang lưu...</> : "Thêm thẻ"}
      </Button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────

export function FlashcardDeck({ markdown, mode = "normal", lessonId, onFlashcardsChange, onReviewComplete }: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const cards = parseFlashcards(markdown);
  const currentCard = cards[currentIndex];

  // SRS mode via hook
  const {
    srsCards, srsLoading, srsReviewIndex, srsCompleted, srsStats,
    currentSrsCard, handleSrsRate, resetSession,
  } = useSrsReview(lessonId, mode === "srs", onReviewComplete);

  // Keep refs for keyboard handler to avoid stale closures
  const stateRef = useRef({ currentIndex, cardsLength: cards.length });
  useEffect(() => {
    stateRef.current = { currentIndex, cardsLength: cards.length };
  });

  // Keyboard navigation: ← → Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { currentIndex: idx, cardsLength } = stateRef.current;
      if (e.key === "ArrowRight" && idx < cardsLength - 1) {
        setCurrentIndex(idx + 1); setIsFlipped(false); setShowHint(false);
      }
      if (e.key === "ArrowLeft" && idx > 0) {
        setCurrentIndex(idx - 1); setIsFlipped(false); setShowHint(false);
      }
      if (e.key === " ") { e.preventDefault(); setIsFlipped((prev) => !prev); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) { setCurrentIndex(currentIndex + 1); setIsFlipped(false); setShowHint(false); }
  };
  const handlePrev = () => {
    if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); setIsFlipped(false); setShowHint(false); }
  };

  const handleAddCard = (front: string, back: string, hint: string, mnemonic: string) => {
    const nextId = cards.length + 1;
    let newSection = `\n\n#### Thẻ ${nextId} [Loại: Custom] [🟢 Dễ]\n`;
    newSection += `**📌 Mặt trước:**\n> ${front}\n\n`;
    newSection += `**📖 Mặt sau:**\n> ${back}\n`;
    if (hint) newSection += `\n**💡 Gợi ý:** ${hint}\n`;
    if (mnemonic) newSection += `\n**🧠 Mnemonic:** ${mnemonic}\n`;
    newSection += `\n**🏷️ Tag**: Tự tạo`;
    onFlashcardsChange?.(markdown + newSection);
    setCurrentIndex(nextId - 1);
    setIsFlipped(false);
    setShowHint(false);
    setShowAddForm(false);
  };

  // ── SRS mode rendering ──────────────────────────────────────

  if (mode === "srs") {
    return (
      <FlashcardSrsView
        srsLoading={srsLoading}
        srsCards={srsCards}
        srsCompleted={srsCompleted}
        srsStats={srsStats}
        srsReviewIndex={srsReviewIndex}
        currentSrsCard={currentSrsCard}
        onRate={handleSrsRate}
        onReset={resetSession}
      />
    );
  }

  // ── Normal mode rendering ───────────────────────────────────

  if (!cards.length) {
    return <MarkdownRenderer content={markdown} className="text-xs text-gray-700 dark:text-gray-300" />;
  }

  return (
    <div className="space-y-4">
      {showAddForm && <AddCardForm onAdd={handleAddCard} onClose={() => setShowAddForm(false)} />}

      {currentCard && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-600 dark:text-gray-400">Thẻ {currentIndex + 1} / {cards.length}</span>
          {currentCard.difficulty && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
              currentCard.difficulty.includes("Dễ") ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : currentCard.difficulty.includes("Trung bình") ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {currentCard.difficulty}
            </span>
          )}
        </div>
      )}

      <div className="perspective-1000 h-[200px]">
        <div
          className={`relative w-full h-full transition-transform duration-300 transform-style-preserve-3d cursor-pointer ${isFlipped ? "rotate-y-180" : ""}`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-[#A435F0]/5 to-purple-100/50 dark:from-gray-800 dark:to-gray-800/50 border border-[#A435F0]/20 dark:border-gray-700 rounded-xl p-4 flex flex-col justify-center">
            {currentCard?.tag && <div className="text-[10px] text-[#A435F0] font-medium mb-2">🏷️ {currentCard.tag}</div>}
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{currentCard?.front}</div>
            <div className="absolute bottom-3 right-3 text-xs text-gray-400 dark:text-gray-500"><RotateCw className="w-3 h-3 inline mr-1" />Lật để xem đáp án</div>
          </div>
          <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-green-50 to-emerald-100/50 dark:from-gray-800 dark:to-green-900/20 border border-green-300/30 dark:border-green-700/30 rounded-xl p-4 flex flex-col justify-center">
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">{currentCard?.back}</div>
            {currentCard?.mnemonic && (
              <div className="text-xs text-purple-600 dark:text-purple-400 italic">🧠 <strong>Mnemonic:</strong> {currentCard.mnemonic}</div>
            )}
          </div>
        </div>
      </div>

      {currentCard?.hint && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          {showHint ? (
            <div className="text-xs text-yellow-800 dark:text-yellow-200"><strong>💡 Gợi ý:</strong> {currentCard.hint}</div>
          ) : (
            <Button onClick={() => setShowHint(true)} variant="ghost" size="sm" className="text-xs text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 h-auto py-1 px-2">
              <Eye className="w-3 h-3 mr-1" />Xem gợi ý
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button onClick={handlePrev} disabled={currentIndex === 0} variant="outline" size="sm" className="text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronLeft className="w-3 h-3 mr-1" />Trước
        </Button>
        <div className="flex items-center gap-1.5">
          <Button onClick={() => setIsFlipped(!isFlipped)} variant="outline" size="sm" className="text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40">
            <RotateCw className="w-3 h-3 mr-1" />Lật thẻ
          </Button>
          <Button onClick={() => setShowAddForm(true)} variant="outline" size="sm" className="text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 cursor-pointer">
            <Plus className="w-3 h-3 mr-1" />Thêm thẻ
          </Button>
        </div>
        <Button onClick={handleNext} disabled={currentIndex === cards.length - 1} variant="outline" size="sm" className="text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 disabled:opacity-50 disabled:cursor-not-allowed">
          Sau<ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
