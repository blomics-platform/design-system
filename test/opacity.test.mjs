import { test } from "node:test"; import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, cpSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os"; import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url"; import { execFileSync } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(import.meta.url);
function tailwindCli() { try { return req.resolve("@tailwindcss/cli"); } catch { return null; } }
test("§13.7: opacity modifiers compile to color-mix over live --color-* vars", { skip: tailwindCli() ? false : "tailwindcss CLI not resolvable (peer dep not installed)" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "ds-opacity-"));
  cpSync(join(ROOT, "dist/theme.css"), join(dir, "theme.css"));
  writeFileSync(join(dir, "app.html"), '<div class="bg-brand-500/50 text-gray-900/70"></div>');
  writeFileSync(join(dir, "in.css"), '@import "tailwindcss";\n@import "./theme.css";\n@source "./app.html";\n');
  execFileSync(process.execPath, [tailwindCli(), "-i", join(dir, "in.css"), "-o", join(dir, "out.css")], { cwd: dir });
  const out = readFileSync(join(dir, "out.css"), "utf8");
  assert.ok(out.includes("color-mix("), "opacity modifier compiled to color-mix");
  for (const v of ["--color-brand-500", "--color-gray-900"]) {
    assert.ok(out.includes(v), `color-mix references ${v}`);
  }
});
