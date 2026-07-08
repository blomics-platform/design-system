# @blomics-platform/design-system v0.2.0 — Untitled UI 토큰 모델 재편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** `@blomics-platform/design-system`을 6-슬롯 시맨틱+variant 헬퍼 모델에서 Untitled UI 정본 컬러 토큰 레이어(프리미티브 `@theme` + 역할/유틸/alpha `:root`+`@utility` + REAL 다크)로 전면 재편하고 v0.2.0 태그를 찍는다.

**아키텍처:** Untitled UI 3층 토큰 — Layer1 `scales`(방출 29램프×12스텝, gray는 light=gray/dark=gray-dark distinct, 27컬러 light==dark, brand 명시램프) + Layer2/3 `base`(앵커 3 + 역할 83 + 유틸 134 + alpha 20 = 240 flat). 제너레이터는 프리미티브를 `@theme`(inline 미사용)로, 역할/유틸/alpha를 `:root`+`[dark]` 플레인 var + `@utility` 패스로 방출한다. 다크는 `autoMirror`가 아니라 leaf의 per-mode 참조로 산출. variant 헬퍼(`render-variants`/`render-dts`)는 완전 제거. 시드 `tokens.json`은 `docs/tokens_extracted.json`을 읽는 1회성 변환 스크립트 `scripts/build-seed-tokens.mjs`로 생성한다.

**기술 스택:** Node.js ESM(.mjs, 순수 JS), 생성물 TypeScript(tokens.ts/.d.ts) + Tailwind v4(peer, 소비자측·리포 미설치→스모크 skip), 테스트 node:test
- 대상 레포: /Users/jang-gyeongtae/BPMG/blomics/design-system (기존 레포, main, v0.1.0 태그 존재 → v0.2.0)
- CLI: bin/ds.mjs (ds build / --check)
- Git: main 직접 커밋. 커밋 메시지 한국어 + Co-Authored-By 트레일러
- 스코프: 컬러 토큰 재편만. fortress 이관·비컬러 토큰 제외.

---

## 교차 절대원칙 (모든 태스크 작성자가 반드시 준수)

1. 앵커 참조는 `{base.white}`/`{base.black}` (`{white}`/`{black}` 아님). `resolveRefs`는 루트에서 walk.
2. `semantic`은 `{}`일 수 있다 — 존재를 절대 가정하지 말고 `if (tokens.semantic)`로 가드.
3. **`text-white`는 `:root` var이자 `TEXT_TOKENS` 이름이지만 `@utility`는 절대 발행 안 함** (화이트리스트).
4. **`@utility` 이름충돌 게이트는 "역할 클래스명 vs Tailwind 자동생성 클래스명(`text-`/`bg-`/`border-<stem>`)"의 FULL-NAME 비교로 한다. 접두사 stripping 후 bare stem 비교 금지** — 그러면 `fg-white`가 bare `white`로 오탐(실측: 정본에 `fg-white`={light:white,dark:white} 존재). 실제 충돌은 오직 `text-white` 1건.
5. `toRef`/스텝 정규식은 VALUE에만 적용, 유틸 NAME에는 절대 금지 (`_alt` 10개 보호).
6. `gray-dark`는 `gray.dark`로 흡수, 별도 scale 미방출.
7. alpha는 `rgba()` 리터럴 (color-mix 아님).
8. brand는 참조되는 50..950(11스텝) 전부 필수 (25 선택).
9. 카운트는 이름/방출집합으로 assert: 방출 scales 29(brand IN, gray-dark OUT), base 240, 프리미티브 var 350(=28컬러×12=336 + brand12 + white/black2, 실측 전 램프 12스텝 완비), 역할/유틸/alpha var 238, 총 `--color-*` 588, `@utility` 391(=83 역할 + 134×2 + 20×2), 접두 text21/bg31/border10/fg22.
10. Tailwind 특정 동작(프리미티브 다크 오버라이드·`_`@utility·opacity 드롭)은 사실이 아니라 스모크 게이트 가정. 실패 시 §7.1(b)/§8.3 폴백.

의존 순서: **cleanup → validate → resolve-refs → render-css → render-tokens-manifest → seed-gen → build-verify**. (엔진 편집(validate/resolve-refs)이 시드 검증보다 먼저; 렌더는 엔진+시드 뒤; bin 재배선은 render-tokens/render-manifest 뒤; 골든·전체빌드·태그는 전부 뒤.)

---

## Phase A — cleanup (Task 1–9)

### Task 1 — 구 variant 산출 파일 + render-dts 삭제
**Files:** `src/render-variants.mjs`, `src/render-dts.mjs`, `dist/variants.ts`, `dist/variants.d.ts`, `test/golden/variants.ts`, `test/golden/variants.d.ts`

> 순수 삭제. 8개 파일 모두 신모델에서 소비처 없음. `src/render-dts.mjs`(구 variants.d.ts emitter, SEMANTIC_COLORS/buttonVariants)도 포함 — 이 삭제가 없으면 dead code로 잔존한다(CONTRACT DELETE 대상). `bin/ds.mjs`는 아직 `render-variants`를 import하므로 이 커밋 후 bin 로드 스위트는 red(Task 22에서 해소). 이 커밋은 "파일 부재"만 검증.

- [ ] 삭제: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git rm src/render-variants.mjs src/render-dts.mjs dist/variants.ts dist/variants.d.ts test/golden/variants.ts test/golden/variants.d.ts`
- [ ] 부재 확인 (기대: 6줄 MISSING): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && for f in src/render-variants.mjs src/render-dts.mjs dist/variants.ts dist/variants.d.ts test/golden/variants.ts test/golden/variants.d.ts; do test -e "$f" && echo "STILL: $f" || echo "MISSING (ok): $f"; done`
- [ ] bin/render-dts 잔존 참조 확인 (기대: render-variants 1건만, render-dts 0건): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -rn "render-variants" bin/ src/ test/; echo "---"; grep -rn "render-dts" bin/ src/ test/ || echo "no render-dts refs (ok)"` (render-variants는 bin/ds.mjs L8 1건 → Task 22에서 제거; render-dts는 0건이어야 함)
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -m "$(cat <<'EOF'
chore: variant 산출 파일 삭제 (render-variants/render-dts + dist/variants.* + golden/variants.*)

v0.2.0 순수 토큰 레이어 전환으로 buttonVariants/getButtonClasses 생성기·
산출물·골든 제거. render-dts(구 variants.d.ts emitter)도 삭제. bin/ds.mjs
재배선은 render-tokens-manifest 그룹에서 수행.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 2 — 구 variant 테스트 삭제
**Files:** `test/render-variants.test.mjs`, `test/add-color.test.mjs`

- [ ] 참조 확인 (기대: 두 파일 매치): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -l "variants.ts\|getButtonClasses\|buttonVariants" test/render-variants.test.mjs test/add-color.test.mjs`
- [ ] 삭제: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git rm test/render-variants.test.mjs test/add-color.test.mjs`
- [ ] 부재 확인: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && for f in test/render-variants.test.mjs test/add-color.test.mjs; do test -e "$f" && echo "STILL: $f" || echo "MISSING (ok): $f"; done`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -m "$(cat <<'EOF'
test: 구 variant 테스트 삭제 (render-variants.test + add-color.test)

6패밀리 byte-exact·6-슬롯 add-color 워크플로 테스트는 신 토큰 모델에
대응물 없음. 삭제된 dist/variants.ts·renderVariants 소비 파일.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 3 — tokens.schema.json 재편 + load.test 스키마 단언 교체 (병합)
**Files:** `tokens.schema.json`, `test/load.test.mjs`

> `load.test.mjs`가 `l.schemas.tokens.$defs.semanticColor.required.length===6`(실측 L22)를 단언하므로 스키마 편집과 이 단언 교체를 한 커밋으로 묶는다. (fixture 의존 단언 `semantic.primary`(L20)/`config.colors`(L21)/hash-mutate(L31)는 Task 9에서 fixture와 함께 처리 — 이 태스크는 **L22만** 건드린다.)

