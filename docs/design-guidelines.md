# Design Guidelines — Inkgest

> **Version:** 3.0 | **Date:** 2026-04-02 | **Status:** Recommendation
> Hướng dẫn thiết kế UI/UX cho Inkgest — AI-powered multi-user learning platform
>
> **Precedence Rule:** Sections 13-19 (Route & State Ownership, Accessibility, Responsive Navigation Matrix, Practice & SRS Surface Ownership, Multi-User & Authentication, Dashboard Page Design, Data Scoping & Privacy) are the **canonical source of truth**. If earlier sections conflict with Sections 13-19, the canonical sections take precedence.

---

## 1. Design Philosophy

### Core Principles

1. **Content-First**: Nội dung học tập luôn chiếm không gian lớn nhất. UI chỉ xuất hiện khi cần.
2. **Progressive Disclosure**: Không hiển thị tất cả cùng lúc. Features xuất hiện theo ngữ cảnh.
3. **Spatial Consistency**: Mỗi vùng màn hình có chức năng cố định — user không bao giờ lạc.
4. **Calm Technology**: Ít animation phô trương, nhiều micro-interaction tinh tế.
5. **Zero-Config Start**: User mới mở app thấy ngay cách bắt đầu, không cần hướng dẫn.
6. **Multi-User First**: Mọi data đều scoped theo user. Không có global state — mỗi user có workspace riêng.

### Visual Identity

- **Style**: Clean, editorial — cảm hứng từ Notion, Linear, Arc Browser
- **Density**: Medium — không quá sparse, không quá dense
- **Typography**: Inter/Geist Sans cho UI, JetBrains Mono cho code blocks
- **Corners**: `border-radius: 12px` cards/panels, `8px` buttons, `6px` inputs
- **Shadows**: Minimal — dùng border + subtle background thay vì drop-shadow nặng
- **Icons**: Lucide icons — consistent stroke width 1.5px

---

## 2. Layout Architecture

### 2.1 Desktop Layout (>=1280px) — 3 Column

```
+-------------------------------------------------------------------------+
|  HEADER (h-14, fixed top)                                               |
|  Inkgest    [Cmd+K Search]           [AI Model]  [Theme]  [Avatar▼]    |
+----------+----------------------------+---------------------------------+
|          |                            |                                 |
| SIDEBAR  |    CONTENT PANEL           |    AI PANEL                     |
| (w-272)  |    (flex-1, min-w-400)     |    (w-[480px], resizable)       |
|          |                            |                                 |
| +------+ |  +--------------------+    |  +-----------------------+      |
| | Add  | |  |                    |    |  | [Tab Bar - scrollable]|      |
| |Source| |  |   Transcript /     |    |  |                       |      |
| +------+ |  |   Book Content /   |    |  |   AI Output Area      |      |
|          |  |   Code Viewer      |    |  |   (ScrollArea)        |      |
| +------+ |  |                    |    |  |                       |      |
| |Source| |  |                    |    |  |                       |      |
| | List | |  |                    |    |  +-----------------------+      |
| +------+ |  |                    |    |                                 |
|          |  +--------------------+    |  +-----------------------+      |
| +------+ |                            |  | Action Bar / Input    |      |
| |Lesson| |  +--------------------+    |  +-----------------------+      |
| | List | |  | Bottom Status Bar  |    |                                 |
| +------+ |  | Progress - Export  |    |                                 |
|          |  +--------------------+    |                                 |
+----------+----------------------------+---------------------------------+
|  STATUS BAR (optional, h-8): Streak - Today time - SRS due             |
+-------------------------------------------------------------------------+
```

**Key changes tu hien tai:**
- AI Panel width tang tu 50% -> fixed `480px` (resizable via drag handle)
- Content Panel duoc `flex-1` -> chiem toi da khong gian con lai
- Them Command Palette (`Cmd+K`) cho quick navigation
- Bottom status bar cho persistent metrics (streak, time, SRS)
- Sidebar collapsible -> icon-only mode (`w-16`)

### 2.2 Tablet Layout (768-1023px) — 2 Column + Overlay

```
+---------------------------------------------------+
|  HEADER  [hamburger toggle sidebar]               |
+---------------------------------------------------+
|                                                   |
|   CONTENT PANEL (full width)                      |
|                                                   |
+---------------------------------------------------+
|  [Content]  [AI]  [Notes]                         |
|  Bottom tab bar to switch main view               |
+---------------------------------------------------+

Sidebar: Sheet overlay from left (swipe or hamburger)
AI Panel: Sheet overlay from right or bottom tab switch
```

### 2.3 Mobile Layout (<768px) — Single Column + Bottom Nav

```
+-----------------------------+
|  Inkgest    [hamburger] [cog]|
+-----------------------------+
|                             |
|   ACTIVE VIEW (full)        |
|   One of:                   |
|   - Source List             |
|   - Content (transcript)    |
|   - AI Assistant            |
|   - Notes                   |
|                             |
+-----------------------------+
| [List] [Content] [AI] [Settings]|
|  Bottom Navigation Bar      |
+-----------------------------+
```

---

## 3. Tab vs Combined Strategy

### Decision Matrix

| Feature | Strategy | Location | Ly do |
|---------|----------|----------|-------|
| **Summary** | AI Panel Tab | AI Panel | Xem 1 lan, khong can song song voi content khac |
| **Explain** | AI Panel Tab | AI Panel | Can doc song song voi transcript |
| **Chat** | AI Panel Tab | AI Panel | Conversational, can input area rieng |
| **Roadmap** | AI Panel Tab | AI Panel | Course-level view |
| **Notes** | AI Panel Tab | AI Panel | Can edit space, context tu transcript |
| **Practice (Quiz)** | **Modal Overlay** | Overlay | Full-focus mode, khong can transcript |
| **Practice (Flashcard)** | **Full-screen overlay** | Overlay (not route) | Immersive review, lesson-local, no FSRS (see Section 16) |
| **Practice (Exercise)** | AI Panel Tab | AI Panel | Can reference transcript |
| **Analytics** | **Separate route** | `/analytics` | Dashboard view, khong lien quan lesson cu the |
| **SRS Review** | **Full-screen route** | `/review` | Dedicated review session, distraction-free |
| **Collections** | **Sidebar section** | Sidebar | Quick access |
| **Settings** | **Full page route** | `/settings` | Multi-user: account, preferences, data management (see Section 10.15) |
| **Export** | **Dropdown menu** | Content toolbar | Quick action |
| **Learner Profile** | **Modal** | Overlay | One-time setup |
| **Course Management** | **Sidebar** | Sidebar | Navigation chinh |

### AI Panel Tab Grouping — KHUYEN NGHI

Thay vi 7 tabs ngang hang (hien tai), nhom thanh **2 tang**:

```
+---------------------------------------------+
|  PRIMARY TABS (always visible):             |
|  [Tom tat] [Giai thich] [Chat]              |
|                                             |
|  SECONDARY (overflow "Them" menu):          |
|  [Lo trinh] [Ghi chu] [Luyen tap]          |
+---------------------------------------------+
```

**Cach implement:**
- 3 primary tabs hien thi truc tiep (most-used features)
- Secondary tabs trong dropdown "Them" hoac overflow scroll
- Practice tab mo sub-menu: Quiz | Flashcard | Bai tap
- Analytics redirect sang `/analytics` route

### Practice Sub-types

```
Luyen tap (dropdown):
  |- Trac nghiem (Quiz)     -> Modal overlay, full-focus
  |- Flashcard              -> Full-screen overlay
  |- Bai tap (Exercise)     -> Inline trong AI Panel
```

---

## 4. Navigation Pattern

### Primary Flow (Multi-User)

