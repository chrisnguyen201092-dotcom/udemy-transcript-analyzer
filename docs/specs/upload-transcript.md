# Spec: Upload File Transcript

## Goal
Cho phép người dùng upload một hoặc nhiều file transcript (`.vtt`, `.srt`, `.txt`) từ máy tính để tạo bài học mới trong khóa học đang chọn — không cần tài khoản Udemy.

## User Stories
- Là học viên, tôi muốn upload file `.vtt` từ máy tính để tạo bài học mà không cần Udemy
- Là học viên, tôi muốn upload nhiều file cùng lúc để tạo nhiều bài học nhanh chóng
- Là học viên, tôi muốn hệ thống tự parse timestamp ra khỏi `.vtt`/`.srt` để transcript sạch hơn

## Acceptance Criteria
- [ ] Người dùng click "Upload file" → `UploadModal` mở ra
- [ ] Người dùng chọn một hoặc nhiều file `.vtt`, `.srt`, `.txt`; định dạng khác bị từ chối
- [ ] File được đọc client-side bằng `FileReader` → nội dung gửi lên server dưới dạng JSON (không multipart)
- [ ] Server parse `.vtt`/`.srt`: loại bỏ header, timestamp lines, sequence numbers, deduplicate dòng trùng liên tiếp
- [ ] Server xử lý `.txt`: dùng nguyên nội dung, không parse
- [ ] Tên bài học mới = tên file không có extension (ví dụ: `lecture-01.vtt` → `lecture-01`)
- [ ] Mỗi file tạo ra một bài học riêng trong khóa học đang chọn với `order` = max + 1
- [ ] Sau khi upload xong → modal đóng, bài học mới xuất hiện trong sidebar

## Edge Cases
- Không có khóa học nào được chọn → nút Upload bị disable hoặc hiển thị thông báo "Chọn khóa học trước"
- File quá lớn (> 5MB) → cảnh báo trước khi gửi; giới hạn mềm (không block)
- File `.vtt` không đúng định dạng WebVTT → fallback: lưu nguyên văn bản, không crash
- File `.srt` không đúng định dạng SRT → fallback: lưu nguyên văn bản
- Upload nhiều file → xử lý tuần tự (không parallel) để tránh race condition với `order`
- Tên file trùng với bài học đã có → tạo bài học mới bình thường (không upsert — không check trùng tên)

## API Contract

### POST /api/courses/upload
**Request:**
```json
{
  "courseId": "string",
  "files": [
    {
      "name": "string",
      "content": "string",
      "format": "vtt | srt | txt"
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
      "order": "number"
    }
  ],
  "errors": [
    {
      "fileName": "string",
      "reason": "string"
    }
  ]
}
```
> **Partial success:** Response luôn trả 200 kể cả khi một số file bị lỗi. `created` chứa các file thành công, `errors` chứa các file thất bại với lý do. Client phải hiển thị lỗi cho từng file thất bại, không báo "thành công" chung chung.
**Errors:**
- `400` — `courseId` bị thiếu, `files` rỗng, định dạng file không hợp lệ
- `404` — course not found
- `500` — lỗi parse hoặc lưu DB (toàn bộ batch fail, không phải partial)

## Data Model Changes
Không có thay đổi schema. Bài học mới được tạo vào bảng `Lesson` với:
- `transcript` = nội dung đã parse
- `order` = `MAX(order) + 1` trong khóa học đó (hoặc 1 nếu chưa có bài nào)

## UI Notes
- `UploadModal`: drag-and-drop hoặc click để chọn file, hiển thị danh sách file đã chọn trước khi upload
- Hiển thị trạng thái upload từng file (uploading / done / error)
- File được chọn có thể xóa khỏi danh sách trước khi bấm Upload
- Nút Upload bị disable khi không có file nào được chọn

## Parse Logic

### VTT
```
1. Bỏ dòng "WEBVTT" header
2. Bỏ dòng timestamp (pattern: `HH:MM:SS.mmm --> HH:MM:SS.mmm`)
3. Bỏ dòng sequence numbers (chỉ số)
4. Bỏ dòng trống
5. Deduplicate: loại bỏ dòng text trùng với dòng ngay trước
6. Join bằng "\n"
```

### SRT
```
1. Bỏ dòng sequence numbers
2. Bỏ dòng timestamp (pattern: `HH:MM:SS,mmm --> HH:MM:SS,mmm`)
3. Bỏ dòng trống
4. Deduplicate: loại bỏ dòng text trùng với dòng ngay trước
5. Join bằng "\n"
```

### TXT
```
Dùng nguyên nội dung, trim whitespace đầu/cuối
```
