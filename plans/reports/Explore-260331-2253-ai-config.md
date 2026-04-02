# AI/LLM Configuration Exploration
**Date:** 2026-03-31 | **Project:** udemy-app

## Summary
The project uses **OpenAI API** with a custom proxy-safe client wrapper. AI configuration is centralized in `src/lib/ai/` with environment-based key management.

---

## 1. OpenAI Client Setup ✅

### Primary Module: `src/lib/ai/client.ts`
**Functions:**
- `createAIClient(apiKey, baseUrl)` → Returns OpenAI client with WAF-safe headers
- `getCleanHeaders(apiKey)` → Returns fetch headers for raw API calls

**Key Details:**
- Strips SDK bot-detection headers (User-Agent, X-Stainless-*)
- Sets custom User-Agent: `"udemy-learner/1.0"`
- Removes base URL trailing slash for consistency
- Used across all AI routes (chat, explain, quiz, roadmap, summary)

### Package Dependency
```json
"openai": "^6.33.0"
```
Installed in package.json at line 30.

---

## 2. Environment Variables Configuration

### `.env.example` (Line 4-5)
```
# OpenAI — fallback API key (optional, users configure via Settings UI)
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Note:** 
- Optional (comment says "fallback")
- Users can configure via Settings UI
- Note: Actual `.env` exists but requires privacy approval to read

---

## 3. AI Routes Using OpenAI Client

All located in `src/app/api/ai/`:
1. **`chat/route.ts`** - Chat completions with streaming
2. **`explain/route.ts`** - Content explanation
3. **`quiz/route.ts`** - Quiz generation
4. **`roadmap/route.ts`** - Learning roadmap
5. **`summary/route.ts`** - Content summarization

Each route:
- Imports `createAIClient` from `@/lib/ai/client`
- Calls `client.chat.completions.create()` with streaming
- Uses `createThinkFilteredStream()` to filter thinking output

---

## 4. Supporting Utilities

### `src/lib/ai/prompts.ts` (47KB)
- Contains system prompts for different content types
- `getSystemPrompt()` function
- `SOCRATIC_INSTRUCTION` constant
- Type exports: `ContentType`

### `src/lib/ai/stream.ts`
- `createThinkFilteredStream()` → Filters extended thinking output
- `STREAM_HEADERS` → Proper streaming response headers

### `src/lib/security/validateBaseUrl`
- Security validation for custom base URLs

---

## 5. Test Coverage
- `src/lib/__tests__/ai-client.test.ts` - AI client unit tests
- `src/app/api/ai/__tests__/chat.test.ts` - Chat API tests
- `src/app/api/ai/__tests__/chat-socratic.test.ts` - Socratic mode tests
- `src/app/api/ai/__tests__/explain.test.ts` - Explain API tests
- `src/app/api/lessons/__tests__/ai-persistence.test.ts` - Data persistence

Tests mock OpenAI constructor with baseURL: `https://api.openai.com/v1`

---

## Key Findings

| Aspect | Status | Details |
|--------|--------|---------|
| **OpenAI Client** | ✅ YES | Custom wrapper in `src/lib/ai/client.ts` |
| **API Key Env Var** | ✅ YES | `OPENAI_API_KEY` in `.env.example` |
| **AI Utility Module** | ✅ YES | Centralized in `src/lib/ai/` (3 files) |
| **Streaming** | ✅ YES | Implemented with think-filtering |
| **Multi-prompt Support** | ✅ YES | 47KB prompts.ts with typed content types |
| **Security** | ✅ YES | WAF bypass + URL validation + header stripping |

---

## Architecture Pattern
```
Route (POST /api/ai/*)
  ↓
createAIClient(apiKey, baseUrl) → OpenAI SDK
  ↓
chat.completions.create({ stream: true, ... })
  ↓
createThinkFilteredStream()
  ↓
Response.send with STREAM_HEADERS
```

---

## Next Steps (if needed)
- Check actual `.env` for production key config
- Review `validateBaseUrl()` security implementation
- Trace Settings UI for user-configurable AI params
