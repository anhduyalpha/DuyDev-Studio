---
id: KI-HOWTO-002-cloudflare-tunnel-docker-homeserver-https
title: "Deploying Cloudflare Zero-Trust Tunnel with Docker on Homeserver for Secure HTTPS"
type: how-to
status: verified
domain: devops
tags: [cloudflare, cloudflared, docker, homeserver, https, ssl, zero-trust, tunnel, networking]
created_at: 2026-09-22
updated_at: 2026-09-22
version: 1.0.0
owner: "@anhduy"
trigger_conditions: "Exposing DuyDev Studio or local homeserver services to the public internet with HTTPS without opening router ports (CGNAT bypass) using Cloudflare Tunnels."
search_queries:
  - "Triển khai Cloudflare Tunnel bằng Docker cho homeserver"
  - "How to run cloudflared docker container with token"
  - "Lỗi SSL handshake subdomain 2 cấp Cloudflare SEC_E_ILLEGAL_MESSAGE"
  - "Expose localhost Fastify to internet via Cloudflare Tunnel"
  - "Cấu hình HTTPS cho server nội bộ không cần mở port modem"
related_kis:
  - KI-HOWTO-001-studocu-downloader-docker-casaos-deployment
---

# [KI-HOWTO-002] Triển Khai Cloudflare Zero-Trust Tunnel Bằng Docker Cho Homeserver Để Cấp HTTPS Công Khai

## 1. Context & Purpose
Hướng dẫn cấu hình và vận hành kết nối bảo mật **Cloudflare Zero-Trust Tunnel (`cloudflared`)** trên homeserver cá nhân (`192.168.2.171`). Phương pháp này cho phép truy cập toàn bộ ứng dụng **DuyDev Studio** từ mạng ngoài (4G, Wi-Fi công cộng) thông qua giao thức HTTPS có chứng chỉ SSL chính thống mà:
- **Không cần mở port (Port Forwarding)** trên router/modem gia đình.
- **Vượt qua hoàn toàn rào cản CGNAT** của nhà mạng (Viettel, VNPT, FPT).
- **Không để lộ địa chỉ IP thật** của homeserver.

---

## 2. Prerequisites (Điều Kiện Tiên Quyết)
- [ ] Homeserver Linux đã cài đặt Docker Engine và kết nối Internet.
- [ ] Tài khoản Cloudflare quản lý tên miền (ví dụ: `alphadaniel.io.vn`).
- [ ] Đã tạo một Tunnel mới trên **Cloudflare Zero Trust** ➔ **Networks** ➔ **Tunnels** và lấy chuỗi `TUNNEL_TOKEN`.
- [ ] Dịch vụ web (Fastify Gateway) đang lắng nghe trên máy chủ (cổng `3000`).

---

## 3. Core Instructions (Các Bước Triển Khai)

### Bước 1: Khởi Chạy Container `cloudflared` Chạy Nền Bền Vững
Sử dụng cờ `--network host` để container truy cập trực tiếp các cổng nội bộ (`localhost:3000`) mà không cần thiết lập cầu nối Docker bridge phức tạp:

```bash
docker run -d \
  --name cloudflared-ddstudio \
  --restart unless-stopped \
  --network host \
  cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <CLOUDFLARE_TUNNEL_TOKEN>
```

*Giải thích các cờ lệnh quan trọng:*
- `-d`: Khởi chạy ở chế độ ngầm (detached mode), không tắt khi ngắt phiên SSH.
- `--name cloudflared-ddstudio`: Đặt tên tường minh tránh xung đột với các tunnel khác trên cùng host.
- `--restart unless-stopped`: Đảm bảo container tự khởi động lại khi homeserver reboot.
- `--network host`: Cho phép `cloudflared` trỏ trực tiếp đến `http://localhost:3000`.

### Bước 2: Cấu Hình Public Hostname Trên Cloudflare Dashboard
1. Truy cập **Cloudflare Zero Trust** ➔ **Networks** ➔ **Tunnels** ➔ chọn tunnel vừa tạo ➔ bấm **Configure**.
2. Chọn tab **Public Hostname** ➔ bấm **Add a public hostname** (hoặc Edit):
   - **Subdomain**: Nhập tên phụ cấp 1 (ví dụ: `studio` hoặc `ddstudio` hoặc để trống nếu dùng tên miền gốc).
   - **Domain**: Chọn tên miền sở hữu (ví dụ: `alphadaniel.io.vn`).
   - **Service Type**: Chọn `HTTP`.
   - **URL**: Nhập `localhost:3000`.
3. Bấm **Save hostname**.

---

## 4. Gotchas & Edge Cases (Cảnh Báo & Lưu Ý Quan Trọng)

### Cảnh báo 1: Giới Hạn Chứng Chỉ SSL Miễn Phí của Cloudflare (Universal SSL)
- **Quy tắc**: Gói SSL miễn phí của Cloudflare **chỉ bảo vệ tên miền gốc và tên miền phụ 1 cấp** (`*.alphadaniel.io.vn`).
- **Lỗi thường gặp**: Đặt tên miền con 2 cấp như `duydev.studio.alphadaniel.io.vn`.
- **Hậu quả**: Trình duyệt báo lỗi bảo mật ngay lập tức (`SEC_E_ILLEGAL_MESSAGE`, `SSL_ERROR_NO_CYPHER_OVERLAP` hoặc `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`) do Cloudflare không cấp chứng chỉ SSL cho cấp thứ 2 trở lên.
- **Khắc phục**: Luôn chỉ sử dụng **1 cấp subdomain** (ví dụ: `studio.alphadaniel.io.vn`) hoặc dùng thẳng tên miền gốc (`alphadaniel.io.vn`).

### Cảnh báo 2: Xung đột Cổng Metrics Khi Chạy Nhiều Tunnel Trên `--network host`
- Mặc định `cloudflared` mở cổng metrics nội bộ ngẫu nhiên (hoặc `20241`, `20242`).
- Nếu chạy song song 2 container `cloudflared` ở chế độ `--network host`, `cloudflared` sẽ tự động chuyển sang cổng kế tiếp mà không làm sập kết nối. Tuy nhiên, nếu tunnel cũ không còn sử dụng, nên xóa bỏ bằng:
  ```bash
  docker rm -f <container_name_cu>
  ```

---

## 5. Verification (Kiểm Thử Nghiệm Thu)

1. **Kiểm tra Nhật Ký Kết Nối Edge**:
   ```bash
   docker logs --tail 20 cloudflared-ddstudio
   ```
   *Kết quả mong đợi:*
   ```text
   INF Registered tunnel connection connIndex=0 location=sin12 protocol=quic
   INF Updated to new configuration config="{\"ingress\":[{\"hostname\":\"...\", \"service\":\"http://localhost:3000\"}]}"
   ```

2. **Kiểm tra Truy Cập HTTPS Công Khai**:
   ```bash
   curl -I "https://alphadaniel.io.vn"
   ```
   *Kết quả mong đợi:*
   ```http
   HTTP/1.1 200 OK
   Server: cloudflare
   CF-RAY: ...-SIN
   ```

---

## 6. Changelog
- **2026-09-22 (v1.0.0)**: Khởi tạo hướng dẫn triển khai Cloudflare Tunnel Docker cho DD Studio và cảnh báo giới hạn cấp SSL (@anhduy).
