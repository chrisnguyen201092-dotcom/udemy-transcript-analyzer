"use client";

import { Settings, Zap, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ModeToggle";

interface HeaderProps {
  isConfigured: boolean;
  profileName: string;
  currentModel: string;
  onOpenSettings: () => void;
}

export function Header({ isConfigured, profileName, currentModel, onOpenSettings }: HeaderProps) {
  return (
    <header className="h-14 shrink-0 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-5 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[#A435F0] flex items-center justify-center shadow-sm">
          <Zap className="w-4 h-4 text-white fill-white" />
        </div>
        <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          Inkgest
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Keyboard shortcut hints */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-gray-300 dark:text-gray-600 mr-1">
          <Keyboard className="w-3 h-3" />
          <span>Alt+↑↓ chuyển bài</span>
          <span className="text-gray-200 dark:text-gray-700">·</span>
          <span>Ctrl+, cài đặt</span>
        </div>
        <ModeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSettings}
          className="gap-2 cursor-pointer border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 h-8 text-xs"
        >
          <Settings className="w-3.5 h-3.5" />
          {isConfigured ? (
            <>
              <span className="text-gray-400 dark:text-gray-500 font-normal">{profileName}</span>
              <span className="text-gray-200 dark:text-gray-700">/</span>
              <span className="max-w-[140px] truncate">{currentModel}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            </>
          ) : (
            <>
              <span>Configure AI</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
