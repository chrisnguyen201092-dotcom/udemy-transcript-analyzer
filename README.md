# Udemy Learner

Trợ lý học tập AI cho khóa học Udemy. Ứng dụng giúp bạn tóm tắt bài học, giải thích khái niệm, luyện tập tương tác, và trò chuyện với AI dựa trên transcript của khóa học.

## Tính năng chính

- **Import khóa học** từ Udemy thông qua cookie xác thực
- **Tạo khóa học từ file cục bộ** — upload file `.vtt`, `.srt`, `.txt` để tự động tạo khóa học mới (không cần Udemy). Hỗ trợ chọn cả thư mục (`webkitdirectory`)
- **Xem transcript** của từng bài học trực tiếp trong ứng dụng
- **Tóm tắt tự động** nội dung bài học bằng AI
- **Giải thích khái niệm** khi bạn không hiểu một đoạn nào đó
- **Chat với AI** về nội dung bài học theo ngữ cảnh transcript
- **Lộ trình học tập** — AI phân tích toàn bộ khóa học và đề xuất lộ trình tối ưu
- **Quiz tương tác** — trả lời trắc nghiệm, chọn đáp án, xem kết quả ngay
- **Flashcard lật thẻ** — lật thẻ để ôn tập, điều hướng qua từng thẻ
- **Bài tập mở rộng** — bài tập accordion có lời giải tham khảo
- **AI cache thông minh** — kết quả AI được lưu vào DB, không cần generate lại. Nút "Tạo lại" (`force`) để regenerate khi cần
- **Multi-profile AI** — tạo, chuyển đổi, xóa nhiều profile AI (mỗi profile có base URL, API key, model, Udemy cookie riêng)
- **Lưu trữ cục bộ** toàn bộ dữ liệu bằng SQLite, không cần server ngoài
- **Docker support** — chạy trên port `3939`, tự động khởi động, deploy dễ dàng

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Ngôn ngữ | TypeScript |
| Database | Prisma + SQLite |
| AI | OpenAI SDK (OpenAI-compatible) |
| Validation | Zod |

## Yêu cầu hệ thống

- Node.js 18 trở lên
- npm

## Cài đặt & Chạy

### Cách 1: Docker (Khuyến nghị)

Chỉ cần Docker — không cần cài Node.js, npm hay bất kỳ thứ gì khác.

```bash
git clone https://github.com/chrisnguyen201092-dotcom/udemy-transcript-analyzer.git
cd udemy-transcript-analyzer
docker compose up -d
```

