# Spec: AI Chat

## Goal
Cho phép người dùng chat nhiều lượt với AI về nội dung bài học hiện tại, với response streaming, lịch sử chat được lưu vào DB, và chế độ Socratic để dẫn dắt tư duy thay vì trả lời thẳng.

## User Stories
- Là học viên, tôi muốn hỏi AI về điều tôi không hiểu trong bài mà không cần copy-paste transcript ra ngoài
- Là học viên, tôi muốn xem AI trả lời dần dần (streaming) thay vì chờ full response
- Là học viên, tôi muốn hỏi nhiều câu trong cùng một phiên mà AI vẫn nhớ ngữ cảnh
- Là học viên, tôi muốn quay lại bài học cũ và đọc lại cuộc trò chuyện trước đó
- Là học viên, tôi muốn AI dẫn dắt tôi tự tìm ra câu trả lời thay vì nói thẳng, để hiểu sâu hơn
- Là học viên, tôi muốn chọn giữa "AI trả lời thẳng" và "AI dẫn dắt suy nghĩ" tùy theo loại câu hỏi

## Acceptance Criteria
- [ ] Tab "Chat" hiển thị input box + lịch sử tin nhắn (load từ DB khi mở bài học)
- [ ] Người dùng nhập câu hỏi → hệ thống gọi `POST /api/ai/chat` với toàn bộ `messages` history + `transcript`
- [ ] Response được stream qua Server-Sent Events (SSE); text xuất hiện dần trong UI
- [ ] Sau khi stream xong → tin nhắn user + assistant được lưu vào DB (`ChatMessage`)
- [ ] Khi chuyển sang bài học khác → load lịch sử chat của bài học đó từ DB
- [ ] AI nhận diện 7 loại câu hỏi và điều chỉnh tone/style trả lời tương ứng
- [ ] Toggle "Chế độ Socratic" hiển thị rõ ràng trong UI chat panel
- [ ] Trạng thái toggle được lưu vào `localStorage` (per-lesson key: `socratic_mode_{lessonId}`)
- [ ] Khi Socratic mode bật: AI hỏi ngược lại, không trả lời thẳng (trừ sau 3 vòng vẫn chưa hiểu)
- [ ] Nút "Xóa lịch sử" gọi `DELETE /api/lessons/[id]/chat` và reset state UI
- [ ] Khi history > 10 turns (20 messages): hệ thống tự tóm tắt phần cũ, thay bằng system message tóm tắt

## Edge Cases
- Người dùng gửi khi stream đang chạy → nút Send bị disable trong lúc streaming
- Bài học không có transcript → chat vẫn hoạt động nhưng AI không có context bài học (thông báo trong system prompt)
- AI provider trả lỗi giữa stream → hiển thị thông báo lỗi, không crash UI; message đang stream bị discard, không lưu vào DB
- Message history quá dài (> 20 turns) → client trim bỏ messages cũ nhất (giữ system prompt + 10 turns gần nhất)
  > **[CLARIFICATION] Định nghĩa "turn":** 1 turn = 1 cặp user+assistant (2 messages). "10 turns gần nhất" = 20 messages. Cụ thể: khi `messages.length > 20`, bỏ cặp `[user, assistant]` cũ nhất cho đến khi còn ≤ 20 messages. System prompt không tính vào giới hạn này (system prompt được inject ở server-side, không có trong mảng `messages` client gửi lên).
- Model reasoning output `<think>` trong stream → client-side filter tag trước khi hiển thị
- Socratic mode với câu hỏi rất ngắn (1-3 từ, ví dụ "async là gì?") → AI vẫn áp dụng Socratic, hỏi lại "Bạn đã biết gì về bất đồng bộ chưa?" thay vì bỏ qua
- Lịch sử chat rất lớn (> 100 messages trong DB) → load lần đầu phân trang hoặc chỉ load 20 messages gần nhất, append ngược khi scroll lên
- DB write failure sau khi stream xong → log lỗi server-side, UI vẫn hiển thị message bình thường (không báo lỗi người dùng trừ khi cần); retry 1 lần trước khi bỏ qua
- Người dùng chuyển bài học giữa chừng khi stream đang chạy → hủy request stream cũ, load history bài học mới
- Khi tóm tắt history thất bại → giữ nguyên messages cũ, không replace bằng summary lỗi

## API Contract

### POST /api/ai/chat
**Request:**
```json
{
  "lessonId": "string",
  "message": "string (legacy single-message mode, optional)",
  "messages": [
    { "role": "user | assistant", "content": "string" }
  ],
  "socraticMode": "boolean (default: false)",
  "apiKey": "string",
  "baseUrl": "string",
  "model": "string"
}
```
> **Note:** Either `message` (single string) or `messages` (full history array) must be provided.  
> Transcript is **not sent by the client** — the server fetches it from the DB using `lessonId`.  
> `socraticMode: true` → server inject Socratic instruction vào system prompt.

