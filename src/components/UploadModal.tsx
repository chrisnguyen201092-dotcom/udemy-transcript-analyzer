"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  FileUp, X, CheckCircle2, AlertCircle, Loader2,
  FolderOpen, Upload, BookOpen, FileText,
  GripVertical, ChevronLeft, TriangleAlert, Scissors, ChevronsDown,
} from "lucide-react";
import { toast } from "sonner";
import { SplitChapterDialog } from "@/components/SplitChapterDialog";
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
  initialMode?: UploadMode;
  onClose: () => void;
  onUploadComplete: (newCourseId: string) => void;
}

type FileStatus = "pending" | "processing" | "success" | "error";
type UploadMode = "transcript" | "book";
type SplitStep = "form" | "analyzing" | "preview" | "confirming";

interface SelectedFile {
  file: File;
  status: FileStatus;
  error?: string;
}

interface SplitChapter {
  index: number;
  title: string;
  wordCount: number;
  content: string;
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

const TRANSCRIPT_EXTENSIONS = [".vtt", ".srt", ".txt"];
const BOOK_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".epub"];
const BINARY_EXTENSIONS = new Set([".pdf", ".docx", ".epub"]);

function isAcceptedTranscript(file: File): boolean {
  return TRANSCRIPT_EXTENSIONS.includes(getFileExtension(file.name));
}

function isAcceptedBook(file: File): boolean {
  return BOOK_EXTENSIONS.includes(getFileExtension(file.name));
}

/** Read a file as base64 (for binary) or plain text (for text files). */
async function readFileContent(file: File): Promise<string> {
  const ext = getFileExtension(file.name);
  if (BINARY_EXTENSIONS.has(ext)) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix: "data:...;base64,"
        const base64 = result.split(",")[1] ?? result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  return file.text();
}

