# `popup.js` — giải thích từng dòng

Tổng cộng **617 dòng**. Số dòng khớp với source v1.8.12 trong gói này.

| Dòng | Mã nguồn | Giải thích |
|---:|---|---|
| 1 | `&#x27;use strict&#x27;;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 2 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 3 | `const LANGUAGE_KEY = &#x27;stdLanguage&#x27;;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 4 | `const COOKIE_GATE_KEY = &#x27;stdCookieClearGateV1&#x27;;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 5 | `const SUPPORTED_LANGUAGES = new Set([&#x27;vi&#x27;, &#x27;en&#x27;]);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 6 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 7 | `const DEFAULT_SETTINGS = {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 8 | `  soundEnabled: true,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 9 | `  notificationsEnabled: true,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 10 | `  autoCloseOverlay: true,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 11 | `  previewBeforeDownload: false` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 12 | `};` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 13 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 14 | `const MESSAGES = {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 15 | `  vi: {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 16 | `    brandTagline: &#x27;Tự nhận diện • Xuất nhanh • PDF A4&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 17 | `    autoDetectTitle: &#x27;Tự nhận diện&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 18 | `    autoDetectDescription: &#x27;Extension tự phân tích từng trang và chọn cách xử lý nhanh, chính xác nhất. Không cần cấu hình thủ công.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 19 | `    createPdf: &#x27;Tạo PDF A4&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 20 | `    createPdfDescription: &#x27;Tự phân tích chữ, hình, công thức và trang scan&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 21 | `    activePremiumDescription: &#x27;Xóa cookies, tải lại trang và chờ nút Premium biến mất&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 22 | `    premiumNotReady: &#x27;Chưa xác minh — thao tác đang bị khóa&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 23 | `    premiumReady: &#x27;Active Premium đã hoàn tất — thao tác đã mở khóa&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 24 | `    premiumGateHint: &#x27;Bấm Active Premium để xóa cookies, tải lại và kiểm tra nút Premium.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 25 | `    premiumGateReady: &#x27;Đã xác minh nút Premium đã biến mất{{cookies}}{{speed}}.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 26 | `    currentProgress: &#x27;Tiến trình hiện tại&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 27 | `    calculatingEta: &#x27;Đang tính ETA…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 28 | `    integrityReport: &#x27;Báo cáo toàn vẹn&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 29 | `    readyToDownload: &#x27;Sẵn sàng tải&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 30 | `    downloadPdf: &#x27;Tải PDF&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 31 | `    rescanSuspicious: &#x27;Quét lại trang nghi vấn&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 32 | `    cancel: &#x27;Hủy&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 33 | `    pause: &#x27;Tạm dừng&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 34 | `    resume: &#x27;Tiếp tục&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 35 | `    completionSettings: &#x27;Cài đặt hoàn tất&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 36 | `    playSound: &#x27;Phát tiếng ting khi hoàn tất&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 37 | `    showNotifications: &#x27;Hiện thông báo hệ thống&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 38 | `    autoCloseOverlay: &#x27;Tự đóng overlay sau khi tải&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 39 | `    previewBeforeDownload: &#x27;Xem báo cáo toàn vẹn trước khi tải&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 40 | `    shortcut: &#x27;Phím tắt&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 41 | `    recentHistory: &#x27;Lịch sử tải gần đây&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 42 | `    historyEmpty: &#x27;Chưa có tài liệu nào.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 43 | `    clearHistory: &#x27;Xóa lịch sử&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 44 | `    ready: &#x27;Sẵn sàng hoạt động&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 45 | `    gateRequiredStatus: &#x27;Bắt buộc bấm Active Premium trước khi tạo PDF.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 46 | `    gateRequiredAction: &#x27;Bắt buộc hoàn tất Active Premium trước khi thực hiện thao tác này.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 47 | `    gateRequiredError: &#x27;Hãy bấm “Active Premium” trước.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 48 | `    secondsRemaining: &#x27;Còn khoảng {{seconds}}s&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 49 | `    minutesRemaining: &#x27;Còn khoảng {{minutes}}m {{seconds}}s&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 50 | `    secondsElapsed: &#x27;{{seconds}} giây&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 51 | `    minutesElapsed: &#x27;{{minutes}}m {{seconds}}s&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 52 | `    warningCount: &#x27;{{count}} cảnh báo&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 53 | `    integrityPassed: &#x27;Toàn vẹn đạt yêu cầu&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 54 | `    pdfDocument: &#x27;Tài liệu PDF&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 55 | `    previewPages: &#x27;{{pages}}/{{detected}} trang • phục hồi {{recovered}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 56 | `    mechanism: &#x27;Cơ chế: Tự nhận diện từng trang&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 57 | `    inspectPages: &#x27;Trang nên kiểm tra lại: {{pages}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 58 | `    fingerprintOk: &#x27;Fingerprint cấu trúc: không phát hiện trang bất thường&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 59 | `    samplePages: &#x27;Trang mẫu báo cáo: {{pages}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 60 | `    pagesProgress: &#x27;{{current}} / {{total}} trang&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 61 | `    completedIn: &#x27;Hoàn tất trong {{time}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 62 | `    queuePosition: &#x27;Đang chuẩn bị xử lý&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 63 | `    waitingConfirmation: &#x27;Đang chờ xác nhận&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 64 | `    jobQueued: &#x27;Đang chờ xử lý&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 65 | `    jobRecovering: &#x27;Đang khôi phục từ checkpoint&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 66 | `    jobStarting: &#x27;Đang khởi động tiến trình&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 67 | `    jobScanning: &#x27;Đang gộp và xác minh tài liệu&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 68 | `    jobPaused: &#x27;Tiến trình đang tạm dừng&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 69 | `    jobCreatingPdf: &#x27;Đang tạo và tải PDF A4&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 70 | `    jobPreviewReady: &#x27;Báo cáo toàn vẹn đã sẵn sàng&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 71 | `    jobCompletedFile: &#x27;Đã tải {{filename}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 72 | `    jobCompleted: &#x27;Đã tải PDF A4&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 73 | `    jobError: &#x27;Không thể hoàn tất tài liệu&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 74 | `    jobCancelled: &#x27;Đã hủy tiến trình&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 75 | `    integrityPages: &#x27;Toàn vẹn: {{exported}}/{{detected}} trang&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 76 | `    recoveredPages: &#x27;Phục hồi: {{count}} trang&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 77 | `    fingerprintPages: &#x27;Fingerprint: {{count}} trang đạt cấu trúc&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 78 | `    genericPdfError: &#x27;Không thể tạo PDF.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 79 | `    statusError: &#x27;Lỗi: {{message}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 80 | `    downloadedFile: &#x27;Đã tải {{filename}}.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 81 | `    downloadedPdf: &#x27;Đã tải PDF A4.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 82 | `    studocuDocument: &#x27;Tài liệu Studocu&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 83 | `    noActiveTab: &#x27;Không tìm thấy tab đang mở.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 84 | `    openStudocuDocument: &#x27;Hãy mở đúng tab tài liệu Studocu.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 85 | `    addingQueue: &#x27;Đang bắt đầu tạo PDF…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 86 | `    startFailed: &#x27;Không thể khởi động tiến trình.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 87 | `    alreadyQueued: &#x27;Tài liệu đang được xử lý.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 88 | `    addedQueue: &#x27;Đã bắt đầu tạo PDF.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 89 | `    stateChangeFailed: &#x27;Không thể đổi trạng thái tiến trình.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 90 | `    cancelFailed: &#x27;Không thể hủy tiến trình.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 91 | `    cancelledStatus: &#x27;Đã hủy tiến trình.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 92 | `    previewFailed: &#x27;Không thể xử lý bản xem trước.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 93 | `    rebuildingPages: &#x27;Đang quét lại các trang nghi vấn…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 94 | `    cancellingPreview: &#x27;Đang hủy bản xem trước…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 95 | `    continuingPdf: &#x27;Đang tiếp tục tạo PDF…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 96 | `    noCurrentTab: &#x27;Không tìm thấy tab hiện tại.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 97 | `    openStudocuBeforePremium: &#x27;Hãy mở đúng tab Studocu trước khi dùng Active Premium.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 98 | `    activatingPremium: &#x27;Đang xóa cookies, tải lại và chờ nút Premium biến mất…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 99 | `    premiumConfirmFailed: &#x27;Không thể xác nhận trạng thái Active Premium.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 100 | `    premiumChecking: &#x27;Đang chờ nút Premium biến mất…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 101 | `    premiumBannerStillVisible: &#x27;Nút Premium vẫn còn hiển thị. Các thao tác tiếp tục bị khóa.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 102 | `    premiumDone: &#x27;Active Premium hoàn tất. Nút Premium đã biến mất sau {{time}}ms; đã xóa {{count}} cookies.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 103 | `    noHistory: &#x27;Chưa có tài liệu nào.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 104 | `    showFile: &#x27;Hiện file&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 105 | `    historyMeta: &#x27;{{pages}} trang • {{time}} • Tự nhận diện&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 106 | `    autoDetect: &#x27;Tự nhận diện&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 107 | `  },` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 108 | `  en: {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 109 | `    brandTagline: &#x27;Auto-detect • Fast export • A4 PDF&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 110 | `    autoDetectTitle: &#x27;Auto Detect&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 111 | `    autoDetectDescription: &#x27;The extension analyzes every page and automatically chooses the fastest reliable strategy. No manual setup is required.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 112 | `    createPdf: &#x27;Create A4 PDF&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 113 | `    createPdfDescription: &#x27;Automatically analyzes text, images, formulas, and scanned pages&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 114 | `    activePremiumDescription: &#x27;Remove cookies, reload, and wait for the Premium button to disappear&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 115 | `    premiumNotReady: &#x27;Not verified — actions are locked&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 116 | `    premiumReady: &#x27;Active Premium completed — actions unlocked&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 117 | `    premiumGateHint: &#x27;Press Active Premium to remove cookies, reload, and check the Premium button.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 118 | `    premiumGateReady: &#x27;Verified: the Premium button disappeared{{cookies}}{{speed}}.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 119 | `    currentProgress: &#x27;Current progress&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 120 | `    calculatingEta: &#x27;Calculating ETA…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 121 | `    integrityReport: &#x27;Integrity report&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 122 | `    readyToDownload: &#x27;Ready to download&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 123 | `    downloadPdf: &#x27;Download PDF&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 124 | `    rescanSuspicious: &#x27;Rescan suspicious pages&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 125 | `    cancel: &#x27;Cancel&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 126 | `    pause: &#x27;Pause&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 127 | `    resume: &#x27;Resume&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 128 | `    completionSettings: &#x27;Completion settings&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 129 | `    playSound: &#x27;Play a completion chime&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 130 | `    showNotifications: &#x27;Show system notifications&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 131 | `    autoCloseOverlay: &#x27;Close the overlay after download&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 132 | `    previewBeforeDownload: &#x27;Preview the integrity report before download&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 133 | `    shortcut: &#x27;Shortcut&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 134 | `    recentHistory: &#x27;Recent download history&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 135 | `    historyEmpty: &#x27;No documents yet.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 136 | `    clearHistory: &#x27;Clear history&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 137 | `    ready: &#x27;Ready&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 138 | `    gateRequiredStatus: &#x27;Active Premium is required before creating a PDF.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 139 | `    gateRequiredAction: &#x27;Complete Active Premium before performing this action.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 140 | `    gateRequiredError: &#x27;Press “Active Premium” first.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 141 | `    secondsRemaining: &#x27;About {{seconds}}s remaining&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 142 | `    minutesRemaining: &#x27;About {{minutes}}m {{seconds}}s remaining&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 143 | `    secondsElapsed: &#x27;{{seconds}} seconds&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 144 | `    minutesElapsed: &#x27;{{minutes}}m {{seconds}}s&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 145 | `    warningCount: &#x27;{{count}} warnings&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 146 | `    integrityPassed: &#x27;Integrity checks passed&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 147 | `    pdfDocument: &#x27;PDF document&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 148 | `    previewPages: &#x27;{{pages}}/{{detected}} pages • {{recovered}} recovered&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 149 | `    mechanism: &#x27;Engine: per-page auto detection&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 150 | `    inspectPages: &#x27;Pages to review: {{pages}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 151 | `    fingerprintOk: &#x27;Structure fingerprint: no suspicious pages detected&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 152 | `    samplePages: &#x27;Report sample pages: {{pages}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 153 | `    pagesProgress: &#x27;{{current}} / {{total}} pages&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 154 | `    completedIn: &#x27;Completed in {{time}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 155 | `    queuePosition: &#x27;Preparing the export&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 156 | `    waitingConfirmation: &#x27;Waiting for confirmation&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 157 | `    jobQueued: &#x27;Waiting to start&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 158 | `    jobRecovering: &#x27;Recovering from checkpoint&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 159 | `    jobStarting: &#x27;Starting export&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 160 | `    jobScanning: &#x27;Merging and verifying the document&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 161 | `    jobPaused: &#x27;Export is paused&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 162 | `    jobCreatingPdf: &#x27;Creating and downloading the A4 PDF&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 163 | `    jobPreviewReady: &#x27;Integrity report is ready&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 164 | `    jobCompletedFile: &#x27;Downloaded {{filename}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 165 | `    jobCompleted: &#x27;A4 PDF downloaded&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 166 | `    jobError: &#x27;Could not complete the document&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 167 | `    jobCancelled: &#x27;Export cancelled&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 168 | `    integrityPages: &#x27;Integrity: {{exported}}/{{detected}} pages&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 169 | `    recoveredPages: &#x27;Recovered: {{count}} pages&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 170 | `    fingerprintPages: &#x27;Fingerprint: {{count}} pages verified&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 171 | `    genericPdfError: &#x27;Could not create the PDF.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 172 | `    statusError: &#x27;Error: {{message}}&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 173 | `    downloadedFile: &#x27;Downloaded {{filename}}.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 174 | `    downloadedPdf: &#x27;A4 PDF downloaded.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 175 | `    studocuDocument: &#x27;Studocu document&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 176 | `    noActiveTab: &#x27;No active tab was found.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 177 | `    openStudocuDocument: &#x27;Open a supported Studocu document tab.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 178 | `    addingQueue: &#x27;Starting the PDF export…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 179 | `    startFailed: &#x27;Could not start the export.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 180 | `    alreadyQueued: &#x27;This document is already being processed.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 181 | `    addedQueue: &#x27;PDF export started.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 182 | `    stateChangeFailed: &#x27;Could not change the export state.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 183 | `    cancelFailed: &#x27;Could not cancel the export.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 184 | `    cancelledStatus: &#x27;Export cancelled.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 185 | `    previewFailed: &#x27;Could not process the preview.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 186 | `    rebuildingPages: &#x27;Rescanning suspicious pages…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 187 | `    cancellingPreview: &#x27;Cancelling the preview…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 188 | `    continuingPdf: &#x27;Continuing PDF creation…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 189 | `    noCurrentTab: &#x27;No current tab was found.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 190 | `    openStudocuBeforePremium: &#x27;Open a Studocu tab before using Active Premium.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 191 | `    activatingPremium: &#x27;Removing cookies, reloading, and waiting for the Premium button to disappear…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 192 | `    premiumConfirmFailed: &#x27;Could not confirm the Active Premium state.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 193 | `    premiumChecking: &#x27;Waiting for the Premium button to disappear…&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 194 | `    premiumBannerStillVisible: &#x27;The Premium button is still visible. Actions remain locked.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 195 | `    premiumDone: &#x27;Active Premium completed. The Premium button disappeared after {{time}}ms; removed {{count}} cookies.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 196 | `    noHistory: &#x27;No documents yet.&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 197 | `    showFile: &#x27;Show file&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 198 | `    historyMeta: &#x27;{{pages}} pages • {{time}} • Auto Detect&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 199 | `    autoDetect: &#x27;Auto Detect&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 200 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 201 | `};` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 202 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 203 | `let currentLanguage = &#x27;vi&#x27;;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 204 | `let activeTab = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 205 | `let pollTimer = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 206 | `let lastJob = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 207 | `let lastHistory = [];` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 208 | `let cookieGateReady = false;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 209 | `let cookieGateState = null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 210 | `let premiumActivationRunning = false;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 211 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 212 | `const $ = selector =&gt; document.querySelector(selector);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 213 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 214 | `function t(key, values = {}) {` | Bắt đầu hàm `t` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 215 | `  const source = MESSAGES[currentLanguage]?.[key] ?? MESSAGES.vi[key] ?? key;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 216 | `  return String(source).replace(/\{\{(\w+)\}\}/g, (_, name) =&gt; values[name] ?? &#x27;&#x27;);` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 217 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 218 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 219 | `function applyStaticTranslations() {` | Bắt đầu hàm `applyStaticTranslations` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 220 | `  document.documentElement.lang = currentLanguage;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 221 | `  document.querySelectorAll(&#x27;[data-i18n]&#x27;).forEach(element =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 222 | `    const key = element.getAttribute(&#x27;data-i18n&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 223 | `    if (key) element.textContent = t(key);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 224 | `  });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 225 | `  document.querySelectorAll(&#x27;.language-btn&#x27;).forEach(button =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 226 | `    button.classList.toggle(&#x27;active&#x27;, button.dataset.language === currentLanguage);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 227 | `    button.setAttribute(&#x27;aria-pressed&#x27;, button.dataset.language === currentLanguage ? &#x27;true&#x27; : &#x27;false&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 228 | `  });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 229 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 230 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 231 | `async function loadLanguage() {` | Bắt đầu hàm `loadLanguage` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 232 | `  const stored = await chrome.storage.local.get(LANGUAGE_KEY).catch(() =&gt; ({}));` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 233 | `  const language = SUPPORTED_LANGUAGES.has(stored?.[LANGUAGE_KEY]) ? stored[LANGUAGE_KEY] : &#x27;vi&#x27;;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 234 | `  currentLanguage = language;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 235 | `  applyStaticTranslations();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 236 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 237 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 238 | `async function setLanguage(language) {` | Bắt đầu hàm `setLanguage` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 239 | `  if (!SUPPORTED_LANGUAGES.has(language) &#124;&#124; language === currentLanguage) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 240 | `  currentLanguage = language;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 241 | `  await chrome.storage.local.set({ [LANGUAGE_KEY]: language }).catch(() =&gt; {});` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 242 | `  await chrome.runtime.sendMessage({ type: &#x27;STD_SET_LANGUAGE&#x27;, language }).catch(() =&gt; {});` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 243 | `  applyStaticTranslations();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 244 | `  renderCookieGate(cookieGateState &#124;&#124; { ready: false });` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 245 | `  renderJob(lastJob);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 246 | `  renderHistory(lastHistory);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 247 | `  if (!cookieGateReady &amp;&amp; !isJobRunning()) setStatus(t(&#x27;gateRequiredStatus&#x27;), &#x27;idle&#x27;);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 248 | `  else if (!isJobRunning() &amp;&amp; !lastJob) setStatus(t(&#x27;ready&#x27;), &#x27;idle&#x27;);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 249 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 250 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 251 | `function isSupportedStudocuUrl(url) {` | Bắt đầu hàm `isSupportedStudocuUrl` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 252 | `  try {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 253 | `    const parsed = new URL(url &#124;&#124; &#x27;&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 254 | `    return /^https?:$/.test(parsed.protocol) &amp;&amp; /(^&#124;\.)studocu\.(com&#124;vn)$/i.test(parsed.hostname);` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 255 | `  } catch (_) {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 256 | `    return false;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 257 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 258 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 259 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 260 | `function setStatus(message, state = &#x27;idle&#x27;) {` | Bắt đầu hàm `setStatus` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 261 | `  const bar = $(&#x27;#status&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 262 | `  const text = $(&#x27;#status-text&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 263 | `  if (text) text.textContent = message;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 264 | `  if (bar) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 265 | `    bar.classList.toggle(&#x27;processing&#x27;, state === &#x27;processing&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 266 | `    bar.classList.toggle(&#x27;error&#x27;, state === &#x27;error&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 267 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 268 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 269 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 270 | `function isJobRunning(job = lastJob) {` | Bắt đầu hàm `isJobRunning` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 271 | `  return Boolean(job &amp;&amp; [&#x27;queued&#x27;, &#x27;recovering&#x27;, &#x27;starting&#x27;, &#x27;scanning&#x27;, &#x27;creating_pdf&#x27;, &#x27;paused&#x27;, &#x27;preview_ready&#x27;].includes(job.status));` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 272 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 273 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 274 | `function updateActionAvailability() {` | Bắt đầu hàm `updateActionAvailability` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 275 | `  const running = isJobRunning();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 276 | `  const blockNewActions = !cookieGateReady &#124;&#124; running;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 277 | `  if ($(&#x27;#checkBtn&#x27;)) $(&#x27;#checkBtn&#x27;).disabled = blockNewActions;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 278 | `  if ($(&#x27;#clearBtn&#x27;)) $(&#x27;#clearBtn&#x27;).disabled = running &#124;&#124; premiumActivationRunning;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 279 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 280 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 281 | `function renderCookieGate(state) {` | Bắt đầu hàm `renderCookieGate` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 282 | `  cookieGateState = state &#124;&#124; null;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 283 | `  cookieGateReady = Boolean(state?.ready) &amp;&amp; state?.bannerPresent !== true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 284 | `  const panel = $(&#x27;#cookieGate&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 285 | `  const checkbox = $(&#x27;#cookieReady&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 286 | `  const title = $(&#x27;#cookieGateTitle&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 287 | `  const text = $(&#x27;#cookieGateText&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 288 | `  if (checkbox) checkbox.checked = cookieGateReady;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 289 | `  if (panel) panel.classList.toggle(&#x27;ready&#x27;, cookieGateReady);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 290 | `  if (title) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 291 | `    title.textContent = state?.checking` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 292 | `      ? t(&#x27;premiumChecking&#x27;)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 293 | `      : cookieGateReady` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 294 | `        ? t(&#x27;premiumReady&#x27;)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 295 | `        : t(&#x27;premiumNotReady&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 296 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 297 | `  if (text) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 298 | `    const cookies = state?.removedCount != null ? ` • ${state.removedCount} cookies` : &#x27;&#x27;;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 299 | `    const speed = state?.checkElapsedMs != null ? ` • ${state.checkElapsedMs}ms` : &#x27;&#x27;;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 300 | `    text.textContent = state?.checking` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 301 | `      ? t(&#x27;premiumChecking&#x27;)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 302 | `      : cookieGateReady` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 303 | `        ? t(&#x27;premiumGateReady&#x27;, { cookies, speed })` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 304 | `        : state?.bannerPresent === true` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 305 | `          ? t(&#x27;premiumBannerStillVisible&#x27;)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 306 | `          : t(&#x27;premiumGateHint&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 307 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 308 | `  updateActionAvailability();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 309 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 310 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 311 | `async function refreshCookieGate() {` | Bắt đầu hàm `refreshCookieGate` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 312 | `  const response = await chrome.runtime.sendMessage({ type: &#x27;STD_GET_COOKIE_GATE&#x27;, sourceTabId: activeTab?.id ?? null }).catch(() =&gt; null);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 313 | `  renderCookieGate(response?.gate &#124;&#124; { ready: false });` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 314 | `  return cookieGateReady;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 315 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 316 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 317 | `async function requireCookieGate() {` | Bắt đầu hàm `requireCookieGate` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 318 | `  const ready = await refreshCookieGate();` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 319 | `  if (!ready) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 320 | `    setStatus(t(&#x27;gateRequiredAction&#x27;), &#x27;error&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 321 | `    throw new Error(t(&#x27;gateRequiredError&#x27;));` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 322 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 323 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 324 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 325 | `function formatDuration(ms) {` | Bắt đầu hàm `formatDuration` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 326 | `  if (!Number.isFinite(ms) &#124;&#124; ms &lt; 0) return t(&#x27;calculatingEta&#x27;);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 327 | `  const seconds = Math.max(0, Math.ceil(ms / 1000));` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 328 | `  if (seconds &lt; 60) return t(&#x27;secondsRemaining&#x27;, { seconds });` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 329 | `  const minutes = Math.floor(seconds / 60);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 330 | `  return t(&#x27;minutesRemaining&#x27;, { minutes, seconds: seconds % 60 });` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 331 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 332 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 333 | `function formatElapsed(ms) {` | Bắt đầu hàm `formatElapsed` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 334 | `  const seconds = Math.max(1, Math.round((Number(ms) &#124;&#124; 0) / 1000));` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 335 | `  return seconds &lt; 60` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 336 | `    ? t(&#x27;secondsElapsed&#x27;, { seconds })` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 337 | `    : t(&#x27;minutesElapsed&#x27;, { minutes: Math.floor(seconds / 60), seconds: seconds % 60 });` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 338 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 339 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 340 | `async function initSettings() {` | Bắt đầu hàm `initSettings` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 341 | `  const response = await chrome.runtime.sendMessage({ type: &#x27;STD_GET_SETTINGS&#x27; }).catch(() =&gt; null);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 342 | `  const settings = { ...DEFAULT_SETTINGS, ...(response?.settings &#124;&#124; {}) };` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 343 | `  for (const key of Object.keys(DEFAULT_SETTINGS)) {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 344 | `    const input = document.getElementById(key);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 345 | `    if (!input) continue;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 346 | `    input.checked = Boolean(settings[key]);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 347 | `    input.addEventListener(&#x27;change&#x27;, async () =&gt; {` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 348 | `      const next = {};` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 349 | `      for (const settingKey of Object.keys(DEFAULT_SETTINGS)) {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 350 | `        next[settingKey] = Boolean(document.getElementById(settingKey)?.checked);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 351 | `      }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 352 | `      await chrome.runtime.sendMessage({ type: &#x27;STD_SAVE_SETTINGS&#x27;, settings: next }).catch(() =&gt; {});` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 353 | `    });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 354 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 355 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 356 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 357 | `function renderPreview(job) {` | Bắt đầu hàm `renderPreview` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 358 | `  const panel = $(&#x27;#previewPanel&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 359 | `  if (!panel) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 360 | `  if (!job &#124;&#124; job.status !== &#x27;preview_ready&#x27; &#124;&#124; !job.preview) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 361 | `    panel.classList.add(&#x27;hidden&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 362 | `    return;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 363 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 364 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 365 | `  panel.classList.remove(&#x27;hidden&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 366 | `  const preview = job.preview;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 367 | `  const warnings = Array.isArray(preview.suspiciousPages) ? preview.suspiciousPages : [];` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 368 | `  $(&#x27;#previewState&#x27;).textContent = warnings.length ? t(&#x27;warningCount&#x27;, { count: warnings.length }) : t(&#x27;integrityPassed&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 369 | `  $(&#x27;#previewSummary&#x27;).textContent = [` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 370 | `    preview.filename &#124;&#124; preview.title &#124;&#124; t(&#x27;pdfDocument&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 371 | `    t(&#x27;previewPages&#x27;, {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 372 | `      pages: preview.pageCount &#124;&#124; 0,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 373 | `      detected: preview.detectedPages &#124;&#124; preview.pageCount &#124;&#124; 0,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 374 | `      recovered: preview.recoveredPages &#124;&#124; 0` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 375 | `    }),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 376 | `    t(&#x27;mechanism&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 377 | `    warnings.length ? t(&#x27;inspectPages&#x27;, { pages: warnings.join(&#x27;, &#x27;) }) : t(&#x27;fingerprintOk&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 378 | `    preview.samplePages?.length ? t(&#x27;samplePages&#x27;, { pages: preview.samplePages.join(&#x27;, &#x27;) }) : &#x27;&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 379 | `  ].filter(Boolean).join(&#x27;\n&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 380 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 381 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 382 | `function renderJob(job) {` | Bắt đầu hàm `renderJob` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 383 | `  const previousStatus = lastJob?.status &#124;&#124; null;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 384 | `  lastJob = job;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 385 | `  const panel = $(&#x27;#jobPanel&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 386 | `  const activeStatuses = [&#x27;queued&#x27;, &#x27;recovering&#x27;, &#x27;starting&#x27;, &#x27;scanning&#x27;, &#x27;creating_pdf&#x27;, &#x27;paused&#x27;, &#x27;preview_ready&#x27;];` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 387 | `  const running = job &amp;&amp; activeStatuses.includes(job.status);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 388 | `  updateActionAvailability();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 389 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 390 | `  if (!job) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 391 | `    panel?.classList.add(&#x27;hidden&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 392 | `    renderPreview(null);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 393 | `    return;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 394 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 395 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 396 | `  panel?.classList.remove(&#x27;hidden&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 397 | `  const progress = Math.max(0, Math.min(100, Number(job.progress) &#124;&#124; (job.status === &#x27;completed&#x27; ? 100 : 0)));` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 398 | `  $(&#x27;#jobProgressFill&#x27;).style.width = `${progress}%`;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 399 | `  $(&#x27;#jobPercent&#x27;).textContent = `${Math.round(progress)}%`;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 400 | `  $(&#x27;#jobPages&#x27;).textContent = t(&#x27;pagesProgress&#x27;, {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 401 | `    current: job.currentPage &#124;&#124; job.pageCount &#124;&#124; 0,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 402 | `    total: job.totalPages &#124;&#124; job.pageCount &#124;&#124; 0` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 403 | `  });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 404 | `  $(&#x27;#jobEta&#x27;).textContent = job.status === &#x27;completed&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 405 | `    ? t(&#x27;completedIn&#x27;, { time: formatElapsed(job.elapsedMs) })` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 406 | `    : job.status === &#x27;queued&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 407 | `      ? t(&#x27;queuePosition&#x27;, { position: job.queuePosition ?? &#x27;—&#x27; })` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 408 | `      : job.status === &#x27;preview_ready&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 409 | `        ? t(&#x27;waitingConfirmation&#x27;)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 410 | `        : formatDuration(job.etaMs);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 411 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 412 | `  $(&#x27;#jobMode&#x27;).textContent = t(&#x27;autoDetect&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 413 | `  $(&#x27;#pauseBtn&#x27;).textContent = job.paused &#124;&#124; job.status === &#x27;paused&#x27; ? t(&#x27;resume&#x27;) : t(&#x27;pause&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 414 | `  $(&#x27;#pauseBtn&#x27;).disabled = ![&#x27;scanning&#x27;, &#x27;paused&#x27;].includes(job.status);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 415 | `  $(&#x27;#cancelBtn&#x27;).disabled = !running;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 416 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 417 | `  const labels = {` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 418 | `    queued: t(&#x27;jobQueued&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 419 | `    recovering: t(&#x27;jobRecovering&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 420 | `    starting: t(&#x27;jobStarting&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 421 | `    scanning: t(&#x27;jobScanning&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 422 | `    paused: t(&#x27;jobPaused&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 423 | `    creating_pdf: t(&#x27;jobCreatingPdf&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 424 | `    preview_ready: t(&#x27;jobPreviewReady&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 425 | `    completed: job.filename ? t(&#x27;jobCompletedFile&#x27;, { filename: job.filename }) : t(&#x27;jobCompleted&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 426 | `    error: t(&#x27;jobError&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 427 | `    cancelled: t(&#x27;jobCancelled&#x27;)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 428 | `  };` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 429 | `  $(&#x27;#jobTitle&#x27;).textContent = labels[job.status] &#124;&#124; t(&#x27;currentProgress&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 430 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 431 | `  const reportBox = $(&#x27;#jobReport&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 432 | `  if (job.report) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 433 | `    const fingerprint = job.report.fingerprintSummary &#124;&#124; {};` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 434 | `    reportBox.classList.remove(&#x27;hidden&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 435 | `    reportBox.textContent = [` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 436 | `      t(&#x27;integrityPages&#x27;, {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 437 | `        exported: job.report.exportedPages &#124;&#124; job.pageCount &#124;&#124; 0,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 438 | `        detected: job.report.detectedPages &#124;&#124; job.totalPages &#124;&#124; 0` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 439 | `      }),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 440 | `      t(&#x27;mechanism&#x27;),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 441 | `      t(&#x27;recoveredPages&#x27;, { count: job.report.recoveredPages &#124;&#124; 0 }),` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 442 | `      fingerprint.verifiedPages != null ? t(&#x27;fingerprintPages&#x27;, { count: fingerprint.verifiedPages }) : null` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 443 | `    ].filter(Boolean).join(&#x27;\n&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 444 | `  } else {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 445 | `    reportBox.classList.add(&#x27;hidden&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 446 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 447 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 448 | `  renderPreview(job);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 449 | `  if (job.status === &#x27;error&#x27;) setStatus(t(&#x27;statusError&#x27;, { message: job.error &#124;&#124; t(&#x27;genericPdfError&#x27;) }), &#x27;error&#x27;);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 450 | `  else if (running) setStatus(labels[job.status], &#x27;processing&#x27;);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 451 | `  else if (job.status === &#x27;completed&#x27;) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 452 | `    setStatus(job.filename ? t(&#x27;downloadedFile&#x27;, { filename: job.filename }) : t(&#x27;downloadedPdf&#x27;), &#x27;idle&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 453 | `    if (previousStatus !== &#x27;completed&#x27;) loadHistory().catch(() =&gt; {});` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 454 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 455 | `  updateActionAvailability();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 456 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 457 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 458 | `async function pollJobStatus() {` | Bắt đầu hàm `pollJobStatus` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 459 | `  if (!activeTab?.id) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 460 | `  const response = await chrome.runtime.sendMessage({ type: &#x27;STD_GET_EXPORT_STATUS&#x27;, tabId: activeTab.id }).catch(() =&gt; null);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 461 | `  renderJob(response?.job &#124;&#124; null);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 462 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 463 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 464 | `async function startExport() {` | Bắt đầu hàm `startExport` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 465 | `  await requireCookieGate();` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 466 | `  if (!activeTab?.id) throw new Error(t(&#x27;noActiveTab&#x27;));` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 467 | `  if (!isSupportedStudocuUrl(activeTab.url)) throw new Error(t(&#x27;openStudocuDocument&#x27;));` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 468 | `  setStatus(t(&#x27;addingQueue&#x27;), &#x27;processing&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 469 | `  const response = await chrome.runtime.sendMessage({` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 470 | `    type: &#x27;STD_START_BACKGROUND_EXPORT&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 471 | `    tabId: activeTab.id,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 472 | `    title: activeTab.title &#124;&#124; &#x27;Studocu document&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 473 | `  });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 474 | `  if (!response?.ok) throw new Error(response?.error &#124;&#124; t(&#x27;startFailed&#x27;));` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 475 | `  setStatus(response.alreadyQueued ? t(&#x27;alreadyQueued&#x27;) : t(&#x27;addedQueue&#x27;), &#x27;processing&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 476 | `  await pollJobStatus();` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 477 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 478 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 479 | `async function setPaused(paused) {` | Bắt đầu hàm `setPaused` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 480 | `  if (!activeTab?.id) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 481 | `  const response = await chrome.runtime.sendMessage({ type: &#x27;STD_SET_JOB_PAUSED&#x27;, tabId: activeTab.id, paused });` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 482 | `  if (!response?.ok) throw new Error(response?.error &#124;&#124; t(&#x27;stateChangeFailed&#x27;));` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 483 | `  await pollJobStatus();` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 484 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 485 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 486 | `async function cancelJob() {` | Bắt đầu hàm `cancelJob` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 487 | `  if (!activeTab?.id) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 488 | `  const response = await chrome.runtime.sendMessage({ type: &#x27;STD_CANCEL_BACKGROUND_EXPORT&#x27;, tabId: activeTab.id });` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 489 | `  if (!response?.ok) throw new Error(response?.error &#124;&#124; t(&#x27;cancelFailed&#x27;));` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 490 | `  setStatus(t(&#x27;cancelledStatus&#x27;), &#x27;idle&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 491 | `  await pollJobStatus();` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 492 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 493 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 494 | `async function sendPreviewDecision(decision) {` | Bắt đầu hàm `sendPreviewDecision` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 495 | `  if (!activeTab?.id) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 496 | `  const response = await chrome.runtime.sendMessage({ type: &#x27;STD_PREVIEW_DECISION&#x27;, tabId: activeTab.id, decision });` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 497 | `  if (!response?.ok) throw new Error(response?.error &#124;&#124; t(&#x27;previewFailed&#x27;));` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 498 | `  const message = decision === &#x27;rebuild&#x27;` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 499 | `    ? t(&#x27;rebuildingPages&#x27;)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 500 | `    : decision === &#x27;cancel&#x27;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 501 | `      ? t(&#x27;cancellingPreview&#x27;)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 502 | `      : t(&#x27;continuingPdf&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 503 | `  setStatus(message, &#x27;processing&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 504 | `  await pollJobStatus();` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 505 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 506 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 507 | `async function activatePremium() {` | Bắt đầu hàm `activatePremium` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 508 | `  if (!activeTab?.id) throw new Error(t(&#x27;noCurrentTab&#x27;));` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 509 | `  if (!isSupportedStudocuUrl(activeTab.url)) throw new Error(t(&#x27;openStudocuBeforePremium&#x27;));` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 510 | `  premiumActivationRunning = true;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 511 | `  renderCookieGate({ ...(cookieGateState &#124;&#124; {}), ready: false, checking: true });` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 512 | `  setStatus(t(&#x27;activatingPremium&#x27;), &#x27;processing&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 513 | `  try {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 514 | `    const result = await chrome.runtime.sendMessage({` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 515 | `      type: &#x27;STD_ACTIVE_PREMIUM&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 516 | `      sourceTabId: activeTab.id,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 517 | `      sourceUrl: activeTab.url &#124;&#124; &#x27;&#x27;,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 518 | `      language: currentLanguage` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 519 | `    }).catch(() =&gt; null);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 520 | `    if (!result?.ok) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 521 | `      renderCookieGate(result?.gate &#124;&#124; { ready: false, bannerPresent: true });` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 522 | `      throw new Error(result?.error &#124;&#124; t(&#x27;premiumConfirmFailed&#x27;));` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 523 | `    }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 524 | `    renderCookieGate(result.gate);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 525 | `    setStatus(t(&#x27;premiumDone&#x27;, {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 526 | `      count: result.removedCount &#124;&#124; result.gate?.removedCount &#124;&#124; 0,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 527 | `      time: result.checkElapsedMs &#124;&#124; result.gate?.checkElapsedMs &#124;&#124; 0` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 528 | `    }), &#x27;idle&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 529 | `    setTimeout(() =&gt; refreshCookieGate().catch(() =&gt; {}), 350);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 530 | `    setTimeout(() =&gt; refreshCookieGate().catch(() =&gt; {}), 1400);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 531 | `  } finally {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 532 | `    premiumActivationRunning = false;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 533 | `    updateActionAvailability();` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 534 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 535 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 536 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 537 | `function renderHistory(history) {` | Bắt đầu hàm `renderHistory` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 538 | `  lastHistory = Array.isArray(history) ? history : [];` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 539 | `  const list = $(&#x27;#historyList&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 540 | `  if (!lastHistory.length) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 541 | `    list.innerHTML = &#x27;&#x27;;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 542 | `    const empty = document.createElement(&#x27;p&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 543 | `    empty.className = &#x27;empty-state&#x27;;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 544 | `    empty.textContent = t(&#x27;noHistory&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 545 | `    list.appendChild(empty);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 546 | `    return;` | Trả kết quả hoặc kết thúc sớm hàm hiện tại. |
| 547 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 548 | `  list.innerHTML = &#x27;&#x27;;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 549 | `  for (const item of lastHistory.slice(0, 8)) {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 550 | `    const row = document.createElement(&#x27;div&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 551 | `    row.className = &#x27;history-item&#x27;;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 552 | `    const copy = document.createElement(&#x27;div&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 553 | `    const title = document.createElement(&#x27;strong&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 554 | `    title.textContent = item.filename &#124;&#124; item.title &#124;&#124; t(&#x27;pdfDocument&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 555 | `    const meta = document.createElement(&#x27;small&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 556 | `    meta.textContent = t(&#x27;historyMeta&#x27;, {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 557 | `      pages: item.pageCount &#124;&#124; 0,` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 558 | `      time: formatElapsed(item.elapsedMs)` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 559 | `    });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 560 | `    copy.append(title, meta);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 561 | `    row.appendChild(copy);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 562 | `    if (item.downloadId) {` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 563 | `      const open = document.createElement(&#x27;button&#x27;);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 564 | `      open.className = &#x27;history-open&#x27;;` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 565 | `      open.textContent = t(&#x27;showFile&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 566 | `      open.addEventListener(&#x27;click&#x27;, () =&gt; {` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 567 | `        try {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 568 | `          const promise = chrome.downloads.show(item.downloadId);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 569 | `          promise?.catch?.(() =&gt; {});` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 570 | `        } catch (_) {}` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 571 | `      });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 572 | `      row.appendChild(open);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 573 | `    }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 574 | `    list.appendChild(row);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 575 | `  }` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 576 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 577 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 578 | `async function loadHistory() {` | Bắt đầu hàm `loadHistory` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 579 | `  const response = await chrome.runtime.sendMessage({ type: &#x27;STD_GET_HISTORY&#x27; }).catch(() =&gt; null);` | Khai báo biến để lưu cấu hình, trạng thái hoặc dữ liệu trung gian. |
| 580 | `  renderHistory(Array.isArray(response?.history) ? response.history : []);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 581 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 582 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 583 | `function statusError(error) {` | Bắt đầu hàm `statusError` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 584 | `  setStatus(t(&#x27;statusError&#x27;, { message: error?.message &#124;&#124; String(error) }), &#x27;error&#x27;);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 585 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 586 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 587 | `async function initialize() {` | Bắt đầu hàm `initialize` và gom logic liên quan vào một đơn vị có thể gọi lại. |
| 588 | `  await loadLanguage();` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 589 | `  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 590 | `  await Promise.all([initSettings(), loadHistory(), refreshCookieGate()]);` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 591 | `  await pollJobStatus();` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 592 | `  if (!cookieGateReady &amp;&amp; !isJobRunning()) setStatus(t(&#x27;gateRequiredStatus&#x27;), &#x27;idle&#x27;);` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 593 | `  pollTimer = setInterval(pollJobStatus, 550);` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 594 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 595 | `  $(&#x27;#langVi&#x27;).addEventListener(&#x27;click&#x27;, () =&gt; setLanguage(&#x27;vi&#x27;).catch(statusError));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 596 | `  $(&#x27;#langEn&#x27;).addEventListener(&#x27;click&#x27;, () =&gt; setLanguage(&#x27;en&#x27;).catch(statusError));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 597 | `  $(&#x27;#checkBtn&#x27;).addEventListener(&#x27;click&#x27;, () =&gt; startExport().catch(statusError));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 598 | `  $(&#x27;#clearBtn&#x27;).addEventListener(&#x27;click&#x27;, () =&gt; activatePremium().catch(error =&gt; { updateActionAvailability(); statusError(error); }));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 599 | `  $(&#x27;#pauseBtn&#x27;).addEventListener(&#x27;click&#x27;, () =&gt; setPaused(!(lastJob?.paused &#124;&#124; lastJob?.status === &#x27;paused&#x27;)).catch(statusError));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 600 | `  $(&#x27;#cancelBtn&#x27;).addEventListener(&#x27;click&#x27;, () =&gt; cancelJob().catch(statusError));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 601 | `  $(&#x27;#previewDownloadBtn&#x27;).addEventListener(&#x27;click&#x27;, () =&gt; sendPreviewDecision(&#x27;download&#x27;).catch(statusError));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 602 | `  $(&#x27;#previewRebuildBtn&#x27;).addEventListener(&#x27;click&#x27;, () =&gt; sendPreviewDecision(&#x27;rebuild&#x27;).catch(statusError));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 603 | `  $(&#x27;#previewCancelBtn&#x27;).addEventListener(&#x27;click&#x27;, () =&gt; sendPreviewDecision(&#x27;cancel&#x27;).catch(statusError));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 604 | `  $(&#x27;#clearHistoryBtn&#x27;).addEventListener(&#x27;click&#x27;, async () =&gt; {` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 605 | `    await chrome.runtime.sendMessage({ type: &#x27;STD_CLEAR_HISTORY&#x27; }).catch(() =&gt; {});` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 606 | `    await loadHistory();` | Chờ thao tác bất đồng bộ hoàn tất trước khi tiếp tục. |
| 607 | `  });` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 608 | `}` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 609 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 610 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 611 | `chrome.storage.onChanged.addListener((changes, areaName) =&gt; {` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 612 | `  if (areaName !== &#x27;session&#x27; &#124;&#124; !changes[COOKIE_GATE_KEY]) return;` | Kiểm tra điều kiện trước khi tiếp tục nhánh xử lý. |
| 613 | `  renderCookieGate(changes[COOKIE_GATE_KEY].newValue &#124;&#124; { ready: false });` | Thực hiện một bước của logic runtime, dữ liệu hoặc giao diện hiện tại. |
| 614 | `});` | Đóng hoặc phân tách khối lệnh hiện tại. |
| 615 | `&nbsp;` | Dòng trống tách các khối logic để source dễ đọc. |
| 616 | `document.addEventListener(&#x27;DOMContentLoaded&#x27;, initialize);` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
| 617 | `window.addEventListener(&#x27;unload&#x27;, () =&gt; pollTimer &amp;&amp; clearInterval(pollTimer));` | Đăng ký xử lý cho một sự kiện của giao diện, trang web hoặc Chrome extension. |
