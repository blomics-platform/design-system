import { writeFileSync, mkdirSync, renameSync, rmSync, readFileSync, openSync, fsyncSync, closeSync } from "node:fs";
import { join, dirname } from "node:path";
function fsyncPath(p) { const fd = openSync(p, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } }
export function atomicWrite(outputs, config, projectDir) {
  const rel = config.output;
  const suffix = "." + process.pid + ".tmp";
  // 각 산출물을 형제 파일을 건드리지 않고 개별적으로 원자 쓰기한다:
  // 최종 경로 옆 temp 파일에 write + fsync 후 rename(같은 볼륨 내 rename은 원자적).
  //
  // dirname(output.css) 디렉토리 "전체"를 스왑(rename→rmSync)하면, 사용자가 output 을
  // 다른 파일이 있는 디렉토리(예: src/app, src/styles)로 지정한 경우 그 형제 파일들이
  // 통째로 삭제된다. 그래서 디렉토리 단위 스왑은 절대 하지 않는다.
  for (const k of Object.keys(rel)) {
    const abs = join(projectDir, rel[k]);
    mkdirSync(dirname(abs), { recursive: true });
    const tmp = abs + suffix;
    rmSync(tmp, { force: true });
    writeFileSync(tmp, outputs[k]);
    fsyncPath(tmp);
    renameSync(tmp, abs);
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
