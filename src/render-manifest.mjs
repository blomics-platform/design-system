const stepRe = /-\d{2,3}$/;
const isPrimitive = (k) => stepRe.test(k) || k === "white" || k === "black";
const colorVarNames = (map) => Object.keys(map).map((s) => "--color-" + s).sort();
const PRIMITIVE_STEPS = ["25", "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

export function renderManifest(resolvedLight, resolvedDark, config, sourceHash) {
  const keys = Object.keys(resolvedLight);
  const ramps = []; const seen = new Set();
  const role = { text: [], bg: [], border: [], fg: [] }; const utility = []; const alpha = [];
  const utilities = {};
  for (const k of keys) {
    if (k.startsWith("text-")) { role.text.push(k); if (k !== "text-white") utilities[k] = "--color-" + k; }
    else if (k.startsWith("bg-")) { role.bg.push(k); utilities[k] = "--color-" + k; }
    else if (k.startsWith("border-")) { role.border.push(k); utilities[k] = "--color-" + k; }
    else if (k.startsWith("fg-")) { role.fg.push(k); utilities[k] = "--color-" + k; }
    else if (k.startsWith("utility-")) { utility.push(k); utilities["bg-" + k] = "--color-" + k; utilities["text-" + k] = "--color-" + k; }
    else if (k.startsWith("alpha-")) { alpha.push(k); utilities["bg-" + k] = "--color-" + k; utilities["text-" + k] = "--color-" + k; }
    else if (isPrimitive(k)) { const m = k.match(/^(.+)-\d{2,3}$/); if (m && !seen.has(m[1])) { seen.add(m[1]); ramps.push(m[1]); } }
  }
  return {
    sourceHash, generator: "@blomics-platform/design-system", version: "0.2.0", darkSelector: config.darkSelector,
    primitives: { ramps, steps: PRIMITIVE_STEPS },
    colorVars: { light: colorVarNames(resolvedLight), dark: colorVarNames(resolvedDark) },
    roleTokens: role, utilityTokens: utility, alphaTokens: alpha, utilities,
  };
}
