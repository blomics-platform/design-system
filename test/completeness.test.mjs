import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 풀 시드 `dist/theme.css`에 대한 이름기반 완전성 게이트(build-verify 그룹).
// 이 파일은 Task 39(전체 빌드)로 dist가 신모델로 재생성돼야 GREEN이 된다 — 그 전까지는 정직한 RED.

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CSS = readFileSync(join(ROOT, "dist", "theme.css"), "utf8");
const NAMES = JSON.parse(readFileSync(join(HERE, "fixtures", "utility-names.json"), "utf8"));

// brace-balanced 블록 추출: `selector {` 뒤 첫 여는 중괄호부터 매칭되는 닫는 중괄호까지.
function extractBlock(css, selectorRe, fromIndex = 0) {
  const m = selectorRe.exec(css.slice(fromIndex));
  if (!m) return null;
  const openAt = fromIndex + m.index + m[0].length - 1; // m[0] ends with "{"
  let depth = 0;
  for (let i = openAt; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") { depth--; if (depth === 0) return { body: css.slice(openAt + 1, i), endIndex: i + 1 }; }
  }
  throw new Error("unbalanced braces for " + selectorRe);
}

function extractAllBlocks(css, selectorRe) {
  const blocks = [];
  let idx = 0;
  while (true) {
    const found = extractBlock(css, selectorRe, idx);
    if (!found) break;
    blocks.push(found.body);
    idx = found.endIndex;
  }
  return blocks;
}

function varNamesIn(body) {
  const names = new Set();
  const re = /--color-([a-zA-Z0-9_-]+)\s*:/g;
  let m;
  while ((m = re.exec(body))) names.add(m[1]);
  return names;
}

// @theme 블록(들) 전부 합쳐서 프리미티브 var 집합
const themeBlocks = extractAllBlocks(CSS, /@theme\s*\{/);
const themeVars = new Set();
for (const b of themeBlocks) for (const n of varNamesIn(b)) themeVars.add(n);

// :root 블록(들) 전부 합쳐서 역할/유틸/alpha var 집합 (light 해석값)
const rootBlocks = extractAllBlocks(CSS, /:root\s*\{/);
const rootVars = new Set();
for (const b of rootBlocks) for (const n of varNamesIn(b)) rootVars.add(n);

// @utility 규칙 이름 집합 (라인 시작 `@utility <name> {`)
const utilityNames = new Set();
{
  const re = /^@utility\s+([a-zA-Z0-9_-]+)\s*\{/gm;
  let m;
  while ((m = re.exec(CSS))) utilityNames.add(m[1]);
}

test("@theme has exactly 350 primitive vars (29 ramps x 12 steps + white/black; brand IN, gray-dark OUT)", () => {
  // 350 = 28 * 12 (non-brand ramps, actually 29 total incl. brand) — 산술: 29 ramps * 12 steps = 348 + white/black 2 = 350.
  assert.equal(themeVars.size, 350, `@theme var count mismatch: got ${themeVars.size}`);
  assert.ok(themeVars.has("white"), "@theme must include --color-white");
  assert.ok(themeVars.has("black"), "@theme must include --color-black");
  assert.ok(themeVars.has("brand-500"), "@theme must include brand ramp steps (brand IN)");
  assert.ok(themeVars.has("brand-950"), "@theme must include brand-950");
  assert.ok(!themeVars.has("gray-dark-50"), "@theme must NOT include a separate gray-dark ramp (gray-dark OUT — dark values live in gray's dark field, not a distinct @theme ramp)");
});

test(":root has exactly 238 role/utility/alpha vars (84 semantic + 134 utility + 20 alpha)", () => {
  // 238 = 84 (role: text21+bg31+border10+fg22=84) + 134 (utility) + 20 (alpha)
  assert.equal(rootVars.size, 238, `:root var count mismatch: got ${rootVars.size}`);
});

test(":root prefix counts match fixture — text 21, bg 31, border 10, fg 22", () => {
  const countPrefix = (prefix) => [...rootVars].filter((n) => n.startsWith(prefix)).length;
  assert.equal(countPrefix("text-"), NAMES.role.text.length, "text- count");
  assert.equal(countPrefix("bg-"), NAMES.role.bg.length, "bg- count");
  assert.equal(countPrefix("border-"), NAMES.role.border.length, "border- count");
  assert.equal(countPrefix("fg-"), NAMES.role.fg.length, "fg- count");
  assert.equal(NAMES.role.text.length, 21);
  assert.equal(NAMES.role.bg.length, 31);
  assert.equal(NAMES.role.border.length, 10);
  assert.equal(NAMES.role.fg.length, 22);
});

test(":root includes --color-text-white var (var exists even though @utility is skipped)", () => {
  assert.ok(rootVars.has("text-white"), "--color-text-white must be present in :root");
});

test("@utility rule set equals fixture-derived 391 names; text-white absent", () => {
  // 391 = 83 (role, text-white excluded from 84) + 134*2 (utility bg-/text-) + 20*2 (alpha bg-/text-)
  const expected = new Set();
  for (const group of [NAMES.role.text, NAMES.role.bg, NAMES.role.border, NAMES.role.fg]) {
    for (const name of group) {
      if (NAMES.roleUtilityExcluded.includes(name)) continue; // text-white excluded
      expected.add(name);
    }
  }
  for (const name of NAMES.utility) { expected.add("bg-" + name); expected.add("text-" + name); }
  for (const name of NAMES.alpha) { expected.add("bg-" + name); expected.add("text-" + name); }

  assert.equal(expected.size, 391, `fixture-derived expected @utility count mismatch: got ${expected.size}`);
  assert.equal(utilityNames.size, 391, `@utility rule count mismatch: got ${utilityNames.size}`);

  const missing = [...expected].filter((n) => !utilityNames.has(n));
  const extra = [...utilityNames].filter((n) => !expected.has(n));
  assert.deepEqual(missing, [], `@utility missing names: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `@utility unexpected extra names: ${extra.join(", ")}`);

  assert.ok(!utilityNames.has("text-white"), "@utility text-white must NOT be emitted (collides with primitive white utility)");
});

test("role-utility name stems are disjoint from primitive ramp stems (text-white whitelisted exception)", () => {
  // 프리미티브 stem: <ramp>-<step> 형태(및 white/black)의 stem 집합.
  const primitiveStems = new Set(themeVars);
  const roleUtilNames = [...utilityNames]; // 이미 text-white 제외된 391개 집합
  const collisions = roleUtilNames.filter((n) => primitiveStems.has(n));
  assert.deepEqual(collisions, [], `role/utility @utility names must not collide with primitive stems: ${collisions.join(", ")}`);
});
