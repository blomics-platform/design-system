import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
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
test("atomicWrite does NOT delete sibling files in the output dir (data-loss regression)", () => {
  // output 을 다른 소스가 있는 디렉토리(예: src/app)로 지정한 경우를 재현.
  const dir = stage();
  const shared = { output: { css: "app/theme.css", ts: "app/tokens.ts", dts: "app/tokens.d.ts", manifest: "app/tokens.manifest.json" } };
  mkdirSync(join(dir, "app/community"), { recursive: true });
  writeFileSync(join(dir, "app/globals.css"), "SIBLING-CSS");
  writeFileSync(join(dir, "app/community/page.tsx"), "SIBLING-ROUTE");
  atomicWrite(OUT, shared, dir);
  // 산출물은 정상 기록
  assert.equal(readFileSync(join(dir, "app/theme.css"), "utf8"), "/*css*/");
  // 형제 파일/디렉토리는 반드시 보존 (이전 디렉토리 스왑 방식은 이들을 삭제했음)
  assert.equal(readFileSync(join(dir, "app/globals.css"), "utf8"), "SIBLING-CSS");
  assert.equal(readFileSync(join(dir, "app/community/page.tsx"), "utf8"), "SIBLING-ROUTE");
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
