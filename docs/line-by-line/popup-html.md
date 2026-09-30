# `popup.html` — giải thích từng dòng

Tổng cộng **124 dòng**. Số dòng khớp với source v1.8.12 trong gói này.

| Dòng | Mã nguồn | Giải thích |
|---:|---|---|
| 1 | `&lt;!DOCTYPE html&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 2 | `&lt;html lang=&quot;vi&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 3 | `&lt;head&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 4 | `  &lt;meta charset=&quot;utf-8&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 5 | `  &lt;meta name=&quot;viewport&quot; content=&quot;width=device-width, initial-scale=1.0&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 6 | `  &lt;title&gt;AlphaD Studocu Downloader&lt;/title&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 7 | `  &lt;link rel=&quot;stylesheet&quot; href=&quot;popup.css&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 8 | `&lt;/head&gt;` | Đóng phần tử giao diện tương ứng. |
| 9 | `&lt;body&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 10 | `  &lt;header class=&quot;app-header&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 11 | `    &lt;div class=&quot;brand&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 12 | `      &lt;img class=&quot;brand-icon&quot; src=&quot;icons/icon48.png&quot; alt=&quot;AlphaD&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 13 | `      &lt;div&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 14 | `        &lt;h1&gt;AlphaD Studocu Downloader&lt;/h1&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 15 | `        &lt;p data-i18n=&quot;brandTagline&quot;&gt;Tự nhận diện • Xuất nhanh • PDF A4&lt;/p&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 16 | `      &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 17 | `    &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 18 | `    &lt;div class=&quot;header-tools&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 19 | `      &lt;div class=&quot;language-switch&quot; role=&quot;group&quot; aria-label=&quot;Language / Ngôn ngữ&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 20 | `        &lt;button id=&quot;langVi&quot; class=&quot;language-btn active&quot; type=&quot;button&quot; data-language=&quot;vi&quot; title=&quot;Tiếng Việt&quot;&gt;VI&lt;/button&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 21 | `        &lt;button id=&quot;langEn&quot; class=&quot;language-btn&quot; type=&quot;button&quot; data-language=&quot;en&quot; title=&quot;English&quot;&gt;EN&lt;/button&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 22 | `      &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 23 | `      &lt;span class=&quot;version&quot;&gt;v1.8.12&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 24 | `    &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 25 | `  &lt;/header&gt;` | Đóng phần tử giao diện tương ứng. |
| 26 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 27 | `  &lt;main&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 28 | `    &lt;section class=&quot;detect-section&quot; aria-labelledby=&quot;detect-title&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 29 | `      &lt;div class=&quot;detect-icon&quot; aria-hidden=&quot;true&quot;&gt;✦&lt;/div&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 30 | `      &lt;div class=&quot;detect-copy&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 31 | `        &lt;div class=&quot;detect-title-row&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 32 | `          &lt;h2 id=&quot;detect-title&quot; data-i18n=&quot;autoDetectTitle&quot;&gt;Tự nhận diện&lt;/h2&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 33 | `          &lt;span class=&quot;detect-badge&quot;&gt;AUTO&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 34 | `        &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 35 | `        &lt;p data-i18n=&quot;autoDetectDescription&quot;&gt;Extension tự phân tích từng trang và chọn cách xử lý nhanh, chính xác nhất. Không cần cấu hình thủ công.&lt;/p&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 36 | `      &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 37 | `    &lt;/section&gt;` | Đóng phần tử giao diện tương ứng. |
| 38 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 39 | `    &lt;button id=&quot;checkBtn&quot; class=&quot;btn btn-primary&quot; disabled&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 40 | `      &lt;span class=&quot;button-icon&quot;&gt;⇩&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 41 | `      &lt;span class=&quot;btn-text&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 42 | `        &lt;strong data-i18n=&quot;createPdf&quot;&gt;Tạo PDF A4&lt;/strong&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 43 | `        &lt;small data-i18n=&quot;createPdfDescription&quot;&gt;Tự phân tích chữ, hình, công thức và trang scan&lt;/small&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 44 | `      &lt;/span&gt;` | Đóng phần tử giao diện tương ứng. |
| 45 | `    &lt;/button&gt;` | Đóng phần tử giao diện tương ứng. |
| 46 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 47 | `    &lt;button id=&quot;clearBtn&quot; class=&quot;btn btn-secondary&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 48 | `      &lt;span class=&quot;button-icon&quot;&gt;✦&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 49 | `      &lt;span class=&quot;btn-text&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 50 | `        &lt;strong&gt;Active Premium&lt;/strong&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 51 | `        &lt;small data-i18n=&quot;activePremiumDescription&quot;&gt;Xóa cookies, tải lại trang và chờ nút Premium biến mất&lt;/small&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 52 | `      &lt;/span&gt;` | Đóng phần tử giao diện tương ứng. |
| 53 | `    &lt;/button&gt;` | Đóng phần tử giao diện tương ứng. |
| 54 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 55 | `    &lt;div id=&quot;cookieGate&quot; class=&quot;cookie-gate-status&quot; role=&quot;status&quot; aria-live=&quot;polite&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 56 | `      &lt;input id=&quot;cookieReady&quot; type=&quot;checkbox&quot; disabled&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 57 | `      &lt;div&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 58 | `        &lt;strong id=&quot;cookieGateTitle&quot; data-i18n=&quot;premiumNotReady&quot;&gt;Phiên chưa sẵn sàng&lt;/strong&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 59 | `        &lt;small id=&quot;cookieGateText&quot; data-i18n=&quot;premiumGateHint&quot;&gt;Hãy bấm Active Premium để mở khóa các thao tác.&lt;/small&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 60 | `      &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 61 | `    &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 62 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 63 | `    &lt;section id=&quot;jobPanel&quot; class=&quot;job-panel hidden&quot; aria-live=&quot;polite&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 64 | `      &lt;div class=&quot;job-head&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 65 | `        &lt;div&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 66 | `          &lt;strong id=&quot;jobTitle&quot; data-i18n=&quot;currentProgress&quot;&gt;Tiến trình hiện tại&lt;/strong&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 67 | `          &lt;small id=&quot;jobMode&quot; data-i18n=&quot;autoDetectTitle&quot;&gt;Tự nhận diện&lt;/small&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 68 | `        &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 69 | `        &lt;span id=&quot;jobPercent&quot;&gt;0%&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 70 | `      &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 71 | `      &lt;div class=&quot;job-progress&quot;&gt;&lt;div id=&quot;jobProgressFill&quot;&gt;&lt;/div&gt;&lt;/div&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 72 | `      &lt;div class=&quot;job-meta&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 73 | `        &lt;span id=&quot;jobPages&quot;&gt;0 / 0 trang&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 74 | `        &lt;span id=&quot;jobEta&quot; data-i18n=&quot;calculatingEta&quot;&gt;Đang tính ETA…&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 75 | `      &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 76 | `      &lt;div id=&quot;jobReport&quot; class=&quot;job-report hidden&quot;&gt;&lt;/div&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 77 | `      &lt;div id=&quot;previewPanel&quot; class=&quot;preview-panel hidden&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 78 | `        &lt;div class=&quot;preview-head&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 79 | `          &lt;strong data-i18n=&quot;integrityReport&quot;&gt;Báo cáo toàn vẹn&lt;/strong&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 80 | `          &lt;span id=&quot;previewState&quot; data-i18n=&quot;readyToDownload&quot;&gt;Sẵn sàng tải&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 81 | `        &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 82 | `        &lt;div id=&quot;previewSummary&quot; class=&quot;preview-summary&quot;&gt;&lt;/div&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 83 | `        &lt;div class=&quot;preview-actions&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 84 | `          &lt;button id=&quot;previewDownloadBtn&quot; class=&quot;mini-btn success&quot; data-i18n=&quot;downloadPdf&quot;&gt;Tải PDF&lt;/button&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 85 | `          &lt;button id=&quot;previewRebuildBtn&quot; class=&quot;mini-btn&quot; data-i18n=&quot;rescanSuspicious&quot;&gt;Quét lại trang nghi vấn&lt;/button&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 86 | `          &lt;button id=&quot;previewCancelBtn&quot; class=&quot;mini-btn danger&quot; data-i18n=&quot;cancel&quot;&gt;Hủy&lt;/button&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 87 | `        &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 88 | `      &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 89 | `      &lt;div class=&quot;job-actions&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 90 | `        &lt;button id=&quot;pauseBtn&quot; class=&quot;mini-btn&quot; data-i18n=&quot;pause&quot;&gt;Tạm dừng&lt;/button&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 91 | `        &lt;button id=&quot;cancelBtn&quot; class=&quot;mini-btn danger&quot; data-i18n=&quot;cancel&quot;&gt;Hủy&lt;/button&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 92 | `      &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 93 | `    &lt;/section&gt;` | Đóng phần tử giao diện tương ứng. |
| 94 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 95 | `    &lt;details class=&quot;utility-panel&quot; id=&quot;settingsPanel&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 96 | `      &lt;summary data-i18n=&quot;completionSettings&quot;&gt;Cài đặt hoàn tất&lt;/summary&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 97 | `      &lt;div class=&quot;toggle-list&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 98 | `        &lt;label&gt;&lt;input id=&quot;soundEnabled&quot; type=&quot;checkbox&quot; checked&gt;&lt;span data-i18n=&quot;playSound&quot;&gt;Phát tiếng ting khi hoàn tất&lt;/span&gt;&lt;/label&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 99 | `        &lt;label&gt;&lt;input id=&quot;notificationsEnabled&quot; type=&quot;checkbox&quot; checked&gt;&lt;span data-i18n=&quot;showNotifications&quot;&gt;Hiện thông báo hệ thống&lt;/span&gt;&lt;/label&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 100 | `        &lt;label&gt;&lt;input id=&quot;autoCloseOverlay&quot; type=&quot;checkbox&quot; checked&gt;&lt;span data-i18n=&quot;autoCloseOverlay&quot;&gt;Tự đóng overlay sau khi tải&lt;/span&gt;&lt;/label&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 101 | `        &lt;label&gt;&lt;input id=&quot;previewBeforeDownload&quot; type=&quot;checkbox&quot;&gt;&lt;span data-i18n=&quot;previewBeforeDownload&quot;&gt;Xem báo cáo toàn vẹn trước khi tải&lt;/span&gt;&lt;/label&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 102 | `      &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 103 | `      &lt;p class=&quot;shortcut-hint&quot;&gt;&lt;span data-i18n=&quot;shortcut&quot;&gt;Phím tắt&lt;/span&gt;: &lt;kbd&gt;Alt&lt;/kbd&gt; + &lt;kbd&gt;Shift&lt;/kbd&gt; + &lt;kbd&gt;D&lt;/kbd&gt;&lt;/p&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 104 | `    &lt;/details&gt;` | Đóng phần tử giao diện tương ứng. |
| 105 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 106 | `    &lt;details class=&quot;utility-panel&quot; id=&quot;historyPanel&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 107 | `      &lt;summary data-i18n=&quot;recentHistory&quot;&gt;Lịch sử tải gần đây&lt;/summary&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 108 | `      &lt;div id=&quot;historyList&quot; class=&quot;history-list&quot;&gt;&lt;p class=&quot;empty-state&quot; data-i18n=&quot;historyEmpty&quot;&gt;Chưa có tài liệu nào.&lt;/p&gt;&lt;/div&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 109 | `      &lt;button id=&quot;clearHistoryBtn&quot; class=&quot;text-btn&quot; data-i18n=&quot;clearHistory&quot;&gt;Xóa lịch sử&lt;/button&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 110 | `    &lt;/details&gt;` | Đóng phần tử giao diện tương ứng. |
| 111 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 112 | `    &lt;div id=&quot;status&quot; class=&quot;status-bar&quot;&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 113 | `      &lt;span class=&quot;status-dot&quot;&gt;&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 114 | `      &lt;span id=&quot;status-text&quot; data-i18n=&quot;ready&quot;&gt;Sẵn sàng hoạt động&lt;/span&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 115 | `    &lt;/div&gt;` | Đóng phần tử giao diện tương ứng. |
| 116 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 117 | `    &lt;footer&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 118 | `      &lt;span&gt;Made with&lt;/span&gt;&lt;span class=&quot;heart&quot; aria-label=&quot;red heart&quot;&gt;❤&lt;/span&gt;&lt;span&gt;by&lt;/span&gt;&lt;strong&gt;AlphaD&lt;/strong&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 119 | `    &lt;/footer&gt;` | Đóng phần tử giao diện tương ứng. |
| 120 | `  &lt;/main&gt;` | Đóng phần tử giao diện tương ứng. |
| 121 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 122 | `  &lt;script src=&quot;popup.js&quot;&gt;&lt;/script&gt;` | Khai báo một phần tử giao diện hoặc cấu trúc tài liệu. |
| 123 | `&lt;/body&gt;` | Đóng phần tử giao diện tương ứng. |
| 124 | `&lt;/html&gt;` | Đóng phần tử giao diện tương ứng. |
