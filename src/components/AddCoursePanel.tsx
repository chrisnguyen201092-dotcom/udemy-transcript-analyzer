"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddCoursePanelProps {
  onAddManual: (title: string) => void;
}

export function AddCoursePanel({ onAddManual }: AddCoursePanelProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAddManual(trimmed);
    setTitle("");
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">
        Thêm course
      </p>

      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên course..."
          className="flex-1 text-xs h-8 border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!title.trim()}
          className="h-8 w-8 p-0 cursor-pointer bg-[#A435F0] hover:bg-[#8710D8] shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </form>
    </div>
  );
}