Ứng dụng sẽ chạy tại **[http://localhost:3939](http://localhost:3939)** và:
- **Tự động khởi động** khi máy tính bật (restart: always)
- **Tự động tạo database** khi chạy lần đầu
- **Lưu dữ liệu** vào Docker volume (không mất khi rebuild)

Các lệnh hữu ích:

```bash
# Xem logs
docker compose logs -f

# Dừng ứng dụng
docker compose down

# Rebuild sau khi cập nhật code
docker compose up -d --build

# Xem trạng thái
docker compose ps
```

### Cách 2: Chạy trực tiếp (Development)

```bash
git clone https://github.com/chrisnguyen201092-dotcom/udemy-transcript-analyzer.git
cd udemy-transcript-analyzer
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Mở trình duyệt và truy cập [http://localhost:3939](http://localhost:3939).

## Cấu hình (Multi-Profile)

Nhấn biểu tượng **Settings** (bánh răng) ở góc trên phải để mở modal cấu hình.

### Hệ thống Multi-Profile

Ứng dụng hỗ trợ **nhiều profile AI**, mỗi profile là một bộ cấu hình độc lập:

| Trường | Mô tả |
|---|---|
| **Tên profile** | Tên gợi nhớ (ví dụ: "OpenAI GPT-4o", "Ollama Local") |
| **Base URL** | Endpoint của OpenAI-compatible API (ví dụ: `https://api.openai.com/v1`) |
| **API Key** | Khóa API của bạn |
| **Model** | Tên model muốn dùng — dropdown tự load từ provider |
| **Udemy Cookie** | Cookie xác thực Udemy để import khóa học (lấy từ DevTools trình duyệt) |

**Thao tác với profile:**
- **Tạo mới**: Nhấn "Thêm profile" → nhập thông tin → lưu
- **Chuyển đổi**: Chọn profile từ dropdown → tự động áp dụng
- **Xóa**: Nhấn icon xóa bên cạnh profile

Header hiển thị **"Tên profile / model"** khi đã cấu hình, giúp nhận biết đang dùng profile nào.

Tất cả profile được lưu trong `localStorage` (key: `udemy_ai_profiles`), không gửi lên bất kỳ server nào ngoài AI provider bạn chọn. Tự động migrate từ cấu hình cũ (`udemy_ai_settings`) khi nâng cấp.

## Upload & Tạo khóa học từ file

Có **hai cách** để thêm nội dung vào ứng dụng:

### Cách 1: Import từ Udemy
Click "Import từ Udemy" → nhập access token → chọn khóa học. Toàn bộ curriculum và transcript sẽ được import tự động.

### Cách 2: Tạo khóa học từ file cục bộ
Click "Upload từ file" → nhập **tên khóa học** → chọn file hoặc thư mục transcript. Hệ thống sẽ:
1. Tự động tạo khóa học mới với tên bạn nhập
2. Parse các file `.vtt`, `.srt`, `.txt` (strip timestamps, deduplicate)
3. Tạo bài học cho mỗi file (tên file = tên bài học)
4. Tự động chọn khóa học mới sau khi upload xong

Nếu đã chọn khóa học trước, file sẽ được thêm vào khóa học đó thay vì tạo mới.

Hỗ trợ **chọn thư mục** (folder upload) — chọn cả thư mục chứa nhiều file transcript cùng lúc.

## Cấu trúc thư mục

```
src/
├── app/
│   ├── layout.tsx              # Root layout + metadata
│   ├── page.tsx                # Main page (client component)
│   └── api/
│       ├── ai/                 # AI routes (summary, explain, chat, quiz, roadmap, models)
│       ├── courses/            # Course CRUD + upload
│       ├── lessons/            # Lesson transcript + AI data
│       └── udemy/              # Udemy import
├── components/
│   ├── Header.tsx              # Navigation, profile/model display, Settings button
│   ├── AddCoursePanel.tsx      # Form thêm khóa học + nút Import + nút Upload
│   ├── CourseList.tsx          # Danh sách khóa học
│   ├── LessonList.tsx          # Danh sách bài học
│   ├── TranscriptPanel.tsx     # Xem + edit transcript
│   ├── AIAssistantPanel.tsx    # 5 tab: Summary, Explain, Chat, Roadmap, Practice
│   ├── SettingsModal.tsx       # Multi-profile AI settings
│   ├── ImportModal.tsx         # Import từ Udemy
│   ├── UploadModal.tsx         # Upload file/folder → tạo khóa học hoặc thêm bài
│   ├── QuizPlayer.tsx          # Quiz tương tác (chọn đáp án, chấm điểm)
│   ├── FlashcardDeck.tsx       # Flashcard lật thẻ (prev/next navigation)
│   ├── ExerciseList.tsx        # Bài tập accordion (mở rộng lời giải)
│   ├── MarkdownRenderer.tsx    # Render markdown content
│   ├── ModeToggle.tsx          # Dark/light mode toggle
│   ├── OnboardingCard.tsx      # Hướng dẫn người dùng mới
│   ├── ThemeProvider.tsx       # Theme context provider
│   └── ui/                     # shadcn/ui primitives
└── lib/
    ├── prisma.ts               # Prisma client singleton
    ├── utils.ts                # Utility functions
    ├── parse-transcript.ts     # Parse VTT/SRT/TXT transcript files
    ├── srs.ts                  # Spaced repetition scheduling
    ├── strip-think.ts          # Strip AI thinking tags from responses
    └── ai/
        └── prompts.ts          # AI system prompts (7 loại)
```

## API Routes

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET/POST` | `/api/courses` | Lấy danh sách / thêm khóa học |
| `GET/DELETE` | `/api/courses/[id]` | Chi tiết / xóa khóa học |
| `GET` | `/api/courses/[id]/ai` | Lấy AI data cấp khóa học (roadmap) |
| `POST` | `/api/courses/[id]/lessons` | Thêm bài học vào khóa học |
| `POST` | `/api/courses/upload` | Upload file transcript → tạo khóa học hoặc thêm bài học |
| `GET` | `/api/lessons/[id]/ai` | Lấy AI data cấp bài học (summary, explanation, quiz, flashcards, exercises) |
| `PUT` | `/api/lessons/[id]/transcript` | Cập nhật transcript bài học |
| `POST` | `/api/ai/summary` | Tóm tắt transcript (cached, hỗ trợ `force`) |
| `POST` | `/api/ai/explain` | Giải thích đoạn văn bản (cached, hỗ trợ `force`) |
| `POST` | `/api/ai/chat` | Chat với AI về bài học (streaming) |
| `POST` | `/api/ai/quiz` | Tạo Quiz/Flashcard/Exercises (cached, hỗ trợ `force`) |
| `POST` | `/api/ai/roadmap` | Tạo lộ trình toàn khóa (cached, hỗ trợ `force`) |
| `POST` | `/api/ai/models` | Lấy danh sách model từ provider |
| `POST` | `/api/udemy/courses` | Lấy danh sách khóa học đã đăng ký từ Udemy |
| `POST` | `/api/udemy/import` | Import khóa học từ Udemy |

### AI Cache & Force Regenerate

Tất cả AI routes (trừ chat) có cơ chế **cache guard**:
- Nếu bài học/khóa học đã có kết quả AI → trả về ngay, **không gọi AI lại**
- Gửi `"force": true` trong body request → **bỏ qua cache**, generate lại và ghi đè kết quả cũ
- UI hiển thị nút "Tạo lại" khi đã có kết quả cached

## Giấy phép

MIT
