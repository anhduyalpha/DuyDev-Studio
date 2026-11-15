---
id: KI-FIX-056
title: Khắc Phục Race Queue Share-Target, Boot Watchdog Android WebView & Lỗi Render Bảng/Trích Dẫn Markdown
type: troubleshoot
domain: fullstack
status: verified
created_at: 2026-11-15
updated_at: 2026-11-15
version: 1.0.0
trigger_conditions:
  - Khi Share intent từ Android bị mất do consumed sớm giữa index.html, app.js và ShareTargetModal
  - Khi màn hình onboarding ProfileModal che nút chia sẻ hoặc deep-link khi mở lạnh APK
  - Khi bảng Markdown (| col |) bị mất viền và dồn chữ thành một dòng hoặc > blockquote không render
search_queries:
  - peekPendingSharedPayload consumePendingSharedPayload
  - __DS_APP_HYDRATED __dsAlivePing headerProfileDot
  - parseMarkdownToHtml table tbody blockquote escaped &gt;
tags:
  - share-target
  - android-webview
  - watchdog
  - markdown
---

# KI-FIX-056: Share-Target Atomic Queue, Boot Watchdog & Markdown Table/Blockquote Rendering

## 1. Triệu chứng & Nguyên nhân gốc rễ
1. **Race Queue Share Intent**: Code cũ đọc và xóa shared payload quá sớm trước khi `#shareTargetPanel` mount xong, khiến share liên tiếp hoặc back-to-back intent từ Android bị rớt hoặc hiển thị sai payload cũ.
2. **Watchdog & Onboarding Cản Trở APK**: Android WebView không có tín hiệu hydration chính xác (`__DS_APP_HYDRATED`) và modal onboarding che phủ nút thao tác khi mở qua Share / DeepLink / APK.
3. **Markdown Preview Mất Bảng & Blockquote**: Trong [`src/utilities/markdownParser.js`](file:///src/utilities/markdownParser.js), bước escape HTML chuyển `>` thành `&gt;` trước khi chạy regex `/^\> /gim` nên blockquote bị bỏ sót; đồng thời các dòng `<tr>...</tr>` không được bọc trong `<table><tbody>...</tbody></table>`, khiến trình duyệt HTML5 tự đẩy text ra khỏi thẻ bảng và dính chữ hàng loạt.

## 2. Giải pháp đã xác minh
- **Atomic Peek/Consume (`shareTargetHelper.js`, `ShareTargetModal.js`, `app.js`)**: Tách `peekPendingSharedPayload()` (chỉ đọc) khỏi `consumePendingSharedPayload(payloadId)` (xóa idempotent theo `payloadId` chỉ sau khi `#shareTargetPanel` mount thành công).
- **Watchdog & Non-Blocking Dot (`app.js`, `Header.js`, `MainActivity.kt`)**: Thiết lập `window.__dsAlivePing = () => 'ok'`, `window.__DS_APP_HYDRATED = true` sau `handleRoute()`, watchdog `7000ms`, và chuyển onboarding trên `#share-target` / APK / deep-link sang chỉ báo `#headerProfileDot`.
- **Markdown Table & Blockquote (`src/utilities/markdownParser.js`)**: Sửa regex blockquote thành `/^&gt; (.*$)/gim` và bọc chuỗi `<tr>` liên tiếp trong `<table class="w-full border-collapse my-3 text-xs"><tbody>...</tbody></table>` trước khi thay `\n\n`, kiểm chứng trực tiếp bằng Playwright desktop screenshot và Vitest (`markdown_export.test.ts` 10/10).
