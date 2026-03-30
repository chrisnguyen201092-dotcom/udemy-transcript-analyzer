"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Lightbulb, BookOpen } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface ExerciseListProps {
  markdown: string;
}

interface Exercise {
  id: number;
  name: string;
  type?: string;
  difficulty?: string;
  time?: string;
  description: string;
  requirements: string[];
  hints: { id: number; text: string }[];
  rubric?: { criteria: string; achieved: string; notAchieved: string }[];
  solution?: string;
}

export function ExerciseList({ markdown }: ExerciseListProps) {
  const exercises = parseExercises(markdown);

  if (!exercises.length) {
    return (
      <MarkdownRenderer
        content={markdown}
        className="text-xs text-gray-700 dark:text-gray-300"
      />
    );
  }

  return (
    <div className="space-y-4">
      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.id} exercise={exercise} />
      ))}
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const [hintsOpen, setHintsOpen] = useState<Record<number, boolean>>({});
  const [solutionOpen, setSolutionOpen] = useState(false);
  const [rubricOpen, setRubricOpen] = useState(true);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[#A435F0]">
            Bài tập {exercise.id}: {exercise.name}
          </span>
          {exercise.type && (
            <span className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
              {exercise.type}
            </span>
          )}
          {exercise.difficulty && (
            <span className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
              {exercise.difficulty}
            </span>
          )}
        </div>
        {exercise.time && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            ⏱️ {exercise.time}
          </div>
        )}
      </div>

      {/* Description */}
      {exercise.description && (
        <div className="mb-3 text-xs text-gray-700 dark:text-gray-300">
          <strong className="text-gray-900 dark:text-gray-100">📋 Mô tả:</strong>
          <div className="mt-1 whitespace-pre-wrap">{exercise.description}</div>
        </div>
      )}

      {/* Requirements */}
      {exercise.requirements.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">
            📌 Yêu cầu:
          </div>
          <ul className="space-y-1">
            {exercise.requirements.map((req, idx) => (
              <li key={idx} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-1.5">
                <span className="text-[#A435F0] mt-0.5">✓</span>
                <span className="flex-1">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Hints */}
      {exercise.hints.length > 0 && (
        <div className="mb-3">
          {exercise.hints.map((hint, idx) => {
            const isOpen = hintsOpen[idx];
            return (
              <div key={idx} className="mb-2">
                {!isOpen ? (
                  <Button
                    onClick={() => setHintsOpen({ ...hintsOpen, [idx]: true })}
                    variant="ghost"
                    size="sm"
                    className="text-xs text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 h-auto py-1.5 px-2"
                  >
                    <Lightbulb className="w-3 h-3 mr-1" />
                    Gợi ý {idx + 1}
                  </Button>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="text-xs text-yellow-800 dark:text-yellow-200 flex-1">
                        <strong>💡 Gợi ý {idx + 1}:</strong> {hint.text}
                      </div>
                      <button
                        onClick={() => setHintsOpen({ ...hintsOpen, [idx]: false })}
                        className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Rubric */}
      {exercise.rubric && exercise.rubric.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setRubricOpen(!rubricOpen)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100 hover:text-[#A435F0] transition-colors"
          >
            {rubricOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            ✅ Tiêu chí đánh giá
          </button>
          {rubricOpen && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 dark:bg-gray-900">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                      Tiêu chí
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-green-700 dark:text-green-400 border-b border-gray-200 dark:border-gray-700">
                      Đạt
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-red-700 dark:text-red-400 border-b border-gray-200 dark:border-gray-700">
                      Chưa đạt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exercise.rubric.map((row, idx) => (
                    <tr
                      key={idx}
                      className={
                        idx < exercise.rubric!.length - 1
                          ? "border-b border-gray-200 dark:border-gray-700"
                          : ""
                      }
                    >
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{row.criteria}</td>
                      <td className="px-3 py-2 text-green-600 dark:text-green-400">{row.achieved}</td>
                      <td className="px-3 py-2 text-red-600 dark:text-red-400">{row.notAchieved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Solution */}
      {exercise.solution && (
        <div>
          {!solutionOpen ? (
            <Button
              onClick={() => setSolutionOpen(true)}
              variant="outline"
              size="sm"
              className="text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5 hover:border-[#A435F0]/40 w-full"
            >
              <BookOpen className="w-3 h-3 mr-1.5" />
              Xem lời giải tham khảo
            </Button>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="text-xs font-semibold text-green-800 dark:text-green-300">
                  📝 Lời giải tham khảo:
                </div>
                <button
                  onClick={() => setSolutionOpen(false)}
                  className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
              </div>
              <div className="text-xs text-green-800 dark:text-green-200 whitespace-pre-wrap">
                {exercise.solution}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseExercises(markdown: string): Exercise[] {
  const exercises: Exercise[] = [];
  const sections = markdown.split("#### Bài tập");

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const lines = section.split("\n");

    const exercise: Exercise = {
      id: i,
      name: "",
      description: "",
      requirements: [],
      hints: [],
    };

    // Parse header: 1: [Name] [Loại: Tái hiện] [⭐ Cơ bản]
    const headerLine = lines[0]?.trim() || "";
    const nameMatch = headerLine.match(/^\d+:\s*(.+?)\s*\[/);
    if (nameMatch) {
      exercise.name = nameMatch[1].trim();
    } else {
      exercise.name = headerLine.replace(/^\d+:\s*/, "").split("[")[0].trim();
    }

    const typeMatch = headerLine.match(/\[Loại: ([^\]]+)\]/);
    if (typeMatch) {
      exercise.type = typeMatch[1];
    }
    const diffMatch = headerLine.match(/\[(⭐ [^\]]+)\]/);
    if (diffMatch) {
      exercise.difficulty = diffMatch[1];
    }

    let currentSection:
      | "time"
      | "description"
      | "requirements"
      | "hints"
      | "rubric"
      | "solution"
      | null = null;
    let inDetails = false;
    let currentHint: { id: number; text: string } | null = null;

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();

      if (trimmed.startsWith("**⏱️ Thời gian**:")) {
        currentSection = "time";
        exercise.time = trimmed.replace("**⏱️ Thời gian**:", "").trim();
        continue;
      }
      if (trimmed.startsWith("**📋 Mô tả:**")) {
        currentSection = "description";
        continue;
      }
      if (trimmed.startsWith("**📌 Yêu cầu cụ thể:**")) {
        currentSection = "requirements";
        continue;
      }
      if (trimmed.startsWith("**💡 Gợi ý")) {
        currentSection = "hints";
        inDetails = false;
        continue;
      }
      if (trimmed.startsWith("<summary>")) {
        inDetails = true;
        const hintId = exercise.hints.length + 1;
        currentHint = { id: hintId, text: "" };
        continue;
      }
      if (trimmed.startsWith("</summary>")) {
        continue;
      }
      if (trimmed === "</details>") {
        if (currentHint) {
          exercise.hints.push(currentHint);
          currentHint = null;
        }
        inDetails = false;
        continue;
      }
      if (trimmed.startsWith("**✅ Tiêu chí đánh giá")) {
        currentSection = "rubric";
        continue;
      }
      if (trimmed.startsWith("**📝 Lời giải tham khảo:**")) {
        currentSection = "solution";
        continue;
      }

      // Content lines
      if (currentSection === "description" && trimmed) {
        exercise.description += (exercise.description ? "\n" : "") + trimmed;
      } else if (currentSection === "requirements" && trimmed.match(/^\d+\./)) {
        exercise.requirements.push(trimmed.replace(/^\d+\.\s*/, ""));
      } else if (currentSection === "hints" && inDetails && currentHint) {
        currentHint.text += (currentHint.text ? "\n" : "") + trimmed;
      } else if (currentSection === "rubric" && trimmed.startsWith("|")) {
        // Parse table row
        const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 3 && !cells[0].includes("Tiêu chí")) {
          if (!exercise.rubric) exercise.rubric = [];
          exercise.rubric.push({
            criteria: cells[0],
            achieved: cells[1],
            notAchieved: cells[2],
          });
        }
      } else if (currentSection === "solution" && trimmed) {
        exercise.solution += (exercise.solution ? "\n" : "") + trimmed;
      }
    }

    if (exercise.name) {
      exercises.push(exercise);
    }
  }

  return exercises;
}