```
                    +----------+
                    |  Login / |  ← Unauthenticated entry
                    | Register |
                    +----+-----+
                         |
                         v (authenticated)
                    +----------+
                    | Dashboard|  ← Default landing (/dashboard)
                    |  (Home)  |
                    +----+-----+
                         |
            +-----+------+-------+--------+
            v     v      v       v        v
        +------+ +----+ +-----+ +------+ +--------+
        |Learn | |SRS | |Anal-| |Quick | |Settings|
        |View  | |Rev.| |ytics| |Resume| |(/sett.)|
        |( / ) | |    | |     | |(link)| |        |
        +--+---+ +----+ +-----+ +------+ +--------+
           |
           +------------+------------+
           v            v            v
     +----------+ +----------+ +----------+
     | Add      | | Source   | | Lesson   |
     | Source   | | Select   | | View     |<-- AI Panel tabs
     | (modal)  | | (sidebar)| |          |
     +----------+ +----------+ +----------+
```

### Navigation Entry Points

| From | To | Trigger |
|------|----|---------|
| `/login` | `/dashboard` | Successful login (or `?redirect` URL) |
| `/register` | `/dashboard` | Successful registration → onboarding |
| `/dashboard` | `/` | Click course card or "Resume" |
| `/dashboard` | `/review` | Click "Start Review" |
| `/dashboard` | `/analytics` | Click stats card |
| Any protected | `/login` | Session expired (401) |
| `/login` | `/register` | Click "Dang ky" link |
| Header avatar | `/settings` | Click "Settings" in dropdown |
| Header avatar | `/login` | Click "Dang xuat" (clears session) |

### Keyboard Shortcuts

| Shortcut | Action | Platform Note |
|----------|--------|---------------|
| `Alt + Up/Down` | Chuyen bai truoc/sau | Cross-platform safe |
| `Ctrl + ,` | Mo cai dat | Cross-platform safe |
| `Ctrl + K` | Command Palette (NEW) | Windows/Linux. Mac: `Cmd+K` |
| `Alt + 1-6` | Switch AI Panel tab (NEW) | **Alt+N** avoids Ctrl+N browser tab conflict |
| `Ctrl + E` | Toggle edit mode transcript (NEW) | Cross-platform safe |
| `Ctrl + Shift + F` | Toggle fullscreen content (NEW) | Cross-platform safe |
| `Escape` | Dong modal/overlay hien tai | Cross-platform safe |

**Shortcut Rules:**
- Shortcuts DISABLED when focus is inside `<input>`, `<textarea>`, or `[contenteditable]`
- Platform detection: `navigator.platform` → swap `Ctrl` ↔ `Cmd` for macOS
- All shortcuts registered via `useKeyboardShortcuts` hook (existing)
- NEVER use `Ctrl+1-9` (browser tab switching conflict)
- NEVER use `Ctrl+W` (close tab), `Ctrl+T` (new tab), `Ctrl+L` (address bar)

### Command Palette (Cmd+K) — NEW

```
+-------------------------------------------+
|  Search...                                |
+-------------------------------------------+
|  Sources                                  |
|     React Complete Guide                  |
|     Clean Code (Robert Martin)            |
|  Lessons                                  |
|     Bai 15: useState Hook                |
|     Chapter 5: Error Handling             |
|  Actions                                  |
|     Them nguon moi                        |
|     Mo cai dat                            |
|     Bat dau on tap SRS                    |
+-------------------------------------------+
```

---

## 5. Component Hierarchy

```
App (layout.tsx)
|-- ThemeProvider
|-- Header
|   |-- Logo + Brand
|   |-- CommandPalette trigger (Cmd+K)
|   |-- AI Profile indicator
|   |-- SettingsButton
|   +-- ModeToggle (dark/light)
|
|-- MainLayout (flex row)
|   |-- Sidebar (collapsible, w-272 | w-16)
|   |   |-- AddSourceButton
|   |   |-- SourceList (filterable)
|   |   |   +-- SourceCard[] (with badges, progress)
|   |   |-- Divider
|   |   |-- LessonList (when source selected)
|   |   |   +-- LessonItem[] (with completion checkbox)
|   |   |-- CourseProgress (streak, %)
|   |   +-- CollectionButton
|   |
|   |-- ContentPanel (flex-1)
|   |   |-- ContentToolbar (edit toggle, font size, export)
|   |   |-- TranscriptView | BookView | CodeView | ReaderView
|   |   +-- ContentFooter (prev/next, progress bar)
|   |
|   +-- AIPanel (w-480, resizable)
|       |-- TabBar (primary tabs + "More" overflow)
|       |-- TabContent
|       |   |-- SummaryView
|       |   |-- ExplainView
|       |   |-- ChatView (messages + input)
|       |   |-- RoadmapView
|       |   |-- NotesEditor
|       |   |-- PracticeHub (quiz/flashcard/exercise selector)
|       |   +-- AnalyticsPreview (link to full analytics)
|       +-- PanelFooter (SRS badge, export dropdown)
|
|-- Overlays (portaled)
|   |-- AddSourceModal (unified import/upload)
|   |-- QuizOverlay (modal, centered)
|   |-- FlashcardOverlay (fullscreen)
|   |-- LearnerProfileModal
|   |-- CommandPalette
|   +-- AlertDialogs
|
+-- Routes (separate pages)
    |-- /login, /register, /forgot-password (auth — public)
    |-- /dashboard (post-login landing)
    |-- /settings (account, preferences, data management)
    |-- /analytics, /analytics/:courseId
    +-- /review (SRS review session)
```

---

## 6. Color & Theme System

### Brand Colors

```css
/* Primary (Inkgest Purple) */
--brand-500: #A435F0;    /* Main brand, buttons, active states */
--brand-600: #8710D8;    /* Hover states */
--brand-400: #C084FC;    /* Light accent */
--brand-50:  #FAF5FF;    /* Subtle backgrounds (light mode) */
--brand-950: #1A0533;    /* Subtle backgrounds (dark mode) */
```

### Semantic Colors

```css
--success: #22C55E;   /* Completion, correct answers */
--warning: #F59E0B;   /* Unconfigured, attention */
--error:   #EF4444;   /* Errors, delete actions */
--info:    #3B82F6;   /* Links, informational */
```

### Source Type Colors (from ui-map.md)

| Source | Color | Hex |
|--------|-------|-----|
| Udemy | Purple | `#A435F0` |
| Book | Orange | `#E67E22` |
| YouTube | Red | `#FF0000` |
| Web | Blue | `#3B82F6` |
| GitHub | Dark/Light adaptive | `#171515` / `#F0F0F0` |
| Podcast | Green | `#1DB954` |
| Local | Gray | `#6B7280` |

### Light Mode Palette

```css
/* Background */
--bg-primary:     #FFFFFF;   /* Page/panel background */
--bg-secondary:   #F9FAFB;   /* Sidebar, secondary areas */
--bg-tertiary:    #F3F4F6;   /* Hover states, cards */
--bg-elevated:    #FFFFFF;   /* Modals, dropdowns (with shadow) */

/* Text */
--text-primary:   #111827;   /* Main text (gray-900) */
--text-secondary: #6B7280;   /* Labels (gray-500) */
--text-tertiary:  #9CA3AF;   /* Hints, disabled (gray-400) */

/* Borders */
--border-default: #E5E7EB;   /* Default (gray-200) */
--border-subtle:  #F3F4F6;   /* Subtle dividers (gray-100) */
```

### Dark Mode Palette

```css
/* Background — blue-tinted dark, NOT pure black */
--bg-primary:     #0F1117;   /* Page background */
--bg-secondary:   #161822;   /* Sidebar */
--bg-tertiary:    #1E2030;   /* Hover, cards */
--bg-elevated:    #252840;   /* Modals */

/* Text */
--text-primary:   #F3F4F6;   /* Main text */
--text-secondary: #9CA3AF;   /* Labels */
--text-tertiary:  #6B7280;   /* Hints */

/* Borders */
--border-default: #2D3348;   /* Default */
--border-subtle:  #1E2030;   /* Subtle */
```

### Dark Mode Rules

- KHONG dung pure black (`#000000`) -> dung `#0F1117` (blue-tinted dark)
- Brand purple van dung `#A435F0` — du contrast ca 2 modes
- Shadows trong dark mode: dung `ring` thay vi `shadow`
- Elevated surfaces: lighter than background, KHONG darker

---

## 7. Spacing & Typography

### Spacing Scale (Tailwind-based)

