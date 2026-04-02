# Brainstorm: Mental Models cho Inkgest

> **Agent:** brainstormer | **Date:** 2026-04-02 | **Status:** DONE

---

## 1. Research: 20 Mental Models/Frameworks

### Tier A — Evidence-based, ap dung truc tiep vao AI app

| # | Model | Mo ta | Ap dung vao Inkgest |
|---|-------|-------|---------------------|
| 1 | **Spaced Repetition** | On tap tang dan, toi uu duong cong quen | ✅ DA CO — SRS module |
| 2 | **Active Recall** | Tu kiem tra thay vi doc lai | ✅ DA CO — Quiz/Flashcard/Exercise |
| 3 | **Feynman Technique** | Giai thich don gian nhu day tre 5 tuoi | ✅ DA CO — Explain engine (ELI5) |
| 4 | **Socratic Method** | Hoi nguoc de dan dat tu duy | ✅ DA CO — Chat Socratic toggle |
| 5 | **Elaborative Interrogation** | Hoi Tai sao? va Nhu the nao? | AI tu generate Why questions sau moi concept |
| 6 | **Interleaving** | Tron lan topics thay vi hoc 1 topic | Quiz tron bai tu nhieu lessons |
| 7 | **Retrieval Practice** | Co nho lai truoc khi xem dap an | Pre-test truoc khi doc content |
| 8 | **Chunking** | Chia nho thong tin thanh nhom co y nghia | AI group concepts thanh chunks 3-5 items |
| 9 | **Bloom Taxonomy** | 6 cap: Remember-Understand-Apply-Analyze-Evaluate-Create | Tag quiz theo Bloom level |
| 10 | **First Principles** | Phan tach van de ve su that co ban nhat | AI break down to fundamentals |

### Tier B — Huu ich nhung kho tu dong hoa

| # | Model | Mo ta | Kho khan |
|---|-------|-------|---------|
| 11 | **Mind Mapping** | So do tu duy ket noi concepts | Can thu vien render, effort cao |
| 12 | **Cornell Note-taking** | 3 vung: cues, notes, summary | Template cho Lesson Notes |
| 13 | **Pomodoro** | Hoc 25 phut, nghi 5 phut | Khong can AI, pure UI |
| 14 | **Dual Coding** | Ket hop text + hinh anh | Render hinh kho |
| 15 | **Self-Explanation** | Tu giai thich truoc khi AI | User viet truoc, AI compare |

### Tier C — Nghe hay nhung kho lam feature

| # | Model | Mo ta | Tai sao kho |
|---|-------|-------|-------------|
| 16 | **Pareto 80/20** | 20% noi dung = 80% gia tri | AI khong the xac dinh 20% quan trong — subjective |
| 17 | **Deliberate Practice** | Tap trung diem yeu | Can tracking chi tiet per concept — complex |
| 18 | **Growth Mindset** | Nang luc co the phat trien | Motivational, kho do impact |
| 19 | **Metacognition** | Suy nghi ve qua trinh suy nghi | Qua abstract |
| 20 | **Leitner System** | Flashcard 5 ngan | Variant SRS — redundant |
---

## 2. Nam Approach tich hop vao Inkgest

### Approach A: Mental Model as AI Prompt Mode

**Concept:** Them dropdown Learning Method vao moi AI engine. Khi user chon method, system prompt thay doi.

Vi du:
- Explain tab: [Feynman] [First Principles] [Elaborative Interrogation] [Analogy-based]
- Chat tab: [Normal] [Socratic — da co] [Rubber Duck] [Devil Advocate]
- Practice tab: [Standard] [Interleaved] [Bloom-tagged] [Pre/Post test]

**Pros:** Effort cuc thap (chi them prompt variants + UI dropdown). Khong can schema change. Ship iterative.
**Cons:** User phai biet model nao phu hop = cognitive load. Nhieu option = overwhelm.
**Effort:** 🟢 Low (2-3 ngay) | **Value:** 🟡 Medium

---

### Approach B: AI tu chon Method phu hop (Smart Mode)

**Concept:** AI phan tich content type + learner profile + topic, tu chon method toi uu. User khong can biet gi.

**Logic:**
- conceptual theory → Feynman + Elaborative Interrogation
- code/technical → First Principles + Chunking
- historical/narrative → Socratic + Interleaving
- beginner → Feynman + Active Recall (simple)
- advanced → First Principles + Bloom (higher levels)

