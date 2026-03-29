"use client";

import { useState } from "react";
import { Plus, Upload, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AddCoursePanelProps {
  hasUdemyCookie: boolean;
  onAddManual: (title: string) => void;
  onOpenImport: () => void;
  onOpenSettings: () => void;
}

export function AddCoursePanel({
  hasUdemyCookie,
  onAddManual,
  onOpenImport,
  onOpenSettings,
}: AddCoursePanelProps) {
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
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-1">
        Thêm course
      </p>

      {hasUdemyCookie ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 cursor-pointer justify-start border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-[#A435F0] hover:border-[#A435F0]/30 text-xs h-8"
          onClick={onOpenImport}
        >
          <Upload className="w-3.5 h-3.5" />
          Import từ Udemy
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 cursor-pointer justify-start border-gray-200 text-gray-500 hover:bg-gray-50 text-xs h-8"
          onClick={onOpenSettings}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Cấu hình Udemy Cookie
        </Button>
      )}

      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tên course..."
          className="flex-1 text-xs h-8 border-gray-200 focus-visible:ring-[#A435F0]/30"
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