| Token | Value | Usage |
|-------|-------|-------|
| `1` | 4px | Icon gaps, inline spacing |
| `2` | 8px | Tight element spacing |
| `3` | 12px | Default gap between related items |
| `4` | 16px | Section padding, card padding |
| `5` | 20px | Panel padding |
| `6` | 24px | Major section gaps |
| `8` | 32px | Page-level spacing |

### Component Spacing

| Element | Padding | Gap |
|---------|---------|-----|
| Page/Panel | `p-5` (20px) | — |
| Card | `p-4` (16px) | — |
| Section within panel | — | `gap-5` (20px) |
| Related items | — | `gap-3` (12px) |
| Button group | — | `gap-2` (8px) |
| Icon + text | — | `gap-2` (8px) |
| List items | `py-2 px-3` | `gap-1` (4px) |
| Modal | `p-6` (24px) | `gap-4` (16px) |

### Typography Scale

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Display | `text-2xl` (24px) | bold | Page titles (rare, Dashboard only) |
| Heading | `text-lg` (18px) | semibold | Panel titles |
| Subhead | `text-sm` (14px) | semibold | Section titles |
| Body | `text-sm` (14px) | normal | Default text |
| Caption | `text-xs` (12px) | normal | Labels, metadata |
| Micro | `text-[10px]` | medium | Badges, counters |
| Code | `text-sm` (14px) | mono | Code blocks, transcripts |

### Typography Rules

- **Body text**: Luon `text-sm` (14px) — consistent across app
- **NO text larger than 24px** tru Dashboard welcome message
- **Line height**: `leading-relaxed` (1.625) cho reading content, `leading-normal` (1.5) cho UI
- **Font weight**: Chi dung `normal` (400), `medium` (500), `semibold` (600), `bold` (700)

---

## 8. Interaction Patterns

### Transitions & Animations

```css
/* Standard transition for all interactive elements */
transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);

/* Panel resize */
transition: width 200ms ease-out;

/* Modal enter/exit */
transition: opacity 150ms, transform 150ms;
transform: scale(0.95) -> scale(1);  /* enter */
transform: scale(1) -> scale(0.95);  /* exit */

/* Sidebar collapse */
transition: width 200ms ease-out;
/* Icons crossfade, labels fade out */

/* Tab switch content */
transition: opacity 100ms;
/* No slide — instant swap with subtle fade */
```

### Micro-interactions

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Button hover | Background color shift | 150ms |
| Button click | Scale 0.98 + release | 100ms |
| Tab switch | Underline slide + content fade | 150ms |
| Card hover | Border color darken | 150ms |
| Checkbox toggle | Scale bounce 1.1 | 200ms |
| Toast enter | Slide up + fade in | 200ms |
| Modal backdrop | Fade in opacity 0->0.5 | 150ms |
| Skeleton loading | Pulse animation | 1.5s loop |
| Progress bar | Width transition | 500ms ease |
| Drag handle (resize) | Cursor change + highlight | instant |

### Loading States

- **AI generation**: Skeleton shimmer trong output area + "Dang xu ly..." text
- **Data fetching**: Skeleton placeholders matching content shape
- **Button actions**: Spinner icon replace button icon, button disabled
- **Long operations**: Progress bar (import), percentage text

### Empty States

Moi empty state can co:
1. **Icon** (subtle, 48px, muted color)
2. **Title** (1 dong, `text-sm font-semibold`)
3. **Description** (1-2 dong, `text-xs text-muted`)
4. **CTA button** (primary action de bat dau)

---

## 9. Responsive Strategy

### Breakpoint System

| Breakpoint | Width | Layout | Columns |
|------------|-------|--------|---------|
| `sm` | <768px | Mobile | 1 column + bottom nav |
| `md` | 768-1023px | Tablet | 2 column + overlays |
| `lg` | 1024-1279px | Laptop | **2 column** (sidebar + content, AI = sheet overlay) |
| `xl` | >=1280px | Desktop | 3 column full |

### Width Budget per Breakpoint

| Breakpoint | Sidebar | Content (min) | AI Panel | Total |
|------------|---------|---------------|----------|-------|
| `xl` (1280+) | 272px | 400px+ (flex-1) | 480px (resizable 360-600px) | OK |
| `lg` (1024-1279) | 240px | 784px+ (flex-1) | **Sheet overlay** (not inline) | OK |
| `md` (768-1023) | Sheet overlay | Full width | Sheet overlay | OK |
| `sm` (<768) | Sheet overlay | Full width | Full view tab | OK |

**Why lg is 2-column:** At 1024px, sidebar(240) + content(min 400) + AI(400) = 1040px > 1024px. Instead of cramping all 3, AI Panel becomes a slide-in sheet from the right — user toggles explicitly. Content gets full remaining width.

### Responsive Behavior Matrix

| Component | Desktop (xl) | Laptop (lg) | Tablet (md) | Mobile (sm) |
|-----------|-------------|-------------|-------------|-------------|
| Header | Full | Full | Compact | Minimal |
| Sidebar | `w-272` visible | `w-240` visible | Sheet overlay | Sheet overlay |
| Content | `flex-1` | `flex-1` (full remaining) | Full width | Full width |
| AI Panel | `w-480` visible | **Sheet overlay** (toggle) | Sheet/tab | Full screen tab |
| Status Bar | Visible | Visible | Hidden | Hidden |
| Command Palette | `Ctrl+K` | `Ctrl+K` | Hamburger menu | Hamburger menu |

### Touch Adaptations (Tablet/Mobile)

- Tap targets: minimum 44x44px
- Swipe left on sidebar to dismiss
- Swipe right from edge to open sidebar
- Long-press on lesson for context menu (vs right-click on desktop)
- Pull-to-refresh on source list

---

## 10. Feature-Specific Recommendations

### 10.1 Course Management (Sidebar)

**Current**: AddCoursePanel + CourseList stacked in sidebar. **Keep, enhance.**

- Rename `CourseList` -> `SourceList` (support multi-source types)
- Each source card shows: icon badge (by type), title, progress bar, lesson count
- Right-click context menu: Rename, Delete, Export, View Analytics
- Filter tabs above list: `All | Udemy | Book | YouTube | Web | GitHub | Podcast | Local`
- Filter tabs scroll horizontally on narrow sidebar
- Add source button: single unified button -> opens AddSourceModal

```
+------------------------------------------+
| [+ Them nguon] (primary button, full-w)  |
+------------------------------------------+
| [All] [Udemy] [Book] [YouTube] [+3 more] |
+------------------------------------------+
| [icon] React Complete Guide        62%   |
| [icon] Clean Code                  29%   |
| [icon] JS Crash Course            100%   |
+------------------------------------------+
```

### 10.2 Lesson Navigation (Sidebar)

**Current**: LessonList below CourseList. **Keep, enhance.**

- Completion checkbox on each lesson (existing, keep)
- Drag-to-reorder (existing, keep)
- Progress indicators: checkmark (done), quiz score badge
- Active lesson highlighted with brand-500 left border (3px)
- Collapse/expand lesson list when switching between source-level and lesson-level view
- Book content type: show "Chuong 1", "Chuong 2" instead of "Bai 1"

### 10.3 Transcript Viewer/Editor (Content Panel)

**Current**: TranscriptPanel with edit mode. **Keep, enhance.**

- Rename to `ContentPanel` — adapts per source type
- Toolbar at top: `[Edit toggle] [Font size A-/A+] [Fullscreen] [Export]`
- Bottom bar: `[< Prev] [lesson X/Y progress bar] [Next >]`
- Edit mode: subtle yellow/amber background tint to indicate editing
- Selection -> right-click or floating toolbar: "Giai thich doan nay" (send to Explain tab)
- Book mode: rendered Markdown with headings, code blocks
- Code mode: syntax-highlighted code viewer (future v3)

### 10.4 AI Summary (AI Panel Tab)

**Current**: Summary tab, works well. **Keep, minor polish.**

- Primary tab position (1st tab)
- Show skeleton while generating
- Cache indicator: "Da tao luc 14:30" timestamp
- Regenerate button: `[Refresh icon] Tao lai` with confirmation
- Rendered as Markdown with proper heading hierarchy
- Bloom's Taxonomy questions section collapsible (default expanded)

