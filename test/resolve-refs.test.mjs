import { test } from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
import { resolveRefs } from "../src/resolve-refs.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)); const load = (n) => JSON.parse(readFileSync(join(HERE, "fixtures", n), "utf8"));

test("enumerate scales-then-base key order (semantic empty)", () => {
  const L = resolveRefs(load("tokens.resolve.json"), "light");
  assert.deepEqual(Object.keys(L), ["gray-50","gray-900","gray-950","error-300","error-400","brand-500","brand-600","brand-700","white","black","text-white","text-primary","bg-primary","bg-brand-solid","border-error","fg-primary","utility-brand-600_alt","ring"]);
});
test("{base.white} anchor ref resolves via root-walk", () => { const L = resolveRefs(load("tokens.resolve.json"), "light"); const D = resolveRefs(load("tokens.resolve.json"), "dark"); assert.equal(L["bg-primary"], "#FFFFFF"); assert.equal(D["fg-primary"], "#FFFFFF"); });
test("single-hop {scales.*} per-mode", () => { const t = load("tokens.resolve.json"); const L = resolveRefs(t, "light"); const D = resolveRefs(t, "dark"); assert.equal(L["text-primary"], "#101828"); assert.equal(D["text-primary"], "#F5F5F6"); });
test("per-mode divergence gray distinct / error identical / anchor split", () => { const t = load("tokens.resolve.json"); const L = resolveRefs(t, "light"); const D = resolveRefs(t, "dark"); assert.notEqual(L["gray-50"], D["gray-50"]); assert.equal(L["gray-950"], D["gray-950"]); assert.equal(L["border-error"], "#FDA29B"); assert.equal(D["border-error"], "#F97066"); assert.notEqual(D["fg-primary"], D["text-primary"]); });
test("_alt NAME opaque, VALUE resolves", () => { const t = load("tokens.resolve.json"); const L = resolveRefs(t, "light"); const D = resolveRefs(t, "dark"); assert.ok("utility-brand-600_alt" in L); assert.equal(L["utility-brand-600_alt"], "#6941C6"); assert.equal(D["utility-brand-600_alt"], "#161B26"); });
test("2-hop folds both modes", () => { const t = load("tokens.resolve.json"); const L = resolveRefs(t, "light"); const D = resolveRefs(t, "dark"); assert.equal(L["ring"], "#6941C6"); assert.equal(L["ring"], L["bg-brand-solid"]); });
test("resolveRefs does NOT throw when semantic absent", () => { const t = { scales: { gray: { "900": { light: "#101828", dark: "#161B26" } } }, base: { white: { light: "#FFFFFF", dark: "#FFFFFF" }, "bg-primary": { light: "{base.white}", dark: "{scales.gray.900}" } } }; assert.doesNotThrow(() => resolveRefs(t, "light")); assert.equal(resolveRefs(t, "dark")["bg-primary"], "#161B26"); });
test("resolveRefs does NOT throw when semantic empty {}", () => { const t = { scales: { gray: { "900": { light: "#101828", dark: "#161B26" } } }, semantic: {}, base: { white: { light: "#FFFFFF", dark: "#FFFFFF" } } }; assert.doesNotThrow(() => resolveRefs(t, "light")); assert.deepEqual(Object.keys(resolveRefs(t, "light")), ["gray-900", "white"]); });
test("FLAT semantic content resolves in scales->semantic->base order", () => {
  const t = { scales: { gray: { "900": { light: "#101828", dark: "#161B26" } } }, semantic: { "role-x": { light: "{scales.gray.900}", dark: "{scales.gray.900}" } }, base: { white: { light: "#FFFFFF", dark: "#FFFFFF" } } };
  const L = resolveRefs(t, "light");
  assert.deepEqual(Object.keys(L), ["gray-900", "role-x", "white"]);
  assert.equal(L["role-x"], "#101828");
});
test("cycle is hard error", () => { const t = load("tokens.cycle.json"); assert.throws(() => resolveRefs(t, "light"), /cycle detected/i); });
test("unresolvable is hard error", () => { const t = { scales: { brand: { "600": { light: "#6941C6", dark: "#6941C6" } } }, semantic: {}, base: { "bg-brand-solid": { light: "{scales.brand.999}", dark: "#000" } } }; assert.throws(() => resolveRefs(t, "light"), /unresolvable reference/i); });
test("autoMirrorDark mirrors light through light-only step", () => { const t = { meta: { autoMirrorDark: true }, scales: { brand: { "600": { light: "#6941C6" } } }, semantic: {}, base: { "bg-brand-solid": { light: "{scales.brand.600}" } } }; assert.equal(resolveRefs(t, "dark")["bg-brand-solid"], "#6941C6"); });
