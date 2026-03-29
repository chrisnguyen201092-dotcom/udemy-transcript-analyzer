# PRD: Udemy Learner

> **Loại tài liệu:** Product Requirements Document  
> **Phiên bản:** 1.0  
> **Ngày:** 2026-03-30  
> **Trạng thái:** Đã triển khai (documenting what exists)

---

## 1. Tổng quan sản phẩm

**Udemy Learner** là một ứng dụng web hỗ trợ học viên Udemy học hiệu quả hơn nhờ AI. Ứng dụng cho phép import khóa học từ tài khoản Udemy, xem và chỉnh sửa transcript của từng bài học, rồi dùng AI để tóm tắt, giải thích sâu, và chat trực tiếp về nội dung bài học.

Mục tiêu cốt lõi: **biến transcript thô thành kiến thức có cấu trúc**, giúp học viên nắm bài nhanh hơn và sâu hơn.

---

## 2. Vấn đề cần giải quyết

Học viên Udemy gặp một số rào cản phổ biến:

- Transcript bài học thường dài, rời rạc, khó đọc lại
- Không có công cụ tóm tắt hay giải thích nội dung theo nhu cầu
- Phải chuyển qua lại nhiều tab để tra cứu khi học
- Không thể hỏi đáp tương tác với nội dung khóa học

**Udemy Learner** giải quyết tất cả vấn đề này trong một giao diện duy nhất.

---

## 3. Đối tượng người dùng

| Nhóm | Mô tả |
|------|-------|
| **Học viên kỹ thuật** | Lập trình viên, data scientist học khóa Udemy để nâng kỹ năng |
| **Self-learner** | Người tự học có tài khoản Udemy, muốn học có hệ thống hơn |
| **Developer tự dùng** | Người cài ứng dụng local để dùng riêng với API key của mình |

**Điều kiện tiên quyết:** Người dùng phải có tài khoản Udemy hợp lệ và API key từ một nhà cung cấp tương thích OpenAI.

---

## 4. Mục tiêu sản phẩm

1. Import và lưu trữ khóa học Udemy cùng transcript một cách tự động
2. Cung cấp 3 chế độ AI hỗ trợ học: Summary, Explain, Chat
3. Cho phép quản lý thủ công khi không dùng API Udemy
4. Chạy hoàn toàn local, không phụ thuộc backend bên ngoài ngoài AI provider

---

## 5. Phạm vi (Scope)

### In Scope

- Import khóa học và transcript qua Udemy access token
- Quản lý khóa học và bài học thủ công (CRUD)
- Xem và chỉnh sửa transcript từng bài học
- AI Summary: tóm tắt bài học theo chuẩn giáo học pháp
- AI Explain: giải thích sâu bằng kỹ thuật Feynman
- AI Chat: chat nhiều lượt có streaming với context bài học
- Cấu hình AI provider (base URL, API key, model)
- Giao diện hoàn toàn bằng tiếng Việt

### Out of Scope

- Xem video trực tiếp từ Udemy
- Đồng bộ tiến độ học lên Udemy
- Multi-user / authentication hệ thống
- Mobile app (chỉ web)
- Lưu lịch sử chat giữa các phiên
- Xuất nội dung ra PDF/Word

---

## 6. Yêu cầu chức năng

### 6.1 Module: Import & Quản lý khóa học

| ID | Yêu cầu |
|----|---------|
| F-01 | Người dùng nhập `access_token` cookie từ Udemy để xác thực |
| F-02 | Hệ thống gọi Udemy API lấy danh sách khóa học đã enroll |
| F-03 | Người dùng chọn khóa học cần import |
| F-04 | Hệ thống tự động import curriculum (danh sách bài học) và transcript |
| F-05 | Người dùng có thể thêm khóa học thủ công bằng URL và tiêu đề |
| F-06 | Người dùng có thể xóa khóa học (xóa cả lessons liên quan) |
| F-07 | Danh sách khóa học hiển thị trong sidebar, sắp xếp theo thứ tự thêm vào |

### 6.2 Module: Quản lý bài học

| ID | Yêu cầu |
|----|---------|
| F-08 | Người dùng có thể thêm bài học thủ công vào khóa học |
| F-09 | Bài học hiển thị trong sidebar theo thứ tự (`order`) |
| F-10 | Chọn bài học để xem nội dung transcript trong panel chính |

### 6.3 Module: Transcript

| ID | Yêu cầu |
|----|---------|
| F-11 | Transcript tự động được import từ Udemy khi import khóa học |
| F-12 | Người dùng có thể xem transcript của từng bài học |
| F-13 | Người dùng có thể chỉnh sửa transcript và lưu lại |

### 6.4 Module: AI Summary

