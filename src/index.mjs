// Programmatic API for @blomics-platform/design-system.
// The primary interface is the `ds` CLI (`ds init`, `ds build`); these exports
// let consumers run the same generator pipeline from their own build scripts.
export { loadInputs } from "./load.mjs";
export { hexToOklch, oklchToHex, formatOklch, expandScales } from "./scale-gen.mjs";
export { validate } from "./validate.mjs";
export { resolveRefs } from "./resolve-refs.mjs";
export { renderCss } from "./render-css.mjs";
export { renderTokens } from "./render-tokens.mjs";
export { renderManifest } from "./render-manifest.mjs";
export { atomicWrite, diffOutputs } from "./atomic-write.mjs";
