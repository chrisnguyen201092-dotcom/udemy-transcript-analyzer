# Bản đồ Giao diện — Inkgest

> UI Map cho vision v1.x → v2.0 → v3.0

## 1. Sitemap

```
Inkgest
├── 🔐 Authentication (Public Routes) — v1.3
│   ├── Login Page (`/login`)
│   ├── Register Page (`/register`)
│   ├── Forgot Password Page (`/forgot-password`)
│   └── Reset Password Page (`/reset-password`)
│
├── 🏠 Dashboard (Home) — v1.3
│   ├── Overview cards (tổng khóa, bài, streak)
│   ├── Continue Learning widget (3-5 gần nhất)
│   ├── SRS due today widget
│   ├── Study Stats widget
│   ├── Recent Activity feed
│   └── Quick actions (Add Source, Start Review)
│
├── 📋 Source List (hiện tại: CourseList) — v1.0+
│   ├── Filter tabs: All | 🎓Udemy | 📚Books | ▶️YouTube | 🌐Web | 💻GitHub | 🎙️Podcast | 📄Local
│   ├── Search + sort
│   ├── Collection/Tags
│   └── → click → Learning View
│
├── 📖 Learning View (màn hình chính khi học) — v1.0+
│   ├── Lesson/Chapter list (trái)
│   ├── Content Panel (giữa): Transcript / Book text / Code / Article
│   ├── AI Panel (phải): Summary | Explain | Chat | Practice | Roadmap | Notes
│   └── Bottom bar: Progress, SRS badge, Export
│
├── ➕ Add Source (unified modal) — v2.0+
│   ├── Step 1: Chọn loại nguồn
│   ├── Step 2: Input (URL / file / token / paste)
│   └── Step 3: Preview + confirm import
│
├── 📊 Analytics — v1.2+
│   ├── Overview (cross-source)
│   ├── Per-source detail
│   └── Study Heatmap + Streak
│
├── 🔄 SRS Review (full-screen mode) — v1.2+
│   ├── Flashcard review session
│   ├── Score + next review date
│   └── → back to Dashboard
│
└── ⚙️ Settings — v1.3
    ├── Account (email, profile, avatar)
    ├── Preferences (theme, language, daily goal)
    ├── Data Management (export, delete account)
    ├── AI Profiles (multi-provider)
    └── Notification preferences
```

## 2. Layout Architecture

