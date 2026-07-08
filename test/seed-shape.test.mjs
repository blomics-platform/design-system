import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveRefs } from "../src/resolve-refs.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const tokens = JSON.parse(readFileSync(join(ROOT, "tokens.json"), "utf8"));

test("seed-shape: 29 scales, each with exactly 12 steps", () => {
  const ramps = Object.keys(tokens.scales);
  assert.equal(ramps.length, 29);
  for (const ramp of ramps) assert.equal(Object.keys(tokens.scales[ramp]).length, 12, `scales.${ramp} must have 12 steps`);
});

test("seed-shape: gray-dark is absorbed (not its own scale), brand is present", () => {
  assert.equal(tokens.scales["gray-dark"], undefined);
  assert.ok(tokens.scales.brand, "brand scale must be present");
});

test("seed-shape: 240 base entries, semantic is {}", () => {
  assert.equal(Object.keys(tokens.base).length, 240);
  assert.deepEqual(tokens.semantic, {});
});

test("seed-shape: gray ramp is distinct light/dark (50 distinct), 950 shared", () => {
  assert.notEqual(tokens.scales.gray["50"].light, tokens.scales.gray["50"].dark);
  assert.equal(tokens.scales.gray["950"].light, tokens.scales.gray["950"].dark);
});

test("seed-shape: brand ramp has all steps 50..950", () => {
  for (const step of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]) {
    assert.ok(tokens.scales.brand[step], `brand.${step} must exist`);
  }
});

test("seed-shape: resolveRefs both modes resolve 588 keys with no throw", () => {
  const L = resolveRefs(tokens, "light");
  const D = resolveRefs(tokens, "dark");
  assert.equal(Object.keys(L).length, 588);
  assert.equal(Object.keys(D).length, 588);
});

test("seed-shape: resolveRefs spot values (text-primary, fg-primary, border-error)", () => {
  const L = resolveRefs(tokens, "light");
  const D = resolveRefs(tokens, "dark");
  assert.equal(L["text-primary"], "#101828");
  assert.equal(D["text-primary"], "#F5F5F6");
  assert.equal(D["fg-primary"], "#FFFFFF");
  assert.equal(D["border-error"], "#F97066");
});