### 10.5 AI Explain (AI Panel Tab)

**Current**: Explain tab with selection support. **Keep, enhance.**

- Primary tab position (2nd tab)
- When text selected in transcript -> auto-switch to Explain tab with selected text
- Show both full-lesson explain AND selected-text explain
- Selected text appears in a quoted block at top of explanation
- Format auto-detection (code-heavy vs concept-heavy) — existing, keep

### 10.6 AI Chat (AI Panel Tab)

**Current**: Chat with streaming + persistence. **Keep, enhance.**

- Primary tab position (3rd tab)
- Message bubbles: user (right, brand-50 bg), assistant (left, transparent)
- Streaming: typewriter effect with cursor
- Input area: auto-resize textarea + send button
- Chat history: load on lesson select, "Xoa lich su" button with confirmation
- Quick prompts above input: "Tom tat ngan", "Giai thich don gian", "Cho vi du"
- Unsaved chat warning (existing, keep)

### 10.7 AI Roadmap (AI Panel — Secondary Tab)

**Current**: Roadmap tab. **Move to secondary group.**

- Accessible via "Them" overflow menu or `Alt+4` (see Section 7 shortcut table)
- Course-level view — shows all lessons with importance ranking
- Visual: vertical timeline with nodes per lesson
- Each node: lesson title, difficulty indicator, estimated time
- Current lesson highlighted
- Clickable — navigate to any lesson

### 10.8 Notes (AI Panel — Secondary Tab)

**Current**: NotesEditor tab. **Move to secondary group.**

- Accessible via "Them" overflow menu or `Alt+5` (see Section 7 shortcut table)
- Rich text editor with Markdown support
- Auto-save with debounce (500ms)
- Per-lesson notes, persistent
- Toolbar: Bold, Italic, Code, Link, List, Heading
- Character/word count at bottom
- Export notes as Markdown

### 10.9 Practice — Quiz (Modal Overlay)

**Current**: QuizPlayer inline in AI Panel. **Move to modal overlay.**

- Trigger from "Luyen tap" dropdown in AI Panel
- Opens centered modal (max-w-2xl)
- Full-focus mode — no transcript distraction
- Question card with 4 options, clear selection state
- Progress: "Cau 3/10" with progress bar
- Results screen: score, correct/wrong breakdown, retry button
- On complete: update lesson progress, close modal

### 10.10 Practice — Flashcard (Full-screen Overlay)

**Current**: FlashcardDeck inline. **Move to full-screen overlay.**

- Trigger from "Luyen tap" dropdown
- Full-screen overlay with dismiss button (top-right X)
- Card flip animation (3D rotate Y-axis, 300ms)
- Simple navigation buttons: Truoc | Sau (no FSRS rating — lesson flashcards are NOT SRS-based, see Section 16)
- Progress: "The 2/5" with mini progress bar
- Swipe gestures on mobile (left = prev, right = next)
- Exit returns to previous view

### 10.11 Practice — Exercise (AI Panel Inline)

**Current**: ExerciseList inline. **Keep inline.**

- Stays in AI Panel because exercises reference transcript
- Code exercises: inline code editor with syntax highlighting
- Written exercises: textarea with submit button
- AI feedback after submission
- Difficulty badges: De | Trung binh | Kho

### 10.12 Analytics/Stats (Separate Route)

**Current**: AnalyticsDashboard + AnalyticsCourseDetail inline. **Move to `/analytics` route.**

- Accessible from: sidebar link, AI Panel analytics preview, Command Palette
- Dashboard view: cross-course overview
  - Study heatmap (GitHub-style, existing)
  - Total time, streak, completion rates
  - Per-source breakdown chart
- Course detail: drill-down per source
  - Lesson completion chart
  - Quiz score progression
  - Time spent per lesson
- Back button to return to Learning View

### 10.13 SRS / Spaced Repetition (Full-screen Route)

**Current**: SRSDashboard + FlashcardDeck. **Dedicate `/review` route.**

- Full-screen distraction-free review mode
- Entry points: Dashboard "SRS due" card, status bar badge, Command Palette
- Review session flow:
  1. Show due count + estimated time
  2. Card-by-card review with FSRS ratings
  3. Session complete screen with stats
- Progress bar at top
- Exit button returns to previous context
- Badge in status bar shows due count (updates real-time)

### 10.14 Export (Dropdown Menu)

**Current**: ExportDropdown component. **Keep as dropdown, reposition.**

- Move to ContentPanel toolbar (top-right)
- Dropdown options: Markdown, PDF, JSON, Copy to clipboard
- Export scope selector: "Bai nay" | "Toan khoa hoc"
- Include AI content toggle: Summary, Notes, Quiz results

### 10.15 Settings (Full Page — `/settings`)

**Current**: SettingsModal with multi-profile. **Upgrade to full page route for multi-user.**

- Route: `/settings` (protected, requires auth)
- Tab/section structure (vertical sidebar nav):
  1. Account (display name, email, avatar, password change, delete account)
  2. AI Profiles (existing, keep — now stored per-user in DB)
  3. Source Configs (Udemy cookie, YouTube API key, etc. — future)
  4. Appearance (theme, font size, density — synced across devices)
  5. Keyboard Shortcuts (reference)
  6. Data Management (export/import personal data, reset my data)
  7. Subscription / Plan (future — billing, usage limits)
- Layout: sidebar nav (left) + content area (right), max-w-4xl centered
- Each section independent, save per-section with optimistic UI
- "Delete Account" requires confirmation dialog with email re-entry

---

## 11. Implementation Priority

### Phase 0: Structural Decomposition (PREREQUISITE)

1. Extract component boundaries from monolithic `page.tsx` (~1000+ lines)
2. Define state management: which state stays in page, which moves to context/hooks
3. Create `useAppState` hook or context for shared state (selectedCourse, selectedLesson, etc.)
4. Extract sidebar into standalone `Sidebar` component with its own state
5. Extract content panel into standalone `ContentPanel` component
6. Establish route ownership: `/dashboard`, `/` (learning), `/analytics`, `/review`, `/settings`
7. Migration checkpoint: ensure extracted components render identically to current

### Phase 1: Authentication & Multi-User Foundation

1. Custom JWT auth system: registration, login, password reset (see Section 17 — Canonical Custom JWT)
2. `/login`, `/register`, `/forgot-password`, `/reset-password` page UI (clean, centered card, brand colors)
3. Protected route middleware (`middleware.ts`): redirect unauthenticated users to `/login`
4. User model in Prisma: `id`, `email`, `name`, `avatar`, `passwordHash`, `preferences` (JSON), `tokenVersion` (Int), `createdAt`
5. Authenticated header: user avatar + dropdown menu (Dashboard, Settings, Logout)
6. `/settings` route skeleton — Account tab only (name, email, password change, delete account)
7. Scope all existing data queries by `userId` (courses, lessons, flashcards, chat history)
8. Legacy data cutover: migrate unscoped records to bootstrap user (see Section 19 — Cutover Protocol)
9. Lesson artifact extraction: move `summary/explanation/quiz/flashcards/exercises/notes` from Lesson to new `LessonArtifact` model (see Section 19 — Artifact Extraction)
10. Preference migration: localStorage → DB with bind-and-clear semantics (see Section 19)
11. Session management: HttpOnly cookie, SameSite=Strict, remember-me expiry, tokenVersion revocation
12. Migration checkpoint: all data scoped, all artifacts extracted, all routes protected, auth flow complete

### Phase 2: Dashboard & Onboarding

1. `/dashboard` route — landing page after login (see Section 18 for design + data contract)
2. First-time user onboarding flow (welcome → add first source → start learning)
3. Returning user dashboard: Continue Learning, SRS Due, Recent Activity, Stats
4. Empty states for all dashboard sections (with CTAs)
5. Schema additions: `Course.lastAccessedAt`, `LessonProgress.completed`, streak fields

### Phase 3: Layout Refactor (High Impact)