### Desktop (>1024px) — 3 Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚡ Inkgest          [🔍 Search]    [Profile: GPT-4o ●]  [⚙️] [🌙] │
├────────────┬──────────────────────────┬─────────────────────────────┤
│            │                          │                             │
│  SOURCE    │    CONTENT PANEL         │     AI PANEL                │
│  LIST      │                          │                             │
│            │  ┌──────────────────┐    │  ┌─────────────────────┐    │
│  🔍 Filter  │  │ Transcript/Text  │    │  │ [Sum][Exp][Chat]    │    │
│            │  │                  │    │  │ [Quiz][Road][Notes] │    │
│  [All ▾]   │  │                  │    │  │                     │    │
│            │  │  Nội dung bài    │    │  │  AI output here     │    │
│  📚 React  │  │  học / chương    │    │  │                     │    │
│  ▶️ JS Vid │  │  sách / code     │    │  │                     │    │
│  🎓 Udemy  │  │                  │    │  │                     │    │
│  💻 Repo   │  │                  │    │  │                     │    │
│  🎙️ Pod   │  └──────────────────┘    │  └─────────────────────┘    │
│            │                          │                             │
│  [➕ Add]  │  [◀ Prev] [Progress] [▶] │  [SRS: 5 due] [Export ▾]   │
├────────────┴──────────────────────────┴─────────────────────────────┤
│  Status bar: Streak 🔥12 · Today 45m · 3 sources active            │
└─────────────────────────────────────────────────────────────────────┘
```

### Tablet (768–1024px) — 2 Panel

```
┌─────────────────────────────────────────────────┐
│  ⚡ Inkgest    [☰]    [Profile ●]  [⚙️]  [🌙]   │
├───────────────┬─────────────────────────────────┤
│               │                                 │
│  SOURCE LIST  │   CONTENT + AI (tabbed)         │
│  (narrower)   │                                 │
│               │   [Content] [AI Assistant]      │
│  🔍           │   ┌───────────────────────┐     │
│  📚 React     │   │                       │     │
│  ▶️ JS Vid    │   │  Active tab content   │     │
│  🎓 Udemy     │   │                       │     │
│               │   └───────────────────────┘     │
│  [➕ Add]     │   [◀ Prev] [Progress] [▶ Next]  │
└───────────────┴─────────────────────────────────┘
```

### Mobile (<768px) — 1 Panel + Bottom Nav

```
┌─────────────────────────────┐
│  ⚡ Inkgest   [☰]  [⚙️] [🌙] │
├─────────────────────────────┤
│                             │
│   Active view (full width)  │
│                             │
│   Hiển thị 1 trong:        │
│   • Source List             │
│   • Content (transcript)    │
│   • AI Panel                │
│                             │
│                             │
│                             │
├─────────────────────────────┤
│  [📋 List] [📖 Content] [🤖 AI] │
└─────────────────────────────┘
```

## 3. Source Type UI System

### Icons & Colors

| Source | Icon | Badge Color | contentType |
|--------|------|-------------|-------------|
| Udemy | 🎓 | `#A435F0` (purple) | `udemy` |
| Books | 📚 | `#E67E22` (orange) | `book` |
| YouTube | ▶️ | `#FF0000` (red) | `youtube` |
| Web/URL | 🌐 | `#3B82F6` (blue) | `web` |
| GitHub | 💻 | `#171515` (dark) | `code` |
| Podcast | 🎙️ | `#1DB954` (green) | `podcast` |
| Local files | 📄 | `#6B7280` (gray) | `local` |

### Source Badge Component

```
┌─────────────────────────────┐
│  ▶️ JavaScript Crash Course │
│  YouTube · 24 lessons · 65% │
│  ████████████░░░░░░  65%    │
└─────────────────────────────┘
```

## 4. Key Screens

### 4.0 Authentication Screens (v1.3) — NEW

#### 4.0.1 Login Page

```
┌─────────────────────────────────┐
│                                 │
│        ⚡ Inkgest              │
│                                 │
│    Đăng nhập vào tài khoản      │
│                                 │
│  ┌──────────────────────────┐   │
│  │ Email                    │   │
│  │ user@example.com         │   │
│  └──────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐   │
│  │ Password                 │   │
│  │ ••••••••                 │   │
│  └──────────────────────────┘   │
│                                 │
│  ☑️ Nhớ tôi 30 ngày            │
│                                 │
│  [      Đăng nhập      ]        │
│                                 │
│  Quên mật khẩu?                 │
│  Chưa có tài khoản? Đăng ký    │
└─────────────────────────────────┘
```

#### 4.0.2 Register Page

```
┌─────────────────────────────────┐
│        ⚡ Inkgest              │
│                                 │
│    Tạo tài khoản mới           │
│                                 │
│  ┌──────────────────────────┐   │
│  │ Email                    │   │
│  └──────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐   │
│  │ Password (≥8 ký tự)     │   │
│  └──────────────────────────┘   │
│                                 │
│  ┌──────────────────────────┐   │
│  │ Xác nhận mật khẩu       │   │
│  └──────────────────────────┘   │
│                                 │
│  [      Tạo tài khoản     ]     │
│                                 │
│  Đã có tài khoản? Đăng nhập    │
└─────────────────────────────────┘
```

### 4.1 Dashboard (Home) — v1.3

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚡ Inkgest                                    [⚙️ Settings]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Chào buổi sáng! 🔥 Streak: 12 ngày                            │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ 📋 12    │ │ 📖 48    │ │ ⏱️ 24h   │ │ 🔄 5     │          │
│  │ Nguồn    │ │ Bài học  │ │ Tổng     │ │ SRS due  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  Tiếp tục học ──────────────────────────────────────            │
│  ┌─────────────────────────────────────────────────┐            │
│  │ ▶️ JavaScript Crash Course     Bài 15/24 · 62%  │            │
│  │ 📚 Clean Code (Robert Martin)  Ch. 5/17  · 29%  │            │
│  │ 🎓 React Complete Guide        Bài 42/68 · 61%  │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │ [➕ Thêm nguồn mới] │  │ [🔄 Ôn tập SRS]    │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  📊 Tuần này: ██ ██ ░░ ██ ██ ░░ ░░  (Mon-Sun)                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Add Source — Unified Modal

