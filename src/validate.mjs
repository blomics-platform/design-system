const REF_RE = /^\{([^}]+)\}$/;
const COLOR_RE = /^(#|rgb|rgba|hsl|oklch|\{).+/;
function refPath(v) { const m = typeof v === "string" && v.match(REF_RE); return m ? m[1] : null; }
function lookupTarget(tokens, path) { let n = tokens; for (const p of path.split(".")) { if (n === null || typeof n !== "object") return undefined; n = n[p]; } return n; }
function pickValue(tokens, leaf, mode, autoMirror) {
  if (mode === "dark" && !("dark" in leaf)) { if (autoMirror) return leaf.light; throw new Error(`leaf missing 'dark' and autoMirrorDark off`); }
  return leaf[mode];
}
function resolveLeafValue(tokens, leaf, mode, autoMirror, seen) {
  let v = pickValue(tokens, leaf, mode, autoMirror);
  const path = refPath(v); if (path === null) return v;
  if (seen.has(path)) throw new Error(`Reference cycle at '${path}' (mode=${mode}).`);
  seen.add(path);
  const target = lookupTarget(tokens, path);
  if (target === undefined || typeof target !== "object" || target.light === undefined) throw new Error(`Unresolvable reference '{${path}}' (mode=${mode}).`);
  return resolveLeafValue(tokens, target, mode, autoMirror, seen);
}
function checkLeaf(leaf, where, autoMirror) {
  if (leaf === null || typeof leaf !== "object" || Array.isArray(leaf)) throw new Error(`Invalid token at ${where}: expected {light,dark} leaf.`);
  if (typeof leaf.light !== "string" || !COLOR_RE.test(leaf.light)) throw new Error(`Invalid token at ${where}: 'light' must be a CSS color or {ref}.`);
  if (leaf.dark === undefined) { if (!autoMirror) throw new Error(`Missing 'dark' at ${where}: set meta.autoMirrorDark=true or author dark.`); }
  else if (typeof leaf.dark !== "string" || !COLOR_RE.test(leaf.dark)) throw new Error(`Invalid token at ${where}: 'dark' must be a CSS color or {ref}.`);
  for (const k of Object.keys(leaf)) if (k !== "light" && k !== "dark") throw new Error(`Unknown key '${k}' at ${where}.`);
}
export function validate(tokens, config, schemas) {
  if (tokens === null || typeof tokens !== "object") throw new Error("Invalid tokens.json: top-level object expected.");
  // Anchor preflight (§0 BLOCKER 회귀 가드): base.white / base.black / text-white 존재 강제.
  for (const anchor of ["white", "black", "text-white"]) {
    const leaf = tokens.base && tokens.base[anchor];
    if (!leaf || typeof leaf !== "object" || typeof leaf.light !== "string")
      throw new Error(`Missing required base anchor '${anchor}': base.${anchor} must be a {light,dark} leaf.`);
  }
  const autoMirror = Boolean(tokens.meta && tokens.meta.autoMirrorDark);
  if (tokens.scales) for (const [c, ramp] of Object.entries(tokens.scales)) for (const [s, leaf] of Object.entries(ramp)) {
    if (!/^[0-9]{2,3}$/.test(s)) throw new Error(`Invalid scale shade '${s}' in scales.${c}.`);
    checkLeaf(leaf, `scales.${c}.${s}`, autoMirror);
  }
  if (tokens.base) for (const [k, leaf] of Object.entries(tokens.base)) {
    checkLeaf(leaf, `base.${JSON.stringify(k)}`, autoMirror);
    if (/^alpha-/.test(k)) {
      for (const mode of ["light", "dark"]) {
        const v = leaf[mode];
        if (typeof v !== "string" || !/^rgba\(/.test(v)) throw new Error(`Invalid alpha token 'base.${k}': '${mode}' must be an rgba(...) literal, got ${JSON.stringify(v)}.`);
      }
    }
  }
  // 신 스키마의 flat {name:leaf} semantic에도 base/scales와 동일한 per-leaf shape/색상 검사 적용.
  if (tokens.semantic) for (const [name, leaf] of Object.entries(tokens.semantic)) checkLeaf(leaf, `semantic.${JSON.stringify(name)}`, autoMirror);
    const walk = (leaf, where) => { for (const mode of ["light", "dark"]) { try { resolveLeafValue(tokens, leaf, mode, autoMirror, new Set()); } catch (e) { throw new Error(`${where}: ${e.message}`); } } };
    if (tokens.scales) for (const [c, r] of Object.entries(tokens.scales)) for (const [s, leaf] of Object.entries(r)) walk(leaf, `scales.${c}.${s}`);
    if (tokens.semantic) for (const [name, leaf] of Object.entries(tokens.semantic)) walk(leaf, `semantic.${JSON.stringify(name)}`);
    if (tokens.base) for (const [k, leaf] of Object.entries(tokens.base)) walk(leaf, `base.${JSON.stringify(k)}`);
    const baseColorEmit = config.baseColorEmit || {};
    const emitted = new Map();
    const claim = (suffix, src) => { if (emitted.has(suffix)) throw new Error(`Duplicate emitted var '--color-${suffix}': ${emitted.get(suffix)} & ${src}.`); emitted.set(suffix, src); };
    if (tokens.scales) for (const [c, r] of Object.entries(tokens.scales)) for (const s of Object.keys(r)) claim(`${c}-${s}`, `scales.${c}.${s}`);
    if (tokens.semantic) for (const name of Object.keys(tokens.semantic)) claim(name.replace(/\//g, "-"), `semantic.${JSON.stringify(name)}`);
    if (tokens.base) for (const k of Object.keys(tokens.base)) { if (baseColorEmit[k] === false) continue; claim(k.replace(/\//g, "-"), `base.${JSON.stringify(k)}`); }

  // @utility 이름중복 + Tailwind 자동생성 클래스 disjoint 게이트 (§8.2, 리뷰 blocker 해소).
  // Tailwind는 @theme --color-<stem>에서 text-<stem>/bg-<stem>/border-<stem>를 자동생성한다(fg-<stem>는 아님).
  const autoClasses = new Set();
  if (tokens.scales) for (const [c, r] of Object.entries(tokens.scales)) for (const s of Object.keys(r)) { autoClasses.add(`text-${c}-${s}`); autoClasses.add(`bg-${c}-${s}`); autoClasses.add(`border-${c}-${s}`); }
  for (const anchor of ["white", "black"]) { autoClasses.add(`text-${anchor}`); autoClasses.add(`bg-${anchor}`); autoClasses.add(`border-${anchor}`); }
  const utilNames = new Map(); // full className -> source key
  const claimUtil = (name, src) => {
    if (utilNames.has(name)) throw new Error(`Duplicate @utility '${name}': ${utilNames.get(name)} & ${src}.`);
    if (autoClasses.has(name)) throw new Error(`@utility '${name}' (${src}) collides with a Tailwind auto-generated primitive utility — role and primitive namespaces must be disjoint.`);
    utilNames.set(name, src);
  };
  if (tokens.base) for (const k of Object.keys(tokens.base)) {
    if (k === "white" || k === "black" || k === "text-white") continue; // 앵커 + text-white 화이트리스트(@utility 미발행)
    if (/^(text|bg|border|fg)-/.test(k)) claimUtil(k, `base.${JSON.stringify(k)}`);
    else if (/^(utility|alpha)-/.test(k)) { claimUtil(`bg-${k}`, `base.${JSON.stringify(k)}`); claimUtil(`text-${k}`, `base.${JSON.stringify(k)}`); }
  }

  // Brand 필수 스텝 프리플라이트 (§4.3): brand 램프가 있으면 50..950 전부 필요.
  if (tokens.scales && tokens.scales.brand) {
    for (const step of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"])
      if (tokens.scales.brand[step] === undefined) throw new Error(`brand ramp is missing required step '${step}': fill scales.brand.${step} (steps 50..950 are mandatory).`);
  }
}
