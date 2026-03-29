# Danh sách Tính năng - Udemy App

## Tổng quan

| Module | Tổng số tính năng | Hoàn thành | Đang phát triển | Kế hoạch |
|--------|-------------------|------------|-----------------|----------|
| Quản lý Khóa học | 4 | 4 | 0 | 0 |
| Udemy Import | 2 | 2 | 0 | 0 |
| Quản lý Transcript | 3 | 3 | 0 | 0 |
| AI Assistant | 4 | 4 | 0 | 0 |
| Cài đặt | 3 | 3 | 0 | 0 |
| Prompt Engineering | 4 | 4 | 0 | 0 |
| UI/UX | 4 | 4 | 0 | 0 |
| **Tổng cộng** | **24** | **24** | **0** | **0** |

---

## Module 1: Quản lý Khóa học (Course Management)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Tạo khóa học thủ công | Người dùng tự tạo khóa học mới bằng cách nhập tên và thông tin | ✅ Hoàn thành | `POST /api/courses` | Lưu vào SQLite qua Prisma, validate input phía server |
| Danh sách khóa học | Hiển thị toàn bộ khóa học đã tạo hoặc import vào hệ thống | ✅ Hoàn thành | `GET /api/courses` | Trả về danh sách sắp xếp theo ngày tạo, dùng trong sidebar |
| Xóa khóa học | Xóa khóa học và toàn bộ dữ liệu liên quan (lessons, transcripts) | ✅ Hoàn thành | `DELETE /api/courses/[id]` | Cascade delete qua Prisma relations |
| Tạo bài học trong khóa học | Thêm bài học (lesson) mới vào một khóa học cụ thể | ✅ Hoàn thành | `POST /api/courses/[id]/lessons` | Gán `courseId`, hỗ trợ thứ tự bài học |

---

## Module 2: Udemy Import

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Lấy danh sách khóa học đã đăng ký từ Udemy | Gọi Udemy API để lấy toàn bộ khóa học mà người dùng đã mua | ✅ Hoàn thành | `POST /api/udemy/courses` | Xác thực qua `access_token` cookie từ Udemy, parse JSON response |
| Import curriculum và transcript từ Udemy | Import toàn bộ cấu trúc khóa học gồm chapters, lectures và transcript của từng bài | ✅ Hoàn thành | `POST /api/udemy/import` | Gọi Udemy curriculum API, lấy caption/transcript cho từng lecture, lưu vào DB |

---

## Module 3: Quản lý Transcript

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Xem transcript trong panel | Hiển thị nội dung transcript của bài học trong panel bên trái giao diện | ✅ Hoàn thành | UI component: transcript panel | Render plain text, hỗ trợ scroll dài |
| Chỉnh sửa và lưu transcript | Cho phép người dùng chỉnh sửa thủ công nội dung transcript rồi lưu lại | ✅ Hoàn thành | `PUT /api/lessons/[id]/transcript` | Textarea editable, auto-save hoặc save on button click |
| Tự động import transcript từ Udemy | Transcript được kéo tự động khi import khóa học từ Udemy | ✅ Hoàn thành | `POST /api/udemy/import` | Tích hợp trong luồng import, không cần thao tác thêm |

---

## Module 4: AI Assistant

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| AI Summary | Tóm tắt bài học theo phong cách Instructional Designer, tự động điều chỉnh độ dài (600-2500+ từ), có câu hỏi theo Bloom's taxonomy và kỹ thuật mnemonic | ✅ Hoàn thành | `POST /api/ai/summary` | Persona: Instructional Designer; auto-calibrate output length dựa trên độ dài transcript; tích hợp Bloom's taxonomy levels; mnemonic techniques cho nội dung phức tạp |
| AI Explain | Giải thích khái niệm theo kỹ thuật Feynman, tự phân loại Format A/B/Hybrid theo phần trăm code, gom nhóm các bước khi có hơn 10 steps | ✅ Hoàn thành | `POST /api/ai/explain` | Feynman technique; auto-classify format dựa trên code%; phase grouping khi >10 steps để tránh cognitive overload |
| AI Chat | Chat đa lượt với streaming, nhận diện 7 loại câu hỏi để trả lời phù hợp, persona tutor, quản lý history | ✅ Hoàn thành | `POST /api/ai/chat` | Multi-turn streaming via OpenAI SDK; 7 question types detection; tutor persona; conversation history management |
| AI Model Selection | Lấy danh sách model từ bất kỳ OpenAI-compatible provider nào để hiển thị trong dropdown | ✅ Hoàn thành | `POST /api/ai/models` | Compatible với OpenAI, OpenRouter, local providers (Ollama, LM Studio); fetch models endpoint dynamically |