1. Refactor AI Panel tab grouping (3 primary + overflow)
2. Add resizable AI Panel (drag handle)
3. Add collapsible sidebar (icon-only mode)
4. Add ContentPanel toolbar (edit, font, export, fullscreen)
5. Add ContentPanel footer (prev/next nav, progress)

### Phase 4: Navigation Enhancement

1. Command Palette (`Cmd+K`)
2. Keyboard shortcut expansion (`Alt+1-6` tabs — see Section 7)
3. Move Quiz to modal overlay
4. Move Flashcard to full-screen overlay

### Phase 5: Route Separation

1. `/analytics` route for Analytics Dashboard
2. `/review` route for SRS Review
3. `/settings` — expand remaining tabs (AI Profiles, Source Configs, Appearance, Shortcuts, Data Management)
4. Status bar with persistent metrics

### Phase 6: Visual Polish

1. Apply new color system (CSS custom properties)
2. Implement dark mode palette refinement
3. Add micro-interactions (button press, tab slide)
4. Empty states with illustrations
5. Loading skeleton improvements

---

## 12. shadcn/ui Component Usage

### Existing (keep)

- `Button`, `Input`, `Label`, `Textarea` — form controls
- `Dialog` / `AlertDialog` — modals and confirmations
- `ScrollArea` — scrollable regions
- `Select` — dropdowns
- `Separator` — dividers
- `Badge` — status indicators
- `Skeleton` — loading states

### Recommended Additions

| Component | Use Case |
|-----------|----------|
| `Tabs` | AI Panel tab bar (replace custom implementation) |
| `Sheet` | Mobile sidebar overlay, tablet AI panel |
| `Command` | Command Palette (Cmd+K) |
| `DropdownMenu` | Practice sub-menu, Export options |
| `Tooltip` | Icon-only sidebar, toolbar buttons |
| `Resizable` | AI Panel drag-to-resize |
| `Popover` | Quick actions, filter options |
| `Progress` | Lesson progress, quiz progress |
| `Toggle` | Edit mode, view toggles |
| `Collapsible` | Sidebar collapse, section expand |
| `Breadcrumb` | Analytics drill-down navigation |

---

## 13. Route & State Ownership

### URL Shape

```
# Public (unauthenticated)
/login                      → Login page
/register                   → Registration page
/forgot-password            → Password reset request
/reset-password?token=      → Password reset form

# Protected (authenticated — redirect to /login if no session)
/dashboard                  → Dashboard (default landing after login)
/                           → Learning View (primary workspace)
/analytics                  → Analytics Dashboard
/analytics/:courseId        → Course Analytics Detail
/review                     → SRS Review Session
/settings                   → User Settings (full page, not modal — multi-user needs more space)
```

### State Ownership Map

| State | Owner | Persistence | Scope |
|-------|-------|-------------|-------|
| Auth session | Server cookie (HttpOnly) | Persistent (JWT/session) | Global |
| User profile | Server DB (`User` table) | Persistent | Per-user |
| Selected source (courseId) | URL search param `?source=` | URL (survives reload) | Per-user (data filtered by userId) |
| Selected lesson (lessonId) | URL search param `?lesson=` | URL (survives reload) | Per-user |
| Active AI tab | URL search param `?tab=` | URL (survives reload) | Session |
| Sidebar collapsed | User preferences (DB) | Persistent across devices | Per-user |
| AI Panel width | User preferences (DB) | Persistent across devices | Per-user |
| Theme (dark/light) | User preferences (DB), CSS fallback `prefers-color-scheme` | Persistent | Per-user |
| AI Profile selection | User preferences (DB) | Persistent | Per-user |
| Chat messages | Component state + API persist | Session + DB | Per-user |
| Transcript edits | Component state (dirty flag) | Until save | Per-user |
| Quiz/Flashcard overlay open | Component state | Session only | Session |
| Return context (from overlay) | Component state stack | Session only | Session |
| Last visited course/lesson | User preferences (DB) | Persistent | Per-user |
| Onboarding completed | User record (DB) | Persistent | Per-user |

### Deep Link & Navigation Recovery

- Browser back/forward: URL params restore source + lesson + tab
- Page reload: URL params restore full context (if authenticated)
- Overlay dismiss: returns to previous source/lesson/tab state
- `/analytics` back button: returns to `/?source=X&lesson=Y&tab=Z`
- `/review` exit: returns to previous URL or `/dashboard`
- **Auth redirect**: unauthenticated access to protected route → `/login?redirect={original_url}`
- **Post-login redirect**: after login → redirect to `?redirect` param OR `/dashboard`
- **Session expiry**: API returns 401 → redirect to `/login?redirect={current_url}&reason=expired`

---

## 14. Accessibility Requirements

### Focus Management

| Surface | Focus Behavior |
|---------|---------------|
| Modal open (Quiz, Add Source) | Trap focus inside, restore on close |
| Sheet open (mobile sidebar) | Trap focus, restore on dismiss |
| Full-screen overlay (Flashcard, SRS) | Trap focus, `Escape` to exit |
| Command Palette | Auto-focus search input, arrow key navigation |
| Tab switch (AI Panel) | Focus first interactive element in new tab |
| Sidebar collapse | Focus moves to content panel |

### Keyboard-Only Navigation

- All interactive elements reachable via `Tab`
- Radix UI primitives handle ARIA roles automatically (Dialog, Tabs, etc.)
- Custom components must include `role`, `aria-label`, `aria-expanded`
- Drag-to-resize: provide keyboard alternative (arrow keys when handle focused)
- Swipe gestures: provide button alternatives on mobile

### Contrast & Visual

- Minimum contrast ratio: 4.5:1 (WCAG AA) for normal text
- 3:1 for large text (>=18px) and UI components
- Focus indicator: 2px solid `--brand-500` outline with 2px offset
- Active states distinguishable by more than color alone (underline, weight, icon)

### Motion & Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- All animations respect `prefers-reduced-motion`
- Flashcard flip: instant swap (no 3D rotation) in reduced-motion
- Skeleton shimmer: static gray block in reduced-motion
- Tab transitions: instant swap (no fade)

### Screen Reader

- Landmark regions: `<header>`, `<nav>` (sidebar), `<main>` (content), `<aside>` (AI panel)
- Live regions: `aria-live="polite"` for AI generation status, chat messages
- `aria-label` on icon-only buttons (sidebar collapsed, toolbar icons)
- `aria-current="page"` on active lesson in sidebar

---

## 15. Responsive Navigation Matrix

| Feature | Desktop (xl+) | Laptop (lg) | Tablet (md) | Mobile (sm) |
|---------|--------------|-------------|-------------|-------------|
| Source List | Sidebar | Sidebar (narrower) | Sheet overlay | Sheet overlay |
| Lesson List | Sidebar | Sidebar | Sheet overlay | Sheet overlay |
| Transcript/Content | Content Panel | Content Panel | Full width | Full width |
| AI Summary | AI Panel tab | AI Panel tab | Bottom sheet | Full view tab |
| AI Explain | AI Panel tab | AI Panel tab | Bottom sheet | Full view tab |
| AI Chat | AI Panel tab | AI Panel tab | Bottom sheet | Full view tab |
| AI Roadmap | AI Panel overflow | AI Panel overflow | Bottom sheet | Full view (via menu) |
| Notes | AI Panel overflow | AI Panel overflow | Bottom sheet | Full view tab |
| Practice (Quiz) | Modal overlay | Modal overlay | Modal overlay | Full screen |
| Practice (Flashcard) | Full-screen overlay | Full-screen overlay | Full-screen | Full screen |
| Practice (Exercise) | AI Panel inline | AI Panel inline | Bottom sheet | Full view |
| Analytics | `/analytics` route | `/analytics` route | `/analytics` route | `/analytics` route |
| SRS Review | `/review` route | `/review` route | `/review` route | `/review` route |
| Collections | Sidebar section | Sidebar section | Sheet section | Sheet section |
| Settings | `/settings` route | `/settings` route | `/settings` route | `/settings` route |
| Export | Content toolbar dropdown | Content toolbar dropdown | Action menu | Action menu |
| Learner Profile | Header avatar dropdown | Header avatar dropdown | Header avatar dropdown | Header avatar dropdown |
| Command Palette | `Ctrl+K` | `Ctrl+K` | Hamburger menu | Hamburger menu |
| Login/Register | Centered card (`max-w-md`) | Centered card | Full width card | Full width card |
| Dashboard | Full page (grid layout) | Full page (stacked) | Full page (stacked) | Full page (single col) |

