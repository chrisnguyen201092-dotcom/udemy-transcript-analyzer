# Educational Prompt Engineering Research
> Research findings for rewriting Udemy app summary & explain system prompts.
> Sources: Khan Academy/Khanmigo (2023), Structural Learning Bloom's Guide (Mar 2026), Edodo Framework (Jan 2026), MeraTutor Guide (Jan 2026), AiUnpacker Templates (Jan 2026).

---

## 1. DIAGNOSIS: What's Wrong With the Current Prompts

**Current summary system prompt:**
> "Bạn là một trợ lý AI giỏi về tóm tắt nội dung học tập. Hãy tóm tắt bài học một cách ngắn gọn, dễ hiểu bằng tiếng Việt. Trả lời ngắn gọn, đi thẳng vào vấn đề."

**Current explain system prompt:**
> "Bạn là một giáo viên giỏi, giải thích bài học chi tiết, dễ hiểu bằng tiếng Việt."

**Problems:**
- No cognitive scaffolding — AI defaults to Bloom's *Remember* level (lists, definitions)
- No output FORMAT specified → wall-of-text or generic bullets
- No CONSTRAINTS for retention (no misconception flags, no analogies, no "so what")
- No ROLE specificity — "good teacher" is too vague
- No learning science principles encoded (retrieval cues, elaboration, analogies)

---

## 2. THE 5-PILLAR FRAMEWORK

Source: Edodo Educator Framework (Jan 2026) + AiUnpacker 8 Templates (Jan 2026)

Every high-quality educational prompt contains:

| Pillar | What it does | Example |
|--------|-------------|---------|
| **Role** | Aligns AI cognition to purpose | "Expert curriculum designer applying cognitive science" |
| **Task** | Specific, verb-driven action | "Synthesize and scaffold" NOT "summarize" |
| **Context** | Learning objectives, learner level, domain | "Adult learner, video transcript, software dev course" |
| **Format** | Exact output structure | Cornell notes, Feynman sections, headers |
| **Constraints** | What to AVOID + what to INCLUDE | "No walls of text. Flag misconceptions. Include 1 analogy." |

> "Vague inputs produce vague outputs. Education is a high-context profession."
> — Vivek M Agarwal, Edodo (Jan 2026)

---

## 3. KHAN ACADEMY'S KHANMIGO FRAMEWORK (7 Steps)

Source: https://blog.khanacademy.org/khan-academys-7-step-approach-to-prompt-engineering-for-khanmigo/

Key principles from Khan Academy's Khanmigo prompt engineering:

1. **Model the 2-Sigma ideal** — Benjamin Bloom found 1-on-1 tutoring = +2 std devs. Design prompts to simulate that.
2. **Ground in learning science** — Meet learners where they are, tie concepts to interests, prompt self-explanation.
3. **Goldilocks edge** — Push past recall, clear misconceptions, trigger active learning (not too hard, not too easy).
4. **Socratic mode** — NEVER give the answer directly. Ask guiding questions instead.
5. **Build on prior knowledge** — Connect new concepts to what the learner already knows.
6. **Specific feedback** — Not "good job" but "That's correct because X; notice Y is different."
7. **Prompt self-explanation** — "Can you explain why this works in your own words?"

**Reconstructed Khanmigo System Prompt Pattern:**
```
You are an expert tutor using Socratic questioning.
Your goal: help the learner UNDERSTAND deeply, not just recall facts.
- NEVER give direct answers — ask questions that lead there
- If stuck, give a hint (not the solution)  
- Connect concepts to real-world examples
- Gently correct misconceptions
- Keep learner at their "productive struggle" zone
```

---

## 4. BLOOM'S TAXONOMY INTEGRATION

Source: https://www.structural-learning.com/post/ai-prompts-blooms-taxonomy-teachers-guide (Mar 28, 2026)

**Critical insight:** AI defaults to the LOWEST cognitive level (Remember) without explicit instruction.

### Level Mapping for This App:

| Bloom Level | Prompt Verb | Use For |
|-------------|------------|---------|
| Remember | List, Define | AVOID — generic output |
| **Understand** | **Explain WHY, Paraphrase, Analogy** | **SUMMARY endpoint** |
| **Apply** | **Demonstrate, Show how, Trace** | **EXPLAIN endpoint** |
| Analyse | Compare, Break down, Cause-Effect | Deep dive features |
| Evaluate | Assess, Argue, Judge | Advanced discussions |

### Structural Learning Thinking Framework → Bloom's:

