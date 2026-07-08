import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadInputs } from "../src/load.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures");
function stageProject() {
  const dir = mkdtempSync(join(tmpdir(), "ds-load-"));
  copyFileSync(join(FIX, "tokens.load.json"), join(dir, "tokens.json"));
  copyFileSync(join(FIX, "config.load.json"), join(dir, "design.config.json"));
  return dir;
}
test("loadInputs parses tokens, config, and both schemas", () => {
  const l = loadInputs(stageProject());
  assert.equal(l.tokens.meta.autoMirrorDark, false);
  assert.equal(l.tokens.scales.brand["600"].light, "#6941C6");
  assert.equal(l.tokens.base["text-primary"].light, "{scales.brand.600}");
  assert.deepEqual(l.tokens.semantic, {});
  assert.equal(l.config.darkSelector, '[data-gnb-theme="dark"]');
  assert.deepEqual(l.schemas.tokens.required, ["scales", "base"]);
  assert.ok(Array.isArray(l.schemas.config.required));
  assert.match(l.sourceHash, /^[0-9a-f]{64}$/);
});
test("sourceHash deterministic; changes on input change", () => {
  const a = loadInputs(stageProject()).sourceHash;
  const dirB = stageProject();
  assert.equal(loadInputs(dirB).sourceHash, a);
  const m = JSON.parse(readFileSync(join(dirB, "tokens.json"), "utf8"));
  m.base["text-primary"].light = "#000000";
  writeFileSync(join(dirB, "tokens.json"), JSON.stringify(m));
  assert.notEqual(loadInputs(dirB).sourceHash, a);
});
test("loadInputs throws readable error on invalid JSON", () => {
  const dir = stageProject();
  writeFileSync(join(dir, "tokens.json"), "{ not json ");
  assert.throws(() => loadInputs(dir), /tokens\.json/);
});
