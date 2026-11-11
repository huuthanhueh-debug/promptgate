// Vision 6D image analysis. Pure functions over RGBA pixel buffers: no DOM, no three.js, so the
// same code runs in the WebView and under Node tests.
//
// Both estimators are heuristics, not ML models. estimateDepth() fakes monocular depth from
// focus, position and brightness cues; detectPerson() looks for a skin-toned, upright subject.
// The UI always lets the user override the result.

function assertImage(rgba, w, h) {
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 2 || h < 2) throw new RangeError('image must be at least 2x2');
  if (!rgba || rgba.length < w * h * 4) throw new RangeError('rgba buffer is smaller than w*h*4');
}

export function luminance(rgba, w, h) {
  assertImage(rgba, w, h);
  const out = new Float32Array(w * h);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (0.2126 * rgba[p] + 0.7152 * rgba[p + 1] + 0.0722 * rgba[p + 2]) / 255;
  }
  return out;
}

// Separable box blur with clamped edges, radius r pixels. O(w*h) regardless of r.
export function boxBlur(src, w, h, r) {
  r = Math.max(0, Math.floor(r));
  if (r === 0) return Float32Array.from(src);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const pass = (from, to, len, lines, stride, lineStride) => {
    const win = 2 * r + 1;
    for (let l = 0; l < lines; l++) {
      const base = l * lineStride;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += from[base + Math.min(len - 1, Math.max(0, k)) * stride];
      for (let i = 0; i < len; i++) {
        to[base + i * stride] = sum / win;
        const add = Math.min(len - 1, i + r + 1);
        const sub = Math.max(0, i - r);
        sum += from[base + add * stride] - from[base + sub * stride];
      }
    }
  };
  pass(src, tmp, w, h, 1, w); // horizontal
  pass(tmp, out, h, w, w, 1); // vertical
  return out;
}

function normalize(a) {
  let lo = Infinity, hi = -Infinity;
  for (const v of a) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo;
  const out = new Float32Array(a.length);
  if (!(span > 1e-6)) return out.fill(0.5);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] - lo) / span;
  return out;
}

// Pseudo depth in 0..1 (1 = nearest the viewer), one value per pixel.
// Cues: sharp/detailed regions are usually the in-focus subject (near); the bottom of a photo is
// usually closer than the top; subjects sit near the centre; brighter areas pop forward a bit.
export function estimateDepth(rgba, w, h, opts) {
  assertImage(rgba, w, h);
  const o = Object.assign({ focus: 0.4, vertical: 0.25, center: 0.2, light: 0.15, smooth: 0.02 }, opts);
  const lum = luminance(rgba, w, h);
  const r = Math.max(1, Math.round(Math.max(w, h) * 0.03));
  const soft = boxBlur(lum, w, h, r);
  const detail = new Float32Array(w * h);
  for (let i = 0; i < detail.length; i++) detail[i] = Math.abs(lum[i] - soft[i]);
  const focus = normalize(boxBlur(detail, w, h, r * 2));
  const raw = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const cy = (v - 0.5) * 2;
    for (let x = 0; x < w; x++) {
      const cx = (x / (w - 1) - 0.5) * 2;
      const i = y * w + x;
      const center = Math.exp(-(cx * cx + cy * cy) * 1.2);
      raw[i] = o.focus * focus[i] + o.vertical * v + o.center * center + o.light * lum[i];
    }
  }
  const sr = Math.max(1, Math.round(Math.max(w, h) * o.smooth));
  return normalize(boxBlur(raw, w, h, sr));
}

// Which of n depth layers (0 = farthest) a depth value falls in. Used by the "tách lớp" view.
export function layerOf(d, n) {
  n = Math.max(1, Math.floor(n));
  if (!(d > 0)) return 0;
  return Math.min(n - 1, Math.floor(d * n));
}

// Skin test in YCbCr plus an RGB sanity rule. Inclusive across skin tones, but it also fires on
// wood, sand and warm lighting, which is why detectPerson() asks for more than skin alone.
export function isSkin(r, g, b) {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > 60 && r > b && Math.max(r, g, b) - Math.min(r, g, b) > 12;
}

function borderColor(rgba, w, h) {
  let r = 0, g = 0, b = 0, n = 0;
  const add = (x, y) => { const p = (y * w + x) * 4; r += rgba[p]; g += rgba[p + 1]; b += rgba[p + 2]; n++; };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, 1); }
  for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
  return [r / n, g / n, b / n];
}

const FULL_BOX = Object.freeze({ x0: 0.2, y0: 0.04, x1: 0.8, y1: 0.98 });

// Looks for a person. Returns { isPerson, score 0..1, skinRatio, bbox } with bbox normalised to
// 0..1 (y down, origin top-left). bbox is the subject's extent, or a centred default.
export function detectPerson(rgba, w, h) {
  assertImage(rgba, w, h);
  const bg = borderColor(rgba, w, h);
  let skin = 0, fg = 0;
  let sx0 = w, sy0 = h, sx1 = -1, sy1 = -1;
  const colFg = new Uint32Array(w), rowFg = new Uint32Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      const s = isSkin(r, g, b);
      if (s) { skin++; if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1) sy1 = y; }
      const dist = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
      if (s || dist > 90) { fg++; colFg[x]++; rowFg[y]++; }
    }
  }
  const total = w * h;
  const skinRatio = skin / total;
  // Subject extent: rows/columns where at least 8% of pixels are foreground (ignores speckle).
  const span = (counts, len, other) => {
    let a = -1, b = -1;
    for (let i = 0; i < len; i++) if (counts[i] / other >= 0.08) { if (a < 0) a = i; b = i; }
    return [a, b];
  };
  const [fx0, fx1] = span(colFg, w, h);
  const [fy0, fy1] = span(rowFg, h, w);
  const hasFg = fx0 >= 0 && fy0 >= 0 && fg / total < 0.92;
  const bbox = hasFg
    ? { x0: fx0 / w, y0: fy0 / h, x1: (fx1 + 1) / w, y1: (fy1 + 1) / h }
    : Object.assign({}, FULL_BOX);
  const bw = bbox.x1 - bbox.x0, bh = bbox.y1 - bbox.y0;

  const upright = hasFg && bh > bw * 1.05;
  let score = 0;
  if (skinRatio >= 0.015 && skinRatio <= 0.65) score += 0.4;
  if (upright) score += 0.25;
  if (hasFg && bh >= 0.35) score += 0.1; // fills a good part of the frame
  if (skin > 0 && hasFg) {
    // A face shows up as skin in the top third of the subject.
    const faceLimit = (bbox.y0 + bh / 3) * h;
    if (sy0 <= faceLimit) score += 0.25;
  }
  // Without an upright subject (sand, a wooden table, a close-up face filling the frame) the
  // skin cue alone is not trusted; the user can still switch to body mode by hand.
  score = Math.min(1, upright ? score : Math.min(score, 0.6));
  return { isPerson: score >= 0.65, score, skinRatio, bbox };
}