**Pros:** UX tot nhat — zero cognitive load. Combine nhieu methods. Thong minh hon theo thoi gian.
**Cons:** AI chon sai thi user khong hieu. Kho debug. Can fallback manual override.
**Effort:** 🟡 Medium (3-5 ngay) | **Value:** 🟢 High

---

### Approach C: Mental Model as Learning Path Template

**Concept:** User chon learning strategy khi bat dau khoa hoc, he thong tao learning path.

Vi du:
- Deep Understanding: Pre-test → Summary → Explain (Feynman) → Socratic Chat → Quiz (Bloom) → SRS
- Speed Learning: Summary → Flashcard → Interleaved Quiz → SRS
- Exam Prep: Pre-test → Focus weak areas → Practice → SRS

**Pros:** Structured journey. Track completion theo path.
**Cons:** Rigid — user thuong khong follow paths. Effort cao. Khac biet giua paths minimal.
**Effort:** 🔴 High (1-2 tuan) | **Value:** 🟡 Medium

---

### Approach D: Mental Model Labels/Tags (Awareness Layer)

**Concept:** Khong thay doi output, chi LABEL dang dung method gi. VD: tag "🧠 Feynman Technique" + tooltip.

**Pros:** Effort gan zero. Educate user. Khong break flow.
**Cons:** Cosmetic — khong thay doi outcome. User ignore sau 2-3 lan.
**Effort:** 🟢 Very Low (1 ngay) | **Value:** 🔴 Low

---

### Approach E: Challenge Mode — Integrated Retrieval Practice

**Concept:** Truoc khi xem content, AI cho mini pre-test. Sau khi hoc, cho post-test. So sanh = do actual learning.

**Flow:**
1. User mo lesson → "Ban da biet gi? Thu tra loi 3 cau nay truoc"
2. User tra loi (hoac skip)
3. Xem summary/explain
4. Post-test: 3 cau tuong tu nhung khac
5. So sanh: "📈 Truoc: 1/3 → Sau: 3/3"

**Pros:** Evidence-based (retrieval practice + testing effect). Gamification nhe. Unique feature.
**Cons:** Friction — user muon doc ngay. Can persist results.
**Effort:** 🟡 Medium (4-5 ngay) | **Value:** 🟢 High
---

## 3. Brutal Honesty

### Cai nao thuc su huu ich vs nghe hay?

**Thuc su huu ich (evidence-based, user se dung):**
1. **Active Recall + Retrieval Practice** — Da co (Quiz/Flashcard). Chi can enhance: interleaving, Bloom tagging
2. **Spaced Repetition** — Da co SRS
3. **Feynman + Socratic** — Da co
4. **Elaborative Interrogation** — De them vao prompt, value cao
5. **Pre-test / Post-test** (Approach E) — Unique, measurable

**Nghe hay nhung ROI thap:**
- **Mind Mapping** — Can thu vien render, user hiem khi dung trong learning app
- **Pareto 80/20** — Buzzword, AI khong the reliably xac dinh
- **Cornell Notes** — Template rigidity, user thich free-form hon
- **Pomodoro** — Khong can AI, user dung app rieng roi
- **Growth Mindset** — Marketing language, khong phai feature
- **Learning Paths** (Approach C) — Nghe structured nhung user abandon rate cao

### User co thuc su dung mental models khong?

**Brutal truth: KHONG.** 95% user se:
1. Mo lesson → doc Summary
2. Khong hieu → dung Explain
3. Muon hoi → dung Chat
4. Muon on → dung Quiz/Flashcard

**Ho KHONG muon chon learning method.** Ho muon hieu bai, nhanh.

→ **Ket luan:** Approach ma FORCE user chon mental model = friction = that bai.
→ **Approach tot nhat:** AI tu ap dung methods phu hop, user chi thay output tot hon.

### User chon hay AI tu chon?

| Scenario | Recommendation |
|----------|---------------|
| Power user (5%) | Muon control → cho dropdown nhung an trong Advanced |
| Normal user (95%) | Khong muon biet → AI tu chon, hien thi label nho |

**→ Default: AI tu chon. Optional: Advanced toggle de manual override.**

### Effort/Value Tradeoff

