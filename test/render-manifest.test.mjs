import { test } from "node:test";
import assert from "node:assert/strict";
import { renderManifest } from "../src/render-manifest.mjs";

// Inline fixture: primitive steps (brand/gray ramps) + white/black anchors + representative role
// tokens (text/bg/border/fg) + utility tokens + alpha tokens + text-white.
// NOTE: utility-*/alpha-* names use REAL trailing-digit forms (utility-brand-600, alpha-white-10, …)
// so the fixture actually exercises the isPrimitive digit regex — non-digit names like
// "utility-brand-solid" would dodge the misclassification bug entirely.
const resolvedLight = {
  "brand-500": "#7f56d9", "brand-600": "#6941c6",
  "gray-50": "#f9fafb", "gray-900": "#101828",
  "white": "#ffffff", "black": "#000000",
  "text-primary": "#101828", "text-white": "#ffffff",
  "bg-brand-solid": "#6941c6",
  "border-error": "#fda29b",
  "fg-primary": "#101828",
  "utility-brand-600": "#6941c6",
  "utility-gray-50": "#f9fafb",
  "alpha-white-10": "rgba(255,255,255,0.1)",
  "alpha-black-50": "rgba(0,0,0,0.5)",
};
const resolvedDark = {
  "brand-500": "#7f56d9", "brand-600": "#6941c6",
  "gray-50": "#f5f5f6", "gray-900": "#161b26",
  "white": "#ffffff", "black": "#000000",
  "text-primary": "#f5f5f6", "text-white": "#ffffff",
  "bg-brand-solid": "#6941c6",
  "border-error": "#f97066",
  "fg-primary": "#ffffff",
  "utility-brand-600": "#7f56d9",
  "utility-gray-50": "#1f242f",
  "alpha-white-10": "rgba(255,255,255,0.1)",
  "alpha-black-50": "rgba(255,255,255,0.5)",
};
const config = { darkSelector: '[data-gnb-theme="dark"]' };
const sourceHash = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";

test("new signature renderManifest(light, dark, config, hash) — no model param", () => {
  const m = renderManifest(resolvedLight, resolvedDark, config, sourceHash);
  assert.equal(m.sourceHash, sourceHash);
  assert.equal(m.generator, "@blomics-platform/design-system");
});

test('version "0.2.0" and darkSelector', () => {
  const m = renderManifest(resolvedLight, resolvedDark, config, sourceHash);
  assert.equal(m.version, "0.2.0");
  assert.equal(m.darkSelector, config.darkSelector);
});

test("primitives.ramps and primitives.steps", () => {
  const m = renderManifest(resolvedLight, resolvedDark, config, sourceHash);
  assert.deepEqual(m.primitives.ramps, ["brand", "gray"]);
  assert.deepEqual(m.primitives.steps, ["25", "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"]);
});

test("roleTokens.text/.bg/.border/.fg counts match fixture subset", () => {
  const m = renderManifest(resolvedLight, resolvedDark, config, sourceHash);
  assert.deepEqual(m.roleTokens.text, ["text-primary", "text-white"]);
  assert.deepEqual(m.roleTokens.bg, ["bg-brand-solid"]);
  assert.deepEqual(m.roleTokens.border, ["border-error"]);
  assert.deepEqual(m.roleTokens.fg, ["fg-primary"]);
});

test("utilityTokens verbatim; alphaTokens", () => {
  const m = renderManifest(resolvedLight, resolvedDark, config, sourceHash);
  assert.deepEqual(m.utilityTokens, ["utility-brand-600", "utility-gray-50"]);
  assert.deepEqual(m.alphaTokens, ["alpha-white-10", "alpha-black-50"]);
});

test("utilities map has NO text-white className entry, but colorVars.light DOES have --color-text-white", () => {
  const m = renderManifest(resolvedLight, resolvedDark, config, sourceHash);
  assert.ok(!Object.prototype.hasOwnProperty.call(m.utilities, "text-white"), "utilities must not have text-white key");
  assert.ok(m.colorVars.light.includes("--color-text-white"), "colorVars.light must include --color-text-white");
});

test("utilities map has expected role/utility/alpha entries", () => {
  const m = renderManifest(resolvedLight, resolvedDark, config, sourceHash);
  assert.equal(m.utilities["text-primary"], "--color-text-primary");
  assert.equal(m.utilities["bg-brand-solid"], "--color-bg-brand-solid");
  assert.equal(m.utilities["border-error"], "--color-border-error");
  assert.equal(m.utilities["fg-primary"], "--color-fg-primary");
  assert.equal(m.utilities["bg-utility-brand-600"], "--color-utility-brand-600");
  assert.equal(m.utilities["text-utility-brand-600"], "--color-utility-brand-600");
  assert.equal(m.utilities["bg-alpha-black-50"], "--color-alpha-black-50");
  assert.equal(m.utilities["text-alpha-black-50"], "--color-alpha-black-50");
});

test("colorVars.light/dark sorted and prefixed", () => {
  const m = renderManifest(resolvedLight, resolvedDark, config, sourceHash);
  assert.deepEqual(m.colorVars.light, [...m.colorVars.light].sort());
  assert.deepEqual(m.colorVars.dark, [...m.colorVars.dark].sort());
  assert.ok(m.colorVars.light.includes("--color-brand-500"));
  assert.ok(m.colorVars.light.includes("--color-white"));
  assert.ok(m.colorVars.light.includes("--color-black"));
});

test("NO variantKeys/semanticColors/omittedVars keys anywhere in the output", () => {
  const m = renderManifest(resolvedLight, resolvedDark, config, sourceHash);
  for (const key of ["variantKeys", "semanticColors", "omittedVars"]) {
    assert.ok(!Object.prototype.hasOwnProperty.call(m, key), `manifest must not have key ${key}`);
  }
});