- [ ] `tokens.schema.json` 전체 교체 (top-level required→`["scales","base"]`; semantic optional·빈객체 허용(minProperties 제거, 값→leaf); semanticColor 6-슬롯 $def 삭제; leaf/colorRef/explicitRamp/generateRamp/scaleRamp/meta KEEP; base additionalProperties=leaf KEEP):
```json
{
  "$id": "https://blomics.dev/design-system/tokens.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["scales", "base"],
  "additionalProperties": false,
  "properties": {
    "$schema": { "type": "string" },
    "meta": { "$ref": "#/$defs/meta" },
    "scales": { "type": "object", "additionalProperties": { "$ref": "#/$defs/scaleRamp" } },
    "semantic": { "type": "object", "additionalProperties": { "$ref": "#/$defs/leaf" } },
    "base": { "type": "object", "additionalProperties": { "$ref": "#/$defs/leaf" } }
  },
  "$defs": {
    "leaf": { "type": "object", "required": ["light", "dark"], "additionalProperties": false, "properties": { "light": { "$ref": "#/$defs/colorRef" }, "dark": { "$ref": "#/$defs/colorRef" } } },
    "colorRef": { "type": "string", "pattern": "^(#|rgb|rgba|hsl|oklch|\\{).+" },
    "explicitRamp": { "type": "object", "minProperties": 1, "propertyNames": { "pattern": "^[0-9]{2,3}$" }, "additionalProperties": { "$ref": "#/$defs/leaf" } },
    "generateRamp": { "type": "object", "required": ["$generate"], "additionalProperties": false, "properties": { "$generate": { "type": "object", "required": ["base"], "additionalProperties": false, "properties": { "base": { "$ref": "#/$defs/leaf" }, "anchor": { "type": "integer" } } } } },
    "scaleRamp": { "oneOf": [ { "$ref": "#/$defs/explicitRamp" }, { "$ref": "#/$defs/generateRamp" } ] },
    "meta": { "type": "object", "additionalProperties": false, "properties": { "autoMirrorDark": { "type": "boolean", "default": false } } }
  }
}
```
- [ ] 스키마 검증 (기대: required=[scales,base] / semantic.minProperties=undefined / semanticColor=GONE): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "const s=require('./tokens.schema.json'); console.log('required=',JSON.stringify(s.required)); console.log('semantic.minProperties=',s.properties.semantic.minProperties); console.log('semanticColor=',s.\$defs.semanticColor===undefined?'GONE':'PRESENT');"`
- [ ] `test/load.test.mjs` L22 단언만 교체 (Edit):
  - old: `  assert.equal(l.schemas.tokens.$defs.semanticColor.required.length, 6);`
  - new: `  assert.deepEqual(l.schemas.tokens.required, ["scales", "base"]);`
- [ ] load.test 스키마 단언 라인 green 확인 (fixture 의존 L20/L21은 아직 red 허용, 스키마 라인만 통과): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/load.test.mjs 2>&1 | grep -E "semanticColor" || echo "no semanticColor assert (ok)"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
refactor: tokens.schema 재편 — required=[scales,base], semantic optional/empty, 6-슬롯 삭제

top-level required 축소(semantic drop), semantic optional·빈객체 허용,
semanticColor 6-슬롯 $def 삭제. leaf/colorRef/explicitRamp/generateRamp/
scaleRamp/meta KEEP. load.test L22 semanticColor.required 단언을 신 required
단언으로 교체(fixture 의존 단언은 load fixture 태스크에서 처리).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 4 — config.schema.json 재편
**Files:** `config.schema.json`

> 실측 required L5 = `["classPrefix","darkSelector","darkVariantName","colors","variantFamilies","output"]` → 필드만 지우면 로드 검증 실패하므로 required도 축소. roleUtilities는 §14 Q7 하드코딩 기본이라 스키마 미추가(의도). scaleOutput default oklch→hex 전환은 §14 Q4 의도(design.config가 항상 명시하므로 무영향).

- [ ] `config.schema.json` 전체 교체:
```json
{
  "$id": "https://blomics.dev/design-system/config.schema.json",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["classPrefix", "darkSelector", "darkVariantName", "output"],
  "additionalProperties": false,
  "properties": {
    "$schema": { "type": "string" },
    "classPrefix": { "type": "string" },
    "darkSelector": { "type": "string" },
    "darkVariantName": { "type": "string" },
    "scaleOutput": { "type": "string", "enum": ["oklch", "hex"], "default": "hex" },
    "cssLayering": { "type": "string", "enum": ["plain", "inline-passthrough"], "default": "plain" },
    "output": { "type": "object", "required": ["css", "ts", "dts", "manifest"], "additionalProperties": false, "properties": { "css": { "type": "string" }, "ts": { "type": "string" }, "dts": { "type": "string" }, "manifest": { "type": "string" } } },
    "baseColorEmit": { "type": "object", "additionalProperties": { "type": "boolean" } }
  }
}
```
- [ ] 검증 (기대: required 축소, 5개 dead GONE, kept true): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "const s=require('./config.schema.json'); console.log('required=',JSON.stringify(s.required)); for(const k of ['colors','variantFamilies','slotOverrides','variantOverrides','helpers']) console.log(k+'=',s.properties[k]===undefined?'GONE':'PRESENT'); console.log('kept=',['classPrefix','darkSelector','darkVariantName','scaleOutput','cssLayering','output','baseColorEmit'].every(k=>s.properties[k]!==undefined));"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
refactor: config.schema 재편 — required 축소 + variant/6-슬롯 필드 제거

required를 [classPrefix,darkSelector,darkVariantName,output]로 축소
(colors·variantFamilies drop). colors/variantFamilies/slotOverrides/
variantOverrides/helpers property 삭제. scaleOutput default hex(§14 Q4,
design.config가 항상 명시하므로 무영향). roleUtilities는 하드코딩 기본
(§14 Q7)이라 미추가.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 5 — design.config.json 신모델화
**Files:** `design.config.json`

> 주의: seed-gen 태스크의 `build-seed-tokens.mjs`는 tokens.json만 쓰고 design.config.json은 **쓰지 않는다**(단일 소유권 — 리뷰 major 해소). 이 태스크가 design.config.json의 유일한 저작자.

- [ ] `design.config.json` 전체 교체:
```json
{
  "$schema": "@blomics-platform/design-system/config.schema.json",
  "classPrefix": "",
  "darkSelector": "[data-gnb-theme=\"dark\"]",
  "darkVariantName": "dark",
  "scaleOutput": "hex",
  "output": { "css": "dist/theme.css", "ts": "dist/tokens.ts", "dts": "dist/tokens.d.ts", "manifest": "dist/tokens.manifest.json" },
  "baseColorEmit": {}
}
```
- [ ] 검증 (기대: dead 5 GONE, output.ts/dts=tokens.*, scaleOutput=hex): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "const c=require('./design.config.json'); for(const k of ['colors','variantFamilies','slotOverrides','variantOverrides','helpers']) console.log(k+'=',c[k]===undefined?'GONE':'PRESENT'); console.log('output.ts=',c.output.ts,'output.dts=',c.output.dts,'scaleOutput=',c.scaleOutput);"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
refactor: design.config 신모델화 — variant 필드 제거, output tokens.*, scaleOutput hex

colors/variantFamilies/slotOverrides/variantOverrides/helpers 제거. output
파일명 tokens.*. scaleOutput:hex. baseColorEmit 빈객체. design.config.json은
이 파일이 유일 저작자(seed 스크립트는 tokens.json만 쓴다).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 6 — bin/ds.mjs suppress()의 config.colors/slotOverrides 커플링 제거
**Files:** `bin/ds.mjs`

> **범위 경계:** `renderVariants→renderTokens`, `renderManifest` model 인자 제거는 Task 22(render-tokens/manifest 존재 후). 여기서는 `suppress()`의 죽은·위험 코드(신 config.schema가 colors/slotOverrides 거부)만 축소. `renderVariants` import/호출은 Task 22까지 그대로 둔다.

- [ ] `bin/ds.mjs` `suppress()` 본문 축소 (Edit):
  - old:
```js
function suppress(resolved, config) {
  const out = { ...resolved };
  for (const [k, emit] of Object.entries(config.baseColorEmit || {})) if (emit === false) delete out[k.replace(/\//g, "-")];
  const so = config.slotOverrides || {}; const semantic = new Set(config.colors);
  for (const [color, spec] of Object.entries(so)) { if (!semantic.has(color)) continue; for (const slot of spec.omit || []) delete out[slot === "base" ? color : `${color}-${slot}`]; }
  return out;
}
```
  - new:
```js
function suppress(resolved, config) {
  const out = { ...resolved };
  for (const [k, emit] of Object.entries(config.baseColorEmit || {})) if (emit === false) delete out[k.replace(/\//g, "-")];
  return out;
}
```
- [ ] config.colors/slotOverrides 참조 부재 확인: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -nE "config\.colors|config\.slotOverrides|new Set\(config" bin/ds.mjs || echo "NO refs (ok)"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
refactor: bin/ds.mjs suppress()에서 config.colors/slotOverrides 커플링 제거

신 config.schema가 colors/slotOverrides를 거부하므로 죽은·위험 코드 제거.
baseColorEmit=false 필터만 유지. renderVariants→renderTokens 전환과
renderManifest model 인자 제거는 render-tokens-manifest 그룹에서 수행.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 7 — package.json 0.2.0 / exports tokens.* / description
**Files:** `package.json`

- [ ] 3개 Edit: `version` `0.1.0`→`0.2.0`; `description`→`"Untitled UI color token layer for Tailwind v4 (primitives + semantic/utility/alpha CSS vars & utilities)."`; `exports["."]` `{ types/import/default: ./dist/variants.* }`→`{ "types": "./dist/tokens.d.ts", "import": "./dist/tokens.ts", "default": "./dist/tokens.ts" }`. `./theme.css`·`./tokens`·`./config-schema`·`./tokens-schema`·`peerDependencies tailwindcss>=4.1.0` KEEP.
- [ ] 검증: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "const p=require('./package.json'); console.log(p.version, JSON.stringify(p.exports['.']), p.description.includes('Untitled UI'));"` (기대: `0.2.0 {"types":"./dist/tokens.d.ts",...} true`)
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
chore: package.json 0.2.0 — exports .→tokens.*, description Untitled UI

version 0.2.0(pre-1.0 minor로 BREAKING 표현), exports["."]→tokens.d.ts/
tokens.ts(variants drop), description Untitled UI 토큰 레이어. ./theme.css·
./tokens·./config-schema·./tokens-schema·peerDependencies KEEP.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 8 — fortress drift 아티팩트 제거 + completeness 임시 스텁
**Files:** `test/fixtures/fortress-root-vars.json`, `scripts/extract-fortress-vars.mjs`, `test/completeness.test.mjs`

> fortress는 범위 밖(§1.3). `completeness.test.mjs`는 fortress fixture를 readFileSync하므로 삭제 시 즉시 throw → skip 스텁으로 축소. 신 완전성 게이트는 build-verify(Task 27)에서 재작성. **실측: completeness.test.mjs에 fortress 참조는 3줄(12/25/26)이다** — grep 기대값에 3줄 포함.

- [ ] 삭제: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git rm test/fixtures/fortress-root-vars.json scripts/extract-fortress-vars.mjs`
- [ ] 참조 확인 (기대: **3줄** — 12/25/26): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -nE "fortress-root-vars|extract-fortress-vars" test/completeness.test.mjs`
- [ ] `test/completeness.test.mjs` 전체 교체(스텁):
```js
import { test } from "node:test";
// NOTE: 완전성 게이트 본문은 build-verify 그룹(신 seed dist 기반, 이름 기반)에서 재작성된다.
test("completeness gate — build-verify 그룹에서 재작성 예정", { skip: "pending v0.2.0 dist 재생성 (build-verify group)" }, () => {});
```
- [ ] 검증 (기대: 두 경로 부재, completeness skip 1/fail 0): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && for f in test/fixtures/fortress-root-vars.json scripts/extract-fortress-vars.mjs; do test -e "$f" && echo "STILL: $f" || echo "MISSING (ok): $f"; done && node --test test/completeness.test.mjs 2>&1 | grep -E "# pass|# fail|# skipped"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
test: fortress drift 아티팩트 제거 + completeness 임시 스텁화

fortress는 v0.2.0 범위 밖(§1.3). fortress-root-vars.json·extract-fortress-vars.mjs
삭제. completeness.test.mjs는 fortress fixture 로드로 즉시 throw하므로 skip
스텁으로 축소 — 신 이름 기반 게이트는 build-verify 그룹에서 재작성.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 9 — load.test + 구 shape fixture 신모델화 + cycle fixture 변환
**Files:** `test/load.test.mjs`, `test/fixtures/tokens.load.json`, `test/fixtures/config.load.json`, `test/fixtures/tokens.cycle.json`

> Task 3에서 L22는 이미 신 required 단언으로 바뀌었다. 이 태스크는 fixture를 신모델로 바꾸고 **L20(`semantic.primary`)·L21(`config.colors`)·L31(hash-mutate `semantic.primary.base.light`)** 단언을 신 base 토큰 기준으로 교체한다(리뷰 major: 두 태스크가 같은 라인을 충돌 편집하지 않도록 L22와 L20/L21/L31을 분리). 추가로 `tokens.cycle.json`이 구 6-슬롯 semantic을 담아 신 스키마 무효이므로 신모델로 변환(리뷰 minor).

- [ ] `test/fixtures/tokens.load.json` 교체:
```json
{
  "meta": { "autoMirrorDark": false },
  "scales": { "brand": { "500": { "light": "#7F56D9", "dark": "#7F56D9" }, "600": { "light": "#6941C6", "dark": "#6941C6" } } },
  "semantic": {},
  "base": { "white": { "light": "#FFFFFF", "dark": "#FFFFFF" }, "text-primary": { "light": "{scales.brand.600}", "dark": "{scales.brand.500}" } }
}
```
- [ ] `test/fixtures/config.load.json` 교체:
```json
{ "classPrefix": "", "darkSelector": "[data-gnb-theme=\"dark\"]", "darkVariantName": "dark", "scaleOutput": "hex", "output": { "css": "dist/theme.css", "ts": "dist/tokens.ts", "dts": "dist/tokens.d.ts", "manifest": "dist/tokens.manifest.json" } }
```
- [ ] `test/fixtures/tokens.cycle.json` 교체(신모델, base 사이클 유지):
```json
{ "meta": { "autoMirrorDark": false }, "scales": { "brand": { "600": { "light": "#6941C6", "dark": "#6941C6" } } }, "semantic": {}, "base": { "a": { "light": "{base.b}", "dark": "{base.b}" }, "b": { "light": "{base.a}", "dark": "{base.a}" } } }
```
- [ ] `test/load.test.mjs` 첫 테스트 본문 Edit (autoMirrorDark true→false, semantic.primary/config.colors 제거, scales/base/semantic:{}/darkSelector로 교체; L22 required 단언은 Task 3에서 이미 교체됨 — 아래 old_string은 그 교체 반영):
  - old:
```js
  assert.equal(l.tokens.meta.autoMirrorDark, true);
  assert.equal(l.tokens.semantic.primary.base.light, "#2563eb");
  assert.deepEqual(l.config.colors, ["primary"]);
  assert.deepEqual(l.schemas.tokens.required, ["scales", "base"]);
```
  - new:
```js
  assert.equal(l.tokens.meta.autoMirrorDark, false);
  assert.equal(l.tokens.scales.brand["600"].light, "#6941C6");
  assert.equal(l.tokens.base["text-primary"].light, "{scales.brand.600}");
  assert.deepEqual(l.tokens.semantic, {});
  assert.equal(l.config.darkSelector, '[data-gnb-theme="dark"]');
  assert.deepEqual(l.schemas.tokens.required, ["scales", "base"]);
```
- [ ] `test/load.test.mjs` hash-mutate 라인 Edit:
  - old: `  m.semantic.primary.base.light = "#000000";`
  - new: `  m.base["text-primary"].light = "#000000";`
- [ ] load.test green (기대: `# fail 0`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/load.test.mjs 2>&1 | grep -E "# tests|# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
test: load/cycle fixture 신모델화 — 6-슬롯/config.colors 단언 제거

tokens.load/config.load를 scales+base+semantic:{} 신 shape으로. load.test
단언을 semantic.primary/config.colors→scales.brand/base.text-primary/
darkSelector로, hash-mutate를 base.text-primary.light로 교체. tokens.cycle을
신모델 base 사이클로 변환(구 6-슬롯 semantic은 신 스키마 무효).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Phase B — validate (Task 10–17)

> 엄격 TDD. `test/validate.test.mjs`를 신모델 하네스로 재작성(RED)한 뒤 `src/validate.mjs`를 단계별로 편집(GREEN). validate()는 body에서 `schemas`를 읽지 않으므로 3-arg 시그니처 유지.

### Task 10 — RED: validate 신모델 해피 하네스 + semantic 부재/빈객체 비-throw
**Files:** `test/validate.test.mjs`

- [ ] `test/validate.test.mjs` 전체를 신 하네스로 교체:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "../src/validate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = dirname(HERE);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const SCHEMAS = { tokens: readJson(join(PKG, "tokens.schema.json")), config: readJson(join(PKG, "config.schema.json")) };
const CONFIG = { classPrefix: "", darkSelector: '[data-gnb-theme="dark"]', darkVariantName: "dark", output: { css: "dist/theme.css", ts: "dist/tokens.ts", dts: "dist/tokens.d.ts", manifest: "dist/tokens.manifest.json" }, baseColorEmit: {} };

function makeTokens() {
  return {
    scales: {
      gray: { "50": { light: "#F9FAFB", dark: "#F5F5F6" }, "400": { light: "#98A2B3", dark: "#94969C" }, "900": { light: "#101828", dark: "#161B26" }, "950": { light: "#0C111D", dark: "#0C111D" } },
      error: { "300": { light: "#FDA29B", dark: "#FDA29B" }, "400": { light: "#F97066", dark: "#F97066" }, "600": { light: "#D92D20", dark: "#D92D20" } },
      brand: { "50": { light: "#F4F3FF", dark: "#F4F3FF" }, "100": { light: "#EBE9FE", dark: "#EBE9FE" }, "200": { light: "#D9D6FE", dark: "#D9D6FE" }, "300": { light: "#BDB4FE", dark: "#BDB4FE" }, "400": { light: "#9B8AFB", dark: "#9B8AFB" }, "500": { light: "#7A5AF8", dark: "#7A5AF8" }, "600": { light: "#6938EF", dark: "#6938EF" }, "700": { light: "#5925DC", dark: "#5925DC" }, "800": { light: "#4A1FB8", dark: "#4A1FB8" }, "900": { light: "#3E1C96", dark: "#3E1C96" }, "950": { light: "#27115F", dark: "#27115F" } },
    },
    semantic: {},
    base: {
      white: { light: "#FFFFFF", dark: "#FFFFFF" },
      black: { light: "#000000", dark: "#000000" },
      "text-white": { light: "#FFFFFF", dark: "#FFFFFF" },
      "text-primary": { light: "{scales.gray.900}", dark: "{scales.gray.50}" },
      "text-primary_on-brand": { light: "{base.white}", dark: "{scales.gray.50}" },
      "bg-primary": { light: "{base.white}", dark: "{scales.gray.950}" },
      "border-error": { light: "{scales.error.300}", dark: "{scales.error.400}" },
      "fg-primary": { light: "{scales.gray.900}", dark: "{base.white}" },
      "fg-white": { light: "{base.white}", dark: "{base.white}" },
      "utility-brand-600": { light: "{scales.brand.600}", dark: "{scales.brand.400}" },
      "alpha-white-10": { light: "rgba(255,255,255,0.1)", dark: "rgba(12,17,29,0.1)" },
      "alpha-black-50": { light: "rgba(0,0,0,0.5)", dark: "rgba(255,255,255,0.5)" },
    },
  };
}

test("validate passes for new-model tokens (scales + semantic:{} + base)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("validate does NOT throw when tokens.semantic is entirely absent", () => { const t = makeTokens(); delete t.semantic; assert.doesNotThrow(() => validate(t, CONFIG, SCHEMAS)); });
test("validate does NOT throw when tokens.semantic is an empty object", () => { const t = makeTokens(); t.semantic = {}; assert.doesNotThrow(() => validate(t, CONFIG, SCHEMAS)); });
```
> 주의: 하네스에 `fg-white`를 포함시켜 stem-disjoint 게이트가 fg-white를 오탐하지 않음을 이후 태스크에서 잠근다(리뷰 blocker).
- [ ] RED 확인 (기대: 첫 3개 fail — `'semantic' minProperties>=1` throw): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/validate.test.mjs 2>&1 | grep -E "not ok|minProperties|# fail" | head`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/validate.test.mjs && git commit -m "$(cat <<'EOF'
test(validate): 신모델 해피 하네스 + semantic 부재/빈객체 비-throw 실패 테스트

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 11 — GREEN: semantic 강제(L28–29) 제거 + 모든 semantic 순회 가드
**Files:** `src/validate.mjs`

- [ ] L28–29 두 줄 삭제:
```js
  if (!tokens.semantic || typeof tokens.semantic !== "object") throw new Error("Invalid tokens.json: 'semantic' required.");
  if (Object.keys(tokens.semantic).length < 1) throw new Error("Invalid tokens.json: 'semantic' minProperties>=1.");
```
- [ ] L37 `for (const [c, slots] of Object.entries(tokens.semantic)) {` → `if (tokens.semantic) for (const [c, slots] of Object.entries(tokens.semantic)) {`
- [ ] L56 `    for (const [c, slots] of Object.entries(tokens.semantic)) for (const [s, leaf] of Object.entries(slots)) walk(leaf, ` semantic.${c}.${s}` );` 앞에 `if (tokens.semantic)` 가드 추가.
- [ ] L63 `    for (const [c, slots] of Object.entries(tokens.semantic)) { const omit = ...` 앞에 `if (tokens.semantic)` 가드 추가.
- [ ] 첫 3개 테스트 통과 확인(단, config.colors 검사 L47이 아직 남아 있으면 `'colors' must be an array` throw — 다음 태스크에서 제거; 이는 예상 상태): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/validate.test.mjs 2>&1 | grep -E "colors|minProperties|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
fix(validate): semantic 존재/minProperties 강제 제거 + 모든 semantic 순회 if 가드

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 12 — RED: 6-슬롯/config.colors/slotOverrides 검사 제거 회귀
**Files:** `test/validate.test.mjs`

- [ ] append:
```js
test("config without `colors` array does not throw (config.colors check removed)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("a stray slotOverrides key does not throw (slotOverrides typo check removed)", () => { const cfg = { ...CONFIG, slotOverrides: { nonexistent: { omit: ["hover"] } } }; assert.doesNotThrow(() => validate(makeTokens(), cfg, SCHEMAS)); });
test("no 6-slot completeness is enforced on base role tokens", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
```
- [ ] RED 확인 (기대: `colors` array fail): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/validate.test.mjs 2>&1 | grep -E "colors|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/validate.test.mjs && git commit -m "$(cat <<'EOF'
test(validate): config.colors/slotOverrides/6-슬롯 검사 제거 회귀 실패 테스트

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 13 — GREEN: SLOT_ORDER/config.colors/slotOverrides typo 제거
**Files:** `src/validate.mjs`

- [ ] L1 `const SLOT_ORDER = [...]` 삭제.
- [ ] `if (tokens.semantic)` 가드된 6-슬롯 완전성 블록(L36–46 영역: `const slotOverrides = ...` 부터 semantic slot 검사 loop 전체) 삭제. (base per-leaf `checkLeaf` loop L35는 유지.)
- [ ] config.colors subset + slotOverrides typo 블록(L47–53) 삭제.
- [ ] 잔존 확인 (기대: SLOT_ORDER 0 / config.colors 0 / slotOverrides는 `const so=...` 1건만): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -n "SLOT_ORDER\|config.colors\|slotOverrides" src/validate.mjs`
- [ ] 전체 green (기대: `# fail 0`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/validate.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
refactor(validate): SLOT_ORDER 완전성/config.colors 부분집합/slotOverrides typo 검사 제거

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 14 — KEEP 케이스(leaf/rgba/ref/cycle/unresolvable/dup) 신모델 이식 + 앵커 프리플라이트
**Files:** `test/validate.test.mjs`, `src/validate.mjs`

- [ ] KEEP 테스트 append (base 기반; GREEN-on-write for KEEP 로직):
```js
test("{ref} leaves are accepted", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("rgba() literal leaf is accepted", () => { const t = makeTokens(); t.base = { ...t.base, "alpha-black-99": { light: "rgba(0,0,0,0.99)", dark: "rgba(255,255,255,0.99)" } }; assert.doesNotThrow(() => validate(t, CONFIG, SCHEMAS)); });
test("a leaf with an unknown key throws", () => { const t = makeTokens(); t.base = { ...t.base, weird: { light: "#000000", dark: "#000000", extra: "#fff" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /Unknown key 'extra'/i); });
test("a leaf whose light is not a color/{ref} throws", () => { const t = makeTokens(); t.base = { ...t.base, bad: { light: "notacolor", dark: "#000000" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /'light' must be a CSS color/i); });
test("unresolvable {ref} in base throws", () => { const t = makeTokens(); t.base = { ...t.base, ghost: { light: "{scales.gray.999}", dark: "{scales.gray.999}" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /unresolv|gray\.999/i); });
test("a reference cycle in base throws", () => { const t = makeTokens(); t.base = { ...t.base, a: { light: "{base.b}", dark: "{base.b}" }, b: { light: "{base.a}", dark: "{base.a}" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /cycle|circular/i); });
test("duplicate emitted --color-* var throws", () => { const t = makeTokens(); t.base = { ...t.base, "text/primary": { light: "#000000", dark: "#000000" } }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /duplicate/i); });
test("{base.white} anchor ref resolves (positive)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("missing base.white anchor throws", () => { const t = makeTokens(); delete t.base.white; assert.throws(() => validate(t, CONFIG, SCHEMAS), /base\.white|anchor/i); });
test("missing base.black anchor throws", () => { const t = makeTokens(); delete t.base.black; t.base["needs-black"] = { light: "{base.black}", dark: "{base.black}" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /base\.black|anchor/i); });
test("missing text-white anchor throws", () => { const t = makeTokens(); delete t.base["text-white"]; assert.throws(() => validate(t, CONFIG, SCHEMAS), /text-white|anchor/i); });
```
- [ ] `src/validate.mjs` 앵커 프리플라이트 추가 — top-level object 체크 직후, `const autoMirror = ...` 직전:
```js
  // Anchor preflight (§0 BLOCKER 회귀 가드): base.white / base.black / text-white 존재 강제.
  for (const anchor of ["white", "black", "text-white"]) {
    const leaf = tokens.base && tokens.base[anchor];
    if (!leaf || typeof leaf !== "object" || typeof leaf.light !== "string")
      throw new Error(`Missing required base anchor '${anchor}': base.${anchor} must be a {light,dark} leaf.`);
  }
```
- [ ] green (기대 `# fail 0`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/validate.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
feat(validate): KEEP 케이스(leaf/rgba/ref/cycle/dup) 신모델 이식 + base 앵커 프리플라이트

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 15 — alpha rgba 형식 검사 (RED→GREEN)
**Files:** `test/validate.test.mjs`, `src/validate.mjs`

- [ ] 테스트 append:
```js
test("alpha-* rgba light+dark pass", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("alpha-* light as {ref} throws", () => { const t = makeTokens(); t.base["alpha-white-99"] = { light: "{scales.gray.900}", dark: "rgba(12,17,29,0.99)" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /alpha.*rgba|rgba.*alpha/i); });
test("alpha-* dark as hex throws", () => { const t = makeTokens(); t.base["alpha-black-99"] = { light: "rgba(0,0,0,0.99)", dark: "#000000" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /alpha.*rgba|rgba.*alpha/i); });
```
- [ ] RED 확인, 그 후 `src/validate.mjs` base-leaf loop 교체 — `if (tokens.base) for (const [k, leaf] of Object.entries(tokens.base)) checkLeaf(leaf, ` base.${JSON.stringify(k)}` , autoMirror);` 를:
```js
  if (tokens.base) for (const [k, leaf] of Object.entries(tokens.base)) {
    checkLeaf(leaf, `base.${JSON.stringify(k)}`, autoMirror);
    if (/^alpha-/.test(k)) {
      for (const mode of ["light", "dark"]) {
        const v = leaf[mode];
        if (typeof v !== "string" || !/^rgba\(/.test(v)) throw new Error(`Invalid alpha token 'base.${k}': '${mode}' must be an rgba(...) literal, got ${JSON.stringify(v)}.`);
      }
    }
  }
```
- [ ] green: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/validate.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
feat(validate): alpha-* 토큰 rgba() 리터럴 형식 검사 (RED→GREEN)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 16 — @utility 이름중복 + stem-disjoint 게이트 (FULL-NAME 비교, fg-white 무오탐)
**Files:** `test/validate.test.mjs`, `src/validate.mjs`

> **리뷰 blocker 해소:** 게이트는 역할 클래스 FULL NAME을 Tailwind 자동생성 클래스(`text-`/`bg-`/`border-<stem>`, `fg-`는 자동생성 안 됨)와 비교한다. 접두사 stripping 후 bare stem 비교 금지(그러면 `fg-white`→`white`가 오탐). 실측: 정본에 `fg-white` 존재하며 오직 `text-white`만 실제 충돌.

- [ ] 테스트 append (fg-white PASS, text-gray-900 THROW, bg-error-400 THROW, dup THROW):
```js
test("fg-white is NOT a collision (fg- utils are not Tailwind-auto)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("text-white role token is whitelisted (no @utility)", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("role token text-gray-900 collides with Tailwind auto text-gray-900 -> throws", () => { const t = makeTokens(); t.base["text-gray-900"] = { light: "{scales.gray.900}", dark: "{scales.gray.50}" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /text-gray-900|collision|disjoint/i); });
test("role token bg-error-400 collides with Tailwind auto bg-error-400 -> throws", () => { const t = makeTokens(); t.base["bg-error-400"] = { light: "{scales.error.400}", dark: "{scales.error.400}" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /bg-error-400|collision|disjoint/i); });
test("two role tokens producing same @utility name throw", () => { const t = makeTokens(); t.base["bg-utility-brand-600"] = { light: "{scales.brand.600}", dark: "{scales.brand.400}" }; assert.throws(() => validate(t, CONFIG, SCHEMAS), /duplicate|collision|utility-brand-600/i); });
```
- [ ] `src/validate.mjs` — validate body 끝(claim 블록 뒤)에 게이트 추가:
```js
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
```
> `fg-white` → full name `fg-white` ∉ autoClasses(fg- 미생성) → PASS. `text-gray-900` → ∈ autoClasses → THROW. `bg-utility-brand-600` role vs `utility-brand-600`의 emitted `bg-utility-brand-600` → utilNames dup THROW.
- [ ] green (기대 `# fail 0`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/validate.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
feat(validate): @utility 이름중복 + Tailwind 자동클래스 disjoint 게이트(FULL-NAME 비교)

역할 클래스 FULL NAME을 Tailwind 자동생성 클래스(text-/bg-/border-<stem>)와
비교. fg-<stem>는 자동생성 안 되므로 fg-white 무오탐(리뷰 blocker 해소).
text-white는 @utility 화이트리스트로 스킵.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 17 — brand 필수 스텝(50..950) 프리플라이트 (RED→GREEN) + 스윕
**Files:** `test/validate.test.mjs`, `src/validate.mjs`

- [ ] 테스트 append:
```js
test("full brand ramp 50..950 passes", () => { assert.doesNotThrow(() => validate(makeTokens(), CONFIG, SCHEMAS)); });
test("brand missing 500 throws", () => { const t = makeTokens(); delete t.scales.brand["500"]; assert.throws(() => validate(t, CONFIG, SCHEMAS), /brand.*500|required.*step/i); });
test("brand missing 950 throws", () => { const t = makeTokens(); delete t.scales.brand["950"]; assert.throws(() => validate(t, CONFIG, SCHEMAS), /brand.*950|required.*step/i); });
test("no brand ramp does NOT trigger preflight", () => { const t = makeTokens(); delete t.scales.brand; delete t.base["utility-brand-600"]; assert.doesNotThrow(() => validate(t, CONFIG, SCHEMAS)); });
```
- [ ] `src/validate.mjs` body 끝에 추가:
```js
  // Brand 필수 스텝 프리플라이트 (§4.3): brand 램프가 있으면 50..950 전부 필요.
  if (tokens.scales && tokens.scales.brand) {
    for (const step of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"])
      if (tokens.scales.brand[step] === undefined) throw new Error(`brand ramp is missing required step '${step}': fill scales.brand.${step} (steps 50..950 are mandatory).`);
  }
```
- [ ] 전체 green: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/validate.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 잔재 부재 확인: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -n "SLOT_ORDER\|config.colors\|'semantic' required\|minProperties>=1" src/validate.mjs || echo "clean"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
feat(validate): brand 램프 필수 스텝(50..950) 프리플라이트 추가 + 그룹 스윕

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Phase C — resolve-refs (Task 18)

### Task 18 — enumerateLeaves semantic 가드 (RED→GREEN) + 테스트/픽스처 재작성
**Files:** `test/resolve-refs.test.mjs`, `test/fixtures/tokens.resolve.json`, `src/resolve-refs.mjs`

> 실측 근본원인: `enumerateLeaves`(L6)가 `Object.entries(tokens.semantic)`를 무조건 실행 → semantic 부재 시 `Cannot convert undefined or null to object` throw. 유일한 프로덕션 변경은 L6에 `if (tokens.semantic)` 가드 추가.

- [ ] `test/fixtures/tokens.resolve.json` 교체(scales gray distinct/error identical/brand + semantic:{} + base 앵커·`{base.*}`·2-hop `ring→{base.bg-brand-solid}→{scales.brand.600}` + `_alt`):
```json
{
  "meta": { "autoMirrorDark": false },
  "scales": {
    "gray":  { "50": { "light": "#F9FAFB", "dark": "#F5F5F6" }, "900": { "light": "#101828", "dark": "#161B26" }, "950": { "light": "#0C111D", "dark": "#0C111D" } },
    "error": { "300": { "light": "#FDA29B", "dark": "#FDA29B" }, "400": { "light": "#F97066", "dark": "#F97066" } },
    "brand": { "500": { "light": "#7F56D9", "dark": "#7F56D9" }, "600": { "light": "#6941C6", "dark": "#6941C6" }, "700": { "light": "#53389E", "dark": "#53389E" } }
  },
  "semantic": {},
  "base": {
    "white": { "light": "#FFFFFF", "dark": "#FFFFFF" },
    "black": { "light": "#000000", "dark": "#000000" },
    "text-white": { "light": "#FFFFFF", "dark": "#FFFFFF" },
    "text-primary": { "light": "{scales.gray.900}", "dark": "{scales.gray.50}" },
    "bg-primary": { "light": "{base.white}", "dark": "{scales.gray.950}" },
    "bg-brand-solid": { "light": "{scales.brand.600}", "dark": "{scales.brand.600}" },
    "border-error": { "light": "{scales.error.300}", "dark": "{scales.error.400}" },
    "fg-primary": { "light": "{scales.gray.900}", "dark": "{base.white}" },
    "utility-brand-600_alt": { "light": "{scales.brand.600}", "dark": "{scales.gray.900}" },
    "ring": { "light": "{base.bg-brand-solid}", "dark": "{base.bg-brand-solid}" }
  }
}
```
- [ ] `test/resolve-refs.test.mjs` 전체 교체(신모델 스위트 — enumerate 키순서, 리터럴/앵커, `{base.white}` 루트-워크, single/2-hop, per-mode 발산, `_alt` 불투명, semantic 부재/빈 비-throw, cycle, unresolvable, autoMirror). 핵심 케이스:
```js
import { test } from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
import { resolveRefs } from "../src/resolve-refs.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)); const load = (n) => JSON.parse(readFileSync(join(HERE, "fixtures", n), "utf8"));

test("enumerate scales-then-base key order (semantic empty)", () => {
  const L = resolveRefs(load("tokens.resolve.json"), "light");
  assert.deepEqual(Object.keys(L), ["gray-50","gray-900","gray-950","error-300","error-400","brand-500","brand-600","brand-700","white","black","text-white","text-primary","bg-primary","bg-brand-solid","border-error","fg-primary","utility-brand-600_alt","ring"]);
});
test("{base.white} anchor ref resolves via root-walk", () => { const L = resolveRefs(load("tokens.resolve.json"), "light"); const D = resolveRefs(load("tokens.resolve.json"), "dark"); assert.equal(L["bg-primary"], "#FFFFFF"); assert.equal(D["fg-primary"], "#FFFFFF"); });
test("single-hop {scales.*} per-mode", () => { const t = load("tokens.resolve.json"); const L = resolveRefs(t, "light"); const D = resolveRefs(t, "dark"); assert.equal(L["text-primary"], "#101828"); assert.equal(D["text-primary"], "#F5F5F6"); });
test("per-mode divergence gray distinct / error identical / anchor split", () => { const t = load("tokens.resolve.json"); const L = resolveRefs(t, "light"); const D = resolveRefs(t, "dark"); assert.notEqual(L["gray-50"], D["gray-50"]); assert.equal(L["gray-950"], D["gray-950"]); assert.equal(L["border-error"], "#FDA29B"); assert.equal(D["border-error"], "#F97066"); assert.notEqual(D["fg-primary"], D["text-primary"]); });
test("_alt NAME opaque, VALUE resolves", () => { const t = load("tokens.resolve.json"); const L = resolveRefs(t, "light"); const D = resolveRefs(t, "dark"); assert.ok("utility-brand-600_alt" in L); assert.equal(L["utility-brand-600_alt"], "#6941C6"); assert.equal(D["utility-brand-600_alt"], "#161B26"); });
test("2-hop folds both modes", () => { const t = load("tokens.resolve.json"); const L = resolveRefs(t, "light"); const D = resolveRefs(t, "dark"); assert.equal(L["ring"], "#6941C6"); assert.equal(L["ring"], L["bg-brand-solid"]); });
test("resolveRefs does NOT throw when semantic absent", () => { const t = { scales: { gray: { "900": { light: "#101828", dark: "#161B26" } } }, base: { white: { light: "#FFFFFF", dark: "#FFFFFF" }, "bg-primary": { light: "{base.white}", dark: "{scales.gray.900}" } } }; assert.doesNotThrow(() => resolveRefs(t, "light")); assert.equal(resolveRefs(t, "dark")["bg-primary"], "#161B26"); });
test("resolveRefs does NOT throw when semantic empty {}", () => { const t = { scales: { gray: { "900": { light: "#101828", dark: "#161B26" } } }, semantic: {}, base: { white: { light: "#FFFFFF", dark: "#FFFFFF" } } }; assert.doesNotThrow(() => resolveRefs(t, "light")); assert.deepEqual(Object.keys(resolveRefs(t, "light")), ["gray-900", "white"]); });
test("cycle is hard error", () => { const t = load("tokens.cycle.json"); assert.throws(() => resolveRefs(t, "light"), /cycle detected/i); });
test("unresolvable is hard error", () => { const t = { scales: { brand: { "600": { light: "#6941C6", dark: "#6941C6" } } }, semantic: {}, base: { "bg-brand-solid": { light: "{scales.brand.999}", dark: "#000" } } }; assert.throws(() => resolveRefs(t, "light"), /unresolvable reference/i); });
test("autoMirrorDark mirrors light through light-only step", () => { const t = { meta: { autoMirrorDark: true }, scales: { brand: { "600": { light: "#6941C6" } } }, semantic: {}, base: { "bg-brand-solid": { light: "{scales.brand.600}" } } }; assert.equal(resolveRefs(t, "dark")["bg-brand-solid"], "#6941C6"); });
```
- [ ] RED 확인 (기대: semantic-absent/empty 케이스가 `Cannot convert undefined` throw): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/resolve-refs.test.mjs 2>&1 | grep -E "Cannot convert|# fail"`
- [ ] `src/resolve-refs.mjs` L6 가드 (Edit, `if (tokens.semantic)` 추가만):
  - old: `  for (const [c, slots] of Object.entries(tokens.semantic)) for (const [s, leaf] of Object.entries(slots)) yield { key: semanticKey(c, s), leaf };`
  - new: `  if (tokens.semantic) for (const [c, slots] of Object.entries(tokens.semantic)) for (const [s, leaf] of Object.entries(slots)) yield { key: semanticKey(c, s), leaf };`
- [ ] green (기대 `# fail 0`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/resolve-refs.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/resolve-refs.mjs test/resolve-refs.test.mjs test/fixtures/tokens.resolve.json && git commit -m "$(cat <<'EOF'
fix(resolve-refs): semantic 부재/빈 객체 시 enumerateLeaves 크래시 가드

enumerateLeaves L6의 Object.entries(tokens.semantic)를 if 가드해 semantic이
없거나 {}일 때 throw 제거. scales+base 열거, baseKey, per-mode/hop resolveOne,
{base.*} 루트워크, cycle/unresolvable/autoMirror 동작 불변. 테스트를 신모델
(scales+base+{base.*})로 재작성.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Phase D — render-css (Task 19–21)

### Task 19 — render-css 헬퍼 입력 신모델화 (실패 픽스처)
**Files:** `test/helpers/render-css-inputs.mjs`

- [ ] `test/helpers/render-css-inputs.mjs` 전체 교체 — resolveRefs 출력 모양(프리미티브 `<ramp>-<step>` + white/black 앵커 + 역할 text-*/bg-*/border-*/fg-* + utility-* + alpha-*)의 대표 소집합. `resolvedLight`/`resolvedDark`(gray distinct, 나머지 동일; text-primary·fg-primary·border-error dark 발산), `config`(colors 없음, scaleOutput hex, output tokens.*), `sourceHash`. 핵심 값: `gray-900` light `#101828`/dark `#161b26`, `gray-50` light `#f9fafb`/dark `#f5f5f6`, `text-primary` light `#101828`/dark `#f5f5f6`, `fg-primary` light `#101828`/dark `#ffffff`, `border-error` light `#fda29b`/dark `#f97066`, `bg-brand-solid` light==dark `#6941c6`, `text-white` `#ffffff`(양 모드), `utility-brand-600` light `#6941c6`/dark `#7f56d9`, `alpha-black-50` light `rgba(0,0,0,0.5)`/dark `rgba(255,255,255,0.5)`.
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/helpers/render-css-inputs.mjs && git commit -m "$(cat <<'EOF'
test(render-css): 헬퍼 입력을 신모델 resolved 맵으로 교체

프리미티브 스텝/앵커/역할/유틸/alpha 키를 resolveRefs 출력 모양대로 담은
대표 픽스처. config에서 colors/variantFamilies/slotOverrides 제거.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 20 — render-css 테스트 신방출 재작성 (RED)
**Files:** `test/render-css.test.mjs`

- [ ] `test/render-css.test.mjs` 전체 교체 — 구 단언(6-슬롯/config.colors/dark-re-emit-every/--color-primary) 제거, 신방출 assert: (1) 헤더+`@custom-variant`, 타임스탬프 부재, 결정론; (2) `@theme`에 프리미티브 스텝+white/black만(역할/유틸/alpha var 부재); (3) `@theme` 순서 램프삽입순→스텝오름차순; (4) 프리미티브 `[dark]`는 gray 스텝(light≠dark)만, 950/비-gray 생략; (5) `:root`에 역할/유틸/alpha(+`--color-text-white`), 프리미티브 스텝 부재; (6) 역할 `[dark]`는 dark≠light delta만; (7) `@utility` 패스 프리픽스→property, utility/alpha는 bg-+text- 양쪽; (8) `@utility text-white` 부재 + `--color-text-white` var 존재. 블록 슬라이싱은 brace 헬퍼 사용, `.includes()`/`\s*:` 화이트스페이스 관대 매칭.
- [ ] RED 확인 (기대: `config.colors is not iterable` 또는 @utility 미포함 fail, `# fail`>0): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/render-css.test.mjs 2>&1 | tail -15`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/render-css.test.mjs && git commit -m "$(cat <<'EOF'
test(render-css): 신방출 형태로 재작성 (RED)

@theme 프리미티브 온리, :root 역할/유틸/alpha, 프리미티브·역할 [dark] delta,
@utility 프리픽스->property 패스, @utility text-white 부재, 결정론 단언.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 21 — render-css emitBody 재작성 (GREEN) + opacity 재타겟
**Files:** `src/render-css.mjs`, `test/opacity.test.mjs`

> **분류 우선순위 핵심:** 역할/유틸/alpha 프리픽스를 먼저 판정, 나머지(진짜 `<ramp>-<step>` + white/black)만 프리미티브. `utility-brand-600`은 트레일링 숫자여도 `utility-` 프리픽스로 먼저 잡아 오분류 방지. `text-white`는 `@utility` 화이트리스트 스킵(`--color-text-white` var는 발행). declLines 들여쓰기는 2-space로 통일(모든 골든 재생성되므로 무해 — 리뷰 minor 확인).

- [ ] `src/render-css.mjs` 전체 재작성:
```js
// v0.2.0 Untitled UI 방출. 분류는 프리픽스 우선(utility-brand-600 오분류 방지).
const ROLE_PREFIXES = ["text-", "bg-", "border-", "fg-"];
const UTIL_PREFIXES = ["utility-", "alpha-"];
const ROLE_PROP = { "text-": "color", "bg-": "background-color", "border-": "border-color", "fg-": "color" };
const UTILITY_SKIP = new Set(["text-white"]); // --color-white가 이미 text-white 유틸 생성

function customVariantLine(config) { const s = config.darkSelector; return `@custom-variant ${config.darkVariantName} (&:where(${s}, ${s} *));`; }
function header(h) { return `/* AUTO-GENERATED by @blomics-platform/design-system — DO NOT EDIT. Source hash: ${h}.\n   Edit tokens.json / design.config.json and run \`ds build\`.\n   NOTE: 소비자 globals.css가 \`@import "tailwindcss";\` 를 이 파일 import 위에 두어야 한다. */`; }

const hasPrefix = (k, ps) => ps.some((p) => k.startsWith(p));
const isRole = (k) => hasPrefix(k, ROLE_PREFIXES);
const isUtil = (k) => hasPrefix(k, UTIL_PREFIXES);
const isPrimitive = (k) => !isRole(k) && !isUtil(k) && (/-\d{2,3}$/.test(k) || k === "white" || k === "black");

function primitiveOrder(keys) {
  const rampOrder = new Map(); let idx = 0;
  const parsed = keys.map((k) => { const m = k.match(/^(.+)-(\d{2,3})$/); if (m) { if (!rampOrder.has(m[1])) rampOrder.set(m[1], idx++); return { k, ramp: m[1], step: Number(m[2]) }; } if (!rampOrder.has(k)) rampOrder.set(k, idx++); return { k, ramp: k, step: -1 }; });
  return parsed.sort((a, b) => (rampOrder.get(a.ramp) - rampOrder.get(b.ramp)) || (a.step - b.step)).map((p) => p.k);
}
const declLines = (keys, map) => keys.map((k) => "  --color-" + k + ": " + map[k] + ";");

function utilRule(className, prop, varKey) { return `@utility ${className} { ${prop}: var(--color-${varKey}); }`; }
function emitUtilities(roleUtilKeys) {
  const out = [];
  for (const k of roleUtilKeys) {
    if (UTILITY_SKIP.has(k)) continue;
    if (k.startsWith("utility-") || k.startsWith("alpha-")) { out.push(utilRule("bg-" + k, "background-color", k)); out.push(utilRule("text-" + k, "color", k)); continue; }
    const prefix = ROLE_PREFIXES.find((p) => k.startsWith(p));
    out.push(utilRule(k, ROLE_PROP[prefix], k));
  }
  return out;
}

export function renderCss(resolvedLight, resolvedDark, config, sourceHash) {
  const keys = Object.keys(resolvedLight);
  const primKeys = keys.filter(isPrimitive);
  const roleUtilKeys = keys.filter((k) => isRole(k) || isUtil(k));
  const lines = [header(sourceHash), "", customVariantLine(config), ""];
  // (2) @theme 프리미티브만
  const primOrdered = primitiveOrder(primKeys);
  lines.push("@theme {"); lines.push(...declLines(primOrdered, resolvedLight)); lines.push("}", "");
  // (3) 프리미티브 [dark] delta
  const primDark = primOrdered.filter((k) => resolvedDark[k] !== resolvedLight[k]);
  lines.push(config.darkSelector + " {"); lines.push(...declLines(primDark, resolvedDark)); lines.push("}", "");
  // (4) :root 역할/유틸/alpha (삽입순, text-white var 포함)
  lines.push(":root {"); lines.push(...declLines(roleUtilKeys, resolvedLight)); lines.push("}", "");
  // (5) 역할/유틸/alpha [dark] delta
  const roleDark = roleUtilKeys.filter((k) => resolvedDark[k] !== resolvedLight[k]);
  lines.push(config.darkSelector + " {"); lines.push(...declLines(roleDark, resolvedDark)); lines.push("}", "");
  // (6) @utility 패스
  lines.push(...emitUtilities(roleUtilKeys));
  return lines.join("\n");
}
```
- [ ] render-css green (기대 `# fail 0`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/render-css.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] `test/opacity.test.mjs` 재타겟(skip-guarded, tailwind CLI `createRequire.resolve('@tailwindcss/cli')` 가드): 프리미티브 `bg-brand-500/50`·`text-gray-900/70`가 `color-mix(... var(--color-brand-500) 50% ...)`/`var(--color-gray-900)` 참조로 컴파일되는지. (구 `--color-primary`/`--color-surface-hover` 단언 제거.)
- [ ] opacity 실행(tailwind 미설치 → skip, fail 0): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/opacity.test.mjs 2>&1 | grep -E "# fail|# skipped"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/render-css.mjs test/opacity.test.mjs && git commit -m "$(cat <<'EOF'
feat(render-css): emitBody 재작성 — @theme/:root/[dark]/@utility 분기 라우팅

프리픽스 우선 분류(utility-brand-600 오분류 방지), 프리미티브→@theme,
역할/유틸/alpha→:root, [dark] delta만 재선언, @utility 패스(utility/alpha는
bg-+text- 양쪽, text-white 화이트리스트 스킵). opacity.test 프리미티브 재타겟.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Phase E — render-tokens-manifest (Task 22–25)

### Task 22 — render-tokens.mjs (RED→GREEN)
**Files:** `test/render-tokens.test.mjs`, `src/render-tokens.mjs`

> **리뷰 blocker 해소:** 이 그룹은 render-tokens 구현·render-manifest 재작성·bin 재배선 3개를 전부 실 태스크로 넣는다.

- [ ] `test/render-tokens.test.mjs` 생성(인라인 tokens 픽스처 — scales 삽입순 brand/gray/error, base 앵커+역할+util+alpha+text-white). 단언: `{ts,dts}` 문자열·헤더; `PRIMITIVE_RAMPS=["brand","gray","error"] as const`(삽입순); `PRIMITIVE_STEPS=["25","50","100","200","300","400","500","600","700","800","900","950"] as const`; 역할 리스트 프리픽스 분할(white/black 제외, `text-white`는 TEXT_TOKENS **포함**); `UTILITY_TOKENS` verbatim(`_alt` 이름 분리 금지); `ALPHA_TOKENS` 별도; 각 리스트 유니온 타입; dts는 `export declare const X: readonly [...]` + 타입 alias(`as const` 부재); `buttonVariants`/`getButtonClasses`/`SEMANTIC_COLORS` 부재; 결정론.
- [ ] RED 확인 (기대: `Cannot find module .../render-tokens.mjs`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/render-tokens.test.mjs 2>&1 | tail -5`
- [ ] `src/render-tokens.mjs` 생성:
```js
const HEADER = (h) => `/* AUTO-GENERATED by @blomics-platform/design-system — DO NOT EDIT. Source hash: ${h}.\n   Edit tokens.json / design.config.json and run \`ds build\`. */`;
const PRIMITIVE_STEPS = ["25", "50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const q = (s) => JSON.stringify(s);
const arr = (names) => "[" + names.map(q).join(", ") + "]";

function partition(baseKeys) {
  const g = { text: [], bg: [], border: [], fg: [], utility: [], alpha: [] };
  for (const k of baseKeys) {
    if (k === "white" || k === "black") continue; // 앵커는 역할 리스트 제외
    if (k.startsWith("text-")) g.text.push(k);
    else if (k.startsWith("bg-")) g.bg.push(k);
    else if (k.startsWith("border-")) g.border.push(k);
    else if (k.startsWith("fg-")) g.fg.push(k);
    else if (k.startsWith("utility-")) g.utility.push(k);
    else if (k.startsWith("alpha-")) g.alpha.push(k);
  }
  return g;
}

export function renderTokens(tokens, config, sourceHash) {
  const ramps = Object.keys(tokens.scales);
  const g = partition(Object.keys(tokens.base)); // text-white는 text-로 시작 → TEXT_TOKENS 포함
  const LISTS = [
    ["PRIMITIVE_RAMPS", ramps, "PrimitiveRamp"], ["PRIMITIVE_STEPS", PRIMITIVE_STEPS, "PrimitiveStep"],
    ["TEXT_TOKENS", g.text, "TextToken"], ["BG_TOKENS", g.bg, "BgToken"], ["BORDER_TOKENS", g.border, "BorderToken"],
    ["FG_TOKENS", g.fg, "FgToken"], ["UTILITY_TOKENS", g.utility, "UtilityToken"], ["ALPHA_TOKENS", g.alpha, "AlphaToken"],
  ];
  const tsLines = [HEADER(sourceHash), ""];
  for (const [name, names] of LISTS) tsLines.push(`export const ${name} = ${arr(names)} as const;`);
  tsLines.push("");
  for (const [name, , alias] of LISTS) tsLines.push(`export type ${alias} = (typeof ${name})[number];`);
  const dtsLines = [HEADER(sourceHash), ""];
  for (const [name, names] of LISTS) dtsLines.push(`export declare const ${name}: readonly ${arr(names)};`);
  dtsLines.push("");
  for (const [name, , alias] of LISTS) dtsLines.push(`export type ${alias} = (typeof ${name})[number];`);
  return { ts: tsLines.join("\n") + "\n", dts: dtsLines.join("\n") + "\n" };
}
```
- [ ] green (기대 `# fail 0`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/render-tokens.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/render-tokens.mjs test/render-tokens.test.mjs && git commit -m "$(cat <<'EOF'
feat(render-tokens): tokens.ts/d.ts 이름 상수·유니온 타입 방출

PRIMITIVE_RAMPS(scales 삽입순)/PRIMITIVE_STEPS(12) + base 프리픽스 분할
(text-white 포함, white/black 제외) + UTILITY_TOKENS verbatim(_alt 미분리) +
ALPHA_TOKENS. ts는 as const, dts는 declare readonly. buttonVariants 없음.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 23 — render-manifest.mjs 재작성 (RED→GREEN)
**Files:** `test/render-manifest.test.mjs`, `src/render-manifest.mjs`

> 신 시그니처 `renderManifest(resolvedLight, resolvedDark, config, sourceHash)` — **model 인자 제거**. `variantKeys`/`semanticColors`/`computeOmittedVars`/`omittedVars` 제거. 키 shape로 분류(프리미티브=`-<digits>`+white/black, 역할=text/bg/border/fg-, util=utility-, alpha=alpha-). `utilities` 맵은 text-white className 제외(그러나 `--color-text-white`는 colorVars에 존재).

- [ ] `test/render-manifest.test.mjs` 전체 재작성 — 인라인 resolvedLight/resolvedDark(프리미티브 스텝 + white/black + 역할 text21/bg31 대표 소집합 + utility + alpha + text-white). 단언: 신 시그니처(no model); `version:"0.2.0"`; `darkSelector`; `primitives.ramps`/`.steps`; `roleTokens.text/bg/border/fg` 카운트(픽스처 소집합 기준); `utilityTokens` verbatim; `alphaTokens`; `utilities` 매핑에 `text-white` className 부재하나 `colorVars.light`에 `--color-text-white` 존재; `variantKeys`/`semanticColors`/`omittedVars` 키 부재.
- [ ] RED 확인, 그 후 `src/render-manifest.mjs` 전체 교체:
```js
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
    if (isPrimitive(k)) { const m = k.match(/^(.+)-\d{2,3}$/); if (m && !seen.has(m[1])) { seen.add(m[1]); ramps.push(m[1]); } continue; }
    if (k.startsWith("text-")) { role.text.push(k); if (k !== "text-white") utilities[k] = "--color-" + k; }
    else if (k.startsWith("bg-")) { role.bg.push(k); utilities[k] = "--color-" + k; }
    else if (k.startsWith("border-")) { role.border.push(k); utilities[k] = "--color-" + k; }
    else if (k.startsWith("fg-")) { role.fg.push(k); utilities[k] = "--color-" + k; }
    else if (k.startsWith("utility-")) { utility.push(k); utilities["bg-" + k] = "--color-" + k; utilities["text-" + k] = "--color-" + k; }
    else if (k.startsWith("alpha-")) { alpha.push(k); utilities["bg-" + k] = "--color-" + k; utilities["text-" + k] = "--color-" + k; }
  }
  return {
    sourceHash, generator: "@blomics-platform/design-system", version: "0.2.0", darkSelector: config.darkSelector,
    primitives: { ramps, steps: PRIMITIVE_STEPS },
    colorVars: { light: colorVarNames(resolvedLight), dark: colorVarNames(resolvedDark) },
    roleTokens: role, utilityTokens: utility, alphaTokens: alpha, utilities,
  };
}
```
- [ ] green: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/render-manifest.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/render-manifest.mjs test/render-manifest.test.mjs && git commit -m "$(cat <<'EOF'
refactor(render-manifest): model 인자 제거 + 신 shape (version 0.2.0/roleTokens/utilityTokens/utilities)

renderManifest(light,dark,config,hash). variantKeys/semanticColors/omittedVars
제거. 키 shape 분류. utilities 맵은 text-white 제외(그러나 --color-text-white는
colorVars에 존재).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 24 — bin/ds.mjs 재배선 (renderVariants→renderTokens, model 제거, 성공 메시지)
**Files:** `bin/ds.mjs`, `test/cli-args.test.mjs`

> **리뷰 blocker 해소:** 이 태스크가 없으면 buildCli 호출 태스크가 전부 `Cannot find module render-variants.mjs`로 죽는다. 반드시 골든 재생성·전체빌드 전에 랜딩.

- [ ] `bin/ds.mjs` L8 import 교체: `import { renderVariants } from "../src/render-variants.mjs";` → `import { renderTokens } from "../src/render-tokens.mjs";`
- [ ] L34 교체: `const { ts, dts, model } = renderVariants(tokens, config, sourceHash);` → `const { ts, dts } = renderTokens(tokens, config, sourceHash);`
- [ ] L35 교체: `const manifest = JSON.stringify(renderManifest(light, dark, model, config, sourceHash), null, 2) + "\n";` → `const manifest = JSON.stringify(renderManifest(light, dark, config, sourceHash), null, 2) + "\n";`
- [ ] L47 성공 메시지 교체: `"ds: wrote dist (theme.css, variants.ts, variants.d.ts, tokens.manifest.json)\n"` → `"ds: wrote dist (theme.css, tokens.ts, tokens.d.ts, tokens.manifest.json)\n"`
- [ ] `test/cli-args.test.mjs`가 파일명 상수/성공 메시지를 단언하면 tokens.* 로 조정(그 외 parseArgs 로직 KEEP).
- [ ] bin 로드 확인 (기대: exit 2 usage, render-variants import 에러 아님): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node ./bin/ds.mjs 2>&1 | head -2; echo "exit=$?"`
- [ ] cli-args green: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/cli-args.test.mjs 2>&1 | grep -E "# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add bin/ds.mjs test/cli-args.test.mjs && git commit -m "$(cat <<'EOF'
refactor(bin): renderVariants→renderTokens, renderManifest model 인자 제거, 성공 메시지 tokens.*

renderAll이 renderTokens{ts,dts} + renderManifest(light,dark,config,hash)를
호출. suppress()는 baseColorEmit만(cleanup에서 처리 완료). parseArgs/--check/
atomicWrite/diffOutputs KEEP.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 25 — atomic-write.test 파일명 상수 조정 (있으면)
**Files:** `test/atomic-write.test.mjs`

- [ ] `test/atomic-write.test.mjs`가 `variants.ts`/`variants.d.ts` 파일명을 참조하면 `tokens.ts`/`tokens.d.ts`로 조정. 로직은 KEEP. (참조 없으면 no-op.)
- [ ] green: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/atomic-write.test.mjs 2>&1 | grep -E "# fail"`
- [ ] 변경 있으면 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -am "$(cat <<'EOF'
test(atomic-write): 파일명 상수 tokens.* 조정

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)" || echo "no changes"
```

---

## Phase F — seed-gen (Task 26–31)

> 엄격 TDD. `scripts/build-seed-tokens.mjs`를 스텁→toRef→alphaVal→buildSeedTokens 순으로 채운다. **design.config.json은 쓰지 않는다**(Task 5가 유일 저작자 — 리뷰 major).

### Task 26 — 스캐폴드 + toRef (RED→GREEN)
**Files:** `test/build-seed-tokens.test.mjs`, `scripts/build-seed-tokens.mjs`

- [ ] `scripts/build-seed-tokens.mjs` 스텁 생성(export `toRef`/`alphaVal`/`buildSeedTokens`, 전부 `throw new Error("not implemented")`).
- [ ] `test/build-seed-tokens.test.mjs` 생성 — toRef 케이스: `white→{base.white}`, `black→{base.black}`, `text-white→#FFFFFF`, `gray-900→{scales.gray.900}`, `brand-600→{scales.brand.600}`, 다중하이픈 `blue-dark-500→{scales.blue-dark.500}`/`orange-dark-700→{scales.orange-dark.700}`/`gray-blue-300→{scales.gray-blue.300}`, `nonsense`→throw.
- [ ] RED 확인: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/build-seed-tokens.test.mjs 2>&1 | grep -E "# fail"`
- [ ] `toRef` 구현(Edit):
```js
export function toRef(raw) {
  if (raw === "white") return "{base.white}";
  if (raw === "black") return "{base.black}";
  if (raw === "text-white") return "#FFFFFF";
  const m = String(raw).match(/^(.+)-(\d{2,3})$/);
  if (m) return `{scales.${m[1]}.${m[2]}}`;
  throw new Error(`toRef: cannot normalize value "${raw}"`);
}
```
- [ ] green(toRef만): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/build-seed-tokens.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add scripts/build-seed-tokens.mjs test/build-seed-tokens.test.mjs && git commit -m "$(cat <<'EOF'
feat(seed): build-seed-tokens 스캐폴드 + toRef 정규화 (VALUE 전용, 마지막 -<digits>만 스텝)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 27 — alphaVal (RED→GREEN)
**Files:** `test/build-seed-tokens.test.mjs`, `scripts/build-seed-tokens.mjs`

- [ ] 테스트 append: `white 10%→rgba(255,255,255,0.1)`, `white 40%→...0.4)`, `black 50%→rgba(0,0,0,0.5)`, `gray-950 10%→rgba(12,17,29,0.1)`, `100%→...,1)`(white/black/gray-950 각각). RED 확인.
- [ ] `scripts/build-seed-tokens.mjs` 상단(주석 다음)에 상수+구현:
```js
// gray-950 light hex #0C111D = rgb(12,17,29) — 원천 단일화.
const gray950rgb = "12,17,29";
```
그리고 alphaVal 구현:
```js
export function alphaVal(raw) {
  const [c, p] = raw.split(" ");
  const n = Number(p.slice(0, -1)); // % 먼저 제거 (Number("100%")는 NaN)
  const a = n === 100 ? "1" : (n / 100).toString();
  if (c === "white") return `rgba(255,255,255,${a})`;
  if (c === "black") return `rgba(0,0,0,${a})`;
  return `rgba(${gray950rgb},${a})`;
}
```
- [ ] green: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/build-seed-tokens.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add scripts/build-seed-tokens.mjs test/build-seed-tokens.test.mjs && git commit -m "$(cat <<'EOF'
feat(seed): alphaVal rgba 리터럴 — %-먼저-제거, 100%->1, gray-950 rgb 12,17,29

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 28 — buildSeedTokens 매핑 (RED→GREEN)
**Files:** `test/build-seed-tokens.test.mjs`, `scripts/build-seed-tokens.mjs`

- [ ] 테스트 append — 인라인 SLICE 픽스처(정본 shape 축소: primitives.gray/gray-dark/error, base_colors, semantic(text-primary/text-primary_on-brand/text-white/fg-primary/border-error), utility(utility-brand-600_alt/utility-brand_alt), alpha) + BRAND 최소셋. 단언: shape(scales/semantic:{}/base); gray DISTINCT(50 distinct, 950 shared); 비-gray light==dark; `gray-dark` 미방출; brand from opts; 3앵커; semantic→{light:toRef,dark:toRef}; `text-white`는 앵커로 흡수(중복 없음); `_alt` NAME 불투명·VALUE 정규화; alpha rgba(모드별). RED 확인.
- [ ] `buildSeedTokens` 구현 + `DEFAULT_BRAND_RAMP` 추가(`gray950rgb` 아래). DEFAULT_BRAND_RAMP는 Untitled UI 기본 brand(violet) 12스텝 정본 hex(25..950, light==dark). 구현:
```js
export function buildSeedTokens(extracted, opts = {}) {
  const { primitives, base_colors, semantic, utility, alpha } = extracted;
  const brandRamp = opts.brandRamp || DEFAULT_BRAND_RAMP;
  const scales = {};
  scales.gray = {};
  for (const s of Object.keys(primitives.gray)) scales.gray[s] = { light: primitives.gray[s], dark: primitives["gray-dark"][s] };
  for (const [ramp, steps] of Object.entries(primitives)) { if (ramp === "gray" || ramp === "gray-dark") continue; scales[ramp] = {}; for (const s of Object.keys(steps)) scales[ramp][s] = { light: steps[s], dark: steps[s] }; }
  scales.brand = {};
  for (const s of Object.keys(brandRamp)) scales.brand[s] = { light: brandRamp[s], dark: brandRamp[s] };
  const base = {};
  base.white = { light: base_colors.white, dark: base_colors.white };
  base.black = { light: base_colors.black, dark: base_colors.black };
  base["text-white"] = { light: "#FFFFFF", dark: "#FFFFFF" };
  for (const s of semantic) { if (s.name === "text-white") continue; base[s.name] = { light: toRef(s.light), dark: toRef(s.dark) }; }
  for (const u of utility) base[u.name] = { light: toRef(u.light), dark: toRef(u.dark) };
  for (const a of alpha) base[a.name] = { light: alphaVal(a.light), dark: alphaVal(a.dark) };
  return { scales, semantic: {}, base };
}
```
DEFAULT_BRAND_RAMP:
```js
// 기본 brand 램프 = Untitled UI 기본 brand(violet) 정본 hex (25..950, light==dark). 유저는 scales.brand만 in-place 덮어쓴다.
const DEFAULT_BRAND_RAMP = { "25": "#FBFAFF", "50": "#F5F3FF", "100": "#ECE9FE", "200": "#DDD6FE", "300": "#C3B5FD", "400": "#A48AFB", "500": "#875BF7", "600": "#7839EE", "700": "#6927DA", "800": "#5720B7", "900": "#491C96", "950": "#2E125E" };
```
- [ ] green: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/build-seed-tokens.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add scripts/build-seed-tokens.mjs test/build-seed-tokens.test.mjs && git commit -m "$(cat <<'EOF'
feat(seed): buildSeedTokens — gray distinct, 27램프 동일, brand 기본램프, base 240, semantic:{}

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 29 — 풀 정본 카운트 불변식 테스트
**Files:** `test/build-seed-tokens.test.mjs`

- [ ] import에 정본 로더 추가(readFileSync `docs/tokens_extracted.json`). 테스트 append: `buildSeedTokens(EXTRACTED)` → scales 29, base 240, semantic {}, brand IN, gray-dark OUT; brand 50..950 전 스텝 존재 + `/^#[0-9A-Fa-f]{6}$/`. **추가(리뷰 major)**: 방출 전 램프가 12스텝인지 — `for (const ramp of Object.keys(scales)) assert.equal(Object.keys(scales[ramp]).length, 12)`.
- [ ] green: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/build-seed-tokens.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/build-seed-tokens.test.mjs && git commit -m "$(cat <<'EOF'
test(seed): 풀 정본 카운트 불변식 — scales 29(각 12스텝), base 240, brand 50..950

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 30 — 러너블 진입점 + 셀프체크(dry resolveRefs) + tokens.json 생성
**Files:** `scripts/build-seed-tokens.mjs`, `tokens.json`

> 진입점은 **tokens.json만** 쓴다(design.config.json은 Task 5 소유 — 리뷰 major). 셀프체크는 dry resolveRefs 양 모드 + 카운트.

- [ ] `scripts/build-seed-tokens.mjs` 상단 import 추가(readFileSync/writeFileSync/fileURLToPath/dirname/join + `resolveRefs from "../src/resolve-refs.mjs"`).
- [ ] 파일 끝에 진입점 추가:
```js
function writeStable(path, obj) { writeFileSync(path, JSON.stringify(obj, null, 2) + "\n"); }
function selfCheck(tokens) {
  const nS = Object.keys(tokens.scales).length, nB = Object.keys(tokens.base).length;
  if (nS !== 29) throw new Error(`selfCheck: expected 29 scales, got ${nS}`);
  if (nB !== 240) throw new Error(`selfCheck: expected 240 base, got ${nB}`);
  if (Object.keys(tokens.semantic).length !== 0) throw new Error(`selfCheck: semantic must be {}`);
  for (const [r, steps] of Object.entries(tokens.scales)) if (Object.keys(steps).length !== 12) throw new Error(`selfCheck: ramp ${r} has ${Object.keys(steps).length} steps, expected 12`);
  const L = resolveRefs(tokens, "light"), D = resolveRefs(tokens, "dark");
  if (Object.keys(L).length !== Object.keys(D).length) throw new Error("selfCheck: light/dark key count mismatch");
  return { light: Object.keys(L).length, dark: Object.keys(D).length };
}
function main() {
  const HERE = dirname(fileURLToPath(import.meta.url)); const ROOT = dirname(HERE);
  const extracted = JSON.parse(readFileSync(join(ROOT, "docs/tokens_extracted.json"), "utf8"));
  const tokens = buildSeedTokens(extracted);
  const stats = selfCheck(tokens);
  writeStable(join(ROOT, "tokens.json"), tokens);
  process.stdout.write(`seed OK: scales=${Object.keys(tokens.scales).length} base=${Object.keys(tokens.base).length} resolved(light=${stats.light}, dark=${stats.dark}) -> tokens.json\n`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
```
- [ ] 실행 (기대: `seed OK: scales=29 base=240 resolved(light=588, dark=588) -> tokens.json`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node scripts/build-seed-tokens.mjs`
- [ ] tokens.json shape 스팟체크(scales 29/base 240/semantic {}/gray-50 distinct/brand-600/text-primary ref/`_alt` verbatim/alpha rgba): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "const t=require('./tokens.json'); console.log(Object.keys(t.scales).length, Object.keys(t.base).length, JSON.stringify(t.semantic), JSON.stringify(t.scales.gray['50']), JSON.stringify(t.base['utility-brand-600_alt']), JSON.stringify(t.base['alpha-white-10']));"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add scripts/build-seed-tokens.mjs tokens.json && git commit -m "$(cat <<'EOF'
feat(seed): 진입점+셀프체크(dry resolveRefs, 12스텝 검사) + tokens.json 생성 (Untitled UI 시드)

design.config.json은 쓰지 않음(그 파일은 별도 저작). scales 29/base 240/
brand=violet 기본, resolveRefs 양 모드 588키 미해결 0.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 31 — 시드 vs 엔진 검증 + seed-shape 회귀 테스트
**Files:** `test/seed-shape.test.mjs`

> validate 부분은 Phase B 완료 후 green(이미 완료됨). resolveRefs는 semantic:{}에서 통과.

- [ ] 인라인 검증(validate+resolveRefs 양 모드, 미해결 0, 스팟 다크): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --input-type=module -e 'import { readFileSync } from "node:fs"; import { resolveRefs } from "./src/resolve-refs.mjs"; import { validate } from "./src/validate.mjs"; const t=JSON.parse(readFileSync("tokens.json","utf8")); const c=JSON.parse(readFileSync("design.config.json","utf8")); const L=resolveRefs(t,"light"),D=resolveRefs(t,"dark"); console.log("keys",Object.keys(L).length,Object.keys(D).length,"text-primary",L["text-primary"],D["text-primary"],"fg-primary.dark",D["fg-primary"],"border-error.dark",D["border-error"]); validate(t,c,{}); console.log("validate OK");'` (기대: keys 588 588, text-primary #101828/#F5F5F6, fg-primary.dark #FFFFFF, border-error.dark #F97066, validate OK)
- [ ] `test/seed-shape.test.mjs` 생성 — 커밋된 tokens.json이 계약 shape 유지(29 scales 각 12스텝/gray-dark absorbed/brand present; 240 base/semantic {}; gray distinct 50, 950 shared; brand 50..950; resolveRefs 양 모드 588 no throw + text-primary/fg-primary 스팟).
- [ ] green: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/seed-shape.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/seed-shape.test.mjs && git commit -m "$(cat <<'EOF'
test(seed): 시드-shape 회귀 — 29 scales(12스텝)/240 base/gray distinct/brand 스텝/588 해결

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Phase G — build-verify (Task 32–39)

> **HARD 선행조건:** render-tokens.mjs / render-manifest.mjs(신 시그니처) / render-css.mjs(재작성) / bin/ds.mjs(renderTokens, model 없음) / tokens.json(풀 시드) / 스키마·config 신모델이 전부 랜딩됐어야 한다. buildCli 호출 시 실패하면 해당 그룹 미완 — 중단.

### Task 32 — README 재작성
**Files:** `README.md`

- [ ] `README.md` 전체 교체 — getButtonClasses/6-슬롯 add-color 제거; 직접 유틸 사용(`text-primary`/`bg-brand-solid`), `tokens.ts` import; wire-up(`@import "tailwindcss"` 위, theme.css, `@source dist/**/*.ts`); brand 붙여넣기 절차(50..950 필수, light==dark, 25 선택, `ds build` 후 dist 재커밋); §7.6 한계(utility/alpha는 bg/text만, border 역할유틸은 폭 `border` 필요, 정적 @utility opacity 금지→alpha-* 사용, text-white @utility 미발행); dist 커밋 배포 주의.
- [ ] 잔재 부재(기대 CLEAN): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -nE "getButtonClasses|buttonVariants|variants\.ts|SEMANTIC_COLORS" README.md || echo "CLEAN"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add README.md && git commit -m "$(cat <<'EOF'
docs: README v0.2.0 — 토큰 직접 사용 + brand 붙여넣기 + §7.6 한계

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 33 — min 픽스처 신모델화 (brand 50..950 완비 — 리뷰 blocker)
**Files:** `test/fixtures/tokens.min.json`, `test/fixtures/config.min.json`

> **리뷰 blocker 해소:** min 픽스처의 `scales.brand`는 validate의 brand 필수스텝(50..950) 프리플라이트를 통과하도록 **11스텝 전부** 채운다(500/600/700만 넣으면 buildCli의 validate가 throw → 골든 생성 불가). DEFAULT_BRAND_RAMP hex 재사용, light==dark.

- [ ] `test/fixtures/tokens.min.json` 생성 — scales: brand(50..950 전부, DEFAULT_BRAND_RAMP hex, light==dark), gray(50/300/700/900 distinct), error(300/400 identical); semantic:{}; base: white/black/text-white 앵커 + text-primary + bg-primary + bg-brand-solid + bg-brand-solid_hover(light `{scales.brand.700}`/dark `{scales.brand.500}` — `_` @utility + brand dark 발산) + border-error + fg-primary(dark `{base.white}`) + utility-gray-50 + alpha-black-50(rgba). 모든 참조 스텝(brand 500/600/700, gray 50/300/700/900, error 300/400) 존재.
- [ ] `test/fixtures/config.min.json` 생성 — 신모델(colors/variantFamilies/slotOverrides 없음, output tokens.*, scaleOutput hex, baseColorEmit {}).
- [ ] 파싱+shape 확인: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "const t=require('./test/fixtures/tokens.min.json'); console.log('scales',Object.keys(t.scales),'brand steps',Object.keys(t.scales.brand).length,'semantic empty',Object.keys(t.semantic).length===0,'base',Object.keys(t.base).length);"` (기대: brand steps 11)
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/fixtures/tokens.min.json test/fixtures/config.min.json && git commit -m "$(cat <<'EOF'
test: min 픽스처 신모델화 — scales(brand 50..950 완비/gray distinct/error) + semantic:{} + base

brand 램프를 50..950 전부 채워 validate brand-step 프리플라이트 통과
(부분 램프면 buildCli validate가 throw → 골든 생성 불가). output tokens.*.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 34 — 골든 4파일 재생성 + cli-golden 재타겟 (RED→GREEN)
**Files:** `test/cli-golden.test.mjs`, `test/golden/theme.css`, `test/golden/tokens.ts`, `test/golden/tokens.d.ts`, `test/golden/tokens.manifest.json` (+ DELETE `test/golden/variants.*` 이미 Task 1에서 삭제됨)

- [ ] `test/cli-golden.test.mjs` `DIST_FILES` (L10) → `["theme.css", "tokens.ts", "tokens.d.ts", "tokens.manifest.json"]`.
- [ ] hash-mutate 라인(L56) `tok.base.background.light = "#000000";` → `tok.base["text-primary"].light = "#123456";`
- [ ] RED 확인(골든 stale): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/cli-golden.test.mjs 2>&1 | tail -10`
- [ ] 골든 재생성(buildCli로 min 픽스처 빌드→dist 복사):
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --input-type=module -e 'import { mkdtempSync, cpSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { buildCli } from "./bin/ds.mjs"; const dir=mkdtempSync(join(tmpdir(),"ds-gold-")); cpSync("test/fixtures/tokens.min.json",join(dir,"tokens.json")); cpSync("test/fixtures/config.min.json",join(dir,"design.config.json")); const rc=buildCli(["build"],dir); if(rc!==0){console.error("build failed",rc);process.exit(1);} for(const f of ["theme.css","tokens.ts","tokens.d.ts","tokens.manifest.json"]) cpSync(join(dir,"dist",f),join("test/golden",f)); console.log("golden regenerated");'
```
- [ ] 골든 세트 확인(기대: theme.css/tokens.d.ts/tokens.manifest.json/tokens.ts, variants 없음): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && ls test/golden/`
- [ ] cli-golden green(기대 `# fail 0`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/cli-golden.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/cli-golden.test.mjs test/golden/ && git commit -m "$(cat <<'EOF'
test: cli-golden 신모델 — DIST_FILES tokens.*, hash-mutate text-primary.light, 골든 4파일 재생성

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 35 — utility-names.json 픽스처 동결
**Files:** `test/fixtures/utility-names.json`

- [ ] 정본에서 생성(role prefix별 text21/bg31/border10/fg22, utility 134 verbatim, alpha 20, roleUtilityExcluded ["text-white"]):
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --input-type=module -e 'import { readFileSync, writeFileSync } from "node:fs"; const d=JSON.parse(readFileSync("docs/tokens_extracted.json","utf8")); const sem=d.semantic.map(s=>s.name); const group=pre=>sem.filter(n=>n.split("-")[0]===pre); const out={role:{text:group("text"),bg:group("bg"),border:group("border"),fg:group("fg")},utility:d.utility.map(u=>u.name),alpha:d.alpha.map(a=>a.name),roleUtilityExcluded:["text-white"]}; writeFileSync("test/fixtures/utility-names.json",JSON.stringify(out,null,2)+"\n"); console.log("text",out.role.text.length,"bg",out.role.bg.length,"border",out.role.border.length,"fg",out.role.fg.length,"utility",out.utility.length,"alpha",out.alpha.length);'
```
(기대: text 21 bg 31 border 10 fg 22 utility 134 alpha 20)
- [ ] `_alt`/text-white 확인: `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "const f=require('./test/fixtures/utility-names.json'); const alts=f.utility.filter(n=>n.includes('_alt')); console.log('_alt',alts.length,alts.includes('utility-brand_alt'),alts.includes('utility-brand-600_alt'),'text-white in text',f.role.text.includes('text-white'));"` (기대: `_alt 10 true true text-white in text true`)
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/fixtures/utility-names.json && git commit -m "$(cat <<'EOF'
test: utility-names 픽스처 동결 — 134 유틸(verbatim, _alt 10) + 20 alpha + 역할이름 + text-white 화이트리스트

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 36 — completeness.test.mjs 이름기반 재작성
**Files:** `test/completeness.test.mjs`

> 풀 시드 `dist/theme.css`에 대한 이름기반 게이트. 이 시점엔 dist가 아직 구/미생성이라 RED — Task 39 전체빌드 후 GREEN(정직한 히스토리). 수치: @theme 350(28컬러×12=336 + brand12 + white/black2, 실측 전 램프 12스텝 완비), :root 238, @utility 391(=83 역할 + 134×2 + 20×2), text21/bg31/border10/fg22, text-white @utility 부재 + `--color-text-white` var 존재, role-util ∩ 프리미티브 stem = {} (text-white 화이트리스트).

- [ ] `test/completeness.test.mjs` 전체 재작성 — brace-balanced 블록 추출로 `@theme`/`:root` var 집합; @theme 350 + white/black + brand IN/gray-dark OUT; :root 238 + 접두 카운트 + `--color-text-white` 존재; `@utility` 세트 == fixture 파생 391 + text-white 부재; role-util 이름 ∩ 프리미티브 stem = {}(text-white 제외). (주석에 238=84+134+20, 350=28*12+12+2, 391=83+268+40 산술 명시.)
- [ ] RED 확인(구/미생성 dist): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/completeness.test.mjs 2>&1 | tail -8`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/completeness.test.mjs && git commit -m "$(cat <<'EOF'
test: completeness 이름기반 재작성 — @theme 350/,:root 238(text21/bg31/border10/fg22)/@utility 391(text-white 부재) + stem disjoint

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 37 — dark-correctness + alpha-rgba 테스트 (resolveRefs 소스)
**Files:** `test/dark-correctness.test.mjs`, `test/alpha-rgba.test.mjs`

> 커밋된 풀 시드 `tokens.json`을 resolveRefs로 구동(dist 바이트 무관, Task 30/31 후 GREEN). 대소문자 `.toUpperCase()` 정규화.

- [ ] `test/dark-correctness.test.mjs` 생성 — gray-50 light `#F9FAFB`≠dark `#F5F5F6`, gray-950 공유 `#0C111D`; error-400 light==dark `#F97066`; text-primary light `#101828`/dark `#F5F5F6`; fg-primary dark `#FFFFFF`(≠text-primary dark); border-error dark `#F97066`; bg-brand-solid_hover light≠dark(brand-700 vs brand-500 — 시드에 이 토큰 존재 확인, 없으면 utility-brand-600 light≠dark로 대체).
- [ ] `test/alpha-rgba.test.mjs` 생성 — alpha-white-10.light `rgba(255,255,255,0.1)`, alpha-black-50.light `rgba(0,0,0,0.5)`, alpha-white-40.dark `rgba(12,17,29,0.4)`, `*-100`은 `,1)` 종료.
- [ ] green(기대 각 fail 0): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/dark-correctness.test.mjs test/alpha-rgba.test.mjs 2>&1 | grep -E "# pass|# fail"`
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/dark-correctness.test.mjs test/alpha-rgba.test.mjs && git commit -m "$(cat <<'EOF'
test: dark-correctness + alpha-rgba (resolveRefs 풀 시드 구동)

gray distinct/error identical/text-primary·fg-primary·border-error dark 스팟;
alpha white/black/gray-950 rgba + *-100 ,1) 종료.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 38 — smoke-consumer 컴파일출력 재작성 (skip-guarded) + README 폴백
**Files:** `test/smoke-consumer.test.mjs`, `README.md`

- [ ] `test/smoke-consumer.test.mjs` 전체 재작성 — `createRequire.resolve('@tailwindcss/cli')` 가드로 미설치 시 전부 skip. compile 헬퍼는 dist 4파일(theme.css/tokens.ts/tokens.d.ts/tokens.manifest.json) 복사 + `@import "tailwindcss"` + theme.css + `@source`. 컴파일 출력 assert: (1) `[data-gnb-theme=dark] bg-gray-900`이 `#161B26` 실칠(§7.1(b) 폴백); (2) `bg-brand-500/50`→color-mix over `var(--color-brand-500)`; (3) `_`-@utility(text-secondary_on-brand/bg-brand-solid_hover/text-utility-brand-600_alt) 규칙 생성(§8.3 폴백); (4) `text-primary/40` 규칙 드롭; (5) bg-brand-solid/text-primary/border-error+border/fg-brand-primary property 생성.
- [ ] 실행(기대: fail 0, skipped>0): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/smoke-consumer.test.mjs 2>&1 | grep -E "# fail|# skipped"`
- [ ] README에 "Tailwind 스모크 게이트 & 폴백" 섹션 append(§7.1(b) gray-dark-via-role, §8.3 slugify/peer-floor).
- [ ] 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/smoke-consumer.test.mjs README.md && git commit -m "$(cat <<'EOF'
test: smoke-consumer 컴파일출력 재작성(skip-guarded) + README 폴백 문서화

dark bg-gray-900 #161B26, brand/50 color-mix, _-@utility 생성, static opacity
드롭, 역할 property. 실패 시 §7.1(b)/§8.3 폴백.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

### Task 39 — 전체 빌드 + 검증 + v0.2.0 태그 (봉인)
**Files:** `dist/theme.css`, `dist/tokens.ts`, `dist/tokens.d.ts`, `dist/tokens.manifest.json` (+ DELETE `dist/variants.*` 이미 Task 1)

- [ ] 전체 빌드(기대: exit 0, `ds: wrote dist (theme.css, tokens.ts, tokens.d.ts, tokens.manifest.json)`): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node ./bin/ds.mjs build`
- [ ] dist 세트 확인(variants 없음): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && ls dist/`
- [ ] 카운트 검증(기대: color-vars 588, utility-rules 391, text-white-utility 0, manifest-version 0.2.0): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && echo "color-vars: $(grep -oE '\-\-color-[a-zA-Z0-9_-]+\s*:' dist/theme.css | sed 's/[[:space:]]*:.*//' | sort -u | wc -l | tr -d ' ')"; echo "utility-rules: $(grep -cE '^@utility ' dist/theme.css | tr -d ' ')"; echo "text-white-utility: $(grep -c '@utility text-white' dist/theme.css | tr -d ' ')"; node -e "console.log('manifest-version:', require('./dist/tokens.manifest.json').version)"`
- [ ] 전체 스위트(기대: `# fail 0`, skipped>0=tailwind 스모크): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test 2>&1 | tail -12`
- [ ] `--check` == 0(기대: `ds: dist is up to date`, exit 0): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node ./bin/ds.mjs build --check; echo "exit=$?"`
- [ ] dist 커밋:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add dist/ && git commit -m "$(cat <<'EOF'
build: v0.2.0 dist 재생성 — theme.css(588 --color-*, 391 @utility, text-white @utility 부재) + tokens.ts/d.ts + manifest(0.2.0)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```
- [ ] 워킹트리 clean 확인(기대: 빈 출력): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git status --porcelain`
- [ ] 태그:
```bash
cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git tag -a v0.2.0 -m "$(cat <<'EOF'
v0.2.0 — Untitled UI 컬러 토큰 레이어 전면 재편

프리미티브 29램프(@theme) + 역할/유틸/alpha 238 :root var + 391 @utility.
REAL 다크(gray distinct + per-mode 참조), brand 명시 램프, alpha rgba 리터럴.
variant 헬퍼 제거(BREAKING). dist 커밋 배포.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```
- [ ] 태그 확인(기대: v0.2.0, dist 4파일 in-tree, variants 없음): `cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git tag -l "v0.2.0" && git ls-tree v0.2.0 dist/`