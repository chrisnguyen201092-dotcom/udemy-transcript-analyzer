/**
 * useAuth — Client hook for authentication state and actions.
 *
 * - Fetches /api/auth/me on mount to get current user
 * - Provides login, logout, register, refresh actions
 * - Redirects to /login on logout
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  preferences: Record<string, unknown> | null;
  createdAt: string;
}

interface UseAuthReturn {
  user: AuthUser | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    name?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      rememberMe = false
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, rememberMe }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : "Login failed";
          return { success: false, error: msg };
        }
        setUser(data.user);
        return { success: true };
      } catch {
        return { success: false, error: "Network error" };
      }
    },
    []
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      name?: string
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          const msg =
            typeof data.error === "string"
              ? data.error
              : "Registration failed";
          return { success: false, error: msg };
        }
        setUser(data.user);
        return { success: true };
      } catch {
        return { success: false, error: "Network error" };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  return { user, loading, login, register, logout, refresh };
}
