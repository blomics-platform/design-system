import { writeFileSync, mkdirSync, renameSync, rmSync, existsSync, readFileSync, openSync, fsyncSync, closeSync } from "node:fs";
import { join, dirname, basename } from "node:path";
function fsyncPath(p) { const fd = openSync(p, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } }
export function atomicWrite(outputs, config, projectDir) {
  const rel = config.output;
  const keys = Object.keys(rel);
  const distDir = join(projectDir, dirname(rel.css));
  const suffix = "." + process.pid + ".tmp";
  const tmpDir = distDir + suffix;
  try {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    for (const k of keys) { const p = join(tmpDir, basename(rel[k])); writeFileSync(p, outputs[k]); fsyncPath(p); }
    const backup = distDir + suffix + ".old";
    rmSync(backup, { recursive: true, force: true });
    if (existsSync(distDir)) renameSync(distDir, backup);
    renameSync(tmpDir, distDir);
    rmSync(backup, { recursive: true, force: true });
  } catch (e) {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(distDir, { recursive: true });
    for (const k of keys) { const abs = join(projectDir, rel[k]); const tmp = abs + suffix; writeFileSync(tmp, outputs[k]); fsyncPath(tmp); renameSync(tmp, abs); }
  }
}
export function diffOutputs(outputs, config, projectDir) {
  const rel = config.output;
  const changed = [];
  for (const k of Object.keys(rel)) {
    const abs = join(projectDir, rel[k]);
    let disk; try { disk = readFileSync(abs, "utf8"); } catch { disk = null; }
    if (disk !== outputs[k]) changed.push(rel[k]);
  }
  return changed;
}
