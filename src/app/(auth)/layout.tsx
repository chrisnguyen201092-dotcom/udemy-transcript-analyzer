/**
 * Auth layout — minimal centered card layout for login/register/forgot/reset pages.
 * No sidebar, no header. Just brand + centered content.
 */

import { Zap } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 px-4">
      <div className="mb-8 flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-[#A435F0] flex items-center justify-center shadow-sm">
          <Zap className="w-5 h-5 text-white fill-white" />
        </div>
        <span className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
          Inkgest
        </span>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
