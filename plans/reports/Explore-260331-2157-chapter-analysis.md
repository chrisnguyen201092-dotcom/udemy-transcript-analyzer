# Chapter Analysis Feature - Exploration Report

**Date:** 2026-03-31 | **Scope:** How chapter analysis works & error handling

## Executive Summary

The Udemy Learner app has an **automatic chapter splitting feature** for books (Tier 2 feature, specs B-17 to B-19). The system uses **heuristic detection + user confirmation workflow** to parse books into chapters.

### When Analysis Fails:
- **Incorrect detection** → User sees preview with warnings and can manually edit chapters
- **After confirmation** → Locked (no auto-edit); user must delete lessons to re-split
- **For scanned PDFs** → System warns user about potential text extraction loss

---

## 1. Feature Architecture: Two-Stage Flow

### Stage 1: Automatic Detection (`POST /api/books/split`)
```
File Upload → Parse Content → Heuristic Detection → Return Preview + Warnings
```

**Supported formats:** PDF, DOCX, TXT, Markdown

**File processing:**
- PDFs: Binary parsing with OCR fallback for scanned documents
- DOCX: Structured heading extraction
- TXT/MD: Plain text with heading pattern matching

### Stage 2: User Confirmation (`POST /api/books/split/confirm`)
```
User Edits Preview → Submit Corrected Chapters → Create Lessons Atomically
```

**Validation:**
- Book must exist (404 if not)
- Book must not have existing lessons (409 if does)
- Each chapter needs: index, title, content, chapterNumber

---

## 2. How Chapter Detection Works

### Five Detection Patterns (Priority Order)

**1. Keyword Pattern** (Highest priority)
- Matches: `Chapter/Chương/Phần/Part + number`
- Example: `"CHƯƠNG 5"`, `"Chapter 3"`, `"Phần 2"`
- Vietnamese-specific: Multi-line subtitle joining

**2. Numbered Headings**
- Matches: `1. Title`, `1.1 Title`, `1) Title`

**3. Markdown H1**
- Matches: `# Title` (not H2+)

**4. ALL CAPS Lines**
- Matches: Lines < 60 chars, all uppercase, contains letters

**5. Fallback**
- If < 2 chapters detected → entire file = 1 chapter
- Triggers warning: "Không tìm thấy cấu trúc chương rõ ràng..."

### Smart Guards Against False Positives

| Guard | Purpose |
|-------|---------|
| **Monotonic check** | Chapter numbers must increase (skips TOC entries) |
| **Minimum content** | Chapter must have body text (skips TOC stubs) |
| **Subtitle merge** | Multi-line titles for Vietnamese books |
| **Short flag** | Word count < 200 triggers warning |

---

## 3. Error Handling & User Warnings

### When Analysis Encounters Problems

**Scanned PDFs (No OCR):**
- Warning: "PDF này có thể là ảnh scan, không extract được..."
- Impact: Text extraction may be incomplete

**Scanned PDFs (OCR Applied):**
- Warning: "Đã dùng OCR để đọc PDF scan..."
- Impact: Accuracy may be degraded

**No Chapter Structure Detected:**
- Method: "fallback"
- Warning: "Không tìm thấy cấu trúc chương rõ ràng..."
- Result: Entire content becomes 1 chapter

**Short Chapters:**
- Warning: 'Chương "[title]" ngắn ([count] từ)...'
- Severity: Info (not blocking)

### Error Responses

| Condition | Status | Message |
|-----------|--------|---------|
| File too large | 413 | "File quá lớn. Giới hạn [X] MB." |
| Unsupported format | 400 | "Định dạng '[ext]' không hỗ trợ..." |
| File parsing fails | 400 | "Không thể đọc file: [reason]" |
| Invalid JSON body | 400 | Zod validation errors |
| Book not found | 404 | "Sách không tồn tại" |
| Book already has lessons | 409 | "Sách đã có bài học..." |
| Server error | 500 | "Lỗi server khi..." |

---

## 4. What Happens When Analysis is Wrong

### **Scenario 1: Incorrect Chapter Boundaries**

Example: PDF has 5 chapters, system detects 3

**User Workflow:**
1. Upload PDF → System runs heuristic detection
2. **Preview stage:** See detected 3 chapters with warnings
3. **Manual correction:** 
   - Rename chapters
   - Merge chapters (combine 2 chapters)
   - Split chapters (manually divide)
   - Reorder chapters
4. **Confirm:** Send corrected chapter list
5. Lessons created atomically

### **Scenario 2: Scanned PDF with OCR Errors**

Example: "Chapter" detected as "Ch@pter" due to OCR noise

**What system does:**
- Returns warning about OCR accuracy
- User can: Manually edit chapter titles in preview
- Cannot: Auto-correct OCR errors (not in heuristic path)

### **Scenario 3: User Confirms, Then Realizes Error**

**Current limitation:** ❌ No edit after confirmation

**What happens:**
- User clicks confirm → Lessons created → Locked
- Re-split attempt: 409 error "Sách đã có bài học..."
- **Workaround:** Delete existing lessons first, then re-upload

**Why locked?** 
- Prevents data loss (lessons may have notes, progress)
- Maintains data integrity

---

## 5. Code Structure

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/books/split` | POST | Analyze file, return chapter preview + warnings |
| `/api/books/split/confirm` | POST | Confirm chapters, create lessons |

### Key Functions

**`detectChapters(text: string): DetectedChapter[]`**
- Location: `/src/lib/split-chapters.ts`
- Purpose: Parse plain text, find chapter boundaries

**`parsePdf()`, `parseDocx()`, `parseMarkdownChapters()`**
- Location: `/src/lib/parse-book.ts`
- Handle: File format parsing

### Response Shape

**`POST /api/books/split` returns:**
```json
{
  "method": "heuristic" | "fallback",
  "chapters": [
    {
      "index": 0,
      "title": "Chapter 1: Introduction",
      "wordCount": 1500,
      "content": "[full chapter text...]"
    }
  ],
  "warnings": ["warning text..."]
}
```

---

## 6. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Heuristic-first** | Fast, no AI cost, works for well-formatted books |
| **Fallback mode** | Ensures system never completely fails |
| **User confirmation** | Respects document structure, not blindly splitting |
| **Post-confirm lock** | Protects data integrity (lessons → notes → progress) |
| **Warning system** | Transparent about detection confidence |
| **Vietnamese support** | Handles common Vietnamese book patterns |

---

## 7. Feature Status

### Implemented (Tier 2)
- ✅ B-17: Heuristic chapter detection
- ✅ B-18 (partial): Warning system for fallback
- ✅ B-19: Manual chapter confirmation UI

### Not Implemented Yet
- ❌ B-18 (full): AI-assisted detection when heuristic fails
- ❌ Auto-edit UI after confirmation

---

## 8. Key Findings

**When system automatically analyzes chapters incorrectly:**

1. **Heuristic misses chapters** → Falls back to 1 chapter, warns user
2. **Wrong boundaries** → User sees preview, manually edits before confirming
3. **After confirmation** → Locked (must delete lessons to re-split)
4. **OCR errors in PDFs** → Warns user, can manually edit titles
5. **File parsing fails** → Returns 400 error with reason

**All user corrections happen BEFORE confirmation.** Post-confirmation requires deletion + re-upload.