```
┌─────────────────────────────────────────────┐
│  ➕ Thêm nguồn học tập                  [✕] │
├─────────────────────────────────────────────┤
│                                             │
│  Chọn loại nguồn:                           │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ 🎓      │ │ 📚      │ │ ▶️       │      │
│  │ Udemy   │ │ Sách    │ │ YouTube │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ 🌐      │ │ 💻      │ │ 🎙️      │      │
│  │ Web URL │ │ GitHub  │ │ Podcast │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│  ┌─────────┐ ┌─────────┐                   │
│  │ 📄      │ │ ✏️       │                   │
│  │ File    │ │ Thủ công│                   │
│  └─────────┘ └─────────┘                   │
│                                             │
│  ── hoặc paste URL ──                       │
│  ┌─────────────────────────────────────┐    │
│  │ https://youtube.com/watch?v=...     │    │
│  └─────────────────────────────────────┘    │
│  (Tự nhận diện loại nguồn từ URL)          │
└─────────────────────────────────────────────┘
```

### 4.3 Learning View — per Source Type

**Video source (Udemy/YouTube):**
```
Content Panel: Transcript (timestamped, scrollable)
AI Panel:      Summary | Explain | Chat | Quiz/Flashcard | Roadmap
```

**Book source:**
```
Content Panel: Chapter text (markdown rendered)
AI Panel:      Summary | Explain | Chat | Quiz/Flashcard | Roadmap
               + Key Concepts badge
```

**GitHub source:**
```
Content Panel: README / docs / code viewer (syntax highlighted)
AI Panel:      Summary | Explain | Chat | Quiz (code-focused)
               + File tree sidebar
```

**Web/Article source:**
```
Content Panel: Cleaned article text (reader mode)
AI Panel:      Summary | Explain | Chat | Quiz | Related links
```

**Podcast/Audio:**
```
Content Panel: Transcript (từ Whisper, timestamped)
AI Panel:      Summary | Explain | Chat | Quiz/Flashcard
               + Audio player mini bar
```

### 4.4 SRS Review — Full Screen

```
┌─────────────────────────────────────────────┐
│  🔄 Ôn tập · 5 thẻ hôm nay          [✕]   │
├─────────────────────────────────────────────┤
│            Thẻ 2/5 · 📚 Clean Code          │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │   What is the Single               │    │
│  │   Responsibility Principle?         │    │
│  │                                     │    │
│  │         [Lật thẻ]                   │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ │
│  │ Quên   │ │ Khó    │ │ Được   │ │ Dễ   │ │
│  │ <1m    │ │ <10m   │ │ 3d     │ │ 7d   │ │
│  └────────┘ └────────┘ └────────┘ └──────┘ │
│                                             │
│  ████████░░░░░░░░░░  40% hoàn thành         │
└─────────────────────────────────────────────┘
```

## 5. Navigation Flow

```
                         ┌──────────┐
                         │ Login    │
                         │ (public) │
                         └─────┬────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
            ┌──────────────┐      ┌──────────────┐
            │ Register     │      │ Forgot Pass  │
            │ (public)     │      │ (public)     │
            └──────┬───────┘      └──────┬───────┘
                   │                     │
                   └──────────┬──────────┘
                              ▼
                    ┌─────────────────┐
                    │ Dashboard       │  ← after login (v1.3)
                    │ (protected)     │
                    └────┬────────┬───┘
                         │        │
         ┌───────────────┼────────┼───────────────┐
         ▼               ▼        ▼               ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Add      │ │ Source   │ │ SRS      │ │ Settings │
    │ Source   │ │ List     │ │ Review   │ │ (v1.3)   │
    └────┬─────┘ └────┬─────┘ └──────────┘ └──────────┘
         │            │
         ▼            ▼
    ┌──────────┐ ┌──────────┐
    │ Import   │ │ Learning │◄──── AI Panel tabs
    │ Process  │ │ View     │      (Sum/Exp/Chat/
    └────┬─────┘ └────┬─────┘       Quiz/Road/Notes)
         │            │
         ▼            ▼
    Source List  ┌──────────┐
                 │ Analytics│
                 │ (v1.2+)  │
                 └──────────┘
```

