import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os"; import { join } from "node:path";
import { atomicWrite, diffOutputs } from "../src/atomic-write.mjs";
const CONFIG = { output: { css: "dist/theme.css", ts: "dist/tokens.ts", dts: "dist/tokens.d.ts", manifest: "dist/tokens.manifest.json" } };
const OUT = { css: "/*css*/", ts: "// ts", dts: "// dts", manifest: "{}\n" };
const stage = () => mkdtempSync(join(tmpdir(), "ds-aw-"));
test("atomicWrite writes all 4 files with exact content", () => {
  const dir = stage(); atomicWrite(OUT, CONFIG, dir);
  assert.equal(readFileSync(join(dir, "dist/theme.css"), "utf8"), "/*css*/");
  assert.equal(readFileSync(join(dir, "dist/tokens.ts"), "utf8"), "// ts");
  assert.equal(readFileSync(join(dir, "dist/tokens.d.ts"), "utf8"), "// dts");
  assert.equal(readFileSync(join(dir, "dist/tokens.manifest.json"), "utf8"), "{}\n");
});
test("atomicWrite overwrites existing dist and leaves no temp/backup dirs", () => {
  const dir = stage(); atomicWrite(OUT, CONFIG, dir);
  atomicWrite({ ...OUT, css: "/*v2*/" }, CONFIG, dir);
  assert.equal(readFileSync(join(dir, "dist/theme.css"), "utf8"), "/*v2*/");
  const leftovers = readdirSync(dir).filter((n) => n.includes(".tmp") || n.includes(".old"));
  assert.deepEqual(leftovers, []);
});
test("atomicWrite creates dist when absent", () => {
  const dir = stage(); assert.ok(!existsSync(join(dir, "dist")));
  atomicWrite(OUT, CONFIG, dir); assert.ok(existsSync(join(dir, "dist")));
});
test("diffOutputs returns [] when on-disk matches in-memory", () => {
  const dir = stage(); atomicWrite(OUT, CONFIG, dir);
  assert.deepEqual(diffOutputs(OUT, CONFIG, dir), []);
});
test("diffOutputs lists changed files (relative paths)", () => {
  const dir = stage(); atomicWrite(OUT, CONFIG, dir);
  assert.deepEqual(diffOutputs({ ...OUT, css: "/*changed*/" }, CONFIG, dir), ["dist/theme.css"]);
});
test("diffOutputs treats a missing dist as all-changed", () => {
  const dir = stage();
  assert.deepEqual(diffOutputs(OUT, CONFIG, dir).sort(), ["dist/theme.css","dist/tokens.manifest.json","dist/tokens.d.ts","dist/tokens.ts"].sort());
});
