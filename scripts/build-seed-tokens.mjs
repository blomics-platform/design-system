// docs/tokens_extracted.json (3-PDF 파싱 정본) -> tokens.json 시드 변환기.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveRefs } from "../src/resolve-refs.mjs";

// gray-950 light hex #0C111D = rgb(12,17,29) — 원천 단일화.
const gray950rgb = "12,17,29";

// 기본 brand 램프 = Untitled UI 기본 brand(violet) 정본 hex (25..950, light==dark). 유저는 scales.brand만 in-place 덮어쓴다.
const DEFAULT_BRAND_RAMP = { "25": "#FBFAFF", "50": "#F5F3FF", "100": "#ECE9FE", "200": "#DDD6FE", "300": "#C3B5FD", "400": "#A48AFB", "500": "#875BF7", "600": "#7839EE", "700": "#6927DA", "800": "#5720B7", "900": "#491C96", "950": "#2E125E" };

export function toRef(raw) {
  if (raw === "white") return "{base.white}";
  if (raw === "black") return "{base.black}";
  if (raw === "text-white") return "#FFFFFF";
  const m = String(raw).match(/^(.+)-(\d{2,3})$/);
  if (m) return `{scales.${m[1]}.${m[2]}}`;
  throw new Error(`toRef: cannot normalize value "${raw}"`);
}

export function alphaVal(raw) {
  const [c, p] = raw.split(" ");
  const n = Number(p.slice(0, -1)); // % 먼저 제거 (Number("100%")는 NaN)
  const a = n === 100 ? "1" : (n / 100).toString();
  if (c === "white") return `rgba(255,255,255,${a})`;
  if (c === "black") return `rgba(0,0,0,${a})`;
  return `rgba(${gray950rgb},${a})`;
}

export function buildSeedTokens(extracted, opts = {}) {
  const { primitives, base_colors, semantic, utility, alpha } = extracted;
  const brandRamp = opts.brandRamp || DEFAULT_BRAND_RAMP;
  const scales = {};
  scales.gray = {};
  for (const s of Object.keys(primitives.gray)) scales.gray[s] = { light: primitives.gray[s], dark: primitives["gray-dark"][s] };
  for (const [ramp, steps] of Object.entries(primitives)) { if (ramp === "gray" || ramp === "gray-dark") continue; scales[ramp] = {}; for (const s of Object.keys(steps)) scales[ramp][s] = { light: steps[s], dark: steps[s] }; }
  scales.brand = {};
  for (const s of Object.keys(brandRamp)) scales.brand[s] = { light: brandRamp[s], dark: brandRamp[s] };
  const base = {};
  base.white = { light: base_colors.white, dark: base_colors.white };
  base.black = { light: base_colors.black, dark: base_colors.black };
  base["text-white"] = { light: "#FFFFFF", dark: "#FFFFFF" };
  for (const s of semantic) { if (s.name === "text-white") continue; base[s.name] = { light: toRef(s.light), dark: toRef(s.dark) }; }
  for (const u of utility) base[u.name] = { light: toRef(u.light), dark: toRef(u.dark) };
  for (const a of alpha) base[a.name] = { light: alphaVal(a.light), dark: alphaVal(a.dark) };
  return { scales, semantic: {}, base };
}

function writeStable(path, obj) { writeFileSync(path, JSON.stringify(obj, null, 2) + "\n"); }
function selfCheck(tokens) {
  const nS = Object.keys(tokens.scales).length, nB = Object.keys(tokens.base).length;
  if (nS !== 29) throw new Error(`selfCheck: expected 29 scales, got ${nS}`);
  if (nB !== 240) throw new Error(`selfCheck: expected 240 base, got ${nB}`);
  if (Object.keys(tokens.semantic).length !== 0) throw new Error(`selfCheck: semantic must be {}`);
  for (const [r, steps] of Object.entries(tokens.scales)) if (Object.keys(steps).length !== 12) throw new Error(`selfCheck: ramp ${r} has ${Object.keys(steps).length} steps, expected 12`);
  const L = resolveRefs(tokens, "light"), D = resolveRefs(tokens, "dark");
  if (Object.keys(L).length !== Object.keys(D).length) throw new Error("selfCheck: light/dark key count mismatch");
  return { light: Object.keys(L).length, dark: Object.keys(D).length };
}
function main() {
  const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = dirname(HERE);
  const extracted = JSON.parse(readFileSync(join(ROOT, "docs/tokens_extracted.json"), "utf8"));
  const tokens = buildSeedTokens(extracted);
  const stats = selfCheck(tokens);
  writeStable(join(ROOT, "tokens.json"), tokens);
  process.stdout.write(`seed OK: scales=${Object.keys(tokens.scales).length} base=${Object.keys(tokens.base).length} resolved(light=${stats.light}, dark=${stats.dark}) -> tokens.json\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