## 6. Component Evolution

| Hiện tại (v1.x) | v1.3 (Multi-User) | Thay đổi |
|---|---|---|
| — (chưa có) | `LoginPage.tsx` | MỚI: Public login page |
| — (chưa có) | `RegisterPage.tsx` | MỚI: Public register page |
| — (chưa có) | `ForgotPasswordPage.tsx` | MỚI: Password reset flow |
| — (chưa có) | `Dashboard.tsx` | MỚI: Home screen after login (v1.3) |
| — (chưa có) | `AvatarDropdown.tsx` | MỚI: User menu in header (v1.3) |
| — (chưa có) | `SettingsPage.tsx` | MỚI: Full page route `/settings` (v1.3) |
| `Header.tsx` | `Header.tsx` | Update: avatar dropdown, remove profile/model display, add theme toggle |
| `CourseList.tsx` | `SourceList.tsx` | Rename, thêm source filter tabs, badges |
| `LessonList.tsx` | `LessonList.tsx` | Giữ nguyên, thêm source-aware icons |
| `TranscriptPanel.tsx` | `ContentPanel.tsx` | Rename, adapt per contentType (text/code/reader) |
| `AIAssistantPanel.tsx` | `AIAssistantPanel.tsx` | Thêm Notes tab, adapt prompts per contentType |
| `ImportModal.tsx` | → merged | Gộp vào AddSourceModal |
| `UploadModal.tsx` | → merged | Gộp vào AddSourceModal |
| `AddCoursePanel.tsx` | `AddSourceModal.tsx` | Unified modal, auto-detect URL type |
| `SettingsModal.tsx` | → deprecated | Replaced by SettingsPage.tsx route (v1.3) |
| — (chưa có) | `SRSReviewScreen.tsx` | MỚI: Full-screen SRS review |
| — (chưa có) | `SourceBadge.tsx` | MỚI: Icon + color per source type |
| — (chưa có) | `AudioPlayer.tsx` | MỚI: Mini player cho podcast |
| — (chưa có) | `CodeViewer.tsx` | MỚI: Syntax highlight cho GitHub source |
| `OnboardingCard.tsx` | `OnboardingCard.tsx` | Update text, show all source types |
| `page.tsx` (38KB) | Split routes | Tách: `/login`, `/register`, `/dashboard`, `/learn/[id]`, `/settings`, `/review`, `/analytics` (v1.3+) |

## 7. Phân kỳ triển khai UI

### v1.3 — Multi-User Foundation (Chủ yếu)
- **NEW:** Login, Register, Forgot Password pages
- **NEW:** Dashboard page with widgets (Continue Learning, SRS Due, Stats, Activity)
- **NEW:** SettingsPage.tsx full route (replace SettingsModal)
- **UPDATE:** Header with avatar dropdown + user menu
- **UPDATE:** Route protection + navigation flow
- **UPDATE:** Sidebar: personalized per user (Continue Learning, SRS Due, My Courses)

### v2.0 — Books Support (Minimal UI changes needed)
- Rename CourseList → SourceList (thêm book badge)
- ContentPanel adapt cho book text
- AddSourceModal gộp Import + Upload + Book upload
- page.tsx giữ single-page (chưa cần routing)

### v3.0 — Multi-Source Hub (Mở rộng)
- Source filter tabs (7 loại) fully integrated
- ContentPanel: thêm code viewer, reader mode, audio player
- AddSourceModal: thêm YouTube URL, GitHub URL, Web URL, Audio upload
- SRS Review full-screen
- Tách page.tsx → routes
- Responsive 3 breakpoints
