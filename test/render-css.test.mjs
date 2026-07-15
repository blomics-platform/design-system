import { test } from "node:test"; import assert from "node:assert/strict";
import { renderCss } from "../src/render-css.mjs";
import { resolvedLight, resolvedDark, config, sourceHash } from "./helpers/render-css-inputs.mjs";

// --- brace-matching block slicer: returns body text of `<opener> { ... }` from a start index ---
function block(css, opener, from = 0) {
  const start = css.indexOf(opener, from);
  if (start === -1) return null;
  const braceOpen = css.indexOf("{", start);
  let depth = 0, i = braceOpen;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") { depth--; if (depth === 0) break; }
  }
  return { start, braceOpen, braceClose: i, body: css.slice(braceOpen + 1, i) };
}
// role/util/alpha :root block is the FIRST ":root {" ; there is no second one.
function rootBlock(css) { return block(css, ":root {"); }
// @theme block
function themeBlock(css) { return block(css, "@theme {"); }
// primitive [dark] block is the FIRST darkSelector block (right after @theme).
function primDarkBlock(css) { return block(css, config.darkSelector + " {"); }
// role/util/alpha [dark] block is the SECOND darkSelector block (right after :root).
function roleDarkBlock(css) {
  const first = block(css, config.darkSelector + " {");
  return block(css, config.darkSelector + " {", first.braceClose + 1);
}
const varNames = (body) => new Set([...body.matchAll(/--color-[a-z0-9-]+(?=\s*:)/g)].map((m) => m[0]));

// (1) header + @custom-variant, no ISO timestamp, determinism
test("(1) header + @custom-variant line, no timestamp, deterministic", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  assert.ok(css.startsWith("/* AUTO-GENERATED"));
  assert.ok(css.includes("Source hash: " + sourceHash + "."));
  const expected = '@custom-variant dark (&:where([data-gnb-theme="dark"], [data-gnb-theme="dark"] *));';
  assert.ok(css.includes(expected), "@custom-variant derived from darkSelector");
  assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(css), "no ISO timestamp");
  assert.equal(css, renderCss(resolvedLight, resolvedDark, config, sourceHash), "byte-identical across calls");
});

// (2) @theme contains ONLY primitive steps + white/black — NO role/util/alpha vars
test("(2) @theme = primitive steps + white/black only, no role/util/alpha", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  const names = varNames(themeBlock(css).body);
  for (const k of ["gray-50", "gray-900", "gray-950", "brand-500", "brand-600", "error-300", "error-400", "white", "black"]) {
    assert.ok(names.has("--color-" + k), `@theme has --color-${k}`);
  }
  for (const k of ["text-primary", "text-white", "fg-primary", "border-error", "bg-brand-solid", "utility-brand-600", "alpha-black-50"]) {
    assert.ok(!names.has("--color-" + k), `@theme must NOT have --color-${k}`);
  }
});

// (3) @theme order = ramp-insertion then step-ascending
test("(3) @theme order = ramp-insertion then step-ascending", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  const body = themeBlock(css).body;
  const order = ["gray-50", "gray-900", "gray-950", "brand-500", "brand-600", "error-300", "error-400", "white", "black"];
  let prev = -1;
  for (const k of order) {
    const at = body.indexOf("--color-" + k + ":");
    assert.ok(at !== -1, `--color-${k} present`);
    assert.ok(at > prev, `--color-${k} after previous (${k})`);
    prev = at;
  }
});

// (4) primitive [dark] block = only gray steps where dark != light (NOT gray-950, NOT non-gray)
test("(4) primitive [dark] = dark-diverging primitives only", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  const names = varNames(primDarkBlock(css).body);
  assert.ok(names.has("--color-gray-50"), "gray-50 diverges");
  assert.ok(names.has("--color-gray-900"), "gray-900 diverges");
  assert.ok(!names.has("--color-gray-950"), "gray-950 same → omitted");
  for (const k of ["brand-500", "brand-600", "error-300", "error-400", "white", "black"]) {
    assert.ok(!names.has("--color-" + k), `${k} same → omitted from primitive [dark]`);
  }
  assert.ok(primDarkBlock(css).body.includes("--color-gray-900: #161b26;"), "gray-900 dark value");
});

// (5) :root contains role/util/alpha (incl --color-text-white), NO primitive steps
test("(5) :root = role/util/alpha incl --color-text-white, no primitives", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  const names = varNames(rootBlock(css).body);
  for (const k of ["text-primary", "text-white", "fg-primary", "border-error", "bg-brand-solid", "utility-brand-600", "alpha-black-50"]) {
    assert.ok(names.has("--color-" + k), `:root has --color-${k}`);
  }
  assert.ok(names.has("--color-text-white"), ":root MUST have --color-text-white");
  for (const k of ["gray-50", "gray-900", "gray-950", "brand-500", "brand-600", "error-300", "white", "black"]) {
    assert.ok(!names.has("--color-" + k), `:root must NOT have primitive --color-${k}`);
  }
});