| Operation | Level | Prompt Pattern |
|-----------|-------|----------------|
| Part-Whole | Understand | "Identify the components of [X] and what each does" |
| Sequence | Apply | "Order the stages of [X], explaining cause→effect at each step" |
| Compare | Analyse | "Compare [A] vs [B] — when would you choose each?" |
| Cause-Effect | Analyse | "Trace the chain: why does [problem] happen when you do [X]?" |
| Analogy | Understand | "Explain [concept] by analogy to something a developer already knows" |

### Level Up Rule:
- ❌ WEAK: "Explain React hooks"
- ✅ STRONG: "Explain HOW useEffect and useState work TOGETHER, tracing data flow with a concrete form component example. Compare cleanup vs no cleanup."

---

## 5. RETENTION-OPTIMIZED OUTPUT FORMATS

### Format A: Cornell Notes (SUMMARY endpoint)

```markdown
## 🎯 Core Concept
[Single most important idea — plain language, no jargon]

## 📌 Key Ideas (max 3)
1. **[Concept]** — [Why it matters] — [Quick real-world example]
2. **[Concept]** — [Why it matters] — [Quick real-world example]
3. **[Concept]** — [Why it matters] — [Quick real-world example]

## 🔗 How These Connect
[1-2 sentences: RELATIONSHIPS between key ideas, not just listing them]

## ⚠️ Common Misconception
[What learners get wrong + WHY they get it wrong]

## 💡 Memorable Analogy
[Core concept explained via familiar analogy]

## ❓ Recall Question
[1 application-level question — not definition recall]
```

### Format B: Feynman Structure (EXPLAIN endpoint)

```markdown
## 🧠 Plain Language
[Zero jargon — explain to a brilliant beginner]

## 🗺️ Mental Model
[HOW TO THINK about this — not a definition, a framework]

## 🔢 Step-by-Step Breakdown
[Mechanism in numbered steps with cause→effect reasoning]

## 💻 Concrete Example
[Real code/scenario — enough detail to actually use it]

## 🤔 Why This Design?
[WHY does it work this way? What problem does this design solve?]

## ❌ Common Beginner Mistake
[Most frequent error + the ROOT CAUSE — not just "don't do X"]

## 🪝 Sticky Analogy
[One memorable analogy to cement the concept]

## ✅ You Really Understand This When You Can Explain:
[1-2 application/analysis questions — not recall]
```

---

## 6. LEARNING SCIENCE PRINCIPLES TO ENCODE

### 6.1 Retrieval Practice (strongest retention effect)
Based on: Karpicke & Blunt (2011) — retrieval > re-reading > concept mapping for long-term retention.
- **Encode:** Always end with 1 question at Apply level (not "what is X" but "when would you use X")

### 6.2 Elaborative Interrogation (WHY, not just WHAT)
- **Encode:** "For each concept, answer WHY it works this way. Explain the REASON behind the design."

### 6.3 Dual Coding (text + structure)
- **Encode:** "For processes, include a simple text diagram: A → B → C with annotation"

### 6.4 Cognitive Load Management (Sweller 1988)
- **Encode:** Max 3 key ideas per summary. Progressive disclosure. Flag prerequisites.

### 6.5 Concrete-Abstract-Concrete Pattern
1. Start with concrete example
2. Abstract the principle
3. Return to slightly different concrete example

---

## 7. READY-TO-USE SYSTEM PROMPT REWRITES

### 7.1 Summary Endpoint — New System Prompt

```
Bạn là chuyên gia thiết kế nội dung giáo dục, áp dụng khoa học nhận thức để tối ưu hóa việc ghi nhớ kiến thức. Sử dụng phương pháp Cornell Notes và thang nhận thức Bloom để tạo tóm tắt giúp học viên THỰC SỰ HIỂU, không chỉ đọc qua.

Cấu trúc output BẮT BUỘC (markdown):

## 🎯 Ý chính cốt lõi
[1 câu tóm gọn toàn bộ bài học — không jargon]

## 📌 3 Điểm quan trọng nhất
1. **[Khái niệm]** — [Tại sao quan trọng] — [Ví dụ thực tế]
2. **[Khái niệm]** — [Tại sao quan trọng] — [Ví dụ thực tế]
3. **[Khái niệm]** — [Tại sao quan trọng] — [Ví dụ thực tế]

## 🔗 Mối liên hệ
[1-2 câu: các khái niệm trên LIÊN QUAN VỚI NHAU như thế nào — không chỉ liệt kê]

## ⚠️ Sai lầm phổ biến
[Điều học viên thường hiểu sai nhất + TẠI SAO dễ hiểu sai]

## 💡 Phép ẩn dụ
[1 ví dụ so sánh với thứ quen thuộc để nhớ lâu]

## ❓ Câu hỏi tự kiểm tra
[1 câu hỏi ở mức ÁP DỤNG — không phải thuộc lòng định nghĩa]

Ràng buộc: 400-500 từ. Ưu tiên ví dụ + lý giải hơn định nghĩa học thuật. KHÔNG viết paragraph dài không có cấu trúc.
```

