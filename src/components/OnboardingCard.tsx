"use client";

import { useState, useSyncExternalStore } from "react";
import { X, BookOpen, Upload, Globe, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "inkgest_onboarding_dismissed";

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return true; // hidden on server to avoid flash
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

interface OnboardingCardProps {
  onImport: () => void;
  onUpload: () => void;
  onAddManual: () => void;
}

export function OnboardingCard({ onImport, onUpload, onAddManual }: OnboardingCardProps) {
  const storedDismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [localDismissed, setLocalDismissed] = useState(false);
  const dismissed = storedDismissed || localDismissed;

  const handleDismiss = () => {
    setLocalDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (dismissed) return null;

  return (
    <div className="relative rounded-xl border border-purple-100 dark:border-purple-900 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/50 dark:to-gray-900 p-5 shadow-sm">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors"
        aria-label="Đóng hướng dẫn"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#A435F0]/10 flex items-center justify-center shrink-0">
          <BookOpen className="w-4 h-4 text-[#A435F0]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Chào mừng đến Inkgest!
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
            Trợ lý AI giúp bạn học hiệu quả hơn. Bắt đầu bằng cách thêm khóa học đầu tiên.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs h-8 cursor-pointer"
          onClick={() => { handleDismiss(); onImport(); }}
        >
          <Globe className="w-3.5 h-3.5 text-[#A435F0]" />
          Import từ Udemy
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs h-8 cursor-pointer"
          onClick={() => { handleDismiss(); onUpload(); }}
        >
          <Upload className="w-3.5 h-3.5 text-[#A435F0]" />
          Upload file transcript
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs h-8 cursor-pointer"
          onClick={() => { handleDismiss(); onAddManual(); }}
        >
          <PlusCircle className="w-3.5 h-3.5 text-[#A435F0]" />
          Tạo khóa học thủ công
        </Button>
      </div>
    </div>
  );
}
