import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/validate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = dirname(HERE);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const SCHEMAS = { tokens: readJson(join(PKG, "tokens.schema.json")), config: readJson(join(PKG, "config.schema.json")) };
const CONFIG = { classPrefix: "", darkSelector: '[data-gnb-theme="dark"]', darkVariantName: "dark", output: { css: "dist/theme.css", ts: "dist/tokens.ts", dts: "dist/tokens.d.ts", manifest: "dist/tokens.manifest.json" }, baseColorEmit: {} };

function makeTokens() {
  return {
    scales: {
      gray: { "50": { light: "#F9FAFB", dark: "#F5F5F6" }, "400": { light: "#98A2B3", dark: "#94969C" }, "900": { light: "#101828", dark: "#161B26" }, "950": { light: "#0C111D", dark: "#0C111D" } },
      error: { "300": { light: "#FDA29B", dark: "#FDA29B" }, "400": { light: "#F97066", dark: "#F97066" }, "600": { light: "#D92D20", dark: "#D92D20" } },
      brand: { "50": { light: "#F4F3FF", dark: "#F4F3FF" }, "100": { light: "#EBE9FE", dark: "#EBE9FE" }, "200": { light: "#D9D6FE", dark: "#D9D6FE" }, "300": { light: "#BDB4FE", dark: "#BDB4FE" }, "400": { light: "#9B8AFB", dark: "#9B8AFB" }, "500": { light: "#7A5AF8", dark: "#7A5AF8" }, "600": { light: "#6938EF", dark: "#6938EF" }, "700": { light: "#5925DC", dark: "#5925DC" }, "800": { light: "#4A1FB8", dark: "#4A1FB8" }, "900": { light: "#3E1C96", dark: "#3E1C96" }, "950": { light: "#27115F", dark: "#27115F" } },
    },
    semantic: {},
    base: {
      white: { light: "#FFFFFF", dark: "#FFFFFF" },
      black: { light: "#000000", dark: "#000000" },
      "text-white": { light: "#FFFFFF", dark: "#FFFFFF" },
      "text-primary": { light: "{scales.gray.900}", dark: "{scales.gray.50}" },
      "text-primary_on-brand": { light: "{base.white}", dark: "{scales.gray.50}" },
      "bg-primary": { light: "{base.white}", dark: "{scales.gray.950}" },
      "border-error": { light: "{scales.error.300}", dark: "{scales.error.400}" },
      "fg-primary": { light: "{scales.gray.900}", dark: "{base.white}" },
      "fg-white": { light: "{base.white}", dark: "{base.white}" },
      "utility-brand-600": { light: "{scales.brand.600}", dark: "{scales.brand.400}" },
      "alpha-white-10": { light: "rgba(255,255,255,0.1)", dark: "rgba(12,17,29,0.1)" },
      "alpha-black-50": { light: "rgba(0,0,0,0.5)", dark: "rgba(255,255,255,0.5)" },
    },
  };
}

