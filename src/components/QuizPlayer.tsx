"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import { parseQuiz } from "@/lib/quiz-parser";

interface QuizPlayerProps {
  markdown: string;
  onComplete?: (score: number) => void;
}

export function QuizPlayer({ markdown, onComplete }: QuizPlayerProps) {
  // Track which markdown these answers belong to; when it changes, answers are stale
  const [answeredMarkdown, setAnsweredMarkdown] = useState(markdown);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // When markdown prop changes, reset interaction state synchronously during render
  const isStale = answeredMarkdown !== markdown;
  const effectiveSelectedAnswers = useMemo(
    () => (isStale ? {} : selectedAnswers),
    [isStale, selectedAnswers]
  );
  const effectiveShowAllAnswers = isStale ? false : showAllAnswers;
  const effectiveScore = isStale ? null : score;
  if (isStale) {
    setAnsweredMarkdown(markdown);
    setSelectedAnswers({});
    setShowAllAnswers(false);
    setScore(null);
  }

  const parsed = parseQuiz(markdown);

  const handleSelect = useCallback(
    (questionId: number, option: string) => {
      if (effectiveSelectedAnswers[questionId]) return;

      const newAnswers = { ...effectiveSelectedAnswers, [questionId]: option };
      setSelectedAnswers(newAnswers);

      const answeredCount = Object.keys(newAnswers).length;
      if (answeredCount === parsed.questions.length) {
        const correctCount = parsed.questions.reduce((acc, q) => {
          const answer = parsed.answers.find((a) => a.questionId === q.id);
          return acc + (newAnswers[q.id] === answer?.correct ? 1 : 0);
        }, 0);
        setScore(correctCount);
        onComplete?.(correctCount);
      }
    },
    [effectiveSelectedAnswers, parsed.questions, parsed.answers, onComplete]
  );

  if (!parsed.questions.length) {
    return (
      <pre className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300">
        {markdown}
      </pre>
    );
  }

  const totalQuestions = parsed.questions.length;
  const answeredCount = Object.keys(effectiveSelectedAnswers).length;

  return (
    <div className="space-y-4">
      {/* Header with score */}
      {parsed.header && (
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {parsed.header}
        </div>
      )}

      {effectiveScore !== null && (
        <div className="flex items-center justify-between bg-[#A435F0]/10 border border-[#A435F0]/20 rounded-lg px-3 py-2">
          <span className="text-xs font-semibold text-[#A435F0]">
            Kết quả: {effectiveScore}/{totalQuestions} ({Math.round((effectiveScore / totalQuestions) * 100)}%)
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Đã trả lời: {answeredCount}/{totalQuestions}
          </span>
        </div>
      )}

      {/* Questions */}
      {parsed.questions.map((question) => {
        const answer = parsed.answers.find((a) => a.questionId === question.id);
        const selectedAnswer = effectiveSelectedAnswers[question.id];
        const isAnswered = !!selectedAnswer;

        return (
          <div
            key={question.id}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-3"
          >
            {/* Question text */}
            <div className="text-xs font-medium text-gray-900 dark:text-gray-100 mb-2">
              <span className="text-[#A435F0]">Câu {question.id}</span>
              {question.difficulty && (
                <span className="ml-2 text-[10px] text-gray-500">[{question.difficulty}]</span>
              )}
              <div className="mt-1.5 whitespace-pre-wrap">{question.text}</div>
            </div>

            {/* Options */}
            {question.type === "mcq" && question.options && (
              <div className="space-y-1.5">
                {question.options.map((option, idx) => {
                  const optionLabel = String.fromCharCode(65 + idx);
                  const isSelected = selectedAnswer === optionLabel;
                  const isCorrectOption = answer?.correct === optionLabel;
                  const showResult = isAnswered;

                  let bgColor = "bg-white dark:bg-gray-900";
                  let borderColor = "border-gray-200 dark:border-gray-700";
                  let textColor = "text-gray-700 dark:text-gray-300";

                  if (showResult) {
                    if (isCorrectOption) {
                      bgColor = "bg-green-50 dark:bg-green-900/20";
                      borderColor = "border-green-300 dark:border-green-700";
                      textColor = "text-green-700 dark:text-green-300";
                    } else if (isSelected && !isCorrectOption) {
                      bgColor = "bg-red-50 dark:bg-red-900/20";
                      borderColor = "border-red-300 dark:border-red-700";
                      textColor = "text-red-700 dark:text-red-300";
                    }
                  } else if (isSelected) {
                    bgColor = "bg-[#A435F0]/10";
                    borderColor = "border-[#A435F0]/30";
                  }

                  return (
                    <button
                      key={optionLabel}
                      onClick={() => handleSelect(question.id, optionLabel)}
                      disabled={isAnswered}
                      className={`w-full text-left px-3 py-2 text-xs rounded border transition-colors cursor-pointer ${bgColor} ${borderColor} ${textColor} hover:border-[#A435F0]/40 disabled:cursor-default`}
                    >
                      <span className="font-semibold mr-2">{optionLabel}.</span>
                      {option}
                      {showResult && isCorrectOption && (
                        <CheckCircle className="w-3 h-3 inline ml-2 text-green-600" />
                      )}
                      {showResult && isSelected && !isCorrectOption && (
                        <XCircle className="w-3 h-3 inline ml-2 text-red-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* True/False */}
            {question.type === "tf" && (
              <div className="flex gap-2">
                {["Đúng", "Sai"].map((option) => {
                  const isSelected = selectedAnswer === option;
                  const isCorrectOption = answer?.correct === option;
                  const showResult = isAnswered;

                  let bgColor = "bg-white dark:bg-gray-900";
                  let borderColor = "border-gray-200 dark:border-gray-700";
                  let textColor = "text-gray-700 dark:text-gray-300";

                  if (showResult) {
                    if (isCorrectOption) {
                      bgColor = "bg-green-50 dark:bg-green-900/20";
                      borderColor = "border-green-300 dark:border-green-700";
                      textColor = "text-green-700 dark:text-green-300";
                    } else if (isSelected && !isCorrectOption) {
                      bgColor = "bg-red-50 dark:bg-red-900/20";
                      borderColor = "border-red-300 dark:border-red-700";
                      textColor = "text-red-700 dark:text-red-300";
                    }
                  } else if (isSelected) {
                    bgColor = "bg-[#A435F0]/10";
                    borderColor = "border-[#A435F0]/30";
                  }

                  return (
                    <button
                      key={option}
                      onClick={() => handleSelect(question.id, option)}
                      disabled={isAnswered}
                      className={`flex-1 px-3 py-2 text-xs rounded border transition-colors cursor-pointer ${bgColor} ${borderColor} ${textColor} hover:border-[#A435F0]/40 disabled:cursor-default`}
                    >
                      {option}
                      {showResult && isCorrectOption && (
                        <CheckCircle className="w-3 h-3 inline ml-2 text-green-600" />
                      )}
                      {showResult && isSelected && !isCorrectOption && (
                        <XCircle className="w-3 h-3 inline ml-2 text-red-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Explanation */}
            {(isAnswered || effectiveShowAllAnswers) && answer && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs font-semibold text-[#A435F0] mb-2">
                  Đáp án: {answer.correct}
                </div>
                <div className="space-y-1">
                  {answer.explanations.map((exp, idx) => (
                    <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                      <span className={exp.type === "correct" ? "text-green-600" : "text-red-600"}>
                        {exp.type === "correct" ? "✅ " : "❌ "}
                      </span>
                      {exp.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Show all answers button */}
      {answeredCount < totalQuestions && (
        <Button
          onClick={() => setShowAllAnswers(!effectiveShowAllAnswers)}
          variant="outline"
          size="sm"
          className="w-full text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40"
        >
          <Eye className="w-3 h-3 mr-1.5" />
          {effectiveShowAllAnswers ? "Ẩn đáp án" : "Xem đáp án"}
        </Button>
      )}
    </div>
  );
}
