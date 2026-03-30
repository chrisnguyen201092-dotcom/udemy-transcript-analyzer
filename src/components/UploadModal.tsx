"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FileUp, X, CheckCircle2, AlertCircle, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface UploadModalProps {
  open: boolean;
  courseId: string | null;
  onClose: () => void;
  onUploadComplete: (newCourseId: string) => void;
}

type FileStatus = "pending" | "processing" | "success" | "error";

interface SelectedFile {
  file: File;
  status: FileStatus;
  error?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function UploadModal({
  open,
  courseId,
  onClose,
  onUploadComplete,
}: UploadModalProps) {
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleReset = useCallback(() => {
    setFiles([]);
    setUploading(false);
    setResult(null);
    setCourseTitle("");
  }, []);

  // Set webkitdirectory attribute - this property is not in React types but is supported in all modern browsers
  useEffect(() => {
    if (folderInputRef.current) {
      Object.defineProperty(folderInputRef.current, 'webkitdirectory', {
        value: true,
        writable: true,
      });
    }
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected) return;
      const newFiles: SelectedFile[] = Array.from(selected).map((file) => ({
        file,
        status: "pending" as FileStatus,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      setResult(null);
      // Reset input so same files can be re-selected
      if (inputRef.current) inputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    },
    []
  );

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = useCallback(async () => {
    // Need either an existing courseId or a new title
    if (!courseId && !courseTitle.trim()) return;
    if (files.length === 0) return;

    setUploading(true);
    setResult(null);

    // Mark all as processing
    setFiles((prev) => prev.map((f) => ({ ...f, status: "processing" as FileStatus })));

    try {
      // Read all files client-side
      const fileContents: Array<{ name: string; content: string; type: string }> = [];
      for (const { file } of files) {
        const content = await file.text();
        fileContents.push({
          name: file.name,
          content,
          type: getFileExtension(file.name),
        });
      }

      const body = courseId
        ? { courseId, files: fileContents }
        : { courseTitle: courseTitle.trim(), files: fileContents };

      const res = await fetch("/api/courses/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : "Upload thất bại";
        setFiles((prev) => prev.map((f) => ({ ...f, status: "error" as FileStatus, error: errMsg })));
        setResult(`Lỗi: ${errMsg}`);
        return;
      }

      // Mark all as success
      setFiles((prev) => prev.map((f) => ({ ...f, status: "success" as FileStatus })));
      setResult(`Đã upload thành công ${data.created.length} file`);
      onUploadComplete(data.courseId as string);
    } catch {
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as FileStatus, error: "Lỗi kết nối" }))
      );
      setResult("Lỗi kết nối khi upload.");
    } finally {
      setUploading(false);
    }
  }, [courseId, courseTitle, files, onUploadComplete]);

  const statusIcon = (status: FileStatus) => {
    switch (status) {
      case "processing":
        return <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />;
      case "success":
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />;
    }
  };

  const canUpload = files.length > 0 && (!!courseId || !!courseTitle.trim());

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-4 h-4" />
            Upload từ file
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          {/* Course name input — only when no course pre-selected */}
          {!courseId && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Tên course
              </label>
              <Input
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="Ví dụ: React Advanced 2024..."
                className="text-sm h-9 border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
                disabled={uploading}
              />
            </div>
          )}

          {/* Result message */}
          {result && (
            <p
              className={`text-sm rounded-lg px-3 py-2 border ${
                result.startsWith("Đã upload")
                  ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800"
              }`}
            >
              {result}
            </p>
          )}

          {/* File input */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 cursor-pointer text-xs"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <FileUp className="w-3.5 h-3.5" />
              Chọn file
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 cursor-pointer text-xs"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploading}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Tải lên thư mục
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".vtt,.srt,.txt"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={folderInputRef}
              type="file"
              accept=".vtt,.srt,.txt"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <ScrollArea className="max-h-[300px]">
              <ul className="flex flex-col gap-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.file.name}-${i}`}
                    className="flex items-center gap-2 p-2 border border-slate-100 dark:border-slate-800 rounded-lg text-sm"
                  >
                    {statusIcon(f.status)}
                    <span className="flex-1 truncate text-xs">{f.file.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                      {formatFileSize(f.file.size)}
                    </span>
                    {f.status === "pending" && !uploading && (
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(i)}
                        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <X className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          {canUpload && (
            <Button
              size="sm"
              className="gap-2 cursor-pointer mr-auto bg-[#A435F0] hover:bg-[#8710D8]"
              onClick={handleUpload}
              disabled={uploading || files.every((f) => f.status === "success")}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                "Upload & Xử lý"
              )}
            </Button>
          )}
          <Button variant="outline" onClick={handleClose} className="cursor-pointer">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
