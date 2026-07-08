#!/usr/bin/env node
import { pathToFileURL, fileURLToPath } from "node:url";
import { copyFileSync, existsSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadInputs } from "../src/load.mjs";
import { expandScales } from "../src/scale-gen.mjs";
import { validate } from "../src/validate.mjs";
import { resolveRefs } from "../src/resolve-refs.mjs";
import { renderCss } from "../src/render-css.mjs";
import { renderTokens } from "../src/render-tokens.mjs";
import { renderManifest } from "../src/render-manifest.mjs";
import { atomicWrite, diffOutputs } from "../src/atomic-write.mjs";

const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const STARTERS = ["tokens.json", "design.config.json"];
const USAGE = "usage: ds init [--force] | ds build [--check]";

export function parseArgs(argv) {
  const sub = argv[0];
  if (sub === "init") {
    let force = false;
    for (const a of argv.slice(1)) { if (a === "--force") force = true; else return { error: `unknown flag: ${a}` }; }
    return { subcommand: "init", force };
  }
  if (sub !== "build") return { error: `unknown command: ${sub ?? "(none)"}` };
  let check = false;
  for (const a of argv.slice(1)) { if (a === "--check") check = true; else return { error: `unknown flag: ${a}` }; }
  return { subcommand: "build", check };
}

function runInit(parsed, cwd) {
  for (const f of STARTERS) {
    if (existsSync(join(cwd, f)) && !parsed.force) {
      process.stderr.write(`ds: ${f} already exists (use --force to overwrite)\n`);
      return 1;
    }
  }
  for (const f of STARTERS) copyFileSync(join(PKG_ROOT, f), join(cwd, f));
  process.stdout.write(`ds: created ${STARTERS.join(", ")}. Edit scales.brand in tokens.json, then run \`ds build\`.\n`);
  return 0;
}

function suppress(resolved, config) {
  const out = { ...resolved };
  for (const [k, emit] of Object.entries(config.baseColorEmit || {})) if (emit === false) delete out[k.replace(/\//g, "-")];
  return out;
}
function renderAll(projectDir) {
  const loaded = loadInputs(projectDir);
  const tokens = expandScales(loaded.tokens, loaded.config);
  const { config, schemas, sourceHash } = loaded;
  validate(tokens, config, schemas);
  const light = suppress(resolveRefs(tokens, "light"), config);
  const dark = suppress(resolveRefs(tokens, "dark"), config);
  const css = renderCss(light, dark, config, sourceHash);
  const { ts, dts } = renderTokens(tokens, config, sourceHash);
  const manifest = JSON.stringify(renderManifest(light, dark, config, sourceHash), null, 2) + "\n";
  return { outputs: { css, ts, dts, manifest }, config };
}
function runBuild(parsed, cwd) {
  let r; try { r = renderAll(cwd); } catch (e) { process.stderr.write(`error: ${e.message}\n`); return 1; }
  const { outputs, config } = r;
  if (parsed.check) {
    const d = diffOutputs(outputs, config, cwd);
    if (d.length === 0) { process.stdout.write("ds: dist is up to date\n"); return 0; }
    process.stderr.write(`ds: dist is STALE — ${d.length} file(s) differ:\n${d.map((f) => "  - " + f).join("\n")}\nRun \`ds build\`.\n`); return 1;
  }
  try { atomicWrite(outputs, config, cwd); } catch (e) { process.stderr.write(`error: atomic write failed: ${e.message}\n`); return 1; }
  process.stdout.write("ds: wrote dist (theme.css, tokens.ts, tokens.d.ts, tokens.manifest.json)\n"); return 0;
}

export function buildCli(argv, cwd = process.cwd()) {
  const parsed = parseArgs(argv);
  if (parsed.error) { process.stderr.write(`ds: ${parsed.error}\n${USAGE}\n`); return 2; }
  if (parsed.subcommand === "init") return runInit(parsed, cwd);
  return runBuild(parsed, cwd);
}
// npm links a package's bin as a symlink in node_modules/.bin. Node resolves
// symlinks for import.meta.url but NOT for process.argv[1], so comparing them
// raw makes this guard false on every installed invocation (`npx ds …`), and the
// CLI silently no-ops. Resolve argv[1] through realpath before comparing.
const invokedHref = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : "";
if (import.meta.url === invokedHref) process.exit(buildCli(process.argv.slice(2)));
