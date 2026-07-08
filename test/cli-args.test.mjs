import { test } from "node:test"; import assert from "node:assert/strict";
import { buildCli, parseArgs } from "../bin/ds.mjs";
test("no subcommand → parse error", () => { assert.ok(parseArgs([]).error); });
test("unknown subcommand → error naming it", () => { const p = parseArgs(["frobnicate"]); assert.ok(p.error && /frobnicate/.test(p.error)); });
test("unknown flag → error naming it", () => { const p = parseArgs(["build", "--wat"]); assert.ok(p.error && /--wat/.test(p.error)); });
test("build / build --check parse", () => {
  assert.deepEqual(parseArgs(["build"]), { subcommand: "build", check: false });
  assert.deepEqual(parseArgs(["build", "--check"]), { subcommand: "build", check: true });
});
test("buildCli returns non-zero exit for arg errors", () => {
  assert.notEqual(buildCli([]), 0);
  assert.notEqual(buildCli(["frob"]), 0);
  assert.notEqual(buildCli(["build", "--wat"]), 0);
});
