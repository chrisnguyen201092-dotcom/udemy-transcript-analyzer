# Spec: AI Chat

## Goal
Cho phép người dùng chat nhiều lượt với AI về nội dung bài học hiện tại, với response streaming và context transcript đầy đủ.

## User Stories
- Là học viên, tôi muốn hỏi AI về điều tôi không hiểu trong bài mà không cần copy-paste transcript ra ngoài
- Là học viên, tôi muốn xem AI trả lời dần dần (streaming) thay vì chờ full response
- Là học viên, tôi muốn hỏi nhiều câu trong cùng một phiên mà AI vẫn nhớ ngữ cảnh

## Acceptance Criteria
- [ ] Tab "Chat" hiển thị input box + lịch sử tin nhắn trong phiên hiện tại
- [ ] Người dùng nhập câu hỏi → hệ thống gọi `POST /api/ai/chat` với toàn bộ `messages` history + `transcript`
- [ ] Response được stream qua Server-Sent Events (SSE); text xuất hiện dần trong UI
- [ ] Sau khi stream xong → tin nhắn assistant được thêm vào history trong state
- [ ] Khi chuyển sang bài học khác → lịch sử chat reset về []
- [ ] AI nhận diện 7 loại câu hỏi và điều chỉnh tone/style trả lời tương ứng

## Edge Cases
- Người dùng gửi khi stream đang chạy → nút Send bị disable trong lúc streaming
- Bài học không có transcript → chat vẫn hoạt động nhưng AI không có context bài học (thông báo trong system prompt)
- AI provider trả lỗi giữa stream → hiển thị thông báo lỗi, không crash UI
- Message history quá dài (> 20 turns) → client trim bỏ messages cũ nhất (giữ system prompt + 10 turns gần nhất)
- Model reasoning output `<think>` trong stream → client-side filter tag trước khi hiển thị

## API Contract

### POST /api/ai/chat
**Request:**
```json
{
  "messages": [
    { "role": "user | assistant", "content": "string" }
  ],
  "transcript": "string",
  "settings": {
    "baseUrl": "string",
    "apiKey": "string",
    "model": "string"
  }
}
```
**Response:** Server-Sent Events stream
```
data: {"delta": "text chunk"}\n\n
data: [DONE]\n\n
```
**Errors (non-streaming):**
- `400` — thiếu `messages`
- `500` — AI provider error

## Data Model Changes
Không có thay đổi schema. Chat history **không persist** — chỉ tồn tại trong React state trong phiên làm việc.

## Prompt Architecture
- AI đóng vai **Tutor thông minh** với nhận thức về 7 loại câu hỏi:
  1. Câu hỏi khái niệm → giải thích + analogy
  2. Câu hỏi "tại sao" → reasoning + context
  3. Câu hỏi so sánh → table/list comparison
  4. Câu hỏi ví dụ → code/real-world example
  5. Câu hỏi debug → step-by-step diagnosis
  6. Câu hỏi mở rộng → "ngoài bài học, bạn có thể..."
  7. Câu hỏi không liên quan → redirect về bài học
- System prompt bao gồm toàn bộ transcript (truncate nếu quá dài)
- Think-tag suppression ở prompt-level; client-side regex filter trong stream

## UI Notes
- Tab "Chat" trong `AIAssistantPanel`
- Chat bubbles: user (phải), assistant (trái)
- Auto-scroll xuống cuối sau mỗi message
- Input: `textarea` single/multiline, Enter gửi, Shift+Enter xuống dòng
- Nút "Xóa chat" để reset history
- Indicator "Đang trả lời..." trong khi stream