| ID | Yêu cầu |
|----|---------|
| F-14 | Người dùng nhấn nút Summary để tạo tóm tắt bài học |
| F-15 | AI đóng vai Instructional Designer, dùng Bloom's Taxonomy để cấu trúc output |
| F-16 | Output tối thiểu 600 từ, có thể lên tới 2500+ từ tùy nội dung |
| F-17 | Hỗ trợ ASR degradation handling (transcript bị nhận dạng sai vẫn hoạt động) |
| F-18 | Hỗ trợ code-switching (transcript trộn tiếng Anh/Việt) |

### 6.5 Module: AI Explain

| ID | Yêu cầu |
|----|---------|
| F-19 | Người dùng nhấn nút Explain để nhận giải thích sâu về bài học |
| F-20 | AI áp dụng Feynman Technique: giải thích như dạy người mới |
| F-21 | Hệ thống tự phân loại Format A (nhiều code), Format B (nhiều lý thuyết), hoặc Hybrid dựa trên % code trong transcript |
| F-22 | Output tối thiểu 800 từ, có thể lên tới 3500+ từ |

### 6.6 Module: AI Chat

| ID | Yêu cầu |
|----|---------|
| F-23 | Người dùng chat nhiều lượt với AI về nội dung bài học hiện tại |
| F-24 | Streaming response: text xuất hiện dần, không chờ full response |
| F-25 | AI đóng vai tutor, nhận diện loại câu hỏi và điều chỉnh cách trả lời |
| F-26 | Context bài học (transcript) được đưa vào mỗi turn của chat |

### 6.7 Module: AI Settings

| ID | Yêu cầu |
|----|---------|
| F-27 | Người dùng cấu hình base URL của AI provider (bất kỳ endpoint tương thích OpenAI) |
| F-28 | Người dùng nhập API key |
| F-29 | Hệ thống tự fetch danh sách model từ provider và hiển thị dropdown |
| F-30 | Người dùng chọn model để dùng cho tất cả AI features |

---

## 7. Yêu cầu phi chức năng

### 7.1 Performance

| Yêu cầu | Mục tiêu |
|---------|---------|
| Import khóa học | Hoàn thành trong vòng 30 giây với khóa học trung bình (50 bài) |
| AI Summary/Explain | First token xuất hiện trong vòng 3 giây |
| Chat streaming | Latency cảm nhận thấp nhờ streaming, không block UI |
| Load danh sách khóa học | Dưới 500ms từ SQLite local |

### 7.2 Security

| Yêu cầu | Chi tiết |
|---------|---------|
| Access token | Không lưu vào database, chỉ dùng trong phiên import |
| API key | Lưu client-side (localStorage hoặc cấu hình), không gửi lên server ngoài |
| SQLite | Database local, không expose qua network |
| CORS | Chỉ gọi API Udemy từ server-side để tránh CORS |

### 7.3 UX

| Yêu cầu | Chi tiết |
|---------|---------|
| Ngôn ngữ giao diện | Hoàn toàn tiếng Việt |
| Responsive | Tối ưu cho desktop (màn hình 1280px+) |
| Feedback trực quan | Loading states rõ ràng cho mọi thao tác AI |
| Error handling | Hiển thị thông báo lỗi rõ ràng khi API fail |

### 7.4 Maintainability

- Prompt architecture dùng DRY pattern: shared ASR rule builder và language rule builder
- TypeScript strict mode trên toàn bộ codebase
- Prisma schema làm single source of truth cho data model

---

## 8. Kiến trúc kỹ thuật

### 8.1 Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | Next.js 16, App Router, React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Prisma ORM + SQLite (local file) |
| AI Integration | OpenAI SDK (compatible với mọi OpenAI-compatible provider) |
| Language | TypeScript |

### 8.2 Data Model

```prisma
model Course {
  id        String   @id @default(cuid())
  url       String
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lessons   Lesson[]
}

model Lesson {
  id         String   @id @default(cuid())
  courseId   String
  title      String
  order      Int
  transcript String?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  course     Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
}
```

### 8.3 API Routes

| Method | Endpoint | Chức năng |
|--------|----------|-----------|
| POST | `/api/udemy/courses` | Lấy danh sách khóa học đã enroll từ Udemy |
| POST | `/api/udemy/import` | Import khóa học, lessons, transcripts |
| GET | `/api/courses` | Lấy tất cả khóa học |
| POST | `/api/courses` | Tạo khóa học mới |
| GET | `/api/courses/[id]` | Lấy chi tiết khóa học |
| DELETE | `/api/courses/[id]` | Xóa khóa học |
| POST | `/api/courses/[id]/lessons` | Thêm bài học vào khóa học |
| PUT | `/api/lessons/[id]/transcript` | Cập nhật transcript |
| POST | `/api/ai/summary` | Tạo AI summary |
| POST | `/api/ai/explain` | Tạo AI explanation |
| POST | `/api/ai/chat` | Streaming chat (Server-Sent Events) |
| POST | `/api/ai/models` | Lấy danh sách model từ provider |

### 8.4 UI Architecture

