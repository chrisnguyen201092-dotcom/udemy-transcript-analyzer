# Spec: Tự động chia chương sách (Auto Chapter Splitting)

> **Tier:** 2 — Trải nghiệm nâng cao
> **Phụ thuộc:** Tier 1 book upload (B-01 đến B-08) phải hoàn thành trước
> **Features:** B-17, B-18, B-19

## Goal

Sau khi upload một file sách (PDF, EPUB, DOCX), hệ thống tự động phát hiện ranh giới chương và đề xuất danh sách chương. Người dùng xem lại, điều chỉnh (gộp/tách/đổi tên), rồi xác nhận — hệ thống tạo các bản ghi `Lesson` tương ứng, mỗi chương là một bài học.

## User Stories

- Là học viên, tôi muốn upload một file PDF và hệ thống tự phát hiện các chương, để tôi không phải tách thủ công từng phần.
- Là học viên, tôi muốn xem trước danh sách chương được phát hiện và chỉnh sửa nếu sai, trước khi hệ thống thực sự tạo bài học.
- Là học viên, tôi muốn hệ thống dùng AI để phát hiện chương khi phương pháp thông thường thất bại, để tôi không bị mắc kẹt với sách không có heading rõ ràng.
- Là học viên, tôi muốn gộp các chương quá ngắn lại với nhau, hoặc tách một chương thành nhiều phần nhỏ hơn.

## Acceptance Criteria

### B-17: Tự động chia theo heading (Heuristic)
- [ ] Sau khi upload PDF, hệ thống chạy heuristic để phát hiện ranh giới chương
- [ ] Heuristic nhận diện các pattern sau: regex `/^(chapter|chương|phần|part)\s+\d+/i`, thay đổi font size (PDF metadata), đánh số thứ tự (1., 1.1, 2.), page break markers
- [ ] Với EPUB: sử dụng cấu trúc chapter có sẵn từ spine/TOC; không cần heuristic
- [ ] Với DOCX: sử dụng heading styles (Heading 1, Heading 2) để xác định ranh giới
- [ ] Kết quả heuristic trả về danh sách chapters với `title`, `startPage`/`endPage`, `content`
- [ ] Nếu heuristic tìm được ít nhất 2 chương → chuyển sang bước B-19 (preview UI)
- [ ] Nếu heuristic thất bại (tìm được 0 hoặc 1 chương) → tự động chuyển sang B-18 (AI detection)

### B-18: AI hỗ trợ phát hiện chương
- [ ] Khi heuristic thất bại, hệ thống gửi table of contents (nếu có) hoặc tiêu đề các trang đầu cho AI
- [ ] AI trả về danh sách chapter boundaries dưới dạng JSON cấu trúc
- [ ] Hệ thống hiển thị cảnh báo rõ ràng rằng kết quả do AI đề xuất và cần người dùng xác nhận
- [ ] Nếu AI cũng thất bại (trả về lỗi hoặc JSON không hợp lệ) → fallback: coi toàn bộ sách là 1 chương duy nhất
- [ ] AI call không chạy nếu heuristic đã thành công (không lãng phí token)

### B-19: UI xác nhận chương thủ công
- [ ] Sau khi auto-split (heuristic hoặc AI), hiển thị modal bước 2 "Xem lại chương"
- [ ] Modal liệt kê tất cả chương được phát hiện: số thứ tự, tên chương, số trang/ước tính số từ
- [ ] Người dùng có thể đổi tên bất kỳ chương nào
- [ ] Người dùng có thể gộp chương: chọn 2 chương liền kề và nhấn "Gộp"
- [ ] Người dùng có thể xóa một chương (nội dung được gộp vào chương trước hoặc sau)
- [ ] Nút "Xác nhận" → tạo Lesson records theo danh sách đã duyệt
- [ ] Nút "Hủy" → quay lại bước upload, không tạo Lesson nào
- [ ] Sau khi xác nhận thành công → modal đóng, sidebar hiển thị danh sách chương mới

