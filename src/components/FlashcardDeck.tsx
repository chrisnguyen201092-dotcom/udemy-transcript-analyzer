"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Eye, RotateCw, Plus, X, Loader2 } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { toast } from "sonner";

interface FlashcardDeckProps {
  markdown: string;
  mode?: "normal" | "srs";
  lessonId?: string;
  onFlashcardsChange?: (newMarkdown: string) => void;
  onReviewComplete?: () => void;
}

interface Flashcard {
  id: number;
  type?: string;
  difficulty?: string;
  tag?: string;
  front: string;
  back: string;
  hint?: string;
  mnemonic?: string;
}

export function FlashcardDeck({ markdown, mode = "normal", lessonId, onFlashcardsChange, onReviewComplete }: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // SRS mode state
  const [srsCards, setSrsCards] = useState<Array<{ cardIndex: number; front: string; back: string; hint?: string; mnemonic?: string }>>([]);
  const [srsLoading, setSrsLoading] = useState(false);
  const [srsReviewIndex, setSrsReviewIndex] = useState(0);
  const [srsCompleted, setSrsCompleted] = useState(false);
  const [srsStats, setSrsStats] = useState({ remembered: 0, forgot: 0 });

  // Custom card form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newHint, setNewHint] = useState("");
  const [newMnemonic, setNewMnemonic] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const cards = parseFlashcards(markdown);

  const currentCard = cards[currentIndex];

  // Keep refs for keyboard handler to avoid stale closures
  const stateRef = useRef({ currentIndex, cardsLength: cards.length });
  useEffect(() => {
    stateRef.current = { currentIndex, cardsLength: cards.length };
  });

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
      setShowHint(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
      setShowHint(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleAddCard = async () => {
    if (!newFront.trim() || !newBack.trim()) return;
    setIsSaving(true);

    const nextId = cards.length + 1;
    let newSection = `\n\n#### Thẻ ${nextId} [Loại: Custom] [🟢 Dễ]\n`;
    newSection += `**📌 Mặt trước:**\n> ${newFront.trim()}\n\n`;
    newSection += `**📖 Mặt sau:**\n> ${newBack.trim()}\n`;
    if (newHint.trim()) {
      newSection += `\n**💡 Gợi ý:** ${newHint.trim()}\n`;
    }
    if (newMnemonic.trim()) {
      newSection += `\n**🧠 Mnemonic:** ${newMnemonic.trim()}\n`;
    }
    newSection += `\n**🏷️ Tag**: Tự tạo`;

    const updatedMarkdown = markdown + newSection;
    onFlashcardsChange?.(updatedMarkdown);

    // Navigate to the new card
    setCurrentIndex(nextId - 1);
    setIsFlipped(false);
    setShowHint(false);

    // Clear form
    setNewFront("");
    setNewBack("");
    setNewHint("");
    setNewMnemonic("");
    setShowAddForm(false);
    setIsSaving(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { currentIndex: idx, cardsLength } = stateRef.current;
      if (e.key === "ArrowRight" && idx < cardsLength - 1) {
        setCurrentIndex(idx + 1);
        setIsFlipped(false);
        setShowHint(false);
      }
      if (e.key === "ArrowLeft" && idx > 0) {
        setCurrentIndex(idx - 1);
        setIsFlipped(false);
        setShowHint(false);
      }
      if (e.key === " ") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // SRS mode: init + load due cards
  useEffect(() => {
    if (mode !== "srs" || !lessonId) return;
    let cancelled = false;
    const initSrs = async () => {
      setSrsLoading(true);
      setSrsCompleted(false);
      setSrsReviewIndex(0);
      setSrsStats({ remembered: 0, forgot: 0 });
      try {
        await fetch(`/api/lessons/${lessonId}/srs/init`, { method: "POST" });
        const res = await fetch(`/api/lessons/${lessonId}/srs/due`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSrsCards(
            (data.dueCards || []).map((c: { cardIndex: number; front: string; back: string; hint?: string; mnemonic?: string }) => ({
              cardIndex: c.cardIndex,
              front: c.front,
              back: c.back,
              hint: c.hint,
              mnemonic: c.mnemonic,
            }))
          );
        }
      } catch {
        toast.error("Lỗi khi tải thẻ SRS");
      }
      if (!cancelled) setSrsLoading(false);
    };
    initSrs();
    return () => { cancelled = true; };
  }, [mode, lessonId]);

  const handleSrsRate = async (quality: number) => {
    const card = srsCards[srsReviewIndex];
    try {
      await fetch(`/api/lessons/${lessonId}/srs/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIndex: card.cardIndex, quality }),
      });
      setSrsStats((prev) => ({
        remembered: prev.remembered + (quality >= 3 ? 1 : 0),
        forgot: prev.forgot + (quality < 3 ? 1 : 0),
      }));
      if (srsReviewIndex < srsCards.length - 1) {
        setSrsReviewIndex(srsReviewIndex + 1);
        setIsFlipped(false);
      } else {
        setSrsCompleted(true);
        onReviewComplete?.();
      }
    } catch {
      toast.error("Lỗi khi lưu kết quả ôn tập");
    }
  };

  // SRS mode rendering
  if (mode === "srs") {
    if (srsLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="w-4 h-4 animate-spin text-[#A435F0]" />
          <span className="text-xs text-gray-500">Đang tải thẻ ôn tập...</span>
        </div>
      );
    }

    if (srsCards.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <div className="text-3xl">🎉</div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Không có thẻ nào cần ôn</h3>
          <p className="text-xs text-gray-500">Bạn đã ôn tập tất cả! Quay lại sau nhé.</p>
        </div>
      );
    }

    if (srsCompleted) {
      return (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="text-3xl">🎉</div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Hoàn thành!</h3>
          <div className="text-xs text-gray-500 space-y-1">
            <p>Đã ôn: {srsCards.length} thẻ</p>
            <p>Nhớ tốt: {srsStats.remembered} · Cần ôn thêm: {srsStats.forgot}</p>
          </div>
          <Button
            onClick={() => {
              setSrsCompleted(false);
              setSrsReviewIndex(0);
              setSrsStats({ remembered: 0, forgot: 0 });
              setSrsCards([]);
            }}
            variant="outline"
            size="sm"
            className="text-[#A435F0] border-[#A435F0]/20 cursor-pointer"
          >
            Quay lại bài học
          </Button>
        </div>
      );
    }

    const currentSrsCard = srsCards[srsReviewIndex];
    return (
      <div className="space-y-4">
        {/* SRS Header */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-600 dark:text-gray-400">
            Ôn tập: {srsReviewIndex + 1} / {srsCards.length}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            SRS Mode
          </span>
        </div>

        {/* Card with flip */}
        <div className="perspective-1000 h-[200px]">
          <div
            className={`relative w-full h-full transition-transform duration-300 transform-style-preserve-3d cursor-pointer ${
              isFlipped ? "rotate-y-180" : ""
            }`}
            onClick={() => setIsFlipped(!isFlipped)}
          >
            {/* Front */}
            <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-[#A435F0]/5 to-purple-100/50 dark:from-gray-800 dark:to-gray-800/50 border border-[#A435F0]/20 dark:border-gray-700 rounded-xl p-4 flex flex-col justify-center">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {currentSrsCard.front}
              </div>
              <div className="absolute bottom-3 right-3 text-xs text-gray-400 dark:text-gray-500">
                <RotateCw className="w-3 h-3 inline mr-1" />
                Lật để xem đáp án
              </div>
            </div>
            {/* Back */}
            <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-green-50 to-emerald-100/50 dark:from-gray-800 dark:to-green-900/20 border border-green-300/30 dark:border-green-700/30 rounded-xl p-4 flex flex-col justify-center">
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">
                {currentSrsCard.back}
              </div>
              {currentSrsCard.mnemonic && (
                <div className="text-xs text-purple-600 dark:text-purple-400 italic">
                  🧠 <strong>Mnemonic:</strong> {currentSrsCard.mnemonic}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hint */}
        {currentSrsCard.hint && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
            {showHint ? (
              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>💡 Gợi ý:</strong> {currentSrsCard.hint}
              </div>
            ) : (
              <Button
                onClick={() => setShowHint(true)}
                variant="ghost"
                size="sm"
                className="text-xs text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 h-auto py-1 px-2"
              >
                <Eye className="w-3 h-3 mr-1" />
                Xem gợi ý
              </Button>
            )}
          </div>
        )}

        {/* SRS Rating buttons */}
        {isFlipped ? (
          <div className="flex gap-2">
            <Button
              onClick={() => handleSrsRate(1)}
              variant="outline"
              size="sm"
              className="flex-1 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer text-xs"
            >
              😣 Quên
            </Button>
            <Button
              onClick={() => handleSrsRate(3)}
              variant="outline"
              size="sm"
              className="flex-1 text-yellow-600 border-yellow-200 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 cursor-pointer text-xs"
            >
              🤔 Khó
            </Button>
            <Button
              onClick={() => handleSrsRate(5)}
              variant="outline"
              size="sm"
              className="flex-1 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer text-xs"
            >
              😊 Dễ
            </Button>
          </div>
        ) : (
          <div className="text-center text-xs text-gray-400">
            Lật thẻ để đánh giá
          </div>
        )}
      </div>
    );
  }

  if (!cards.length) {
    return (
      <MarkdownRenderer
        content={markdown}
        className="text-xs text-gray-700 dark:text-gray-300"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Add card form */}
      {showAddForm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Thêm thẻ mới
            </h4>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Mặt trước *
            </label>
            <Textarea
              value={newFront}
              onChange={(e) => setNewFront(e.target.value)}
              placeholder="Câu hỏi hoặc khái niệm..."
              className="text-sm min-h-[60px] resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Mặt sau *
            </label>
            <Textarea
              value={newBack}
              onChange={(e) => setNewBack(e.target.value)}
              placeholder="Câu trả lời hoặc giải thích..."
              className="text-sm min-h-[60px] resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Gợi ý (tuỳ chọn)
            </label>
            <Input
              value={newHint}
              onChange={(e) => setNewHint(e.target.value)}
              placeholder="Gợi ý nhỏ..."
              className="text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">
              Mnemonic (tuỳ chọn)
            </label>
            <Input
              value={newMnemonic}
              onChange={(e) => setNewMnemonic(e.target.value)}
              placeholder="Mẹo ghi nhớ..."
              className="text-sm"
            />
          </div>
          <Button
            onClick={handleAddCard}
            disabled={!newFront.trim() || !newBack.trim() || isSaving}
            className="w-full bg-[#A435F0] hover:bg-[#8710D8] text-white text-xs cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
                Đang lưu...
              </>
            ) : (
              "Thêm thẻ"
            )}
          </Button>
        </div>
      )}

      {/* Header */}
      {currentCard && (
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-gray-600 dark:text-gray-400">
            Thẻ {currentIndex + 1} / {cards.length}
          </span>
          {currentCard.difficulty && (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                currentCard.difficulty.includes("Dễ")
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : currentCard.difficulty.includes("Trung bình")
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {currentCard.difficulty}
            </span>
          )}
        </div>
      )}

      {/* Card with flip animation */}
      <div className="perspective-1000 h-[200px]">
        <div
          className={`relative w-full h-full transition-transform duration-300 transform-style-preserve-3d cursor-pointer ${
            isFlipped ? "rotate-y-180" : ""
          }`}
          onClick={handleFlip}
        >
          {/* Front */}
          <div className="absolute w-full h-full backface-hidden bg-gradient-to-br from-[#A435F0]/5 to-purple-100/50 dark:from-gray-800 dark:to-gray-800/50 border border-[#A435F0]/20 dark:border-gray-700 rounded-xl p-4 flex flex-col justify-center">
            {currentCard.tag && (
              <div className="text-[10px] text-[#A435F0] font-medium mb-2">
                🏷️ {currentCard.tag}
              </div>
            )}
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {currentCard.front}
            </div>
            <div className="absolute bottom-3 right-3 text-xs text-gray-400 dark:text-gray-500">
              <RotateCw className="w-3 h-3 inline mr-1" />
              Lật để xem đáp án
            </div>
          </div>

          {/* Back */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-green-50 to-emerald-100/50 dark:from-gray-800 dark:to-green-900/20 border border-green-300/30 dark:border-green-700/30 rounded-xl p-4 flex flex-col justify-center">
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">
              {currentCard.back}
            </div>
            {currentCard.mnemonic && (
              <div className="text-xs text-purple-600 dark:text-purple-400 italic">
                🧠 <strong>Mnemonic:</strong> {currentCard.mnemonic}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hint */}
      {currentCard.hint && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          {showHint ? (
            <div className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>💡 Gợi ý:</strong> {currentCard.hint}
            </div>
          ) : (
            <Button
              onClick={() => setShowHint(true)}
              variant="ghost"
              size="sm"
              className="text-xs text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 h-auto py-1 px-2"
            >
              <Eye className="w-3 h-3 mr-1" />
              Xem gợi ý
            </Button>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          variant="outline"
          size="sm"
          className="text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-3 h-3 mr-1" />
          Trước
        </Button>

        <div className="flex items-center gap-1.5">
          <Button
            onClick={handleFlip}
            variant="outline"
            size="sm"
            className="text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40"
          >
            <RotateCw className="w-3 h-3 mr-1" />
            Lật thẻ
          </Button>

          <Button
            onClick={() => setShowAddForm(true)}
            variant="outline"
            size="sm"
            className="text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 cursor-pointer"
          >
            <Plus className="w-3 h-3 mr-1" />
            Thêm thẻ
          </Button>
        </div>

        <Button
          onClick={handleNext}
          disabled={currentIndex === cards.length - 1}
          variant="outline"
          size="sm"
          className="text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Sau
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function parseFlashcards(markdown: string): Flashcard[] {
  const cards: Flashcard[] = [];
  const sections = markdown.split("#### Thẻ");

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split("\n");

    const card: Flashcard = { id: i, front: "", back: "" };

    // Parse header: 1 [Loại: Term → Definition] [🟢 Dễ]
    const headerLine = lines[0]?.trim() || "";
    const typeMatch = headerLine.match(/\[Loại: ([^\]]+)\]/);
    if (typeMatch) {
      card.type = typeMatch[1];
    }
    const diffMatch = headerLine.match(/\[([🟢🟡🔴] [^\]]+)\]/);
    if (diffMatch) {
      card.difficulty = diffMatch[1];
    }

    let currentSection: "front" | "back" | "hint" | "mnemonic" | null = null;

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();

      if (trimmed.startsWith("**📌 Mặt trước:**")) {
        currentSection = "front";
        continue;
      }
      if (trimmed.startsWith("**📖 Mặt sau:**")) {
        currentSection = "back";
        continue;
      }
      if (trimmed.startsWith("**💡 Gợi ý:**")) {
        currentSection = "hint";
        card.hint = trimmed.replace("**💡 Gợi ý:**", "").trim();
        continue;
      }
      if (trimmed.startsWith("**🧠 Mnemonic:**")) {
        currentSection = "mnemonic";
        card.mnemonic = trimmed.replace("**🧠 Mnemonic:**", "").trim();
        continue;
      }
      if (trimmed.startsWith("**🏷️ Tag**:")) {
        card.tag = trimmed.replace("**🏷️ Tag**:", "").trim();
        continue;
      }

      // Content lines
      if (currentSection === "front") {
        card.front += (card.front ? "\n" : "") + trimmed.replace(/^>\s*/, "");
      } else if (currentSection === "back") {
        card.back += (card.back ? "\n" : "") + trimmed.replace(/^>\s*/, "");
      }
    }

    if (card.front && card.back) {
      cards.push(card);
    }
  }

  return cards;
}
