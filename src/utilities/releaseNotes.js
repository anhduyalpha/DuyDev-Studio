/**
 * Release Notes & Changelog Registry for DuyDev Studio
 * Maps version strings (e.g., 'v23.00', 'duydev-studio-v23.00') to structured release highlights:
 * - features: Newly added capabilities and user-facing tools
 * - fixes: Resolved bugs, layout fixes, and performance/ergonomics refinements
 */

export const RELEASE_NOTES_MAP = {
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