test("validate passes for new-model tokens (scales + semantic:{} + base)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("validate does NOT throw when tokens.semantic is entirely absent", () => { const t = makeTokens(); delete t.semantic; assert.doesNotThrow(() => validate(t, CONFIG, SCHEMAS)); });
test("validate does NOT throw when tokens.semantic is an empty object", () => { const t = makeTokens(); t.semantic = {}; assert.doesNotThrow(() => validate(t, CONFIG, SCHEMAS)); });

test("config without `colors` array does not throw (config.colors check removed)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("a stray slotOverrides key does not throw (slotOverrides typo check removed)", () => { const cfg = { ...CONFIG, slotOverrides: { nonexistent: { omit: ["hover"] } } }; assert.doesNotThrow(() => validate(makeTokens(), cfg, SCHEMAS)); });
test("no 6-slot completeness is enforced on base role tokens", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });

test("{ref} leaves are accepted", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("rgba() literal leaf is accepted", () => { const t = makeTokens(); t.base = { ...t.base, "alpha-black-99": { light: "rgba(0,0,0,0.99)", dark: "rgba(255,255,255,0.99)" } }; assert.doesNotThrow(() => validate(t, CONFIG, SCHEMAS)); });
test("a leaf with an unknown key throws", () => { const t = makeTokens(); t.base = { ...t.base, weird: { light: "#000000", dark: "#000000", extra: "#fff" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /Unknown key 'extra'/i); });
test("a leaf whose light is not a color/{ref} throws", () => { const t = makeTokens(); t.base = { ...t.base, bad: { light: "notacolor", dark: "#000000" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /'light' must be a CSS color/i); });
test("unresolvable {ref} in base throws", () => { const t = makeTokens(); t.base = { ...t.base, ghost: { light: "{scales.gray.999}", dark: "{scales.gray.999}" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /unresolv|gray\.999/i); });
test("a reference cycle in base throws", () => { const t = makeTokens(); t.base = { ...t.base, a: { light: "{base.b}", dark: "{base.b}" }, b: { light: "{base.a}", dark: "{base.a}" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /cycle|circular/i); });
test("duplicate emitted --color-* var throws", () => { const t = makeTokens(); t.base = { ...t.base, "text/primary": { light: "#000000", dark: "#000000" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /duplicate/i); });
test("{base.white} anchor ref resolves (positive)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("missing base.white anchor throws", () => { const t = makeTokens(); delete t.base.white; assert.throws(() => validate(t, CONFIG, SCHEMAS), /base\.white|anchor/i); });
test("missing base.black anchor throws", () => { const t = makeTokens(); delete t.base.black; t.base["needs-black"] = { light: "{base.black}", dark: "{base.black}" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /base\.black|anchor/i); });
test("missing text-white anchor throws", () => { const t = makeTokens(); delete t.base["text-white"]; assert.throws(() => validate(t, CONFIG, SCHEMAS), /text-white|anchor/i); });

test("alpha-* rgba light+dark pass", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("alpha-* light as {ref} throws", () => { const t = makeTokens(); t.base["alpha-white-99"] = { light: "{scales.gray.900}", dark: "rgba(12,17,29,0.99)" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /alpha.*rgba|rgba.*alpha/i); });
test("alpha-* dark as hex throws", () => { const t = makeTokens(); t.base["alpha-black-99"] = { light: "rgba(0,0,0,0.99)", dark: "#000000" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /alpha.*rgba|rgba.*alpha/i); });

test("fg-white is NOT a collision (fg- utils are not Tailwind-auto)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("text-white role token is whitelisted (no @utility)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("role token text-gray-900 collides with Tailwind auto text-gray-900 -> throws", () => { const t = makeTokens(); t.base["text-gray-900"] = { light: "{scales.gray.900}", dark: "{scales.gray.50}" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /text-gray-900|collision|disjoint/i); });
test("role token bg-error-400 collides with Tailwind auto bg-error-400 -> throws", () => { const t = makeTokens(); t.base["bg-error-400"] = { light: "{scales.error.400}", dark: "{scales.error.400}" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /bg-error-400|collision|disjoint/i); });
test("two role tokens producing same @utility name throw", () => { const t = makeTokens(); t.base["bg-utility-brand-600"] = { light: "{scales.brand.600}", dark: "{scales.brand.400}" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /duplicate|collision|utility-brand-600/i); });

test("full brand ramp 50..950 passes", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("brand missing 500 throws", () => { const t = makeTokens(); delete t.scales.brand["500"]; assert.throws(() => validate(t, CONFIG, SCHEMAS), /brand.*500|required.*step/i); });
test("brand missing 950 throws", () => { const t = makeTokens(); delete t.scales.brand["950"]; assert.throws(() => validate(t, CONFIG, SCHEMAS), /brand.*950|required.*step/i); });
test("no brand ramp does NOT trigger preflight", () => { const t = makeTokens(); delete t.scales.brand; delete t.base["utility-brand-600"]; assert.doesNotThrow(() => validate(t, CONFIG, SCHEMAS)); });

test("a malformed flat semantic leaf (bad color) throws", () => { const t = makeTokens(); t.semantic = { "role-x": { light: "NOTACOLOR", dark: "#000000" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /'light' must be a CSS color|semantic/i); });
test("a flat semantic leaf missing dark (autoMirror off) throws", () => { const t = makeTokens(); t.semantic = { "role-y": { light: "#000000" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /Missing 'dark'|semantic/i); });
test("a valid flat semantic leaf passes", () => { const t = makeTokens(); t.semantic = { "role-ok": { light: "{scales.brand.500}", dark: "{scales.brand.500}" } }; assert.doesNotThrow(() => validate(t, CONFIG, SCHEMAS)); });