## Edge Cases

- **Sách không có chương rõ ràng:** Heuristic và AI đều thất bại → fallback tạo 1 Lesson duy nhất chứa toàn bộ nội dung; người dùng thấy thông báo "Không tìm thấy chương, đã tạo 1 bài học cho toàn bộ nội dung"
- **Chương lồng nhau (nested):** Heuristic chỉ detect cấp cao nhất (Heading 1 / Part / Chapter); bỏ qua sub-chapter (Heading 2, 1.1, 1.2) — không tạo Lesson cho sub-chapter
- **Chương quá ngắn (dưới 200 từ):** Hiển thị badge "Ngắn" kèm gợi ý "Gộp với chương liền kề" trong preview UI; không tự động gộp
- **Heading không nhất quán:** Ví dụ file dùng "Chapter 1" ở đầu nhưng "Phần 2" ở giữa → regex vẫn nhận diện được vì dùng alternation; font size fallback hỗ trợ thêm
- **AI hallucinate ranh giới:** AI trả về page number không tồn tại trong file → validate: nếu `startPage > totalPages` hoặc `endPage < startPage` → bỏ chapter đó, log warning; hiển thị cảnh báo trong preview UI
- **PDF dạng scan (không có text layer):** Text extraction trả về chuỗi rỗng hoặc rác → heuristic thất bại; AI cũng không có dữ liệu tốt → fallback 1 chương; hiển thị cảnh báo "PDF dạng scan, không thể tự chia chương"
- **EPUB có structure nhưng TOC trống:** Dùng spine order thay vì TOC để xác định thứ tự chapter
- **File rất lớn (500+ trang):** Giới hạn AI call: chỉ gửi tối đa 100 dòng đầu (headers/TOC) thay vì toàn bộ nội dung

## API Contract

### POST /api/books/split

Nhận nội dung sách đã extract và cấu hình splitting; trả về danh sách chapter được đề xuất.

**Request:**
```json
{
  "bookId": "string",
  "format": "pdf | epub | docx | txt",
  "content": "string (full extracted text)",
  "toc": "string | null (table of contents nếu có)",
  "pageHeaders": ["string"] | null,
  "splitConfig": {
    "useAI": false,
    "minChapterWords": 200
  }
}
```

**Response 200:**
```json
{
  "method": "heuristic | ai | fallback",
  "chapters": [
    {
      "index": 1,
      "title": "string",
      "startPage": 1,
      "endPage": 24,
      "wordCount": 3500,
      "content": "string"
    }
  ],
  "warnings": ["string"]
}
```

**Errors:**
- `400` — `bookId` bị thiếu, `format` không hợp lệ, `content` rỗng
- `404` — book not found
- `500` — lỗi khi gọi AI (chỉ khi `useAI: true`)

---

### POST /api/books/split/confirm

Xác nhận danh sách chapter đã được người dùng duyệt; tạo các bản ghi Lesson.

**Request:**
```json
{
  "bookId": "string",
  "chapters": [
    {
      "index": 1,
      "title": "string",
      "content": "string",
      "chapterNumber": 1,
      "pageRange": "1-24"
    }
  ]
}
```

**Response 200:**
```json
{
  "created": [
    {
      "id": "string",
      "title": "string",
      "order": 1,
      "chapterNumber": 1
    }
  ],
  "courseId": "string"
}
```

**Errors:**
- `400` — `bookId` bị thiếu, `chapters` rỗng hoặc không hợp lệ
- `404` — book not found
- `409` — book đã có Lesson (tránh tạo trùng) — phải xóa trước hoặc dùng endpoint riêng để re-split
- `500` — lỗi tạo DB records

---

### Tích hợp vào upload flow (phương án B)