Ứng dụng là single-page với layout 2 cột:

```
┌─────────────────────────────────────────────────┐
│  Header (tên app + Settings button)             │
├──────────────┬──────────────────────────────────┤
│  Sidebar     │  Main Content                   │
│  - CourseList│  - TranscriptPanel              │
│  - LessonList│  - AIAssistantPanel             │
│  - AddCourse │    (Summary | Explain | Chat)   │
└──────────────┴──────────────────────────────────┘
```

**Components chính:**
- `Header` — thanh navigation + mở Settings
- `AddCoursePanel` — form thêm khóa học thủ công + nút import Udemy
- `CourseList` — danh sách khóa học, select active
- `LessonList` — danh sách bài học của khóa học đang chọn
- `TranscriptPanel` — hiển thị và edit transcript
- `AIAssistantPanel` — 3 tab: Summary, Explain, Chat
- `SettingsModal` — cấu hình AI provider
- `ImportModal` — nhập access token và chọn khóa học

**shadcn/ui primitives dùng:** `button`, `dialog`, `input`, `label`, `select`, `textarea`, `badge`, `alert-dialog`, `scroll-area`, `separator`

---

## 9. User Flows

### Flow 1: Import khóa học từ Udemy

```
1. Người dùng mở ứng dụng
2. Click "Import từ Udemy"
3. Nhập access_token cookie từ Udemy
4. Hệ thống gọi POST /api/udemy/courses → hiển thị danh sách
5. Người dùng chọn khóa học muốn import
6. Hệ thống gọi POST /api/udemy/import → lưu vào SQLite
7. Khóa học và bài học xuất hiện trong sidebar
```

### Flow 2: Dùng AI Summary

```
1. Người dùng chọn khóa học → chọn bài học
2. Transcript hiển thị ở panel chính
3. Người dùng click tab "Summary" trong AI panel
4. Click nút "Tạo tóm tắt"
5. Hệ thống gọi POST /api/ai/summary với transcript
6. Kết quả hiển thị, có thể cuộn đọc
```

### Flow 3: Chat với AI về bài học

```
1. Người dùng chọn bài học có transcript
2. Click tab "Chat" trong AI panel
3. Nhập câu hỏi về nội dung bài học
4. Hệ thống gửi POST /api/ai/chat với lịch sử chat + transcript
5. Response stream dần vào giao diện
6. Người dùng tiếp tục hỏi trong cùng session
```

### Flow 4: Cấu hình AI provider

```
1. Click icon Settings trên Header
2. SettingsModal mở ra
3. Nhập base URL của provider (ví dụ: https://api.openai.com/v1)
4. Nhập API key
5. Hệ thống gọi POST /api/ai/models → load dropdown model
6. Người dùng chọn model
7. Lưu → Settings đóng lại
```

---

## 10. Rủi ro và giải pháp

| Rủi ro | Mức độ | Giải pháp |
|--------|--------|-----------|
| Udemy thay đổi API / cookie format | Trung bình | Import thủ công vẫn hoạt động như fallback |
| Access token hết hạn khi import | Thấp | Thông báo lỗi rõ ràng, yêu cầu token mới |
| Transcript chất lượng kém (ASR noise) | Cao | Prompt có ASR degradation handling tích hợp sẵn |
| AI provider không tương thích hoàn toàn | Trung bình | Test với OpenAI, Groq, Ollama; document known issues |
| SQLite corrupted | Thấp | Backup database file định kỳ (manual) |
| Context window vượt quá giới hạn model | Trung bình | Transcript dài bị truncate trước khi gửi AI |

---

## 11. Roadmap / Phiên bản

### v1.0 — Đã triển khai (hiện tại)

- Import khóa học từ Udemy qua access token
- Quản lý khóa học và bài học thủ công
- Xem và chỉnh sửa transcript
- AI Summary với Bloom's Taxonomy
- AI Explain với Feynman Technique
- AI Chat streaming với context bài học
- AI Settings: cấu hình provider, model
- Prompt quality: Oracle-scored 9.4/10
- DRY prompt architecture (shared rule builders)
- Giao diện tiếng Việt

### v1.x — Tiềm năng cải tiến (chưa triển khai)

> Phần này chỉ ghi nhận, không phải cam kết.

- Lưu lịch sử chat giữa các phiên
- Export summary/explain ra file Markdown
- Hỗ trợ nhiều ngôn ngữ giao diện
- PostgreSQL thay thế SQLite cho multi-user
- Tìm kiếm toàn văn qua transcripts

---

## 12. Tài liệu liên quan

| Tài liệu | Đường dẫn |
|----------|-----------|
| Prompt Engineering Guide | `docs/educational-prompt-engineering.md` |
| Prompts Design | `docs/PROMPTS_DESIGN.md` |
| Source code | https://github.com/chrisnguyen201092-dotcom/udemy-transcript-analyzer |
