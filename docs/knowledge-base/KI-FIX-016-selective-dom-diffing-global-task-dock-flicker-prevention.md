---
id: KI-FIX-016-selective-dom-diffing-global-task-dock-flicker-prevention
title: "Selective In-Place DOM Diffing & Heartbeat Shallow-Diff Guard to Eliminate UI Flickering in GlobalTaskDock"
type: troubleshoot
status: verified
domain: frontend
tags: [dom-diffing, ui-flicker, layout-thrashing, keyframe-animation, task-coordinator, global-task-dock]
created_at: 2026-09-25
updated_at: 2026-09-25
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "GlobalTaskDock or floating status elements constantly updating, flickering, re-triggering entrance animations (animate-fadeIn/ping), or thrashing DOM during background task execution."
search_queries:
  - "GlobalTaskDock UI bị nhấp nháy liên tục"
  - "Thanh dock tác vụ ngầm bị reload liên tục"
  - "Selective in-place DOM diffing progress bar flicker"
  - "Preventing animate-fadeIn re-triggering on state updates"
  - "Task coordinator heartbeat notification throttle"
related_kis:
  - KI-CON-003-universal-extensible-multitasking-architecture
  - KI-FIX-010-selective-dom-diffing-high-frequency-terminal-lag
  - KI-FIX-015-decoupling-background-tasks-spa-dom-lifecycle
---

# [KI-FIX-016] Cơ Chế Selective In-Place DOM Diffing & Shallow-Diff Guard Triệt Tiêu Hiện Tượng Nhấp Nháy (Flickering) Tại GlobalTaskDock

## 1. Problem Statement & Root Cause

### Triệu chứng (Symptom)
Khi có tác vụ chạy ngầm (ví dụ: Ghép PDF, Tách trang, Nén tệp, Chuyển đổi định dạng), thanh dock nổi góc phải màn hình (`GlobalTaskDock`) liên tục cập nhật tiến trình (5%, 6%, 7%...). Tuy nhiên, toàn bộ khung dock bị nhấp nháy liên tục (flickering/strobe effect), hiệu ứng mờ dần `animate-fadeIn` bị kích hoạt lại liên tục mỗi giây, chấm xanh `animate-ping` bị giật cục và biểu tượng Lucide SVG bị vẽ lại liên tục.

### Nguyên nhân gốc rễ (Root Cause)
1. **Phá hủy và tạo mới toàn bộ cây DOM (`host.innerHTML = renderGlobalTaskDock(...)`)**:
   Trong cài đặt ban đầu của `GlobalTaskDock.js`:
   ```javascript
   // Mã nguồn cũ (LỖI)
   taskCoordinator.subscribe((tasks) => {
     host.innerHTML = renderGlobalTaskDock(tasks); // <-- Xoá sạch toàn bộ DOM cây dock và gắn lại HTML mới
     attachDockListeners(host);
     if (window.lucide) window.lucide.createIcons({ root: host });
   });
   ```
   Mỗi khi có thông báo tiến độ hoặc mỗi chu kỳ heartbeat (1200ms), `innerHTML` của toàn bộ capsule dock bị xóa sạch và gán chuỗi HTML mới.
2. **Kích hoạt lại CSS Keyframe `animate-fadeIn`**:
   Thẻ bọc ngoài cùng có class `animate-fadeIn`:
   ```html
   <div class="... animate-fadeIn">
   ```
   Mỗi lần `innerHTML` được tạo mới, trình duyệt coi đây là một phần tử DOM mới hoàn toàn và kích hoạt lại animation từ `opacity: 0` đến `opacity: 1`. Khi tiến trình cập nhật nhiều lần trong 1 giây, mắt người nhìn thấy hiệu ứng chớp tắt/nhấp nháy cực kỳ khó chịu.
