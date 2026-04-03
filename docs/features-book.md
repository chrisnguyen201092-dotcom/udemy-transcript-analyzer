# Danh sách Tính năng — Hỗ trợ Sách/Giáo trình (Book Support)

## Tổng quan

Mở rộng Udemy Learner từ "trợ lý học từ khóa Udemy" thành **"trợ lý học tập đa nguồn"** — hỗ trợ cả sách, giáo trình, tài liệu học tập bên cạnh khóa học video.

| Module | Tổng số tính năng | Ưu tiên | Trạng thái |
|--------|-------------------|---------|-----------|
| Schema & Content Type | 3 | Tier 1 — Nền tảng | 📋 |
| Upload Sách (PDF/EPUB/DOCX/TXT) | 5 | Tier 1 — Nền tảng | 📋 |
| Auto Chapter Splitting | 3 | Tier 2 — Trải nghiệm | 📋 |
| AI Prompt Adaptation cho Sách | 4 | Tier 1 — Nền tảng | 📋 |
| Key Concepts Extraction | 2 | Tier 2 — Trải nghiệm | ✅ Phase 5a |
| Reading Plan (Lộ trình đọc) | 2 | Tier 2 — Trải nghiệm | ✅ Phase 6 |
| Cross-reference giữa Chapters | 2 | Tier 3 — Nâng cao | ✅ Phase 6 |
| Knowledge Graph | 2 | Tier 3 — Nâng cao | 📋 |
| Adaptive Quizzing | 2 | Tier 3 — Nâng cao | 📋 |
| Multi-source Learning | 2 | Tier 3 — Nâng cao | 📋 |
| Study Plan Generator | 2 | Tier 3 — Nâng cao | ✅ Phase 6 |
| UI Adaptation | 4 | Tier 1 — Nền tảng | 📋 |
| Bug Fix: Upload URL Unique | 1 | Tier 0 — Prerequisite | 📋 |
| **Tổng cộng** | **32** | | **7/32 ✅** |

---

## Tier 0: Prerequisite (Bug Fix)

| ID | Tên tính năng | Mô tả | Module/Route liên quan |
|----|---------------|-------|------------------------|
| B-00 | Fix upload URL unique constraint | Upload route set `url: ""` khi tạo course mới → vi phạm unique constraint khi tạo 2+ course. Cần đổi thành `manual:{uuid}` | `POST /api/courses/upload` |

---

## Tier 1: Nền tảng (Minimum Viable Book Feature)

### Module: Schema & Content Type

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật |
|----|---------------|-------|-------------------|
| B-01 | Content type discriminator trên Course | Thêm field `contentType` vào model Course để phân biệt "course" vs "book" | `contentType String @default("course")`; non-breaking migration; backward compatible |
| B-02 | Metadata sách trên Course | Thêm fields `author`, `isbn`, `publisher` (nullable) cho metadata sách | Chỉ hiển thị khi `contentType === "book"` |
| B-03 | Chapter metadata trên Lesson | Thêm fields `chapterNumber`, `pageRange` (nullable) cho chương sách | Reuse Lesson model; chương sách = lesson với metadata bổ sung |

### Module: Upload Sách

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật |
|----|---------------|-------|-------------------|
| B-04 | Upload PDF | Upload file `.pdf`, server extract text từ từng trang | Library: `pdf-parse` hoặc `pdfjs-dist`; text extraction server-side |
| B-05 | Upload EPUB | Upload file `.epub`, server extract text từ từng chapter | Library: `epub2` hoặc tương tự; extract chapter structure |
| B-06 | Upload DOCX | Upload file `.docx`, server extract text có cấu trúc heading | Library: `mammoth`; preserve heading hierarchy |
| B-07 | Upload plain text (sách) | Upload `.txt` / `.md` chứa nội dung sách hoặc chương riêng lẻ | Reuse `parseTxt()` hiện tại; extend cho markdown heading detection |
| B-08 | Upload UI mở rộng | UploadModal thêm mode "Sách/Giáo trình"; chấp nhận `.pdf`, `.epub`, `.docx`, `.txt`, `.md`; hiển thị metadata form (tên sách, tác giả) | Extend `UploadModal` hoặc tạo `BookUploadModal` riêng |

