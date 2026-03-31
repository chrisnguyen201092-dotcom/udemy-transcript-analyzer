"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Eye } from "lucide-react";

interface QuizPlayerProps {
  markdown: string;
  onComplete?: (score: number) => void;
}

interface Question {
  id: number;
  type: "mcq" | "tf";
  text: string;
  options?: string[];
  difficulty?: string;
  bloom?: string;
}

interface Answer {
  questionId: number;
  correct: string;
  explanations: { type: "correct" | "incorrect"; option: string; text: string }[];
}

export function QuizPlayer({ markdown, onComplete }: QuizPlayerProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  // Reset state when markdown prop changes
  useEffect(() => {
    setSelected(null);
    setAnswers([]);
    setCurrentQuestion(0);
    setShowResult(false);
  }, [markdown]);

  const parsed = parseQuiz(markdown);

  const handleSelect = useCallback(
    (questionId: number, option: string) => {
      if (selectedAnswers[questionId]) return;

      const newAnswers = { ...selectedAnswers, [questionId]: option };
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
    [selectedAnswers, parsed.questions, parsed.answers, onComplete]
  );

  if (!parsed.questions.length) {
    return (
      <pre className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300">
        {markdown}
      </pre>
    );
  }

  const totalQuestions = parsed.questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;

  return (
    <div className="space-y-4">
      {/* Header with score */}
      {parsed.header && (
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {parsed.header}
        </div>
      )}

      {score !== null && (
        <div className="flex items-center justify-between bg-[#A435F0]/10 border border-[#A435F0]/20 rounded-lg px-3 py-2">
          <span className="text-xs font-semibold text-[#A435F0]">
            Kết quả: {score}/{totalQuestions} ({Math.round((score / totalQuestions) * 100)}%)
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Đã trả lời: {answeredCount}/{totalQuestions}
          </span>
        </div>
      )}

      {/* Questions */}
      {parsed.questions.map((question) => {
        const answer = parsed.answers.find((a) => a.questionId === question.id);
        const selectedAnswer = selectedAnswers[question.id];
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
            {(isAnswered || showAllAnswers) && answer && (
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
          onClick={() => setShowAllAnswers(!showAllAnswers)}
          variant="outline"
          size="sm"
          className="w-full text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40"
        >
          <Eye className="w-3 h-3 mr-1.5" />
          {showAllAnswers ? "Ẩn đáp án" : "Xem đáp án"}
        </Button>
      )}
    </div>
  );
}

function parseQuiz(markdown: string): {
  header: string;
  questions: Question[];
  answers: Answer[];
} {
  const lines = markdown.split("\n");
  const header: string[] = [];
  const questions: Question[] = [];
  const answers: Answer[] = [];

  let currentQuestion: Question | null = null;
  let currentOptions: string[] = [];
  let inAnswerSection = false;
  let currentAnswer: Answer | null = null;
  let currentExplanationType: "correct" | "incorrect" | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Header section
    if (trimmed.startsWith("### 📝 Quiz:")) {
      header.push(trimmed);
      continue;
    }
    if (trimmed.startsWith("**Tổng số câu hỏi**") || trimmed.startsWith("**Phân bố**")) {
      header.push(trimmed);
      continue;
    }

    // Answer section
    if (trimmed.includes("### 🔑 ĐÁP ÁN")) {
      inAnswerSection = true;
      continue;
    }

    if (inAnswerSection) {
      // New answer: **Câu 1: [Đáp án đúng: B]**
      const answerMatch = trimmed.match(/\*\*Câu (\d+): \[Đáp án đúng: ([^\]]+)\]\*\*/);
      if (answerMatch) {
        if (currentAnswer) {
          answers.push(currentAnswer);
        }
        currentAnswer = {
          questionId: parseInt(answerMatch[1]),
          correct: answerMatch[2],
          explanations: [],
        };
        currentExplanationType = null;
        continue;
      }

      // Explanation lines
      if (currentAnswer) {
        if (trimmed.startsWith("- ✅ **Tại sao")) {
          currentExplanationType = "correct";
          const text = trimmed.replace(/- ✅ \*\*Tại sao \[([^\]]+)\] đúng\*\*: /, "");
          currentAnswer.explanations.push({
            type: "correct",
            option: trimmed.match(/\[([^\]]+)\]/)?.[1] || "",
            text,
          });
        } else if (trimmed.startsWith("- ❌ **Tại sao")) {
          currentExplanationType = "incorrect";
          const text = trimmed.replace(/- ❌ \*\*Tại sao \[([^\]]+)\] sai\*\*: /, "");
          currentAnswer.explanations.push({
            type: "incorrect",
            option: trimmed.match(/\[([^\]]+)\]/)?.[1] || "",
            text,
          });
        } else if (currentExplanationType && trimmed.startsWith("-")) {
          const lastExp = currentAnswer.explanations[currentAnswer.explanations.length - 1];
          if (lastExp) {
            lastExp.text += " " + trimmed.replace(/^- /, "");
          }
        }
      }
      continue;
    }

    // New question: **Câu 1** [Loại: Trắc nghiệm] [⭐ Cơ bản — Bloom: Nhớ]
    const questionMatch = trimmed.match(/\*\*Câu (\d+)\*\*/);
    if (questionMatch && trimmed.includes("[")) {
      if (currentQuestion) {
        currentQuestion.options = currentOptions;
        questions.push(currentQuestion);
      }
      currentQuestion = {
        id: parseInt(questionMatch[1]),
        type: trimmed.includes("Đúng/Sai") ? "tf" : "mcq",
        text: "",
        options: [],
      };
      currentOptions = [];

      // Extract difficulty
      const diffMatch = trimmed.match(/\[(⭐ [^\]]+)\]/);
      if (diffMatch) {
        currentQuestion.difficulty = diffMatch[1];
      }
      continue;
    }

    // Question text (after question header, before options)
    if (currentQuestion && !currentQuestion.text && trimmed && !trimmed.match(/^[A-D]\./)) {
      currentQuestion.text = trimmed;
      continue;
    }

    // Options: A., B., C., D.
    if (currentQuestion && currentQuestion.type === "mcq") {
      const optionMatch = trimmed.match(/^([A-D])\.\s*(.+)/);
      if (optionMatch) {
        currentOptions.push(optionMatch[2]);
        continue;
      }
    }

    // True/False answer line
    if (currentQuestion && currentQuestion.type === "tf") {
      const tfMatch = trimmed.match(/Đáp án: (Đúng|Sai)/);
      if (tfMatch) {
        currentQuestion.text += "\n" + trimmed;
      }
    }
  }

  // Push last question and answer
  if (currentQuestion) {
    currentQuestion.options = currentOptions;
    questions.push(currentQuestion);
  }
  if (currentAnswer) {
    answers.push(currentAnswer);
  }

  return {
    header: header.join("\n"),
    questions,
    answers,
  };
}
