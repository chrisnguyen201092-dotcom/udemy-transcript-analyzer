# AI Prompts Design Document — Learning Science Justification

## Overview

Seven system prompts for Udemy lesson transcript processing, grounded in evidence-based learning science. All prompts are managed via `getSystemPrompt(type)` dispatcher in `src/lib/ai/prompts.ts`.

**Prompt types:** `summary`, `explain`, `chat`, `roadmap`, `quiz`, `flashcards`, `exercises`

---

## 1. SUMMARY_SYSTEM_PROMPT

### Role: "Instructional Designer"
**Why not "AI assistant":** Primes the model to think structurally about information architecture, not just compress text.

### Structure Justification

| Section | Learning Science Principle | Why It Works |
|---------|--------------------------|--------------|
| 🎯 Ý chính trong 1 câu | **Advance Organizer** (Ausubel, 1960) | A single anchoring sentence creates a schema for all details to attach to. Learners who receive advance organizers retain 20-30% more (Mayer, 2009). |
| 📋 Các điểm chính | **Chunking** (Miller, 1956) | 3-7 items matches working memory capacity. Bold concept names + 1-2 sentence explanations enable scanning. |
| 💡 Ví dụ/Ứng dụng | **Concrete Examples Effect** (Rawson et al., 2015) | Abstract concepts paired with concrete examples improve transfer by ~40%. |
| 🔗 Sơ đồ liên kết | **Dual Coding** (Paivio, 1986) + **Elaborative Interrogation** | Text-based diagrams create visual-spatial encoding alongside verbal. Shows relationships, not just lists. |
| 🧠 Thủ thuật ghi nhớ | **Mnemonic Devices** (Putnam, 2015) | Acronyms, rhymes, and vivid imagery encode into long-term memory via multiple pathways. |
| ✅ Tự kiểm tra | **Testing Effect** (Roediger & Karpicke, 2006) | Self-testing produces 50%+ better retention than re-reading. Mixed Bloom levels ensure depth. |

### Expected Output: Scannable in 2-3 minutes
- ~300-500 words total
- 5 clearly delineated sections with emoji markers
- Visual hierarchy via headers, bold, and indentation

---

## 2. EXPLAIN_SYSTEM_PROMPT

### Role: "University Lecturer using Feynman Technique"
**Why:** The Feynman Technique (explain to a beginner) forces the model to decompose jargon into accessible language. Research shows explanation-based learning improves comprehension 2x vs. passive reading.

### Structure Justification

| Section | Learning Science Principle | Why It Works |
|---------|--------------------------|--------------|
| 🎬 Bối cảnh & Mục tiêu | **Goal Orientation** (Locke & Latham, 2002) | Knowing the "why" before the "what" increases motivation and retention. |
| 🏗️ Nền tảng cần biết | **Scaffolding** (Vygotsky ZPD) | Identifying prerequisites prevents cognitive overload from missing foundational knowledge. |
| 📖 Pattern: Định nghĩa → Tại sao → Cách → Ví dụ → So sánh | **Bloom's Taxonomy progression** + **Analogical Reasoning** (Gentner, 1983) | Moves from Remember → Understand → Apply. Analogies bridge unknown to known (transfer). |
| ⚡ Lỗi thường gặp | **Negative Knowledge** (Oser & Spychiger, 2005) | Learning what NOT to do is as important as learning what to do. ❌→✅ format creates strong contrast encoding. |
| 🗺️ Bức tranh tổng thể | **Schema Theory** (Bartlett, 1932) | Connecting concepts into a coherent mental model enables far transfer. |
| 🎯 Kiểm tra hiểu biết | **Bloom's Taxonomy** (Anderson & Krathwohl, 2001) | Color-coded difficulty (🟢🟡🟠🔴) lets learners self-assess at appropriate levels. |
| 🚀 Bước tiếp theo | **Curiosity Gap** (Loewenstein, 1994) | Suggesting next topics maintains learning momentum without overwhelming. |

### Expected Output: 5-10 minute read
- ~800-1500 words depending on complexity
- Deep but not overwhelming — each concept fully unpacked before moving on
- Code blocks preserved with Vietnamese comments when applicable

---

## 3. CHAT_SYSTEM_PROMPT

### Role: "Socratic AI Tutor"
**Why:** Socratic questioning (Paul & Elder, 2007) develops critical thinking. Unlike a chatbot that just answers, a tutor GUIDES reasoning.

