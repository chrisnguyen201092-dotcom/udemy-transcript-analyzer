"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Eye, RotateCw } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface FlashcardDeckProps {
  markdown: string;
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

export function FlashcardDeck({ markdown }: FlashcardDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const cards = parseFlashcards(markdown);
  const currentCard = cards[currentIndex];

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === " ") {
        e.preventDefault();
        handleFlip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, handleFlip]);

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
