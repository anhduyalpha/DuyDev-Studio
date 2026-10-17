/**
 * Release Notes & Changelog Registry for DuyDev Studio
 * Maps version strings (e.g., 'v23.00', 'duydev-studio-v23.00') to structured release highlights:
 * - features: Newly added capabilities and user-facing tools
 * - fixes: Resolved bugs, layout fixes, and performance/ergonomics refinements
 */

export const RELEASE_NOTES_MAP = {
  'v23.25': {
    version: 'v23.25',
    title: 'Bản cập nhật v23.25',
    date: '17/10/2026',
    features: [
      'Procedural Acoustic Sound Engine: Tích hợp hệ thống âm thanh thủ tục Web Audio Apple/Linear-grade với zero-asset, lọc thông thấp ấm áp 2200Hz và tự động ngắt tiết kiệm pin (0% idle battery)',
      'Health Check Timeout Protection: Chuẩn hóa kiểm tra sức khỏe hệ thống với curl.exe --connect-timeout 3 --max-time 5, triệt tiêu hoàn toàn lỗi đơ tác vụ nền'
    ],
    fixes: [
      'Khắc phục lỗi treo lệnh curl trên Windows PowerShell do alias Invoke-WebRequest',
      'Đồng bộ toàn diện phiên bản Service Worker và PWA Cache Storage v23.25'
    ]
  },

  'v23.24': {
    version: 'v23.24',
    title: 'Bản cập nhật v23.24',
    date: '17/10/2026',
    features: [
      'Android Native Share Sheet Everywhere: Khai báo chuẩn text/plain và text/* cho Android Chooser giúp DuyDev Studio xuất hiện trên bảng chia sẻ của mọi ứng dụng (TikTok, Chrome, YouTube, Zalo)',
      'Hộp thoại Tác vụ Chia sẻ Trực quan: Hiển thị đầy đủ các tùy chọn xử lý phù hợp (Tải TikTok không logo, tạo QR, tính mã băm) khi chia sẻ link',
      'Cold-Start Link Auto-Start: Khắc phục triệt để hiện tượng mất URL khi chia sẻ lúc ứng dụng chưa mở bằng cơ chế hàng đợi pendingAutoStartScript'
    ],
    fixes: [
      'Khắc phục lỗi ClassCastException khi trích xuất text chia sẻ từ TikTok',
      'Đồng bộ toàn diện phiên bản Service Worker và PWA Cache Storage v23.24'
    ]
  },

  'v23.23': {
    version: 'v23.23',
    title: 'Bản cập nhật v23.23',
    date: '17/10/2026',
    features: [
      'TikTok Live Metrics Alignment: Đồng bộ định danh chỉ số thống kê (lượt xem, lượt thích, bình luận, chia sẻ) đa tầng giữa Backend Resolver và giao diện người dùng'
    ],
    fixes: [
      'Sửa lỗi hiển thị toàn bộ 0 0 0 0 ở hàng thống kê video TikTok khi tải video/ảnh',
      'Đồng bộ toàn diện phiên bản Service Worker và PWA Cache Storage v23.23'
    ]
  },

  'v23.22': {
    version: 'v23.22',
    title: 'Bản cập nhật v23.22 (Android APK v23.21.0)',
    date: '17/10/2026',
    features: [
      'Android Native APK Release v23.21.0: Build và release chính thức trên GitHub với kiến trúc Zero-Drain, tiết kiệm pin thông minh và khởi động siêu tốc',
      'Dynamic AI Model Scanner: Quét và tự động gợi ý danh sách models khả dụng từ Google Gemini 2.5 Flash, Agnes, OpenAI và Custom Providers',
      'In-Modal Test Ping: Kiểm tra trực tiếp độ trễ và khả năng kết nối của API Key ngay trong hộp thoại cấu hình Admin'
    ],
    fixes: [
      'Chuẩn hóa base URL OpenAI của Google Gemini v1beta',
      'Đồng bộ toàn diện phiên bản Service Worker và PWA Cache Storage v23.22'
    ]
  },

  'v23.21': {
    version: 'v23.21',
    title: 'Bản cập nhật v23.21',
    date: '17/10/2026',
    features: [
      'Converter Pro Progressive Disclosure: Tái cấu trúc giao diện theo giai đoạn xử lý, trạng thái trống chỉ hiển thị vùng thả tệp Stitch Dropzone tinh tế',
      'Compact Top Action Strip: Tự động thu gọn vùng thả tệp thành thanh công cụ nhỏ gọn (+ Thêm tệp, đếm số lượng & dung lượng) khi có tệp trong hàng đợi',
      'Công thái học di động: Tối ưu khoảng đệm chân trang pb-36 tránh đè thanh điều hướng và kích thước nút bấm tối thiểu 44px'
    ],
    fixes: [
      'Triệt tiêu tình trạng quá tải thông tin thị giác khi vừa vào trang Chuyển đổi tệp tin',
      'Định dạng nút lựa chọn đồng đều, hỗ trợ cố định thanh cấu hình (sticky) trên màn hình rộng'
    ]
  },

  'v23.20': {
    version: 'v23.20',
    title: 'Bản cập nhật v23.20',
    date: '17/10/2026',
    features: [
      'Dashboard Layout Refinement: Tối giản thanh tiêu đề danh mục công cụ, giữ không gian thoáng đãng cho giao diện chính'
    ],
    fixes: [
      'Gỡ bỏ nút Dán link nhanh trên header Dashboard, giữ nguyên phím tắt dán nhanh Ctrl+V'
    ]
  },

  'v23.19': {
    version: 'v23.19',
    title: 'Bản cập nhật v23.19',
    date: '17/10/2026',
    features: [
      'Authentic Downloader Identity: Tích hợp cơ chế định danh thiết bị Admin (Khách #xxxxxx / Chủ nhà / Alias) vào toàn bộ lịch sử tải Studocu',
      'Anti-Docker Bridge Masking: Triệt tiêu hoàn toàn địa chỉ IP nội bộ 172.18.0.1, hiển thị thẻ danh tính người dùng đa dạng và scannable'
    ],
    fixes: [
      'Chuyển tiếp IP thật qua Fastify Gateway sang Python Engine và tự động chuyển đổi danh tính cho dữ liệu cũ'
    ]
  },

  'v23.18': {
    version: 'v23.18',
    title: 'Bản cập nhật v23.18',
    date: '17/10/2026',
    features: [
      'Xóa tất cả với trượt xác nhận (Slide-to-Confirm): Tích hợp nút Xóa tất cả cho Kệ tài liệu (lịch sử) cũng như Thùng rác trong Scribd Archiver',
      'Khiên chống xóa nhầm hai lớp: Hộp thoại trượt tương tác hiển thị rõ ràng số lượng tệp và hướng dẫn xác nhận an toàn'
    ],
    fixes: [
      'Đồng bộ API backend xử lý chuyển tất cả tài liệu vào thùng rác (/api/files/all) và dọn sạch thùng rác tức thì'
    ]
  },
  'v23.17': {
    version: 'v23.17',
    title: 'Bản cập nhật v23.17',
    date: '17/10/2026',
    features: [
      'Studocu Hero Ergonomics: Mở rộng kích thước nút Tải cân đối và hài hòa với ô nhập liên kết, tối ưu cảm giác chạm đạt chuẩn 44px'
    ],
    fixes: [
      'Căn chỉnh khoảng cách thị giác và nâng cao kích cỡ icon nút tải tài liệu'
    ]
  },

  'v23.16': {
    version: 'v23.16',
    title: 'Bản cập nhật v23.16',
    date: '17/10/2026',
    features: [
      'Studocu Direct URL Input: Bổ sung ô nhập/dán liên kết trực quan ngay phía trên nút tải, hỗ trợ phím Enter để tải nhanh'
    ],
    fixes: [
      'Lược bỏ tuỳ chọn Cookie rườm rà, tối giản giao diện Studocu Downloader gọn gàng'
    ]
  },

  'v23.15': {
    version: 'v23.15',
    title: 'Bản cập nhật v23.15',
    date: '17/10/2026',
    features: [
      'Scribd Tracker-Block Shield: Chặn hơn 30 mạng quảng cáo và bộ thu thập dữ liệu giúp tăng tốc độ nạp tài liệu Scribd đáng kể',
      'Scribd Instant Cache Hit: Trả kết quả tải tài liệu Scribd tức thì (< 100ms) nếu tệp PDF đã có sẵn trên máy chủ',
      'Global Smart Paste & URL Router: Nút Dán link nhanh trên Dashboard và phím tắt Ctrl+V tự động nhận diện liên kết Scribd và TikTok để chuyển tiếp',
      'Seamless Android Share Routing: Chia sẻ liên kết từ Chrome/Zalo vào app tự động mở và tải ngay trong 0 chạm'
    ],
    fixes: [
      'Bảo vệ 100% chất lượng render tài liệu Scribd với danh sách trắng tài nguyên vector font và hình ảnh',
      'Triệt tiêu ma sát modal khi chia sẻ liên kết đơn thuần trên thiết bị Android',
      'Tối ưu độ trễ chuyển hướng giữa các công cụ tải ngoại tuyến'
    ]
  },
  'v23.13': {
    version: 'v23.13',
    title: 'Bản cập nhật v23.13',
    date: '17/10/2026',
    features: [
      'Smart Task-Aware Background Execution: Cho phép tải ngầm và xử lý tác vụ tiếp tục hoàn tất khi chuyển ứng dụng mà không bị đóng băng',
      '5-Giây Grace Window: Chuyển qua app khác copy link rồi quay lại ngay lập tức trong 5s với 0ms delay, không giật lag',
      'Work-Aware Deep Freeze: Tự động đóng băng WebView và dừng toàn bộ timers ngay khi tác vụ hoàn thành để tiết kiệm 100% pin nhàn rỗi',
      'Two-Way Task Reporting: Cầu nối JavaScript Bridge báo cáo chính xác số lượng tác vụ đang chạy từ Task Coordinator lên Android Native'
    ],
    fixes: [
      'Khắc phục triệt để hiện tượng đứng app khi chuyển tab sao chép URL trên APK Android',
      'Tự động hạ tần suất polling từ 800ms xuống 5s–6s khi ứng dụng chạy ngầm',
      'Bảo vệ giới hạn an toàn 75s chống rò rỉ pin khi có tác vụ mạng bị treo ngầm'
    ]
  },
  'v23.12': {
    version: 'v23.12',
    title: 'Bản cập nhật v23.12',
    date: '17/10/2026',
    features: [
      'Visual Craft & 120Hz Fluidity: Khôi phục độ hoàn thiện thị giác đỉnh cao theo kiến trúc Hoạt Họa Kích Hoạt Theo Sự Kiện (Event-Driven Choreography)',
      'Specular Glass & Ambient Lighting: Thẻ Hero và Command Deck sở hữu viền kính phản chiếu đa tầng và ánh sáng tỏa êm ái ở trạng thái nghỉ (0% CPU/GPU redraw)',
      '3-Layer Specular Glowing Orbs: Đèn báo trạng thái 3 tầng chiều sâu phát sáng sang trọng trên Header, FormatSelector, ViewSplit và TaskDock',
      'Tactile Spring Micro-Physics: Phản hồi xúc giác nảy nhẹ chân thực trên màn hình cảm ứng 120Hz khi chạm vào mọi nút bấm và thẻ công cụ',
      'Chế độ độ trễ cực thấp trên Android Native: Kích hoạt Minimal Post-Processing Mode trên Android 11+ cho phản hồi chạm tức thì'
    ],
    fixes: [
      'Triệt tiêu hoàn toàn CPU Paint thrashing: 100% animations vận hành độc quyền trên GPU Compositor qua transform và opacity',
      'Entrance Shimmer quét sáng 1 lần duy nhất trên mount và chuyển tiếp mượt mà vào specular state khi nhàn rỗi',
      'Tương tác bừng sáng mượt mà khi người dùng tương tác hoặc focus vào ô nhập liệu (:focus-within)'
    ]
  },
  'v23.11': {
    version: 'v23.11',
    title: 'Bản cập nhật v23.11',
    date: '16/10/2026',
    features: [
      'Chuẩn hóa khoảng đệm thoáng đãng toàn bộ web: Tăng đệm đáy lên 80px–96px trên Desktop và duy trì vùng an toàn chân trang trên Mobile',
      'Tách biệt khối Lịch sử và Chân trang: Đảm bảo khoảng cách tối thiểu ≥48px giữa card cuối cùng và viền Footer trên tất cả công cụ',
      'Khoảng cách không gian thoáng đãng theo tiêu chuẩn Impeccable Design: Triệt tiêu hoàn toàn cảm giác khít chật ở đáy màn hình'
    ],
    fixes: [
      'Khắc phục triệt để lỗi thẻ Lịch sử tạo QR và Tùy biến giao diện bị dính sát vào đường kẻ Footer',
      'Đồng bộ khoảng đệm đáy pb-12 md:pb-16 trên toàn bộ 15 trang công cụ và dashboard',
      'Đồng bộ hóa cache PWA và Service Worker v23.11'
    ]
  },
  'v23.10': {
    version: 'v23.10',
    title: 'Bản cập nhật v23.10',
    date: '16/10/2026',
    features: [
      'Thu phóng Double-Buffering không chớp đen: Giữ nguyên khung hình hiện tại trên màn hình và hoán đổi canvas nguyên tử sau khi PDF.js render xong 100%',
      'Tương tác 120Hz mượt mà: Cập nhật tỷ lệ kích thước tức thì trên luồng Compositor, debounce tác vụ rasterization chống quá tải CPU/GPU',
      'Đệm nền trang trắng phòng vệ: Bảo toàn nền giấy trang PDF, triệt tiêu hoàn toàn khoảng trống tối màu của viewport khi thu phóng'
    ],
    fixes: [
      'Khắc phục triệt để hiện tượng nhấp nháy đen trước khi phóng to/thu nhỏ tài liệu PDF',
      'Bảo vệ trạng thái canvas đang hiển thị không bị xóa sớm trong lúc chờ renderTask hoàn tất',
      'Hủy kịp thời các tác vụ vẽ nền lỗi thời khi người dùng cuộn chuột hoặc pinch liên tục'
    ]
  },
  'v23.09': {
    version: 'v23.09',
    title: 'Bản cập nhật v23.09',
    date: '16/10/2026',
    features: [
      'Thu phóng Ctrl+Cuộn chuột mượt mà: Tự động đồng bộ phần trăm hiển thị trên thanh nổi (HUD Floating Dock) tức thì',
      'Điều hướng tìm kiếm chuẩn xác: Trực tiếp cuộn mượt và căn giữa từ khóa tìm kiếm mà không bị nhảy lùi về đầu trang',
      'Khóa vị trí đọc chính xác: Neo giữ tọa độ trang chính xác dưới con trỏ chuột khi thu phóng không bị dịch chuyển'
    ],
    fixes: [
      'Khắc phục triệt để hiện tượng nhảy giật trang và trôi tọa độ khi phóng to / thu nhỏ tài liệu PDF',
      'Loại bỏ xung đột cuộn giữa IntersectionObserver và thanh tìm kiếm từ khóa',
      'Đồng bộ hóa cache PWA và service worker v23.09'
    ]
  },
  'v23.08': {
    version: 'v23.08',
    title: 'Bản cập nhật v23.08',
    date: '16/10/2026',
    features: [
      'Lớp phủ Text Layer PDF.js: Cho phép bôi đen, chọn chữ và sao chép văn bản trực tiếp trên tài liệu mượt mà',
      'Thanh tìm kiếm từ khóa nổi (In-Document Search Ctrl+F): Tô sáng trực tiếp (in-DOM highlight) từ khóa trên lớp Text Layer với điều hướng nhanh',
      'Ngăn bên Đa năng (Multi-Tab Sidebar): Chuyển đổi linh hoạt giữa Mục lục (TOC) và Lưới trang thu nhỏ (Thumbnails Grid)',
      'Tỷ lệ trang động (Dynamic Aspect Ratio): Tự động tính toán chuẩn xác từng trang khổ đứng A4 lẫn khổ ngang 16:9 bảo toàn hướng gốc',
      'Thu phóng neo con trỏ không nhấp nháy (Anchored Flicker-Free Zoom): Hỗ trợ cử chỉ 2 ngón tay Pinch-to-zoom và Ctrl+Wheel neo chuẩn vị trí đọc',
      'Bộ lọc Chăm sóc Mắt & Xoay 90°: 3 chế độ đọc Sáng / Sepia / Tối sâu bảo toàn hình ảnh và xoay hướng đọc',
      'Modal mở khóa PDF bảo vệ: Giao diện nhập mật khẩu kính mờ sang trọng cho tài liệu được mã hóa'
    ],
    fixes: [
      'Khắc phục triệt để lỗi biến dạng placeholder khi tài liệu có trang khổ ngang xen kẽ khổ đứng',
      'Loại bỏ hoàn toàn tình trạng nhấp nháy màn hình trắng và nhảy vị trí khi thu phóng tài liệu',
      'Khắc phục hiện tượng xoay sai hướng các trang có thuộc tính xoay gốc (intrinsic page rotation)',
      'Dọn dẹp triệt để bộ lắng nghe sự kiện toàn màn hình và bộ quan sát trang thu nhỏ khi đóng viewer'
    ]
  },
  'v23.07': {
    version: 'v23.07',
    title: 'Bản cập nhật v23.07',
    date: '16/10/2026',
    features: [
      'Lớp phủ Text Layer PDF.js: Cho phép bôi đen, chọn chữ và sao chép văn bản trực tiếp trên tài liệu mượt mà',
      'Thanh tìm kiếm từ khóa nổi (In-Document Search Ctrl+F): Điều hướng nhanh giữa các kết quả với bộ đếm và tự động nhảy tới trang',
      'Ngăn bên Đa năng (Multi-Tab Sidebar): Chuyển đổi linh hoạt giữa Mục lục (TOC) và Lưới trang thu nhỏ (Thumbnails Grid)',
      'Tỷ lệ trang động (Dynamic Aspect Ratio): Tự động tính toán chuẩn xác từng trang khổ đứng A4 lẫn khổ ngang 16:9 không méo hình',
      'Thu phóng không nhấp nháy (Flicker-Free Zoom): Hỗ trợ cử chỉ 2 ngón tay Pinch-to-zoom và Ctrl+Wheel mượt mà',
      'Bộ lọc Chăm sóc Mắt & Xoay 90°: 3 chế độ đọc Sáng / Sepia / Tối sâu bảo toàn hình ảnh và xoay hướng đọc',
      'Modal mở khóa PDF bảo vệ: Giao diện nhập mật khẩu kính mờ sang trọng cho tài liệu được mã hóa'
    ],
    fixes: [
      'Khắc phục triệt để lỗi biến dạng placeholder khi tài liệu có trang khổ ngang xen kẽ khổ đứng',
      'Loại bỏ hoàn toàn tình trạng nhấp nháy màn hình trắng khi thu phóng tài liệu'
    ]
  },
  'v23.06': {
    version: 'v23.06',
    title: 'Bản cập nhật v23.06',
    date: '16/10/2026',
    features: [
      'Tối ưu hóa GPU & Màn hình LTPO: Giảm tải GPU về 0% ở trạng thái nhàn rỗi (idle), cho phép màn hình hạ tần số quét xuống 1Hz–10Hz tiết kiệm pin tối đa',
      'Cổng hoạt họa thông minh (.is-processing): Hiệu ứng Border Beam xoay ánh sáng chỉ kích hoạt khi đang xử lý tệp hoặc tải tài liệu thực tế',
      'Độ sâu phát sáng tĩnh (Static Depth Glow): Thay thế toàn bộ chấm trạng thái và huy hiệu nhấp nháy vô tận bằng bóng đổ tĩnh cao cấp'
    ],
    fixes: [
      'Loại bỏ triệt để chu kỳ vẽ lại liên tục của conic-gradient và filter blur(10px) trong studocu.css',
      'Khắc phục vòng lặp animate-pulse trong FormatSelector và ViewSplit khi đang soi so sánh ảnh',
      'Tạm dừng vòng lặp Canvas Render Frame khi tab trình duyệt bị ẩn'
    ]
  },
  'v23.05': {
    version: 'v23.05',
    title: 'Bản cập nhật v23.05',
    date: '16/10/2026',
    features: [
      'Trình xem tệp vạn năng: Tăng cường độ ổn định toàn diện cho tất cả định dạng (PDF, DOCX, XLSX, Audio, Video, Mã nguồn, Nén, Hex)',
      'Giới hạn đọc tệp lớn thông minh: Chống tràn RAM với 64KB Hex Inspector và 512KB Text chunking',
      'Thẻ cảnh báo lỗi tập trung: Tích hợp nút xem nhanh dạng Hex thô và tải tệp trực tiếp khi renderer gặp sự cố'
    ],
    fixes: [
      'Khắc phục triệt để hiện tượng kẹt phiên render chồng lấn bằng mã định danh renderSessionId và AbortController',
      'Bổ sung khiên chắn kích thước Canvas trên thiết bị di động chống quá tải bộ nhớ đồ họa',
      'Gia cố tiến trình LibreOffice với cờ an toàn, timeout đa nền tảng và kiểm tra thư mục hợp lệ'
    ]
  },
  'v23.04': {
    version: 'v23.04',
    title: 'Bản cập nhật v23.04',
    date: '16/10/2026',
    features: [
      'Scribd Archiver Dual-Engine: Tăng tốc kết nối & ghép tài liệu lên đến 7x (sách 244 trang chỉ mất 18 giây)',
      'Tích hợp khiên chặn Tracker/Ads (chặn 12+ dịch vụ theo dõi) giúp vào tài liệu trong < 1.5s',
      'Định tuyến thông minh: Tự động tải song song stream ảnh CDN với PyMuPDF cho tài liệu scan và giữ 100% văn bản Vector qua Chromium'
    ],
    fixes: [
      'Khắc phục hoàn toàn hiện tượng treo 30 giây khi bắt đầu nạp trang Scribd',
      'Loại bỏ tắc nghẽn bộ nhớ Skia khi render sách hàng trăm trang'
    ]
  },
  'v23.03': {
    version: 'v23.03',
    title: 'Bản cập nhật v23.03',
    date: '16/10/2026',
    features: [
      'Trình xem tệp vạn năng: Tăng cường bảo mật renderer (HTML sandbox/DOMPurify, blob URL tracking)',
      'Hỗ trợ streaming phạm vi byte an toàn, bảo vệ chống traversal và kiểm soát tải tệp lớn'
    ],
    fixes: [
      'Sửa lỗi rò rỉ bộ nhớ Blob URL trên ImageRenderer và AudioRenderer',
      'Đồng bộ hóa cache PWA và service worker v23.03'
    ]
  },
  'v23.01': {
    version: 'v23.01',
    title: 'Bản cập nhật v23.01',
    date: '16/10/2026',
    features: [
      'Thông báo cập nhật PWA: Hiển thị chi tiết tính năng mới & lỗi đã sửa theo từng phiên bản',
      'Tự động đồng bộ thông tin phát hành khi có bản cập nhật mới trên máy chủ'
    ],
    fixes: [
      'Loại bỏ hoàn toàn 3 câu mô tả cố định rập khuôn trong hộp thoại cập nhật',
      'Tối ưu độ tương phản huy hiệu Chức năng mới và Tính năng đã sửa theo chuẩn giao diện Apple Obsidian'
    ]
  },
  'v23.00': {
    version: 'v23.00',
    title: 'Bản cập nhật v23.00',
    date: '16/10/2026',
    features: [
      'Kệ tài liệu Scribd: Tab chuyển Tất cả / Thùng rác dàn đều toàn chiều rộng, không bị ngắt chữ',
      'Thêm nhóm công cụ Nâng cao (Bộ nhớ & Mã Băm) riêng biệt trên Trang chủ'
    ],
    fixes: [
      'Sửa dứt điểm lỗi chữ nhảy 2 dòng ("Tất / cả", "Thùng / rác") trên màn hình hẹp',
      'Thay thế icon PDF cồng kềnh bằng huy hiệu 38px, dàn đều nút thao tác 100% card',
      'Loại bỏ nút xoay tròn mồ côi và dải viền tĩnh trong box dán link Scribd'
    ]
  },
  'v22.99': {
    version: 'v22.99',
    title: 'Bản cập nhật v22.99',
    date: '15/10/2026',
    features: [
      'Phân loại danh mục công cụ "Nâng cao" cho các tiện ích hệ thống'
    ],
    fixes: [
      'Tối ưu hóa tiêu thụ pin và tài nguyên chạy ngầm'
    ]
  },
  'v22.96': {
    version: 'v22.96',
    title: 'Bản cập nhật v22.96',
    date: '15/10/2026',
    features: [
      'Giao diện Scribd Downloader chuẩn Stitch UI với viền xoay cam hổ phách 360°'
    ],
    fixes: [
      'Sửa lỗi kẹt tiến trình 5% và từ chối liên kết tìm kiếm Scribd không hợp lệ'
    ]
  }
};