### Design Decisions

| Element | Rationale |
|---------|-----------|
| Question-type routing | Different question types need different pedagogical responses. A "what is X?" needs definition + example. A "why?" needs causal reasoning. Routing prevents generic answers. |
| Socratic over direct answers | Research: students who derive answers through guided questioning retain 60% more than those given answers directly (Chi et al., 2001). |
| "Anh/chị khóa trên" tone | Vietnamese learning culture values mentorship and relational learning. A senior peer tone reduces anxiety while maintaining authority. |
| 200-300 word limit | Chat should feel conversational, not like another lecture. Short responses encourage multi-turn dialogue. |
| Three ending types (💬/💡/✅) | Prevents dead-end responses. Each ending maintains engagement or provides closure. |
| Boundary handling | Redirecting off-topic questions back to the lesson prevents hallucination and keeps learning focused. |

### Expected Output: Conversational, 200-300 words
- Feels like texting a smart tutor
- Always ends with engagement hook or clear closure
- Uses markdown formatting naturally (bold, code, tables when comparing)

---

## 4. ROADMAP_SYSTEM_PROMPT

### Role: "Learning Consultant (Andragogy + Deliberate Practice)"
**Why:** Course-level analysis requires a different persona than lesson-level. A Learning Consultant thinks about the entire learning journey, not just individual topics.

### Design Decisions

| Element | Rationale |
|---------|-----------|
| Course-level aggregation | Roadmap analyzes ALL lessons (truncated to 4000 chars each) to build a holistic view |
| Phân giai đoạn (Phased learning) | **Scaffolding** + **Deliberate Practice** (Ericsson, 1993) — structured progression from foundation → intermediate → advanced prevents overwhelm |
| Bản đồ kiến thức | **Schema Theory** (Bartlett, 1932) — visualizing concept relationships helps learners see the big picture before diving into details |
| Kế hoạch tuần (Weekly plan) | **Spaced Practice** (Cepeda et al., 2006) — distributing study over time improves long-term retention vs. cramming |
| Dự án tổng hợp | **Project-Based Learning** (Blumenfeld et al., 1991) — integrative projects consolidate knowledge across multiple lessons |
| Phương pháp học tối ưu | **Metacognition** (Flavell, 1979) — teaching HOW to learn is as important as WHAT to learn |

### Expected Output: Comprehensive roadmap
- Course overview, phased learning stages, knowledge map
- Optimal study methods, integrative projects, weekly schedule
- Personalized to course content (not generic advice)

---

## 5. QUIZ_SYSTEM_PROMPT

### Role: "Assessment Designer (Item Response Theory)"
**Why:** Well-designed assessments require expertise in psychometrics. An Assessment Designer creates questions that genuinely test understanding, not just recall.

### Design Decisions

| Element | Rationale |
|---------|-----------|
| 8-12 questions | Enough for comprehensive coverage without fatigue (Haladyna et al., 2002) |
| 3 Bloom's levels | **Bloom's Taxonomy** — questions distributed across Remember, Understand, Apply ensures depth beyond surface-level recall |
| 5 question types | Mixed formats (MCQ, T/F, fill-blank, short answer, code completion) test different cognitive skills |
| Realistic distractors | **Item Response Theory** — distractors based on common misconceptions reveal actual understanding gaps |
| Detailed explanations | **Elaborative feedback** (Butler et al., 2008) — explaining WHY an answer is correct/incorrect produces deeper learning than simple correct/incorrect feedback |

### Expected Output: Interactive quiz
- 8-12 questions with answers and explanations
- Parsed by `QuizPlayer.tsx` → clickable MCQ interface
- Bloom's distribution visible in question labels

---

## 6. FLASHCARD_SYSTEM_PROMPT

### Role: "Flashcard Designer (SRS + Piotr Wozniak)"
**Why:** Effective flashcards follow strict principles from spaced repetition research. A specialized persona ensures cards are atomic and optimally formulated.

### Design Decisions

| Element | Rationale |
|---------|-----------|
| 15-25 cards | Comprehensive coverage without overwhelm for a single lesson |
| Minimum Information Principle | **Wozniak's 20 Rules** — each card tests exactly ONE fact/concept for optimal retention |
| 5 card types | Different knowledge types need different card formats: Term→Def, Concept→Explain, Code→Output, Scenario→Solution, Compare→Diff |
| Active recall cues | Cards designed to TRIGGER recall, not passively present information |
| Mnemonics included | **Mnemonic Devices** (Putnam, 2015) — memory aids on cards boost retention via multiple encoding pathways |

