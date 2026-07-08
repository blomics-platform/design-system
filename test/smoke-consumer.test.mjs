import { test } from "node:test"; import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, cpSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os"; import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";

// Tailwind v4 컴파일 출력을 실제로 검증하는 스모크 게이트(§11.6/§7.1(b)/§8.3).
// `@tailwindcss/cli`가 리졸브되지 않으면(피어 미설치) 전부 skip — CI에 tailwind가 없어도 스위트는 fail 0을 유지한다.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_FILES = ["theme.css", "tokens.ts", "tokens.d.ts", "tokens.manifest.json"];
const req = createRequire(import.meta.url);
function tailwindCli() { try { return req.resolve("@tailwindcss/cli"); } catch { return null; } }
const CLI = tailwindCli();
const skipOpt = { skip: CLI ? false : "tailwindcss CLI not resolvable (peer dep not installed)" };

function compile(classesHtml) {
  const dir = mkdtempSync(join(tmpdir(), "ds-smoke-"));
  mkdirSync(join(dir, "pkg", "dist"), { recursive: true });
  for (const f of DIST_FILES) cpSync(join(ROOT, "dist", f), join(dir, "pkg", "dist", f));
  writeFileSync(join(dir, "app.html"), `<div class="${classesHtml}"></div>`);
  writeFileSync(
    join(dir, "in.css"),
    `@import "tailwindcss";\n@import "./pkg/dist/theme.css";\n@source "./app.html";\n@source "./pkg/dist/**/*.ts";\n`,
  );
  execFileSync(process.execPath, [CLI, "-i", join(dir, "in.css"), "-o", join(dir, "out.css")], { cwd: dir });
  return readFileSync(join(dir, "out.css"), "utf8");
}

test("§7.1(b): dark bg-gray-900 actually paints #161B26 (primitive dark override fallback gate)", skipOpt, () => {
  const out = compile("bg-gray-900");
  // 다크 셀렉터 스코프 안에서 background-color가 #161B26(대소문자 무관)으로 실제 칠해지는지 확인.
  const darkBlockRe = /\[data-gnb-theme=(?:"|&quot;)?dark(?:"|&quot;)?\][^{]*\{([^}]*)\}/gi;
  let found = false;
  let m;
  while ((m = darkBlockRe.exec(out))) {
    if (/background-color:\s*#161b26/i.test(m[1])) { found = true; break; }
  }
  assert.ok(found, `expected a [data-gnb-theme=dark] rule painting background-color:#161B26 for bg-gray-900.\n--- compiled output ---\n${out}`);
});

test("§7.1: bg-brand-500/50 compiles to color-mix(...) over var(--color-brand-500)", skipOpt, () => {
  const out = compile("bg-brand-500/50");
  assert.match(out, /color-mix\([^)]*var\(--color-brand-500\)[^)]*50%[^)]*\)/i, `expected color-mix referencing --color-brand-500 at 50%.\n--- compiled output ---\n${out}`);
});

test("§8.3: `_` containing @utility names compile to real rules (text-secondary_on-brand, bg-brand-solid_hover, text-utility-brand-600_alt)", skipOpt, () => {
  const out = compile("text-secondary_on-brand bg-brand-solid_hover text-utility-brand-600_alt");
  assert.match(out, /\.text-secondary_on-brand\s*\{[^}]*color:/i, `expected .text-secondary_on-brand rule with color.\n--- compiled output ---\n${out}`);
  assert.match(out, /\.bg-brand-solid_hover\s*\{[^}]*background-color:/i, `expected .bg-brand-solid_hover rule with background-color.\n--- compiled output ---\n${out}`);
  assert.match(out, /\.text-utility-brand-600_alt\s*\{[^}]*color:/i, `expected .text-utility-brand-600_alt rule with color.\n--- compiled output ---\n${out}`);
});

test("§7.3: static @utility opacity modifier is dropped — text-primary/40 generates no rule", skipOpt, () => {
  const out = compile("text-primary/40");
  assert.ok(!/\.text-primary\\\/40\s*\{/.test(out) && !out.includes("text-primary/40"), `expected NO rule for text-primary/40 (static @utility opacity should be dropped).\n--- compiled output ---\n${out}`);
});

test("role utilities generate correct CSS properties: bg-brand-solid/text-primary/border-error+border/fg-brand-primary", skipOpt, () => {
  const out = compile("bg-brand-solid text-primary border-error border fg-brand-primary");
  assert.match(out, /\.bg-brand-solid\s*\{[^}]*background-color:/i, "bg-brand-solid -> background-color");
  assert.match(out, /\.text-primary\s*\{[^}]*color:/i, "text-primary -> color");
  assert.match(out, /\.border-error\s*\{[^}]*border-color:/i, "border-error -> border-color");
  assert.match(out, /\.border\s*\{[^}]*border-width:/i, "border (width utility) -> border-width");
  assert.match(out, /\.fg-brand-primary\s*\{[^}]*color:/i, "fg-brand-primary -> color");
});
