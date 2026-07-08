import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { toRef, alphaVal, buildSeedTokens } from "../scripts/build-seed-tokens.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const EXTRACTED = JSON.parse(readFileSync(join(ROOT, "docs/tokens_extracted.json"), "utf8"));

// 인라인 SLICE 픽스처 — docs/tokens_extracted.json 정본 shape을 축소한 것.
const SLICE = {
  primitives: {
    gray: { "25": "#FCFCFD", "50": "#F9FAFB", "900": "#101828", "950": "#0C111D" },
    "gray-dark": { "25": "#FAFAFA", "50": "#F5F5F6", "900": "#161B26", "950": "#0C111D" },
    error: { "25": "#FFFBFA", "300": "#FDA29B", "400": "#F97066", "950": "#55160C" },
  },
  base_colors: { white: "#FFFFFF", black: "#000000" },
  semantic: [
    { name: "text-primary", light: "gray-900", dark: "gray-50" },
    { name: "text-primary_on-brand", light: "white", dark: "gray-50" },
    { name: "text-white", light: "text-white", dark: "text-white" },
    { name: "fg-primary", light: "gray-900", dark: "white" },
    { name: "border-error", light: "error-300", dark: "error-400" },
  ],
  utility: [
    { name: "utility-brand-600_alt", light: "brand-600", dark: "gray-400" },
    { name: "utility-brand_alt", light: "brand-300", dark: "gray-700" },
  ],
  alpha: [{ name: "alpha-white-10", light: "white 10%", dark: "gray-950 10%" }],
};
const BRAND = { "50": "#F5F3FF", "600": "#7839EE", "950": "#2E125E" };

test("toRef: white -> {base.white}", () => {
  assert.equal(toRef("white"), "{base.white}");
});

test("toRef: black -> {base.black}", () => {
  assert.equal(toRef("black"), "{base.black}");
});

test("toRef: text-white -> #FFFFFF", () => {
  assert.equal(toRef("text-white"), "#FFFFFF");
});

test("toRef: gray-900 -> {scales.gray.900}", () => {
  assert.equal(toRef("gray-900"), "{scales.gray.900}");
});

test("toRef: brand-600 -> {scales.brand.600}", () => {
  assert.equal(toRef("brand-600"), "{scales.brand.600}");
});

test("toRef: multi-hyphen blue-dark-500 -> {scales.blue-dark.500}", () => {
  assert.equal(toRef("blue-dark-500"), "{scales.blue-dark.500}");
});

test("toRef: multi-hyphen orange-dark-700 -> {scales.orange-dark.700}", () => {
  assert.equal(toRef("orange-dark-700"), "{scales.orange-dark.700}");
});

test("toRef: multi-hyphen gray-blue-300 -> {scales.gray-blue.300}", () => {
  assert.equal(toRef("gray-blue-300"), "{scales.gray-blue.300}");
});

test("toRef: nonsense throws", () => {
  assert.throws(() => toRef("nonsense"));
});

test("alphaVal: white 10% -> rgba(255,255,255,0.1)", () => {
  assert.equal(alphaVal("white 10%"), "rgba(255,255,255,0.1)");
});

test("alphaVal: white 40% -> rgba(255,255,255,0.4)", () => {
  assert.equal(alphaVal("white 40%"), "rgba(255,255,255,0.4)");
});

test("alphaVal: black 50% -> rgba(0,0,0,0.5)", () => {
  assert.equal(alphaVal("black 50%"), "rgba(0,0,0,0.5)");
});

test("alphaVal: gray-950 10% -> rgba(12,17,29,0.1)", () => {
  assert.equal(alphaVal("gray-950 10%"), "rgba(12,17,29,0.1)");
});

test("alphaVal: white 100% -> rgba(255,255,255,1)", () => {
  assert.equal(alphaVal("white 100%"), "rgba(255,255,255,1)");
});

test("alphaVal: black 100% -> rgba(0,0,0,1)", () => {
  assert.equal(alphaVal("black 100%"), "rgba(0,0,0,1)");
});

test("alphaVal: gray-950 100% -> rgba(12,17,29,1)", () => {
  assert.equal(alphaVal("gray-950 100%"), "rgba(12,17,29,1)");
});

test("buildSeedTokens: top-level shape (scales/semantic:{}/base)", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.ok(t.scales && typeof t.scales === "object");
  assert.deepEqual(t.semantic, {});
  assert.ok(t.base && typeof t.base === "object");
});

