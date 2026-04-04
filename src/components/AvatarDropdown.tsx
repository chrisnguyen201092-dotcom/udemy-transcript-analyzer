/**
 * AvatarDropdown — User menu dropdown with profile info, navigation, and logout.
 * Uses shadcn DropdownMenu + Avatar components.
 */

"use client";

import { LogOut, LayoutDashboard, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth, type AuthUser } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/user-utils";

interface AvatarDropdownProps {
  user: AuthUser;
}

export function AvatarDropdown({ user }: AvatarDropdownProps) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A435F0] cursor-pointer">
        <Avatar className="h-8 w-8">
          {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name ?? user.email} />}
          <AvatarFallback className="bg-[#A435F0] text-white text-xs font-medium">
            {getInitials(user.name, user.email)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {user.name && (
              <p className="text-sm font-medium leading-none">{user.name}</p>
            )}
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onClick={() => router.push("/dashboard")}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          onClick={() => router.push("/settings")}
        >
          <Settings className="h-4 w-4" />
          Cài đặt
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => logout()}
          className="cursor-pointer gap-2 text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