export function UploadModal({
  open,
  courseId,
  initialMode,
  onClose,
  onUploadComplete,
}: UploadModalProps) {
  const [mode, setMode] = useState<UploadMode>("transcript");

  // Sync mode when modal opens with a specific initialMode
  useEffect(() => {
    if (open && initialMode) setMode(initialMode);
  }, [open, initialMode]);

  // ── Transcript state ──────────────────────────────────────────────────
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [courseTitle, setCourseTitle] = useState("");

  // ── Book state ────────────────────────────────────────────────────────
  const [bookFile, setBookFile] = useState<SelectedFile | null>(null);
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookIsbn, setBookIsbn] = useState("");
  const [bookPublisher, setBookPublisher] = useState("");
  const [metadataLoading, setMetadataLoading] = useState(false);

  // ── Book split/confirm state ──────────────────────────────────────────
  const [splitStep, setSplitStep] = useState<SplitStep>("form");
  const [splitChapters, setSplitChapters] = useState<SplitChapter[]>([]);
  const [splitWarnings, setSplitWarnings] = useState<string[]>([]);
  const [splitBookId, setSplitBookId] = useState<string | null>(null);
  const [splitMethod, setSplitMethod] = useState<"heuristic" | "fallback" | null>(null);
  const [splitDialogIdx, setSplitDialogIdx] = useState<number | null>(null);

  // ── Shared state ──────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ message: string; isError: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);
  // M-13: AbortController for in-flight transcript upload
  const transcriptAbortRef = useRef<AbortController | null>(null);
  const dragCounterRef = useRef(0);
  // Track in-flight book stub id so we can clean it up on close/abort
  const pendingStubIdRef = useRef<string | null>(null);
  // Mirror splitBookId state so handleReset / unmount can read it without stale closure
  const splitBookIdRef = useRef<string | null>(null);
  // AbortController for the active /api/books + /api/books/split fetch pair
  const abortControllerRef = useRef<AbortController | null>(null);

  // Set webkitdirectory attribute — not in React types but supported in all modern browsers
  useEffect(() => {
    if (folderInputRef.current) {
      Object.defineProperty(folderInputRef.current, "webkitdirectory", {
        value: true,
        writable: true,
      });
    }
  }, []);

  // Cleanup on unmount: abort in-flight requests and delete any orphan stubs
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (pendingStubIdRef.current) {
        const stubId = pendingStubIdRef.current;
        pendingStubIdRef.current = null;
        fetch(`/api/books?id=${stubId}`, { method: "DELETE" }).catch(() => undefined);
      }
      if (splitBookIdRef.current) {
        const stubId = splitBookIdRef.current;
        splitBookIdRef.current = null;
        fetch(`/api/books?id=${stubId}`, { method: "DELETE" }).catch(() => undefined);
      }
    };
  }, []);

  const handleReset = useCallback(() => {
    // Abort any in-flight book analysis fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // M-13: Abort any in-flight transcript upload
    if (transcriptAbortRef.current) {
      transcriptAbortRef.current.abort();
      transcriptAbortRef.current = null;
    }
    // Clean up uncommitted stub created during analysis (fire-and-forget)
    if (pendingStubIdRef.current) {
      const stubId = pendingStubIdRef.current;
      pendingStubIdRef.current = null;
      fetch(`/api/books?id=${stubId}`, { method: "DELETE" }).catch(() => undefined);
    }
    // Clean up stub at the preview/confirming step (ownership moved from pendingStubIdRef)
    if (splitBookIdRef.current) {
      const stubId = splitBookIdRef.current;
      splitBookIdRef.current = null;
      fetch(`/api/books?id=${stubId}`, { method: "DELETE" }).catch(() => undefined);
    }
    setFiles([]);
    setCourseTitle("");
    setBookFile(null);
    setBookTitle("");
    setBookAuthor("");
    setBookIsbn("");
    setBookPublisher("");
    setSplitStep("form");
    setSplitChapters([]);
    setSplitWarnings([]);
    setSplitBookId(null);
    setSplitMethod(null);
    setSplitDialogIdx(null);
    setUploading(false);
    setResult(null);
    setIsDragging(false);
    setMetadataLoading(false);
    dragCounterRef.current = 0;
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const switchMode = useCallback((next: UploadMode) => {
    handleReset();
    setMode(next);
  }, [handleReset]);

  // ── Drag & drop ───────────────────────────────────────────────────────
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDropTranscript = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    const accepted: SelectedFile[] = [];
    let rejectedCount = 0;

    Array.from(droppedFiles).forEach((file) => {
      if (isAcceptedTranscript(file)) {
        accepted.push({ file, status: "pending" });
      } else {
        rejectedCount++;
      }
    });

    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted]);
      setResult(null);
    }
    if (rejectedCount > 0) {
      toast.warning(`${rejectedCount} file bị bỏ qua. Chỉ hỗ trợ .vtt, .srt, .txt — dùng "Upload sách" cho PDF/EPUB.`);
    }
  }, []);

  /** Call /api/books/metadata-preview and prefill form fields */
  const fetchMetadataPreview = useCallback(async (file: File) => {
    setMetadataLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/books/metadata-preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json() as Record<string, string>;
      if (!res.ok) {
        toast.warning(`Không đọc được metadata: ${data.error ?? "unknown"}`);
        return;
      }
      // Only prefill fields the user hasn't already typed into
      if (data.title) setBookTitle((prev) => prev.trim() ? prev : data.title);
      if (data.author) setBookAuthor((prev) => prev.trim() ? prev : data.author);
      if (data.isbn) setBookIsbn((prev) => prev.trim() ? prev : data.isbn);
      if (data.publisher) setBookPublisher((prev) => prev.trim() ? prev : data.publisher);
    } catch {
      toast.warning("Không thể tự động đọc thông tin sách. Vui lòng nhập thủ công.");
    } finally {
      setMetadataLoading(false);
    }
  }, []);

  const handleDropBook = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    const file = droppedFiles[0];
    if (!isAcceptedBook(file)) {
      toast.warning("Định dạng không hỗ trợ. Chấp nhận: .pdf, .docx, .txt, .md, .epub");
      return;
    }
    setBookFile({ file, status: "pending" });
    setResult(null);
    // Auto-fill title from filename as immediate fallback
    const dot = file.name.lastIndexOf(".");
    const nameWithoutExt = dot >= 0 ? file.name.slice(0, dot) : file.name;
    setBookTitle((prev) => prev.trim() ? prev : nameWithoutExt);
    // Kick off server-side metadata extraction
    void fetchMetadataPreview(file);
  }, [fetchMetadataPreview]);

  // ── File pickers ──────────────────────────────────────────────────────
  const handleTranscriptFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected) return;
      const newFiles: SelectedFile[] = Array.from(selected).map((file) => ({
        file,
        status: "pending" as FileStatus,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      setResult(null);
      if (inputRef.current) inputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    },
    []
  );

  const handleBookFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected || selected.length === 0) return;
      const file = selected[0];
      setBookFile({ file, status: "pending" });
      setResult(null);
      // Auto-fill title from filename as immediate fallback
      const dot = file.name.lastIndexOf(".");
      const nameWithoutExt = dot >= 0 ? file.name.slice(0, dot) : file.name;
      setBookTitle((prev) => prev.trim() ? prev : nameWithoutExt);
      // Kick off server-side metadata extraction
      void fetchMetadataPreview(file);
      if (bookInputRef.current) bookInputRef.current.value = "";
    },
    [fetchMetadataPreview]
  );

  const handleRemoveTranscriptFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Upload: transcript ────────────────────────────────────────────────
  const handleUploadTranscript = useCallback(async () => {
    if (!courseId && !courseTitle.trim()) return;
    if (files.length === 0) return;

    setUploading(true);
    setResult(null);
    setFiles((prev) => prev.map((f) => ({ ...f, status: "processing" as FileStatus })));

    // M-13: Create AbortController so close/reset can cancel this upload
    const controller = new AbortController();
    transcriptAbortRef.current = controller;

    try {
      const fileContents: Array<{ name: string; content: string; type: string }> = [];
      for (const { file } of files) {
        const content = await file.text();
        fileContents.push({ name: file.name, content, type: getFileExtension(file.name) });
      }

      const body = courseId
        ? { courseId, files: fileContents }
        : { courseTitle: courseTitle.trim(), files: fileContents };

      const res = await fetch("/api/courses/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : "Upload thất bại";
        setFiles((prev) => prev.map((f) => ({ ...f, status: "error" as FileStatus, error: errMsg })));
        setResult({ message: `Lỗi: ${errMsg}`, isError: true });
        toast.error(errMsg);
        return;
      }

      setFiles((prev) => prev.map((f) => ({ ...f, status: "success" as FileStatus })));
      setResult({ message: `Đã upload thành công ${data.created.length} file`, isError: false });
      toast.success(`Đã upload thành công ${data.created.length} file`);
      onUploadComplete(data.courseId as string);
    } catch (err) {
      // M-13: Suppress AbortError — modal was closed while uploading
      if (err instanceof Error && err.name === "AbortError") return;
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as FileStatus, error: "Lỗi kết nối" }))
      );
      setResult({ message: "Lỗi kết nối khi upload.", isError: true });
      toast.error("Lỗi kết nối khi upload");
    } finally {
      setUploading(false);
    }
  }, [courseId, courseTitle, files, onUploadComplete]);

  // ── Book: step 1 — analyze chapters ───────────────────────────────────
  const handleAnalyzeBook = useCallback(async () => {
    if (!bookFile || !bookTitle.trim()) return;

    setSplitStep("analyzing");
    setUploading(true);
    setResult(null);

    // Create a fresh AbortController for this request pair
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let createdBookId: string | null = null;

    try {
      // 1. Create book stub
      const stubRes = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bookTitle.trim(),
          ...(bookAuthor.trim() ? { author: bookAuthor.trim() } : {}),
          ...(bookIsbn.trim() ? { isbn: bookIsbn.trim() } : {}),
          ...(bookPublisher.trim() ? { publisher: bookPublisher.trim() } : {}),
        }),
        signal: controller.signal,
      });
      const stubData = await stubRes.json();
      if (!stubRes.ok) {
        throw new Error(typeof stubData.error === "string" ? stubData.error : "Không thể tạo sách");
      }
      createdBookId = stubData.bookId as string;
      // Register so handleReset / unmount can clean it up if cancelled
      pendingStubIdRef.current = createdBookId;

      // 2. Read file + call split
      const content = await readFileContent(bookFile.file);
      const format = getFileExtension(bookFile.file.name).slice(1); // strip leading dot

      const splitRes = await fetch("/api/books/split", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: createdBookId, format, content }),
        signal: controller.signal,
      });
      const splitData = await splitRes.json();
      if (!splitRes.ok) {
        throw new Error(typeof splitData.error === "string" ? splitData.error : "Phân tích chương thất bại");
      }

      // Success — hand off stub ownership to the preview step
      pendingStubIdRef.current = null;
      abortControllerRef.current = null;

      splitBookIdRef.current = createdBookId;
      setSplitBookId(createdBookId);
      setSplitChapters(splitData.chapters as SplitChapter[]);
      setSplitWarnings(splitData.warnings as string[]);
      setSplitMethod(splitData.method as "heuristic" | "fallback");
      setSplitStep("preview");
    } catch (err) {
      // Ignore AbortError — component is unmounting or user cancelled
      if (err instanceof DOMException && err.name === "AbortError") return;

      const msg = err instanceof Error ? err.message : "Lỗi kết nối";
      toast.error(msg);
      // Clean up stub if it was created and we still own it
      if (createdBookId && pendingStubIdRef.current === createdBookId) {
        pendingStubIdRef.current = null;
        fetch(`/api/books?id=${createdBookId}`, { method: "DELETE" }).catch(() => undefined);
      }
      abortControllerRef.current = null;
      setSplitStep("form");
    } finally {
      setUploading(false);
    }
  }, [bookFile, bookTitle, bookAuthor, bookIsbn, bookPublisher]);

  // ── Book: step 2 — confirm and create lessons ─────────────────────────
  const handleConfirmBook = useCallback(async () => {
    if (!splitBookId || splitChapters.length === 0) return;

    setSplitStep("confirming");
    setUploading(true);

    try {
      const res = await fetch("/api/books/split/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: splitBookId,
          chapters: splitChapters.map((ch) => ({
            index: ch.index,
            title: ch.title,
            content: ch.content,
            chapterNumber: ch.index,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = typeof data.error === "string" ? data.error : "Xác nhận thất bại";
        toast.error(errMsg);
        setSplitStep("preview");
        return;
      }

      toast.success(`Đã tạo sách với ${(data.created as unknown[]).length} chương`);
      // Book is now fully committed — clear ref so handleReset won't delete it
      splitBookIdRef.current = null;
      onUploadComplete(data.courseId as string);
    } catch {
      toast.error("Lỗi kết nối khi xác nhận");
      setSplitStep("preview");
    } finally {
      setUploading(false);
    }
  }, [splitBookId, splitChapters, onUploadComplete]);

  // ── Book: cancel preview → back to form ───────────────────────────────
  const handleCancelPreview = useCallback(() => {
    if (splitBookId) {
      // Fire-and-forget cleanup of the uncommitted stub
      splitBookIdRef.current = null;
      fetch(`/api/books?id=${splitBookId}`, { method: "DELETE" }).catch(() => undefined);
    }
    setSplitBookId(null);
    setSplitChapters([]);
    setSplitWarnings([]);
    setSplitMethod(null);
    setSplitStep("form");
  }, [splitBookId]);

  // ── Chapter editing ───────────────────────────────────────────────────
  const handleChapterTitleChange = useCallback((index: number, newTitle: string) => {
    setSplitChapters((prev) =>
      prev.map((ch, i) => (i === index ? { ...ch, title: newTitle } : ch))
    );
  }, []);

  const handleDeleteChapter = useCallback((index: number) => {
    setSplitChapters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /** Merge chapter at `index` with the next one (client-side only) */
  const handleMergeChapterDown = useCallback((index: number) => {
    setSplitChapters((prev) => {
      if (index >= prev.length - 1) return prev;
      const a = prev[index];
      const b = prev[index + 1];
      const mergedContent = [a.content, b.content].filter(Boolean).join("\n\n");
      const merged: SplitChapter = {
        ...a,
        content: mergedContent,
        wordCount: mergedContent.split(/\s+/).filter(Boolean).length,
      };
      const next = [...prev];
      next.splice(index, 2, merged);
      return next;
    });
  }, []);

  /** Split chapter at `index` at character position `splitIdx` (client-side only) */
  const handleSplitChapterAt = useCallback((index: number, splitIdx: number, newTitle: string) => {
    setSplitChapters((prev) => {
      const ch = prev[index];
      if (!ch || splitIdx <= 0 || splitIdx >= ch.content.length) return prev;
      const topContent = ch.content.slice(0, splitIdx).trimEnd();
      const bottomContent = ch.content.slice(splitIdx).trimStart();
      const updated: SplitChapter = {
        ...ch,
        content: topContent,
        wordCount: topContent.split(/\s+/).filter(Boolean).length,
      };
      const created: SplitChapter = {
        index: ch.index + 1,
        title: newTitle,
        content: bottomContent,
        wordCount: bottomContent.split(/\s+/).filter(Boolean).length,
      };
      const next = [...prev];
      next.splice(index, 1, updated, created);
      return next;
    });
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────
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

  const canUploadTranscript = files.length > 0 && (!!courseId || !!courseTitle.trim());
  const canAnalyzeBook = !!bookFile && !!bookTitle.trim() && !metadataLoading;
  const isInPreview = splitStep === "preview" || splitStep === "confirming";

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="w-4 h-4" />
            Upload tài liệu
          </DialogTitle>
        </DialogHeader>

        {/* Mode tabs — hidden during chapter preview */}
        {!isInPreview && (
          <div className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => switchMode("transcript")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                mode === "transcript"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Upload files
            </button>
            <button
              type="button"
              onClick={() => switchMode("book")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                mode === "book"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Upload sách
            </button>
          </div>
        )}

        {/* ── TRANSCRIPT MODE ─────────────────────────────────────── */}
        {mode === "transcript" && (
          <div className="flex flex-col gap-3 py-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Upload transcripts, documents, notes. Mỗi file = 1 bài học.
            </p>
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

            {result && (
              <p
                className={`text-sm rounded-lg px-3 py-2 border ${
                  !result.isError
                    ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800"
                }`}
              >
                {result.message}
              </p>
            )}

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
                onChange={handleTranscriptFileChange}
              />
              <input
                ref={folderInputRef}
                type="file"
                accept=".vtt,.srt,.txt"
                multiple
                className="hidden"
                onChange={handleTranscriptFileChange}
              />
            </div>

            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDropTranscript}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 px-4 transition-colors duration-150 ${
                isDragging
                  ? "border-[#A435F0] bg-[#A435F0]/5 dark:bg-[#A435F0]/10"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <Upload className={`w-6 h-6 ${isDragging ? "text-[#A435F0]" : "text-gray-300 dark:text-gray-600"}`} />
              <p className={`text-xs text-center ${isDragging ? "text-[#A435F0] font-medium" : "text-gray-400 dark:text-gray-500"}`}>
                {isDragging ? "Thả file vào đây" : "Kéo thả file vào đây"}
              </p>
              <p className="text-[10px] text-gray-300 dark:text-gray-600">.vtt, .srt, .txt</p>
            </div>

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
                          onClick={() => handleRemoveTranscriptFile(i)}
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
        )}

        {/* ── BOOK MODE: FORM ─────────────────────────────────────── */}
        {mode === "book" && (splitStep === "form" || splitStep === "analyzing") && (
          <div className="flex flex-col gap-3 py-1">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Upload sách, giáo trình. Hệ thống tự tách chương thành bài học.
            </p>
            {/* Metadata extraction loading indicator */}
            {metadataLoading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 px-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A435F0]" />
                Đang đọc thông tin sách...
              </div>
            )}
            {/* Book metadata */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Tên sách <span className="text-red-400">*</span>
                </label>
                <Input
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="Ví dụ: Clean Code, Lập trình Python cơ bản..."
                  className="text-sm h-9 border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
                  disabled={uploading || metadataLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Tác giả
                  </label>
                  <Input
                    value={bookAuthor}
                    onChange={(e) => setBookAuthor(e.target.value)}
                    placeholder="Robert C. Martin..."
                    className="text-sm h-9 border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
                    disabled={uploading || metadataLoading}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Nhà xuất bản
                  </label>
                  <Input
                    value={bookPublisher}
                    onChange={(e) => setBookPublisher(e.target.value)}
                    placeholder="NXB Khoa học kỹ thuật..."
                    className="text-sm h-9 border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
                    disabled={uploading || metadataLoading}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  ISBN
                </label>
                <Input
                  value={bookIsbn}
                  onChange={(e) => setBookIsbn(e.target.value)}
                  placeholder="978-0-13-468599-1"
                  className="text-sm h-9 border-gray-200 dark:border-gray-700 focus-visible:ring-[#A435F0]/30"
                  disabled={uploading || metadataLoading}
                />
              </div>
            </div>

            {result && (
              <p
                className={`text-sm rounded-lg px-3 py-2 border ${
                  !result.isError
                    ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800"
                }`}
              >
                {result.message}
              </p>
            )}

            {/* File picker button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 cursor-pointer text-xs"
                onClick={() => bookInputRef.current?.click()}
                disabled={uploading || metadataLoading}
              >
                <FileUp className="w-3.5 h-3.5" />
                Chọn file sách
              </Button>
              <input
                ref={bookInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.epub"
                className="hidden"
                onChange={handleBookFileChange}
              />
              {bookFile && (
                <span className="text-xs text-slate-500 truncate max-w-[200px]">
                  {bookFile.file.name}
                </span>
              )}
            </div>

            {/* Dropzone */}
            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDropBook}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 px-4 transition-colors duration-150 ${
                isDragging
                  ? "border-[#A435F0] bg-[#A435F0]/5 dark:bg-[#A435F0]/10"
                  : bookFile
                  ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/30"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              {bookFile ? (
                <>
                  {statusIcon(bookFile.status)}
                  <p className="text-xs text-center text-slate-600 dark:text-slate-400 font-medium">
                    {bookFile.file.name}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatFileSize(bookFile.file.size)}
                  </p>
                  {bookFile.status === "pending" && !uploading && (
                    <button
                      type="button"
                      onClick={() => { setBookFile(null); setResult(null); }}
                      className="text-[10px] text-slate-400 hover:text-red-400 cursor-pointer underline"
                    >
                      Xóa
                    </button>
                  )}
                </>
              ) : (
                <>
                  <BookOpen className={`w-6 h-6 ${isDragging ? "text-[#A435F0]" : "text-gray-300 dark:text-gray-600"}`} />
                  <p className={`text-xs text-center ${isDragging ? "text-[#A435F0] font-medium" : "text-gray-400 dark:text-gray-500"}`}>
                    {isDragging ? "Thả file vào đây" : "Kéo thả file sách vào đây"}
                  </p>
                  <p className="text-[10px] text-gray-300 dark:text-gray-600">.pdf, .docx, .txt, .md, .epub</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── BOOK MODE: CHAPTER PREVIEW ──────────────────────────── */}
        {mode === "book" && isInPreview && (
          <div className="flex flex-col gap-3 py-1">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate max-w-[280px]">
                  {bookTitle}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {splitChapters.length} chương được phát hiện
                </p>
              </div>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  splitMethod === "heuristic"
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                    : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                }`}
              >
                {splitMethod === "heuristic" ? "Tự động phát hiện" : "1 phần"}
              </span>
            </div>

            {/* Warnings */}
            {splitWarnings.length > 0 && (
              <div className="flex flex-col gap-1 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                {splitWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <TriangleAlert className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">{w}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Chapter list */}
            <ScrollArea className="max-h-[320px]">
              <ul className="flex flex-col gap-1.5 pr-1">
                {splitChapters.map((ch, i) => (
                  <li
                    key={`${ch.index}-${i}`}
                    className="flex items-center gap-2 p-2 border border-slate-100 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" />
                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 w-8 shrink-0 tabular-nums">
                      Ch.{ch.index}
                    </span>
                    <Input
                      value={ch.title}
                      onChange={(e) => handleChapterTitleChange(i, e.target.value)}
                      className="flex-1 h-7 text-xs border-slate-200 dark:border-slate-700 focus-visible:ring-[#A435F0]/30"
                      disabled={splitStep === "confirming"}
                    />
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 w-14 text-right tabular-nums">
                      {ch.wordCount.toLocaleString()} từ
                    </span>
                    {/* Split button */}
                    {ch.content && splitStep !== "confirming" && (
                      <button
                        type="button"
                        title="Tách chương tại vị trí con trỏ"
                        onClick={() => setSplitDialogIdx(i)}
                        className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900 rounded-md cursor-pointer transition-colors"
                      >
                        <Scissors className="w-3.5 h-3.5 text-purple-400 hover:text-[#A435F0]" />
                      </button>
                    )}
                    {/* Merge down button */}
                    {i < splitChapters.length - 1 && splitStep !== "confirming" && (
                      <button
                        type="button"
                        title="Gộp với chương kế tiếp"
                        onClick={() => handleMergeChapterDown(i)}
                        className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900 rounded-md cursor-pointer transition-colors"
                      >
                        <ChevronsDown className="w-3.5 h-3.5 text-amber-500 hover:text-amber-600" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteChapter(i)}
                      disabled={splitChapters.length <= 1 || splitStep === "confirming"}
                      className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <X className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>

            {/* Split chapter dialog */}
            {splitDialogIdx !== null && splitChapters[splitDialogIdx] && (
              <SplitChapterDialog
                lesson={{
                  id: String(splitDialogIdx),
                  title: splitChapters[splitDialogIdx].title,
                  transcript: splitChapters[splitDialogIdx].content,
                }}
                open={true}
                onOpenChange={(open) => { if (!open) setSplitDialogIdx(null); }}
                onConfirm={async (splitIndex, newTitle) => {
                  handleSplitChapterAt(splitDialogIdx, splitIndex, newTitle);
                  setSplitDialogIdx(null);
                }}
              />
            )}
          </div>
        )}

        <DialogFooter>
          {/* Transcript upload button */}
          {mode === "transcript" && canUploadTranscript && (
            <Button
              size="sm"
              className="gap-2 cursor-pointer mr-auto bg-[#A435F0] hover:bg-[#8710D8]"
              onClick={handleUploadTranscript}
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

          {/* Book: analyze button (form step) */}
          {mode === "book" && (splitStep === "form" || splitStep === "analyzing") && canAnalyzeBook && (
            <Button
              size="sm"
              className="gap-2 cursor-pointer mr-auto bg-[#A435F0] hover:bg-[#8710D8]"
              onClick={handleAnalyzeBook}
              disabled={uploading}
            >
              {splitStep === "analyzing" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang phân tích...
                </>
              ) : (
                "Phân tích chương"
              )}
            </Button>
          )}

          {/* Book: back + confirm buttons (preview step) */}
          {mode === "book" && isInPreview && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 cursor-pointer mr-auto"
                onClick={handleCancelPreview}
                disabled={splitStep === "confirming"}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Quay lại
              </Button>
              <Button
                size="sm"
                className="gap-2 cursor-pointer bg-[#A435F0] hover:bg-[#8710D8]"
                onClick={handleConfirmBook}
                disabled={uploading || splitChapters.length === 0}
              >
                {splitStep === "confirming" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  "Xác nhận tạo sách"
                )}
              </Button>
            </>
          )}

          <Button variant="outline" onClick={handleClose} className="cursor-pointer">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