Thay vì 2 endpoint riêng, có thể extend flow upload hiện tại thành multi-step:
- Bước 1: Upload file → extract text → run heuristic/AI split → trả về `splitPreview`
- Bước 2: Client hiển thị preview UI (B-19) → người dùng điều chỉnh
- Bước 3: Client gửi `splitConfirm` → server tạo Lessons

Phương án này phù hợp hơn nếu muốn tránh lưu tạm state giữa 2 request riêng biệt.

## Data Model Changes

Không thêm bảng mới. Sử dụng các fields đã có từ B-03:

```prisma
model Lesson {
  // ... fields hiện tại ...
  chapterNumber Int?    // Số thứ tự chương (1, 2, 3, ...)
  pageRange     String? // "1-24", "25-67", ...
}
```

Khi confirm chapter split, mỗi chương tạo 1 Lesson với:
- `title` = tên chương (sau khi người dùng đã chỉnh sửa nếu cần)
- `transcript` = nội dung text của chương
- `order` = index chương (1-based)
- `chapterNumber` = số chương (có thể khác `order` nếu người dùng đã gộp/xóa)
- `pageRange` = chuỗi "startPage-endPage" (nullable nếu không có thông tin trang)

## UI Notes

**Luồng đầy đủ:**
```
Upload file sách
      ↓
[Server] Extract text → Heuristic split
      ↓ (nếu thất bại)
[Server] AI-assisted detection
      ↓
Modal bước 2: "Xem lại chương" (B-19)
  - Danh sách chapters với tên, số trang, số từ
  - Badge "Ngắn" cho chapters dưới ngưỡng
  - Badge "AI đề xuất" nếu dùng AI detection
  - Nút Đổi tên / Gộp / Xóa cho mỗi chapter
  - Nút "Xác nhận" và "Hủy"
      ↓ (Xác nhận)
Tạo Lesson records → Đóng modal → Sidebar cập nhật
```

**Chi tiết component `ChapterPreviewModal`:**
- Hiển thị số chương phát hiện được và phương pháp dùng (heuristic / AI / fallback)
- Mỗi hàng chapter: số thứ tự, ô input tên (editable), badge số trang, badge số từ, nút hành động
- Khi chọn gộp: bôi đen 2 hàng liền kề → nút "Gộp 2 chương" xuất hiện floating
- Cảnh báo PDF scan hiển thị ở đầu modal với màu vàng (warning)
- Cảnh báo AI-detected hiển thị ở đầu modal với màu xanh (info)
- Loading state khi đang chạy AI detection (spinner + "Đang phân tích cấu trúc sách...")

## Logic Phát Hiện Chương (Heuristic)

### PDF
```
1. Extract full text với page markers
2. Với mỗi trang: kiểm tra dòng đầu tiên theo regex:
   /^(chapter|chương|phần|part)\s+\d+/i
3. Kiểm tra font size metadata: dòng có font size > 14pt → candidate heading
4. Kiểm tra numbered headings: /^\d+\.\s+[A-Z]/
5. Tổng hợp candidates → cluster theo trang → xác định boundaries
6. Fallback: page break sau khoảng trống dài (>3 dòng trống liên tiếp)
```

### EPUB
```
1. Parse spine order từ OPF manifest
2. Map spine items → chapter list (mỗi spine item = 1 chapter)
3. Lấy tên chapter từ TOC (toc.ncx hoặc nav.xhtml)
4. Fallback nếu TOC rỗng: dùng spine item filename làm tên
```

### DOCX
```
1. Parse XML với mammoth (đã có từ B-06)
2. Tìm các element có style "Heading 1" → chapter boundaries
3. Text giữa 2 Heading 1 liên tiếp = nội dung 1 chapter
4. Fallback: Heading 2 nếu không có Heading 1 nào
```

### TXT / Markdown
```
1. Với markdown: detect "# " (h1) làm chapter boundaries
2. Với plain text: detect dòng ALL CAPS ngắn (< 60 ký tự) làm title candidate
3. Fallback: chia đều theo số dòng (mỗi 500 dòng = 1 chapter)
```