### Module: AI Prompt Adaptation

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật |
|----|---------------|-------|-------------------|
| B-09 | Book-aware system prompts | Thay ASR degradation rules bằng book-specific context; đổi "bài học/khóa học" → "chương/sách" trong prompt | Extend `getSystemPrompt(type, contentType)`; parameterize context labels |
| B-10 | Summary prompt cho sách | Prompt tóm tắt chương sách: academic structure, key arguments, citations nếu có | Variant prompt: giữ Bloom's Taxonomy nhưng thêm academic framing |
| B-11 | Explain prompt cho sách | Prompt giải thích chương sách: Feynman Technique nhưng không giả định ASR noise | Remove ASR rules; thêm "text đã viết" context |
| B-12 | Quiz/Flashcard/Exercise prompt cho sách | Prompt luyện tập từ sách: reference page/section, academic terminology | Giữ cấu trúc quiz hiện tại; thêm academic context |

### Module: UI Adaptation

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật |
|----|---------------|-------|-------------------|
| B-13 | Conditional UI labels | Sidebar hiển thị "Sách" thay vì "Khóa học", "Chương" thay vì "Bài học" khi `contentType === "book"` | Conditional rendering dựa trên `course.contentType` |
| B-14 | Book icon / badge | Icon/badge phân biệt sách vs khóa học trong CourseList | shadcn Badge hoặc Lucide icon |
| B-15 | Book metadata display | Hiển thị tác giả, ISBN (nếu có) trong sidebar hoặc header khi chọn sách | Conditional section trong CourseList item |
| B-16 | Content panel label | TranscriptPanel hiển thị "Nội dung chương" thay vì "Transcript" khi content type là book | Conditional header text |

---

## Tier 2: Trải nghiệm nâng cao

### Module: Auto Chapter Splitting

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật |
|----|---------------|-------|-------------------|
| B-17 | PDF auto-split by heading | Upload 1 file PDF → hệ thống detect headings/chapter breaks → tự tạo Lesson[] cho mỗi chương | Heuristic: detect "Chapter X", heading font size, page breaks |
| B-18 | AI-assisted chapter detection | Nếu heuristic fail → gửi table of contents (hoặc đầu mỗi trang) cho AI detect chapter boundaries | AI call trước khi tạo lessons; user confirm boundaries |
| B-19 | Manual chapter confirmation UI | Sau auto-split → hiển thị preview chapters, user có thể merge/split/rename trước khi confirm | Modal step 2 sau upload: review chapter list |

### Module: Key Concepts Extraction

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật | Trạng thái |
|----|---------------|-------|-------------------|-----------|
| B-20 | Extract key concepts per chapter | AI extract thuật ngữ, định nghĩa, concepts quan trọng từ mỗi chương | Prompt mới; persist vào `Lesson.keyConcepts` (new field, nullable JSON string) | ✅ COMPLETE |
| B-21 | Glossary tổng hợp per book | Aggregate key concepts từ tất cả chapters → glossary toàn sách | Course-level; persist vào `Course.glossary` (new field) | ✅ COMPLETE |

### Module: Reading Plan (Lộ trình đọc)

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật | Trạng thái |
|----|---------------|-------|-------------------|-----------|
| B-22 | AI Reading Plan | Tương tự Roadmap nhưng cho sách: thứ tự đọc, chương quan trọng, chương có thể skip | Reuse `/api/ai/roadmap` route; adapt prompt cho book context | ✅ COMPLETE |
| B-23 | Difficulty estimation per chapter | AI đánh giá độ khó mỗi chương (beginner/intermediate/advanced) | Metadata thêm vào Reading Plan output | ✅ COMPLETE |

---

## Tier 3: Tính năng nâng cao

