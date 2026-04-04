"use client";

import { useState, useSyncExternalStore } from "react";
import { Globe, FileText, BookOpen, ChevronDown, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { ImportModal } from "@/components/ImportModal";
import { UploadModal } from "@/components/UploadModal";
import { useUdemyImport } from "@/hooks/use-udemy-import";
import { loadStore, saveStore, activeProfile } from "@/lib/settings-store";

type ImportMode = "transcript" | "book" | null;

export default function ImportPage() {
  const router = useRouter();
  const [uploadMode, setUploadMode] = useState<ImportMode>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Live settings (updates if user changes cookie in Settings tab)
  const store = useSyncExternalStore(
    (cb) => { window.addEventListener("settings-store-update", cb); return () => window.removeEventListener("settings-store-update", cb); },
    loadStore,
    loadStore,
  );
  const profile = activeProfile(store);

  // Cookie input state (inline, shown when no cookie configured)
  const [showCookieSection, setShowCookieSection] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [showCookieValue, setShowCookieValue] = useState(false);

  const udemy = useUdemyImport(() => setShowImportModal(false));

  // Save cookie to active profile then fetch
  const handleSaveAndFetch = () => {
    const cookie = cookieInput.trim();
    if (!cookie) return;
    const idx = store.profiles.findIndex((p) => p.id === profile.id);
    if (idx === -1) return;
    const updated = store.profiles.map((p, i) =>
      i === idx ? { ...p, udemyCookie: cookie } : p
    );
    saveStore({ ...store, profiles: updated });
    setShowCookieSection(false);
    setCookieInput("");
    setShowImportModal(true);
    udemy.handleFetchUdemyCourses(cookie);
  };

  const handleOpenUdemy = () => {
    if (profile.udemyCookie) {
      setShowImportModal(true);
      udemy.handleFetchUdemyCourses(profile.udemyCookie);
    } else {
      setShowCookieSection((v) => !v);
    }
  };

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

        <div className="flex flex-col gap-3">
          {/* ── Udemy card ── */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <button
              type="button"
              onClick={handleOpenUdemy}
              className="w-full text-left flex items-start gap-4 p-5 hover:border-[#A435F0] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Import từ Udemy</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400">
                    Udemy
                  </span>
                  {profile.udemyCookie && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Cookie đã cấu hình
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {profile.udemyCookie
                    ? "Lấy danh sách courses từ tài khoản Udemy và import transcript tự động."
                    : "Cần nhập Udemy Cookie để lấy danh sách courses của bạn."}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 mt-1 shrink-0 transition-transform ${showCookieSection ? "rotate-180" : ""}`}
              />
            </button>

            {/* Inline cookie input — shown when no cookie configured */}
            {showCookieSection && (
              <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 bg-gray-50 dark:bg-gray-800/40">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Vào{" "}
                  <a
                    href="https://www.udemy.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#A435F0] hover:underline"
                  >
                    udemy.com
                  </a>
                  , mở DevTools → Application → Cookies, sao chép giá trị cookie{" "}
                  <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-[10px]">access_token</code>{" "}
                  hoặc toàn bộ cookie header.
                </p>
                <div className="relative">
                  <textarea
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    placeholder="Dán cookie vào đây..."
                    rows={3}
                    style={{
                      fontFamily: "monospace",
                      ...(showCookieValue ? {} : { WebkitTextSecurity: "disc" } as React.CSSProperties),
                    }}
                    className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 pr-10 text-gray-800 dark:text-gray-200 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#A435F0]/30 focus:border-[#A435F0]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookieValue((v) => !v)}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showCookieValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleSaveAndFetch}
                    disabled={!cookieInput.trim()}
                    className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-[#A435F0] text-white hover:bg-[#8710D8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Lưu & Lấy danh sách courses
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCookieSection(false); setCookieInput(""); }}
                    className="px-4 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Transcript upload card ── */}
          <button
            type="button"
            onClick={() => setUploadMode("transcript")}
            className="w-full text-left flex items-start gap-4 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-[#A435F0] hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Upload Transcript</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                  VTT / SRT / TXT
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Upload file .vtt, .srt, .txt hoặc .pdf để tạo bài học từ transcript có sẵn.
              </p>
            </div>
            <span className="text-gray-300 dark:text-gray-600 group-hover:text-[#A435F0] transition-colors text-lg leading-none mt-1">›</span>
          </button>

          {/* ── Book upload card ── */}
          <button
            type="button"
            onClick={() => setUploadMode("book")}
            className="w-full text-left flex items-start gap-4 p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-[#A435F0] hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Upload Sách / PDF</span>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                  PDF / EPUB
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Upload PDF hoặc ebook để tách thành các bài học theo chương tự động.
              </p>
            </div>
            <span className="text-gray-300 dark:text-gray-600 group-hover:text-[#A435F0] transition-colors text-lg leading-none mt-1">›</span>
          </button>
        </div>
      </div>

      {/* Udemy Import Modal */}
      <ImportModal
        open={showImportModal}
        courses={udemy.udemyCourses}
        fetching={udemy.fetchingUdemy}
        error={udemy.udemyError}
        importingId={udemy.importingId}
        importProgress={udemy.importProgress}
        onClose={() => { setShowImportModal(false); udemy.resetImportState(); }}
        onRefresh={() => udemy.handleFetchUdemyCourses(activeProfile(loadStore()).udemyCookie)}
        onImport={(course) => udemy.handleImportCourse(course, activeProfile(loadStore()).udemyCookie)}
      />

      {/* Upload Modal */}
      <UploadModal
        open={uploadMode !== null}
        courseId={null}
        initialMode={uploadMode ?? "transcript"}
        onClose={() => setUploadMode(null)}
        onUploadComplete={(newCourseId) => {
          setUploadMode(null);
          router.push(`/?courseId=${newCourseId}`);
        }}
      />
    </div>
  );
}
