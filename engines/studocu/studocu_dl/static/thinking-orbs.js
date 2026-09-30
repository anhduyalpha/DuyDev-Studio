/**
 * Thinking Orbs - Libraries.dev (Canvas 2D Engine)
 * Pure vanilla JavaScript implementation with zero dependencies.
 * Tuned for Studocu Downloader obsidian / dark theme.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ThinkingOrbs = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function fract(n) {
        return n - Math.floor(n);
    }

    function hash(n, s) {
        const t = Math.sin(n * 12.9898 + s * 78.233) * 43758.5453;
        return t - Math.floor(t);
    }

    function fibonacciSphere(idx, total) {
        const phi = Math.PI * (3 - Math.sqrt(5));
        const y = 1 - 2 * (idx + 0.5) / total;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = idx * phi;
        return [r * Math.cos(theta), y, r * Math.sin(theta)];
    }

    function makeProj(yaw, pitch, cx, cy, scale) {
        const sP = Math.sin(pitch), cP = Math.cos(pitch);
        const sY = Math.sin(yaw), cY = Math.cos(yaw);
        return function (x, y, z) {
            const x1 = x * cY + z * sY;
            const z1 = -x * sY + z * cY;
            const y2 = y * cP - z1 * sP;
            const z2 = y * sP + z1 * cP;
            return [cx + x1 * scale, cy - y2 * scale, z2];
        };
    }

    function paintDots(ctx, dots, isDark) {
        const len = dots.length;
        for (let i = 0; i < len; i++) {
            const d = dots[i];
            const a = d.a !== undefined ? d.a : 1;
            const c = Math.min(1, Math.max(0, d.white !== undefined ? d.white : 0.8));
            // In dark mode: white / light silver dots
            const val = Math.round((isDark ? c : (1 - c)) * 255);
            ctx.fillStyle = 'rgba(' + val + ',' + val + ',' + val + ',' + a.toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(d.x, d.y, Math.max(0.4, d.r), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 1. Orbits Mode (Libraries.dev "working" state)
    function renderOrbits(size, time, opts) {
        const cx = size / 2;
        const cy = size / 2;
        const radius = size / 2 * 0.78;
        const proj = makeProj(time * 0.5, 0.35, cx, cy, 1);
        const dots = [];
        const orbitN = opts.orbitN || 8;
        const ghostN = opts.ghostN || 28;
        const particles = opts.particles || 3;

        for (let e = 0; e < orbitN; e++) {
            const l = hash(e, 1.7);
            const R = hash(e, 5.2);
            const w = hash(e, 8.9);
            const rOrbit = radius * (0.45 + 0.52 * l);
            const u = l * 2 * Math.PI;
            const y = Math.acos(2 * R - 1);
            const b = Math.sin(y) * Math.cos(u);
            const f = Math.cos(y);
            const P = Math.sin(y) * Math.sin(u);

            let x = -f, g = b;
            const d = 0;
            const v = Math.max(1e-6, Math.sqrt(x * x + g * g));
            x /= v; g /= v;
            const k = f * d - P * g;
            const N = P * x - b * d;
            const z = b * g - f * x;
            const speedDir = (0.35 + 0.65 * w) * (w > 0.5 ? 1 : -1);

            // Ghost track dots
            for (let B = 0; B < ghostN; B++) {
                const angle = (B / ghostN) * 2 * Math.PI;
                const pt = proj(
                    (x * Math.cos(angle) + k * Math.sin(angle)) * rOrbit,
                    (g * Math.cos(angle) + N * Math.sin(angle)) * rOrbit,
                    (d * Math.cos(angle) + z * Math.sin(angle)) * rOrbit
                );
                const depth = (pt[2] / rOrbit + 1) / 2;
                dots.push({
                    x: pt[0],
                    y: pt[1],
                    z: pt[2],
                    r: (0.55 + 0.45 * depth) * (size / 40),
                    white: 0.85,
                    a: 0.08 + 0.22 * depth
                });
            }

            // Moving bright particles
            for (let p = 0; p < particles; p++) {
                const phase = fract(time * 0.45 * speedDir + p / particles + l) * 2 * Math.PI;
                const pt = proj(
                    (x * Math.cos(phase) + k * Math.sin(phase)) * rOrbit,
                    (g * Math.cos(phase) + N * Math.sin(phase)) * rOrbit,
                    (d * Math.cos(phase) + z * Math.sin(phase)) * rOrbit
                );
                const depth = (pt[2] / rOrbit + 1) / 2;
                dots.push({
                    x: pt[0],
                    y: pt[1],
                    z: pt[2],
                    r: (1.2 + 1.2 * depth) * (size / 40),
                    white: 1.0,
                    a: 0.65 + 0.35 * depth
                });
            }
        }

        // Sort by Z-order for true 3D depth rendering
        dots.sort(function (a, b) { return a.z - b.z; });
        return dots;
    }

    // 2. Globe Mode (Libraries.dev "searching" state)
    function renderGlobe(size, time, opts) {
        const cx = size / 2;
        const cy = size / 2;
        const radius = size / 2 * 0.82;
        const tilt = 0.35 + 0.05 * Math.sin(time * 0.4);
        const proj = makeProj(time * 0.6, tilt, cx, cy, radius);
        const dots = [];
        const latRings = opts.latRings || 12;
        const lonDensity = opts.lonDensity || 28;
        const scanAngle = (time * 1.6) % (Math.PI * 2);

        for (let w = 0; w <= latRings; w++) {
            const lat = -Math.PI / 2 + (w / latRings) * Math.PI;
            const cosLat = Math.cos(lat);
            const sinLat = Math.sin(lat);
            const count = Math.max(1, Math.round(Math.abs(cosLat) * lonDensity));

            for (let f = 0; f < count; f++) {
                const lon = (f / count) * 2 * Math.PI;
                const pt = proj(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon));
                const depth = (pt[2] + 1) / 2;

                // Meridian scan highlight
                let diff = Math.abs((lon + time * 0.6) % (Math.PI * 2) - scanAngle);
                if (diff > Math.PI) diff = 2 * Math.PI - diff;
                const isNearScan = Math.exp(-(diff * diff) / 0.15) * Math.max(0, pt[2]);

                dots.push({
                    x: pt[0],
                    y: pt[1],
                    z: pt[2],
                    r: (0.7 + 1.1 * depth + 1.0 * isNearScan) * (size / 40),
                    white: 0.85 + 0.15 * isNearScan,
                    a: (0.25 + 0.75 * depth) * (0.35 + 0.65 * isNearScan)
                });
            }
        }

        dots.sort(function (a, b) { return a.z - b.z; });
        return dots;
    }

    /**
     * Create an interactive Thinking Orb attached to a canvas element.
     */
    function createThinkingOrb(canvas, options) {
        if (!canvas) return null;
        options = options || {};
        const state = options.state || 'working'; // 'working' (orbits) or 'searching' (globe)
        const size = options.size || 36;
        const isDark = options.isDark !== undefined ? options.isDark : true;
        const speed = options.speed || 1.2;

        const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        let animId = null;
        let isRunning = true;
        let currentState = state;

        function loop() {
            if (!isRunning) return;
            const t = (performance.now() / 1000) * speed;

            ctx.save();
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, size, size);

            let dots;
            if (currentState === 'searching') {
                dots = renderGlobe(size, t, options);
            } else {
                dots = renderOrbits(size, t, options);
            }

            paintDots(ctx, dots, isDark);
            ctx.restore();

            animId = requestAnimationFrame(loop);
        }

        loop();

        return {
            stop: function () {
                isRunning = false;
                if (animId) {
                    cancelAnimationFrame(animId);
                    animId = null;
                }
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            },
            setState: function (newState) {
                currentState = newState;
            },
            resize: function (newSize) {
                canvas.width = Math.round(newSize * dpr);
                canvas.height = Math.round(newSize * dpr);
                canvas.style.width = newSize + 'px';
                canvas.style.height = newSize + 'px';
            }
        };
    }

    return {
        createThinkingOrb: createThinkingOrb,
        renderOrbits: renderOrbits,
        renderGlobe: renderGlobe
    };
}));
