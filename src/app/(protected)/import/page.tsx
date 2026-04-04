"use client";

import { useState } from "react";
import { Globe, FileText, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { ImportModal } from "@/components/ImportModal";
import { UploadModal } from "@/components/UploadModal";
import { useUdemyImport } from "@/hooks/use-udemy-import";
import { loadStore, activeProfile } from "@/lib/settings-store";

type ImportMode = "udemy" | "transcript" | "book" | null;

const IMPORT_CARDS = [
  {
    key: "udemy" as const,
    icon: Globe,
    title: "Import từ Udemy",
    description: "Lấy danh sách courses từ tài khoản Udemy của bạn và import transcript tự động.",
    badge: "Udemy",
    badgeColor: "bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400",
  },
  {
    key: "transcript" as const,
    icon: FileText,
    title: "Upload Transcript",
    description: "Upload file .vtt, .srt, .txt hoặc .pdf để tạo bài học từ transcript có sẵn.",
    badge: "VTT / SRT / TXT",
    badgeColor: "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400",
  },
  {
    key: "book" as const,
    icon: BookOpen,
    title: "Upload Sách / PDF",
    description: "Upload PDF hoặc ebook để tách thành các bài học theo chương tự động.",
    badge: "PDF / EPUB",
    badgeColor: "bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400",
  },
];

export default function ImportPage() {
  const router = useRouter();
  const [mode, setMode] = useState<ImportMode>(null);

  const store = loadStore();
  const profile = activeProfile(store);

  const udemy = useUdemyImport(() => {
    // After import success — close modal, optionally navigate to home
    setMode(null);
  });

  return (
    <div className="min-h-full bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Import nội dung</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Chọn nguồn để thêm khóa học vào thư viện của bạn.
          </p>
        </div>

        {/* Import source cards */}
        <div className="flex flex-col gap-3">
          {IMPORT_CARDS.map(({ key, icon: Icon, title, description, badge, badgeColor }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className="w-full text-left flex items-start gap-4 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-[#A435F0] hover:shadow-sm transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center shrink-0 group-hover:bg-purple-100 dark:group-hover:bg-purple-900 transition-colors">
                <Icon className="w-5 h-5 text-[#A435F0]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${badgeColor}`}>
                    {badge}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
              </div>
              <span className="text-gray-300 dark:text-gray-600 group-hover:text-[#A435F0] transition-colors text-lg leading-none mt-1">›</span>
            </button>
          ))}
        </div>
      </div>

      {/* Udemy Import Modal */}
      <ImportModal
        open={mode === "udemy"}
        courses={udemy.udemyCourses}
        fetching={udemy.fetchingUdemy}
        error={udemy.udemyError}
        importingId={udemy.importingId}
        importProgress={udemy.importProgress}
        onClose={() => { setMode(null); udemy.resetImportState(); }}
        onRefresh={() => udemy.handleFetchUdemyCourses(profile.udemyCookie)}
        onImport={(course) => udemy.handleImportCourse(course, profile.udemyCookie)}
      />

      {/* Upload Modal (transcript or book) */}
      <UploadModal
        open={mode === "transcript" || mode === "book"}
        courseId={null}
        initialMode={mode === "book" ? "book" : "transcript"}
        onClose={() => setMode(null)}
        onUploadComplete={(newCourseId) => {
          setMode(null);
          router.push(`/?courseId=${newCourseId}`);
        }}
      />
    </div>
  );
}