| Approach | Effort | Value | Verdict |
|----------|--------|-------|---------|
| A: Prompt Mode dropdown | 🟢 Low | 🟡 Med | Good MVP neu an trong Advanced |
| B: AI tu chon | 🟡 Med | 🟢 High | ⭐ Best long-term |
| C: Learning Path | 🔴 High | 🟡 Med | Skip — user abandon paths |
| D: Labels only | 🟢 Very Low | 🔴 Low | Cosmetic, skip |
| E: Pre/Post test | 🟡 Med | 🟢 High | ⭐ Unique differentiator |

---

## 4. De xuat MVP — Smart Learning Methods v1

### Phase 1: Enhanced Prompts (1-2 ngay) — SHIP FIRST

**Khong can UI moi.** Chi upgrade existing prompts:

1. **Explain engine** — Them Elaborative Interrogation vao prompt:
   - Sau moi concept chinh, tu dong them "Tai sao dieu nay quan trong?" + brief answer
   - Khong can user action, khong can UI change

2. **Quiz engine** — Them Bloom Taxonomy tagging:
   - Moi quiz question co tag: [Remember] [Understand] [Apply] [Analyze]
   - User thay minh dang test o level nao
   - Chi can thay doi quiz prompt + minor UI badge

3. **Practice engine** — Them Interleaving option:
   - Khi user o course view, them button Mixed Practice → quiz tron tu nhieu lessons
   - 1 API param moi: lessonIds (string array) thay vi lessonId (string)

**Zero schema change. Zero new routes. Chi prompt engineering + minor UI.**

### Phase 2: Pre-test / Post-test (3-4 ngay) — DIFFERENTIATOR

1. Khi user mo lesson lan dau (chua co summary/explain):
   - Show optional "Quick check: Ban da biet gi?" → 3 cau hoi nhanh
   - User tra loi hoac skip
   - Persist: LessonAssessment { lessonId, type, questions, score, createdAt }

2. Sau khi user da doc summary + explain:
   - Auto-suggest "Kiem tra lai: Ban da nam chua?" → 3 cau tuong duong nhung khac
   - So sanh pre vs post score
   - Hien thi: "Truoc: 1/3 → Sau: 3/3"

3. Schema change nho — them model LessonAssessment:
   - id (cuid), lessonId, type (pre/post), questions (Json), score (Int), createdAt
   - Relation to Lesson

### Phase 3: Smart Method Selection (optional, 2-3 ngay)

Chi lam NEU Phase 1+2 duoc user don nhan:
1. Analyze content type (code ratio, topic domain)
2. Analyze learner profile
3. Auto-select optimal prompt variant
4. Show small label: "Dang dung: Feynman + Elaborative Interrogation"
5. Advanced toggle: user override manual

---

## 5. Recommendation Cuoi Cung

### DO ✅
1. **Phase 1 ngay** — Upgrade prompts (Elaborative Interrogation, Bloom tags, Interleaving) = 1-2 ngay, value lon
2. **Phase 2 sau** — Pre/Post test = differentiator manh, 3-4 ngay
3. Giu mental models **invisible** cho normal user — AI tu ap dung
4. Label nho cho educational awareness, KHONG force user chon

### DO NOT ❌
1. **Dung** tao Mental Models page/tab rieng — overengineered, it ai vao
2. **Dung** force user chon method truoc khi dung — friction kill engagement
3. **Dung** lam Learning Path templates — user abandon rate > 80%
4. **Dung** lam Mind Mapping — effort/value ratio te
5. **Dung** goi feature la "Mental Models" — user khong care thuat ngu, care ket qua

### Ten feature goi y
Thay vi "Mental Models", dung: **"Smart Learning"** hoac **"Hoc thong minh hon"** — focus vao outcome, khong phai methodology.

---

## Unresolved Questions

1. **Interleaving across courses:** Co nen tron quiz tu NHIEU courses (cross-domain) hay chi within 1 course?
2. **Pre-test UX:** Optional hay suggest? Neu user luon skip thi feature vo nghia — can real usage data
3. **Bloom tagging accuracy:** AI co the reliably tag Bloom level khong? Can test voi nhieu content types
4. **Elaborative Interrogation length:** Them "Tai sao?" vao explain se tang output length — co vuot token budget khong?
5. **Measurement:** Lam sao do "hoc hieu qua hon" trong local-first app khong co analytics server?

