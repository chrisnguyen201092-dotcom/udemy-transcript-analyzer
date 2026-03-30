"use client";

import { RefreshCw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface UdemyCourse {
  id: number;
  title: string;
  url: string;
  num_lectures: number;
}

interface ImportModalProps {
  open: boolean;
  courses: UdemyCourse[];
  fetching: boolean;
  error: string;
  importingId: number | null;
  importProgress: string;
  onClose: () => void;
  onRefresh: () => void;
  onImport: (course: UdemyCourse) => void;
}

export function ImportModal({
  open,
  courses,
  fetching,
  error,
  importingId,
  importProgress,
  onClose,
  onRefresh,
  onImport,
}: ImportModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import từ Udemy
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {/* Status */}
          {fetching && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-4 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Đang lấy danh sách courses...
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-100 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {importProgress && (
            <p
              className={`text-sm rounded-lg px-3 py-2 border ${
                importProgress.startsWith("✅") || importProgress.startsWith("Đã import")
                  ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800"
                  : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800"
              }`}
            >
              {importProgress}
            </p>
          )}

          {/* Course list */}
          {courses.length > 0 && (
            <ScrollArea className="max-h-[360px]">
              <ul className="flex flex-col gap-2">
                {courses.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between p-3 border border-slate-100 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{c.num_lectures} bài học</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onImport(c)}
                      disabled={importingId === c.id}
                      className="shrink-0 cursor-pointer text-[#A435F0] border-[#A435F0]/20 hover:bg-[#A435F0]/5"
                    >
                      {importingId === c.id ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                          Đang import...
                        </>
                      ) : (
                        "Import"
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onRefresh}
            disabled={fetching}
            className="gap-2 cursor-pointer mr-auto"
          >
            <RefreshCw className={`w-4 h-4 ${fetching ? "animate-spin" : ""}`} />
            Tải lại
          </Button>
          <Button variant="outline" onClick={onClose} className="cursor-pointer">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
