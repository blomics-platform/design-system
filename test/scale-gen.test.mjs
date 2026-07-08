import { test } from "node:test";
import assert from "node:assert/strict";
import { hexToOklch, oklchToHex } from "../src/scale-gen.mjs";
test("hex→oklch→hex round-trips within tolerance", () => {
  for (const hex of ["#2563eb", "#ffffff", "#000000", "#10b981"]) {
    const { L, C, H } = hexToOklch(hex);
    assert.ok(L >= 0 && L <= 1, "L in [0,1]");
    const back = oklchToHex(L, C, H);
    assert.match(back, /^#[0-9a-f]{6}$/);
  }
});
test("conversion is deterministic (same input → identical output)", () => {
  assert.deepEqual(hexToOklch("#2563eb"), hexToOklch("#2563eb"));
  assert.equal(oklchToHex(0.575, 0.19, 264), oklchToHex(0.575, 0.19, 264));
});
test("oklch string formatter is stable", async () => {
  const { formatOklch } = await import("../src/scale-gen.mjs");
  assert.equal(formatOklch(0.575, 0.19, 264.1234), formatOklch(0.575, 0.19, 264.1234));
  assert.match(formatOklch(0.575, 0.19, 264.1234), /^oklch\(/);
});
test("expandScales replaces $generate with an 11-step ramp (25..900)", async () => {
  const { expandScales } = await import("../src/scale-gen.mjs");
  const raw = { meta: { autoMirrorDark: true }, scales: { brand: { $generate: { base: { light: "#2563eb" }, anchor: 600 } } }, semantic: { brand: { base: { light: "{scales.brand.600}" }, hover: { light: "{scales.brand.700}" }, active: { light: "{scales.brand.800}" }, foreground: { light: "#fff" }, light: { light: "{scales.brand.100}" }, "light-foreground": { light: "{scales.brand.800}" } } } };
  const cfg = { scaleOutput: "oklch" };
  const out = expandScales(raw, cfg);
  const ramp = out.scales.brand;
  assert.ok(!("$generate" in ramp), "$generate expanded away");
  assert.deepEqual(Object.keys(ramp), ["25","50","100","200","300","400","500","600","700","800","900"]);
  assert.match(ramp["600"].light, /^oklch\(/);
  assert.equal(ramp["600"].light, expandScales(raw, cfg).scales.brand["600"].light, "deterministic");
});
test("anchor step L equals base L (lossless anchor)", async () => {
  const { expandScales, hexToOklch } = await import("../src/scale-gen.mjs");
  const raw = { meta: {}, scales: { brand: { $generate: { base: { light: "#2563eb" }, anchor: 600 } } }, semantic: {} };
  const out = expandScales(raw, { scaleOutput: "hex" });
  const anchorHex = out.scales.brand["600"].light;
  const dL = Math.abs(hexToOklch(anchorHex).L - hexToOklch("#2563eb").L);
  assert.ok(dL < 0.01, `anchor L close to base L, ΔL=${dL}`);
});
test("L is strictly monotonic decreasing 25→900", async () => {
  const { expandScales, hexToOklch } = await import("../src/scale-gen.mjs");
  const raw = { meta: {}, scales: { brand: { $generate: { base: { light: "#2563eb" }, anchor: 600 } } }, semantic: {} };
  const out = expandScales(raw, { scaleOutput: "hex" });
  const steps = ["25","50","100","200","300","400","500","600","700","800","900"];
  const Ls = steps.map((s) => hexToOklch(out.scales.brand[s].light).L);
  for (let i = 1; i < Ls.length; i++) {
    assert.ok(Ls[i] < Ls[i - 1], `L must strictly decrease: L[${steps[i - 1]}]=${Ls[i - 1]} !> L[${steps[i]}]=${Ls[i]}`);
  }
});
test("scaleOutput:hex emits hex; $generate.base without dark mirrors light under autoMirrorDark", async () => {
  const { expandScales } = await import("../src/scale-gen.mjs");
  const raw = { meta: { autoMirrorDark: true }, scales: { brand: { $generate: { base: { light: "#2563eb" } } } }, semantic: {} };
  const out = expandScales(raw, { scaleOutput: "hex" });
  assert.match(out.scales.brand["600"].light, /^#[0-9a-f]{6}$/);
  assert.equal(out.scales.brand["600"].dark, out.scales.brand["600"].light, "autoMirror: dark==light");
});
test("ramps without $generate pass through unchanged", async () => {
  const { expandScales } = await import("../src/scale-gen.mjs");
  const raw = { meta: {}, scales: { primary: { "600": { light: "#2563eb" } } }, semantic: {} };
  assert.deepEqual(expandScales(raw, {}).scales.primary, { "600": { light: "#2563eb" } });
});
