import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdtempSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os"; import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";

// npm installs a package's bin as a SYMLINK in node_modules/.bin. Node resolves
// symlinks for import.meta.url but NOT for process.argv[1], so the main-module
// guard in bin/ds.mjs must realpath argv[1] — otherwise every installed
// invocation (`npx ds init`, `ds build`, npm scripts) silently no-ops with
// exit 0. The other CLI tests call buildCli() directly and bypass that guard, so
// this one must go THROUGH a symlink to lock the fix in.
const BIN = join(dirname(fileURLToPath(import.meta.url)), "..", "bin", "ds.mjs");

test("bin invoked via a symlink (npm .bin) actually runs init and writes starters", () => {
  const binDir = mkdtempSync(join(tmpdir(), "ds-binlink-"));
  const link = join(binDir, "ds"); // stand-in for node_modules/.bin/ds
  symlinkSync(BIN, link);
  const proj = mkdtempSync(join(tmpdir(), "ds-proj-"));
  const out = execFileSync(process.execPath, [link, "init"], { cwd: proj, encoding: "utf8" });
  assert.match(out, /created/, "init run via symlink should print its confirmation");
  for (const f of ["tokens.json", "design.config.json"])
    assert.ok(existsSync(join(proj, f)), `${f} should be created when the bin is run via a symlink`);
});

test("bin invoked via a symlink surfaces errors (unknown command exits non-zero)", () => {
  const binDir = mkdtempSync(join(tmpdir(), "ds-binlink-"));
  const link = join(binDir, "ds");
  symlinkSync(BIN, link);
  assert.throws(
    () => execFileSync(process.execPath, [link, "nope"], { stdio: "pipe" }),
    (e) => e.status === 2,
    "unknown command via symlink should exit 2, not silently no-op",
  );
});
