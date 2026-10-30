/**
 * Release Notes & Changelog Registry for DuyDev Studio
 * Maps version strings (e.g., 'v23.00', 'duydev-studio-v23.00') to structured release highlights:
 * - features: Newly added capabilities and user-facing tools
 * - fixes: Resolved bugs, layout fixes, and performance/ergonomics refinements
 */

export const RELEASE_NOTES_MAP = {
  'v24.25': {
    version: 'v24.25',
    title: 'Bản cập nhật v24.25 (APK Native v24.8.0): Khởi Động Siêu Tốc & Khắc Phục Màn Hình Đen Khi Chia Sẻ',
    date: '30/10/2026',
    features: [
      'Khởi Động Tức Thì (<16ms) & Native Splash Overlay: Hiển thị ngay tức thì logo app và spinner khi cold boot, tự động fade-out mượt mà ngay khi trang web vẽ frame đầu tiên; loại bỏ triệt để hiện tượng đơ/chậm khi mở app từ màn hình chính',
      'Vendor Cục Bộ Lucide Icons & Cache Thông Minh: Precache bộ icon cục bộ thay vì tải đồng bộ từ CDN, tự động kích hoạt LOAD_CACHE_ELSE_NETWORK khi ngoại tuyến hoặc mạng yếu'
    ],
    fixes: [
      'Khắc Phục Triệt Để Màn Hình Đen Khi Chia Sẻ: Loại bỏ race condition và xung đột SurfaceFlinger khi nhận dữ liệu từ Android Share Sheet, điều hướng tức thì bằng route hash trong 0ms mà không reload trang',
      'Tối Ưu Hóa Luồng I/O & Ngăn Ngừa Nghẽn Main Thread: Chuyển việc nạp tệp chia sẻ sang luồng stream trực tiếp thay vì mã hóa Base64 10MB đồng bộ trên Main Thread gây đơ UI (ANR)',
      'Bảo Vệ Tiến Trình Render (onRenderProcessGone): Tự động phục hồi sạch sẽ khi hệ thống Android giải phóng bộ nhớ dưới tải nặng, chống đơ chết giao diện'
    ]
  },
  'v24.24': {
    version: 'v24.24',
    title: 'Bản cập nhật v24.24: Tối Ưu Tự Động Cuộn & Bắt Sáng Tài Liệu Đã Tải Tức Thì (Instant Highlight & Smooth Auto-Scroll)',
    date: '27/10/2026',
    features: [
      'Tự Động Cuộn Mượt Đến Tài Liệu (Smooth Viewport Auto-Scroll): Khi phát hiện tài liệu đã có sẵn hoặc vừa tải xong, giao diện tự động cuộn mượt và căn giữa đúng mục tài liệu trong danh sách, giúp người dùng định vị ngay lập tức mà không cần tìm kiếm thủ công',
      'Phát Sáng Xanh Lục Tức Thì Cho Toàn Bộ Tài Liệu Cũ & Mới (Instant Emerald Pulse & Cache Hit): Tối ưu luồng kiểm tra bộ nhớ đệm (< 20ms), loại bỏ hoàn toàn độ trễ polling 800ms khi tài liệu đã có sẵn trên máy chủ, đồng thời nhận diện chính xác 100% tài liệu cũ trong kho lưu trữ qua Document ID'
    ],
    fixes: [
      'Khắc Phục Lỗi Tài Liệu Quá Cũ Không Highlight & Không Scroll: Chuẩn hóa cơ chế truy vết Document ID đa tầng (URL, filename, title, metadata) và gắn định danh data-doc-id lên thẻ tài liệu, loại bỏ triệt để lỗi tài liệu cũ bị bỏ qua'
    ]
  },
  'v24.23': {
    version: 'v24.23',
    title: 'Bản cập nhật v24.23: Quản Trị Chọn Nhiều Người Dùng & Dọn Dẹp Triệt Để Khách Vãng Lai (Multi-Select & Guest Purge)',
    date: '27/10/2026',
    features: [
      'Thao Tác Hàng Loạt Với Tính Năng Chọn Nhiều (Multi-Select Batch Actions): Bổ sung hộp kiểm (checkbox) cho từng thẻ thiết bị/người dùng và nút "Chọn tất cả", kèm thanh công cụ thao tác hàng loạt giúp Chặn, Bỏ chặn hoặc Xóa nhiều người dùng chỉ bằng 1 thao tác duy nhất',
      'Nút Dọn Dẹp Toàn Bộ Khách Vãng Lai (1-Click Purge All Guests): Tích hợp tính năng xóa sạch toàn bộ thiết bị khách chưa đặt tên trong hệ thống, đảm bảo 100% người dùng khi vào lại trang web đều được kích hoạt prompt bắt buộc nhập tên định danh'
    ],
    fixes: [
      'Khắc Phục Tình Trạng Tích Tụ Khách Vãng Lai Vô Danh: Loại bỏ hoàn toàn các bản ghi khách rác không có định danh, đồng thời siết chặt luồng Onboarding trên mọi điều hướng'
    ]
  },
  'v24.22': {
    version: 'v24.22',
    title: 'Bản cập nhật v24.22: Hỗ Trợ Toàn Diện Tải Bài Viết & Album Ảnh Facebook (Facebook Post Downloader)',
    date: '27/10/2026',
    features: [
      'Hỗ Trợ Tải Bài Viết & Ảnh Facebook Đầy Đủ (Facebook Post & Photo Extraction): Tích hợp cơ chế trích xuất bài viết Facebook (facebook.com/share/..., /posts/..., /photos/...) qua crawler chuyên dụng, tự động lấy tác giả, nội dung bài viết và ảnh gốc độ phân giải cao Full HD (1080p)',
      'Giao Diện Tương Tác Đa Định Dạng (Multi-Media Post Workspace): Hiển thị trích dẫn bài viết, trình xem ảnh trực quan, bộ chọn album ảnh và nút tải ảnh trực tiếp (.JPG) hoặc lưu vào Studio Drive'
    ],
    fixes: [
      'Khắc Phục Lỗi Từ Chối Liên Kết Post Facebook: Loại bỏ hoàn toàn lỗi Cannot parse data khi dán liên kết bài viết Facebook dạng share link'
    ]
  },
  'v24.21': {
    version: 'v24.21',
    title: 'Bản cập nhật v24.21: Khắc Phục Triệt Để Tràn Kích Thước Avatar & Chuẩn Hoá Header Di Động / APK',
    date: '27/10/2026',
    features: [
      'Khóa Kích Thước Khung Avatar Bất Biến (Strict Avatar Bounding Box): Thiết lập min/max ràng buộc 30px (mobile) / 32px (desktop) và gắn max-w-full max-h-full pointer-events-none lên ảnh người dùng, loại bỏ 100% tình trạng ảnh phân giải cao làm phình to thanh tiêu đề',
      'Độ Thoáng & Tỷ Lệ Hoàn Hảo Cho Màn Hình Hẹp (Mobile Header Ergonomics): Tối ưu đệm lề header px-2.5 py-2.5, nút dock w-[30px] h-[30px] cùng cỡ chữ thương hiệu text-xs, đảm bảo hiển thị liền mạch không tràn viền trên mọi độ rộng màn hình (>=360px)'
    ],
    fixes: [
      'Sửa Lỗi Phình To Header Trên APK & Thiết Bị Android: Khắc phục sự cố avatar tùy chỉnh chiếm dụng 160px+ chiều cao, trả lại thanh công cụ chuẩn 57px thanh thoát theo phong cách Apple Control Center'
    ]
  },
  'v24.20': {
    version: 'v24.20',
    title: 'Bản cập nhật v24.20: Tinh Chỉnh Không Gian & Độ Thoáng Thanh Điều Khiển Và Hồ Sơ (Ergonomic Header Spacing)',
    date: '27/10/2026',
    features: [
      'Thanh Hồ Sơ Người Dùng Dạng Capsule Ngang Đẳng Cấp: Tái thiết kế nút hồ sơ thành thanh capsule ngang đồng điệu với Control Dock, avatar bo tròn trang nhã và tên hiển thị cân đối cạnh nhau',
      'Đường Phân Cách Tinh Tế & Thích Ứng Di Động: Bổ sung vạch phân cách quang học tinh tế giữa Control Dock và nút hồ sơ; tự động co gọn tên trên màn hình siêu nhỏ (<420px) chống tràn tuyệt đối'
    ],
    fixes: [
      'Mở Rộng Không Gian Thanh Tiện Ích Điều Khiển: Tăng khoảng cách đệm (padding) và khoảng cách giữa các nút (gap), bổ sung không gian thở cho đèn trạng thái hệ thống, xóa bỏ triệt để cảm giác chật chội'
    ]
  },
  'v24.19': {
    version: 'v24.19',
    title: 'Bản cập nhật v24.19: Khắc Phục Triệt Để Lệch Bài Hát & Khử Nhạc Remix Lạ Trong Spotify Downloader',
    date: '27/10/2026',
    features: [
      'Công Thức Chấm Điểm Chuẩn Xác Đa Yếu Tố (Multi-Factor Match Scoring): Triệt tiêu hoàn toàn tình trạng tải nhầm nhạc remix, Vinahouse, bản thu AI cover hoặc clip hát live khi người dùng tải bài hát gốc (như bài "Định Mệnh"), áp dụng hệ số điểm 0-100+ ưu tiên tuyệt đối bản phát hành studio chính thức',
      'Chiến Lược Tìm Kiếm Phân Tầng Thông Minh (Staged Topic Search): Tự động nhắm trực tiếp vào kênh Topic của hãng đĩa và các bản Official Audio trên YouTube Music trước khi tìm kiếm tổng quát',
      'Chuyển Mã Chuẩn Studio 320kbps CBR & ID3 Tags Qua FFmpeg: Đảm bảo âm thanh lưu vào Studio Drive là tệp MP3 320kbps nguyên bản có nhúng metadata ID3 (Tên bài, Nghệ sĩ, Bìa album) phát mượt mà trên mọi thiết bị'
    ],
    fixes: [
      'Sửa Lỗi Khóa Cứng Bài Remix Trong Bộ Nhớ Đệm: Bổ sung cơ chế làm mới cache khi quét lại và thêm nút Quét lại 1-chạm trên giao diện Spotify Downloader',
      'Lưới Lọc Khử Remix & Cover Tự Động: Trừ điểm nặng (-60 đến -100đ) các bản remix, live stage, cover hoặc karaoke nếu liên kết Spotify không chủ đích yêu cầu remix'
    ]
  },
  'v24.18': {
    version: 'v24.18',
    title: 'Bản cập nhật v24.18: Thiết Lập Bộ Quy Chuẩn Kiến Trúc Module Chuẩn Hoá (Universal Module Standard)',
    date: '27/10/2026',
    features: [
      'Bộ Quy Chuẩn Kiến Trúc Module 10 Trụ Cột (Universal Module Standard): Thiết lập tài liệu đặc tả kỹ thuật toàn diện docs/MODULE_STANDARD.md định nghĩa rõ ràng giải phẫu thư mục, đăng ký công cụ & 10 cấp bậc Card Rarity, vòng đời mount/unmount chống rò rỉ bộ nhớ, cơ chế lịch sử cách ly không nhấp nháy, và liên kết chia sẻ đa nền tảng',
      'Mẫu Module Chuẩn Hoá Sẵn Dùng (Turnkey Scaffolding Template): Cung cấp mã nguồn mẫu src/components/tools/_template/TemplateWorkspace.js kế thừa trọn vẹn mọi hành vi chuẩn hóa (auto-start handoff, dán clipboard an toàn, điều phối tác vụ nền, và phản hồi âm thanh Impeccable)',
      'Công Cụ Kiểm Toán Tuân Thủ Tự Động (Automated Compliance Auditor): Phát triển công cụ scripts/audit_module_compliance.py tự động kiểm tra 9 tiêu chí sống còn của mọi module trước khi triển khai'
    ],
    fixes: [
      'Đồng Bộ Hóa Kiến Trúc Chống Hồi Quy (Zero-Regression Architecture): Ngăn ngừa vĩnh viễn các lỗi nhấp nháy toàn trang khi mở lịch sử, lỗi rò rỉ EventSource/SSE/timer, lỗi nuốt URL khi chia sẻ từ Android APK hoặc Web PWA',
      'Chuẩn Hóa Nguyên Tắc Thiết Kế Giao Diện: Ban hành bộ quy tắc kiểm soát token màu sắc, loại bỏ hoàn toàn câu chữ AI slop và chú thích dư thừa theo tiêu chuẩn Impeccable Design'
    ]
  },
  'v24.17': {
    version: 'v24.17',
    title: 'Bản cập nhật v24.17: Triệt Tiêu Nhấp Nháy Hộp Lịch Sử Media (Zero-Flicker Collapsible History)',
    date: '27/10/2026',
    features: [
      'Đóng Mở Lịch Sử Tại Chỗ Siêu Mượt (In-Place Collapsible Toggle): Chuyển đổi toàn bộ thao tác bấm mở/thu gọn hộp lịch sử Media (Facebook, Instagram, Spotify) sang cơ chế cập nhật trực tiếp tại chỗ (In-Place DOM Mutation), triệt tiêu 100% hiện tượng nhấp nháy, chớp sáng hoặc cảm giác tải lại trang',
      'Cách Ly Phân Vùng Lịch Sử (Isolated History Rendering Container): Thiết lập container riêng biệt (#mediaHistoryContainer) cho khu vực lịch sử, đảm bảo các thao tác chuyển tab Lịch sử / Thùng rác, xóa tệp hay lưu vào Drive chỉ cập nhật cục bộ và giữ nguyên trạng thái thanh nhập liệu và toàn bộ giao diện phía trên'
    ],
    fixes: [
      'Sửa Lỗi Nhấp Nháy Toàn Trang Khi Bấm Vào Dropbox Lịch Sử: Khắc phục triệt để việc gọi render toàn bộ workspace kèm hiệu ứng animate-fadeIn khi người dùng click vào thanh toggle lịch sử ở bộ 3 công cụ Media',
      'Bảo Toàn Tiêu Điểm Con Trỏ & Vị Trí Cuộn: Ngăn chặn mất focus con trỏ trên thanh dán liên kết và không làm giật khung nhìn khi danh sách lịch sử được tải ngầm từ máy chủ'
    ]
  },
  'v24.16': {
    version: 'v24.16',
    title: 'Bản cập nhật v24.16: Hỗ Trợ Đầy Đủ & Nhận Diện Toàn Diện Chia Sẻ Mọi Module Trên APK & Web',
    date: '27/10/2026',
    features: [
      'Bộ Điều Phối Chia Sẻ Mở Rộng (Universal Share Target Registry): Hỗ trợ nhận diện và mở trực tiếp mọi nền tảng Media trên ứng dụng Android APK (Facebook, Instagram, Spotify, YouTube, TikTok, Scribd, Studocu), không còn bị rơi vào nhóm Liên kết web thông thường',
      'Kiến Trúc Đăng Ký Mở (Pluggable Handler Architecture): Thiết kế hệ thống nhận diện URL dạng danh sách động (ShareUrlHandler) trên cả tầng Native Android và tầng Web PWA, cho phép dễ dàng mở rộng thêm bất kỳ module mới nào trong tương lai mà không làm vỡ kiến trúc cũ'
    ],
    fixes: [
      'Bổ Sung Module Facebook Downloader Khi Chia Sẻ Link FB: Nhận diện chính xác các định dạng liên kết từ ứng dụng Facebook Android (/share/r/, /share/v/, /share/p/, /reel/, fb.watch) và tự động kích hoạt Facebook Downloader',
      'Đồng Bộ Hóa Handoff & Auto-Start Toàn Diện: Hỗ trợ tự động trích xuất và chuyển tiếp dữ liệu chia sẻ mượt mà trên cả Instagram, Spotify, YouTube Downloader và các công cụ tiện ích PWA'
    ]
  },
  'v24.15': {
    version: 'v24.15',
    title: 'Bản cập nhật v24.15: Tối Ưu Thanh Tiện Ích Trình Xem File (Universal Viewer)',
    date: '27/10/2026',
    features: [
      'Trích Xuất Phần Mở Rộng An Toàn (Safe Extension Extraction): Chuẩn hóa thuật ngữ đuôi tệp tối đa 8 ký tự chữ số, ngăn chặn hoàn toàn việc trích xuất nhầm các chuỗi tiêu đề chứa số thập phân (như "6.7M views · 140K reactions") thành đuôi tệp',
      'Chống Tràn Badge Thanh Tiêu Đề (Viewer Header Protection): Cố định chiều rộng tối đa (max-w-[72px]), cắt ngắn tự động (truncate) và cách ly layout z-index cho hàng nút công cụ xem nhanh, bảo đảm không bị nút chức năng đè lên chữ'
    ],
    fixes: [
      'Sửa Lỗi Nút Thao Tác Bị Đè Trực Tiếp Lên Huy Hiệu File: Khắc phục hiện tượng các nút liên kết, mở tab mới, tải về và nút đóng bị chồng chéo lên huy hiệu định dạng khi xem các video mạng xã hội có tiêu đề dài chứa dấu chấm',
      'Đồng Bộ Hóa Bộ Nhận Diện Định Dạng Tệp: Chuẩn hóa logic kiểm tra đuôi tệp trên toàn bộ hệ thống FileViewerCore, FileViewerConnector và các trình kết xuất phụ (Fallback, Font, Spreadsheet)'
    ]
  },
  'v24.14': {
    version: 'v24.14',
    title: 'Bản cập nhật v24.14: Tinh Gọn Lịch Sử Media Android & Hộp Thả Collapsible',
    date: '27/10/2026',
    features: [
      'Kiến Trúc Hộp Thả Lịch Sử Thu Gọn (KI-CON-006): Chuyển đổi toàn bộ khu vực lịch sử của bộ 3 công cụ Media (Facebook, Instagram, Spotify) sang dạng Collapsible Dropbox thu gọn thanh thoát (~52px), loại bỏ hoàn toàn tình trạng chiếm trọn màn hình và rối mắt trên Android',
      'Thanh Thao Tác Đơn Dòng Cân Đối (Single-Line Mobile Toolbar): Tái thiết kế toàn bộ hàng nút thao tác thành thanh công cụ 1 dòng thẳng thớm, tách bạch nhóm Phát/Tải về bên trái và nhóm Tiện ích Drive/Mở lại/Sao chép/Xóa bên phải, triệt tiêu 100% lỗi nút nhảy hàng so le'
    ],
    fixes: [
      'Sửa Triệt Để Lỗi [object Object] Trong Thông Tin Tác Giả: Tự động trích xuất chuỗi định danh người đăng (uploader/channel/username) từ dữ liệu đối tượng, khắc phục hiện tượng hiển thị lỗi [object Object] trên thẻ lịch sử',
      'Tối Ưu Giao Diện Thẻ Lịch Sử Micro-Card: Tăng độ tương phản, bo góc chuẩn mực, bọc thẻ độc lập và bảo toàn trạng thái mở/đóng khi xóa hoặc khôi phục tệp'
    ]
  },
  'v24.13': {
    version: 'v24.13',
    title: 'Bản cập nhật v24.13: Cố Định Avatar & Hồ Sơ Người Dùng Zero-Flash',
    date: '26/10/2026',
    features: [
      'Khôi Phục Hồ Sơ Tức Thì (Zero-Flash Profile Restoration): Tích hợp tập lệnh phục hồi avatar và tên người dùng trực tiếp trong DOM ngay tại frame đầu tiên, loại bỏ hoàn toàn hiện tượng nhấp nháy hoặc trở về chữ cái mặc định khi tải lại trang',
      'Đồng Bộ Hai Chiều & Sao Lưu Kép (Dual-Storage Persistence): Tự động sao lưu hồ sơ sang ds_user_profile_backup và đồng bộ 2 chiều với máy chủ, bảo vệ tuyệt đối thông tin tên và ảnh đại diện khi người dùng thoát và mở lại ứng dụng'
    ],
    fixes: [
      'Sửa Lỗi Mất Avatar & Tên Khi Thoát Ứng Dụng: Khắc phục triệt để race condition khi kích hoạt sự kiện ds:profile-updated trước khi gắn bộ lắng nghe header trên shell tải nhanh',
      'Hoàn Thiện Hộp Thoại Hồ Sơ (ProfileModal): Kích hoạt nút "Sửa tên" nhanh, hỗ trợ phím Enter lưu ngay lập tức, hiển thị biểu tượng xác nhận ảnh đại diện từ thiết bị và bổ sung cơ chế fallback ảnh lỗi'
    ]
  },
  'v24.12': {
    version: 'v24.12',
    title: 'Bản cập nhật v24.12: Chuẩn Hóa Điều Hướng Media, Lịch Sử & Spotify Khớp Chuẩn',
    date: '26/10/2026',
    features: [
      'Điều Hướng Breadcrumb Top-Left Đồng Bộ: Thay thế nút "Quay lại" bên phải bằng nút điều hướng "← Dashboard" chuẩn Stitch ở góc trên bên trái cho Facebook, Instagram và Spotify Downloader, đồng nhất 100% với TikTok và Scribd',
      'Đồng Bộ Hóa Lịch Sử Thời Gian Thực (Global Sync): Bổ sung kênh phát sự kiện dd:history-updated cho toàn bộ ứng dụng, tự động làm mới danh sách và số lượng mục trên Dashboard, trang Lịch sử và thanh điều hướng ngay khi có tệp tải mới mà không cần tải lại trang',
      'Lịch Sử Kiểu TikTok Cho Bộ 3 Công Cụ Media: Tích hợp đầy đủ bảng lịch sử MediaHistorySection với tính năng xem trước trực tiếp FileViewerConnector, tải về máy, lưu Studio Drive và dọn dẹp an toàn'
    ],
    fixes: [
      'Sửa Triệt Để Lỗi Spotify Tải Nhạc Lạc Đề: Chuẩn hóa parser URL loại bỏ toàn bộ chuỗi tracking (?si=...), tích hợp trích xuất metadata trực tiếp từ Spotify embed hydration và so khớp thời lượng nghiêm ngặt (dung sai ±12s), đảm bảo 100% ra đúng bài hát yêu cầu',
      'Khắc Phục Lệch Số Lượng Mục Lịch Sử: Đồng bộ hóa thuật toán khử trùng lặp (deduplicateList) và liên kết số lượng hiển thị trên huy hiệu trực tiếp với số thẻ đang hiển thị thực tế'
    ]
  },
  'v24.07': {
    version: 'v24.07',
    title: 'Bản cập nhật v24.07 (APK v24.7.0)',
    date: '25/10/2026',
    features: [
      'Tái Thiết Kế & Chuẩn Hóa Thông Báo Android: Loại bỏ hoàn toàn biểu tượng ứng dụng kép trùng lặp, căn chỉnh tiêu đề ngắn gọn "Tải xuống hoàn tất" chống tràn chữ ("Đã tả..."), phân loại nhãn media thông minh (TikTok Video/Audio, YouTube, Facebook, Instagram, Spotify) và bổ sung nút thao tác "Mở tệp" trực tiếp trên thanh thông báo hệ thống',
      'Định Danh Tải Xuống Đồng Bộ: Chuẩn hóa ID thông báo và trích xuất tham số tệp URL tự động, giúp cập nhật trạng thái thông báo tải tệp mượt mà và không bao giờ xuất hiện nhiều thông báo trùng'
    ],
    fixes: [
      'Khắc Phục Triệt Để Lỗi Tải Trùng Tệp (Double Download): Sửa chữa cơ chế chống trùng DownloadHelper theo URL chuẩn hóa (bất kể tên tệp đề xuất), chặn lan truyền sự kiện nhấp chuột (event bubbling) trên web app và ngăn chặn xung đột giữa WebView DownloadListener với AndroidBridge',
      'Sửa Lỗi Biên Dịch Kotlin AndroidBridge: Loại bỏ khai báo trùng lặp phương thức setSwipeRefreshEnabled gây lỗi conflicting overloads trên CI, phát hành thành công gói APK v24.7.0 chính thức'
    ]
  },
  'v24.06': {
    version: 'v24.06',
    title: 'Bản cập nhật v24.06 (APK v24.6.0)',
    date: '25/10/2026',
    features: [
      'Nâng Cấp Thiết Kế Thông Báo Android: Loại bỏ hoàn toàn biểu tượng ứng dụng kép trùng lặp, căn chỉnh tiêu đề ngắn gọn "Tải xuống hoàn tất" chống tràn chữ, hiển thị tên tệp thanh lịch và bổ sung nút thao tác "Mở tệp" trực tiếp trên thanh thông báo hệ thống',
      'Chuẩn Hóa Tên Tệp Tải Về: Tự động trích xuất tiêu đề video TikTok thực tế thay vì chuỗi mã số ID thô, giúp quản lý tệp trực quan trong Thư viện và ứng dụng Tệp'
    ],
    fixes: [
      'Khắc Phục Triệt Để Lỗi Tải Trùng Tệp (Double Download): Chặn hiện tượng sự kiện nhấp chuột lan truyền (event bubbling) kích hoạt tải hai lần đồng thời, bổ sung bộ đệm chống trùng đa luồng trượt 2000ms trong DownloadHelper bản địa',
      'Đồng Bộ Thông Báo Hoàn Tất: Ngăn chặn việc bắn thông báo trùng lặp giữa tầng Web và Native Bridge khi tải tệp đa phương tiện'
    ]
  },
  'v24.01': {
    version: 'v24.01',
    title: 'Bản cập nhật v24.01',
    date: '25/10/2026',
    features: [
      'Quản Lý & Tạo Mới Tab Trong Admin: Cho phép admin tùy ý tạo tab mới, đặt tên tab hiển thị, và sinh mã slug tự động',
      'Bộ Chọn Màu Chấm Tròn Đại Diện: Cho phép chọn màu sắc bất kỳ qua bộ chọn màu hoặc bảng màu gợi ý cao cấp cho từng tab hiển thị trên Dashboard',
      'Đồng Bộ & Phân Bổ Thẻ Linh Hoạt: Cho phép gán thẻ vào bất kỳ tab nào (gốc hoặc tạo mới), chỉnh sửa tên, đổi màu hoặc xóa tab tùy biến an toàn',
      'Đồng Bộ Tức Thì Thời Gian Thực: Toàn bộ thay đổi về tab, màu sắc chấm tròn và thứ tự thẻ tự động phản ánh tức thì lên Dashboard của người dùng qua BroadcastChannel và Server API'
    ],
    fixes: [
      'Tự động bảo vệ thẻ công cụ: Khi xóa một tab tùy biến, các thẻ công cụ bên trong sẽ tự động chuyển về tab Tiện ích để đảm bảo không bao giờ bị mất thẻ',
      'Khắc phục việc kiểm tra danh mục cứng trên máy chủ, hỗ trợ lưu trữ bền vững cả danh sách tab và thứ tự thẻ'
    ]
  },
  'v24.00': {
    version: 'v24.00',
    title: 'Bản cập nhật v24.00',
    date: '25/10/2026',
    features: [
      'Hộp Thoại Chọn Mô-Đun Xử Lý Tiếp: Khi bấm "Xử lý tiếp", hệ thống hiển thị danh sách trực quan các mô-đun PDF (Nén, Tách trang, Xoay, Sắp xếp, Ghép, Word, Trích ảnh, Watermark, Bảo mật) cùng các công cụ liên quan (Tạo đề trắc nghiệm Quiz, Converter) để người dùng chọn luồng xử lý tiếp theo',
      'Tự Động Nạp & Chuyển Đổi Không Gian Làm Việc: Tự động chuyển tab công cụ, nạp tệp kết quả vào workspace mới và cuộn mượt mà lên vùng thao tác với 0ms độ trễ',
      'Đồng Bộ Xử Lý Tiếp Trong Lịch Sử: Áp dụng cùng hộp thoại chọn mô-đun thông minh khi bấm nút xử lý tiếp tệp từ danh sách lịch sử PDF Studio'
    ],
    fixes: [
      'Khắc phục việc tệp PDF kết quả bị ép nạp lại vào chế độ cũ (như chế độ Ảnh sang PDF không tương thích với tệp PDF) khi bấm Xử lý tiếp'
    ]
  },
  'v23.99': {
    version: 'v23.99',
    title: 'Bản cập nhật v23.99',
    date: '25/10/2026',
    features: [
      'Nút Xóa Tất Cả Trực Quan: Thay thế thao tác vuốt trượt phức tạp thành nút "Xóa tất cả" tiện lợi, thao tác 1 chạm nhanh chóng trên toàn bộ PDF Studio',
      'Hợp Nhất Thẻ Workspace PDF: Gộp các khối rời rạc thành 1 Master Card Container đồng nhất với phân cấp thị giác tinh tế, giao diện hiện đại và gọn gàng',
      'Bổ Sung Nút Xóa Tệp Cho Tất Cả Công Cụ PDF: Cho phép xóa tệp nhanh chóng trên các chế độ Xoay trang, Tách trang, Sắp xếp trang và Thao tác tệp đơn'
    ],
    fixes: [
      'Loại bỏ viền đỏ bất thường trên khung tải tệp PDF về chuẩn thiết kế giao diện tối/sáng của hệ thống',
      'Tối ưu hóa bố cục khu vực nạp tệp Google Drive thành khay phụ tích hợp ở đáy thẻ giúp trải nghiệm mượt mà hơn'
    ]
  },
  'v23.98': {
    version: 'v23.98',
    title: 'Bản cập nhật v23.98',
    date: '25/10/2026',
    features: [
      'Bảo Toàn Lịch Sử Xử Lý PDF: Khắc phục triệt để lỗi tài liệu PDF xử lý xong không lưu vào lịch sử hoặc bị xóa khi đồng bộ với máy chủ',
      'Tiếp Tục Xử Lý Tệp Kết Quả: Bổ sung nút "Xử lý tiếp" trực tiếp trên thẻ kết quả PDF Studio để nạp nhanh tệp vừa tạo vào workspace cho thao tác tiếp theo',
      'Mở Rộng Lịch Sử Thông Minh: Tự động mở rộng danh sách lịch sử khi nhấn "Tiếp tục" để người dùng kiểm tra và quản lý tệp đã hoàn tất thuận tiện'
    ],
    fixes: [
      'Khắc phục tình trạng mất file khi nhấn nút "Tiếp tục" sau khi xử lý xong trong PDF Studio',
      'Đồng bộ Device-Id khi tạo tác vụ PDF và ngăn việc ghi đè làm trắng lịch sử trong bộ nhớ cục bộ'
    ]
  },
'v23.97': {
    version: 'v23.97',
    title: 'Bản cập nhật v23.97',
    date: '25/10/2026',
    features: [
      'Sửa lỗi tải PDF Scribd: Khắc phục triệt để lỗi biến không xác định khiến trình duyệt báo "Site wasn\'t available" khi tải tài liệu đã xử lý xong',
      'Tối ưu hóa tải tệp luồng lớn: Cải thiện hiệu suất truyền luồng nhị phân và mã hóa tiêu đề UTF-8 cho tệp có dấu tiếng Việt'
    ],
    fixes: [
      'Khắc phục mã lỗi 502 Bad Gateway khi nhấn Tải PDF trong công cụ Scribd Downloader'
    ]
  },

  'v23.87': {
    version: 'v23.87',
    title: 'Bản cập nhật v23.87',
    date: '24/10/2026',
    features: [
      'Tự Động Đồng Bộ Bố Cục Thẻ Công Cụ Tức Thì (Cross-Tab & Real-Time Sync): Khi quản trị viên lưu cấu hình, tất cả các tab người dùng đang mở tự động cập nhật ngay lập tức qua BroadcastChannel & Storage Event mà không cần tải lại trang',
      'Đồng Bộ Bố Cục Đa Thiết Bị: Tự động kiểm tra và cập nhật bố cục thẻ mới nhất khi người dùng mở lại tab hoặc sau mỗi 12 giây khi đang xem trang chủ',
      'Tối Ưu Watchdog Khởi Động: Tăng ngưỡng phát hiện lên 12 giây và tự động dọn dẹp thông báo lỗi khởi động ngay khi hệ thống sẵn sàng'
    ],
    fixes: [
      'Khắc phục triệt để hiện tượng trang người dùng không tự cập nhật sau khi admin lưu cấu hình',
      'Loại bỏ hoàn toàn thông báo lỗi timeout khởi động không mong muốn'
    ]
  },
  'v23.86': {
    version: 'v23.86',
    title: 'Bản cập nhật v23.86',
    date: '24/10/2026',
    features: [
      'Phòng Thủ Toàn Diện Âm Thanh (SoundEngine Defense-in-Depth): Bổ sung hàm play() an toàn hỗ trợ đầy đủ các sound cue click/toggle/success/error, ngăn ngừa triệt để lỗi TypeError crash luồng sự kiện UI',
      'Đổi Thứ Tự Thẻ & Tab Mượt Mà: Cố định pointer-events trên icon chevron, đổi vị trí tức thì 100% trong bảng quản trị và tự động phản hồi tới trang chủ người dùng'
    ],
    fixes: [
      'Khắc phục triệt để lỗi TypeError: soundEngine.play is not a function gây đơ nút mũi tên lên xuống',
      'Đảm bảo click icon chevron luôn kích hoạt đúng nút cha và re-render bảng thẻ công cụ'
    ]
  },
  'v23.85': {
    version: 'v23.85',
    title: 'Bản cập nhật v23.85',
    date: '24/10/2026',
    features: [
      'Khắc Phục Hoàn Toàn Lỗi Sắp Xếp Thẻ Công Cụ: Sửa lỗi mũi tên lên/xuống bị đơ khi lọc theo từng Tab danh mục trong bảng quản trị; vị trí thẻ công cụ giờ đây đổi chỗ tức thì so với các thẻ cùng danh mục',
      'Đồng Bộ Bố Cục Động Thời Gian Thực Giữa Admin & Người Dùng: Dashboard người dùng tự động lắng nghe cập nhật bố cục từ máy chủ và quản trị viên, cập nhật thứ tự thẻ và số lượng badge tức thì không cần tải lại trang'
    ],
    fixes: [
      'Sửa lỗi nút lên/xuống trong admin manager chỉ hoán đổi với thẻ ẩn ở danh mục khác',
      'Sửa lỗi Dashboard phía người dùng không hiển thị thứ tự thẻ mới do thiếu cơ chế subscribe ToolRegistry'
    ]
  },
  'v23.84': {
    version: 'v23.84',
    title: 'Bản cập nhật v23.84',
    date: '24/10/2026',
    features: [
      'Nâng Cấp Giao Diện ProfileModal Chuẩn Apple Frosted Glass: Thay thế hoàn toàn tone cam bằng phong cách kính mờ Apple cao cấp (Backdrop Blur 28px, thẻ bo góc rounded-3xl, viền specular hairline, điểm nhấn Indigo thương hiệu #4F46E5)',
      'Tối Ưu Trải Nghiệm Nhập Tên & Chọn Avatar: Touch target thoải mái 48px chuẩn công thái học, thẻ xem trước avatar trực quan, thiết kế tương phản hoàn hảo cho cả Light Mode và Dark Mode'
    ],
    fixes: [
      'Loại bỏ triệt để các mã màu cam gây gắt mắt trên form định danh thiết bị',
      'Đồng bộ giao diện onboarding và modal sửa hồ sơ cá nhân đồng nhất trên toàn hệ thống'
    ]
  },
  'v23.83': {
    version: 'v23.83',
    title: 'Bản cập nhật v23.83',
    date: '24/10/2026',
    features: [
      'Tab Quản Lý Thẻ & Danh Mục Trong Admin Console: Bổ sung tab thứ 3 trong bảng quản trị cho phép quản trị viên tự do tùy chỉnh tab danh mục (PDF, Chuyển đổi, File nén, Mã QR, Tiện ích, Nâng cao) và sắp xếp thứ tự hiển thị của từng thẻ công cụ với tính năng lưu trữ bền vững trên máy chủ',
      'Đồng bộ hóa bố cục thẻ toàn hệ thống: Hỗ trợ nạp cấu hình bố cục động đa thiết bị qua API GET /api/v1/system/tool-layout kết hợp lưu trữ bộ nhớ đệm client-side, bảo đảm 0ms khi khởi động ứng dụng'
    ],
    fixes: [
      'Bổ sung cơ chế tự động hợp nhất công cụ mặc định (Zero-Tool Loss) ngăn chặn mất mát thẻ khi có công cụ mới trong tương lai',
      'Hỗ trợ khôi phục bố cục mặc định ban đầu chỉ với 1 click xác nhận'
    ]
  },
  'v23.82': {
    version: 'v23.82',
    title: 'Bản cập nhật v23.82',
    date: '24/10/2026',
    features: [
      'Chuyển công cụ ViewSplit sang nhóm Nâng cao: Đưa ViewSplit từ tab Tiện ích sang tab Nâng cao trên bảng điều khiển chính, giúp phân loại trực quan cùng các công cụ chuyên sâu'
    ],
    fixes: [
      'Cập nhật nhãn đếm phân loại công cụ và bộ lọc danh mục tương thích liền mạch'
    ]
  },
  'v23.81': {
    version: 'v23.81',
    title: 'Bản cập nhật v23.81',
    date: '24/10/2026',
    features: [
      'Nâng cấp Universal Clipboard cho TikTok Downloader: Tích hợp bộ đọc Clipboard toàn cầu đa tầng kết hợp Android Native Bridge và Async Clipboard API, cho phép dán link TikTok một chạm tức thì trên cả Android APK lẫn trình duyệt web',
      'Chuẩn hóa cơ chế báo lỗi thân thiện (Clean Error Extraction): Loại bỏ triệt để lỗi hiển thị chuỗi "[object Object]" trong banner cảnh báo khi gặp sự cố trích xuất video hoặc tệp riêng tư, hiển thị chính xác thông điệp lỗi rõ ràng từ máy chủ'
    ],
    fixes: [
      'Khắc phục sự cố nút "Dán" trong TikTok Downloader không phản hồi khi bấm',
      'Đảm bảo banner thông báo lỗi luôn hiển thị văn bản có nghĩa và tự động ẩn khi lấy video thành công'
    ]
  },
  'v23.80': {
    version: 'v23.80',
    title: 'Bản cập nhật v23.80',
    date: '24/10/2026',
    features: [
      'Khởi động liền mạch 0ms (Pixel-Identical In-Place Hydration): Loại bỏ triệt để hiện tượng giật/nhảy giao diện sau 0.5s khi vào web. Khung vỏ tĩnh ban đầu và giao diện động đã được đồng bộ pixel 1:1 tuyệt đối với đầy đủ 15 thẻ công cụ, huy hiệu Tier, nhãn đếm và biểu tượng vector',
      'Cơ chế gắn sự kiện tại chỗ (Zero-Swap DOM Mounting): Khi JavaScript tải xong, ứng dụng tự động kích hoạt lắng nghe sự kiện trực tiếp trên các phần tử DOM hiện hữu mà không phá hủy hay vẽ lại màn hình, đạt chỉ số giật bố cục CLS = 0.000'
    ],
    fixes: [
      'Khắc phục hoàn toàn lỗi lệch bố cục và nhảy thẻ công cụ sau 0.5 giây khi mở trang web',
      'Đồng bộ tức thì bộ biểu tượng Lucide và dữ liệu hồ sơ cá nhân ngay từ khung hình đầu tiên mà không gây chớp giật'
    ]
  },
  'v23.79': {
    version: 'v23.79',
    title: 'Bản cập nhật v23.79',
    date: '24/10/2026',
    features: [
      'Thông báo cập nhật siêu tốc tức thì (Instant Frame-1 Update Modal): Loại bỏ hoàn toàn độ trễ 2–3 giây khi có bản cập nhật mới. Popup thông báo bản mới sẽ xuất hiện tức thì trong <0.1 giây ngay khi mở trang để người dùng chủ động Làm mới hoặc Để sau mà không bị gián đoạn giữa chừng',
      'Cơ chế Fast-Path Version Probe: Tự động đối soát phiên bản máy chủ ngay trên Frame đầu tiên mà không cần chờ đợi Service Worker tải xong toàn bộ tài nguyên cache'
    ],
    fixes: [
      'Loại bỏ triệt để hiện tượng đang lướt web bình thường được 2–3 giây thì popup cập nhật bất ngờ nhảy ra che màn hình',
      'Kích hoạt Service Worker song song ngay khi tải trang thay vì trì hoãn đợi sự kiện window.onload'
    ]
  },

  'v23.78': {
    version: 'v23.78',
    title: 'Bản cập nhật v23.78',
    date: '24/10/2026',
    features: [
      'Truy cập web tức thì (Zero-Loader Instant First Paint): Loại bỏ hoàn toàn màn hình chờ xoay tròn "Đang khởi động DuyDev Studio...", hiển thị ngay lập tức toàn bộ thanh điều hướng, phân loại và lưới công cụ chính trong 0.05 giây',
      'Kiến trúc nạp module song song (High-Priority ModulePreload): Tải trước các gói tập lệnh quan trọng song song với HTML và CSS, tăng tốc độ tương tác (Time-to-Interactive) lên mức tối đa'
    ],
    fixes: [
      'Loại bỏ cảm giác chờ đợi khó chịu khi mở ứng dụng hoặc truy cập lần đầu trên mọi trình duyệt và chế độ PWA',
      'Đảm bảo chuyển đổi mượt mà giữa vỏ ứng dụng tức thì và các trạng thái động (Hydration) mà không gây giật chớp màn hình'
    ]
  },

  'v23.77': {
    version: 'v23.77',
    title: 'Bản cập nhật v23.77',
    date: '24/10/2026',
    features: [
      'Gom nhóm người dùng & thiết bị liên kết trong Admin (Multi-Device User Consolidation): Tự động hợp nhất toàn bộ thiết bị của cùng một người dùng (Chủ nhà hoặc cùng tên đại diện Alias) thành một thẻ duy nhất, loại bỏ hoàn toàn tình trạng 1 user lặp 2–10 thẻ',
      'Ngăn kéo danh sách thiết bị liên kết (Linked Devices Drawer): Cho phép xem danh sách chi tiết các thiết bị (OS, IP, trạng thái online, lần hoạt động cuối) và xóa từng máy cũ',
      'Dọn thiết bị trùng lặp siêu tốc (Admin Pruning Suite): Nút "Dọn trùng" trên thanh công cụ hỗ trợ dọn sạch các thiết bị rác trùng lặp trong 1 chạm, giữ lại 3 thiết bị mới nhất',
      'Xóa triệt để người dùng & thiết bị: Bổ sung thao tác xóa trực tiếp từng thiết bị hoặc xóa toàn bộ thiết bị liên kết với người dùng ngay trên giao diện Admin'
    ],
    fixes: [
      'Khắc phục triệt để lỗi đường dẫn lưu trữ Device Registry giữa server/data và server/server/data',
      'Tự động đồng bộ hóa việc đổi tên (alias) và chặn (block) trên toàn bộ các thiết bị cùng danh tính của một người dùng'
    ]
  },

  'v23.76': {
    version: 'v23.76',
    title: 'Bản cập nhật v23.76',
    date: '24/10/2026',
    features: [
      'Cổng xác thực danh tính bắt buộc (Mandatory Device Identity Gate): Bắt buộc 100% thiết bị mới phải nhập Tên profile khi truy cập, khóa hoàn toàn các thao tác đóng hay bỏ qua',
      'Định danh thiết bị chuẩn xác vào Admin Console: Gán vĩnh viễn tên người dùng vào hồ sơ thiết bị (deviceRegistryService) để quản trị viên dễ dàng nhận biết trong Mission Control & Traffic Manager'
    ],
    fixes: [
      'Vô hiệu hóa phím Escape, click backdrop và loại bỏ nút đóng/bỏ qua khi người dùng chưa hoàn tất nhập tên profile',
      'Đảm bảo trải nghiệm đổi avatar tùy ý vẫn đầy đủ tính năng khi nhấp trực tiếp vào Avatar trên Header'
    ]
  },
  'v23.75': {
    version: 'v23.75',
    title: 'Bản cập nhật v23.75',
    date: '24/10/2026',
    features: [
      'Thiết lập hồ sơ người dùng đa tầng (User Profile & Avatar System): Popup chào mừng hỏi Tên profile cho thiết bị lần đầu vào web, tự động ghi nhận vĩnh viễn và không hỏi lại',
      'Tùy chỉnh Avatar linh hoạt: Bộ sưu tập 12 biểu tượng cá tính kết hợp tính năng tải ảnh đại diện từ thiết bị (Android & Web) với thuật toán nén ảnh canvas mượt mà',
      'Hiển thị tên người dùng trực quan: Bổ sung nhãn tên nhỏ gọn tinh tế ngay bên dưới Avatar tại thanh điều hướng trên cùng (Header)',
      'Đồng bộ hóa danh tính tự động: Tự động gắn tên người dùng vào phiên tải tài liệu Scribd, Studocu, lưu Drive và hệ thống giám sát Telemetry'
    ],
    fixes: [
      'Tối ưu hóa bố cục thanh điều hướng Header trên mọi kích thước màn hình Android và máy tính, đảm bảo không bị tràn chữ hay lệch nút',
      'Hỗ trợ đổi tên profile và đổi avatar tùy ý bất cứ lúc nào bằng cách nhấp trực tiếp vào Avatar trên Header'
    ]
  },
  'v23.74': {
    version: 'v23.74',
    title: 'Bản cập nhật v23.74',
    date: '23/10/2026',
    features: [
      'Chuẩn hóa phân loại lỗi trang Admin Mission Control: Tách biệt chính xác tác vụ Universal Converter và PDF Studio',
      'Chỉ số thời lượng tác vụ chuẩn xác: Loại bỏ hoàn toàn lỗi thời lượng ảo 150h+ cho các tác vụ lỗi trong quá khứ',
      'Chỉ báo sẵn sàng môi trường máy chủ: Hiển thị trạng thái LibreOffice & công cụ READY đối với các tác vụ lỗi cũ để sẵn sàng Thử lại ngay'
    ],
    fixes: [
      'Ghi nhận completedAt chính xác khi tác vụ gặp lỗi tại tất cả các worker (PDF, Converter, Quiz)',
      'Chuẩn hóa bộ lọc tác vụ Hết giờ (Timeout) không còn bị tính sai do thời lượng ảo'
    ]
  },
  'v23.73': {
    version: 'v23.73',
    title: 'Bản cập nhật v23.73',
    date: '23/10/2026',
    features: [
      'Ghi nhận danh tính người tải Scribd (Downloader Tracking): Tự động định danh thiết bị tải (Máy của Duy, Alias từ Visitor Registry hoặc Khách #id) tương đồng 100% với Studocu Downloader',
      'Huy hiệu người tải trên Kệ tài liệu Scribd: Hiển thị pill người tải với biểu tượng user màu cam Terracotta đồng bộ với thiết kế Stitch Bookshelf',
      'Lưu trữ metadata vĩnh viễn: Tự động đồng bộ và bảo tồn thông tin người tải trong .metadata.json ngay cả khi chuyển vào thùng rác hoặc phục hồi'
    ],
    fixes: [
      'Đồng bộ hóa metadata người tải qua Fastify Gateway và Python Scribd Engine',
      'Hỗ trợ ghi nhận thông tin thiết bị và người tải khi lưu tài liệu sang Studio Drive'
    ]
  },
  'v23.72': {
    version: 'v23.72',
    title: 'Bản cập nhật v23.72',
    date: '23/10/2026',
    features: [
      'Popup cảnh báo liên kết môn học (Center Alert Modal): Tự động phát hiện khi dán nhầm liên kết môn học/thư mục (/course/), hiển thị popup nổi bật ngay chính giữa màn hình với tone màu cam cảnh báo',
      'Hướng dẫn lấy link tài liệu trực quan: Trực quan hóa link môn học vs link file tài liệu (/document/) và cung cấp nút "Đã hiểu (OK)" để người dùng xác nhận',
      'Kiểm định liên kết đa tầng (Link Verification Layer): Ngăn chặn triệt để tình trạng đơ/kẹt tại 95% trên Studocu Downloader'
    ],
    fixes: [
      'Khắc phục triệt để lỗi chứa containing block khiến popup cảnh báo bị lệch và nền mờ bị bó hẹp trong khung nội dung',
      'Đồng bộ hóa phiên bản hệ thống v23.72 trên toàn bộ giao diện PWA, Service Worker và bảng tin cập nhật (Release Notes)',
      'Sửa lỗi hiển thị badge trạng thái Live Stream Terminal: Tự động cập nhật Đang tải, Thất bại và Hoàn tất theo thời gian thực'
    ]
  },
  'v23.71': {
    version: 'v23.71',
    title: 'Bản cập nhật v23.71',
    date: '23/10/2026',
    features: [
      'Studocu Link Verification Layer: Hệ thống kiểm định đa tầng độc lập tự động phát hiện và chặn các liên kết không phải tài liệu (môn học, trường học, tìm kiếm)'
    ],
    fixes: [
      'Phòng thủ đa tầng trên Frontend, Backend Fastify và Python Engine, ngăn chặn hoàn toàn việc nhận nhầm URL không hợp lệ'
    ]
  },
  'v23.70': {
    version: 'v23.70',
    title: 'Bản cập nhật v23.70',
    date: '22/10/2026',
    features: [
      'Studocu Dual Input Workflow: Hỗ trợ hoàn hảo 2 lựa chọn nhập liên kết — bấm vào ô nhập để gõ/dán thủ công, hoặc bấm 1-click nút "Dán link & Tải" để tự động lấy link từ clipboard và bắt đầu tải tức thì'
    ],
    fixes: [
      'Khắc phục triệt để lỗi bấm nút Dán link bị nhảy con trỏ vào ô nhập thay vì tự động dán và tải: Tích hợp Android Native Bridge + bộ trích xuất link Studocu thông minh (extractStudocuUrl)',
      'Đồng bộ động trạng thái nút hành động: Tự động chuyển đổi giữa "Dán link & Tải" và "Bắt đầu tải" linh hoạt theo dữ liệu ô nhập'
    ]
  },
  'v23.69': {
    version: 'v23.69',
    title: 'Bản cập nhật v23.69',
    date: '22/10/2026',
    features: [
      'Studocu Highlight Refinement: Tối ưu hiệu ứng báo mờ xanh tài liệu mới tải — tự động mờ dần và biến mất sau 8 giây, chỉ tô sáng duy nhất 1 tài liệu mới nhất thay vì dính vĩnh viễn'
    ],
    fixes: [
      'Tự động dọn sạch trạng thái highlight khi rời khỏi module Studocu hoặc khi bắt đầu tải tệp mới, không tích lũy highlight xanh trên nhiều tệp'
    ]
  },
  'v23.68': {
    version: 'v23.68',
    title: 'Bản cập nhật v23.68',
    date: '21/10/2026',
    features: [
      'Nâng cấp toàn diện cơ chế Portal & Viewport Backdrop trên toàn bộ hệ thống modal (SlideConfirmModal, Storage, ViewSplit, Sound Mixer)',
      'Chuẩn hóa hiệu ứng mờ kính sâu (Backdrop Blur 12px) bao phủ trọn vẹn 100vw màn hình, khắc phục triệt để hiện tượng khung mờ đen bị bó hẹp trong cột 896px trên màn hình máy tính/tablet',
      'Tự động kích hoạt khóa cuộn trang (Scroll Lock) khi mở hộp thoại xác nhận hủy tệp và phục hồi mượt mà khi đóng'
    ],
    fixes: [
      'Khắc phục lỗi CSS containing block trap do animation fadeIn lưu transform: translateY(0), giải phóng toàn bộ các hộp thoại fixed thoát khỏi container cha',
      'Đảm bảo hộp thoại xác nhận Dọn sạch thùng rác hiển thị chuẩn xác, không bị viền trắng hai bên trên tất cả các trang'
    ]
  },
  'v23.67': {
    version: 'v23.67',
    title: 'Bản cập nhật v23.67',
    date: '21/10/2026',
    features: [
      'Nâng cấp khu vực Tác vụ gần đây thành Dropbox thu gọn trên Dashboard chính: Tối ưu không gian hiển thị, hỗ trợ mở rộng/thu gọn tức thì',
      'Đồng bộ trạng thái mở/đóng bền vững qua localStorage (ds_dashboard_recent_open) kèm phản hồi âm thanh tactile click khi bấm tiêu đề hoặc icon chevron',
      'Giữ nguyên lối tắt nhanh đến Thùng rác và Xem tất cả lịch sử, tối ưu trải nghiệm đọc trên thiết bị di động và Android APK'
    ],
    fixes: [
      'Loại bỏ tình trạng 3 thẻ tác vụ gần đây chiếm trọn chiều cao màn hình điện thoại khi truy cập Trang chủ'
    ]
  },
  'v23.66': {
    version: 'v23.66',
    title: 'Bản cập nhật v23.66',
    date: '21/10/2026',
    features: [
      'Tinh gọn giao diện âm thanh trên trang Cài đặt & Tùy chọn (User Settings): Loại bỏ hoàn toàn lối tắt quản trị âm thanh, chỉ tập trung vào nút bật/tắt phản hồi'
    ],
    fixes: [
      'Phân quyền giao diện rõ ràng: Chuyển toàn bộ tính năng khuếch đại và cân chỉnh âm thanh chuyên sâu về Trung tâm Quản trị Admin Mission Control (#admin)'
    ]
  },
  'v23.65': {
    version: 'v23.65',
    title: 'Bản cập nhật v23.65',
    date: '21/10/2026',
    features: [
      'Bàn hòa âm khuếch đại độc lập từng âm hiệu (Per-Sound Gain Mixer) trong trang Quản trị Admin (#admin)',
      '13 kênh khuếch đại âm thanh độc lập (0% – 250%): Tùy chỉnh độ lớn riêng biệt cho từng âm hiệu hệ thống (Hoàn thành, Bắt đầu, Báo lỗi, Xóa mục, Đổi theme, v.v.)',
      'Nút nghe thử tức thì trên từng kênh âm hiệu kèm nút đặt lại nhanh về mức chuẩn 100% và nút đặt lại toàn bộ 13 âm'
    ],
    fixes: [
      'Định tuyến âm thanh đa tầng: Tách riêng từng node GainNode cho từng âm hiệu trước khi đi qua Master Gain và Compressor',
      'Lưu trữ cấu hình khuếch đại bền vững qua localStorage (ds_sound_cue_gains) và đồng bộ tức thì không cần tải lại trang'
    ]
  },
  'v23.64': {
    version: 'v23.64',
    title: 'Bản cập nhật v23.64',
    date: '21/10/2026',
    features: [
      'Đồng bộ hóa hiển thị phiên bản động toàn hệ thống: Badge phiên bản dưới chân trang (Footer) tự động cập nhật theo PWA core, triệt tiêu lỗi kẹt số phiên bản cũ'
    ],
    fixes: [
      'Khắc phục triệt để lỗi hardcode v23.11 trên thanh Footer, đưa vào bộ nhớ đệm Precache của Service Worker để tải tức thì không phụ thuộc mạng'
    ]
  },
  'v23.63': {
    version: 'v23.63',
    title: 'Bản cập nhật v23.63',
    date: '21/10/2026',
    features: [
      'Thao tác vuốt chuyển tab mượt mà trên Android & Mobile: Hỗ trợ vuốt sang trái/phải để chuyển đổi danh mục công cụ tức thì',
      'Hiệu ứng trượt nội dung 120Hz: Lướt tab công cụ phản hồi thị giác tức thì, tự động cuộn tab đang chọn vào giữa màn hình',
      'Đồng bộ rung xúc giác (Haptic Feedback) và âm thanh khi vuốt chuyển đổi giữa các nhóm công cụ'
    ],
    fixes: [
      'Phân biệt thông minh giữa vuốt ngang chuyển tab và cuộn dọc trang để không làm gián đoạn trải nghiệm đọc',
      'Độc lập hoàn toàn với thanh cuộn tab danh mục và tạm khóa tính năng kéo để tải lại (Pull-to-Refresh) khi vuốt ngang',
      'Tự động giải phóng hoạt ảnh sau 0.22s, đảm bảo màn hình trở về tần số quét tiết kiệm pin (LTPO 1Hz) tuyệt đối'
    ]
  },
  'v23.62': {
    version: 'v23.62',
    title: 'Bản cập nhật v23.62',
    date: '20/10/2026',
    features: [
      'Gia cố bộ lọc chia sẻ liên kết (Web Share Target): Nhận diện chuẩn xác 100% liên kết khi chia sẻ từ trình duyệt di động (Chrome, Edge)',
      'Hỗ trợ toàn diện tài liệu Studocu: Tự động phát hiện liên kết Studocu và hiển thị menu gợi ý tải tài liệu hoặc tạo mã QR chuyên biệt'
    ],
    fixes: [
      'Khắc phục triệt để lỗi Chrome đính kèm ảnh thu nhỏ (preview thumbnail 6KB) khiến ứng dụng nhận nhầm liên kết thành tệp ảnh',
      'Loại bỏ nhiễu tệp ảnh thu nhỏ trên hộp thoại Chia sẻ, ưu tiên hiển thị liên kết và tiêu đề bài viết sạch sẽ'
    ]
  },
  'v23.61': {
    version: 'v23.61',
    title: 'Bản cập nhật v23.61',
    date: '20/10/2026',
    features: [
      'Tinh giản giao diện Trình xem tệp nén (Archive Viewer): Hợp nhất thanh thống kê và thanh điều hướng thành thanh công cụ tối giản chuẩn công thái học',
      'Đường dẫn thư mục thanh lịch: Hiển thị biểu tượng Gốc thay vì chữ root mộc mạc, bố trí thông số nén và kích thước nhỏ gọn'
    ],
    fixes: [
      'Khắc phục triệt để lỗi tệp ở thư mục gốc bị hiển thị trùng lặp thành thư mục ảo (fake folder)',
      'Chuẩn hóa cột kích thước nén cho các hàng thư mục thành gạch ngang (—), loại bỏ nhãn dư thừa'
    ]
  },
  'v23.60': {
    version: 'v23.60',
    title: 'Bản cập nhật v23.60',
    date: '20/10/2026',
    features: [
      'PDF Studio: Hỗ trợ tải lên cùng lúc nhiều tệp trên cả trình duyệt Web và ứng dụng Android APK',
      'Tự động chuyển sang chế độ Ghép PDF khi chọn nhiều tệp và đồng bộ hóa tức thì tab chế độ',
      'Thẻ kết quả xử lý hoàn tất cô lập: Hiển thị chênh lệch dung lượng, thời gian, tải về, xem trước và xóa',
      'Nút Tiếp tục đưa giao diện trở lại trạng thái sạch sẽ để đón nhận đợt tệp tiếp theo'
    ],
    fixes: [
      'Khắc phục lỗi lệch tab chế độ khi tự động chuyển sang chế độ Ghép PDF',
      'Khắc phục triệt để nguy cơ treo file picker trên Android APK khi Intent gặp lỗi',
      'Chuẩn hóa kích thước cảm ứng chuẩn công thái học di động (>= 44px) và chống tràn tên tệp trên thẻ kết quả'
    ]
  },

  'v23.58': {
    version: 'v23.58',
    title: 'Bản cập nhật v23.58',
    date: '20/10/2026',
    features: [
      'Menu thao tác nhanh dạng Bottom Sheet cho Studio Drive: Thay thế thanh nút chật chội trên thẻ bằng menu tiện dụng chuẩn công thái học di động (touch target >= 44px)',
      'Tối ưu giao diện danh sách bảng (List View) trên màn hình hẹp: Tự động gom kích thước vào dòng tiêu đề và ẩn các cột phụ giúp danh sách hiển thị vừa khít không tràn màn hình',
      'Gia cố chống tràn văn bản toàn diện (Text Overflow Defense): Bổ sung min-w-0, truncate và break-words cho hộp thoại xác nhận, thẻ công cụ và hàng lịch sử'
    ],
    fixes: [
      'Khắc phục triệt để lỗi biểu tượng xem trước và soi tệp nén bị tràn ra ngoài viền thẻ ở chế độ lưới trên APK và thiết bị di động',
      'Sửa lỗi tràn chiều rộng thanh trạng thái đáy Drive và hộp thoại xác nhận trượt SlideConfirmModal khi thao tác với tên tệp dài'
    ]
  },

  'v23.57': {
    version: 'v23.57',
    title: 'Bản cập nhật v23.57',
    date: '19/10/2026',
    features: [
      'Xem tài liệu Word (.docx) trực tiếp bên trong tệp nén ZIP: Tích hợp công nghệ docx-preview kết xuất trang A4 chuẩn xác mà không cần giải nén',
      'Hỗ trợ toàn diện mọi định dạng bên trong tệp nén: Xem PDF nhiều trang, bảng tính Excel (.xlsx, .xls, .csv), hình ảnh, âm thanh, video và mã nguồn ngay trong modal',
      'Hỗ trợ tệp nén lồng nhau đệ quy (Zip chồng zip): Khám phá các tệp nén bên trong tệp nén (.zip, .rar, .7z, .tar.gz) với nút "Mở tệp nén", breadcrumb đa cấp và nút quay lại',
      'Nút "Toàn màn hình": Mở bất kỳ tệp tin con nào trong Trình xem Đa năng độc lập chỉ với 1 cú click'
    ],
    fixes: [
      'Khắc phục lỗi xác thực 401 Unauthorized khi trích xuất hoặc xem tệp con trong kho lưu trữ Drive bằng mật khẩu quản trị',
      'Sửa lỗi hiển thị rác ký tự hoặc bỏ qua không xem trước được đối với các tệp Word/PDF có dung lượng lớn trong tệp nén',
      'Khắc phục triệt để việc chặn các tệp nén lồng nhau trong Trình xem tệp Đa năng'
    ]
  },

  'v23.56': {
    version: 'v23.56',
    title: 'Bản cập nhật v23.56',
    date: '19/10/2026',
    features: [
      'Trình Soi Tệp Nén (Archive Explorer) chuyên sâu cho Studio Drive: Hỗ trợ duyệt thư mục đa tầng (nested folders), hiển thị đầy đủ tệp tin trong mọi thư mục con, điều hướng thư mục cha và breadcrumb linh hoạt',
      'Chế độ xem kép và tìm kiếm tức thì: Chuyển đổi linh hoạt giữa "Chế độ Thư mục" và "Tất cả tệp (Flat View)", tích hợp ô tìm kiếm lọc nhanh toàn bộ cây tệp nén',
      'Xem trước tệp tin ngay trong modal (In-Modal Preview): Xem ảnh, âm thanh, video, mã nguồn/văn bản trực tiếp bên trong tệp nén mà không làm mất phiên duyệt tệp nén cha',
      'Tích hợp nút thao tác "Soi tệp nén" 1 chạm trên danh sách Storage Drive và hỗ trợ mở rộng sang không gian làm việc toàn màn hình'
    ],
    fixes: [
      'Sửa lỗi thiếu file hoặc hiển thị 0 tệp khi mở các tệp ZIP có thư mục gốc (như Lab2.zip hoặc repo archives)',
      'Hỗ trợ tệp nén lồng nhau từ Storage Drive (nested drive archives) thông qua parentDrivePath trên API backend Fastify',
      'Khắc phục triệt để lỗi mất ngữ cảnh modal khi bấm xem tệp con trong kho lưu trữ Drive'
    ]
  },

  'v23.55': {
    version: 'v23.55',
    title: 'Bản cập nhật v23.55',
    date: '19/10/2026',
    features: [
      'Đại tu toàn diện trình xem tệp Universal File Viewer: Thống nhất caller contracts, tự động nhận diện magic bytes (%PDF, PK, PNG, JPEG, GIF, WEBP, MP3, MP4, WebM, RAR, 7z) và cơ chế viewerFetch xác thực bảo mật',
      'Bảo vệ chống tràn bộ nhớ (OOM) trên Android WebView: Giới hạn diện tích canvas PDF <= 16,777,216 px và kích thước tối đa 4096 px với thuật toán co tỷ lệ mượt mà',
      'Trải nghiệm di động mượt mà: Bổ sung thanh cuộn cảm ứng tự nhiên cho Word (.docx) và bảng tính (.xlsx), phát video/audio với playsinline và preload metadata, giới hạn đọc văn bản 128KB tức thì'
    ],
    fixes: [
      'Bypass triệt để Service Worker cho các yêu cầu stream media, range byte, download và blob URL',
      'Định dạng chuẩn Content-Type: text/javascript; charset=utf-8 cho các tệp script .js/.mjs trên Fastify backend',
      'Tích hợp phím cứng quay lại (hardware back button) của Android đóng hộp thoại xem tệp qua cờ window.__ddFileViewerOpen'
    ]
  },

  'v23.54': {
    version: 'v23.54',
    title: 'Bản cập nhật v23.54',
    date: '19/10/2026',
    features: [
      'Hệ thống thông báo đẩy Android nhạy bén (Responsive Push Notifications V2): Nâng cấp kênh thông báo ds_push_channel_v2 với độ ưu tiên cao nhất (IMPORTANCE_HIGH/PRIORITY_MAX), âm báo chuông mặc định, rung haptic và hiển thị trực tiếp trên màn hình khóa',
      'Hỗ trợ thông báo đẩy toàn diện trên cả Native APK và Web PWA: Tích hợp Unified NotificationHelper cho toàn bộ các công cụ nền (Tải YouTube, Tải TikTok, Quiz Generator, PDF Studio, File Converter, Task Coordinator)'
    ],
    fixes: [
      'Khắc phục triệt để lỗi thông báo bị ẩn hoặc không phát âm thanh trên các dòng máy Android (Samsung, Xiaomi, Oppo)',
      'Bổ sung quyền POST_NOTIFICATIONS kiểm tra và yêu cầu trực tiếp qua AndroidBridge',
      'Thêm notificationclick listener trong Service Worker giúp chạm vào thông báo là mở lại ứng dụng tức thì'
    ]
  },

  'v23.53': {
    version: 'v23.53',
    title: 'Bản cập nhật v23.53',
    date: '19/10/2026',
    features: [
      'Engine phát media kiên cố hoá (Resilient Audio/Video Fallback): Tự động khôi phục phát blob URL khi luồng phát trực tiếp gặp lỗi giải mã hoặc hạn chế mạng trên Android WebView',
      'Hỗ trợ tệp tên dài Unicode: Mở rộng tham số định tuyến máy chủ lên 2048 ký tự, chấp nhận mọi tên tệp tiếng Việt kèm ký tự đặc biệt'
    ],
    fixes: [
      'Sửa lỗi MediaError code 4 trong trình xem âm thanh/video trên Android APK và trình duyệt',
      'Khắc phục lỗi 404 Route Not Found đối với các liên kết stream có tên tệp dài hoặc mã hóa Unicode',
      'Bổ sung cơ chế tìm kiếm tệp đa thư mục (drive/youtube, drive/YouTube, temp/youtube) với chuẩn hóa Unicode NFC'
    ]
  },

  'v23.52': {
    version: 'v23.52',
    title: 'Bản cập nhật v23.52',
    date: '19/10/2026',
    features: [
      'Tab YouTube riêng biệt trong Storage Drive: Dễ dàng xem và quản lý tập trung toàn bộ video và âm thanh tải từ YouTube tại /youtube',
      'Phát liên tục playlist media trong Storage Drive: Hỗ trợ tự động chuyển bài video/âm thanh kế tiếp khi duyệt file trong thư mục YouTube'
    ],
    fixes: [
      'Tối ưu giao diện YouTube Downloader trên Android: Cải thiện bố cục lịch sử tải và kết quả tải gần đây, chống chữ bị ép dòng và tràn lề trên màn hình nhỏ',
      'Định tuyến danh mục tải YouTube vào thư mục chuẩn hóa chữ thường và tự động khởi tạo thư mục trên máy chủ'
    ]
  },

  'v23.51': {
    version: 'v23.51',
    title: 'Bản cập nhật v23.51',
    date: '19/10/2026',
    features: [
      'Trình phát xem trước video/audio trong app: Trải nghiệm xem trước mượt mà trực tiếp trên Universal File Viewer cho YouTube Downloader và các công cụ media trên Android APK',
      'Scoped Storage MediaStore: Lưu trữ file tải về tức thì vào thư mục Downloads, Movies, Music của hệ điều hành Android 10-14'
    ],
    fixes: [
      'Khắc phục lỗi EACCES Permission Denied khi tải file trên Android APK qua MediaStore ContentResolver',
      'Sửa lỗi media playback user gesture trên Android WebView và kích hoạt RFC 7233 byte-range streaming',
      'Định tuyến tự động toàn bộ liên kết tải file (a[download]) qua AndroidBridge'
    ]
  },

  'v23.48': {
    version: 'v23.48',
    title: 'Bản cập nhật v23.48',
    date: '18/10/2026',
    features: [
      'Concentric Icon Halos: Neo trực tiếp vòng hào quang vào tâm hộp icon đạt độ đồng tâm 100% hoàn hảo trên cả điện thoại (38px) lẫn máy tính (44px)',
      '120FPS Android Swipe Governor: Tự động tạm ngưng nhẹ vi chuyển động khi ngón tay đang chạm vuốt (touchmove/scroll) và phục hồi sau 120ms'
    ],
    fixes: [
      'Loại bỏ -webkit-mask-composite: xor và conic-gradient offscreen FBO buffer trên viền thẻ UR/EX để cuộn siêu mượt',
      'Tách box-shadow khỏi vòng xoay ur-halo-ring sang quầng sáng radial-gradient tĩnh, thu gọn holo-foil-sheen về 100% giảm 16 lần overdraw GPU',
      'Thay thế blur-2xl trên background bloom của thẻ bằng radial-gradient tĩnh loại bỏ 40px Gaussian blur'
    ]
  },

  'v23.47': {
    version: 'v23.47',
    title: 'Bản cập nhật v23.47',
    date: '18/10/2026',
    features: [
      '120Hz Native Compositor & Battery Shield: Tối ưu hoá toàn diện pipeline render thẻ 10-Tier RPG đạt 120 FPS cuộn mượt mà không hao pin',
      'Offscreen Animation Governor: Tự động tạm dừng hoạt họa các thẻ nằm ngoài tầm mắt bằng IntersectionObserver để triệt tiêu tải GPU khi cuộn'
    ],
    fixes: [
      'Loại bỏ backdrop-blur thừa trên nhãn specs để giải phóng 42 lớp tính toán Gaussian blur mỗi frame',
      'Thay thế filter drop-shadow trên các vòng xoay SVG bằng baked vector glow strokes và static radial backdrops'
    ]
  },

  'v23.46': {
    version: 'v23.46',
    title: 'Bản cập nhật v23.46',
    date: '18/10/2026',
    features: [
      'Roll out Tier UR (Prismatic Hologram Mythic) cho Studocu Downloader và Scribd Downloader trên Dashboard: Thừa hưởng khung viền lăng kính 7 màu liền mạch, con dấu hoàng gia và hiệu ứng vật lý cao cấp',
      'Preserve Original Identity: Giữ trọn 100% icon đồ họa vector Apple-grade và dải màu đặc trưng riêng biệt (Indigo #6366F1 cho Studocu & Terracotta Orange #EA580C cho Scribd) giúp nhận diện tức thì trong 0.1s'
    ],
    fixes: [
      'Loại bỏ hoàn toàn viền sâu bò (crawling worms) sang khung viền vật lý liên tục',
      'Đồng bộ socket đá quý 4 góc và nút bấm Mở sang màu thương hiệu của từng công cụ'
    ]
  },

  'v23.50': {
    version: 'v23.50',
    title: 'Bản cập nhật v23.50',
    date: '19/10/2026',
    features: [
      'YouTube Downloader Light Mode & Dark Mode Parity: Chuẩn hóa toàn diện giao diện Light Mode và Dark Mode cho module YouTube Downloader',
      'Đưa YouTube Downloader về card công cụ tiêu chuẩn (Standard Card) đồng bộ với TikTok Downloader',
      'Tích hợp Apple-grade Vector YouTube Icon độc quyền hiển thị sắc nét trên cả Dashboard, Card Watermark và Workspace'
    ],
    fixes: [
      'Khắc phục lỗi hiển thị tối đen (hardcoded dark mode) khi dùng giao diện sáng Light Mode trong YouTube Downloader'
    ]
  },

  'v23.49': {
    version: 'v23.49',
    title: 'Bản cập nhật v23.49',
    date: '18/10/2026',
    features: [
      'Ra mắt YouTube Downloader Pro: Tải video YouTube Full HD/4K (1080p, 720p, 480p, 360p) với video+audio merging và trích xuất âm thanh chất lượng cao MP3 320kbps / M4A AAC nguyên bản',
      'Tích hợp 1-click lưu trữ cá nhân DD Studio Drive (drive/YouTube/) và xem trước trực tiếp qua Universal File Viewer',
      'Hỗ trợ nhận diện thông minh liên kết YouTube (watch, shorts, youtu.be, embed) từ Web Share Target và Smart URL Router'
    ],
    fixes: [
      'Tối ưu hóa pipeline tải đa luồng yt-dlp và FFmpeg ghép nối trên máy chủ'
    ]
  },

  'v23.45': {
    version: 'v23.45',
    title: 'Bản cập nhật v23.45',
    date: '18/10/2026',
    features: [
      'QR Studio Platform-Specific URL Validation: Tự động kiểm tra tính hợp lệ của liên kết theo từng dịch vụ được chọn (YouTube, Facebook, TikTok, Google Workspace...), cảnh báo ngay khi dán sai nền tảng'
    ],
    fixes: [
      'Loại bỏ trường nhập mã slug thủ công trong form tạo mã QR Link Web để tinh giản giao diện và tự động hóa mã định danh'
    ]
  },

  'v23.44': {
    version: 'v23.44',
    title: 'Bản cập nhật v23.44',
    date: '18/10/2026',
    features: [
      'Converter Pro Prominent Next Batch CTA: Đóng khung và làm nổi bật nút "Chuyển đổi tiếp" với viền thương hiệu, nền tương phản cao và hiệu ứng phản hồi sắc nét'
    ],
    fixes: [
      'Tối ưu độ tương phản và viền hiển thị cho nút chuyển đổi tiếp trong ConverterResult'
    ]
  },

  'v23.35': {
    version: 'v23.35',
    title: 'Bản cập nhật v23.35',
    date: '17/10/2026',
    features: [
      'PDF Studio Instant Input-to-CTA Synchronization: Nút hành động chính tự động sáng và kích hoạt tức thì khi người dùng nhập dữ liệu cấu hình mà không cần chuyển tab hay nhấp chuột ngoài',
      'Defensive Cover Lightbox Preview: Xem chi tiết ảnh bìa tài liệu phóng to toàn màn hình sắc nét và mượt mà trên mọi tab đơn tệp'
    ],
    fixes: [
      'Sửa lỗi mở hộp thoại xem ảnh bìa tài liệu (polymorphic parameter handling cho openPdfPageLightbox)',
      'Gỡ bỏ nút sao chép link không cần thiết trên thanh kết quả hoàn tất PDF Studio'
    ]
  },

  'v23.33': {
    version: 'v23.33',
    title: 'Bản cập nhật v23.33',
    date: '17/10/2026',
    features: [
      'Converter Pro Streamlined Post-Conversion: Ẩn thanh hàng đợi/thêm tệp sau khi chuyển đổi xong, giữ giao diện kết quả tập trung và tối giản',
      'Instant One-Click Next Batch: Nút "Chuyển đổi tiếp" tự động dọn sạch hàng đợi cũ và sẵn sàng nạp đợt tệp mới tức thì mà không cần kéo xác nhận'
    ],
    fixes: [
      'Ẩn thanh dropzone compact thừa trên giao diện kết quả chuyển đổi',
      'Đồng bộ PWA cache storage và Service Worker v23.33'
    ]
  },

  'v23.31': {
    version: 'v23.31',
    title: 'Bản cập nhật v23.31',
    date: '17/10/2026',
    features: [
      'Dual-Track Resilient ZIP Bundler: Tự động gom tệp nén bằng engine máy chủ hoặc dự phòng tức thì qua JSZip trên trình duyệt',
      'Flexible Compression Level: Hỗ trợ linh hoạt cả mức nén số và chuỗi (fast/normal/maximum) giúp triệt tiêu hoàn toàn lỗi nén tệp'
    ],
    fixes: [
      'Sửa lỗi nén tệp (400) khi tải ZIP trên Converter Pro do sai định dạng compressionLevel',
      'Đồng bộ toàn diện phiên bản Service Worker và PWA Cache Storage v23.31'
    ]
  },

  'v23.30': {
    version: 'v23.30',
    title: 'Bản cập nhật v23.30',
    date: '17/10/2026',
    features: [
      'Converter Pro Streamlined Results: Hộp thoại Đã Xử Lý hiển thị danh sách từng tệp hoàn tất rõ ràng, cho phép tải riêng từng tệp hoặc tải trọn bộ dạng .ZIP',
      'Completed Ambient Emerald Glow: Hiệu ứng đóng viền xanh lá mờ tinh tế khi toàn bộ hàng đợi chuyển đổi xong, giúp người dùng nhận biết ngay lập tức'
    ],
    fixes: [
      'Ẩn hoàn toàn khung hàng đợi và thanh tùy chọn thừa sau khi chuyển đổi xong, tối ưu hóa không gian hiển thị cho kết quả tệp',
      'Hỗ trợ xem trước (preview) và tải trực tiếp từng tệp chuyển đổi độc lập'
    ]
  },

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

export const LATEST_RELEASE = RELEASE_NOTES_MAP['v24.24'];

/**
 * Normalizes any version string into standard 'vX.XX' key
 * @param {string} [rawVer]
 * @returns {string}
 */
export function normalizeVersionKey(rawVer) {
  if (!rawVer) return 'v24.24';
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
