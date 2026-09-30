# `premium_probe.js` — giải thích từng dòng

Tổng cộng **411 dòng**. Số dòng khớp với source v1.8.12 trong gói này.

| Dòng | Mã nguồn | Giải thích |
|---:|---|---|
| 1 | `(() =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 2 | `  &#x27;use strict&#x27;;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 3 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 4 | `  const PAGE_TOKEN = globalThis.crypto?.randomUUID?.()` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 5 | `    &#124;&#124; `${Date.now()}-${Math.random().toString(36).slice(2)}`;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 6 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 7 | `  const BUTTON_SELECTORS = [` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 8 | `    &#x27;button.PremiumBannerButton_secondary-button__08fn7&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 9 | `    &#x27;button[class*=&quot;PremiumBannerButton_secondary-button__&quot;]&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 10 | `    &#x27;button[class*=&quot;PremiumBannerButton_secondary-button__&quot;]:has(svg[class*=&quot;PremiumBadgeIcon&quot;])&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 11 | `  ];` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 12 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 13 | `  const DISAPPEAR_CONFIRM_MS = 120;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 14 | `  const NEVER_APPEARED_READY_MS = 1200;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 15 | `  const NEVER_APPEARED_QUIET_MS = 240;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 16 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 17 | `  const ONE_TRUST_SELECTOR = &#x27;#onetrust-banner-sdk&#x27;;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 18 | `  const send = payload =&gt; chrome.runtime.sendMessage(payload).catch(() =&gt; null);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 19 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 20 | `  function removeOneTrustBanner() {` | Bắt đầu hàm `removeOneTrustBanner` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 21 | `    const banner = document.querySelector(ONE_TRUST_SELECTOR);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 22 | `    if (!banner) return false;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 23 | `    banner.remove();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 24 | `    return true;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 25 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 26 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 27 | `  function startOneTrustCleanup() {` | Bắt đầu hàm `startOneTrustCleanup` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 28 | `    removeOneTrustBanner();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 29 | `    const observer = new MutationObserver(() =&gt; removeOneTrustBanner());` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 30 | `    observer.observe(document, { childList: true, subtree: true });` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 31 | `    document.addEventListener(&#x27;DOMContentLoaded&#x27;, removeOneTrustBanner, { once: true });` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 32 | `    window.addEventListener(&#x27;pageshow&#x27;, removeOneTrustBanner);` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 33 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 34 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 35 | `  function normalizeText(value) {` | Bắt đầu hàm `normalizeText` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 36 | `    return String(value &#124;&#124; &#x27;&#x27;).replace(/\s+/g, &#x27; &#x27;).trim();` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 37 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 38 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 39 | `  function isRenderedPremiumNode(element) {` | Bắt đầu hàm `isRenderedPremiumNode` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 40 | `    if (!(element instanceof Element) &#124;&#124; !element.isConnected &#124;&#124; element.closest(&#x27;template&#x27;)) return false;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 41 | `    if (element.closest(&#x27;[hidden], [aria-hidden=&quot;true&quot;]&#x27;)) return false;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 42 | `    let current = element;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 43 | `    while (current &amp;&amp; current instanceof Element) {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 44 | `      const style = getComputedStyle(current);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 45 | `      if (style.display === &#x27;none&#x27; &#124;&#124; style.visibility === &#x27;hidden&#x27; &#124;&#124; style.visibility === &#x27;collapse&#x27; &#124;&#124; style.contentVisibility === &#x27;hidden&#x27;) return false;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 46 | `      if (Number.parseFloat(style.opacity &#124;&#124; &#x27;1&#x27;) &lt;= 0.01) return false;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 47 | `      current = current.parentElement;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 48 | `    }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 49 | `    const rects = element.getClientRects();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 50 | `    if (!rects.length) return false;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 51 | `    return Array.from(rects).some(rect =&gt; rect.width &gt; 1 &amp;&amp; rect.height &gt; 1);` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 52 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 53 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 54 | `  function premiumUiInDom() {` | Bắt đầu hàm `premiumUiInDom` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 55 | `    // v1.8.12: only the actual Premium/Free Trial control gates access. The` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 56 | `    // surrounding preview wrapper and the separate Upload button may remain in` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 57 | `    // React for seconds after this control disappears, so they must not delay green.` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 58 | `    // Every matching control is inspected so a hidden duplicate cannot mask a` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 59 | `    // different visible copy.` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 60 | `    for (const selector of BUTTON_SELECTORS) {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 61 | `      for (const element of document.querySelectorAll(selector)) {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 62 | `        if (isRenderedPremiumNode(element)) return { element, selector };` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 63 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 64 | `    }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 65 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 66 | `    // Fallback for changed CSS-module hashes. Restrict it to rendered controls` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 67 | `    // inside PremiumBanner and avoid generic “unlock” text from the Upload card.` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 68 | `    const candidates = document.querySelectorAll(&#x27;[class*=&quot;PremiumBanner&quot;] button, [class*=&quot;PremiumBanner&quot;] [role=&quot;button&quot;]&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 69 | `    for (const element of candidates) {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 70 | `      if (!isRenderedPremiumNode(element)) continue;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 71 | `      const text = normalizeText(element.textContent).toLowerCase();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 72 | `      const hasPremiumBadge = Boolean(element.querySelector(&#x27;svg[class*=&quot;PremiumBadgeIcon&quot;]&#x27;));` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 73 | `      if (hasPremiumBadge &#124;&#124; /free trial&#124;go premium&#124;try premium&#124;start trial&#124;subscribe.*premium/.test(text)) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 74 | `        return { element, selector: hasPremiumBadge ? &#x27;premium-badge-fallback&#x27; : &#x27;premium-button-text-fallback&#x27; };` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 75 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 76 | `    }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 77 | `    return null;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 78 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 79 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 80 | `  function describeMatch(match) {` | Bắt đầu hàm `describeMatch` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 81 | `    return {` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 82 | `      selector: match?.selector &#124;&#124; null,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 83 | `      text: match?.element` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 84 | `        ? String(match.element.textContent &#124;&#124; &#x27;&#x27;).replace(/\s+/g, &#x27; &#x27;).trim().slice(0, 240)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 85 | `        : &#x27;&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 86 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 87 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 88 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 89 | `  function findScrollBox() {` | Bắt đầu hàm `findScrollBox` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 90 | `    const firstPage = document.querySelector(&#x27;div[data-page-index], .pf&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 91 | `    let current = firstPage?.parentElement &#124;&#124; null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 92 | `    while (current &amp;&amp; current !== document.body &amp;&amp; current !== document.documentElement) {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 93 | `      const css = getComputedStyle(current);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 94 | `      if (/(auto&#124;scroll&#124;overlay)/.test(css.overflowY) &amp;&amp; current.scrollHeight &gt; current.clientHeight + 80) return current;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 95 | `      current = current.parentElement;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 96 | `    }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 97 | `    return document.scrollingElement &#124;&#124; document.documentElement;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 98 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 99 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 100 | `  function startPassivePremiumMonitor() {` | Bắt đầu hàm `startPassivePremiumMonitor` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 101 | `    let queued = false;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 102 | `    let lastMutationAt = performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 103 | `    let domReadyAt = document.readyState === &#x27;loading&#x27; ? 0 : performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 104 | `    let premiumSeen = false;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 105 | `    let missingSince = 0;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 106 | `    let lastPublishedPresent = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 107 | `    let lastPublishedSelector = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 108 | `    let verifiedAbsentSent = false;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 109 | `    let mutationSettleTimer = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 110 | `    const startedAt = performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 111 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 112 | `    const publish = (present, match, reason, verified = false) =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 113 | `      const details = describeMatch(match);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 114 | `      send({` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 115 | `        type: &#x27;STD_PREMIUM_LIVE_STATE&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 116 | `        pageToken: PAGE_TOKEN,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 117 | `        present,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 118 | `        verified,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 119 | `        selector: details.selector,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 120 | `        text: details.text,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 121 | `        reason,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 122 | `        url: location.href,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 123 | `        checkedAt: Date.now(),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 124 | `        elapsedMs: Math.round(performance.now() - startedAt)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 125 | `      });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 126 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 127 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 128 | `    const inspect = reason =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 129 | `      queued = false;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 130 | `      removeOneTrustBanner();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 131 | `      const now = performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 132 | `      const match = premiumUiInDom();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 133 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 134 | `      if (match) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 135 | `        premiumSeen = true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 136 | `        missingSince = 0;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 137 | `        verifiedAbsentSent = false;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 138 | `        const selector = match.selector &#124;&#124; null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 139 | `        if (lastPublishedPresent !== true &#124;&#124; selector !== lastPublishedSelector) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 140 | `          lastPublishedPresent = true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 141 | `          lastPublishedSelector = selector;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 142 | `          publish(true, match, reason, true);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 143 | `        }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 144 | `        return;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 145 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 146 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 147 | `      if (lastPublishedPresent !== false) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 148 | `        lastPublishedPresent = false;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 149 | `        lastPublishedSelector = null;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 150 | `        publish(false, null, `${reason}-not-yet-verified`, false);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 151 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 152 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 153 | `      if (!missingSince) missingSince = now;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 154 | `      const quietAge = now - lastMutationAt;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 155 | `      const absentAge = now - missingSince;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 156 | `      const ready = document.readyState !== &#x27;loading&#x27;;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 157 | `      const readyAge = domReadyAt ? now - domReadyAt : 0;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 158 | `      const viewerReady = Boolean(document.querySelector(&#x27;div[data-page-index], .pf, [class*=&quot;DocumentViewer&quot;]&#x27;));` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 159 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 160 | `      const disappearedStably = premiumSeen &amp;&amp; absentAge &gt;= DISAPPEAR_CONFIRM_MS;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 161 | `      const neverAppearedAfterLoad = !premiumSeen` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 162 | `        &amp;&amp; ready` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 163 | `        &amp;&amp; (viewerReady &#124;&#124; document.readyState === &#x27;complete&#x27;)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 164 | `        &amp;&amp; readyAge &gt;= NEVER_APPEARED_READY_MS` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 165 | `        &amp;&amp; quietAge &gt;= NEVER_APPEARED_QUIET_MS;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 166 | `      const hardStableFallback = !premiumSeen` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 167 | `        &amp;&amp; document.readyState === &#x27;complete&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 168 | `        &amp;&amp; readyAge &gt;= 3000;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 169 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 170 | `      if (!verifiedAbsentSent &amp;&amp; (disappearedStably &#124;&#124; neverAppearedAfterLoad &#124;&#124; hardStableFallback)) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 171 | `        verifiedAbsentSent = true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 172 | `        publish(false, null, disappearedStably` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 173 | `          ? &#x27;premium-ui-stably-disappeared&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 174 | `          : hardStableFallback` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 175 | `            ? &#x27;premium-ui-not-found-after-hard-window&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 176 | `            : &#x27;premium-ui-not-found-after-stable-reload&#x27;, true);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 177 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 178 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 179 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 180 | `    const queueInspect = reason =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 181 | `      if (queued) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 182 | `      queued = true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 183 | `      queueMicrotask(() =&gt; inspect(reason));` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 184 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 185 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 186 | `    const observer = new MutationObserver(() =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 187 | `      lastMutationAt = performance.now();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 188 | `      removeOneTrustBanner();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 189 | `      queueInspect(&#x27;mutation&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 190 | `      if (mutationSettleTimer) clearTimeout(mutationSettleTimer);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 191 | `      mutationSettleTimer = setTimeout(() =&gt; inspect(&#x27;mutation-settled&#x27;), DISAPPEAR_CONFIRM_MS);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 192 | `    });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 193 | `    observer.observe(document, {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 194 | `      childList: true,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 195 | `      subtree: true,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 196 | `      attributes: true,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 197 | `      attributeFilter: [&#x27;class&#x27;, &#x27;style&#x27;, &#x27;hidden&#x27;, &#x27;disabled&#x27;]` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 198 | `    });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 199 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 200 | `    const onDomReady = () =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 201 | `      if (!domReadyAt) domReadyAt = performance.now();` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 202 | `      inspect(&#x27;dom-ready&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 203 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 204 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 205 | `    if (document.readyState === &#x27;loading&#x27;) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 206 | `      document.addEventListener(&#x27;DOMContentLoaded&#x27;, onDomReady, { once: true });` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 207 | `    } else {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 208 | `      onDomReady();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 209 | `    }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 210 | `    window.addEventListener(&#x27;pageshow&#x27;, () =&gt; inspect(&#x27;pageshow&#x27;));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 211 | `    inspect(&#x27;document-start&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 212 | `    const fastSettleTimer = setInterval(() =&gt; inspect(&#x27;passive-settle&#x27;), 40);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 213 | `    setTimeout(() =&gt; clearInterval(fastSettleTimer), 4000);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 214 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 215 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 216 | `  function runArmedPremiumProbe(config) {` | Bắt đầu hàm `runArmedPremiumProbe` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 217 | `    if (!config?.armed &#124;&#124; !config?.nonce) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 218 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 219 | `    const nonce = config.nonce;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 220 | `    let finished = false;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 221 | `    let scanQueued = false;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 222 | `    let buttonSeen = false;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 223 | `    let visibleSince = 0;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 224 | `    let missingSince = 0;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 225 | `    let lastVisibleButton = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 226 | `    let lastMutationAt = performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 227 | `    let domReadyAt = document.readyState === &#x27;loading&#x27; ? 0 : performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 228 | `    let originalScrollTop = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 229 | `    let scrollBox = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 230 | `    let settleTimer = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 231 | `    let hardTimer = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 232 | `    let observer = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 233 | `    let bottomProbeCompleted = false;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 234 | `    const startedAt = performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 235 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 236 | `    const finish = (present, match = null, reason = &#x27;&#x27;) =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 237 | `      if (finished) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 238 | `      finished = true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 239 | `      observer?.disconnect();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 240 | `      if (settleTimer) clearInterval(settleTimer);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 241 | `      if (hardTimer) clearTimeout(hardTimer);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 242 | `      if (scrollBox &amp;&amp; originalScrollTop != null) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 243 | `        try {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 244 | `          if (scrollBox === document.scrollingElement &#124;&#124; scrollBox === document.documentElement &#124;&#124; scrollBox === document.body) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 245 | `            window.scrollTo(0, originalScrollTop);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 246 | `          } else {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 247 | `            scrollBox.scrollTop = originalScrollTop;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 248 | `          }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 249 | `        } catch (_) {}` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 250 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 251 | `      const details = describeMatch(match &#124;&#124; lastVisibleButton);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 252 | `      send({` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 253 | `        type: &#x27;STD_PREMIUM_PROBE_RESULT&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 254 | `        nonce,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 255 | `        pageToken: PAGE_TOKEN,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 256 | `        present,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 257 | `        selector: details.selector,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 258 | `        text: details.text,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 259 | `        reason,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 260 | `        checkedAt: Date.now(),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 261 | `        elapsedMs: Math.round(performance.now() - startedAt)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 262 | `      });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 263 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 264 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 265 | `    const scanNow = reason =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 266 | `      if (finished) return true;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 267 | `      removeOneTrustBanner();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 268 | `      const now = performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 269 | `      const match = premiumUiInDom();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 270 | `      if (match) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 271 | `        buttonSeen = true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 272 | `        if (!visibleSince) visibleSince = now;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 273 | `        missingSince = 0;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 274 | `        lastVisibleButton = match;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 275 | `        if (now - visibleSince &gt;= 1200) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 276 | `          finish(true, match, `${reason &#124;&#124; &#x27;scan&#x27;}-button-persisted`);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 277 | `          return true;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 278 | `        }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 279 | `        return false;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 280 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 281 | `      if (buttonSeen) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 282 | `        if (!missingSince) missingSince = now;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 283 | `        const absentAge = now - missingSince;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 284 | `        const quietAge = now - lastMutationAt;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 285 | `        if (absentAge &gt;= DISAPPEAR_CONFIRM_MS) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 286 | `          finish(false, null, `${reason &#124;&#124; &#x27;scan&#x27;}-button-stably-disappeared`);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 287 | `          return true;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 288 | `        }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 289 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 290 | `      return false;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 291 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 292 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 293 | `    const queueScan = reason =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 294 | `      if (scanQueued &#124;&#124; finished) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 295 | `      scanQueued = true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 296 | `      queueMicrotask(() =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 297 | `        scanQueued = false;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 298 | `        scanNow(reason);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 299 | `      });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 300 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 301 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 302 | `    observer = new MutationObserver(() =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 303 | `      lastMutationAt = performance.now();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 304 | `      removeOneTrustBanner();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 305 | `      queueScan(&#x27;mutation&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 306 | `    });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 307 | `    observer.observe(document, {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 308 | `      childList: true,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 309 | `      subtree: true,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 310 | `      attributes: true,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 311 | `      attributeFilter: [&#x27;class&#x27;, &#x27;style&#x27;, &#x27;hidden&#x27;, &#x27;disabled&#x27;]` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 312 | `    });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 313 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 314 | `    const nudgeBottom = () =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 315 | `      if (finished &#124;&#124; !document.documentElement) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 316 | `      try {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 317 | `        scrollBox = findScrollBox();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 318 | `        const isDocument = scrollBox === document.scrollingElement &#124;&#124; scrollBox === document.documentElement &#124;&#124; scrollBox === document.body;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 319 | `        originalScrollTop = isDocument ? (window.scrollY &#124;&#124; document.documentElement.scrollTop &#124;&#124; 0) : scrollBox.scrollTop;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 320 | `        const height = isDocument` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 321 | `          ? Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight &#124;&#124; 0)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 322 | `          : scrollBox.scrollHeight;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 323 | `        const viewport = isDocument ? innerHeight : scrollBox.clientHeight;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 324 | `        const bottom = Math.max(0, height - viewport);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 325 | `        if (isDocument) window.scrollTo(0, bottom);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 326 | `        else scrollBox.scrollTop = bottom;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 327 | `        requestAnimationFrame(() =&gt; requestAnimationFrame(() =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 328 | `          // Keep the viewer at the bottom briefly so lazy React content has time` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 329 | `          // to mount before absence can be accepted.` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 330 | `          setTimeout(() =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 331 | `            bottomProbeCompleted = true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 332 | `            scanNow(&#x27;bottom-nudge&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 333 | `            if (!finished &amp;&amp; originalScrollTop != null) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 334 | `              if (isDocument) window.scrollTo(0, originalScrollTop);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 335 | `              else scrollBox.scrollTop = originalScrollTop;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 336 | `            }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 337 | `          }, 160);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 338 | `        }));` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 339 | `      } catch (_) {}` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 340 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 341 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 342 | `    const onDomReady = () =&gt; {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 343 | `      if (!domReadyAt) domReadyAt = performance.now();` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 344 | `      scanNow(&#x27;dom-ready&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 345 | `      if (!finished) nudgeBottom();` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 346 | `      setTimeout(() =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 347 | `        if (!finished) nudgeBottom();` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 348 | `      }, 300);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 349 | `    };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 350 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 351 | `    if (document.readyState === &#x27;loading&#x27;) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 352 | `      document.addEventListener(&#x27;DOMContentLoaded&#x27;, onDomReady, { once: true });` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 353 | `    } else {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 354 | `      onDomReady();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 355 | `    }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 356 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 357 | `    scanNow(&#x27;document-start&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 358 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 359 | `    settleTimer = setInterval(() =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 360 | `      if (finished &#124;&#124; scanNow(&#x27;settle&#x27;)) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 361 | `      const now = performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 362 | `      const ready = document.readyState !== &#x27;loading&#x27;;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 363 | `      const readyAge = domReadyAt ? now - domReadyAt : 0;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 364 | `      const quietAge = now - lastMutationAt;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 365 | `      const viewerReady = Boolean(document.querySelector(&#x27;div[data-page-index], .pf, [class*=&quot;DocumentViewer&quot;]&#x27;));` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 366 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 367 | `      if (!buttonSeen &amp;&amp; bottomProbeCompleted &amp;&amp; ready &amp;&amp; (viewerReady &#124;&#124; document.readyState === &#x27;complete&#x27;) &amp;&amp; readyAge &gt;= NEVER_APPEARED_READY_MS &amp;&amp; quietAge &gt;= NEVER_APPEARED_QUIET_MS) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 368 | `        finish(false, null, &#x27;button-never-appeared-after-stable-window&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 369 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 370 | `    }, 40);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 371 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 372 | `    hardTimer = setTimeout(() =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 373 | `      if (finished) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 374 | `      const match = premiumUiInDom();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 375 | `      if (match) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 376 | `        finish(true, match, &#x27;button-still-present-in-dom&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 377 | `        return;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 378 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 379 | `      const now = performance.now();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 380 | `      const readyAge = domReadyAt ? now - domReadyAt : 0;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 381 | `      const quietAge = now - lastMutationAt;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 382 | `      const viewerReady = Boolean(document.querySelector(&#x27;div[data-page-index], .pf, [class*=&quot;DocumentViewer&quot;]&#x27;));` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 383 | `      if (bottomProbeCompleted &amp;&amp; document.readyState === &#x27;complete&#x27; &amp;&amp; viewerReady &amp;&amp; readyAge &gt;= 2200 &amp;&amp; quietAge &gt;= 360) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 384 | `        finish(false, null, buttonSeen ? &#x27;button-removed-after-final-dom-check&#x27; : &#x27;button-absent-after-final-dom-check&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 385 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 386 | `      // Otherwise leave the probe pending. The background timeout keeps the gate` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 387 | `      // locked instead of allowing a false green result.` | Chú thích mục đích hoặc lý do của phần logic kế tiếp. |
| 388 | `    }, 3000);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 389 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 390 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 391 | `  async function bootstrap() {` | Bắt đầu hàm `bootstrap` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 392 | `    startOneTrustCleanup();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 393 | `    await send({` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 394 | `      type: &#x27;STD_PREMIUM_PAGE_START&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 395 | `      pageToken: PAGE_TOKEN,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 396 | `      url: location.href,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 397 | `      checkedAt: Date.now()` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 398 | `    });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 399 | `    startPassivePremiumMonitor();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 400 | `    const config = await send({` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 401 | `      type: &#x27;STD_PREMIUM_PROBE_READY&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 402 | `      pageToken: PAGE_TOKEN,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 403 | `      url: location.href` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 404 | `    });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 405 | `    runArmedPremiumProbe(config);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 406 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 407 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 408 | `  bootstrap().catch(() =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 409 | `    startPassivePremiumMonitor();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 410 | `  });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 411 | `})();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
