"use client";

import { Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  isConfigured: boolean;
  currentModel: string;
  onOpenSettings: () => void;
}

export function Header({ isConfigured, currentModel, onOpenSettings }: HeaderProps) {
  return (
    <header className="h-14 shrink-0 border-b border-gray-100 flex items-center justify-between px-5 bg-white">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[#A435F0] flex items-center justify-center shadow-sm">
          <Zap className="w-4 h-4 text-white fill-white" />
        </div>
        <span className="text-[15px] font-semibold text-gray-900 tracking-tight">
          Udemy Learner
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenSettings}
        className="gap-2 cursor-pointer border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 h-8 text-xs"
      >
        <Settings className="w-3.5 h-3.5" />
        {isConfigured ? (
          <>
            <span className="max-w-[160px] truncate">{currentModel}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          </>
        ) : (
          <>
            <span>Configure AI</span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
          </>
        )}
      </Button>
    </header>
  );
}
