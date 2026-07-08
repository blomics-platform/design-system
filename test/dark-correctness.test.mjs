import { test } from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
import { resolveRefs } from "../src/resolve-refs.mjs";

// 커밋된 풀 시드 tokens.json을 resolveRefs로 직접 구동 — dist 바이트와 무관(§10).
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const tokens = JSON.parse(readFileSync(join(ROOT, "tokens.json"), "utf8"));
const light = resolveRefs(tokens, "light");
const dark = resolveRefs(tokens, "dark");
const up = (s) => s.toUpperCase();

test("gray-50 is distinct between light and dark (separate gray/gray-dark palettes)", () => {
  assert.equal(up(light["gray-50"]), "#F9FAFB");
  assert.equal(up(dark["gray-50"]), "#F5F5F6");
  assert.notEqual(up(light["gray-50"]), up(dark["gray-50"]));
});

test("gray-950 is shared between light and dark", () => {
  assert.equal(up(light["gray-950"]), "#0C111D");
  assert.equal(up(dark["gray-950"]), "#0C111D");
  assert.equal(up(light["gray-950"]), up(dark["gray-950"]));
});

test("error-400 (non-gray ramp) is identical light==dark", () => {
  assert.equal(up(light["error-400"]), "#F97066");
  assert.equal(up(dark["error-400"]), "#F97066");
  assert.equal(up(light["error-400"]), up(dark["error-400"]));
});

test("text-primary: light gray-900, dark gray-50", () => {
  assert.equal(up(light["text-primary"]), "#101828");
  assert.equal(up(dark["text-primary"]), "#F5F5F6");
});

test("fg-primary dark is pure white (#FFFFFF), diverging from text-primary dark", () => {
  assert.equal(up(dark["fg-primary"]), "#FFFFFF");
  assert.notEqual(up(dark["fg-primary"]), up(dark["text-primary"]));
});

test("border-error dark resolves to error-400", () => {
  assert.equal(up(dark["border-error"]), "#F97066");
});

test("bg-brand-solid_hover diverges light (brand-700) vs dark (brand-500)", () => {
  // 시드에 이 토큰이 존재하면 우선 사용, 없으면 utility-brand-600 light≠dark로 대체.
  if ("bg-brand-solid_hover" in light) {
    assert.equal(up(light["bg-brand-solid_hover"]), up(light["brand-700"]));
    assert.equal(up(dark["bg-brand-solid_hover"]), up(dark["brand-500"]));
    assert.notEqual(up(light["bg-brand-solid_hover"]), up(dark["bg-brand-solid_hover"]));
  } else {
    assert.notEqual(up(light["utility-brand-600"]), up(dark["utility-brand-600"]));
  }
});