**Mobile bottom nav:** `[Dashboard] [Learn] [AI] [More]`
- "More" menu provides access to: Analytics, SRS Review, Settings, Profile, Export

---

## 16. Practice & SRS Surface Ownership

### Canonical Surface Map

| Practice Type | Surface | Trigger | Context |
|---------------|---------|---------|---------|
| Quiz | **Modal overlay** (centered, `max-w-2xl`) | AI Panel → "Luyen tap" → "Trac nghiem" | Lesson-local, reads quiz data from lesson AI cache |
| Flashcard (lesson) | **Full-screen overlay** (not route) | AI Panel → "Luyen tap" → "Flashcard" | Lesson-local, reads flashcard data from lesson AI cache |
| Exercise | **AI Panel inline** | AI Panel → "Luyen tap" → "Bai tap" | Lesson-local, references transcript |
| SRS Review | **Route `/review`** | Status bar badge / Command Palette / Dashboard | Cross-lesson, reads from SRS schedule (FlashcardReview table) |

### Key Distinction: Lesson Flashcard vs SRS Review

- **Lesson Flashcard** (overlay): Reviews flashcards generated for ONE lesson. No FSRS scheduling. Entry from AI Panel practice menu. Exit returns to learning view.
- **SRS Review** (route): Reviews DUE flashcards across ALL lessons based on FSRS algorithm. Entry from status bar/command palette. Exit returns to previous route.

### Progress & Resume

- Quiz: progress lost on close (short sessions, no resume needed)
- Flashcard (lesson): progress lost on close (review all in one session)
- SRS Review: progress auto-saved per card rating; resume where left off if interrupted

---

## 17. Multi-User & Authentication

### Auth Architecture (Canonical — Custom JWT)

**Decision:** Custom JWT implementation (NOT NextAuth.js). Rationale: simpler for SQLite/Prisma stack, full control over session lifecycle, no OAuth complexity needed in MVP.

- **Strategy**: Email/password authentication. OAuth (Google, GitHub) deferred to post-MVP.
- **Session token**: Signed JWT (HS256, server-side secret) stored in HttpOnly, Secure, SameSite=Strict cookie named `inkgest_session`.
- **Token payload**: `{ userId, email, tokenVersion, iat, exp }` — includes `tokenVersion` for revocation.
- **Token expiry**: 24 hours default. With "Remember me": 30 days.
- **CSRF**: `SameSite=Strict` cookie attribute (sufficient for same-origin app). No separate CSRF token needed.
- **Password**: bcrypt hash (cost factor 12), minimum 8 characters, no max length cap.
- **Rate limiting**: Login attempts (5/min per IP), registration (3/hour per IP).
- **Session revocation (canonical)**: Include `tokenVersion` (Int) in JWT payload AND User DB record. On every request, middleware verifies JWT signature, checks expiry, then compares `jwt.tokenVersion === user.tokenVersion`. If mismatch → token is revoked → 401. To revoke all sessions: increment `User.tokenVersion` in DB. This is a **server-side version check** — NOT per-user secret rotation.
- **Remember me**: Checkbox on login. Checked = `maxAge: 30 days`. Unchecked = `maxAge: 24 hours`. Both use same JWT mechanism, only expiry differs.
- **Middleware** (`middleware.ts`): Check cookie → verify JWT signature → check expiry → compare `tokenVersion` against DB → reject if any fails → redirect to `/login?redirect={url}`. Public routes exempted by path matcher. Note: `tokenVersion` check requires a DB read per request — cache User record in-memory (LRU, TTL 60s) to minimize DB hits.
- **Password reset flow**: Generate random token (crypto.randomBytes, 32 bytes, hex-encoded), store hashed in DB with 1-hour TTL. On reset: update password hash, increment `User.tokenVersion` (revokes all existing sessions), delete reset token.

### Auth Pages Design

#### Login (`/login`)

```
+---------------------------------------------+
|           Inkgest Logo (centered)            |
|                                              |
|  +---------------------------------------+   |
|  |  Welcome back                         |   |
|  |                                       |   |
|  |  Email:    [_________________________]|   |
|  |  Password: [_________________________]|   |
|  |                                       |   |
|  |  [  Dang nhap  ] (primary, full-w)    |   |
|  |                                       |   |
|  |  Quen mat khau?           Dang ky →   |   |
|  +---------------------------------------+   |
|         max-w-md, centered, card style       |
+---------------------------------------------+
```

- Card: `max-w-md`, centered vertically and horizontally
- Background: subtle gradient or brand pattern
- Error messages: inline below field, red text
- Loading state: button shows spinner, fields disabled
- "Remember me" checkbox: sets longer cookie expiry (30 days vs 24 hours)

#### Register (`/register`)

- Fields: Name, Email, Password, Confirm Password
- Inline validation: email format, password strength meter, confirm match
- After registration: auto-login → redirect to `/dashboard` (onboarding)
- Terms/Privacy links at bottom (future)

#### Forgot Password (`/forgot-password`)

- Single email field → send reset link
- Success: show confirmation message (same UI whether email exists or not — no enumeration)
- Reset link: `/reset-password?token=xxx` (expires in 1 hour)

### Route Protection

```
middleware.ts:
  - Public routes: /login, /register, /forgot-password, /reset-password
  - Protected routes: everything else
  - Unauthenticated access to protected → redirect /login?redirect={url}
  - Authenticated access to /login → redirect /dashboard
```

### Header — Authenticated State

Replace current `[Profile/Model]` button with user avatar dropdown:

```
+--------------------------------------------------------------+
| Inkgest    [Cmd+K Search]      [AI Model]  [Theme]  [Avatar▼]|
+--------------------------------------------------------------+
                                               Avatar dropdown:
                                               +-----------------+
                                               | Nguyen Van A    |
                                               | a@email.com     |
                                               |-----------------|
                                               | Dashboard       |
                                               | Settings        |
                                               |-----------------|
                                               | Dang xuat       |
                                               +-----------------+
```

---

## 18. Dashboard Page Design (`/dashboard`)

### Purpose

Entry point after login. Shows personalized learning overview. Replaces landing on empty content panel.

### Layout — Desktop (xl+)

```
+---------------------------------------------------------------------+
| HEADER (same global header)                                          |
+---------------------------------------------------------------------+
|                                                                      |
|  Good morning, {name}!                    [+ Add Source] (primary)   |
|                                                                      |
|  +---------------------------+  +---------------------------+        |
|  | Continue Learning         |  | SRS Due Today             |        |
|  |                           |  |                           |        |
|  | Course thumbnail + title  |  | 🔴 42 cards due           |        |
|  | Last lesson: "Lesson 5"   |  | Streak: 7 days            |        |
|  | Progress: ████░░ 62%      |  |                           |        |
|  | [Resume] (primary btn)    |  | [Start Review] (secondary)|        |
|  +---------------------------+  +---------------------------+        |
|                                                                      |
|  +--------------------------------------------------------------+   |
|  | My Courses                                          [View All]|   |
|  |                                                               |   |
|  | [Card][Card][Card][Card]  (horizontal scroll or grid)         |   |
|  |                                                               |   |
|  | Each card:                                                    |   |
|  |  - Course thumbnail/icon                                      |   |
|  |  - Title (truncated 2 lines)                                  |   |
|  |  - Progress bar                                               |   |
|  |  - "12 lessons · 4h 30m"                                      |   |
|  |  - Last accessed: "2 days ago"                                |   |
|  +--------------------------------------------------------------+   |
|                                                                      |
|  +---------------------------+  +---------------------------+        |
|  | Study Stats (This Week)   |  | Recent Activity           |        |
|  |                           |  |                           |        |
|  | Time: 4h 20m (+15%)       |  | • Completed "Lesson 12"   |        |
|  | Lessons: 8 completed      |  | • Quiz score: 85% on ...  |        |
|  | Cards reviewed: 120       |  | • Added course: "React.." |        |
|  | Streak: 7 days 🔥         |  | • SRS review: 30 cards    |        |
|  +---------------------------+  +---------------------------+        |
|                                                                      |
+---------------------------------------------------------------------+
```

