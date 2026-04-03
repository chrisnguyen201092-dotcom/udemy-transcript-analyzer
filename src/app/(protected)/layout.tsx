/**
 * Protected layout — Header + main content area for dashboard/settings pages.
 * Redirects to /login if the session is invalid or revoked.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Don't render children while redirecting
  if (!user) return null;

  return (
    <div className="h-screen bg-white dark:bg-gray-900 flex flex-col">
      <Header user={user} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