3. **Heartbeat Broadcast Không Điều Kiện**:
   Trong `taskCoordinator.js`, hàm `syncTasks()` chạy định kỳ mỗi 1200ms để kiểm tra trạng thái nền, nhưng lại gọi `this.notifySubscribers()` vô điều kiện ngay cả khi danh sách tác vụ, tiến độ, và trạng thái hoàn toàn không có gì thay đổi.

---

## 2. Technical Solution & Architecture

### 1. Cơ Chế Selective In-Place DOM Diffing (`updateDockDOM`)
Áp dụng mẫu thiết kế DOM diffing chọn lọc trực tiếp tại lá DOM mà không cần thư viện ảo bên ngoài:
- **Mount Capsule Một Lần Duy Nhất**: Chỉ render khung capsule `#globalTaskDockCapsule` (kèm `animate-fadeIn`) khi dock lần đầu xuất hiện (`host.innerHTML === ''`).
- **Đột Biến Trực Tiếp Tại Nút Lá (Leaf In-Place Mutation)**:
  - Cập nhật số lượng tác vụ: `#dockTaskCountText.textContent = newText`.
  - Đối với từng hàng tác vụ (`[data-task-id]`):
    - Cập nhật phần trăm: `.dock-pct-text.textContent = \`\${pct}%\``.
    - Cập nhật thanh tiến trình: `.dock-progress-bar.style.width = \`\${pct}%\`` (kích hoạt transition CSS 300ms mượt mà, không giật).
    - Cập nhật nhãn giai đoạn: `.dock-stage-text.textContent = stageText`.
    - Cập nhật tiêu đề: `.dock-task-title.textContent = titleText`.
- **Điều Hòa Danh Sách Hàng Tác Vụ (Reconciliation)**:
  - Xóa bỏ hàng của tác vụ đã kết thúc (`row.remove()`).
  - Nối hàng mới cho tác vụ mới xuất hiện (`tasksContainer.appendChild(newRow)`).
- **Ủy Quyền Sự Kiện (Event Delegation)**:
  - Gắn sự kiện click vào `#dockTasksContainer`, bắt sự kiện qua `e.target.closest('.btn-cancel-dock-task')` và `e.target.closest('[data-task-route]')`, loại bỏ hoàn toàn việc phải gán lại sự kiện mỗi lần cập nhật.

### 2. Shallow-Diff Guard Tại `taskCoordinator.js`
Trong `syncTasks(force = false)`:
- So sánh danh sách tác vụ hiện tại với `this.cachedTasks` theo độ dài mảng và các thuộc tính nhận diện: `id`, `status`, `progress`, `stage`, `title`, `route`.
- Chỉ gọi `this.notifySubscribers()` khi `isDifferent === true` hoặc `force === true` (khi đăng ký/hủy manager hoặc hủy task).
- Nhờ đó, chu kỳ heartbeat định kỳ 1200ms sẽ hoàn toàn yên lặng nếu không có biến động, triệt tiêu 100% việc lãng phí tài nguyên CPU/DOM.

---

## 3. Verification & Benchmark

1. **Kiểm tra tính đúng đắn**:
   - `node --check src/components/layout/GlobalTaskDock.js src/utilities/taskCoordinator.js` -> 0 lỗi cú pháp.
   - `cd server && npx vitest run tests/unit/task_coordinator.test.ts` -> 6/6 tests passed.
   - `cd server && npx tsc --noEmit` -> 0 lỗi TypeScript.
2. **Kiểm tra trực quan thực tế**:
   - Khởi chạy tác vụ Ghép PDF nhiều tệp.
   - Khung dock xuất hiện mượt mà một lần duy nhất với `animate-fadeIn`.
   - Tiến trình 5% -> 10% -> 20%... tăng mượt mà với hiệu ứng trượt của thanh bar.
   - Chấm tròn xanh lá `animate-ping` phát nhịp liên tục, không bị reset.
   - Nhấp nháy và chớp tắt hoàn toàn biến mất.
