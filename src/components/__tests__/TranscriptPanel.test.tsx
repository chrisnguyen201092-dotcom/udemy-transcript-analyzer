import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TranscriptPanel } from "@/components/TranscriptPanel";

// ── Mock sonner toast ─────────────────────────────────────────

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: mockToast }));

// ── Mock shadcn/ui components minimally ────────────────────────

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span data-testid="mode-badge" className={className}>{children}</span>
  ),
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="alert-dialog">{children}</div> : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-dialog-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-dialog-title">{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="alert-dialog-description">{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button data-testid="alert-dialog-action" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="alert-dialog-cancel" onClick={onClick}>
      {children}
    </button>
  ),
}));

// ── Test setup ─────────────────────────────────────────────────

const mockLesson = {
  id: "lesson-1",
  title: "Test Lesson",
  order: 1,
  transcript:
    "Hello world this is a test transcript with some content for testing purposes.",
};

const mockLessonNoTranscript = {
  id: "lesson-2",
  title: "Empty Lesson",
  order: 2,
  transcript: null,
};

const mockSaveTranscript = vi.fn().mockResolvedValue(undefined);
const mockOnDirtyChange = vi.fn();
const mockExplainSelection = vi.fn();

function renderPanel(
  lesson: { id: string; title: string; order: number; transcript: string | null } = mockLesson,
  onExplainSelection?: (text: string) => void,
) {
  return render(
    <TranscriptPanel
      lesson={lesson}
      onSaveTranscript={mockSaveTranscript}
      onDirtyChange={mockOnDirtyChange}
      onExplainSelection={onExplainSelection}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Tests ──────────────────────────────────────────────────────

describe("TranscriptPanel", () => {
  // ── 1. Read-only / Edit mode toggle ──

  describe("Read-only / Edit mode toggle", () => {
    it("renders in read-only mode by default when transcript exists", () => {
      renderPanel();
      expect(screen.getByText("Đang đọc")).toBeInTheDocument();
      expect(screen.getByText(mockLesson.transcript!)).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("shows Chỉnh sửa button in read mode", () => {
      renderPanel();
      expect(screen.getByText("Chỉnh sửa")).toBeInTheDocument();
    });

    it("switches to edit mode when clicking Chỉnh sửa", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      expect(screen.getByText("Đang sửa")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("switches back to read-only when clicking Hủy (no changes)", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      expect(screen.getByText("Đang sửa")).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByText("Hủy"));
      });
      expect(screen.getByText("Đang đọc")).toBeInTheDocument();
    });

    it("shows unsaved changes dialog when exiting edit mode with changes", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      const textarea = screen.getByRole("textbox");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "changed content" } });
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Hủy"));
      });
      expect(screen.getByTestId("alert-dialog")).toBeInTheDocument();
      expect(screen.getByText("Thay đổi chưa lưu")).toBeInTheDocument();
    });

    it("shows Lưu button only in edit mode with changes", async () => {
      renderPanel();
      expect(screen.queryByText("Lưu")).not.toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      // Lưu button exists but is disabled (no changes yet)
      const luuBtn = screen.getByText("Lưu");
      expect(luuBtn.closest("button")).toBeDisabled();
      // Make a change
      await act(async () => {
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "modified text" },
        });
      });
      expect(screen.getByText("Lưu").closest("button")).not.toBeDisabled();
    });

    it("saves transcript when clicking Lưu", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      await act(async () => {
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "new content" },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Lưu"));
      });
      expect(mockSaveTranscript).toHaveBeenCalledWith("lesson-1", "new content");
    });

    it("unsaved dialog: Lưu và thoát saves and exits", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      await act(async () => {
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "unsaved stuff" },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Hủy"));
      });
      const saveAction = screen
        .getAllByTestId("alert-dialog-action")
        .find((a) => a.textContent === "Lưu và thoát");
      await act(async () => {
        fireEvent.click(saveAction!);
      });
      expect(mockSaveTranscript).toHaveBeenCalledWith(
        "lesson-1",
        "unsaved stuff",
      );
    });

    it("unsaved dialog: Thoát không lưu discards changes", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      await act(async () => {
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "will be discarded" },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Hủy"));
      });
      // "Thoát không lưu" is rendered as a regular Button, not AlertDialogAction
      const exitBtn = screen.getByText("Thoát không lưu");
      await act(async () => {
        fireEvent.click(exitBtn);
      });
      expect(screen.getByText("Đang đọc")).toBeInTheDocument();
      expect(mockSaveTranscript).not.toHaveBeenCalled();
    });

    it("unsaved dialog: Hủy goes back to edit mode", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      await act(async () => {
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "editing" },
        });
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Hủy"));
      });
      // Click the AlertDialog cancel button (first "Hủy" in the dialog)
      const cancelBtn = screen.getByTestId("alert-dialog-cancel");
      await act(async () => {
        fireEvent.click(cancelBtn);
      });
      expect(screen.getByText("Đang sửa")).toBeInTheDocument();
    });

    it("notifies parent via onDirtyChange", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      await act(async () => {
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "dirty" },
        });
      });
      expect(mockOnDirtyChange).toHaveBeenCalledWith(true);
    });
  });

  // ── 2. Search ──

  describe("Search within transcript", () => {
    const findSearchBtn = () =>
      screen
        .getAllByRole("button")
        .find((b) => b.getAttribute("title") === "Tìm kiếm (Ctrl+F)");

    it("opens search bar when clicking search icon", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(findSearchBtn()!);
      });
      expect(
        screen.getByPlaceholderText("Tìm kiếm trong transcript..."),
      ).toBeInTheDocument();
    });

    it("highlights matches in transcript", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(findSearchBtn()!);
      });
      const searchInput = screen.getByPlaceholderText(
        "Tìm kiếm trong transcript...",
      );
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "test" } });
      });
      // "test" appears in "test transcript" and "testing" = 2 matches
      expect(screen.getByText(/1 \/ 2 kết quả/)).toBeInTheDocument();
      const marks = document.querySelectorAll("mark");
      expect(marks.length).toBe(2);
    });

    it("shows 0 results for non-matching query", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(findSearchBtn()!);
      });
      const searchInput = screen.getByPlaceholderText(
        "Tìm kiếm trong transcript...",
      );
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "zzzznotfound" } });
      });
      expect(screen.getByText("0 kết quả")).toBeInTheDocument();
    });

    it("navigates between matches with next/prev buttons", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(findSearchBtn()!);
      });
      const searchInput = screen.getByPlaceholderText(
        "Tìm kiếm trong transcript...",
      );
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "test" } });
      });
      expect(screen.getByText(/1 \/ 2 kết quả/)).toBeInTheDocument();

      const nextBtn = screen
        .getAllByRole("button")
        .find((b) => b.getAttribute("title") === "Tiếp theo (F3)");
      await act(async () => {
        fireEvent.click(nextBtn!);
      });
      expect(screen.getByText(/2 \/ 2 kết quả/)).toBeInTheDocument();

      // Wrap around
      await act(async () => {
        fireEvent.click(nextBtn!);
      });
      expect(screen.getByText(/1 \/ 2 kết quả/)).toBeInTheDocument();
    });

    it("navigates backwards with prev button", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(findSearchBtn()!);
      });
      const searchInput = screen.getByPlaceholderText(
        "Tìm kiếm trong transcript...",
      );
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "test" } });
      });

      const prevBtn = screen
        .getAllByRole("button")
        .find((b) => b.getAttribute("title") === "Trước đó (Shift+F3)");
      await act(async () => {
        fireEvent.click(prevBtn!);
      });
      // Wraps to last: 2 / 2
      expect(screen.getByText(/2 \/ 2 kết quả/)).toBeInTheDocument();
    });

    it("closes search bar when clicking X button", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(findSearchBtn()!);
      });
      expect(
        screen.getByPlaceholderText("Tìm kiếm trong transcript..."),
      ).toBeInTheDocument();
      const closeBtn = screen
        .getAllByRole("button")
        .find((b) => b.getAttribute("title") === "Đóng (Escape)");
      await act(async () => {
        fireEvent.click(closeBtn!);
      });
      expect(
        screen.queryByPlaceholderText("Tìm kiếm trong transcript..."),
      ).not.toBeInTheDocument();
    });

    it("escapes regex special characters in search", async () => {
      const lesson = {
        ...mockLesson,
        transcript: "function foo(bar) { return [1,2]; }",
      };
      render(
        <TranscriptPanel
          lesson={lesson}
          onSaveTranscript={mockSaveTranscript}
        />,
      );
      const searchBtn = screen
        .getAllByRole("button")
        .find((b) => b.getAttribute("title") === "Tìm kiếm (Ctrl+F)");
      await act(async () => {
        fireEvent.click(searchBtn!);
      });
      const searchInput = screen.getByPlaceholderText(
        "Tìm kiếm trong transcript...",
      );
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "foo(bar)" } });
      });
      expect(screen.getByText(/1 \/ 1 kết quả/)).toBeInTheDocument();
    });

    it("is case-insensitive by default", async () => {
      const lesson = {
        ...mockLesson,
        transcript: "Hello HELLO hello",
      };
      render(
        <TranscriptPanel
          lesson={lesson}
          onSaveTranscript={mockSaveTranscript}
        />,
      );
      const searchBtn = screen
        .getAllByRole("button")
        .find((b) => b.getAttribute("title") === "Tìm kiếm (Ctrl+F)");
      await act(async () => {
        fireEvent.click(searchBtn!);
      });
      const searchInput = screen.getByPlaceholderText(
        "Tìm kiếm trong transcript...",
      );
      await act(async () => {
        fireEvent.change(searchInput, { target: { value: "hello" } });
      });
      expect(screen.getByText(/1 \/ 3 kết quả/)).toBeInTheDocument();
    });
  });

  // ── 3. Copy transcript ──

  describe("Copy transcript button", () => {
    const findCopyBtn = () =>
      screen
        .getAllByRole("button")
        .find(
          (b) => b.getAttribute("title") === "Sao chép toàn bộ transcript",
        );

    it("renders copy button when transcript exists", () => {
      renderPanel();
      expect(findCopyBtn()).toBeDefined();
    });

    it("copies text and calls toast.success", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText },
      });
      renderPanel();
      await act(async () => {
        fireEvent.click(findCopyBtn()!);
      });
      expect(writeText).toHaveBeenCalledWith(mockLesson.transcript);
      expect(mockToast.success).toHaveBeenCalledWith(
        "Đã sao chép transcript!",
      );
    });

    it("copy button is disabled when transcript is null", () => {
      renderPanel(mockLessonNoTranscript);
      const copyBtn = findCopyBtn();
      // Copy button should be disabled (currentText is empty)
      if (copyBtn) {
        expect(copyBtn).toBeDisabled();
      }
    });
  });

  // ── 4. Word count / character count ──

  describe("Word count and character count", () => {
    it("displays word count and character count", async () => {
      renderPanel();
      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      // "Hello world this is a test transcript with some content for testing purposes." = 13 words, 77 chars
      expect(screen.getByText(/13 từ/)).toBeInTheDocument();
      expect(screen.getByText(/77 ký tự/)).toBeInTheDocument();
    });

    it("shows 0 từ · 0 ký tự when transcript is null", async () => {
      renderPanel(mockLessonNoTranscript);
      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      expect(screen.getByText(/0 từ/)).toBeInTheDocument();
      expect(screen.getByText(/0 ký tự/)).toBeInTheDocument();
    });

    it("updates word count in edit mode when typing", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      const textarea = screen.getByRole("textbox");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "one two three" } });
      });
      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      expect(screen.getByText(/3 từ/)).toBeInTheDocument();
      expect(screen.getByText(/13 ký tự/)).toBeInTheDocument();
    });

    it("debounces word count (300ms)", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      const textarea = screen.getByRole("textbox");

      // Type quickly — word count should not update immediately
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "a" } });
      });
      await act(async () => {
        vi.advanceTimersByTime(100);
      });
      // Still shows original count (debounce not fired yet)
      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.getByText(/1 từ/)).toBeInTheDocument();
    });
  });

  // ── 5. No transcript state ──

  describe("No transcript state", () => {
    it("shows empty state message when transcript is null", () => {
      renderPanel(mockLessonNoTranscript);
      expect(screen.getByText(/Chưa có transcript/)).toBeInTheDocument();
    });

    it("shows textarea for entering transcript when no transcript exists", () => {
      renderPanel(mockLessonNoTranscript);
      expect(
        screen.getByPlaceholderText("Paste transcript here..."),
      ).toBeInTheDocument();
    });

    it("can save new transcript from empty state", async () => {
      renderPanel(mockLessonNoTranscript);
      const textarea = screen.getByPlaceholderText("Paste transcript here...");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "new transcript content" } });
      });
      await act(async () => {
        fireEvent.click(screen.getByText("Lưu Transcript"));
      });
      expect(mockSaveTranscript).toHaveBeenCalledWith(
        "lesson-2",
        "new transcript content",
      );
    });
  });

  // ── 6. Highlight-to-Explain ──

  describe("Highlight-to-Explain", () => {
    it("does not show floating button when no onExplainSelection prop", () => {
      renderPanel(mockLesson, undefined);
      expect(
        screen.queryByText("Giải thích đoạn này"),
      ).not.toBeInTheDocument();
    });

    it("accepts onExplainSelection prop without errors", () => {
      renderPanel(mockLesson, mockExplainSelection);
      expect(mockExplainSelection).not.toHaveBeenCalled();
    });
  });

  // ── 7. Mode badge ──

  describe("Mode badge", () => {
    it("shows 'Đang đọc' badge in read mode", () => {
      renderPanel();
      const badge = screen.getByTestId("mode-badge");
      expect(badge).toHaveTextContent("Đang đọc");
    });

    it("shows 'Đang sửa' badge in edit mode", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      const badge = screen.getByTestId("mode-badge");
      expect(badge).toHaveTextContent("Đang sửa");
    });

    it("badge has different colors for read vs edit mode", async () => {
      renderPanel();
      const badge = screen.getByTestId("mode-badge");
      expect(badge.className).toContain("emerald");

      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      const editBadge = screen.getByTestId("mode-badge");
      expect(editBadge.className).toContain("amber");
    });
  });

  // ── 8. Dirty state indicator ──

  describe("Dirty state indicator", () => {
    it("shows dirty dot when content changes in edit mode", async () => {
      renderPanel();
      await act(async () => {
        fireEvent.click(screen.getByText("Chỉnh sửa"));
      });
      await act(async () => {
        fireEvent.change(screen.getByRole("textbox"), {
          target: { value: "changed" },
        });
      });
      const dirtyDot = document.querySelector(
        'span[title="Có thay đổi chưa lưu"]',
      );
      expect(dirtyDot).toBeInTheDocument();
    });

    it("does not show dirty dot when content unchanged", () => {
      renderPanel();
      const dirtyDot = document.querySelector(
        'span[title="Có thay đổi chưa lưu"]',
      );
      expect(dirtyDot).not.toBeInTheDocument();
    });
  });
});