### Expected Output: Flashcard deck
- 15-25 atomic cards with front/back
- Parsed by `FlashcardDeck.tsx` → flip card interface with navigation
- Each card self-contained and recall-optimized

---

## 7. EXERCISES_SYSTEM_PROMPT

### Role: "Practice Exercise Designer (Deliberate Practice + PBL)"
**Why:** Practice exercises need structured scaffolding from simple recall to creative application. A specialized designer ensures progressive difficulty.

### Design Decisions

| Element | Rationale |
|---------|-----------|
| 3-5 exercises | Focused practice on key concepts without overwhelming |
| 5 difficulty tiers | Tái hiện → Mở rộng → Sáng tạo → Debug → Mini Project — progressive challenge (**Deliberate Practice**, Ericsson 1993) |
| Auto-classify content type | Lý thuyết / Thực hành / Hỗn hợp — detection from transcript determines exercise style |
| Rubric đánh giá | Clear success criteria help learners self-assess (**Self-Regulated Learning**, Zimmerman 2002) |
| Lời giải tham khảo | Complete reference solutions prevent learned helplessness while still encouraging independent attempt first |

### Expected Output: Practice exercises
- 3-5 exercises with difficulty classification
- Parsed by `ExerciseList.tsx` → accordion interface with expandable solutions
- Each exercise has rubric + reference solution

---

## Cross-Cutting Design Principles

### 1. Transcript Resilience
All prompts include explicit instructions for handling messy transcripts (repetition, noise, poor formatting). This is critical because Udemy transcripts are often auto-generated and imperfect.

### 2. No Hallucination
Each prompt contains explicit "KHÔNG bịa thêm thông tin" (do not fabricate) with a nuanced distinction:
- Summary: Strict — extract only what's there
- Explain: Allowed to add illustrative examples to clarify existing concepts
- Chat: Strict + hedging language when uncertain
- Quiz/Flashcard/Exercises: Based on transcript content; exercises may extend concepts
- Roadmap: Infers from lesson content; does not invent topics not covered

### 3. Model-Agnostic
- No model-specific tokens or formatting
- Clear structure with markdown (universally supported)
- Template-style format with [placeholders] works across OpenAI, Qwen, Llama, etc.
- Think-tag suppression handles reasoning models (DeepSeek, etc.)

### 4. Vietnamese-First
- All prompts written in Vietnamese to avoid translation artifacts
- Cultural tone: respectful but approachable (not overly formal)
- English terms preserved in parentheses for technical accuracy

### 5. DRY Architecture
- Shared builder functions: `buildASRRules(inferenceSource, fallback?)`, `buildLanguageRules(translationStyle)`
- Each prompt reuses common rules via builders, customizing only what differs
- `getSystemPrompt(type)` dispatcher centralizes prompt selection

### 6. AI Context Enrichment
- User messages include `lessonIndex` and `totalLessons` for positional context
- AI knows where the lesson sits within the overall course structure
- Enables more contextual responses (e.g., "this is an introductory lesson" vs. "this builds on previous concepts")

---

## Usage

```typescript
import { getSystemPrompt } from "@/lib/ai/prompts";

// In your API route:
const systemPrompt = getSystemPrompt("summary");    // or "explain", "chat", "roadmap", "quiz", "flashcards", "exercises"
```

### Available prompt types:

| Type | Route | Persona | Output Target |
|------|-------|---------|---------------|
| `summary` | `/api/ai/summary` | Instructional Designer | `Lesson.summary` |
| `explain` | `/api/ai/explain` | Feynman Lecturer | `Lesson.explanation` |
| `chat` | `/api/ai/chat` | Socratic Tutor | Streaming (no persist) |
| `roadmap` | `/api/ai/roadmap` | Learning Consultant | `Course.roadmap` |
| `quiz` | `/api/ai/quiz?mode=quiz` | Assessment Designer | `Lesson.quiz` |
| `flashcards` | `/api/ai/quiz?mode=flashcards` | Flashcard Designer (SRS) | `Lesson.flashcards` |
| `exercises` | `/api/ai/quiz?mode=exercises` | Exercise Designer (DP) | `Lesson.exercises` |
