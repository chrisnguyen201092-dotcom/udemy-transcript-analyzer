"use client";

import { useEffect } from "react";
import { FileText, BookOpen, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TranscriptUploadFlow } from "@/components/upload/transcript-upload-flow";
import { BookFormStep, BookPreviewStep } from "@/components/upload/book-split-flow";
import { useTranscriptUpload } from "@/hooks/use-transcript-upload";
import { useBookSplitFlow } from "@/hooks/use-book-split-flow";

// ── Types ──────────────────────────────────────────────────────────────────────

interface UploadModalProps {
  open: boolean;
  courseId: string | null;
  initialMode?: UploadMode;
  onClose: () => void;
  onUploadComplete: (newCourseId: string) => void;
}

type UploadMode = "transcript" | "book";

// ── Component ──────────────────────────────────────────────────────────────────

export function UploadModal({
  open,
  courseId,
  initialMode,
  onClose,
  onUploadComplete,
}: UploadModalProps) {
  // Mode is managed locally; hooks handle their own reset
  const transcript = useTranscriptUpload({ courseId, onUploadComplete });
  const book = useBookSplitFlow({ onUploadComplete });

  // Derive current mode from initialMode prop or default to "transcript"
  const mode: UploadMode = initialMode ?? "transcript";

  // Sync mode on open
  useEffect(() => {
    if (open) {
      transcript.reset();
      book.reset();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialMode]);

  const handleClose = () => {
    transcript.reset();
    book.reset();
    onClose();
  };

  // ── Footer buttons ─────────────────────────────────────────────────────────

  const renderFooter = () => {
    if (mode === "transcript") {
      return transcript.canUpload ? (
        <Button
          size="sm"
          className="gap-2 cursor-pointer mr-auto bg-[#A435F0] hover:bg-[#8710D8]"
          onClick={transcript.upload}
          disabled={transcript.uploading || transcript.files.every((f) => f.status === "success")}
        >
          {transcript.uploading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang xử lý...</>
          ) : "Upload & Xử lý"}
        </Button>
      ) : null;
    }

    // Book mode
    if (!book.isInPreview) {
      return book.canAnalyzeBook ? (
        <Button
          size="sm"
          className="gap-2 cursor-pointer mr-auto bg-[#A435F0] hover:bg-[#8710D8]"
          onClick={book.analyzeBook}
          disabled={book.uploading}
        >
          {book.splitStep === "analyzing" ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang phân tích...</>
          ) : "Phân tích chương"}
        </Button>
      ) : null;
    }

    return (
      <>
        <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer mr-auto"
          onClick={book.cancelPreview} disabled={book.splitStep === "confirming"}>
          <ChevronLeft className="w-3.5 h-3.5" />Quay lại
        </Button>
        <Button
          size="sm"
          className="gap-2 cursor-pointer bg-[#A435F0] hover:bg-[#8710D8]"
          onClick={book.confirmBook}
          disabled={book.uploading || book.splitChapters.length === 0}
        >
          {book.splitStep === "confirming" ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" />Đang tạo...</>
          ) : "Xác nhận tạo sách"}
        </Button>
      </>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "transcript" ? (
              <><FileText className="w-4 h-4" /> Upload files</>
            ) : (
              <><BookOpen className="w-4 h-4" /> Upload sách</>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Transcript mode */}
        {mode === "transcript" && (
          <TranscriptUploadFlow
            courseId={courseId}
            files={transcript.files}
            courseTitle={transcript.courseTitle}
            setCourseTitle={transcript.setCourseTitle}
            uploading={transcript.uploading}
            isDragging={transcript.isDragging}
            result={transcript.result}
            inputRef={transcript.inputRef}
            folderInputRef={transcript.folderInputRef}
            onDragEnter={transcript.handleDragEnter}
            onDragLeave={transcript.handleDragLeave}
            onDragOver={transcript.handleDragOver}
            onDrop={transcript.handleDrop}
            onFileChange={transcript.handleFileChange}
            onRemoveFile={transcript.removeFile}
          />
        )}

        {/* Book mode — form step */}
        {mode === "book" && !book.isInPreview && (
          <BookFormStep
            bookFile={book.bookFile}
            setBookFile={book.setBookFile}
            bookTitle={book.bookTitle}
            setBookTitle={book.setBookTitle}
            bookAuthor={book.bookAuthor}
            setBookAuthor={book.setBookAuthor}
            bookIsbn={book.bookIsbn}
            setBookIsbn={book.setBookIsbn}
            bookPublisher={book.bookPublisher}
            setBookPublisher={book.setBookPublisher}
            metadataLoading={book.metadataLoading}
            uploading={book.uploading}
            isDragging={book.isDragging}
            result={null}
            bookInputRef={book.bookInputRef}
            onDragEnter={book.handleDragEnter}
            onDragLeave={book.handleDragLeave}
            onDragOver={book.handleDragOver}
            onDrop={book.handleDrop}
            onBookFileChange={book.handleBookFileChange}
          />
        )}

        {/* Book mode — preview step */}
        {mode === "book" && book.isInPreview && (
          <BookPreviewStep
            bookTitle={book.bookTitle}
            splitChapters={book.splitChapters}
            splitWarnings={book.splitWarnings}
            splitMethod={book.splitMethod}
            splitStep={book.splitStep}
            splitDialogIdx={book.splitDialogIdx}
            setSplitDialogIdx={book.setSplitDialogIdx}
            onChapterTitleChange={book.updateChapterTitle}
            onDeleteChapter={book.deleteChapter}
            onMergeChapterDown={book.mergeChapterDown}
            onSplitChapterAt={book.splitChapterAt}
          />
        )}

        <DialogFooter>
          {renderFooter()}
          <Button variant="outline" onClick={handleClose} className="cursor-pointer">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
