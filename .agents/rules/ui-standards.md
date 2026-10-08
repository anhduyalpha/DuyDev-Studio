# UI Production Minimalism & Anti-Filler Rules

## 1. Core Mandate
All user interfaces in DuyDev Studio must adhere to **production-grade minimalism** (Linear, Vercel, Raycast aesthetic).

## 2. Strict Prohibitions (Anti-Patterns)
1. **Never add marketing or tutorial filler text**:
   - FORBIDDEN: `"Sẵn sàng in ấn, chia sẻ qua Zalo, Messenger, AirDrop"`
   - FORBIDDEN: `"Giải mã tức thì trực tiếp trên thiết bị của bạn"`
   - FORBIDDEN: `"PNG • Độ nét cao"`
2. **Never add parenthetical explanations in options or radio buttons**:
   - FORBIDDEN: `"PNG (Ảnh số)"` -> REQUIRED: `"PNG"`
   - FORBIDDEN: `"SVG (Vector in ấn)"` -> REQUIRED: `"SVG"`
   - FORBIDDEN: `"WPA / WPA2 / WPA3 (Phổ biến)"` -> REQUIRED: `"WPA / WPA2 / WPA3"`
   - FORBIDDEN: `"Không mật khẩu (Open)"` -> REQUIRED: `"Không mật khẩu"`
3. **Keep dropzone titles concise**:
   - Use `"Kéo thả hoặc tải tệp lên"`, accompanied by accepted file formats (`PNG, JPG, WEBP, PDF`).
4. **Never show fake placeholder feedback**:
   - Show real decoded output or real server status directly.

## 3. Dual-Platform Mandate (Desktop & Mobile Parity)
1. **Never design for desktop-only or mobile-only**: Every UI feature, card, navigation element, and atmospheric background MUST be designed, tested, and verified for both Desktop (hover states, wide viewports) and Mobile (touch targets >=44px, compact widths 375px–430px, OLED dark contrast, safe-areas, and sticky header bounds).
2. **Never hide primary information on mobile**: Adapt layout gracefully via responsive breakpoints (`sm:`, `md:`, `lg:`) instead of arbitrarily removing key capabilities.
3. **Ambient background & lighting must be tuned for mobile**: Sizing and opacity of spotlights/gradients must account for mobile screen aspect ratios and OLED contrast so they remain clear and purposeful on phones.

Refer to Knowledge Item: [`docs/knowledge-base/KI-CON-001-ui-production-minimalism.md`](../docs/knowledge-base/KI-CON-001-ui-production-minimalism.md)