// (6) role/util/alpha [dark] = only dark != light deltas
test("(6) role/util/alpha [dark] = deltas only", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  const names = varNames(roleDarkBlock(css).body);
  for (const k of ["text-primary", "fg-primary", "border-error", "utility-brand-600", "alpha-black-50"]) {
    assert.ok(names.has("--color-" + k), `role [dark] has diverging --color-${k}`);
  }
  assert.ok(!names.has("--color-text-white"), "text-white same → omitted");
  assert.ok(!names.has("--color-bg-brand-solid"), "bg-brand-solid same → omitted");
  assert.ok(roleDarkBlock(css).body.includes("--color-fg-primary: #ffffff;"), "fg-primary dark value");
  assert.ok(roleDarkBlock(css).body.includes("--color-alpha-black-50: rgba(255,255,255,0.5);"), "alpha dark value");
});

// (7) @utility pass: role prefix -> property; utility-*/alpha-* emit BOTH bg- and text-
test("(7) @utility prefix->property; utility/alpha get bg- and text-", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  const has = (re) => assert.ok(re.test(css), re.toString());
  has(/@utility\s+text-primary\s*\{\s*color:\s*var\(--color-text-primary\)\s*;\s*\}/);
  has(/@utility\s+fg-primary\s*\{\s*color:\s*var\(--color-fg-primary\)\s*;\s*\}/);
  has(/@utility\s+border-error\s*\{\s*border-color:\s*var\(--color-border-error\)\s*;\s*\}/);
  has(/@utility\s+bg-brand-solid\s*\{\s*background-color:\s*var\(--color-bg-brand-solid\)\s*;\s*\}/);
  // utility-* both
  has(/@utility\s+bg-utility-brand-600\s*\{\s*background-color:\s*var\(--color-utility-brand-600\)\s*;\s*\}/);
  has(/@utility\s+text-utility-brand-600\s*\{\s*color:\s*var\(--color-utility-brand-600\)\s*;\s*\}/);
  // alpha-* both
  has(/@utility\s+bg-alpha-black-50\s*\{\s*background-color:\s*var\(--color-alpha-black-50\)\s*;\s*\}/);
  has(/@utility\s+text-alpha-black-50\s*\{\s*color:\s*var\(--color-alpha-black-50\)\s*;\s*\}/);
});

// (7c) utility-*/alpha-* ALSO emit border-*: 배지처럼 tint 배경 + 같은 계열 보더를 쓰는 조합이
// 흔한데, border-utility-* 가 없어서 소비자가 border-[var(--color-utility-*)] arbitrary 로
// 우회하고 있었다. bg-/text- 와 대칭이 되도록 border- 도 낸다.
test("(7c) utility/alpha also emit border-*", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  const has = (re) => assert.ok(re.test(css), re.toString());
  has(/@utility\s+border-utility-brand-600\s*\{\s*border-color:\s*var\(--color-utility-brand-600\)\s*;\s*\}/);
  has(/@utility\s+border-alpha-black-50\s*\{\s*border-color:\s*var\(--color-alpha-black-50\)\s*;\s*\}/);
});

// (7b) border-* roles ALSO emit divide-* so `divide-y divide-<role>` colors the divider.
// Tailwind의 divide-y/x 는 자식(:not(:last-child))에 보더 '폭'만 준다. 색은 divide-<color>
// 유틸이 주는데, 역할 토큰엔 그게 없어서 지금까지 currentColor 로 폴백했다(다크에서 흰 줄).
// 따라서 divide-* 는 컨테이너가 아니라 '자식'을 칠해야 한다.
test("(7b) border-* roles also emit divide-* targeting children", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  has_divide: {
    const re = /@utility\s+divide-error\s*\{\s*&\s*>\s*:not\(:last-child\)\s*\{\s*border-color:\s*var\(--color-border-error\)\s*;\s*\}\s*\}/;
    assert.ok(re.test(css), `divide-error must color children: ${re}`);
  }
  // 역할이 아닌 것에서는 divide-* 를 만들지 않는다(divide 는 보더 색 개념이라 border-* 만 대상).
  assert.ok(!/@utility\s+divide-primary\b/.test(css), "text-primary must not produce divide-primary");
  assert.ok(!/@utility\s+divide-brand-solid\b/.test(css), "bg-brand-solid must not produce divide-brand-solid");
  assert.ok(!/@utility\s+divide-utility-brand-600\b/.test(css), "utility-* must not produce divide-*");
});

// (8) NO @utility text-white, but --color-text-white var IS present
test("(8) no @utility text-white, but --color-text-white var present", () => {
  const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
  assert.ok(!/@utility\s+text-white\b/.test(css), "@utility text-white must be skipped (whitelisted)");
  assert.ok(css.includes("--color-text-white: #ffffff;"), "--color-text-white var present");
});
