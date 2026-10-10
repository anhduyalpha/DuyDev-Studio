/**
 * AdminVisualizers.js - Zero-Dependency SVG Gauges & 2D Canvas Visualizers
 * High-density Linear/Vercel aesthetic with native high-DPI rendering
 */

/**
 * Generates an SVG circular gauge
 * @param {number} percent 0-100
 * @param {string} label Small caption below gauge
 * @param {string} valueText Formatted value text (e.g. "42%" or "1.2 GB")
 * @param {string} colorScheme 'emerald' | 'amber' | 'rose' | 'cyan' | 'orange'
 * @param {number} size Diameter in pixels
 */
export function renderSvgGauge(percent, label, valueText, colorScheme = 'emerald', size = 110) {
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  const radius = 42;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  let strokeColor = '#10b981'; // emerald
  let glowColor = 'rgba(16, 185, 129, 0.2)';

  if (colorScheme === 'orange') {
    strokeColor = '#f97316';
    glowColor = 'rgba(249, 115, 22, 0.25)';
  } else if (colorScheme === 'cyan') {
    strokeColor = '#06b6d4';
    glowColor = 'rgba(6, 182, 212, 0.25)';
  } else if (colorScheme === 'amber' || (colorScheme === 'auto' && clamped >= 65 && clamped < 85)) {
    strokeColor = '#f59e0b';
    glowColor = 'rgba(245, 158, 11, 0.25)';
  } else if (colorScheme === 'rose' || (colorScheme === 'auto' && clamped >= 85)) {
    strokeColor = '#ef4444';
    glowColor = 'rgba(239, 68, 68, 0.25)';
  }

  return `
    <div class="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-900/60 border border-white/5 relative">
      <div class="relative w-[${size}px] h-[${size}px] flex items-center justify-center">
        <svg class="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
          <!-- Background track -->
          <circle
            cx="50"
            cy="50"
            r="${radius}"
            fill="transparent"
            stroke="currentColor"
            stroke-width="${strokeWidth}"
            class="text-zinc-800/80"
          />
          <!-- Progress stroke -->
          <circle
            cx="50"
            cy="50"
            r="${radius}"
            fill="transparent"
            stroke="${strokeColor}"
            stroke-width="${strokeWidth}"
            stroke-linecap="round"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${strokeDashoffset}"
            style="filter: drop-shadow(0 0 6px ${glowColor}); transition: stroke-dashoffset 0.5s ease-out;"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
          <span class="text-lg font-bold text-zinc-100 font-mono tracking-tight">${valueText || `${Math.round(clamped)}%`}</span>
        </div>
      </div>
      <span class="mt-1 text-[11px] font-medium text-zinc-400 uppercase tracking-wider">${label}</span>
    </div>
  `;
}

/**
 * Draws a smooth sparkline on an HTML5 Canvas element
 * @param {HTMLCanvasElement} canvas 
 * @param {Array<number>} dataPoints 
 * @param {Object} options
 */
export function drawSparklineCanvas(canvas, dataPoints = [], options = {}) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.width || 300;
  const height = rect.height || canvas.height || 80;

  // Set internal resolution for high-DPI screens
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  if (!dataPoints || dataPoints.length < 2) {
    // Empty state line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const strokeColor = options.strokeColor || '#f97316';
  const fillColorTop = options.fillColorTop || 'rgba(249, 115, 22, 0.2)';
  const fillColorBottom = options.fillColorBottom || 'rgba(249, 115, 22, 0.0)';

  const minVal = 0;
  let maxVal = Math.max(...dataPoints, 1);
  if (options.maxVal && options.maxVal > maxVal) maxVal = options.maxVal;

  const paddingY = 8;
  const drawHeight = height - paddingY * 2;
  const stepX = width / (dataPoints.length - 1);

  // Compute points
  const points = dataPoints.map((val, idx) => {
    const x = idx * stepX;
    const norm = (val - minVal) / (maxVal - minVal);
    const y = height - paddingY - norm * drawHeight;
    return { x, y };
  });

  // 1. Draw subtle horizontal grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const gy = height - (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }

  // 2. Draw smooth filled area
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y);
  }

  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, fillColorTop);
  gradient.addColorStop(1, fillColorBottom);
  ctx.fillStyle = gradient;
  ctx.fill();

  // 3. Draw smooth curve stroke
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const mx = (p0.x + p1.x) / 2;
    ctx.bezierCurveTo(mx, p0.y, mx, p1.y, p1.x, p1.y);
  }

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 4. Draw latest data point pulse dot
  const lastPoint = points[points.length - 1];
  ctx.fillStyle = strokeColor;
  ctx.beginPath();
  ctx.arc(lastPoint.x, lastPoint.y, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