---

## 6. Enhanced Brainstorm: Scott Young's Holistic Learning + Learn-to-Learn

> **Sources:** Scott Young "Learn More, Study Less" (228 pages) + YouTube "Learn to Learn in 4hrs 54mins - Full Course"
> **Added:** 2026-04-02

### 6.1 Scott Young's Core Framework

**Hoc = Ket noi, khong phai Ghi nho.** Rote memorization (doc di doc lai) la cach hoc te nhat. Holistic learning = tao web of connections giua cac y tuong. Brain luu tru qua associations giua neurons, khong phai copy/paste.

#### 3 cau truc tri thuc:
| Structure | Mo ta | Ap dung Inkgest |
|-----------|-------|-----------------|
| **Constructs** | Mang luoi kien thuc ve 1 chu de — nhu 1 thanh pho trong dau, moi building = 1 idea, moi road = 1 connection | = 1 Course/Source |
| **Models** | Phien ban nen gon cua 1 y tuong — simplified representation de nho va ap dung nhanh | = Summary + Explain output |
| **Highways** | Ket noi GIUA cac constructs khac domain — vi du lien he vat ly voi kinh te | ⭐ NEW — cross-source connection feature (v3.0) |

#### 6 buoc hoc (cycle, khong tuyen tinh):
```
Acquire → Understand → Explore → Debug → Apply → Test
   ↑                                              |
   └──────────────────────────────────────────────┘
```

| Buoc | Mo ta | Inkgest engine |
|------|-------|----------------|
| **Acquire** | Tiep nhan thong tin (doc, nghe) | Content Panel (transcript/text) |
| **Understand** | Hieu nghia co ban | Summary + Explain |
| **Explore** | Tim ket noi voi kien thuc khac | Chat (Socratic) + Metaphor |
| **Debug** | Tim va sua mental model sai | ⭐ NEW — Model Debugging mode |
| **Apply** | Ap dung vao thuc te | Practice (Quiz/Exercise) |
| **Test** | Tu kiem tra hieu biet | ⭐ NEW — Pre/Post Test |

#### 5 loai thong tin (moi loai can ky thuat KHAC):
| Type | Vi du | Ky thuat tot nhat | Inkgest status |
|------|-------|-------------------|----------------|
| **Arbitrary** | Ngay, ten, cong thuc | Mnemonics, Link/Peg | ❌ Chua — can AI mnemonic generator |
| **Opinion** | Luan diem, debate | Socratic dialogue | ✅ Co (Chat Socratic) |
| **Process** | Workflow, algorithm | Flow diagram, step-by-step | ✅ Phan (Roadmap) |
| **Concrete** | Su kien, su that | Direct example, observation | ✅ Co (Explain) |
| **Abstract** | Ly thuyet, khai niem | Metaphor, visceralization | ✅ Phan (Feynman) → can them Metaphor |

#### Key techniques tu sach:
| Ky thuat | Mo ta | Can lam gi |
|----------|-------|------------|
| **Metaphor** | Tao analogy tu domain quen thuoc. VD: "Encryption giong nhu khoa so — chi nguoi co ma moi mo duoc" | Them vao Explain prompt — AI tu generate |
| **Visceralization** | Tuong tuong da giac quan — khong chi hinh anh ma ca cam giac, am thanh | Them vao Explain prompt — AI mo ta vivid hon |
| **Flow-Based Notetaking** | Ghi chu dang so do ket noi thay vi linear notes | 🔮 FUTURE — can render library |
| **Information Compression** | Nen thong tin: mnemonics, picture linking, notes gon | Them vao Explain prompt — AI suggest mnemonics khi gap arbitrary info |
| **Link Method** | Tao chuoi hinh anh sinh dong de nho thu tu items | Dung trong Flashcard — AI tao story ket noi cac cards |
| **Peg Method** | Gan item vao anchor da nho san (1=cay, 2=vit...) | Dung trong Flashcard cho lists |
| **Model Debugging** | Tim va chi ra mental model sai → sua | Them vao Chat Socratic prompt — AI challenge user |
| **Project-Based Learning** | Ap dung kien thuc qua mini-projects | Them vao Exercise prompt — AI suggest mini-project |

### 6.2 Danh gia 12 Feature theo 3 Tieu Chi User Impact