### 7.2 Explain Endpoint — New System Prompt

```
Bạn là giáo viên bậc thầy sử dụng Kỹ thuật Feynman: giải thích mọi thứ cho người thông minh nhưng hoàn toàn mới với chủ đề. Mục tiêu: học viên phải HIỂU SÂU — có thể giải thích lại và áp dụng — không chỉ nhận ra khái niệm.

Cấu trúc output BẮT BUỘC (markdown):

## 🧠 Giải thích đơn giản
[Không dùng thuật ngữ — như giảng cho người mới hoàn toàn]

## 🗺️ Mô hình tư duy
[Cách NGHĨ về khái niệm này — framework, không phải định nghĩa từ điển]

## 🔢 Phân tích từng bước
[Cơ chế theo từng bước có đánh số — với quan hệ nguyên nhân→kết quả]

## 💻 Ví dụ thực tế
[Tình huống cụ thể: code/thực hành — đủ chi tiết để áp dụng ngay]

## 🤔 Tại sao thiết kế như vậy?
[Lý do ĐẰNG SAU — không chỉ "how" mà còn "why" — giải quyết vấn đề gì]

## ❌ Lỗi người mới hay mắc
[Sai lầm thường gặp + TẠI SAO xảy ra — không chỉ "đừng làm X"]

## 🪝 Ẩn dụ giúp nhớ lâu
[1 ẩn dụ đáng nhớ làm khái niệm "dính" vào trí nhớ]

## ✅ Bạn hiểu thật sự khi có thể giải thích:
[1-2 câu hỏi ở mức ÁP DỤNG/PHÂN TÍCH — kiểm tra hiểu sâu, không thuộc lòng]

Độ dài: 600-800 từ. Bắt buộc có ví dụ code/thực tế. KHÔNG dùng định nghĩa học thuật thuần túy.
```

---

## 8. ANTI-PATTERNS TO AVOID

| Anti-Pattern | Why Bad | Fix |
|-------------|---------|-----|
| "Summarize this lesson" | No format → wall of text | Specify exact output structure |
| "Explain in detail" | No depth signal → shallow lists | "Explain WHY, not just HOW" |
| "Good teacher" role | Too vague → generic output | "Expert using Feynman Technique" |
| No length constraint | LLM pads to fill space | "400-500 words max" |
| No cognitive level signal | Defaults to Remember | Add Bloom's verb: "apply", "connect", "trace" |
| No misconception flag | Learner builds wrong model | "Flag the #1 misconception" |
| No analogy requirement | Abstract, hard to retain | "Include 1 memorable analogy" |
| No retrieval cue | Summary dies after reading | "End with 1 application-level question" |

---

## 9. SOURCES

| Source | URL | Date |
|--------|-----|------|
| Khan Academy 7-Step Khanmigo | https://blog.khanacademy.org/khan-academys-7-step-approach-to-prompt-engineering-for-khanmigo/ | Oct 2023 |
| Bloom's Taxonomy AI Prompts | https://www.structural-learning.com/post/ai-prompts-blooms-taxonomy-teachers-guide | Mar 2026 |
| Edodo Educator Framework (50+ examples) | https://edodo.app/articles/prompt-engineering-educators | Jan 2026 |
| MeraTutor Prompt Engineering Guide | https://meratutor.ai/blog/prompt-engineering-for-tutors/ | Jan 2026 |
| AiUnpacker 8 Educational Templates | https://aiunpacker.com/blog/8-ai-prompt-templates-for-educational-content-creation/ | Jan 2026 |
| CoT in Science Assessment (arXiv) | https://arxiv.org/html/2403.14565v1 | Mar 2024 |
| Karpicke & Blunt — Retrieval Practice | https://science.sciencemag.org/content/331/6018/772 | 2011 |
| Sweller — Cognitive Load Theory | https://link.springer.com/article/10.1007/BF00058437 | 1988 |
