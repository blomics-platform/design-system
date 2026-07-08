// sRGB(0..255 hex) ↔ OKLCH. 표준 공개 매트릭스, 결정론.
function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function linearToSrgb(c) { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255); }
export function hexToOklch(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) throw new Error(`bad hex: ${hex}`);
  const n = parseInt(m[1], 16), r = srgbToLinear((n >> 16) & 255), g = srgbToLinear((n >> 8) & 255), b = srgbToLinear(n & 255);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.hypot(a, bb); let H = Math.atan2(bb, a) * 180 / Math.PI; if (H < 0) H += 360;
  return { L, C, H };
}
export function oklchToHex(L, C, H) {
  const hr = H * Math.PI / 180, a = C * Math.cos(hr), bb = C * Math.sin(hr);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  const r = linearToSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_);
  const g = linearToSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_);
  const b = linearToSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function formatOklch(L, C, H) {
  const f = (x, d) => Number(x.toFixed(d)).toString();
  return `oklch(${f(L, 4)} ${f(C, 4)} ${f(H, 2)})`;
}
const L_LADDER = { 25:0.985, 50:0.970, 100:0.940, 200:0.885, 300:0.805, 400:0.715, 500:0.640, 600:0.575, 700:0.505, 800:0.430, 900:0.355 };
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function rampFor(baseHex, anchor, scaleOutput) {
  const { L: bL, C: bC, H } = hexToOklch(baseHex);
  const dL = bL - L_LADDER[anchor ?? 600];
  const out = {};
  for (const step of Object.keys(L_LADDER)) {
    const L = clamp01(L_LADDER[step] + dL);
    const C = L >= 0.9 ? bC * (1 - L) / 0.1 : bC;
    out[step] = scaleOutput === "hex" ? oklchToHex(L, C, H) : formatOklch(L, C, H);
  }
  return out;
}
export function expandScales(rawTokens, config) {
  if (!rawTokens.scales) return rawTokens;
  const scaleOutput = (config && config.scaleOutput) || "oklch";
  const autoMirror = Boolean(rawTokens.meta && rawTokens.meta.autoMirrorDark);
  const scales = {};
  for (const [color, ramp] of Object.entries(rawTokens.scales)) {
    if (!ramp || !("$generate" in ramp)) { scales[color] = ramp; continue; }
    const { base, anchor } = ramp.$generate;
    const lightRamp = rampFor(base.light, anchor, scaleOutput);
    const darkSrc = base.dark ?? (autoMirror ? base.light : undefined);
    const darkRamp = darkSrc ? rampFor(darkSrc, anchor, scaleOutput) : null;
    const expanded = {};
    for (const step of Object.keys(L_LADDER)) {
      expanded[step] = { light: lightRamp[step], ...(darkRamp ? { dark: darkRamp[step] } : {}) };
    }
    scales[color] = expanded;
  }
  return { ...rawTokens, scales };
}
