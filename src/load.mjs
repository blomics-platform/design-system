import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
function readJson(path) {
  let text; try { text = readFileSync(path, "utf8"); } catch (e) { throw new Error(`Cannot read ${path}: ${e.message}`); }
  try { return JSON.parse(text); } catch (e) { throw new Error(`Invalid JSON in ${path}: ${e.message}`); }
}
function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}
export function loadInputs(projectDir) {
  const tokens = readJson(join(projectDir, "tokens.json"));
  const config = readJson(join(projectDir, "design.config.json"));
  const schemas = { tokens: readJson(join(PKG_ROOT, "tokens.schema.json")), config: readJson(join(PKG_ROOT, "config.schema.json")) };
  const sourceHash = createHash("sha256").update(stableStringify(tokens)).update(" ").update(stableStringify(config)).digest("hex");
  return { tokens, config, schemas, sourceHash, projectDir };
}
