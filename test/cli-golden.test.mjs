import { test } from "node:test"; import assert from "node:assert/strict";
import { mkdtemp, cp, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os"; import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCli } from "../bin/ds.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, "fixtures");
const GOLD = join(HERE, "golden");
const DIST_FILES = ["theme.css", "tokens.ts", "tokens.d.ts", "tokens.manifest.json"];
const hashOf = (css) => /Source hash: ([0-9a-f]{64})/.exec(css)[1];

async function seedProject() {
  const dir = await mkdtemp(join(tmpdir(), "ds-cli-"));
  await cp(join(FIX, "tokens.min.json"), join(dir, "tokens.json"));
  await cp(join(FIX, "config.min.json"), join(dir, "design.config.json"));
  // 스키마는 로더가 PKG_ROOT에서 읽으므로 복사 불필요(의도적으로 생략).
  return dir;
}

test("build reproduces the committed golden files byte-for-byte", async () => {
  const dir = await seedProject();
  assert.equal(buildCli(["build"], dir), 0);
  for (const f of DIST_FILES) {
    const got = await readFile(join(dir, "dist", f), "utf8");
    const gold = await readFile(join(GOLD, f), "utf8");
    assert.equal(got, gold, `dist/${f} differs from golden`);
  }
});

test("build is idempotent and --check passes right after a build", async () => {
  const dir = await seedProject();
  assert.equal(buildCli(["build"], dir), 0);
  const first = await readFile(join(dir, "dist", "theme.css"), "utf8");
  assert.equal(buildCli(["build"], dir), 0);
  const second = await readFile(join(dir, "dist", "theme.css"), "utf8");
  assert.equal(first, second, "re-build is byte-identical");
  assert.equal(buildCli(["build", "--check"], dir), 0, "--check green after build");
});

test("--check returns non-zero after a dist file is tampered", async () => {
  const dir = await seedProject();
  assert.equal(buildCli(["build"], dir), 0);
  await writeFile(join(dir, "dist", "theme.css"), "/* tampered */\n");
  assert.notEqual(buildCli(["build", "--check"], dir), 0, "--check detects stale dist");
});

test("source hash is stable across rebuilds and changes only when inputs change", async () => {
  const dir = await seedProject();
  assert.equal(buildCli(["build"], dir), 0);
  const h1 = hashOf(await readFile(join(dir, "dist", "theme.css"), "utf8"));
  assert.equal(buildCli(["build"], dir), 0);
  const h1b = hashOf(await readFile(join(dir, "dist", "theme.css"), "utf8"));
  assert.equal(h1b, h1, "unchanged inputs → same hash");
  const tok = JSON.parse(await readFile(join(dir, "tokens.json"), "utf8"));
  tok.base["text-primary"].light = "#123456";
  await writeFile(join(dir, "tokens.json"), JSON.stringify(tok));
  assert.equal(buildCli(["build"], dir), 0);
  const h2 = hashOf(await readFile(join(dir, "dist", "theme.css"), "utf8"));
  assert.notEqual(h2, h1, "changed inputs → different hash");
});

test("no .tmp/.old leftovers in the project dir after build", async () => {
  const dir = await seedProject();
  assert.equal(buildCli(["build"], dir), 0);
  const leftovers = (await readdir(dir)).filter((n) => n.includes(".tmp") || n.includes(".old"));
  assert.deepEqual(leftovers, []);
});
