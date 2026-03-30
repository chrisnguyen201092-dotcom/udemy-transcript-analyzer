# Spec: Upload Sách/Giáo trình

## Goal

Cho phép người dùng upload sách hoặc giáo trình dưới dạng file `.pdf`, `.epub`, `.docx`, `.txt`, `.md` để tạo khóa học mới kiểu `book` — server tự động extract nội dung từng chương thành các bài học, kèm metadata sách (tên tác giả, ISBN, nhà xuất bản).

Covers: **B-04, B-05, B-06, B-07, B-08**

## User Stories

- Là học viên, tôi muốn upload file `.pdf` để hệ thống tự extract text thành các bài học, không cần nhập tay
- Là học viên, tôi muốn upload file `.epub` để từng chapter của sách tương ứng với một bài học riêng
- Là học viên, tôi muốn upload file `.docx` để cấu trúc heading được giữ nguyên khi extract
- Là học viên, tôi muốn upload file `.txt` hoặc `.md` chứa nội dung sách và hệ thống xử lý đúng
- Là học viên, tôi muốn nhập tên tác giả, ISBN và nhà xuất bản khi upload để dễ tìm lại sau này

## Acceptance Criteria

- [ ] Người dùng click "Upload từ file" → `UploadModal` hiển thị, có thể chuyển sang mode "Sách/Giáo trình"
- [ ] Trong mode sách, `UploadModal` chấp nhận `.pdf`, `.epub`, `.docx`, `.txt`, `.md`; định dạng khác bị từ chối kèm thông báo
- [ ] Mode sách hiển thị form metadata: tên sách (bắt buộc), tác giả (tùy chọn), ISBN (tùy chọn), nhà xuất bản (tùy chọn)
- [ ] File PDF/EPUB/DOCX được gửi lên server dưới dạng `multipart/form-data` (binary, không đọc client-side)
- [ ] File `.txt` và `.md` vẫn có thể gửi dưới dạng text (client-side `FileReader`), hoặc multipart tùy implementation
- [ ] Server extract text từ PDF bằng `pdf-parse` hoặc `pdfjs-dist`; tạo một Lesson duy nhất chứa toàn bộ text nếu không detect được chapter
- [ ] Server extract từng chapter của EPUB bằng `epub2`; mỗi chapter tạo ra một Lesson riêng
- [ ] Server extract text từ DOCX bằng `mammoth`, giữ cấu trúc heading; tạo Lesson theo heading H1/H2 nếu có, ngược lại tạo một Lesson duy nhất
- [ ] File `.txt`/`.md` được xử lý bằng `parseTxt()` mở rộng; nếu `.md` chứa heading `#` thì split theo heading thành các Lesson
- [ ] Course được tạo với `contentType = "book"` và các fields metadata được lưu vào `author`, `isbn`, `publisher`
- [ ] Mỗi chapter/lesson được tạo với `order` tăng dần, bắt đầu từ 1
- [ ] Sau upload xong → modal đóng, khóa học mới xuất hiện trong sidebar với icon/badge phân biệt sách
- [ ] Nút Upload bị disable khi chưa chọn file hoặc chưa nhập tên sách

## Edge Cases

- **PDF dạng scan/ảnh**: không có text extractable → tạo Lesson với `transcript = null`, hiển thị warning "PDF này có thể là ảnh scan, không extract được text. Bạn có thể nhập transcript thủ công."
- **File bị hỏng/corrupt**: `pdf-parse`, `epub2`, `mammoth` throw error → trả về lỗi `400` hoặc partial errors, không crash server
- **File quá lớn (> 50MB)**: từ chối trước khi upload bằng kiểm tra client-side; hiển thị thông báo "File quá lớn (giới hạn 50MB)"
- **EPUB không có cấu trúc chapter**: fallback tạo một Lesson duy nhất chứa toàn bộ nội dung sách
- **DOCX có bảng, hình ảnh, formatting phức tạp**: `mammoth` bỏ qua phần tử không hỗ trợ (ảnh, hình vẽ), chỉ giữ text và heading; không crash
- **File `.md` không có heading**: xử lý như `.txt` thông thường, tạo một Lesson duy nhất
- **Tên sách trùng**: tạo course mới bình thường (không check trùng tên)
- **Upload file binary (PDF/EPUB/DOCX) qua JSON**: bị từ chối — server chỉ chấp nhận multipart/form-data cho binary formats

## API Contract

### POST /api/books/upload

Endpoint riêng (không mở rộng `/api/courses/upload` vì cần multipart/form-data).

**Request** (Content-Type: `multipart/form-data`):
```
file         : File         — binary file (.pdf, .epub, .docx, .txt, .md)
title        : string       — tên sách (bắt buộc)
author       : string?      — tên tác giả (tùy chọn)
isbn         : string?      — mã ISBN (tùy chọn)
publisher    : string?      — tên nhà xuất bản (tùy chọn)
courseId     : string?      — nếu muốn thêm vào khóa học đã có thay vì tạo mới
```

