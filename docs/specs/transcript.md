# Spec: Xem & Chỉnh sửa Transcript

## Goal
Cho phép người dùng xem transcript của bài học đang chọn và chỉnh sửa trực tiếp trong giao diện, sau đó lưu lại.

## User Stories
- Là học viên, tôi muốn xem toàn bộ transcript của bài học để đọc lại nội dung
- Là học viên, tôi muốn chỉnh sửa transcript bị lỗi (ASR noise) để AI hoạt động chính xác hơn
- Là học viên, tôi muốn lưu transcript đã chỉnh sửa mà không mất dữ liệu AI đã tạo

## Acceptance Criteria
- [ ] Khi chọn bài học → `TranscriptPanel` hiển thị `transcript` của bài học đó
- [ ] Nếu `transcript` là `null` → hiển thị trạng thái trống với hướng dẫn upload hoặc chỉnh sửa
- [ ] Transcript hiển thị trong `textarea` có thể chỉnh sửa
- [ ] Người dùng chỉnh sửa nội dung → click "Lưu" → hệ thống gọi `PUT /api/lessons/[id]/transcript`
- [ ] Sau khi lưu thành công → hiển thị toast/thông báo "Đã lưu"
- [ ] Transcript mới được dùng cho các tính năng AI tiếp theo trong cùng session

## Edge Cases
- Transcript rất dài (> 50,000 ký tự) → textarea vẫn hoạt động, không bị lỗi UI
- Người dùng thay đổi nội dung rồi chuyển sang bài học khác mà chưa lưu → không có warning hiện tại (acceptable v1)
- Lưu transcript rỗng → server chấp nhận (cho phép xóa trắng transcript)
- Save lỗi network → hiển thị thông báo lỗi, nội dung đã chỉnh sửa không bị mất (vẫn trong textarea)

## API Contract

### PUT /api/lessons/[id]/transcript
**Request:**
```json
{ "transcript": "string" }
```
**Response 200:**
```json
{
  "id": "string",
  "transcript": "string",
  "updatedAt": "string"
}
```
**Errors:**
- `400` — `transcript` field bị thiếu trong body (null/undefined, khác với chuỗi rỗng)
- `404` — lesson not found
- `500` — lỗi DB

## Data Model Changes
Không có thay đổi schema. Cập nhật field `transcript` trong bảng `Lesson`.

## UI Notes
- `TranscriptPanel`: layout full-height, textarea chiếm phần lớn không gian
- Nút "Lưu" ở góc trên phải panel, disable khi nội dung chưa thay đổi
- Khi transcript là null: hiển thị placeholder text "Chưa có transcript. Upload file hoặc nhập thủ công."
- Font monospace hoặc readable font cho textarea, line-height thoải mái để dễ đọc