**Response:** `text/plain` chunked stream (raw text delta, no SSE envelope)

**Errors (non-streaming):**
- `400` — thiếu `message`/`messages`, `lessonId` không tìm thấy transcript, hoặc `baseUrl` không hợp lệ
- `500` — AI provider error

---

### GET /api/lessons/[id]/chat
Load lịch sử chat của một bài học.

**Response:**
```json
{
  "messages": [
    {
      "id": "string",
      "role": "user | assistant | system",
      "content": "string",
      "createdAt": "ISO 8601 datetime"
    }
  ]
}
```
> Trả về tối đa 50 messages gần nhất, sắp xếp theo `createdAt` tăng dần. Messages có `role: "system"` là summary messages.

---

### DELETE /api/lessons/[id]/chat
Xóa toàn bộ lịch sử chat của một bài học.

**Response:** `204 No Content`

**Errors:**
- `404` — lessonId không tồn tại

## Data Model Changes

Thêm model `ChatMessage` vào `prisma/schema.prisma`:

```prisma
model ChatMessage {
  id        String   @id @default(cuid())
  lessonId  String
  lesson    Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  role      String   // "user" | "assistant" | "system"
  content   String
  createdAt DateTime @default(now())
}
```

> Cần thêm relation ngược vào model `Lesson`:  
> `chatMessages ChatMessage[]`

**Migration:** Chạy `npx prisma db push` sau khi cập nhật schema.

**Lưu ý:**
- Messages được lưu theo từng bài học (`lessonId`)
- `role: "system"` dùng cho summary messages (khi history > 10 turns)
- `onDelete: Cascade` đảm bảo xóa bài học → xóa toàn bộ chat history của bài đó
- Không có foreign key đến User vì đây là ứng dụng single-user

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

### Socratic Mode Prompt (khi `socraticMode: true`)
Inject thêm vào system prompt đoạn instruction sau:

```
## Chế độ Dẫn dắt Tư duy (Socratic Mode)

Thay vì trả lời thẳng, hãy dẫn dắt người học tự tìm ra câu trả lời theo quy trình:

1. **Phân tích lỗ hổng:** Xác định người học đang thiếu hiểu biết ở điểm nào dựa trên câu hỏi của họ.
2. **Đặt câu hỏi dẫn dắt:** Hỏi 1 câu hỏi ngắn, cụ thể để kích thích suy nghĩ. KHÔNG cho đáp án.
3. **Dựa trên phản hồi:** Nếu người học trả lời đúng hướng → khen ngắn + hỏi câu tiếp theo. Nếu lạc hướng → gợi ý thêm mà không lộ đáp án.
4. **Sau 3 vòng hỏi-đáp mà người học vẫn chưa hiểu:** Chuyển sang giải thích trực tiếp, đầy đủ.

Ví dụ:
- Người học hỏi: "Promise là gì?"
- AI KHÔNG trả lời: "Promise là đối tượng đại diện cho kết quả của một tác vụ bất đồng bộ..."
- AI NÊN hỏi: "Bạn đã gặp tình huống nào trong JavaScript mà code chạy xong trước khi kết quả trả về chưa?"
```

### Conversation Summary (khi history > 10 turns)
Khi số messages trong context vượt 20, server tự động gọi AI để tóm tắt:
- Gom tất cả messages cũ (trừ 6 messages gần nhất)
- Gọi AI tóm tắt thành 1 đoạn ngắn (< 300 tokens)
- Lưu summary vào DB với `role: "system"`, nội dung: `[TÓM TẮT CUỘC TRÒ CHUYỆN TRƯỚC] {summary}`
- Xóa các messages cũ đã được tóm tắt khỏi DB
- Tiếp tục conversation với: system summary + 6 messages gần nhất

## UI Notes
- Tab "Chat" trong `AIAssistantPanel`
- Chat bubbles: user (phải), assistant (trái)
- Auto-scroll xuống cuối sau mỗi message
- Input: `textarea` single/multiline, Enter gửi, Shift+Enter xuống dòng
- Toggle "Chế độ Socratic" (switch nhỏ) nằm ngay phía trên input box, kèm label ngắn:
  - Off: "Trả lời trực tiếp"
  - On: "Dẫn dắt suy nghĩ"
  - Tooltip giải thích: "Khi bật, AI sẽ hỏi ngược lại để bạn tự khám phá đáp án"
- Nút "Xóa lịch sử" để gọi DELETE API và reset state UI (có confirm dialog)
- Indicator "Đang trả lời..." trong khi stream
- Khi load bài học: skeleton loader trong khi fetch history từ DB
- Nếu history có summary message (role: system) → hiển thị dạng collapsed box: "--- Tóm tắt cuộc trò chuyện trước ---" (không hiển thị nội dung đầy đủ, click để xem)