**Response 200:**
```json
{
  "courseId": "string",
  "created": [
    {
      "id": "string",
      "title": "string",
      "order": "number"
    }
  ],
  "warnings": [
    {
      "type": "scanned_pdf | no_chapters | partial_extract",
      "message": "string"
    }
  ]
}
```

> **Partial success:** Nếu một số chapter extract thành công và một số thất bại, `created` chứa các chapter thành công; `warnings` chứa cảnh báo về các phần bị lỗi. Server không fail toàn bộ request nếu vẫn extract được ít nhất 1 chapter.

**Errors:**
- `400` — thiếu `title`, file không đúng định dạng, hoặc file bị hỏng hoàn toàn không extract được gì
- `413` — file vượt 50MB
- `404` — `courseId` không tồn tại (nếu có truyền)
- `500` — lỗi server không xác định

## Data Model Changes

Cần migration schema (không breaking — thêm fields nullable):

```prisma
model Course {
  // ... fields hiện tại ...
  contentType  String  @default("course")   // "course" | "book"
  author       String?
  isbn         String?
  publisher    String?
}

model Lesson {
  // ... fields hiện tại ...
  chapterNumber  Int?
  pageRange      String?   // ví dụ: "12-34"
}
```

- `contentType` mặc định là `"course"` — backward compatible, không ảnh hưởng dữ liệu cũ
- `author`, `isbn`, `publisher` nullable — chỉ có ý nghĩa khi `contentType === "book"`
- `chapterNumber`, `pageRange` nullable — gán khi extract từ EPUB (chapter index) hoặc PDF (page numbers)

## UI Notes

### Mode switch trong UploadModal
`UploadModal` mở rộng thêm switcher ở đầu dialog để chọn mode:
- **"Transcript"** (mặc định): flow hiện tại, chấp nhận `.vtt`, `.srt`, `.txt`
- **"Sách/Giáo trình"**: flow mới, chấp nhận `.pdf`, `.epub`, `.docx`, `.txt`, `.md`

Switcher có thể là hai nút tab (ví dụ: `Button` variant outline, active có background tím `#A435F0`).

### Form metadata sách
Khi mode "Sách/Giáo trình" được chọn, hiển thị thêm các input:
- **Tên sách** (required): placeholder "Ví dụ: Clean Code, Design Patterns..."
- **Tác giả** (optional): placeholder "Ví dụ: Robert C. Martin"
- **ISBN** (optional): placeholder "Ví dụ: 978-0132350884"
- **Nhà xuất bản** (optional): placeholder "Ví dụ: Prentice Hall"

Các input này chỉ hiển thị khi `!courseId` (tạo mới), vì nếu thêm vào khóa học đã có thì metadata đã được gán.

### Dropzone mở rộng
Khi mode sách, dropzone hiển thị:
```
.pdf, .epub, .docx, .txt, .md
```
(thay vì `.vtt, .srt, .txt` như hiện tại)

### Trạng thái upload
- File binary (PDF/EPUB/DOCX) không hiển thị preview text, chỉ hiển thị tên file và kích thước
- Sau khi upload xong, hiển thị số chapters được tạo: "Đã tạo 12 chương từ sách"
- Nếu có warning (scanned PDF...), hiển thị inline dưới kết quả với icon cảnh báo màu vàng

## Parse Logic

### PDF (B-04)
```
1. Nhận binary buffer từ multipart/form-data
2. Dùng pdf-parse để extract text từ tất cả pages
3. Nếu text rỗng hoặc < 100 ký tự → warning "scanned_pdf", tạo Lesson với transcript = ""
4. Ngược lại: tạo một Lesson duy nhất với toàn bộ text (chapter splitting là Tier 2 — B-17)
5. title của Lesson = tên file không có extension
```

### EPUB (B-05)
```
1. Nhận binary buffer từ multipart/form-data
2. Dùng epub2 để parse, lấy danh sách chapters
3. Mỗi chapter → một Lesson với title = chapter title (hoặc "Chapter N" nếu không có title)
4. Nếu EPUB không có chapters → tạo một Lesson duy nhất
5. chapterNumber = index (1-based)
```

### DOCX (B-06)
```
1. Nhận binary buffer từ multipart/form-data
2. Dùng mammoth để extract text kèm cấu trúc heading
3. Nếu có heading H1 → split theo H1, mỗi section → một Lesson
4. Nếu không có H1 nhưng có H2 → split theo H2
5. Nếu không có heading nào → tạo một Lesson duy nhất
6. Bảng, hình ảnh trong DOCX bị bỏ qua (mammoth.extractRawText hoặc tùy config)
```

### TXT / Markdown (B-07)
```
TXT:
  Dùng parseTxt() hiện tại — trim whitespace, tạo một Lesson duy nhất

Markdown:
  1. Detect xem có heading # không
  2. Nếu có: split theo heading H1 (#), mỗi section → một Lesson
     - title = nội dung heading (bỏ dấu #)
     - content = text phía dưới heading đó cho đến heading tiếp theo
  3. Nếu không có heading #: xử lý như TXT thông thường
```
