const REF_RE = /^\{([^}]+)\}$/;
const baseKey = (k) => k.replace(/\//g, "-");
function* enumerateLeaves(tokens) {
  if (tokens.scales) for (const [c, r] of Object.entries(tokens.scales)) for (const [s, leaf] of Object.entries(r)) yield { key: `${c}-${s}`, leaf };
  if (tokens.semantic) for (const [name, leaf] of Object.entries(tokens.semantic)) yield { key: name, leaf };
  if (tokens.base) for (const [k, leaf] of Object.entries(tokens.base)) yield { key: baseKey(k), leaf };
}
function leafAtPath(tokens, path) { let n = tokens; for (const p of path.split(".")) { if (n == null || typeof n !== "object") return undefined; n = n[p]; } return n; }
function pickModeValue(tokens, leaf, mode) {
  if (mode === "dark" && !("dark" in leaf)) {
    if (tokens.meta && tokens.meta.autoMirrorDark === true) return leaf.light;
    throw new Error(`resolveRefs: leaf missing "dark" and meta.autoMirrorDark is not true`);
  }
  return leaf[mode];
}
function resolveOne(tokens, value, mode, seen) {
  const m = REF_RE.exec(value); if (!m) return value;
  const path = m[1];
  if (seen.has(path)) throw new Error(`resolveRefs: reference cycle detected: ${[...seen, path].join(" -> ")}`);
  seen.add(path);
  const leaf = leafAtPath(tokens, path);
  if (leaf == null || typeof leaf !== "object" || leaf.light === undefined) throw new Error(`resolveRefs: unresolvable reference {${path}} in mode "${mode}"`);
  return resolveOne(tokens, pickModeValue(tokens, leaf, mode), mode, seen);
}
export function resolveRefs(tokens, mode) {
  const out = {};
  for (const { key, leaf } of enumerateLeaves(tokens)) out[key] = resolveOne(tokens, pickModeValue(tokens, leaf, mode), mode, new Set());
  return out;
}