test("buildSeedTokens: gray is DISTINCT light/dark (50 distinct, 950 shared)", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.deepEqual(t.scales.gray["50"], { light: "#F9FAFB", dark: "#F5F5F6" });
  assert.deepEqual(t.scales.gray["950"], { light: "#0C111D", dark: "#0C111D" });
});

test("buildSeedTokens: non-gray ramp has light==dark (error)", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.deepEqual(t.scales.error["300"], { light: "#FDA29B", dark: "#FDA29B" });
  assert.deepEqual(t.scales.error["400"], { light: "#F97066", dark: "#F97066" });
});

test("buildSeedTokens: gray-dark is NOT emitted as its own scale", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.equal(t.scales["gray-dark"], undefined);
});

test("buildSeedTokens: brand ramp comes from opts.brandRamp", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.deepEqual(t.scales.brand["50"], { light: "#F5F3FF", dark: "#F5F3FF" });
  assert.deepEqual(t.scales.brand["600"], { light: "#7839EE", dark: "#7839EE" });
  assert.deepEqual(t.scales.brand["950"], { light: "#2E125E", dark: "#2E125E" });
});

test("buildSeedTokens: 3 base anchors present (white/black/text-white)", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.deepEqual(t.base.white, { light: "#FFFFFF", dark: "#FFFFFF" });
  assert.deepEqual(t.base.black, { light: "#000000", dark: "#000000" });
  assert.deepEqual(t.base["text-white"], { light: "#FFFFFF", dark: "#FFFFFF" });
});

test("buildSeedTokens: semantic entries map to {light:toRef,dark:toRef}", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.deepEqual(t.base["text-primary"], { light: "{scales.gray.900}", dark: "{scales.gray.50}" });
  assert.deepEqual(t.base["fg-primary"], { light: "{scales.gray.900}", dark: "{base.white}" });
  assert.deepEqual(t.base["border-error"], { light: "{scales.error.300}", dark: "{scales.error.400}" });
});

test("buildSeedTokens: text-primary_on-brand light resolves 'white' anchor via toRef", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.deepEqual(t.base["text-primary_on-brand"], { light: "{base.white}", dark: "{scales.gray.50}" });
});

test("buildSeedTokens: text-white is absorbed as the anchor (no duplicate emission)", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.deepEqual(t.base["text-white"], { light: "#FFFFFF", dark: "#FFFFFF" });
  // Only one 'text-white' key total (Object.keys dedupes naturally, but assert semantic loop did not overwrite with a ref)
  assert.notEqual(t.base["text-white"].light, "{base.white}");
});

test("buildSeedTokens: utility _alt NAME verbatim, VALUE normalized", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.deepEqual(t.base["utility-brand-600_alt"], { light: "{scales.brand.600}", dark: "{scales.gray.400}" });
  assert.deepEqual(t.base["utility-brand_alt"], { light: "{scales.brand.300}", dark: "{scales.gray.700}" });
});

test("buildSeedTokens: alpha entries are rgba per-mode", () => {
  const t = buildSeedTokens(SLICE, { brandRamp: BRAND });
  assert.deepEqual(t.base["alpha-white-10"], { light: "rgba(255,255,255,0.1)", dark: "rgba(12,17,29,0.1)" });
});

test("buildSeedTokens(EXTRACTED): full-corpus count invariants", () => {
  const t = buildSeedTokens(EXTRACTED);
  assert.equal(Object.keys(t.scales).length, 29);
  assert.equal(Object.keys(t.base).length, 240);
  assert.deepEqual(t.semantic, {});
  assert.ok(t.scales.brand, "brand scale must be present");
  assert.equal(t.scales["gray-dark"], undefined, "gray-dark must not be emitted as its own scale");
});

test("buildSeedTokens(EXTRACTED): brand ramp has all steps 50..950 as valid hex", () => {
  const t = buildSeedTokens(EXTRACTED);
  for (const step of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]) {
    const leaf = t.scales.brand[step];
    assert.ok(leaf, `brand.${step} must exist`);
    assert.match(leaf.light, /^#[0-9A-Fa-f]{6}$/);
    assert.match(leaf.dark, /^#[0-9A-Fa-f]{6}$/);
  }
});

test("buildSeedTokens(EXTRACTED): every emitted ramp has exactly 12 steps", () => {
  const t = buildSeedTokens(EXTRACTED);
  for (const ramp of Object.keys(t.scales)) assert.equal(Object.keys(t.scales[ramp]).length, 12, `scales.${ramp} must have 12 steps`);
});
