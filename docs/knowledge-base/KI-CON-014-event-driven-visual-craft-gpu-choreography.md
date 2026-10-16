# KI-CON-014: Event-Driven Visual Craft & 100% GPU-Composited Choreography (0% Idle Battery)

## Metadata
- **ID:** `KI-CON-014`
- **Type:** `concept`
- **Domain:** `frontend` / `mobile` / `design-system`
- **Status:** `verified`
- **Applies to:** `src/styles/studocu.css`, `src/styles/stitch-tokens.css`, `MainActivity.kt`, and all UI components.
- **Related KIs:** [`KI-CON-001`](KI-CON-001-ui-production-minimalism.md), [`KI-CON-012`](KI-CON-012-120hz-inertial-smooth-scroll-gpu-compositing.md), [`KI-FIX-023`](KI-FIX-023-android-webview-battery-drain-page-visibility-governor.md).

---

## 1. Context & Architectural Challenge
In battery optimization sweeps, engineering teams frequently make the mistake of **over-aggressively deleting animations and visual effects**, turning cards and indicators into lifeless, flat, static gray boxes.

### The False Dichotomy:
- **Flawed Extreme A:** Infinite CSS animations (`border-beam-spin`, `@property --beam-angle`, `conic-gradient` with `filter: blur()`, `animate-pulse` on idle dots). Forces Chromium compositor to repaint and continuously redraw frames at 60/120 FPS, preventing LTPO displays from dropping to 1Hz–10Hz, draining mobile battery.
- **Flawed Extreme B:** Deleting all shadows, glows, and animations. Produces a dead, flat, uninspiring UI (violating Apple/Linear visual craft standards).

---

## 2. Core Architecture: Event-Driven & Bounded Choreography

Instead of continuous unconstrained loops, all visual craft operates on **Event-Driven Choreography** with three strictly bounded lifecycle stages:

```
[ Mount / Route Enter ]  ──>  Entrance Shimmer (1.6s, iteration: 1)  ──>  Multi-Layered Specular Glass (0% GPU Idle)
                                                                                  │
[ User Interaction ]    ──>  :focus-within / :hover / :active (0.3s transition) ──┤
                                                                                  │
[ Active Background Job] ──>  .is-processing (120 FPS Composited Pulse) ─────────┘
```

### Pillar 1: Multi-Layered Specular Glass at Rest (0% GPU Idle)
Never render flat, dull borders. When cards and status dots are idle, construct depth using multi-layered specular borders and soft ambient dropshadows:
```css
/* Dual-layer specular border & soft ambient elevation (0 FPS idle cost) */
.border-beam-card,
.studocu-hero-card {
  box-shadow: 
    inset 0 1px 0 0 rgba(255, 255, 255, 0.95),
    0 1px 3px 0 rgba(0, 0, 0, 0.04),
    0 10px 30px -10px rgba(99, 102, 241, 0.10);
}

html.dark .border-beam-card {
  background: radial-gradient(85% 60% at 50% 0%, rgba(99, 102, 241, 0.09) 0%, transparent 100%), #111114 !important;
  box-shadow: 
    inset 0 1px 0 0 rgba(255, 255, 255, 0.22),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04),
    0 12px 36px -10px rgba(0, 0, 0, 0.70),
    0 0 30px -10px rgba(99, 102, 241, 0.15);
}
```

### Pillar 2: 3-Layer Specular Glowing Orbs (Zero-Redraw Living Status Dots)
Status dots (`Header`, `FormatSelector`, `ViewSplit`, `GlobalTaskDock`) must NOT be flat colored dots. They use 3 concentric layers:
1. **Intense Specular Core:** `radial-gradient(circle at 35% 35%, #6ee7b7 0%, #10b981 60%, #047857 100%)`
2. **Translucent Halo Ring:** `0 0 0 2px rgba(16, 185, 129, 0.20)`
3. **Multi-Stage Ambient Drop-Shadow:** `0 0 8px 1px rgba(16, 185, 129, 0.65), 0 0 16px 2px rgba(16, 185, 129, 0.25)`

Tokens provided: `.specular-status-dot-emerald`, `-indigo`, `-cyan`, `-amber`, `-rose`.

### Pillar 3: 100% GPU-Composited Shaders (`transform` & `opacity` ONLY)
- **Forbidden:** `@property --beam-angle`, `filter: blur()`, `background-position` animations. (These force CPU repaints on Blink's main thread every frame).
- **Mandated:** All animations must use `transform` and `opacity` exclusively:
```css
@keyframes border-beam-spin {
  0%, 100% {
    opacity: 0.70;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.008);
  }
}
```

### Pillar 4: Tactile Spring Micro-Physics on Touch (120Hz Fluidity)
Buttons and tool cards provide tactile feedback under Android 120Hz touch:
```css
button:not(:disabled):active,
.btn:not(:disabled):active,
[role="button"]:not([aria-disabled="true"]):active,
.tool-card:active {
  transform: scale(0.975) translateZ(0);
  transition: transform 0.14s cubic-bezier(0.22, 1, 0.36, 1) !important;
}
```

### Pillar 5: Android Minimal Post-Processing Mode (`MainActivity.kt`)
On Android 11+ (API 30+), activate minimal post-processing to eliminate display pipeline buffering while preserving `preferredDisplayModeId = 0` (native LTPO frequency scaling):
```kotlin
if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
    try {
        window.setPreferMinimalPostProcessing(true)
    } catch (_: Exception) {}
}
```

---

## 3. Verification & Guardrails
- **Automated Test:** `server/tests/unit/battery_optimization.test.ts` asserts zero idle `border-beam-spin`, zero `@property`, zero `filter: blur()`, presence of `border-beam-entrance 1.6s`, and presence of `.specular-status-dot` tokens.
- **Micro-Receipt:** `✅ [Verify: vitest+node+tsc->0 | UI: event-driven-craft | KI: KI-CON-014]`
