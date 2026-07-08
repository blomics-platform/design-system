// Representative NEW-model resolveRefs output: FLAT map { "<key>": "<hex-or-rgba>" }.
// Insertion order mimics resolveRefs: primitives (grouped by ramp, ascending step),
// then anchors (white/black), then role (text-*/bg-*/border-*/fg-*), then utility-*, then alpha-*.
// Only dark-diverging keys differ between light and dark.
export const resolvedLight = {
  // primitives — gray ramp
  "gray-50": "#f9fafb", "gray-900": "#101828", "gray-950": "#0c111d",
  // primitives — brand ramp (light==dark)
  "brand-500": "#7f56d9", "brand-600": "#6941c6",
  // primitives — error ramp (light==dark)
  "error-300": "#fda29b", "error-400": "#f97066",
  // anchors
  "white": "#ffffff", "black": "#000000",
  // role
  "text-primary": "#101828", "text-white": "#ffffff",
  "fg-primary": "#101828",
  "border-error": "#fda29b",
  "bg-brand-solid": "#6941c6",
  // utility
  "utility-brand-600": "#6941c6",
  // alpha
  "alpha-black-50": "rgba(0,0,0,0.5)"
};
export const resolvedDark = {
  // primitives — gray ramp (gray-50/gray-900 diverge; gray-950 light==dark)
  "gray-50": "#f5f5f6", "gray-900": "#161b26", "gray-950": "#0c111d",
  // primitives — brand ramp (light==dark)
  "brand-500": "#7f56d9", "brand-600": "#6941c6",
  // primitives — error ramp (light==dark)
  "error-300": "#fda29b", "error-400": "#f97066",
  // anchors (light==dark)
  "white": "#ffffff", "black": "#000000",
  // role (text-primary/fg-primary/border-error diverge; bg-brand-solid/text-white light==dark)
  "text-primary": "#f5f5f6", "text-white": "#ffffff",
  "fg-primary": "#ffffff",
  "border-error": "#f97066",
  "bg-brand-solid": "#6941c6",
  // utility (diverges)
  "utility-brand-600": "#7f56d9",
  // alpha (diverges)
  "alpha-black-50": "rgba(255,255,255,0.5)"
};
export const config = { classPrefix: "", darkSelector: '[data-gnb-theme="dark"]', darkVariantName: "dark", scaleOutput: "hex", output: { css: "dist/tokens.css", ts: "dist/tokens.ts", dts: "dist/tokens.d.ts", manifest: "dist/tokens.manifest.json" } };
export const sourceHash = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
