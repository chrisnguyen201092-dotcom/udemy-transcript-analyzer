# AI Prompts Design Document — Learning Science Justification

## Overview

Three system prompts for Udemy lesson transcript processing, grounded in evidence-based learning science.

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

## Cross-Cutting Design Principles

### 1. Transcript Resilience
All prompts include explicit instructions for handling messy transcripts (repetition, noise, poor formatting). This is critical because Udemy transcripts are often auto-generated and imperfect.

### 2. No Hallucination
Each prompt contains explicit "KHÔNG bịa thêm thông tin" (do not fabricate) with a nuanced distinction:
- Summary: Strict — extract only what's there
- Explain: Allowed to add illustrative examples to clarify existing concepts
- Chat: Strict + hedging language when uncertain

### 3. Model-Agnostic
- No model-specific tokens or formatting
- Clear structure with markdown (universally supported)
- Template-style format with [placeholders] works across OpenAI, Qwen, Llama, etc.

### 4. Vietnamese-First
- All prompts written in Vietnamese to avoid translation artifacts
- Cultural tone: respectful but approachable (not overly formal)
- English terms preserved in parentheses for technical accuracy

---

## Usage

```typescript
import { getSystemPrompt } from "@/lib/ai/prompts";

// In your API route:
const systemPrompt = getSystemPrompt("summary"); // or "explain" or "chat"
```
