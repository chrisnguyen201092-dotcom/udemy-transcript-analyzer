"use client";

import { useMemo } from "react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { ExerciseCard } from "@/components/ExerciseCard";
import { parseExercises } from "@/lib/exercise-parser";

interface ExerciseListProps {
  markdown: string;
}

export function ExerciseList({ markdown }: ExerciseListProps) {
  const exercises = useMemo(() => parseExercises(markdown), [markdown]);

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