**Tieu chi:**
- 🚀 **Hieu nhanh** — Giam thoi gian "khong biet" → "hieu co ban"
- 🧠 **Hieu sau** — Tang kha nang ap dung, lien he, phan tich
- 💾 **Nho lau** — Giam toc do quen, tang retrieval

| # | Feature | 🚀 | 🧠 | 💾 | Effort | Verdict |
|---|---------|-----|-----|-----|--------|---------|
| 1 | **AI Metaphor Generator** — AI tu tao analogy cho concept | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | 🟢 Low | ✅ MUST |
| 2 | **Elaborative Interrogation** — Tu dong "Tai sao?" sau concept | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 🟢 Low | ✅ MUST |
| 3 | **Content-Type Detection** — AI phan loai → chon technique | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | 🟡 Med | ✅ HIGH |
| 4 | **Bloom-Tagged Quiz** — Tag question level | ⭐ | ⭐⭐⭐ | ⭐⭐ | 🟢 Low | ✅ SHOULD |
| 5 | **Pre/Post Test** — Do luong truoc vs sau hoc | ⭐ | ⭐⭐ | ⭐⭐⭐ | 🟡 Med | ✅ SHOULD |
| 6 | **Interleaving Quiz** — Tron cau tu nhieu bai | ⭐ | ⭐⭐ | ⭐⭐⭐ | 🟢 Low | ✅ SHOULD |
| 7 | **Model Debugging** — AI thach thuc understanding | ⭐ | ⭐⭐⭐ | ⭐⭐ | 🟡 Med | ⚡ NICE |
| 8 | **Cross-Source Highways** — Ket noi giua nguon | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 🔴 High | 🔮 FUTURE |
| 9 | **Mnemonics Generator** — Tao cau nho | ⭐⭐ | ⭐ | ⭐⭐⭐ | 🟢 Low | ⚡ NICE |
| 10 | **Flow Diagram Notes** — So do ket noi | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | 🔴 High | 🔮 FUTURE |
| 11 | **Visceralization Prompts** — Mo ta da giac quan | ⭐⭐ | ⭐⭐ | ⭐⭐ | 🟢 Low | ⚡ NICE |
| 12 | **Self-Explanation** — User viet truoc, AI so sanh | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 🟡 Med | ⚡ NICE |

### 6.3 Revised MVP Phasing

#### Phase 1: Prompt Upgrades (1-2 ngay) — SHIP FIRST

**Zero UI moi, zero schema, zero API route moi. Chi prompt engineering.**

**1a. Explain Engine:**
- Metaphor: AI tu tao analogy doi thuong cho moi concept chinh
- Elaborative Interrogation: Sau concept → "Tai sao? Lien he voi gi?"
- Content-Type Aware: AI detect loai thong tin → adapt style:
  - Abstract → metaphor + visceralization
  - Process → step-by-step + flow mo ta
  - Arbitrary → mnemonics goi y
  - Code → first principles breakdown

**1b. Practice Engine:**
- Bloom tags: [Remember] [Understand] [Apply] [Analyze] badge tren quiz
- Interleaving: `lessonIds` param → tron cau tu nhieu bai

**1c. Chat Engine:**
- Model Debugging: Socratic prompt upgrade → AI challenge + chi ra mental model sai

#### Phase 2: Pre/Post Test (3-4 ngay) — DIFFERENTIATOR

Pre-test banner khi mo lesson lan dau → 3 cau nhanh → Post-test sau explain → So sanh score.

Schema: `LessonAssessment { id, lessonId, type(pre/post), questions(Json), score, total, createdAt }`

#### Phase 3: Content-Type Intelligence (2-3 ngay, optional)

AI analyze content → tu chon prompt variant → label nho → advanced toggle.

### 6.4 Tai sao approach nay tot?

1. **User khong can biet "holistic learning" la gi** — AI tu ap dung phu hop
2. **Zero friction** — Explain output tu dong tot hon, khong can click gi
3. **Measurable** — Pre/Post test cho phep do "hoc duoc bao nhieu"
4. **Progressive** — Phase 1 ship ngay, Phase 2 khi Phase 1 duoc don nhan
5. **Scott Young validated** — Framework da duoc test tren chinh tac gia (MIT Challenge: 4 nam MIT CS trong 1 nam)
