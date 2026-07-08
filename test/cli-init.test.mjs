import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os"; import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCli, parseArgs } from "../bin/ds.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = dirname(HERE);
const STARTERS = ["tokens.json", "design.config.json"];

const mkEmpty = () => mkdtemp(join(tmpdir(), "ds-init-"));

test("parseArgs init / init --force", () => {
  assert.deepEqual(parseArgs(["init"]), { subcommand: "init", force: false });
  assert.deepEqual(parseArgs(["init", "--force"]), { subcommand: "init", force: true });
  assert.ok(parseArgs(["init", "--wat"]).error);
});

test("init copies the package's starter tokens.json + design.config.json into cwd", async () => {
  const dir = await mkEmpty();
  assert.equal(buildCli(["init"], dir), 0);
  for (const f of STARTERS) {
    const got = await readFile(join(dir, f), "utf8");
    const src = await readFile(join(PKG_ROOT, f), "utf8");
    assert.equal(got, src, `${f} should match the package starter byte-for-byte`);
  }
});

test("init refuses to overwrite an existing starter and touches nothing", async () => {
  const dir = await mkEmpty();
  await writeFile(join(dir, "tokens.json"), "PREEXISTING\n");
  assert.notEqual(buildCli(["init"], dir), 0, "non-zero when a starter exists");
  assert.equal(await readFile(join(dir, "tokens.json"), "utf8"), "PREEXISTING\n", "existing file untouched");
  assert.ok(!(await readdir(dir)).includes("design.config.json"), "does not partially write the other starter");
});

test("init --force overwrites an existing starter", async () => {
  const dir = await mkEmpty();
  await writeFile(join(dir, "tokens.json"), "PREEXISTING\n");
  assert.equal(buildCli(["init", "--force"], dir), 0);
  const got = await readFile(join(dir, "tokens.json"), "utf8");
  const src = await readFile(join(PKG_ROOT, "tokens.json"), "utf8");
  assert.equal(got, src, "force replaces with the package starter");
});