### Dashboard Sections

| Section | Data Source | Priority | Empty State |
|---------|-----------|----------|-------------|
| Greeting + Quick Actions | User name + time of day | Always shown | Generic greeting |
| Continue Learning | Last accessed course + lesson | High | Hidden if no courses |
| SRS Due Today | FlashcardReview table (due <= today) | High | "No cards due — great job!" |
| My Courses | User's courses, sorted by lastAccessed | High | Onboarding CTA (see below) |
| Study Stats | Aggregated from StudySession table | Medium | "Start learning to see stats" |
| Recent Activity | Activity log (last 7 days) | Low | "No recent activity" |

### Dashboard Data Contract

Every dashboard card has a formal data source, required schema, and fallback:

| Card/Metric | Source of Truth | Required Schema Fields | Backfill (migrated users) | Loading State | Error State |
|-------------|----------------|----------------------|--------------------------|---------------|-------------|
| Greeting | `User.name` + server `new Date()` | `User.name` | Use email prefix if name empty | Static text | Show "Hello!" |
| Continue Learning — course | `Course` with max `lastAccessedAt` | `Course.lastAccessedAt` (DateTime) | Set to `Course.createdAt` if NULL | Skeleton card | Hide section |
| Continue Learning — lesson | `LessonProgress` with max `updatedAt` for above course | `LessonProgress.updatedAt`, `Lesson.title` | Set to first lesson of course | Skeleton card | Show course without lesson |
| Continue Learning — progress | `COUNT(LessonProgress WHERE completed) / COUNT(Lesson)` for course | `LessonProgress.completed` (Boolean) | 0% if no progress records | Progress bar skeleton | Show "—%" |
| SRS Due Count | `COUNT(FlashcardReview WHERE nextReviewAt <= now())` | `FlashcardReview.nextReviewAt` (DateTime) | 0 (no reviews exist yet) | Skeleton badge | Show "—" |
| SRS Streak | `User.preferences.srsStreak` + `User.preferences.lastSrsDate` | JSON fields on User.preferences | 0 days | Skeleton text | Show "0 days" |
| My Courses — list | `Course WHERE userId = ? ORDER BY lastAccessedAt DESC LIMIT 8` | `Course.title`, `Course.thumbnailUrl` (nullable), `Course.lastAccessedAt` | All courses with `createdAt` as fallback sort | Skeleton grid (4 cards) | Show empty + retry button |
| My Courses — lesson count | `COUNT(Lesson WHERE courseId = ?)` | Aggregation query | Accurate (lessons exist) | "— lessons" | Show "?" |
| Study Stats — time | `SUM(StudySession.durationMs) WHERE createdAt >= weekStart` | `StudySession.durationMs`, `StudySession.createdAt` | 0h 0m (no sessions) | Skeleton | Show "—" |
| Study Stats — lessons | `COUNT(DISTINCT LessonProgress WHERE completed AND updatedAt >= weekStart)` | `LessonProgress.completed`, `LessonProgress.updatedAt` | 0 | Skeleton | Show "—" |
| Study Stats — cards | `COUNT(FlashcardReview WHERE createdAt >= weekStart)` | `FlashcardReview.createdAt` | 0 | Skeleton | Show "—" |
| Recent Activity | Application-level activity log (future table or derived from existing) | Deferred — derive from `StudySession`, `FlashcardReview`, `Course.createdAt` timestamps | Empty list | Skeleton list (4 items) | Hide section |

**Schema additions required for dashboard:**
- `Course.lastAccessedAt` — DateTime, nullable, updated on lesson view
- `LessonProgress.completed` — Boolean, default false
- `User.preferences.srsStreak` — Int, default 0
- `User.preferences.lastSrsDate` — String (ISO date), nullable

### First-Time User (Empty Dashboard)

```
+---------------------------------------------------------------------+
| HEADER                                                               |
+---------------------------------------------------------------------+
|                                                                      |
|  Welcome to Inkgest! 👋                                              |
|                                                                      |
|  +--------------------------------------------------------------+   |
|  |                                                               |   |
|  |     [illustration: person studying with AI assistant]         |   |
|  |                                                               |   |
|  |  Hoc thong minh hon voi AI                                    |   |
|  |                                                               |   |
|  |  Them khoa hoc Udemy hoac video YouTube                       |   |
|  |  de bat dau hoc voi tro ly AI ca nhan.                        |   |
|  |                                                               |   |
|  |  [+ Them khoa hoc dau tien] (primary, large)                  |   |
|  |                                                               |   |
|  +--------------------------------------------------------------+   |
|                                                                      |
|  How it works:                                                       |
|  [1. Add Source] → [2. AI Summarizes] → [3. Practice & Review]       |
|                                                                      |
+---------------------------------------------------------------------+
```

### Responsive — Dashboard

| Breakpoint | Layout |
|-----------|--------|
| xl+ (>=1280px) | 2-column grid for cards, horizontal course scroll |
| lg (1024-1279px) | 2-column grid, slightly narrower cards |
| md (768-1023px) | Single column, full-width cards stacked |
| sm (<768px) | Single column, compact cards, stats as horizontal scroll chips |

### Navigation — Dashboard to Learning

- Click course card → navigate to `/?source={courseId}`
- Click "Resume" on Continue Learning → navigate to `/?source={courseId}&lesson={lessonId}`
- Click "Start Review" → navigate to `/review`
- Click "+ Add Source" → open Add Source dialog (same as sidebar "Add Source" button)

---

## 19. Data Scoping & Privacy

### Multi-User Data Isolation

**Principle:** Every database query that returns user-specific data MUST include `WHERE userId = ?`. No shared data between users.

### Canonical Entity-Ownership Matrix

Every entity falls into exactly one ownership category:

| Entity | Ownership Type | Scoping Mechanism | Shared? | Notes |
|--------|---------------|-------------------|---------|-------|
| User | Identity | `id` (self) | No | Root of all ownership |
| Course | **User-owned source** | Direct `userId` FK | No | Each user imports own courses — no shared catalog |
| Lesson | **User-owned source** (inherited) | Via `Course.userId` | No | Always accessed through parent Course |
| ChatMessage | **User-owned artifact** | Direct `userId` FK + `lessonId` | No | Per-user, per-lesson conversations |
| LessonArtifact (summary, explanation, quiz, flashcards, exercises, notes) | **User-owned artifact** | Direct `userId` FK + `lessonId` + `type` unique | No | Extracted from Lesson model — see Artifact Extraction subsection |
| Flashcard | **User-owned artifact** | Direct `userId` FK | No | Per-user flashcard decks |
| FlashcardReview | **User-owned progress** | Direct `userId` FK + `flashcardId` | No | SRS schedule entries |
| StudySession | **User-owned progress** | Direct `userId` FK | No | Time tracking records |
| LessonProgress | **User-owned progress** | Direct `userId` FK + `lessonId` | No | Completion, time spent per lesson |
| AIProfile | **User-owned config** | Direct `userId` FK | No | AI model/prompt profiles |
| User.preferences | **User-owned config** | JSON column on User | No | Theme, layout, shortcuts |

**Ownership types:**
- **User-owned source**: Content the user imported (courses, lessons). Direct `userId` FK.
- **User-owned artifact**: Content generated from sources (AI outputs, chat, flashcards). Direct `userId` FK.
- **User-owned progress**: Tracking data (study sessions, SRS reviews, lesson progress). Direct `userId` FK.
- **User-owned config**: Settings and preferences. On User record or via direct `userId` FK.

**Scoping rules:**
1. **Direct-FK entities** (Course, ChatMessage, Flashcard, etc.): Query with `WHERE userId = ?`
2. **Inherited entities** (Lesson): Query with `JOIN Course ON Course.id = Lesson.courseId WHERE Course.userId = ?`
3. **Never trust client-provided userId** — always extract from server session
4. **No shared/public entities exist** in current design. If added later (e.g., shared course catalog), add explicit `visibility` enum (`private | public`) and separate query paths.

