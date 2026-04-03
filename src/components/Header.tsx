"use client";

import Link from "next/link";
import { Zap, Keyboard } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import { AvatarDropdown } from "@/components/AvatarDropdown";
import type { AuthUser } from "@/hooks/useAuth";

interface HeaderProps {
  user?: AuthUser | null;
  /** AI model indicator (optional) */
  currentModel?: string;
}

export function Header({ user, currentModel }: HeaderProps) {
  return (
    <header className="h-14 shrink-0 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-5 bg-white dark:bg-gray-900">
      <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
        <div className="w-8 h-8 rounded-xl bg-[#A435F0] flex items-center justify-center shadow-sm">
          <Zap className="w-4 h-4 text-white fill-white" />
        </div>
        <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          Inkgest
        </span>
      </Link>

      <div className="flex items-center gap-2">
        {/* Keyboard shortcut hints */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 mr-1">
          <Keyboard className="w-3 h-3" />
          <span>Alt+↑↓ chuyển bài</span>
        </div>

        {/* AI model badge */}
        {currentModel && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            {currentModel}
          </span>
        )}

        <ModeToggle />

        {user && <AvatarDropdown user={user} />}
      </div>
    </header>
  );
}
