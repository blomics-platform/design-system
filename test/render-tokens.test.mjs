import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTokens } from "../src/render-tokens.mjs";

// Inline fixture: scales in insertion order brand/gray/error; base = anchors + role + utility + alpha + text-white.
const tokens = {
  scales: {
    brand: {}, gray: {}, error: {},
  },
  base: {
    white: "#ffffff", black: "#000000",
    "text-primary": "#101828", "text-white": "#ffffff",
    "bg-brand-solid": "#6941c6",
    "border-error": "#fda29b",
    "fg-primary": "#101828",
    "utility-brand-600": "#6941c6",
    "alpha-black-50": "rgba(0,0,0,0.5)",
  },
};
const config = { darkSelector: '[data-gnb-theme="dark"]' };
const sourceHash = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

test("returns {ts, dts} strings with AUTO-GENERATED header incl. source hash", () => {
  const { ts, dts } = renderTokens(tokens, config, sourceHash);
  assert.equal(typeof ts, "string");
  assert.equal(typeof dts, "string");
  assert.ok(ts.startsWith("/* AUTO-GENERATED"));
  assert.ok(dts.startsWith("/* AUTO-GENERATED"));
  assert.ok(ts.includes("Source hash: " + sourceHash + "."));
  assert.ok(dts.includes("Source hash: " + sourceHash + "."));
});

test("PRIMITIVE_RAMPS = scale keys in insertion order, as const (ts only)", () => {
  const { ts, dts } = renderTokens(tokens, config, sourceHash);
  assert.ok(ts.includes('export const PRIMITIVE_RAMPS = ["brand", "gray", "error"] as const;'));
  assert.ok(dts.includes('export declare const PRIMITIVE_RAMPS: readonly ["brand", "gray", "error"];'));
});

test("PRIMITIVE_STEPS = the 12 steps", () => {
  const { ts, dts } = renderTokens(tokens, config, sourceHash);
  const steps = '["25", "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]';
  assert.ok(ts.includes(`export const PRIMITIVE_STEPS = ${steps} as const;`));
  assert.ok(dts.includes(`export declare const PRIMITIVE_STEPS: readonly ${steps};`));
});

test("role lists split by prefix; white/black excluded; text-white included in TEXT_TOKENS", () => {
  const { ts } = renderTokens(tokens, config, sourceHash);
  assert.ok(ts.includes('export const TEXT_TOKENS = ["text-primary", "text-white"] as const;'));
  assert.ok(ts.includes('export const BG_TOKENS = ["bg-brand-solid"] as const;'));
  assert.ok(ts.includes('export const BORDER_TOKENS = ["border-error"] as const;'));
  assert.ok(ts.includes('export const FG_TOKENS = ["fg-primary"] as const;'));
  assert.ok(!ts.includes('"white"') || !/TEXT_TOKENS\s*=\s*\[[^\]]*"white"/.test(ts), "white must not appear in a role list");
  assert.ok(!/BG_TOKENS\s*=\s*\[[^\]]*"black"/.test(ts), "black must not appear in a role list");
});

test("UTILITY_TOKENS verbatim (no _alt name-splitting); ALPHA_TOKENS kept separate", () => {
  const { ts } = renderTokens(tokens, config, sourceHash);
  assert.ok(ts.includes('export const UTILITY_TOKENS = ["utility-brand-600"] as const;'));
  assert.ok(ts.includes('export const ALPHA_TOKENS = ["alpha-black-50"] as const;'));
});

test("union types generated per list (ts)", () => {
  const { ts } = renderTokens(tokens, config, sourceHash);
  assert.ok(ts.includes("export type PrimitiveRamp = (typeof PRIMITIVE_RAMPS)[number];"));
  assert.ok(ts.includes("export type PrimitiveStep = (typeof PRIMITIVE_STEPS)[number];"));
  assert.ok(ts.includes("export type TextToken = (typeof TEXT_TOKENS)[number];"));
  assert.ok(ts.includes("export type BgToken = (typeof BG_TOKENS)[number];"));
  assert.ok(ts.includes("export type BorderToken = (typeof BORDER_TOKENS)[number];"));
  assert.ok(ts.includes("export type FgToken = (typeof FG_TOKENS)[number];"));
  assert.ok(ts.includes("export type UtilityToken = (typeof UTILITY_TOKENS)[number];"));
  assert.ok(ts.includes("export type AlphaToken = (typeof ALPHA_TOKENS)[number];"));
});

test(".d.ts uses `export declare const X: readonly [...]` + type aliases, no `as const`", () => {
  const { dts } = renderTokens(tokens, config, sourceHash);
  assert.ok(!dts.includes("as const"), ".d.ts must not contain `as const` (JS-only construct)");
  assert.ok(dts.includes("export declare const TEXT_TOKENS: readonly [\"text-primary\", \"text-white\"];"));
  assert.ok(dts.includes("export declare const UTILITY_TOKENS: readonly [\"utility-brand-600\"];"));
  assert.ok(dts.includes("export declare const ALPHA_TOKENS: readonly [\"alpha-black-50\"];"));
  assert.ok(dts.includes("export type TextToken = (typeof TEXT_TOKENS)[number];"));
});

test("no buttonVariants/getButtonClasses/SEMANTIC_COLORS in output", () => {
  const { ts, dts } = renderTokens(tokens, config, sourceHash);
  for (const needle of ["buttonVariants", "getButtonClasses", "SEMANTIC_COLORS"]) {
    assert.ok(!ts.includes(needle), `ts must not contain ${needle}`);
    assert.ok(!dts.includes(needle), `dts must not contain ${needle}`);
  }
});

test("determinism: calling twice with same input yields identical output strings", () => {
  const a = renderTokens(tokens, config, sourceHash);
  const b = renderTokens(tokens, config, sourceHash);
  assert.equal(a.ts, b.ts);
  assert.equal(a.dts, b.dts);
});