### Lesson Artifact Extraction (CRITICAL — Pre-Multi-User)

**Problem:** Current Prisma schema stores AI-generated artifacts directly on the `Lesson` model:
- `Lesson.summary` (String?) — AI-generated summary
- `Lesson.explanation` (String?) — AI-generated explanation
- `Lesson.quiz` (String?) — AI-generated quiz JSON
- `Lesson.flashcards` (String?) — AI-generated flashcard JSON
- `Lesson.exercises` (String?) — AI-generated exercises JSON
- `Lesson.notes` (String?) — User notes

These are **user-owned artifacts**, NOT source content. In multi-user mode, each user needs their own AI outputs per lesson. Keeping them on `Lesson` violates the "no shared entities" rule and will cause data leaks.

**Target schema — new `LessonArtifact` model:**

```prisma
model LessonArtifact {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  lessonId    String
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  type        String   // "summary" | "explanation" | "quiz" | "flashcards" | "exercises" | "notes"
  content     String   // The artifact content (text or JSON string)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, lessonId, type])  // One artifact per type per user per lesson
}
```

**Migration from `Lesson` fields → `LessonArtifact`:**

1. **Timing:** Execute in Phase 1 (Auth Foundation), AFTER legacy data cutover assigns `userId` to all Courses.
2. **Migration script** (`prisma/migrations/xxx_extract_lesson_artifacts.ts`):
   - For each Lesson that has non-null artifact fields:
     - Resolve `userId` via `Lesson → Course → Course.userId`
     - For each non-null field (`summary`, `explanation`, `quiz`, `flashcards`, `exercises`, `notes`):
       - Create `LessonArtifact { userId, lessonId, type: fieldName, content: fieldValue }`
   - After extraction: set original `Lesson` fields to NULL (keep columns temporarily for rollback)
3. **Verification:** Assert `COUNT(LessonArtifact) = COUNT(non-null artifact fields across all Lessons)`
4. **Column removal:** In a SEPARATE follow-up migration, drop `summary`, `explanation`, `quiz`, `flashcards`, `exercises`, `notes` columns from `Lesson` table. Only run after verification passes.
5. **Rollback:** Before column removal, artifacts can be restored to Lesson fields from LessonArtifact records.

**Query pattern change:**
```
// BEFORE (single-user):
const lesson = await prisma.lesson.findUnique({ where: { id } })
const summary = lesson.summary

// AFTER (multi-user):
const artifact = await prisma.lessonArtifact.findUnique({
  where: { userId_lessonId_type: { userId, lessonId, type: "summary" } }
})
const summary = artifact?.content
```

**Sequencing in Phase 1:**
1. Legacy data cutover (assign userId to Courses) — step 8
2. Lesson artifact extraction (this subsection) — NEW step 8b
3. All data scoped, all routes protected — step 11 (re-verified)

### Preference Migration (localStorage → DB)

**One-time migration with bind-and-clear semantics** (fixes ISSUE-5 cross-account bleed):

| localStorage Key | New Location | Migration Strategy |
|-----------------|-------------|-------------------|
| `theme` | `User.preferences.theme` | Read on first login, write to DB, delete localStorage |
| `sidebar-collapsed` | `User.preferences.sidebarCollapsed` | Same |
| `ai-panel-width` | `User.preferences.aiPanelWidth` | Same |
| `ai-profile` | `User.preferences.aiProfile` | Same |
| `selected-model` | `User.preferences.selectedModel` | Same |

**Migration protocol:**
1. On first authenticated login, check `localStorage.getItem('inkgest_migrated')`.
2. If not migrated: read all keys above, POST to `/api/user/preferences/migrate`, on success set `localStorage.setItem('inkgest_migrated', userId)` and **delete all migrated keys**.
3. If already migrated (value = different userId): **skip migration entirely** — do not read legacy keys. This prevents User B from inheriting User A's leftover preferences.
4. **After migration completes**: localStorage is NEVER consulted for preferences again. Only DB → system default fallback chain.
5. **Fallback chain (post-migration):** DB preference → system default. No localStorage in chain.

**Legacy fallback (pre-migration only):** DB preference → localStorage → system default. Only active during the migration window.

### Legacy Single-User Data Cutover

**Scope:** Existing single-user data (courses, lessons, flashcards, chat history, study sessions) created before auth was introduced.

**Bootstrap protocol:**
1. **First registration** creates the "bootstrap user" account.
2. **Migration script** (`prisma/migrations/xxx_assign_legacy_data.ts`):
   - Find all records with `userId = NULL` (legacy unscoped data).
   - Assign ALL to bootstrap user's `userId`.
   - Affected entities (in order): Course → Lesson (inherited) → ChatMessage → Flashcard → FlashcardReview → StudySession → LessonProgress → AIProfile.
   - Order matters: Course first (Lesson inherits via FK), then artifacts, then progress.
3. **Idempotency:** Migration checks `WHERE userId IS NULL` — running twice is safe (no unscoped records remain after first run).
4. **Verification:** After migration, assert `COUNT(*) WHERE userId IS NULL = 0` for every table.
5. **Rollback:** Migration creates backup table `_legacy_ownership_backup` with `(table, recordId, assignedUserId, timestamp)`. Rollback script reverses by setting `userId = NULL` for backed-up records.
6. **Second+ registrations:** Only create empty user account. No legacy data to claim.
7. **Cutover gate:** App refuses to start in multi-user mode until migration has run (checked via `_prisma_migrations` table).

### API Security

- All API routes: validate JWT session token via middleware
- All data-fetching routes: filter by `userId` from session (NEVER from client request body)
- File uploads: scoped to user directory (`/data/{userId}/`)
- Rate limiting per-user: AI generation (20/min), chat (60/min), CRUD (120/min)
- Input validation: Zod schemas on all API inputs
- CORS: restrict to app domain only

### Authorization Matrix

Authorization is enforced at **every data boundary**, not just route middleware.

| Layer | Check | Failure Behavior |
|-------|-------|-----------------|
| Middleware (`middleware.ts`) | JWT valid + not expired | Redirect to `/login?redirect={url}` |
| API route handler | `userId` from session exists | 401 Unauthorized |
| Data loader (server component) | Entity exists + `entity.userId === sessionUserId` | 404 Not Found (not 403, to prevent enumeration) |
| URL param validation (`?source=`, `?lesson=`) | Course/Lesson exists + owned by user | Redirect to `/dashboard` with toast "Resource not found" |
| Deep link recovery | Validate all URL params against user ownership | Strip invalid params, fallback to `/dashboard` |
| File access (`/data/{userId}/`) | Path prefix matches session userId | 403 Forbidden |

**URL parameter authorization flow:**
1. Parse `?source=courseId` from URL
2. Query `Course WHERE id = courseId AND userId = sessionUserId`
3. If not found → redirect to `/dashboard`, show toast "Khoa hoc khong ton tai"
4. Same for `?lesson=lessonId` — validate lesson belongs to user's course
5. If `?tab=` is invalid → fallback to default tab (no error)

**Stale/crafted deep link handling:**
- Deleted course/lesson → treat as not found, redirect to `/dashboard`
- Other user's resource → treat as not found (same behavior, no information leak)
- Expired share link (future) → show "Link het han" page

### Account Lifecycle

| Event | Action |
|-------|--------|
| Registration | Create User, set default preferences, redirect to `/dashboard` |
| Login | Create session cookie, load preferences, redirect to `/dashboard` or `?redirect` |
| Logout | Destroy session cookie, redirect to `/login` |
| Delete Account | Soft-delete (30-day grace), then hard-delete all user data |
| Password Reset | Invalidate all existing sessions, force re-login |
| Inactivity (90 days) | Send re-engagement email (future) |

---

> **Note:** This document is a living recommendation. Update as features are implemented and user feedback is collected. All ASCII wireframes are approximate — final pixel-perfect designs should be validated in-browser.
