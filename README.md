# Udemy Learner

Trợ lý học tập AI cho khóa học Udemy. Ứng dụng giúp bạn tóm tắt bài học, giải thích khái niệm, và trò chuyện với AI dựa trên transcript của khóa học.

## Tính năng chính

- **Import khóa học** từ Udemy thông qua cookie xác thực
- **Xem transcript** của từng bài học trực tiếp trong ứng dụng
- **Tóm tắt tự động** nội dung bài học bằng AI
- **Giải thích khái niệm** khi bạn không hiểu một đoạn nào đó
- **Chat với AI** về nội dung bài học theo ngữ cảnh transcript
- **Lưu trữ cục bộ** toàn bộ dữ liệu bằng SQLite, không cần server ngoài
- **Tùy chỉnh AI**: chọn base URL, model, và API key theo ý muốn (tương thích OpenAI-compatible APIs)

## Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Ngôn ngữ | TypeScript |
| Database | Prisma + SQLite |
| AI | OpenAI SDK (OpenAI-compatible) |

## Yêu cầu hệ thống

- Node.js 18 trở lên
- npm

## Cài đặt & Chạy

```bash
git clone https://github.com/chrisnguyen201092-dotcom/udemy-transcript-analyzer.git
cd udemy-transcript-analyzer
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Mở trình duyệt và truy cập [http://localhost:3000](http://localhost:3000).

## Cấu hình

Nhấn biểu tượng **Settings** (bánh răng) ở góc trên phải để mở modal cấu hình:

| Trường | Mô tả |
|---|---|
| **Base URL** | Endpoint của OpenAI-compatible API (ví dụ: `https://api.openai.com/v1`) |
| **API Key** | Khóa API của bạn |
| **Model** | Tên model muốn dùng (ví dụ: `gpt-4o`, `gpt-4o-mini`) |
| **Udemy Cookie** | Cookie xác thực Udemy để import khóa học (lấy từ DevTools trình duyệt) |

Tất cả cấu hình được lưu trong localStorage, không gửi lên bất kỳ server nào ngoài AI provider bạn chọn.

## Cấu trúc thư mục

```
src/
├── app/
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Main page (client component)
│   └── api/
│       ├── ai/             # AI routes (summary, explain, chat, models)
│       ├── courses/        # Course CRUD
│       ├── lessons/        # Lesson transcript
│       └── udemy/          # Udemy import
├── components/
│   ├── Header.tsx
│   ├── AddCoursePanel.tsx
│   ├── CourseList.tsx
│   ├── LessonList.tsx
│   ├── TranscriptPanel.tsx
│   ├── AIAssistantPanel.tsx
│   ├── SettingsModal.tsx
│   ├── ImportModal.tsx
│   └── ui/                 # shadcn/ui primitives
└── lib/
    ├── prisma.ts           # Prisma client singleton
    ├── utils.ts            # Utility functions
    └── ai/
        └── prompts.ts      # AI system prompts
```

## API Routes

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET/POST` | `/api/courses` | Lấy danh sách / thêm khóa học |
| `GET/DELETE` | `/api/courses/[id]` | Chi tiết / xóa khóa học |
| `POST` | `/api/courses/[id]/lessons` | Thêm bài học vào khóa học |
| `PUT` | `/api/lessons/[id]/transcript` | Cập nhật transcript bài học |
| `POST` | `/api/ai/summary` | Tóm tắt transcript |
| `POST` | `/api/ai/explain` | Giải thích đoạn văn bản |
| `POST` | `/api/ai/chat` | Chat với AI về bài học |
| `POST` | `/api/ai/models` | Lấy danh sách model từ provider |
| `POST` | `/api/udemy/courses` | Lấy danh sách khóa học đã đăng ký từ Udemy |
| `POST` | `/api/udemy/import` | Import khóa học từ Udemy |

## Giấy phép

MIT
