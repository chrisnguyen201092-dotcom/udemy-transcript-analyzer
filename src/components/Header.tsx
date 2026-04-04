"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, BookOpen, LayoutDashboard, Upload, Settings } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import { AvatarDropdown } from "@/components/AvatarDropdown";
import type { AuthUser } from "@/hooks/useAuth";

interface HeaderProps {
  user?: AuthUser | null;
  /** AI model indicator (optional) */
  currentModel?: string;
}

const NAV_LINKS = [
  { href: "/",          label: "Học",       icon: BookOpen },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/import",    label: "Import",    icon: Upload },
  { href: "/settings",  label: "Settings",  icon: Settings },
] as const;

export function Header({ user, currentModel }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="h-14 shrink-0 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between px-5 bg-white dark:bg-gray-900">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0">
        <div className="w-8 h-8 rounded-xl bg-[#A435F0] flex items-center justify-center shadow-sm">
          <Zap className="w-4 h-4 text-white fill-white" />
        </div>
        <span className="hidden sm:block text-[15px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          Inkgest
        </span>
      </Link>

      {/* Primary nav */}
      <nav className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-purple-50 dark:bg-purple-950 text-[#A435F0]"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden md:block">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {/* AI model badge */}
        {currentModel && (
          <span className="hidden lg:inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-[10px] text-gray-500 dark:text-gray-400">
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