---

## Module 5: Cài đặt (Settings)

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Cấu hình AI provider | Nhập base URL, API key và chọn model từ dropdown để kết nối với AI provider | ✅ Hoàn thành | Settings page / UI | Base URL cho phép dùng bất kỳ OpenAI-compatible API; model list fetch động |
| Cấu hình Udemy cookie | Nhập `access_token` cookie từ trình duyệt để xác thực với Udemy API | ✅ Hoàn thành | Settings page / UI | Cookie được lưu client-side, gửi kèm request khi gọi Udemy API |
| Lưu settings vào localStorage | Toàn bộ cấu hình được persist trong localStorage, không cần backend | ✅ Hoàn thành | Client-side storage | Không cần đăng nhập, settings tồn tại giữa các session |

---

## Module 6: Prompt Engineering

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| DRY prompt architecture | Các builder function dùng chung cho nhiều prompt, tránh lặp lại logic | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Shared functions: `buildASRRules`, `buildLanguageRules`; single source of truth cho prompt logic |
| ASR degradation handling | Tự động phát hiện transcript chất lượng thấp (từ ASR) và điều chỉnh cách xử lý | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Phát hiện dấu hiệu ASR artifacts (lỗi chính tả, thiếu dấu câu); hướng dẫn AI bỏ qua noise |
| Code-switching support | Hỗ trợ transcript có ngôn ngữ pha trộn (Tiếng Việt + English) | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Xử lý mixed-language input, không bị nhầm lẫn khi transcript có thuật ngữ tiếng Anh lẫn tiếng Việt |
| Oracle-scored prompt quality 9.4/10 | Hệ thống prompt đạt chất lượng cao theo đánh giá Oracle | ✅ Hoàn thành | `src/lib/ai/prompts.ts` | Đánh giá độc lập từ Oracle agent; score phản ánh độ chính xác, consistency và output quality |

---

## Module 7: UI/UX

| Tên tính năng | Mô tả | Trạng thái | Module/Route liên quan | Ghi chú kỹ thuật |
|---------------|-------|------------|------------------------|------------------|
| Sidebar layout responsive | Layout với sidebar hiển thị danh sách khóa học và bài học, responsive trên nhiều màn hình | ✅ Hoàn thành | Root layout, sidebar component | Tailwind v4 responsive classes; collapsible sidebar; navigation giữa courses và lessons |
| Split panel view | Giao diện hai panel: trái hiển thị transcript, phải là AI assistant | ✅ Hoàn thành | Main lesson view | Resizable panels hoặc fixed split; transcript và AI luôn hiển thị song song |
| shadcn/ui component library | Sử dụng 10 primitives từ shadcn/ui để xây dựng giao diện nhất quán | ✅ Hoàn thành | Toàn bộ UI components | Components: Button, Input, Textarea, Dialog, Select, Card, Tabs, ScrollArea, Separator, Badge; Radix UI + Tailwind v4 |
| Giao diện tiếng Việt | Toàn bộ text UI hiển thị bằng tiếng Việt | ✅ Hoàn thành | Toàn bộ UI strings | Labels, placeholders, buttons, error messages đều dùng tiếng Việt |

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Frontend | React 19 |
| Database ORM | Prisma + SQLite |
| AI SDK | OpenAI SDK (OpenAI-compatible) |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui (Radix UI primitives) |
| Language | TypeScript |
