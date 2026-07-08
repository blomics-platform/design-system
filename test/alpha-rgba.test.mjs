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

test("alpha-white-10.light is rgba(255,255,255,0.1)", () => {
  assert.equal(up(light["alpha-white-10"]), "RGBA(255,255,255,0.1)");
});

test("alpha-black-50.light is rgba(0,0,0,0.5)", () => {
  assert.equal(up(light["alpha-black-50"]), "RGBA(0,0,0,0.5)");
});

test("alpha-white-40.dark is rgba(12,17,29,0.4) (gray-950 base)", () => {
  assert.equal(up(dark["alpha-white-40"]), "RGBA(12,17,29,0.4)");
});

test("*-100 alpha steps end with ,1) (fully opaque)", () => {
  assert.ok(light["alpha-white-100"].endsWith(",1)"), `alpha-white-100.light should end with ,1): ${light["alpha-white-100"]}`);
  assert.ok(light["alpha-black-100"].endsWith(",1)"), `alpha-black-100.light should end with ,1): ${light["alpha-black-100"]}`);
});
