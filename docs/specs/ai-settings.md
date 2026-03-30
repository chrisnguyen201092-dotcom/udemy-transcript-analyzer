# Spec: AI Settings (Cấu hình AI Provider)

## Goal
Cho phép người dùng cấu hình AI provider tùy chọn (base URL, API key, model) và lưu vào localStorage để dùng cho tất cả tính năng AI.

## User Stories
- Là học viên, tôi muốn nhập API key và base URL của provider AI mình đang dùng để bắt đầu sử dụng app
- Là học viên, tôi muốn chọn model từ danh sách tự động fetch từ provider
- Là học viên, tôi muốn settings được lưu lại sau khi tắt trình duyệt

## Acceptance Criteria
- [ ] Icon Settings (bánh răng) trên Header → click → `SettingsModal` mở ra
- [ ] Modal có 4 fields: Base URL, API Key (masked), Model (dropdown), Udemy Cookie (optional)
- [ ] Người dùng nhập Base URL + API Key → click "Tải danh sách model" → hệ thống gọi `POST /api/ai/models`
- [ ] Dropdown model populated với danh sách trả về từ provider
- [ ] Người dùng chọn model → click "Lưu" → settings persist vào `localStorage['udemy_ai_settings']`
- [ ] Header hiển thị tên model đang chọn ngay sau khi lưu
- [ ] Khi mở lại app → settings được load từ localStorage tự động

## Edge Cases
- Base URL không hợp lệ (không phải URL) → validate client-side trước khi gửi
- API key sai → `POST /api/ai/models` trả 401 → hiển thị lỗi "API key không hợp lệ"
- Provider không có endpoint `/models` → hiển thị input text thủ công để nhập model name
- Không có settings → tất cả AI features hiển thị prompt "Cấu hình AI settings trước"
- localStorage bị clear → app fallback về trạng thái chưa cấu hình

## API Contract

### POST /api/ai/models
**Request:**
```json
{
  "baseUrl": "string",
  "apiKey": "string"
}
```
**Response 200:**
```json
{
  "models": ["string"]
}
```
**Errors:**
- `400` — thiếu `baseUrl` hoặc `apiKey`
- `401` — API key không hợp lệ
- `500` — provider không phản hồi hoặc không có endpoint /models

## Data Model Changes
Không có thay đổi DB schema. Settings lưu hoàn toàn client-side:

```typescript
// localStorage key: "udemy_ai_settings"
interface AISettings {
  baseUrl: string;    // e.g. "https://api.openai.com/v1"
  apiKey: string;     // masked khi hiển thị
  model: string;      // e.g. "gpt-4o-mini"
  udemyCookie?: string; // optional Udemy access_token
}
```

## UI Notes
- `SettingsModal`: dialog overlay, không thể dismiss bằng click-outside nếu chưa có settings
- API Key field: `type="password"` với toggle show/hide
- Nút "Tải model" riêng, không phải auto-trigger khi type
- Dropdown disabled cho đến khi model list được load
- Header: `[tên-app] · {modelName}` — model name hiện ngay sau dấu bullet
- Udemy Cookie field: optional, chỉ cần khi dùng import Udemy feature
