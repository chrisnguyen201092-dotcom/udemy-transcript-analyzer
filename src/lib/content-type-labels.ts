/**
 * content-type-labels.ts
 * Shared utility for content-type-aware UI labels.
 * All components use this to ensure consistent "course" vs "book" terminology.
 */

export type ContentTypeKey = "course" | "book";

export interface ContentLabels {
  /** "Khóa học" | "Sách" */
  entity: string;
  /** "Bài học" | "Chương" */
  lesson: string;
  /** "Danh sách bài học" | "Danh sách chương" */
  lessons: string;
  /** "Transcript" | "Nội dung chương" */
  content: string;
  /** "Tên bài học..." | "Tên chương..." */
  lessonPlaceholder: string;
  /** "Tìm kiếm bài học..." | "Tìm kiếm chương..." */
  searchPlaceholder: string;
  /** "Chưa có bài học nào" | "Chưa có chương nào" */
  noLessons: string;
  /** "Xóa bài học?" | "Xóa chương?" */
  deleteLesson: string;
  /** "Bài học" | "Chương" — for delete confirmation body */
  lessonSingular: string;
  /** Returns "N bài học" | "N chương" */
  lessonCount: (n: number) => string;
}

const LABELS: Record<ContentTypeKey, ContentLabels> = {
  course: {
    entity: "Khóa học",
    lesson: "Bài học",
    lessons: "Danh sách bài học",
    content: "Transcript",
    lessonPlaceholder: "Tên bài học...",
    searchPlaceholder: "Tìm kiếm bài học...",
    noLessons: "Chưa có bài học nào",
    deleteLesson: "Xóa bài học?",
    lessonSingular: "Bài học",
    lessonCount: (n) => `${n} bài học`,
  },
  book: {
    entity: "Sách",
    lesson: "Chương",
    lessons: "Danh sách chương",
    content: "Nội dung chương",
    lessonPlaceholder: "Tên chương...",
    searchPlaceholder: "Tìm kiếm chương...",
    noLessons: "Chưa có chương nào",
    deleteLesson: "Xóa chương?",
    lessonSingular: "Chương",
    lessonCount: (n) => `${n} chương`,
  },
};

/**
 * Returns UI labels appropriate for the given content type.
 * Falls back to "course" labels for unknown types.
 */
export function getLabels(contentType?: string | null): ContentLabels {
  return LABELS[contentType as ContentTypeKey] ?? LABELS.course;
}