### Module: Cross-reference giữa Chapters

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật | Trạng thái |
|----|---------------|-------|-------------------|-----------|
| B-24 | Concept cross-reference | Khi concept X ở chương 3 liên quan đến concept Y ở chương 7 → AI detect và liên kết | Dựa trên key concepts extraction; AI match across chapters | ✅ COMPLETE |
| B-25 | "Xem thêm ở chương..." links | UI hiển thị links đến chương liên quan khi đọc nội dung hoặc giải thích | Inline links trong AI output hoặc sidebar panel | ✅ COMPLETE |

### Module: Knowledge Graph

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật |
|----|---------------|-------|-------------------|
| B-26 | Generate knowledge graph data | AI phân tích toàn sách → output nodes (concepts) + edges (relationships) | JSON output; persist vào Course level |
| B-27 | Visual knowledge graph | Render interactive graph: click node → jump to relevant chapter | Library: `react-force-graph` hoặc `d3`; new component |

### Module: Adaptive Quizzing

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật |
|----|---------------|-------|-------------------|
| B-28 | Difficulty-based quiz generation | Quiz khó hơn/dễ hơn dựa trên SRS performance history | Extend quiz prompt với performance data từ FlashcardReview |
| B-29 | Spaced repetition across chapters | SRS không chỉ per-lesson mà cross-chapter: ôn concept từ chương cũ | Extend SRS system; new "cross-chapter review" mode |

### Module: Multi-source Learning

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật |
|----|---------------|-------|-------------------|
| B-30 | Link chapter ↔ Udemy lesson | Liên kết 1 chương sách với 1 bài Udemy cùng chủ đề | Manual linking UI; new junction table hoặc metadata field |
| B-31 | Combined study view | Xem nội dung sách + video transcript cùng lúc cho 1 topic | Split view mới hoặc tab switching |

### Module: Study Plan Generator

| ID | Tên tính năng | Mô tả | Ghi chú kỹ thuật | Trạng thái |
|----|---------------|-------|-------------------|-----------|
| B-32 | Time-based study plan | "Tôi có 2 tuần" → AI tạo kế hoạch đọc theo ngày | Prompt mới; input: deadline + book chapters + difficulty | ✅ COMPLETE |
| B-33 | Progress-aware replanning | Cập nhật plan dựa trên progress thực tế (chapters đã đọc, quiz scores) | Input: CourseProgress + FlashcardReview data | ✅ COMPLETE |

---

## Thứ tự triển khai đề xuất

```
Tier 0 (ngay): B-00 (fix bug)
     ↓
Tier 1 (sprint 1, ~2-3 ngày):
  B-01 → B-02 → B-03 (schema)
  B-04 → B-05 → B-06 → B-07 → B-08 (upload)
  B-09 → B-10 → B-11 → B-12 (AI prompts)
  B-13 → B-14 → B-15 → B-16 (UI)
     ↓
Tier 2 (sprint 2, ~3-5 ngày):
  B-17 → B-18 → B-19 (chapter splitting)
  B-20 → B-21 (key concepts)
  B-22 → B-23 (reading plan)
     ↓
Tier 3 (sprint 3+, ~5-10 ngày):
  B-24 → B-25 (cross-reference)
  B-26 → B-27 (knowledge graph)
  B-28 → B-29 (adaptive quiz)
  B-30 → B-31 (multi-source)
  B-32 → B-33 (study plan)
```

## Rủi ro

| Risk | Tier | Severity | Mitigation |
|------|------|----------|------------|
| PDF text extraction chất lượng kém (scanned/image PDF) | 1 | High | Cho phép edit transcript sau upload; hiển thị warning cho scanned PDFs |
| EPUB structure không chuẩn | 1 | Medium | Fallback: treat whole EPUB as single chapter; allow manual split |
| Auto chapter splitting sai boundaries | 2 | Medium | Manual confirmation UI (B-19); always allow re-split |
| Sách quá dài vượt AI context window | 1 | Medium | Truncate strategy đã có (4000 chars/lesson); chapter splitting giúp chia nhỏ |
| Knowledge graph generation hallucination | 3 | Medium | User review/edit graph; base on extracted key concepts (B-20) |
| Multi-source linking phức tạp UX | 3 | Low | Start manual linking; auto-suggest later |