export const LATEST_RELEASE = RELEASE_NOTES_MAP['v23.10'];

/**
 * Normalizes any version string into standard 'vX.XX' key
 * @param {string} [rawVer]
 * @returns {string}
 */
export function normalizeVersionKey(rawVer) {
  if (!rawVer) return 'v23.10';
  const str = String(rawVer).trim();
  const match = str.match(/v?\d+\.\d+/i);
  if (match) {
    return match[0].startsWith('v') ? match[0].toLowerCase() : `v${match[0]}`;
  }
  return str;
}

/**
 * Retrieves release notes for a specific version or falls back to latest release
 * @param {string} [version]
 * @returns {{ version: string, title: string, features: string[], fixes: string[] }}
 */
export function getReleaseNotes(version) {
  if (version) {
    const key = normalizeVersionKey(version);
    if (RELEASE_NOTES_MAP[key]) {
      return RELEASE_NOTES_MAP[key];
    }
  }
  return LATEST_RELEASE;
}

/**
 * Safely escapes HTML special characters
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates semantic HTML markup for the release notes highlights container in PWA update capsule
 * @param {{ version?: string, features?: string[], fixes?: string[] }} notes
 * @returns {string}
 */
export function renderReleaseHighlightsHtml(notes) {
  const safeNotes = notes || LATEST_RELEASE;
  const features = safeNotes.features || [];
  const fixes = safeNotes.fixes || [];

  if (features.length === 0 && fixes.length === 0) {
    return `
      <div style="display: flex; align-items: center; gap: 0.5rem; line-height: 1.4; padding: 0.25rem 0;">
        <span style="color: #0071e3; font-weight: bold; flex-shrink: 0;">•</span>
        <span style="color: var(--ds-up-hl-text); font-weight: 450;">Đã cập nhật phiên bản mới nhất với các cải tiến hệ thống.</span>
      </div>
    `;
  }

  let html = '';

  // 1. Chức năng mới thêm vào (New Features)
  if (features.length > 0) {
    html += `
      <div style="display: flex; flex-direction: column; gap: 0.375rem;">
        <div style="display: flex; align-items: center; gap: 0.375rem;">
          <span style="
            font-size: 0.6875rem;
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            color: #0071e3;
            background: rgba(0, 113, 227, 0.12);
            border: 0.5px solid rgba(0, 113, 227, 0.25);
            padding: 0.125rem 0.4375rem;
            border-radius: 0.375rem;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
          ">
            <svg style="width: 0.6875rem; height: 0.6875rem;" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span>Chức năng mới</span>
          </span>
        </div>
        ${features.map(feat => `
          <div style="display: flex; align-items: flex-start; gap: 0.5rem; line-height: 1.4; padding-left: 0.25rem;">
            <span style="color: #0071e3; font-weight: bold; flex-shrink: 0; font-size: 0.8125rem; line-height: 1.2;">•</span>
            <span style="color: var(--ds-up-hl-text); font-weight: 450; letter-spacing: -0.005em;">${escapeHtml(feat)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 2. Tính năng mới sửa / Cải tiến (Bug Fixes & Refinements)
  if (fixes.length > 0) {
    html += `
      <div style="display: flex; flex-direction: column; gap: 0.375rem; ${features.length > 0 ? 'margin-top: 0.375rem; padding-top: 0.5rem; border-top: var(--ds-up-hl-border);' : ''}">
        <div style="display: flex; align-items: center; gap: 0.375rem;">
          <span style="
            font-size: 0.6875rem;
            font-weight: 700;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            color: #ea580c;
            background: rgba(234, 88, 12, 0.12);
            border: 0.5px solid rgba(234, 88, 12, 0.25);
            padding: 0.125rem 0.4375rem;
            border-radius: 0.375rem;
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
          ">
            <svg style="width: 0.6875rem; height: 0.6875rem;" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            <span>Tính năng mới sửa</span>
          </span>
        </div>
        ${fixes.map(fix => `
          <div style="display: flex; align-items: flex-start; gap: 0.5rem; line-height: 1.4; padding-left: 0.25rem;">
            <span style="color: #ea580c; font-weight: bold; flex-shrink: 0; font-size: 0.8125rem; line-height: 1.2;">•</span>
            <span style="color: var(--ds-up-hl-text); font-weight: 450; letter-spacing: -0.005em;">${escapeHtml(fix)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  return html.trim();
}
