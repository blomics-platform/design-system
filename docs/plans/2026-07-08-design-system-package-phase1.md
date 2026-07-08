# @blomics-platform/design-system 패키지 구현 계획 (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**목표:** `tokens.json` 단일 원천에서 Tailwind v4 `theme.css` + 타입드 `variants.ts`(+`.d.ts`/manifest)를 결정론적으로 생성하는 config-주도 색 엔진 패키지 `@blomics-platform/design-system`을 TDD로 구축하고, 시드·dist를 커밋한 v0.1.0 태그까지 만든다.

**아키텍처:** `tokens.json`(+`design.config.json`) 단일 원천 → Node ESM 제너레이터(`bin/ds.mjs` + `src/*.mjs`) → `dist/`(theme.css / variants.ts / variants.d.ts / tokens.manifest.json) → git-tag 커밋으로 소비. CSS는 plain `@theme`(라이트 리터럴) + `[darkSelector]` 다크 리터럴 오버라이드 형태(§7.3, `@theme inline` 아님). `meta.autoMirrorDark=true`(배선-우선 seed, 다크=라이트 미러)이고 신규 색 스케일은 `$generate`(base hex → 25~900 OKLCH 램프, §6.8)로 확장한다.

**기술 스택:** Node.js ESM(`.mjs`, 순수 JS 제너레이터), 생성물은 TypeScript(`variants.ts`/`.d.ts`) + Tailwind CSS v4(peer, 소비자측). 테스트는 `node:test` + `node:assert/strict`.
- 대상 레포: `/Users/jang-gyeongtae/BPMG/blomics/design-system` (기존 standalone git 레포, `main` 브랜치, 커밋 없음). `.gitignore`(node_modules/.DS_Store/*.log; dist 미제외)와 `docs/specs/2026-07-07-design-system-package-design.md`가 이미 존재. Node 22.13.0.
- CLI: `bin/ds.mjs` (`ds build` / `ds build --check`)
- Git 전략: 신규 레포, `main`에 직접 커밋. 커밋 메시지 한국어 + 마지막 줄 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` 트레일러. jest 금지, `node --test`만.
- 스코프: sub-project A(패키지)만. fortress 이관(B)은 별도 계획. `scale-gen`은 §15 Q9 확정에 따라 Phase 1 포함(신규 색부터 `$generate` 적용, primary는 당분간 명시 스케일 유지).

---

## 사전 준비(Task 0, 비-코드) — 스펙 리터럴 고정

> 이 계획의 "골든/파생/@custom-variant/hex/게이트 §13.x" 리터럴은 전부 레포 내 `docs/specs/2026-07-07-design-system-package-design.md`에서 온다. 스펙은 **실재**하며(dangling 아님) 아래 핵심 리터럴은 실측 검증됨. 각 태스크는 "§X verbatim"을 아래 고정본으로 해석한다:
> - `@custom-variant` 라인 = fortress `src/app/globals.css:3`과 바이트 동일: `@custom-variant dark (&:where([data-gnb-theme="dark"], [data-gnb-theme="dark"] *));`
> - §6.6 `secondary`는 base/hover/active/foreground **4슬롯만**(light/light-foreground **물리적 부재**, config omit로 면제).
> - §7.3 FILE2 파생 문자열(`primary-outline`, `buttonVariants.*`, `*Sizes`, `commonStyles`)은 이 계획 본문 각 태스크에 인라인됨.
> - §13.5 완전성 게이트 원천은 **골든이 아니라 live fortress `globals.css` `:root`**(R-SURFACE).
>
> **구현자 첫 스텝**: `docs/specs/2026-07-07-design-system-package-design.md` §6.5/§6.6/§6.8/§7.1/§7.3/§13을 통독하고, 본 계획의 인라인 리터럴이 스펙과 어긋나면 **스펙을 우선**하되 그 차이를 커밋 메시지에 기록한다.

---

## GROUP A — scaffold

### Task 1: chore — 패키지 스캐폴드(package.json + README 초안 + node --test 배선 + 초기 커밋)

**Files:** `package.json`, `README.md`, (`.gitignore` 확인)

- [ ] 레포 확인:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git rev-parse --abbrev-ref HEAD && git log --oneline 2>&1 | head -1
  ```
  기대: `main` 그리고 `fatal: your current branch 'main' does not have any commits yet`.

- [ ] `.gitignore`가 `dist/`를 제외하지 않는지, dist 내부 중첩 `.gitignore`가 없는지 확인(R-DIST/§8.4):
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && cat .gitignore && (grep -q 'dist' .gitignore && echo "WARN dist ignored" || echo "OK: dist not ignored")
  ```
  기대: 세 줄(`node_modules/`, `.DS_Store`, `*.log`) + `OK: dist not ignored`. 다르면 정확히 그 세 줄로 덮어쓴다(`dist/` 추가 금지).

- [ ] `package.json` 작성(§7.3 FILE4 + CONTRACT의 `scripts.test`, `scaleOutput`은 config에서만 다룸):
  ```json
  {
    "name": "@blomics-platform/design-system",
    "version": "0.1.0",
    "private": false,
    "type": "module",
    "description": "Config-driven Tailwind v4 design tokens + generated variant helpers.",
    "license": "UNLICENSED",
    "files": ["dist", "bin", "tokens.schema.json", "config.schema.json"],
    "bin": { "ds": "./bin/ds.mjs" },
    "scripts": {
      "build": "node ./bin/ds.mjs build",
      "check": "node ./bin/ds.mjs build --check",
      "test": "node --test"
    },
    "exports": {
      ".": { "types": "./dist/variants.d.ts", "import": "./dist/variants.ts", "default": "./dist/variants.ts" },
      "./theme.css": "./dist/theme.css",
      "./tokens": "./dist/tokens.manifest.json",
      "./config-schema": "./config.schema.json",
      "./tokens-schema": "./tokens.schema.json"
    },
    "peerDependencies": { "tailwindcss": ">=4.1.0" }
  }
  ```

- [ ] 매니페스트 유효성 확인:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "const p=require('./package.json'); console.log(p.name,p.type,p.bin.ds,Object.keys(p.exports).join(','),p.files.join(','),p.peerDependencies.tailwindcss)"
  ```
  기대: `@blomics-platform/design-system module ./bin/ds.mjs .,./theme.css,./tokens,./config-schema,./tokens-schema dist,bin,tokens.schema.json,config.schema.json >=4.1.0`

- [ ] `README.md` 작성(설치·`@import` 순서·canonical `.ts` `@source`·TS import·CLI·색 추가 §11). 로드-베어링 라인: `@import "tailwindcss";`가 `theme.css` 위, canonical `@source "../node_modules/@blomics-platform/design-system/dist/**/*.ts";`(`.ts`만, `{js,mjs,tsx}` 광고 금지, §8.4):
  ````markdown
  # @blomics-platform/design-system

  Config-driven Tailwind v4 design tokens + generated variant helpers.
  단일 원천 `tokens.json` + 제너레이터가 `theme.css`와 타입드 `variants.ts`(+ `variants.d.ts`, manifest)를 방출한다.
  자세한 설계는 `docs/specs/2026-07-07-design-system-package-design.md` 참고.

  > **Phase 1**: `dist/`는 git 태그에 **커밋**되어 배포된다. `file:`/`git+…#tag` 설치는 build를 안 돌리므로 커밋된 `dist/`가 소비자에게 전달된다(§5.1 R-DIST). `dist/`는 손대지 말 것 — `AUTO-GENERATED` 헤더가 붙는다. `tokens.json`/`design.config.json`을 고치고 `ds build`.

  ## Install (Phase 1 — no registry)
  ```jsonc
  {
    "@blomics-platform/design-system": "git+file:///Users/jang-gyeongtae/BPMG/blomics/design-system#v0.1.0"
    // 또는 로컬 개발: "file:../design-system"
  }
  ```
  Tailwind CSS v4 **≥ 4.1.0** 필요(node_modules `@source` 오버라이드가 v4.1.0부터).

  ## Wire it up: `globals.css`
  ```css
  @import "tailwindcss";                                            /* 소비자 소유, 1행 */
  @import "@blomics-platform/design-system/theme.css";                       /* @custom-variant + @theme(light) + dark overrides */
  @source "../node_modules/@blomics-platform/design-system/dist/**/*.ts";    /* ★ 필수: 패키지 유틸 스캔 (없으면 침묵 실패, R-SCAN) */
  ```
  글롭 확장자는 `.ts`(현재 dist의 유틸 보유 파일은 `dist/variants.ts`뿐). 실제 dist 확장자와 lockstep 유지.
  패키지 `theme.css`는 `@import "tailwindcss"`나 `@source`를 담지 않는다(소비자 소유, §8.2/§8.4).

  ## Use it in TypeScript
  ```tsx
  import { getButtonClasses, badgeVariants, commonStyles, SEMANTIC_COLORS, type ColorVariant } from "@blomics-platform/design-system";
  <button className={getButtonClasses("primary")}>Save</button>;
  ```

  ## Add a color
  1. `tokens.json` `semantic`에 6슬롯(`base,hover,active,foreground,light,light-foreground`) 각 `{ light, dark }` 추가(스키마가 누락 슬롯 거부).
  2. `design.config.json` `colors`에 이름 등록(등록 안 하면 CSS var만 나오고 `ColorVariant`엔 불참 — 2단계 스테이징).
  3. `npx ds build`. 전체 워크플로는 스펙 §11.

  ## CLI
  ```bash
  ds build            # tokens/config → dist/ 재생성(원자 스왑)
  ds build --check    # 인메모리 재생성 후 커밋된 dist/ 가 stale이면 non-zero (CI 게이트)
  ```
  ````

- [ ] README 로드-베어링 라인 확인:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -q 'dist/\*\*/\*\.ts' README.md && grep -q '@import "tailwindcss";' README.md && ! grep -q '{js,mjs,tsx}' README.md && echo "README OK"
  ```
  기대: `README OK`

- [ ] `node --test` 배선 스모크(임시): `test/scaffold.smoke.test.mjs`에 `import {test} from "node:test"; import assert from "node:assert/strict"; test("wired",()=>assert.equal(1+1,2));` 작성 후 `cd … && npm test 2>&1 | tail -6` → `pass 1`/`fail 0` 확인, 그다음 `rm test/scaffold.smoke.test.mjs && rmdir test 2>/dev/null || true` 로 제거(스캐폴드 커밋을 깨끗이; `scripts.test`만 잔존).

- [ ] `tsconfig.json`는 **스킵**(생성기는 `.mjs`, `.d.ts`는 verbatim 문자열 방출이라 tsc 미사용). 파일 생성 없음.

- [ ] 초기 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add -A && git commit -m "$(cat <<'EOF'
  chore: 패키지 스캐폴드 — package.json(exports/bin/files/peerDeps), README 초안, node --test 배선

  - @blomics-platform/design-system 매니페스트: type=module, bin.ds→bin/ds.mjs, exports 맵,
    files=[dist,bin,tokens.schema.json,config.schema.json], scripts.build/check/test, peerDeps.tailwindcss>=4.1.0
  - README: 설치·@import 순서(tailwindcss→theme.css)·canonical @source dist/**/*.ts·색 추가(§11)·CLI
  - .gitignore는 dist 미제외(§8.4). tsconfig 스킵(.mjs 생성기)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```
  이 커밋의 tracked 셋: `.gitignore`, `README.md`, `docs/…`, `package.json`. `dist/`·`test/`·`tsconfig.json` 없음. **v0.1.0 태그는 여기서 만들지 않는다 — Task 25에서 dist 커밋 이후 생성**.

---

## GROUP B — tokens-schema-validate (스키마 + load + validate)

### Task 2: feat — tokens.schema.json + config.schema.json 작성 (§6.5/§7.1 + `$generate`/`scaleOutput`/`cssLayering`)

**Files:** `tokens.schema.json`, `config.schema.json` (패키지 루트)

> 리뷰 반영: (1) `scaleRamp`는 명시 11-리프 **또는** `$generate` 디렉티브를 허용하는 `oneOf`(§6.8.1). (2) `config`는 `scaleOutput`("oklch"|"hex")과 `cssLayering`("plain"|"inline-passthrough")을 스키마에 추가해 `additionalProperties:false`가 스펙 키를 하드-리젝트하지 않게 한다(§6.8.3/§7.5). Phase 1 기본은 `scaleOutput:"oklch"`, `cssLayering:"plain"`.

- [ ] `tokens.schema.json` 작성:
  ```json
  {
    "$id": "https://blomics.dev/design-system/tokens.schema.json",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["semantic"],
    "additionalProperties": false,
    "properties": {
      "$schema": { "type": "string" },
      "meta": { "$ref": "#/$defs/meta" },
      "scales": { "type": "object", "additionalProperties": { "$ref": "#/$defs/scaleRamp" } },
      "semantic": { "type": "object", "minProperties": 1, "additionalProperties": { "$ref": "#/$defs/semanticColor" } },
      "base": { "type": "object", "additionalProperties": { "$ref": "#/$defs/leaf" } }
    },
    "$defs": {
      "leaf": {
        "type": "object", "required": ["light", "dark"], "additionalProperties": false,
        "properties": { "light": { "$ref": "#/$defs/colorRef" }, "dark": { "$ref": "#/$defs/colorRef" } }
      },
      "colorRef": { "type": "string", "pattern": "^(#|rgb|rgba|hsl|oklch|\\{).+" },
      "explicitRamp": {
        "type": "object", "minProperties": 1,
        "propertyNames": { "pattern": "^[0-9]{2,3}$" },
        "additionalProperties": { "$ref": "#/$defs/leaf" }
      },
      "generateRamp": {
        "type": "object", "required": ["$generate"], "additionalProperties": false,
        "properties": {
          "$generate": {
            "type": "object", "required": ["base"], "additionalProperties": false,
            "properties": { "base": { "$ref": "#/$defs/leaf" }, "anchor": { "type": "integer" } }
          }
        }
      },
      "scaleRamp": { "oneOf": [ { "$ref": "#/$defs/explicitRamp" }, { "$ref": "#/$defs/generateRamp" } ] },
      "semanticColor": {
        "type": "object",
        "required": ["base", "hover", "active", "foreground", "light", "light-foreground"],
        "additionalProperties": false,
        "properties": {
          "base": { "$ref": "#/$defs/leaf" }, "hover": { "$ref": "#/$defs/leaf" },
          "active": { "$ref": "#/$defs/leaf" }, "foreground": { "$ref": "#/$defs/leaf" },
          "light": { "$ref": "#/$defs/leaf" }, "light-foreground": { "$ref": "#/$defs/leaf" }
        }
      },
      "meta": {
        "type": "object", "additionalProperties": false,
        "properties": { "autoMirrorDark": { "type": "boolean", "default": false } }
      }
    }
  }
  ```
  주: `leaf.required`가 light/dark 둘 다 요구하지만 `autoMirrorDark=true`의 dark-생략 완화는 스키마가 아니라 `expandScales`/`validate`/`resolveRefs`가 런타임에 적용한다(§6.5). `generateRamp`의 `base` 리프도 dark 생략 가능해야 하므로, **`$generate.base` 리프에 한해** validate/scale-gen가 dark-optional을 허용한다(스키마의 strict form은 seed에서 dark 미표기 시 explicit ramp가 아닌 `$generate`를 쓰거나, base에 dark를 명시). Phase 1 seed는 primary를 명시 램프(light-only)로 두므로 이 완화는 scale-gen 태스크에서 처리한다.

- [ ] `config.schema.json` 작성:
  ```json
  {
    "$id": "https://blomics.dev/design-system/config.schema.json",
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["classPrefix", "darkSelector", "darkVariantName", "colors", "variantFamilies", "output"],
    "additionalProperties": false,
    "properties": {
      "$schema": { "type": "string" },
      "classPrefix": { "type": "string" },
      "darkSelector": { "type": "string" },
      "darkVariantName": { "type": "string" },
      "colors": { "type": "array", "minItems": 1, "items": { "type": "string" } },
      "variantFamilies": { "type": "array", "items": { "type": "string" } },
      "scaleOutput": { "type": "string", "enum": ["oklch", "hex"], "default": "oklch" },
      "cssLayering": { "type": "string", "enum": ["plain", "inline-passthrough"], "default": "plain" },
      "output": {
        "type": "object", "required": ["css", "ts", "dts", "manifest"], "additionalProperties": false,
        "properties": { "css": { "type": "string" }, "ts": { "type": "string" }, "dts": { "type": "string" }, "manifest": { "type": "string" } }
      },
      "slotOverrides": {
        "type": "object",
        "additionalProperties": {
          "type": "object", "required": ["omit"], "additionalProperties": false,
          "properties": { "omit": { "type": "array", "items": { "type": "string", "enum": ["base", "hover", "active", "foreground", "light", "light-foreground"] } } }
        }
      },
      "baseColorEmit": { "type": "object", "additionalProperties": { "type": "boolean" } },
      "variantOverrides": { "type": "object", "additionalProperties": { "type": "object", "additionalProperties": { "type": "string" } } },
      "helpers": {
        "type": "object",
        "additionalProperties": { "type": "object", "additionalProperties": false, "properties": { "base": { "type": "string" }, "defaultRounded": { "type": "string" } } }
      }
    }
  }
  ```

- [ ] 두 파일 파싱 확인:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "JSON.parse(require('fs').readFileSync('tokens.schema.json','utf8'));JSON.parse(require('fs').readFileSync('config.schema.json','utf8'));console.log('schemas OK')"
  ```
  기대: `schemas OK`

- [ ] 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add tokens.schema.json config.schema.json && git commit -m "$(cat <<'EOF'
  feat: tokens/config 스키마 — leaf/scaleRamp(oneOf: 명시|$generate)/6슬롯 + scaleOutput/cssLayering

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: test+feat — loadInputs (tokens/config/schema 파싱 + 결정적 sourceHash) [RED→GREEN]

**Files:** `src/load.mjs`, `test/load.test.mjs`, `test/fixtures/tokens.load.json`, `test/fixtures/config.load.json`

`loadInputs(projectDir) -> LoadedInputs`. tokens.json/design.config.json은 projectDir에서, **두 스키마는 패키지 루트에서만** 읽는다(`dirname(dirname(fileURLToPath(import.meta.url)))`). 결정적 sha256 sourceHash(키 정렬 정규화). 순수 I/O+파싱, 검증 없음.

- [ ] 픽스처 작성 — `test/fixtures/tokens.load.json`:
  ```json
  {
    "meta": { "autoMirrorDark": true },
    "semantic": { "primary": {
      "base": { "light": "#2563eb", "dark": "#5b93f0" }, "hover": { "light": "#1d4ed8", "dark": "#3f76c4" },
      "active": { "light": "#1e40af", "dark": "#2b5490" }, "foreground": { "light": "#ffffff", "dark": "#0b1220" },
      "light": { "light": "#dbeafe", "dark": "#1c3a66" }, "light-foreground": { "light": "#1e40af", "dark": "#14294a" }
    } },
    "base": { "background": { "light": "#ffffff", "dark": "#0b0f1a" } }
  }
  ```
  `test/fixtures/config.load.json`:
  ```json
  {
    "classPrefix": "", "darkSelector": "[data-gnb-theme=\"dark\"]", "darkVariantName": "dark",
    "colors": ["primary"], "variantFamilies": ["button"],
    "output": { "css": "dist/theme.css", "ts": "dist/variants.ts", "dts": "dist/variants.d.ts", "manifest": "dist/tokens.manifest.json" }
  }
  ```

- [ ] 실패 테스트 `test/load.test.mjs`:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { mkdtempSync, copyFileSync, writeFileSync, readFileSync } from "node:fs";
  import { tmpdir } from "node:os";
  import { join, dirname } from "node:path";
  import { fileURLToPath } from "node:url";
  import { loadInputs } from "../src/load.mjs";

  const HERE = dirname(fileURLToPath(import.meta.url));
  const FIX = join(HERE, "fixtures");
  function stageProject() {
    const dir = mkdtempSync(join(tmpdir(), "ds-load-"));
    copyFileSync(join(FIX, "tokens.load.json"), join(dir, "tokens.json"));
    copyFileSync(join(FIX, "config.load.json"), join(dir, "design.config.json"));
    return dir;
  }
  test("loadInputs parses tokens, config, and both schemas", () => {
    const l = loadInputs(stageProject());
    assert.equal(l.tokens.meta.autoMirrorDark, true);
    assert.equal(l.tokens.semantic.primary.base.light, "#2563eb");
    assert.deepEqual(l.config.colors, ["primary"]);
    assert.equal(l.schemas.tokens.$defs.semanticColor.required.length, 6);
    assert.ok(Array.isArray(l.schemas.config.required));
    assert.match(l.sourceHash, /^[0-9a-f]{64}$/);
  });
  test("sourceHash deterministic; changes on input change", () => {
    const a = loadInputs(stageProject()).sourceHash;
    const dirB = stageProject();
    assert.equal(loadInputs(dirB).sourceHash, a);
    const m = JSON.parse(readFileSync(join(dirB, "tokens.json"), "utf8"));
    m.semantic.primary.base.light = "#000000";
    writeFileSync(join(dirB, "tokens.json"), JSON.stringify(m));
    assert.notEqual(loadInputs(dirB).sourceHash, a);
  });
  test("loadInputs throws readable error on invalid JSON", () => {
    const dir = stageProject();
    writeFileSync(join(dir, "tokens.json"), "{ not json ");
    assert.throws(() => loadInputs(dir), /tokens\.json/);
  });
  ```

- [ ] 실행 → 실패 확인(모듈 부재). **기대: 그린이 아님**(node --test가 파일-레벨 import 에러를 내거나 `not ok`; 정확한 `# fail N` 카운트에 의존하지 말 것):
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test test/load.test.mjs; echo "exit=$?"
  ```
  기대: non-zero exit + `Cannot find module .../src/load.mjs`.

- [ ] `src/load.mjs` 구현:
  ```js
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
  ```

- [ ] 실행 → `pass 3` 확인. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/load.mjs test/load.test.mjs test/fixtures/tokens.load.json test/fixtures/config.load.json && git commit -m "$(cat <<'EOF'
  feat: loadInputs — tokens/config/schema 파싱 + 결정적 sourceHash(sha256, 키정렬 정규화)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## GROUP C — scale-gen (`$generate` pre-pass) [신규, 리뷰 반영]

> §6.8: scale-gen은 **load 직후, validate 이전의 pre-pass**다(`src/scale-gen.mjs`, `expandScales(rawTokens, config) -> rawTokens'`). `$generate`를 명시 11-리프로 전개하고, 안 쓰면 무변경. 다운스트림 모듈은 무변경. §15 Q9 확정: Phase 1 primary는 명시 스케일 유지, `$generate`는 신규 색부터. `scaleOutput` 기본 `oklch`.

### Task 4: test+feat — sRGB↔OKLCH 변환(결정론) [RED→GREEN]

**Files:** `src/scale-gen.mjs`(신규), `test/scale-gen.test.mjs`(신규)

내장 변환(런타임 의존 0): sRGB hex → linear-sRGB → OKLab → OKLCH, 및 역변환 OKLCH → OKLab → linear-sRGB → sRGB hex(clamp). 표준 매트릭스(§6.8.3).

- [ ] 실패 테스트(변환 라운드트립 + 결정론):
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { hexToOklch, oklchToHex } from "../src/scale-gen.mjs";
  test("hex→oklch→hex round-trips within tolerance", () => {
    for (const hex of ["#2563eb", "#ffffff", "#000000", "#10b981"]) {
      const { L, C, H } = hexToOklch(hex);
      assert.ok(L >= 0 && L <= 1, "L in [0,1]");
      const back = oklchToHex(L, C, H);
      assert.match(back, /^#[0-9a-f]{6}$/);
    }
  });
  test("conversion is deterministic (same input → identical output)", () => {
    assert.deepEqual(hexToOklch("#2563eb"), hexToOklch("#2563eb"));
    assert.equal(oklchToHex(0.575, 0.19, 264), oklchToHex(0.575, 0.19, 264));
  });
  test("oklch string formatter is stable", async () => {
    const { formatOklch } = await import("../src/scale-gen.mjs");
    assert.equal(formatOklch(0.575, 0.19, 264.1234), formatOklch(0.575, 0.19, 264.1234));
    assert.match(formatOklch(0.575, 0.19, 264.1234), /^oklch\(/);
  });
  ```

- [ ] 실행 → 실패(모듈 부재, non-zero exit).

- [ ] `src/scale-gen.mjs` 변환부 구현. 표준 sRGB↔OKLab 매트릭스 사용, 고정 소수 자릿수로 문자열화(결정론):
  ```js
  // sRGB(0..255 hex) ↔ OKLCH. 표준 공개 매트릭스, 결정론.
  function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
  function linearToSrgb(c) { const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; return Math.round(Math.min(1, Math.max(0, v)) * 255); }
  export function hexToOklch(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) throw new Error(`bad hex: ${hex}`);
    const n = parseInt(m[1], 16), r = srgbToLinear((n >> 16) & 255), g = srgbToLinear((n >> 8) & 255), b = srgbToLinear(n & 255);
    const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
    const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
    const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
    const C = Math.hypot(a, bb); let H = Math.atan2(bb, a) * 180 / Math.PI; if (H < 0) H += 360;
    return { L, C, H };
  }
  export function oklchToHex(L, C, H) {
    const hr = H * Math.PI / 180, a = C * Math.cos(hr), bb = C * Math.sin(hr);
    const l_ = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
    const m_ = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
    const s_ = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
    const r = linearToSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_);
    const g = linearToSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_);
    const b = linearToSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_);
    return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  export function formatOklch(L, C, H) {
    const f = (x, d) => Number(x.toFixed(d)).toString();
    return `oklch(${f(L, 4)} ${f(C, 4)} ${f(H, 2)})`;
  }
  ```

- [ ] 실행 → `pass 3`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/scale-gen.mjs test/scale-gen.test.mjs && git commit -m "$(cat <<'EOF'
  feat: scale-gen 색 변환 — sRGB↔OKLCH 내장(결정론) + oklch 포매터

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 5: test+feat — expandScales(`$generate` → 11-리프 램프) [RED→GREEN]

**Files:** `src/scale-gen.mjs`(편집), `test/scale-gen.test.mjs`(편집)

`expandScales(rawTokens, config) -> rawTokens'`: `scales.<c>.$generate:{base,anchor?}`를 §6.8.3 규칙(고정 L 사다리 + anchor 정렬 + C 감쇠, H 고정)으로 25..900 리프로 전개. `config.scaleOutput`(기본 oklch)에 따라 각 스텝 값을 `oklch(...)` 또는 hex로 방출. autoMirrorDark: `base.dark` 있으면 dark 램프 재정렬, 없으면 미러(light 복사) — §6.8.4. `$generate` 없는 램프/토큰은 그대로 통과. **불변**: 입력 무변경 재실행 시 바이트 동일.

- [ ] 실패 테스트 추가:
  ```js
  test("expandScales replaces $generate with an 11-step ramp (25..900)", async () => {
    const { expandScales } = await import("../src/scale-gen.mjs");
    const raw = { meta: { autoMirrorDark: true }, scales: { brand: { $generate: { base: { light: "#2563eb" }, anchor: 600 } } }, semantic: { brand: { base: { light: "{scales.brand.600}" }, hover: { light: "{scales.brand.700}" }, active: { light: "{scales.brand.800}" }, foreground: { light: "#fff" }, light: { light: "{scales.brand.100}" }, "light-foreground": { light: "{scales.brand.800}" } } } };
    const cfg = { scaleOutput: "oklch" };
    const out = expandScales(raw, cfg);
    const ramp = out.scales.brand;
    assert.ok(!("$generate" in ramp), "$generate expanded away");
    assert.deepEqual(Object.keys(ramp), ["25","50","100","200","300","400","500","600","700","800","900"]);
    assert.match(ramp["600"].light, /^oklch\(/);
    assert.equal(ramp["600"].light, expandScales(raw, cfg).scales.brand["600"].light, "deterministic");
  });
  test("anchor step L equals base L (lossless anchor)", async () => {
    const { expandScales, hexToOklch } = await import("../src/scale-gen.mjs");
    const raw = { meta: {}, scales: { brand: { $generate: { base: { light: "#2563eb" }, anchor: 600 } } }, semantic: {} };
    const out = expandScales(raw, { scaleOutput: "hex" });
    const anchorHex = out.scales.brand["600"].light;
    const dL = Math.abs(hexToOklch(anchorHex).L - hexToOklch("#2563eb").L);
    assert.ok(dL < 0.01, `anchor L close to base L, ΔL=${dL}`);
  });
  test("L is strictly monotonic decreasing 25→900", async () => {
    const { expandScales, ... } = await import("../src/scale-gen.mjs");
    // (use hexToOklch on scaleOutput:hex ramp; assert L[25] > L[50] > ... > L[900], all unique)
  });
  test("scaleOutput:hex emits hex; $generate.base without dark mirrors light under autoMirrorDark", async () => {
    const { expandScales } = await import("../src/scale-gen.mjs");
    const raw = { meta: { autoMirrorDark: true }, scales: { brand: { $generate: { base: { light: "#2563eb" } } } }, semantic: {} };
    const out = expandScales(raw, { scaleOutput: "hex" });
    assert.match(out.scales.brand["600"].light, /^#[0-9a-f]{6}$/);
    assert.equal(out.scales.brand["600"].dark, out.scales.brand["600"].light, "autoMirror: dark==light");
  });
  test("ramps without $generate pass through unchanged", async () => {
    const { expandScales } = await import("../src/scale-gen.mjs");
    const raw = { meta: {}, scales: { primary: { "600": { light: "#2563eb" } } }, semantic: {} };
    assert.deepEqual(expandScales(raw, {}).scales.primary, { "600": { light: "#2563eb" } });
  });
  ```

- [ ] 실행 → 실패(함수 부재).

- [ ] `expandScales` 구현(§6.8.3 L 사다리/anchor/C 감쇠):
  ```js
  const L_LADDER = { 25:0.985, 50:0.970, 100:0.940, 200:0.885, 300:0.805, 400:0.715, 500:0.640, 600:0.575, 700:0.505, 800:0.430, 900:0.355 };
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  function rampFor(baseHex, anchor, scaleOutput) {
    const { L: bL, C: bC, H } = hexToOklch(baseHex);
    const dL = bL - L_LADDER[anchor ?? 600];
    const out = {};
    for (const step of Object.keys(L_LADDER)) {
      const L = clamp01(L_LADDER[step] + dL);
      const C = L >= 0.9 ? bC * (1 - L) / 0.1 : bC;
      out[step] = scaleOutput === "hex" ? oklchToHex(L, C, H) : formatOklch(L, C, H);
    }
    return out;
  }
  export function expandScales(rawTokens, config) {
    if (!rawTokens.scales) return rawTokens;
    const scaleOutput = (config && config.scaleOutput) || "oklch";
    const autoMirror = Boolean(rawTokens.meta && rawTokens.meta.autoMirrorDark);
    const scales = {};
    for (const [color, ramp] of Object.entries(rawTokens.scales)) {
      if (!ramp || !("$generate" in ramp)) { scales[color] = ramp; continue; }
      const { base, anchor } = ramp.$generate;
      const lightRamp = rampFor(base.light, anchor, scaleOutput);
      const darkSrc = base.dark ?? (autoMirror ? base.light : undefined);
      const darkRamp = darkSrc ? rampFor(darkSrc, anchor, scaleOutput) : null;
      const expanded = {};
      for (const step of Object.keys(L_LADDER)) {
        expanded[step] = { light: lightRamp[step], ...(darkRamp ? { dark: darkRamp[step] } : {}) };
      }
      scales[color] = expanded;
    }
    return { ...rawTokens, scales };
  }
  ```
  주: `$generate.base`에 dark가 없고 autoMirror off면 dark 없이 light만 방출 → resolveRefs가 autoMirror 규칙으로 처리(없으면 validate에서 잡힘). 단조성 테스트는 hex 램프의 L을 hexToOklch로 재계산해 확인.

- [ ] 실행 → 전부 `pass`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/scale-gen.mjs test/scale-gen.test.mjs && git commit -m "$(cat <<'EOF'
  feat: expandScales — $generate→11스텝 램프(L 사다리+anchor 정렬+C 감쇠), 결정론/무손실 앵커/단조성

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## GROUP D — validate

### Task 6: test+feat — validate 스키마 리프체크 + 6슬롯 완전성(omit 면제) [RED→GREEN]

**Files:** `src/validate.mjs`, `test/validate.test.mjs`, `test/fixtures/tokens.missing-omit.json`, `test/fixtures/config.missing-omit.json`

`validate(tokens, config, schemas)` 실패시 throw, 성공시 undefined, 안 씀. **주의**: validate는 `expandScales` **이후**의 tokens를 받으므로 scales에 `$generate`는 없다(전개됨). 이 태스크는 첫 슬라이스: happy 통과 + missing-slot-without-omit 하드에러(R-B).

- [ ] `test/fixtures/tokens.missing-omit.json`(secondary가 light/light-foreground 부재):
  ```json
  { "meta": { "autoMirrorDark": true }, "semantic": {
    "primary": { "base": { "light": "#2563eb", "dark": "#5b93f0" }, "hover": { "light": "#1d4ed8", "dark": "#3f76c4" }, "active": { "light": "#1e40af", "dark": "#2b5490" }, "foreground": { "light": "#ffffff", "dark": "#0b1220" }, "light": { "light": "#dbeafe", "dark": "#1c3a66" }, "light-foreground": { "light": "#1e40af", "dark": "#14294a" } },
    "secondary": { "base": { "light": "#f3f4f6", "dark": "#1f2937" }, "hover": { "light": "#e5e7eb", "dark": "#374151" }, "active": { "light": "#d1d5db", "dark": "#4b5563" }, "foreground": { "light": "#1f2937", "dark": "#e5e7eb" } } } }
  ```
  `test/fixtures/config.missing-omit.json`(secondary omit 없음 → R-B):
  ```json
  { "classPrefix": "", "darkSelector": "[data-gnb-theme=\"dark\"]", "darkVariantName": "dark", "colors": ["primary", "secondary"], "variantFamilies": ["button"], "output": { "css": "dist/theme.css", "ts": "dist/variants.ts", "dts": "dist/variants.d.ts", "manifest": "dist/tokens.manifest.json" } }
  ```

- [ ] 실패 테스트 `test/validate.test.mjs`(공유 HAPPY 상수 + 첫 2 케이스). HAPPY_TOKENS는 `{scales.primary.600}` ref + `base.ring` 2홉 사용, HAPPY_CONFIG는 secondary omit 선언:
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  import { readFileSync } from "node:fs";
  import { join, dirname } from "node:path";
  import { fileURLToPath } from "node:url";
  import { validate } from "../src/validate.mjs";
  const HERE = dirname(fileURLToPath(import.meta.url)); const FIX = join(HERE, "fixtures"); const PKG = dirname(HERE);
  const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
  const SCHEMAS = { tokens: readJson(join(PKG, "tokens.schema.json")), config: readJson(join(PKG, "config.schema.json")) };
  const HAPPY_TOKENS = {
    meta: { autoMirrorDark: true },
    scales: { primary: { "600": { light: "#2563eb", dark: "#5b93f0" } } },
    semantic: {
      primary: { base: { light: "{scales.primary.600}", dark: "{scales.primary.600}" }, hover: { light: "#1d4ed8", dark: "#3f76c4" }, active: { light: "#1e40af", dark: "#2b5490" }, foreground: { light: "#ffffff", dark: "#0b1220" }, light: { light: "#dbeafe", dark: "#1c3a66" }, "light-foreground": { light: "#1e40af", dark: "#14294a" } },
      secondary: { base: { light: "#f3f4f6", dark: "#1f2937" }, hover: { light: "#e5e7eb", dark: "#374151" }, active: { light: "#d1d5db", dark: "#4b5563" }, foreground: { light: "#1f2937", dark: "#e5e7eb" } } },
    base: { ring: { light: "{semantic.primary.base}", dark: "{semantic.primary.base}" } }
  };
  const HAPPY_CONFIG = { classPrefix: "", darkSelector: '[data-gnb-theme="dark"]', darkVariantName: "dark", colors: ["primary", "secondary"], variantFamilies: ["button"], output: { css: "dist/theme.css", ts: "dist/variants.ts", dts: "dist/variants.d.ts", manifest: "dist/tokens.manifest.json" }, slotOverrides: { secondary: { omit: ["light", "light-foreground"] } }, baseColorEmit: {}, variantOverrides: {}, helpers: {} };
  test("validate passes for valid seed-shaped input", () => { assert.doesNotThrow(() => validate(HAPPY_TOKENS, HAPPY_CONFIG, SCHEMAS)); });
  test("missing required slot WITHOUT omit throws (R-B)", () => {
    assert.throws(() => validate(readJson(join(FIX, "tokens.missing-omit.json")), readJson(join(FIX, "config.missing-omit.json")), SCHEMAS), /secondary.*(light|light-foreground)|missing.*slot/i);
  });
  ```

- [ ] 실행 → 실패(모듈 부재, non-zero exit).

- [ ] `src/validate.mjs` 구현(스키마-쉐입 + autoMirror 완화 + 슬롯 완전성):
  ```js
  const SLOT_ORDER = ["base", "hover", "active", "foreground", "light", "light-foreground"];
  const REF_RE = /^\{([^}]+)\}$/;
  const COLOR_RE = /^(#|rgb|rgba|hsl|oklch|\{).+/;
  function checkLeaf(leaf, where, autoMirror) {
    if (leaf === null || typeof leaf !== "object" || Array.isArray(leaf)) throw new Error(`Invalid token at ${where}: expected {light,dark} leaf.`);
    if (typeof leaf.light !== "string" || !COLOR_RE.test(leaf.light)) throw new Error(`Invalid token at ${where}: 'light' must be a CSS color or {ref}.`);
    if (leaf.dark === undefined) { if (!autoMirror) throw new Error(`Missing 'dark' at ${where}: set meta.autoMirrorDark=true or author dark.`); }
    else if (typeof leaf.dark !== "string" || !COLOR_RE.test(leaf.dark)) throw new Error(`Invalid token at ${where}: 'dark' must be a CSS color or {ref}.`);
    for (const k of Object.keys(leaf)) if (k !== "light" && k !== "dark") throw new Error(`Unknown key '${k}' at ${where}.`);
  }
  export function validate(tokens, config, schemas) {
    if (tokens === null || typeof tokens !== "object") throw new Error("Invalid tokens.json: top-level object expected.");
    if (!tokens.semantic || typeof tokens.semantic !== "object") throw new Error("Invalid tokens.json: 'semantic' required.");
    if (Object.keys(tokens.semantic).length < 1) throw new Error("Invalid tokens.json: 'semantic' minProperties>=1.");
    const autoMirror = Boolean(tokens.meta && tokens.meta.autoMirrorDark);
    if (tokens.scales) for (const [c, ramp] of Object.entries(tokens.scales)) for (const [s, leaf] of Object.entries(ramp)) {
      if (!/^[0-9]{2,3}$/.test(s)) throw new Error(`Invalid scale shade '${s}' in scales.${c}.`);
      checkLeaf(leaf, `scales.${c}.${s}`, autoMirror);
    }
    if (tokens.base) for (const [k, leaf] of Object.entries(tokens.base)) checkLeaf(leaf, `base.${JSON.stringify(k)}`, autoMirror);
    const slotOverrides = config.slotOverrides || {};
    for (const [c, slots] of Object.entries(tokens.semantic)) {
      if (slots === null || typeof slots !== "object") throw new Error(`Invalid semantic.${c}.`);
      const omit = new Set((slotOverrides[c] && slotOverrides[c].omit) || []);
      for (const slot of SLOT_ORDER.filter((s) => !omit.has(s)))
        if (slots[slot] === undefined) throw new Error(`Missing required slot 'semantic.${c}.${slot}'. Provide it or declare slotOverrides.${c}.omit.`);
      for (const [slot, leaf] of Object.entries(slots)) {
        if (!SLOT_ORDER.includes(slot)) throw new Error(`Unknown slot 'semantic.${c}.${slot}'.`);
        checkLeaf(leaf, `semantic.${c}.${slot}`, autoMirror);
      }
    }
  }
  ```

- [ ] 실행 → `pass 2`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/validate.mjs test/validate.test.mjs test/fixtures/tokens.missing-omit.json test/fixtures/config.missing-omit.json && git commit -m "$(cat <<'EOF'
  feat: validate — 스키마 리프체크 + 6슬롯 완전성(omit 면제), R-B 하드에러

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 7: test+feat — validate 크로스체크(config.color 존재 + slotOverrides 키 존재) [RED→GREEN]

**Files:** `src/validate.mjs`(편집), `test/validate.test.mjs`(편집)

> 리뷰 반영: `config.colors` 존재 체크(§7.4)에 더해, **`slotOverrides.<c>` 키가 semantic 색이거나 base 토큰이어야** 함을 검증(오타 `slotOverrides.mtued` 방지). 단 `muted`처럼 base 토큰인 pseudo-color는 허용(스펙 §7.1이 명시적으로 `slotOverrides.muted`를 둠) — 즉 "semantic에 있거나 base 키에 있으면 통과, 둘 다 아니면 throw".

- [ ] 실패 케이스 추가:
  ```js
  test("config.colors listing an absent semantic color throws", () => {
    assert.throws(() => validate(HAPPY_TOKENS, { ...HAPPY_CONFIG, colors: ["primary", "secondary", "teal"] }, SCHEMAS), /teal.*semantic|unknown color.*teal/i);
  });
  test("slotOverrides key that is neither a semantic color nor a base token throws", () => {
    assert.throws(() => validate(HAPPY_TOKENS, { ...HAPPY_CONFIG, slotOverrides: { ...HAPPY_CONFIG.slotOverrides, mtued: { omit: ["hover"] } } }, SCHEMAS), /slotOverrides.*mtued|unknown.*mtued/i);
  });
  test("slotOverrides for a base pseudo-color (muted) is accepted", () => {
    const t = structuredClone(HAPPY_TOKENS); t.base = { ...t.base, muted: { light: "#f3f4f6", dark: "#1f2937" } };
    assert.doesNotThrow(() => validate(t, { ...HAPPY_CONFIG, slotOverrides: { ...HAPPY_CONFIG.slotOverrides, muted: { omit: ["hover", "active", "light", "light-foreground"] } } }, SCHEMAS));
  });
  test("{ref} leaves are accepted, not rejected as bad colors", () => { assert.doesNotThrow(() => validate(HAPPY_TOKENS, HAPPY_CONFIG, SCHEMAS)); });
  ```

- [ ] 실행 → `config.colors`/`slotOverrides` 케이스 실패 확인(non-zero).

- [ ] validate() 끝(semantic 루프 후)에 삽입:
  ```js
    if (!Array.isArray(config.colors)) throw new Error("Invalid design.config.json: 'colors' must be an array.");
    for (const color of config.colors)
      if (!Object.prototype.hasOwnProperty.call(tokens.semantic, color)) throw new Error(`config.colors lists unknown color '${color}': not in tokens.semantic.`);
    const baseKeys = new Set(Object.keys(tokens.base || {}).map((k) => k.replace(/\//g, "-")));
    for (const key of Object.keys(config.slotOverrides || {}))
      if (!Object.prototype.hasOwnProperty.call(tokens.semantic, key) && !baseKeys.has(key))
        throw new Error(`slotOverrides key '${key}' names neither a semantic color nor a base token — likely a typo.`);
  ```

- [ ] 실행 → 전부 `pass`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/validate.mjs test/validate.test.mjs && git commit -m "$(cat <<'EOF'
  feat: validate — config.colors 존재 + slotOverrides 키 존재(semantic|base) 크로스체크

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 8: test+feat — validate 미해결 ref + 순환 + 중복 방출 var(baseColorEmit 인지) [RED→GREEN]

**Files:** `src/validate.mjs`(편집), `test/validate.test.mjs`(편집)

> 리뷰 반영: 중복-var 열거는 **실제 방출 집합과 일치**해야 한다 — `baseColorEmit[k]===false`로 억제될 키는 `claim()` 전에 스킵(renderCss의 방출 집합과 동일). ref 워크는 autoMirror를 리프-레벨 **및 매 홉**에서 적용(Task 10과 동일 시맨틱)해 light-only 시드도 통과.

- [ ] 실패 케이스 3종(미해결 ref / 순환 / 중복 var) 추가:
  ```js
  test("unresolvable {ref} throws", () => {
    const t = structuredClone(HAPPY_TOKENS); t.base = { ...t.base, ghost: { light: "{scales.primary.999}", dark: "{scales.primary.999}" } };
    assert.throws(() => validate(t, HAPPY_CONFIG, SCHEMAS), /unresolv|not found|scales\.primary\.999/i);
  });
  test("a reference cycle throws", () => {
    const t = structuredClone(HAPPY_TOKENS); t.base = { ...t.base, a: { light: "{base.b}", dark: "{base.b}" }, b: { light: "{base.a}", dark: "{base.a}" } };
    assert.throws(() => validate(t, HAPPY_CONFIG, SCHEMAS), /cycle|circular/i);
  });
  test("duplicate emitted --color-* var throws (primary/hover base collides with semantic hover)", () => {
    const t = structuredClone(HAPPY_TOKENS); t.base = { ...t.base, "primary/hover": { light: "#000000", dark: "#000000" } };
    assert.throws(() => validate(t, HAPPY_CONFIG, SCHEMAS), /duplicate.*primary-hover|primary-hover.*duplicate/i);
  });
  test("a var suppressed by baseColorEmit=false does NOT trigger a false duplicate", () => {
    const t = structuredClone(HAPPY_TOKENS); t.base = { ...t.base, "surface/overlay": { light: "rgba(0,0,0,0.5)", dark: "rgba(0,0,0,0.7)" } };
    assert.doesNotThrow(() => validate(t, { ...HAPPY_CONFIG, baseColorEmit: { "surface/overlay": false } }, SCHEMAS));
  });
  ```

- [ ] 실행 → 3종 실패 확인.

- [ ] validate 상단에 ref 헬퍼(매 홉 autoMirror), 끝에 ref-워크 + 중복-var(baseColorEmit 스킵) 추가:
  ```js
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
  ```
  validate() 끝(ref-워크 + 중복-var):
  ```js
    const walk = (leaf, where) => { for (const mode of ["light", "dark"]) { try { resolveLeafValue(tokens, leaf, mode, autoMirror, new Set()); } catch (e) { throw new Error(`${where}: ${e.message}`); } } };
    if (tokens.scales) for (const [c, r] of Object.entries(tokens.scales)) for (const [s, leaf] of Object.entries(r)) walk(leaf, `scales.${c}.${s}`);
    for (const [c, slots] of Object.entries(tokens.semantic)) for (const [s, leaf] of Object.entries(slots)) walk(leaf, `semantic.${c}.${s}`);
    if (tokens.base) for (const [k, leaf] of Object.entries(tokens.base)) walk(leaf, `base.${JSON.stringify(k)}`);
    const baseColorEmit = config.baseColorEmit || {};
    const emitted = new Map();
    const claim = (suffix, src) => { if (emitted.has(suffix)) throw new Error(`Duplicate emitted var '--color-${suffix}': ${emitted.get(suffix)} & ${src}.`); emitted.set(suffix, src); };
    if (tokens.scales) for (const [c, r] of Object.entries(tokens.scales)) for (const s of Object.keys(r)) claim(`${c}-${s}`, `scales.${c}.${s}`);
    const so = config.slotOverrides || {};
    for (const [c, slots] of Object.entries(tokens.semantic)) { const omit = new Set((so[c] && so[c].omit) || []); for (const slot of Object.keys(slots)) { if (omit.has(slot)) continue; claim(slot === "base" ? c : `${c}-${slot}`, `semantic.${c}.${slot}`); } }
    if (tokens.base) for (const k of Object.keys(tokens.base)) { if (baseColorEmit[k] === false) continue; claim(k.replace(/\//g, "-"), `base.${JSON.stringify(k)}`); }
  ```

- [ ] 실행 → 전부 `pass`. 전체 그룹 회귀 `cd … && node --test test/load.test.mjs test/validate.test.mjs test/scale-gen.test.mjs` → `fail 0`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/validate.mjs test/validate.test.mjs && git commit -m "$(cat <<'EOF'
  feat: validate — 다단·섹션교차 ref/순환 하드에러 + 중복 방출 var(baseColorEmit 인지, §7.4 완성)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## GROUP E — resolve-refs

### Task 9: test+feat — resolveRefs 픽스처 + 리터럴 통과 + 키 평탄화 + 단일/2홉 참조 [RED→GREEN]

**Files:** `src/resolve-refs.mjs`, `test/resolve-refs.test.mjs`, `test/fixtures/tokens.resolve.json`, `test/fixtures/tokens.cycle.json`

`resolveRefs(tokens, mode) -> ResolvedLeafMap`. 키 = `--color-` 프리픽스 없는 suffix(`primary-600`, `primary`(=base), `primary-hover`, `surface-overlay`(슬래시→대시), `ring`). 값 = 해석 리터럴. 방출 순서: scales → semantic → base(각 삽입 순서). **주의**: baseColorEmit/omit 억제는 resolveRefs가 아니라 상위 caller(bin/ds.mjs, Task 15)가 담당 — resolveRefs는 tokens에 존재하는 모든 리프를 방출.

- [ ] `test/fixtures/tokens.resolve.json`(모드별 다른 스텝을 가리켜 mode-crossing 버그 검출; 2홉 ring):
  ```json
  {
    "meta": { "autoMirrorDark": false },
    "scales": { "primary": { "500": { "light": "#3b82f6", "dark": "#5b93f0" }, "600": { "light": "#2563eb", "dark": "#6ea3f5" }, "700": { "light": "#1d4ed8", "dark": "#8fbaf8" } } },
    "semantic": { "primary": {
      "base": { "light": "{scales.primary.600}", "dark": "{scales.primary.500}" }, "hover": { "light": "{scales.primary.700}", "dark": "{scales.primary.600}" },
      "active": { "light": "#1e40af", "dark": "#b3d1fb" }, "foreground": { "light": "#ffffff", "dark": "#0b1220" },
      "light": { "light": "#dbeafe", "dark": "#1c3a66" }, "light-foreground": { "light": "#1e40af", "dark": "#14294a" } } },
    "base": { "ring": { "light": "{semantic.primary.base}", "dark": "{semantic.primary.base}" }, "surface/overlay": { "light": "rgba(0,0,0,0.5)", "dark": "rgba(0,0,0,0.7)" } }
  }
  ```
  `test/fixtures/tokens.cycle.json`(base.a→base.b→base.a):
  ```json
  {
    "meta": { "autoMirrorDark": false },
    "semantic": { "primary": { "base": { "light": "#2563eb", "dark": "#6ea3f5" }, "hover": { "light": "#1d4ed8", "dark": "#8fbaf8" }, "active": { "light": "#1e40af", "dark": "#b3d1fb" }, "foreground": { "light": "#ffffff", "dark": "#0b1220" }, "light": { "light": "#dbeafe", "dark": "#1c3a66" }, "light-foreground": { "light": "#1e40af", "dark": "#14294a" } } },
    "base": { "a": { "light": "{base.b}", "dark": "{base.b}" }, "b": { "light": "{base.a}", "dark": "{base.a}" } }
  }
  ```

- [ ] 실패 테스트 `test/resolve-refs.test.mjs`(리터럴 통과 + 단일홉 + 2홉 + 결정적 순서):
  ```js
  import { test } from "node:test"; import assert from "node:assert/strict";
  import { readFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
  import { resolveRefs } from "../src/resolve-refs.mjs";
  const HERE = dirname(fileURLToPath(import.meta.url)); const load = (n) => JSON.parse(readFileSync(join(HERE, "fixtures", n), "utf8"));
  test("literal leaves pass through (light/dark) + slash key flattened", () => {
    const t = load("tokens.resolve.json");
    assert.equal(resolveRefs(t, "light")["surface-overlay"], "rgba(0,0,0,0.5)");
    assert.equal(resolveRefs(t, "light")["primary-foreground"], "#ffffff");
    assert.equal(resolveRefs(t, "dark")["surface-overlay"], "rgba(0,0,0,0.7)");
  });
  test("single-hop ref resolves through SAME mode ramp", () => {
    const t = load("tokens.resolve.json");
    assert.equal(resolveRefs(t, "light")["primary"], "#2563eb");
    assert.equal(resolveRefs(t, "light")["primary-hover"], "#1d4ed8");
    assert.equal(resolveRefs(t, "dark")["primary"], "#5b93f0");
    assert.equal(resolveRefs(t, "dark")["primary-hover"], "#6ea3f5");
  });
  test("2-hop ring folds to literal in both modes", () => {
    const t = load("tokens.resolve.json"); const L = resolveRefs(t, "light"); const D = resolveRefs(t, "dark");
    assert.equal(L["ring"], "#2563eb"); assert.equal(D["ring"], "#5b93f0");
    assert.equal(L["ring"], L["primary"]); assert.equal(D["ring"], D["primary"]);
  });
  test("emission key order is deterministic: scales, semantic, base", () => {
    assert.deepEqual(Object.keys(resolveRefs(load("tokens.resolve.json"), "light")), ["primary-500","primary-600","primary-700","primary","primary-hover","primary-active","primary-foreground","primary-light","primary-light-foreground","ring","surface-overlay"]);
  });
  ```

- [ ] 실행 → 실패(모듈 부재).

- [ ] `src/resolve-refs.mjs` 구현(리터럴+참조 해석; autoMirror는 다음 태스크):
  ```js
  const REF_RE = /^\{([^}]+)\}$/;
  const semanticKey = (c, s) => (s === "base" ? c : `${c}-${s}`);
  const baseKey = (k) => k.replace(/\//g, "-");
  function* enumerateLeaves(tokens) {
    if (tokens.scales) for (const [c, r] of Object.entries(tokens.scales)) for (const [s, leaf] of Object.entries(r)) yield { key: `${c}-${s}`, leaf };
    for (const [c, slots] of Object.entries(tokens.semantic)) for (const [s, leaf] of Object.entries(slots)) yield { key: semanticKey(c, s), leaf };
    if (tokens.base) for (const [k, leaf] of Object.entries(tokens.base)) yield { key: baseKey(k), leaf };
  }
  function leafAtPath(tokens, path) { let n = tokens; for (const p of path.split(".")) { if (n == null || typeof n !== "object") return undefined; n = n[p]; } return n; }
  function resolveOne(tokens, value, mode, seen) {
    const m = REF_RE.exec(value); if (!m) return value;
    const path = m[1];
    if (seen.has(path)) throw new Error(`resolveRefs: reference cycle detected: ${[...seen, path].join(" -> ")}`);
    seen.add(path);
    const leaf = leafAtPath(tokens, path);
    if (leaf == null || typeof leaf !== "object" || !(mode in leaf)) throw new Error(`resolveRefs: unresolvable reference {${path}} in mode "${mode}"`);
    return resolveOne(tokens, leaf[mode], mode, seen);
  }
  export function resolveRefs(tokens, mode) {
    const out = {};
    for (const { key, leaf } of enumerateLeaves(tokens)) out[key] = resolveOne(tokens, leaf[mode], mode, new Set());
    return out;
  }
  ```

- [ ] 실행 → `pass 4`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/resolve-refs.mjs test/resolve-refs.test.mjs test/fixtures/tokens.resolve.json test/fixtures/tokens.cycle.json && git commit -m "$(cat <<'EOF'
  feat: resolveRefs — 리터럴 통과+키 평탄화, 다단·섹션교차 참조(모드별), 결정적 순서

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 10: test+feat — resolveRefs 순환/미해결 하드에러 + autoMirrorDark(매 홉 적용) [RED→GREEN]

**Files:** `src/resolve-refs.mjs`(편집), `test/resolve-refs.test.mjs`(편집)

> **리뷰 반영(핵심 blocker)**: autoMirror 폴백을 **최상위 리프뿐 아니라 매 홉**에 적용해야 한다. 그렇지 않으면 seed(light-only, autoMirrorDark=true)에서 `semantic.primary.base={scales.primary.600}`(dark 없음) → dark 해석 시 리프-레벨 미러로 light 값 `{scales.primary.600}`을 얻고, resolveOne이 scales.primary.600(dark 없음)으로 들어가 `!(mode in leaf)`로 **throw** → `ds build` 전체 실패. 매 홉 autoMirror로 이를 방지하고, **light-only 스케일 스텝을 참조하는 dark-omitted 리프**를 RED-first로 커버한다.

- [ ] 실패/회귀 케이스 추가:
  ```js
  test("cycle is a hard error (light & dark)", () => {
    const t = load("tokens.cycle.json");
    assert.throws(() => resolveRefs(t, "light"), /cycle detected/i);
    assert.throws(() => resolveRefs(t, "dark"), /cycle detected/i);
  });
  test("unresolvable ref is a hard error", () => {
    const t = { meta: { autoMirrorDark: false }, semantic: { primary: { base: { light: "{scales.primary.999}", dark: "#000" }, hover: { light: "#111", dark: "#111" }, active: { light: "#222", dark: "#222" }, foreground: { light: "#fff", dark: "#000" }, light: { light: "#eee", dark: "#333" }, "light-foreground": { light: "#444", dark: "#ccc" } } } };
    assert.throws(() => resolveRefs(t, "light"), /unresolvable reference/i);
  });
  test("autoMirrorDark: dark-omitted leaf ref to a LIGHT-ONLY scale step resolves per-hop (seed shape)", () => {
    const t = { meta: { autoMirrorDark: true }, scales: { primary: { "600": { light: "#2563eb" } } }, semantic: { primary: { base: { light: "{scales.primary.600}" }, hover: { light: "#111", dark: "#222" }, active: { light: "#333", dark: "#444" }, foreground: { light: "#fff", dark: "#000" }, light: { light: "#eee", dark: "#ddd" }, "light-foreground": { light: "#555", dark: "#666" } } }, base: { "surface/overlay": { light: "rgba(0,0,0,0.5)" } } };
    const D = resolveRefs(t, "dark");
    assert.equal(D["primary"], "#2563eb", "dark mirrors light through a light-only scale step");
    assert.equal(D["surface-overlay"], "rgba(0,0,0,0.5)");
    assert.equal(D["primary-hover"], "#222", "explicit dark still wins");
    assert.equal(resolveRefs(t, "light")["primary"], "#2563eb");
  });
  ```

- [ ] 실행 → autoMirror 케이스 실패 확인(현 impl이 `leaf[mode]` 무조건 읽음).

- [ ] `src/resolve-refs.mjs`에 `pickModeValue` 추가 + resolveOne을 **매 홉 pickModeValue** 사용으로 변경:
  ```js
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
    return resolveOne(tokens, pickModeValue(tokens, leaf, mode), mode, seen);   // ← 매 홉 autoMirror
  }
  export function resolveRefs(tokens, mode) {
    const out = {};
    for (const { key, leaf } of enumerateLeaves(tokens)) out[key] = resolveOne(tokens, pickModeValue(tokens, leaf, mode), mode, new Set());
    return out;
  }
  ```

- [ ] 실행 → 전부 `pass`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/resolve-refs.mjs test/resolve-refs.test.mjs && git commit -m "$(cat <<'EOF'
  feat: resolveRefs — 순환/미해결 하드에러 + autoMirrorDark 매 홉 적용(light-only 스케일 참조 안전)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## GROUP F — render-css + render-manifest

### Task 11: test+feat — renderCss 골격(헤더 + darkSelector 파생 @custom-variant) [RED→GREEN]

**Files:** `src/render-css.mjs`, `test/render-css.test.mjs`, `test/helpers/render-css-inputs.mjs`

`renderCss(resolvedLight, resolvedDark, config, sourceHash) -> string`. omit/baseColorEmit 억제 키는 **이미 맵에 부재**(상위 caller가 제거) — renderCss는 "맵에 있는 것만" 결정적 순서로 방출.

> **리뷰 반영(blocker)**: base 방출 순서는 하드코딩 `BASE_ORDER` 배열이 아니라 **ResolvedLeafMap의 삽입 순서**(= enumerateLeaves가 고정한 tokens.base 키 순서)에서 파생한다. 이렇게 해야 tokens.json에 새 base 토큰이 추가돼도 조용히 드롭되지 않는다. semantic 색은 `config.colors` 순, 각 색은 스케일 스텝(오름차순) → 6슬롯 고정 순, 그다음 semantic/scale에 속하지 않는 **나머지 키를 맵 삽입 순서대로**(= base).

- [ ] `test/helpers/render-css-inputs.mjs` 작성 — 공유 fixture 상수(§6.6/§7.3 리터럴 복사; 세 색 형태 + 2홉 ring + surface-overlay **부재**). resolvedLight/resolvedDark는 **삽입 순서가 scales→semantic→base**가 되도록 키를 나열한다(원 초안의 맵 그대로: primary 스케일 25..900 → primary 6슬롯 → secondary(active 유지, light 부재) → danger 6슬롯 → base(background..ring) → `ring`은 base 그룹 끝). `config`는 `colors:["primary","secondary","success","warning","danger","info","accent"]`, `slotOverrides.secondary.omit`, `slotOverrides.muted.omit`, `baseColorEmit:{"surface/overlay":false}`. `sourceHash`는 고정 더미 `"deadbeef…"`(64 hex).
  *(초안의 `render-css-inputs.mjs` 전체를 그대로 사용하되, base 그룹 키 순서를 tokens.base 순서와 일치시킨다: background, foreground, card, card-foreground, text-primary, text-secondary, text-tertiary, text-muted, border, border-hover, input, surface, surface-hover, surface-active, surface-raised, muted, muted-foreground, ring.)*

- [ ] 첫 실패 테스트(@custom-variant 파생 + fortress `globals.css:3` 바이트 동일):
  ```js
  import { test } from "node:test"; import assert from "node:assert/strict";
  import { renderCss } from "../src/render-css.mjs";
  import { resolvedLight, resolvedDark, config, sourceHash } from "./helpers/render-css-inputs.mjs";
  test("@custom-variant derived from darkSelector, byte-equal to fortress globals.css:3", () => {
    const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
    const expected = '@custom-variant dark (&:where([data-gnb-theme="dark"], [data-gnb-theme="dark"] *));';
    assert.ok(css.includes("\n" + expected + "\n"));
    const derived = "@custom-variant " + config.darkVariantName + " (&:where(" + config.darkSelector + ", " + config.darkSelector + " *));";
    assert.equal(derived, expected);
    assert.ok(css.includes(derived));
  });
  ```

- [ ] 실행 → 실패(모듈 부재). 커밋 안 함(구현과 함께).

- [ ] `src/render-css.mjs` 골격(헤더 + @custom-variant + 빈 @theme/dark). **BASE_ORDER 하드코딩 금지** — 방출 유틸을 다음 태스크에서 삽입-순서 파생으로 채운다:
  ```js
  const SLOT_ORDER = ["", "hover", "active", "foreground", "light", "light-foreground"];
  const isScaleSuffix = (color, suffix) => { const p = color + "-"; return suffix.startsWith(p) && /^[0-9]{2,3}$/.test(suffix.slice(p.length)); };
  function customVariantLine(config) { const s = config.darkSelector; return `@custom-variant ${config.darkVariantName} (&:where(${s}, ${s} *));`; }
  function header(h) { return `/* AUTO-GENERATED by @blomics-platform/design-system — DO NOT EDIT. Source hash: ${h}.\n   Edit tokens.json / design.config.json and run \`ds build\`.\n   NOTE: 소비자 globals.css가 \`@import "tailwindcss";\` 를 이 파일 import 위에 두어야 한다. */`; }
  export function renderCss(resolvedLight, resolvedDark, config, sourceHash) {
    const lines = [header(sourceHash), "", customVariantLine(config), "", "@theme {"];
    lines.push("}"); lines.push(""); lines.push(config.darkSelector + " {"); lines.push("}"); lines.push("");
    return lines.join("\n");
  }
  ```

- [ ] 실행 → `pass 1`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/render-css.mjs test/render-css.test.mjs test/helpers/render-css-inputs.mjs && git commit -m "$(cat <<'EOF'
  feat: renderCss 골격 — 헤더 + darkSelector 파생 @custom-variant(fortress globals.css:3 바이트 동일)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 12: test+feat — @theme 라이트 방출 + [darkSelector] 다크 재방출(스킵 최적화 없음) + 헤더/결정성 [RED→GREEN]

**Files:** `src/render-css.mjs`(편집), `test/render-css.test.mjs`(편집)

- [ ] 방출 테스트 추가(스케일/6슬롯/base 라이트, secondary active 유지·light 미방출, surface-overlay 미방출, 결정적 순서, 다크 전-var 재방출, 헤더 sourceHash·타임스탬프 부재, 결정성):
  ```js
  test("@theme emits scales+6slots+base light literals; secondary active kept/light omitted; overlay absent", () => {
    const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
    assert.ok(css.includes("--color-primary-25: #f5f9ff;"));
    assert.ok(css.includes("--color-primary: #2563eb;"));
    assert.ok(css.includes("--color-ring: #2563eb;"));
    assert.ok(css.includes("--color-secondary-active: #d1d5db;"));
    assert.ok(!css.includes("--color-secondary-light:"));
    assert.ok(!css.includes("--color-surface-overlay"));
    assert.ok(css.includes("--color-surface-hover: #f9fafb;"));
    const iScale = css.indexOf("--color-primary-25:"), iBase = css.indexOf("--color-primary: "), iDanger = css.indexOf("--color-danger: ");
    assert.ok(iScale !== -1 && iScale < iBase && iBase < iDanger, "scale<base, config.colors order");
  });
  function varNames(block) { const s = new Set(); for (const m of block.matchAll(/--color-[a-z0-9-]+(?=:)/g)) s.add(m[0]); return s; }
  test("dark block re-emits EVERY light var (no skip optimization)", () => {
    const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
    const tS = css.indexOf("@theme {"), tE = css.indexOf("}", tS);
    const dS = css.indexOf(config.darkSelector + " {"), dE = css.indexOf("}", dS);
    assert.deepEqual([...varNames(css.slice(dS, dE))].sort(), [...varNames(css.slice(tS, tE))].sort());
    assert.ok(css.slice(dS).includes("--color-background: #0b0f1a;"));
    assert.ok(css.slice(dS).includes("--color-ring: #6ea3f5;"));
  });
  test("dark==light values are still re-emitted, not skipped", () => {
    const css = renderCss(resolvedLight, { ...resolvedLight }, config, sourceHash);
    assert.ok(css.slice(css.indexOf(config.darkSelector + " {")).includes("--color-primary: #2563eb;"));
  });
  test("header carries sourceHash, no timestamp; render is deterministic", () => {
    const css = renderCss(resolvedLight, resolvedDark, config, sourceHash);
    assert.ok(css.startsWith("/* AUTO-GENERATED"));
    assert.ok(css.includes("Source hash: " + sourceHash + "."));
    assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(css));
    assert.equal(css, renderCss(resolvedLight, resolvedDark, config, sourceHash));
  });
  ```

- [ ] 실행 → 새 케이스 실패(빈 @theme).

- [ ] 방출 로직 구현(base는 **맵 삽입 순서 파생**):
  ```js
  function decl(map, suffix) { return Object.prototype.hasOwnProperty.call(map, suffix) ? "    --color-" + suffix + ": " + map[suffix] + ";" : null; }
  function emitBody(map, config) {
    const out = []; const emittedKeys = new Set();
    for (const color of config.colors) {
      const scales = Object.keys(map).filter((k) => isScaleSuffix(color, k)).sort((a, b) => Number(a.slice(color.length + 1)) - Number(b.slice(color.length + 1)));
      for (const s of scales) { out.push(decl(map, s)); emittedKeys.add(s); }
      for (const slot of SLOT_ORDER) { const suffix = slot === "" ? color : `${color}-${slot}`; const l = decl(map, suffix); if (l) { out.push(l); emittedKeys.add(suffix); } }
    }
    // 나머지 키(base) — 맵 삽입 순서 그대로. 어떤 base 토큰도 조용히 드롭되지 않음.
    for (const key of Object.keys(map)) { if (emittedKeys.has(key)) continue; out.push(decl(map, key)); emittedKeys.add(key); }
    return out.filter(Boolean);
  }
  ```
  `renderCss` 본문의 @theme/dark 블록을 `emitBody(resolvedLight, config)` / `emitBody(resolvedDark, config)`로 채운다(스킵 최적화 금지).

- [ ] 실행 → `pass` 전부(@custom-variant + 방출 + 다크 + 헤더). 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/render-css.mjs test/render-css.test.mjs && git commit -m "$(cat <<'EOF'
  feat: renderCss @theme 라이트 + 다크 전-var 재방출 — base 순서는 맵 삽입 순서 파생(하드코딩 없음)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 13: test+feat — renderManifest(방출 var/scale/base/omit/variantKeys) [RED→GREEN]

**Files:** `src/render-manifest.mjs`, `test/render-manifest.test.mjs`

`renderManifest(resolvedLight, resolvedDark, model, config, sourceHash) -> Manifest`. 배열은 정렬. caller가 `JSON.stringify(obj,null,2)+"\n"`.

> 리뷰 반영: (1) `omittedVars`의 baseColorEmit 키는 **대시로 평탄화**(`surface-overlay`)해 colorVars/scaleSteps와 **같은 suffix 공간**을 쓴다. (2) `slotOverrides` 열거는 **config.colors(semantic)만** 대상 — `muted`(base pseudo-color) omit이 phantom `muted-hover` 등으로 새지 않게 한다. (3) baseTokens 분류는 prefix-매칭이 아니라 "scaleStep도 아니고 semantic 슬롯도 아닌 나머지".

- [ ] 실패 테스트(공유 render-css-inputs 재사용 + 최소 VariantModel 스텁):
  ```js
  import { test } from "node:test"; import assert from "node:assert/strict";
  import { renderManifest } from "../src/render-manifest.mjs";
  import { resolvedLight, resolvedDark, config, sourceHash } from "./helpers/render-css-inputs.mjs";
  const model = { semanticColors: config.colors, button: { primary: "…", "primary-outline": "…", "danger-outline": "…" }, badge: { primary: "…" }, alert: { primary: "…" }, text: { primary: "…", link: "…" }, card: { default: "…" }, input: { default: "…", filled: "…", outlined: "…", error: "…" }, buttonSizes: {}, commonStyles: {}, overrideKeys: new Set() };
  test("manifest carries sourceHash/generator/darkSelector/semanticColors", () => {
    const m = renderManifest(resolvedLight, resolvedDark, model, config, sourceHash);
    assert.equal(m.sourceHash, sourceHash); assert.equal(m.generator, "@blomics-platform/design-system");
    assert.equal(m.darkSelector, config.darkSelector); assert.deepEqual(m.semanticColors, config.colors);
  });
  test("colorVars.light/dark sorted, prefixed, overlay absent, light==dark name set", () => {
    const m = renderManifest(resolvedLight, resolvedDark, model, config, sourceHash);
    assert.ok(m.colorVars.light.includes("--color-primary") && m.colorVars.light.includes("--color-primary-600") && m.colorVars.light.includes("--color-ring"));
    assert.ok(!m.colorVars.light.includes("--color-surface-overlay"));
    assert.deepEqual(m.colorVars.light, [...m.colorVars.light].sort());
    assert.deepEqual(m.colorVars.dark, m.colorVars.light);
  });
  test("scaleSteps vs baseTokens classification", () => {
    const m = renderManifest(resolvedLight, resolvedDark, model, config, sourceHash);
    assert.ok(m.scaleSteps.includes("primary-25") && m.scaleSteps.includes("primary-900"));
    assert.ok(m.baseTokens.includes("background") && m.baseTokens.includes("ring"));
    assert.ok(!m.scaleSteps.includes("primary"));
  });
  test("omittedVars: omit slots + baseColorEmit=false, dash-flattened; muted phantom NOT present", () => {
    const m = renderManifest(resolvedLight, resolvedDark, model, config, sourceHash);
    assert.ok(m.omittedVars.includes("secondary-light") && m.omittedVars.includes("secondary-light-foreground"));
    assert.ok(m.omittedVars.includes("surface-overlay"), "dash form");
    assert.ok(!m.omittedVars.includes("surface/overlay"), "not slash form");
    assert.ok(!m.omittedVars.includes("muted-hover"), "muted is base, not semantic → no phantom");
    assert.deepEqual(m.omittedVars, [...m.omittedVars].sort());
  });
  test("variantKeys are per-family ordered arrays", () => {
    const m = renderManifest(resolvedLight, resolvedDark, model, config, sourceHash);
    assert.deepEqual(m.variantKeys.button, ["primary", "primary-outline", "danger-outline"]);
    assert.deepEqual(m.variantKeys.input, ["default", "filled", "outlined", "error"]);
  });
  ```

- [ ] 실행 → 실패(모듈 부재).

- [ ] `src/render-manifest.mjs` 구현:
  ```js
  const isScaleStep = (suffix) => { const i = suffix.lastIndexOf("-"); return i !== -1 && /^[0-9]{2,3}$/.test(suffix.slice(i + 1)); };
  const colorVarNames = (map) => Object.keys(map).map((s) => "--color-" + s).sort();
  function computeOmittedVars(config) {
    const out = []; const so = config.slotOverrides || {}; const semantic = new Set(config.colors);
    for (const [color, spec] of Object.entries(so)) { if (!semantic.has(color)) continue; for (const slot of spec.omit || []) out.push(slot === "base" ? color : `${color}-${slot}`); }
    for (const [key, emit] of Object.entries(config.baseColorEmit || {})) if (emit === false) out.push(key.replace(/\//g, "-"));
    return [...new Set(out)].sort();
  }
  export function renderManifest(resolvedLight, resolvedDark, model, config, sourceHash) {
    const keys = Object.keys(resolvedLight);
    const scaleSteps = keys.filter(isScaleStep).sort();
    const scaleSet = new Set(scaleSteps);
    const isSemanticSlot = (s) => model.semanticColors.some((c) => s === c || s.startsWith(c + "-"));
    const baseTokens = keys.filter((s) => !scaleSet.has(s) && !isSemanticSlot(s)).sort();
    const variantKeys = {};
    for (const fam of config.variantFamilies) variantKeys[fam] = model[fam] ? Object.keys(model[fam]) : [];
    return { sourceHash, generator: "@blomics-platform/design-system", colorVars: { light: colorVarNames(resolvedLight), dark: colorVarNames(resolvedDark) }, scaleSteps, baseTokens, omittedVars: computeOmittedVars(config), variantKeys, semanticColors: model.semanticColors, darkSelector: config.darkSelector };
  }
  ```
  주: `baseTokens`가 semantic 색 prefix로 시작하는 base 키를 오분류할 수 있는 이론적 취약성은, 현재 fixture로는 발생하지 않으나 그런 base 키 등장 시 실패하는 회귀 테스트를 남긴다(아래 case). 안전을 위해 향후 `resolvedLight`에 소스-섹션 태그를 붙이는 개선을 Task 15 note에 남긴다.

- [ ] (회귀 가드) base 키가 semantic prefix를 공유하는 경우를 잠그는 케이스는 이 태스크에서 스텁 model에 `text-primary` 유무로 이미 커버됨(`text`는 색 아님). 추가 방어가 필요하면 별도 spawn.

- [ ] 실행 → `pass 5`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/render-manifest.mjs test/render-manifest.test.mjs && git commit -m "$(cat <<'EOF'
  feat: renderManifest — colorVars/scaleSteps/baseTokens/omittedVars(대시,semantic만)/variantKeys 열거

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## GROUP G — render-variants-dts

> 단일 `test/render-variants.test.mjs`에 누적. 공유 `makeConfig()`/`makeTokens()` 헬퍼(fortress 매칭, active omit status colors 포함). 이 그룹은 resolved 리터럴에 의존하지 않고 슬롯 **이름** + config에서 파생.

### Task 14: test+feat — renderVariants 파생 전체(filled/light/outline, badge/alert/text/card, input override, sizes, commonStyles) + variants.ts/.d.ts 방출 [여러 RED→GREEN 사이클]

**Files:** `src/render-variants.mjs`, `src/render-dts.mjs`, `test/render-variants.test.mjs`

> 리뷰 반영(major): `emitTs`/get*Classes의 `config.helpers.<family>.base`/`defaultRounded` 접근은 **옵셔널-가드**한다: `const h = config.helpers?.button ?? {}; const base = h.base ?? ""; const dr = h.defaultRounded ?? "lg";` (badge/input 동일). config.schema.json이 helpers를 optional로 두므로, helpers 없는 스키마-유효 config에서 TypeError를 던지지 않아야 한다.

아래 서브-사이클을 순서대로(각각 RED→GREEN→commit). RED 실행 기대는 **"그린이 아님"**(정확한 fail 카운트에 의존 금지):

- [ ] **14a SEMANTIC_COLORS=config.colors(7)**: `renderVariants(tokens, config, sourceHash) -> { ts, dts, model }`. `model.semanticColors = [...config.colors]`. 테스트: `deepEqual(model.semanticColors, ["primary","secondary","success","warning","danger","info","accent"])`. 스텁 후 최소 구현.

- [ ] **14b buttonVariants filled + active-omit**: `bg-C hover:bg-C-hover [active:bg-C-active] text-C-foreground`. primary/secondary는 active 유지, success/warning/danger/info/accent는 omit(§10.3 R-A). 테스트 바이트 동일:
  - `model.button.primary === "bg-primary hover:bg-primary-hover active:bg-primary-active text-primary-foreground"`
  - `model.button.success === "bg-success hover:bg-success-hover text-success-foreground"`

- [ ] **14c light 파생 + outline 파생(§13.6 바이트 동일)**: light = `bg-C-light text-C-light-foreground hover:bg-C hover:text-C-foreground`(light 슬롯 있는 색만: fortress seed 순서 primary/success/warning/danger). outline(primary/danger만) = `border-2 border-C text-C hover:bg-C hover:text-C-foreground`(C=primary의 `text-primary`는 계층 토큰, §7.2). 테스트:
  - `model.button["primary-outline"] === "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"`
  - `model.button["danger-outline"] === "border-2 border-danger text-danger hover:bg-danger hover:text-danger-foreground"`
  - `model.button["secondary-light"] === undefined`

- [ ] **14d variantOverrides append + overrideKeys 마킹**: `config.variantOverrides.button` 키를 파생 뒤에 append(verbatim), 각 키를 `model.overrideKeys`(Set)에 기록. 테스트: `model.button["primary-ghost"] === "text-primary hover:bg-primary-light hover:text-primary-light-foreground"`, `overrideKeys.has("primary-ghost")`, 파생 키(`primary-outline`)는 미포함, 삽입 순서상 파생이 override보다 앞.

- [ ] **14e badge/alert/text/card**: badge filled `bg-C text-C-foreground` + light `bg-C-light text-C-light-foreground`(primary/success/warning/danger/info/accent, light 있는 색만 → **secondary-light 없음**, info-light/accent-light 있음). alert `bg-C-light text-C-light-foreground border border-C/20`(info/success/warning/danger). text = 계층 토큰(primary/secondary/tertiary/muted=`text-text-*`) + 색 `text-C`(success/warning/danger/info/accent) + `link` override. card 정적 4종. override 병합. 테스트에 §7.3 리터럴(예: `model.badge["info-light"] === "bg-info-light text-info-light-foreground"`, `model.text.primary === "text-text-primary"`, `model.card.default === "bg-card text-card-foreground border border-border"`).

- [ ] **14f inputVariants(전부 override) + *Sizes + rounded + commonStyles(R-SYMBOL)**. sizes/rounded/shadow 리터럴은 §7.3 FILE2 인라인(byte-match fortress):
  - `buttonSizes = {xs:"px-2 py-1 text-xs", sm:"px-3 py-1.5 text-sm", md:"px-4 py-2 text-sm", lg:"px-5 py-2.5 text-base", xl:"px-6 py-3 text-lg"}`
  - `badgeSizes = {xs:"px-1.5 py-0.5 text-[10px]", sm:"px-2 py-0.5 text-xs", md:"px-2.5 py-1 text-xs", lg:"px-3 py-1 text-sm"}`
  - `inputSizes = {sm:"px-3 py-1.5 text-sm", md:"px-4 py-2 text-sm", lg:"px-4 py-3 text-base"}`
  - `rounded = {none:"rounded-none", sm:"rounded-sm", md:"rounded-md", lg:"rounded-lg", xl:"rounded-xl", full:"rounded-full"}`
  - `commonStyles = {focusRing:"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", transition:"transition-colors duration-200", transitionAll:"transition-all duration-200", rounded, shadow:{none:"shadow-none",sm:"shadow-sm",md:"shadow-md",lg:"shadow-lg",xl:"shadow-xl","2xl":"shadow-2xl",inner:"shadow-inner"}}`
  input은 전부 `applyOverrides(model, config, "input", model.input)`.
  주: 이 리터럴들은 fortress `src/lib/utils/design-tokens.ts`와 바이트 동일해야 한다 — 스펙 §7.3 FILE2가 원천이며, seed 빌드 후 골든/스모크가 이를 잠근다.

- [ ] **14g variants.ts 텍스트 방출**: 헤더(sourceHash, 타임스탬프 없음) + `SEMANTIC_COLORS … as const` + `ColorVariant`/`SizeVariant` + 각 계열 맵(`as const`, override 그룹 주석 `/* ── config.variantOverrides.<fam> (human-authored) ── */`) + `ButtonVariant` + sizes/rounded/commonStyles + get*Classes(helpers 옵셔널-가드). 테스트: 헤더/`SEMANTIC_COLORS`/`buttonVariants.primary`/override 주석/`getButtonClasses`/`getInputClasses` 존재.

- [ ] **14h renderDts(variants.d.ts 리터럴 미러)** — `src/render-dts.mjs`. `readonly key: "literal"` 미러, get*Classes 시그니처. `renderVariants`가 `dts: renderDts(model, config, sourceHash)` 위임. 테스트: `renderVariants().dts === renderDts(model, config, sourceHash)`, buttonVariants 리터럴 타입, commonStyles 리터럴, `SizeVariant`.

- [ ] **14i §13.11 ColorVariant 7-subset + 결정성**: `model.semanticColors`가 구 8(muted 포함) 유니온의 문서화된 subset(muted만 제거)임을 어서트; 동일 입력 2회 호출 `ts`/`dts` 바이트 동일. (구현 변경 없이 통과 — 계약 잠금.)

  각 서브-사이클 후 커밋(한국어 메시지 + 트레일러). 그룹 마지막에 `cd … && node --test test/render-variants.test.mjs 2>&1 | tail -3` 그린 확인.

---

## GROUP H — cli-atomic (atomicWrite/diffOutputs + buildCli + 골든 통합)

### Task 15: test+feat — atomicWrite + diffOutputs [RED→GREEN]

**Files:** `src/atomic-write.mjs`, `test/atomic-write.test.mjs`

`atomicWrite(outputs, config, projectDir)`: 4개 문자열을 sibling temp에 쓰고 fsync, dist/ 디렉터리 단일 rename 스왑(R-SWAP 폴백: per-file temp+rename). `diffOutputs(outputs, config, projectDir) -> string[]`: 온디스크 vs 인메모리 바이트 비교(누락=diff), 안 씀.

- [ ] 실패 테스트(초안의 3 atomicWrite + 3 diffOutputs 케이스 그대로). 실행 → 실패(모듈 부재).
- [ ] `src/atomic-write.mjs` 구현(초안의 sync-fs 디렉터리-rename 스왑 + R-SWAP 폴백 + `diffOutputs`). 실행 → `pass 6`.
- [ ] 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add src/atomic-write.mjs test/atomic-write.test.mjs && git commit -m "$(cat <<'EOF'
  feat: atomicWrite(디렉터리 rename 스왑 + fsync + R-SWAP 폴백) + diffOutputs(--check 비교)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 16: test+feat — buildCli argv 파싱 [RED→GREEN]

**Files:** `bin/ds.mjs`, `test/cli-args.test.mjs`

> 리뷰 반영(minor): 스크립트-엔트리 가드는 `pathToFileURL(process.argv[1]).href`로 비교(심링크/공백/유니코드 안전).

- [ ] 실패 테스트(초안의 3 케이스: no-subcommand / unknown-subcommand / unknown-flag → non-zero + usage). **RED 기대: non-zero exit + usage 문자열**(정확한 카운트 무관).
- [ ] `bin/ds.mjs`(`parseArgs` + `buildCli` export, `runBuild` 스텁, 엔트리 가드 `pathToFileURL`). 초안대로이되 엔트리 라인:
  ```js
  import { pathToFileURL } from "node:url";
  if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(buildCli(process.argv.slice(2)));
  ```
- [ ] `chmod +x bin/ds.mjs`. 실행 → `pass 3`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && chmod +x bin/ds.mjs && git add bin/ds.mjs test/cli-args.test.mjs && git commit -m "$(cat <<'EOF'
  feat: buildCli argv 파싱 — build/build --check + usage/에러 exit code, pathToFileURL 엔트리 가드

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 17: feat — buildCli 파이프라인 배선(load→expandScales→validate→resolve→render→write/diff, baseColorEmit/omit 억제)

**Files:** `bin/ds.mjs`(편집)

> 리뷰 반영(blocker): **baseColorEmit=false / slotOverrides.omit 억제는 bin/ds.mjs가 소유**한다 — resolveRefs 결과(ResolvedLeafMap)에서 억제 키를 삭제하는 명시적 pass를 render 전에 둔다. 슬래시→대시 매핑으로 `surface/overlay`→`surface-overlay` 삭제, omit 슬롯은 `<color>` 또는 `<color>-<slot>` 삭제. 이로써 CONTRACT의 "Omitted slots & baseColorEmit=false keys ABSENT" 불변식이 실제로 성립. 또한 파이프라인 순서에 **expandScales pre-pass**(§6.8.2)를 load 직후·validate 이전에 삽입.

- [ ] `bin/ds.mjs` 상단 import 추가:
  ```js
  import { loadInputs } from "../src/load.mjs";
  import { expandScales } from "../src/scale-gen.mjs";
  import { validate } from "../src/validate.mjs";
  import { resolveRefs } from "../src/resolve-refs.mjs";
  import { renderCss } from "../src/render-css.mjs";
  import { renderVariants } from "../src/render-variants.mjs";
  import { renderManifest } from "../src/render-manifest.mjs";
  import { atomicWrite, diffOutputs } from "../src/atomic-write.mjs";
  ```

- [ ] `runBuild` 스텁을 실제 파이프라인으로 교체:
  ```js
  function suppress(resolved, config) {
    const out = { ...resolved };
    for (const [k, emit] of Object.entries(config.baseColorEmit || {})) if (emit === false) delete out[k.replace(/\//g, "-")];
    const so = config.slotOverrides || {}; const semantic = new Set(config.colors);
    for (const [color, spec] of Object.entries(so)) { if (!semantic.has(color)) continue; for (const slot of spec.omit || []) delete out[slot === "base" ? color : `${color}-${slot}`]; }
    return out;
  }
  function renderAll(projectDir) {
    const loaded = loadInputs(projectDir);
    const tokens = expandScales(loaded.tokens, loaded.config);           // §6.8 pre-pass
    const { config, schemas, sourceHash } = loaded;
    validate(tokens, config, schemas);                                   // LOAD+VALIDATE FIRST
    const light = suppress(resolveRefs(tokens, "light"), config);
    const dark = suppress(resolveRefs(tokens, "dark"), config);
    const css = renderCss(light, dark, config, sourceHash);
    const { ts, dts, model } = renderVariants(tokens, config, sourceHash);
    const manifest = JSON.stringify(renderManifest(light, dark, model, config, sourceHash), null, 2) + "\n";
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
    process.stdout.write("ds: wrote dist (theme.css, variants.ts, variants.d.ts, tokens.manifest.json)\n"); return 0;
  }
  ```

- [ ] args 테스트 회귀 `cd … && node --test test/cli-args.test.mjs` → 그린. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add bin/ds.mjs && git commit -m "$(cat <<'EOF'
  feat: buildCli 파이프라인 — load→expandScales→validate→resolve→suppress(omit/baseColorEmit)→render→write/diff

  baseColorEmit=false·slotOverrides.omit 억제를 ResolvedLeafMap에서 명시 삭제(CONTRACT 불변식).
  $generate pre-pass를 validate 이전에 배선(§6.8.2).

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 18: test — 최소 골든 픽스처(tokens.min/config.min)

**Files:** `test/fixtures/tokens.min.json`, `test/fixtures/config.min.json`

세 색 형태(primary 스케일백드 / danger 스케일없는 6슬롯 / secondary active유지·light생략) + 2홉 ring + surface/overlay omit. hex §6.6, autoMirrorDark=true. `$schema` 필드는 장식(로더가 사용 안 함) — 표기하지 않거나 상대경로로만.

> 리뷰 반영: 이 픽스처는 cli-golden이 소유(sequencing note 6). seed-golden-smoke 그룹은 재작성하지 않는다. 로더는 스키마를 **패키지 루트에서만** 읽으므로 temp projectDir에 스키마 복사는 불필요(Task 19에서 복사 라인 제거).

- [ ] `test/fixtures/tokens.min.json`:
  ```json
  {
    "meta": { "autoMirrorDark": true },
    "scales": { "primary": { "100": { "light": "#dbeafe" }, "600": { "light": "#2563eb" }, "700": { "light": "#1d4ed8" }, "800": { "light": "#1e40af" } } },
    "semantic": {
      "primary": { "base": { "light": "{scales.primary.600}" }, "hover": { "light": "{scales.primary.700}" }, "active": { "light": "{scales.primary.800}" }, "foreground": { "light": "#ffffff" }, "light": { "light": "{scales.primary.100}" }, "light-foreground": { "light": "{scales.primary.800}" } },
      "secondary": { "base": { "light": "#f3f4f6" }, "hover": { "light": "#e5e7eb" }, "active": { "light": "#d1d5db" }, "foreground": { "light": "#1f2937" } },
      "danger": { "base": { "light": "#ef4444" }, "hover": { "light": "#dc2626" }, "active": { "light": "#b91c1c" }, "foreground": { "light": "#ffffff" }, "light": { "light": "#fee2e2" }, "light-foreground": { "light": "#991b1b" } }
    },
    "base": { "background": { "light": "#ffffff" }, "foreground": { "light": "#111827" }, "surface/overlay": { "light": "rgba(0,0,0,0.5)" }, "ring": { "light": "{semantic.primary.base}" } }
  }
  ```
  `test/fixtures/config.min.json`:
  ```json
  {
    "classPrefix": "", "darkSelector": "[data-gnb-theme=\"dark\"]", "darkVariantName": "dark",
    "colors": ["primary", "secondary", "danger"], "variantFamilies": ["button", "badge", "alert", "text", "card", "input"],
    "output": { "css": "dist/theme.css", "ts": "dist/variants.ts", "dts": "dist/variants.d.ts", "manifest": "dist/tokens.manifest.json" },
    "slotOverrides": { "secondary": { "omit": ["light", "light-foreground"] } },
    "baseColorEmit": { "surface/overlay": false },
    "variantOverrides": { "button": { "primary-ghost": "text-primary hover:bg-primary-light hover:text-primary-light-foreground" }, "input": { "default": "bg-background border border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20" }, "text": { "link": "text-primary hover:text-primary-hover underline" } },
    "helpers": { "button": { "base": "inline-flex items-center justify-center font-medium", "defaultRounded": "lg" }, "badge": { "base": "inline-flex items-center font-semibold rounded-full" }, "input": { "base": "w-full rounded-lg outline-none" } }
  }
  ```

- [ ] 파싱 확인 + 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e "JSON.parse(require('fs').readFileSync('test/fixtures/tokens.min.json','utf8'));JSON.parse(require('fs').readFileSync('test/fixtures/config.min.json','utf8'));console.log('OK')" && git add test/fixtures/tokens.min.json test/fixtures/config.min.json && git commit -m "$(cat <<'EOF'
  test: 최소 골든 픽스처 — tokens.min/config.min(세 색 형태 + 2홉 ring + overlay omit)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

### Task 19: test+feat — cli-golden 통합(build 골든 왕복 + 멱등 + --check + source-hash 안정 + .tmp 무잔존)

**Files:** `test/cli-golden.test.mjs`, `test/golden/theme.css`, `test/golden/variants.ts`, `test/golden/variants.d.ts`, `test/golden/tokens.manifest.json`

> 리뷰 반영(major): seedProject는 tokens.json + design.config.json만 temp에 둔다 — **스키마 복사 라인 제거**(로더는 PKG_ROOT에서 읽음; 복사는 dead file). 주석으로 명시.

- [ ] `test/cli-golden.test.mjs`(초안 그대로이되 seedProject에서 스키마 cp 제거):
  ```js
  // ...
  async function seedProject() {
    const dir = await mkdtemp(join(tmpdir(), "ds-cli-"));
    await cp(join(FIX, "tokens.min.json"), join(dir, "tokens.json"));
    await cp(join(FIX, "config.min.json"), join(dir, "design.config.json"));
    // 스키마는 로더가 PKG_ROOT에서 읽으므로 복사 불필요(의도적으로 생략).
    return dir;
  }
  // ... 5 테스트: 골든 바이트 비교 / 멱등+--check green / --check 편집후 exit1 / source-hash 입력변경시만 변함 / .tmp 무잔존
  ```

- [ ] 골든을 실제 파이프라인으로 생성 후 프리즈(스키마 cp 없이):
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && mkdir -p test/golden && node -e '
  import("./bin/ds.mjs").then(async (m) => {
    const { mkdtemp, cp } = await import("node:fs/promises"); const { tmpdir } = await import("node:os"); const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "ds-gold-"));
    await cp("test/fixtures/tokens.min.json", join(dir, "tokens.json"));
    await cp("test/fixtures/config.min.json", join(dir, "design.config.json"));
    if (m.buildCli(["build"], dir) !== 0) { console.error("BUILD FAILED"); process.exit(1); }
    for (const [d, g] of [["theme.css","theme.css"],["variants.ts","variants.ts"],["variants.d.ts","variants.d.ts"],["tokens.manifest.json","tokens.manifest.json"]]) await cp(join(dir, "dist", d), join("test/golden", g));
    console.log("GOLDENS WRITTEN");
  });
  '
  ```
  기대: `GOLDENS WRITTEN`.

- [ ] 골든 스팟체크(§7.3): `theme.css`에 `@custom-variant dark (&:where([data-gnb-theme="dark"], [data-gnb-theme="dark"] *));`, `--color-primary: #2563eb;`, `--color-ring: #2563eb;`, `--color-secondary-active: #d1d5db;` 포함, `--color-surface-overlay` **부재**. `variants.ts`에 `"primary-outline": "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"`:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -c 'surface-overlay' test/golden/theme.css; grep -F '@custom-variant dark (&:where([data-gnb-theme="dark"]' test/golden/theme.css && grep -F -- '--color-ring: #2563eb;' test/golden/theme.css && grep -F 'primary-outline": "border-2 border-primary text-primary' test/golden/variants.ts && echo "SPOT OK"
  ```
  기대: 첫 grep `0`, 나머지 매치 후 `SPOT OK`.

- [ ] `cd … && node --test test/cli-golden.test.mjs` → `pass 5`. 전체 스위트 `cd … && node --test` → `fail 0`. 커밋:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add test/cli-golden.test.mjs test/golden && git commit -m "$(cat <<'EOF'
  test: cli-golden 통합 — build 골든 왕복 + 멱등 + --check + source-hash 안정 + .tmp 무잔존

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## GROUP I — seed + gates + smokes + dist 커밋 + 태그

> 전제: Task 1–19 완료. 골든 픽스처/골든은 Task 18–19 소유(재작성 금지). 이 그룹은 시드, 완전성/opacity/색추가/cross-package 게이트, 커밋된 `dist/`, v0.1.0 태그를 다룬다.

### Task 20: feat — seed tokens.json (§6.6, autoMirrorDark=true, primary 명시 스케일 25..900, 7색, base ~21)

**Files:** `tokens.json`

> 리뷰 반영(minor): `secondary`는 §6.6 verbatim으로 **base/hover/active/foreground 4슬롯만**(light/light-foreground 물리적 부재 — config omit로 면제). 스펙에 없는 secondary light hex를 발명하지 않는다. §15 Q9: primary는 Phase 1 명시 스케일 유지(`$generate` 아님), `active`는 config omit로 억제(§15 Q2). autoMirrorDark=true이므로 dark 전부 생략(미러).

- [ ] `tokens.json` 작성 — 초안의 seed와 동일하되 **`secondary`에서 `light`/`light-foreground` 슬롯 제거**:
  ```json
  {
    "$schema": "./tokens.schema.json",
    "meta": { "autoMirrorDark": true },
    "scales": { "primary": { "25": {"light":"#f5f9ff"}, "50": {"light":"#eff6ff"}, "100": {"light":"#dbeafe"}, "200": {"light":"#bfdbfe"}, "300": {"light":"#93c5fd"}, "400": {"light":"#60a5fa"}, "500": {"light":"#3b82f6"}, "600": {"light":"#2563eb"}, "700": {"light":"#1d4ed8"}, "800": {"light":"#1e40af"}, "900": {"light":"#1e3a8a"} } },
    "semantic": {
      "primary": { "base": {"light":"{scales.primary.600}"}, "hover": {"light":"{scales.primary.700}"}, "active": {"light":"{scales.primary.800}"}, "foreground": {"light":"#ffffff"}, "light": {"light":"{scales.primary.100}"}, "light-foreground": {"light":"{scales.primary.800}"} },
      "secondary": { "base": {"light":"#f3f4f6"}, "hover": {"light":"#e5e7eb"}, "active": {"light":"#d1d5db"}, "foreground": {"light":"#1f2937"} },
      "success": { "base": {"light":"#10b981"}, "hover": {"light":"#059669"}, "active": {"light":"#047857"}, "foreground": {"light":"#ffffff"}, "light": {"light":"#d1fae5"}, "light-foreground": {"light":"#065f46"} },
      "warning": { "base": {"light":"#f59e0b"}, "hover": {"light":"#d97706"}, "active": {"light":"#b45309"}, "foreground": {"light":"#ffffff"}, "light": {"light":"#fef3c7"}, "light-foreground": {"light":"#92400e"} },
      "danger": { "base": {"light":"#ef4444"}, "hover": {"light":"#dc2626"}, "active": {"light":"#b91c1c"}, "foreground": {"light":"#ffffff"}, "light": {"light":"#fee2e2"}, "light-foreground": {"light":"#991b1b"} },
      "info": { "base": {"light":"#06b6d4"}, "hover": {"light":"#0891b2"}, "active": {"light":"#0e7490"}, "foreground": {"light":"#ffffff"}, "light": {"light":"#cffafe"}, "light-foreground": {"light":"#155e75"} },
      "accent": { "base": {"light":"#8b5cf6"}, "hover": {"light":"#7c3aed"}, "active": {"light":"#6d28d9"}, "foreground": {"light":"#ffffff"}, "light": {"light":"#ede9fe"}, "light-foreground": {"light":"#5b21b6"} }
    },
    "base": {
      "background": {"light":"#ffffff"}, "foreground": {"light":"#111827"}, "card": {"light":"#ffffff"}, "card/foreground": {"light":"#111827"},
      "text/primary": {"light":"#101828"}, "text/secondary": {"light":"#344054"}, "text/tertiary": {"light":"#6b7280"}, "text/muted": {"light":"#9ca3af"},
      "border": {"light":"#e5e7eb"}, "border/hover": {"light":"#d1d5db"}, "input": {"light":"#e5e7eb"},
      "surface": {"light":"#ffffff"}, "surface/hover": {"light":"#f9fafb"}, "surface/active": {"light":"#f3f4f6"}, "surface/raised": {"light":"#ffffff"}, "surface/overlay": {"light":"rgba(0,0,0,0.5)"},
      "muted": {"light":"#f3f4f6"}, "muted/foreground": {"light":"#6b7280"}, "ring": {"light":"{semantic.primary.base}"}
    }
  }
  ```
  주: `muted`는 base 토큰(§6.4), semantic 아님.

- [ ] 파싱 확인: `cd … && node -e "JSON.parse(require('fs').readFileSync('tokens.json','utf8'));console.log('tokens.json OK')"` → `tokens.json OK`.

### Task 21: feat — seed design.config.json (7색, secondary/muted/status-active omit, overlay emit=false, overrides, helpers)

**Files:** `design.config.json`

§7.1 + §15 Q2 active omit 활성. `muted` omit은 유지(§7.1이 명시; R-B 가드) — Task 7의 validate가 `muted`를 base 토큰으로 허용하므로 dead-error 없음. 완전성 게이트/manifest는 muted omit을 phantom으로 새지 않음(Task 13에서 semantic-only 게이팅).

- [ ] 초안의 `design.config.json` 그대로 작성(`$schema:"@blomics-platform/design-system/config.schema.json"`, colors 7, slotOverrides.secondary/muted/success/warning/danger/info/accent, baseColorEmit.surface/overlay=false, variantOverrides button/input/text, helpers button/badge/input).

- [ ] 파싱 확인: `cd … && node -e "JSON.parse(require('fs').readFileSync('design.config.json','utf8'));console.log('config OK')"` → `config OK`.

### Task 22: feat — ds build로 dist 생성 + 스팟체크(스테이징만, 커밋은 Task 25)

**Files:** `dist/theme.css`, `dist/variants.ts`, `dist/variants.d.ts`, `dist/tokens.manifest.json` (생성)

- [ ] `cd … && node ./bin/ds.mjs build && echo "BUILD exit=$?"` → `BUILD exit=0`.
- [ ] 4개 산출물 존재 + `.tmp-*` 무잔존: `ls dist/; ls -d dist/.tmp-* 2>/dev/null && echo LEAK || echo "no tmp OK"`.
- [ ] 스팟체크:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -F '@custom-variant dark (&:where([data-gnb-theme="dark"], [data-gnb-theme="dark"] *));' dist/theme.css && grep -cE '@import|[0-9]{4}-[0-9]{2}-[0-9]{2}T' dist/theme.css; grep -c 'color-danger-active' dist/theme.css; grep -c 'color-secondary-active' dist/theme.css; grep -c 'color-surface-overlay' dist/theme.css; grep -F '"primary", "secondary", "success", "warning", "danger", "info", "accent",' dist/variants.ts && grep -F '"primary-outline": "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",' dist/variants.ts && echo "SPOT OK"
  ```
  기대: custom-variant 매치, `@import`/타임스탬프 grep `0`, `color-danger-active` `0`(status active omit), `color-secondary-active` `1`(secondary active 유지), `color-surface-overlay` `0`, SEMANTIC_COLORS/primary-outline 매치 후 `SPOT OK`.
- [ ] `git add tokens.json design.config.json dist/ && git status --short` — 스테이징만(커밋은 Task 25). `dist/.gitignore` 미생성 확인.

### Task 23: test — 완전성 게이트(§13.5, **live fortress globals.css 원천**) [RED-first 증거 포함]

**Files:** `test/fixtures/fortress-root-vars.json`(기계 추출), `scripts/extract-fortress-vars.mjs`(신규 추출 스크립트), `test/completeness.test.mjs`

> **리뷰 반영(blocker, R-SURFACE)**: §13.5는 **골든이 아니라 live `globals.css` `:root`**를 원천으로 요구한다. 정적 손저작 픽스처는 게이트 목적을 무력화한다(seed와 픽스처가 같은 인벤토리에서 나오면 양쪽에서 함께 빠진 var를 못 잡음). 해결: (a) fortress `globals.css`의 `:root` `--*` 이름 집합을 **스크립트로 기계 추출**해 픽스처를 만들고, (b) 테스트가 fortress 파일이 존재하면 **재추출해 픽스처와 drift 검사**하고, 존재하지 않으면(CI 격리) 커밋된 픽스처로 폴백하되 downgrade를 명시한다. fortress 경로는 env `FORTRESS_GLOBALS_CSS`(기본 `/Users/jang-gyeongtae/BPMG/blomics/fortress/src/app/globals.css`).

- [ ] `scripts/extract-fortress-vars.mjs` 작성 — live globals.css의 `:root` 블록에서 `--*` 이름을 추출, 문서화된 리네임(`text/primary`→`--color-text-primary`; 실제 fortress는 `--text-primary` 형태이므로 `--<name>`→`--color-<name>`, 슬래시는 fortress에 없음) 적용, `surface-overlay` 제외, 정렬해 `{colorVars:[...], excludedByDesign:["--color-surface-overlay"], _source, _note}`로 픽스처 출력:
  ```js
  import { readFileSync, writeFileSync } from "node:fs";
  const src = process.env.FORTRESS_GLOBALS_CSS || "/Users/jang-gyeongtae/BPMG/blomics/fortress/src/app/globals.css";
  const css = readFileSync(src, "utf8");
  const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
  const names = [...root.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]);
  // fortress :root uses raw --name (not --color-*). Rename to --color-<name>, drop var(...) refs, exclude overlay.
  const colorVars = [...new Set(names.map((n) => "--color-" + n.slice(2)))].filter((v) => v !== "--color-surface-overlay").sort();
  writeFileSync("test/fixtures/fortress-root-vars.json", JSON.stringify({ _source: "fortress globals.css :root, mechanically extracted (spec §13.5).", _note: "Generated @theme must be a SUPERSET. surface-overlay excluded (baseColorEmit=false). Rename --<name>→--color-<name>.", excludedByDesign: ["--color-surface-overlay"], colorVars }, null, 2) + "\n");
  console.log("extracted", colorVars.length, "vars");
  ```
  실행: `cd … && node scripts/extract-fortress-vars.mjs` → `extracted N vars`(실측 fortress `:root`는 65개 `--*`; overlay 제외 후 64). 파싱 확인.

- [ ] `test/completeness.test.mjs` 작성 — dist/theme.css의 `@theme` `--color-*` 집합이 픽스처의 superset임을 어서트. 추가로 fortress 파일이 존재하면 재추출해 픽스처와 일치(drift)함을 어서트, 없으면 skip:
  ```js
  import { test } from "node:test"; import assert from "node:assert/strict";
  import { readFileSync, existsSync } from "node:fs"; import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";
  import { execFileSync } from "node:child_process";
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
  function blockVars(css, opener) {
    const s = css.indexOf(opener); assert.ok(s !== -1, `${opener} present`);
    const o = css.indexOf("{", s); let d = 0, e = -1;
    for (let i = o; i < css.length; i++) { if (css[i] === "{") d++; else if (css[i] === "}") { d--; if (d === 0) { e = i; break; } } }
    return new Set([...css.slice(o + 1, e).matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  }
  const css = readFileSync(join(ROOT, "dist/theme.css"), "utf8");
  const fx = JSON.parse(readFileSync(join(ROOT, "test/fixtures/fortress-root-vars.json"), "utf8"));
  test("§13.5: @theme is a superset of the live fortress :root var set", () => {
    const emitted = blockVars(css, "@theme");
    const missing = fx.colorVars.filter((v) => !emitted.has(v));
    assert.deepEqual(missing, [], `@theme missing fortress vars: ${missing.join(", ")}`);
  });
  test("§13.5: surface-overlay intentionally NOT emitted", () => { assert.ok(!blockVars(css, "@theme").has("--color-surface-overlay")); });
  test("§13.5 note(b): dark block re-emits every @theme var", () => {
    const L = blockVars(css, "@theme"), D = blockVars(css, '[data-gnb-theme="dark"] {');
    assert.deepEqual([...L].filter((v) => !D.has(v)), []);
  });
  const FORTRESS = process.env.FORTRESS_GLOBALS_CSS || "/Users/jang-gyeongtae/BPMG/blomics/fortress/src/app/globals.css";
  test("§13.5 R-SURFACE: fixture matches live fortress :root (drift guard)", { skip: existsSync(FORTRESS) ? false : "fortress globals.css unavailable" }, () => {
    execFileSync("node", ["scripts/extract-fortress-vars.mjs"], { cwd: ROOT, stdio: "ignore" });
    const re = JSON.parse(readFileSync(join(ROOT, "test/fixtures/fortress-root-vars.json"), "utf8"));
    assert.deepEqual(re.colorVars, fx.colorVars, "committed fixture must match live extraction");
  });
  ```

- [ ] 그린 확인: `cd … && node --test test/completeness.test.mjs 2>&1 | tail -8` → `fail 0`(fortress 있으면 4 pass, 없으면 3 pass + 1 skip).
- [ ] RED-first 증거(게이트가 실패할 수 있음): dist/theme.css 복사본에서 `--color-ring`을 제거해 추출기 로직으로 missing이 잡히는지 스크래치 확인(커밋 파일 무변경):
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node -e 'const fs=require("fs");const css=fs.readFileSync("dist/theme.css","utf8").replace(/--color-ring\s*:[^;]+;/,"");const s=css.indexOf("@theme"),o=css.indexOf("{",s);let d=0,e=-1;for(let i=o;i<css.length;i++){if(css[i]==="{")d++;else if(css[i]==="}"){d--;if(d===0){e=i;break;}}}const set=new Set([...css.slice(o+1,e).matchAll(/(--color-[a-z0-9-]+)\s*:/g)].map(m=>m[1]));const fx=JSON.parse(fs.readFileSync("test/fixtures/fortress-root-vars.json","utf8"));console.log("missing:",fx.colorVars.filter(v=>!set.has(v)));'
  ```
  기대: `missing: [ '--color-ring' ]`.
- [ ] 커밋은 Task 25(번들).

### Task 24: test — opacity(§13.7) + add-color(§13.6/§11) + cross-package(§13.4) 스모크

**Files:** `test/opacity.test.mjs`, `test/add-color.test.mjs`, `test/smoke-consumer.test.mjs`

> 리뷰 반영: (1) tailwind 가용성 프로브는 npx `--no-install`이 아니라 **`createRequire(...).resolve("@tailwindcss/cli")`** (헤르메틱, 네트워크 없음)로 판단; 설치는 테스트 본문에서만 명시적으로. (2) opacity PROBE의 `shadow-primary-500/25`가 실제로 `color-mix(... var(--color-primary-500) …)`를 내는지 스크래치로 먼저 검증하고, 안 되면 유효한 슬롯-종류로 교체(문서화). (3) add-color 테스트는 `getButtonClasses("teal")` **호출 커버**를 실제로 하거나, 아니면 테스트명을 "emitted variant strings"로 정정. (4) cross-package R-SCAN 어서트는 패키지-dist 전용 유틸 `bg-primary-active`(app.html엔 없음)로 with/without `@source` 차이를 귀속. (5) 스모크는 tailwind 미가용 시 graceful skip.

- [ ] `test/opacity.test.mjs`(초안 기반, 가용성 프로브를 createRequire.resolve로 교체):
  ```js
  import { createRequire } from "node:module";
  function tailwindAvailable() { try { createRequire(import.meta.url).resolve("@tailwindcss/cli"); return true; } catch { return false; } }
  ```
  본문은 초안대로(temp 소비자 + tailwind 설치 + PROBES). PROBES는 스크래치 검증 통과 종류만 유지. skip: `tailwindAvailable() ? false : "tailwindcss CLI not resolvable"`.
  스크래치 검증 스텝: opacity 테스트 작성 전 `shadow-primary-500/25`가 `color-mix(... var(--color-primary-500)`를 내는지 임시 tailwind 컴파일로 확인. 안 되면 PROBE를 `bg-primary-500/25`(유효 확실) 등으로 교체하고 주석에 근거 기록.

- [ ] `test/add-color.test.mjs`(초안 기반, seedTempProject는 tokens/config만 temp에, 스키마 복사 라인 제거). teal 주입 → build → theme.css `--color-teal*`(라이트+다크) + variants.ts SEMANTIC_COLORS/buttonVariants.teal/badgeVariants.teal. **추가**: getButtonClasses 커버 — variants.ts가 `getButtonClasses(` 정의를 담고 `buttonVariants[variant]`/`buttonSizes[size]`를 참조함을 어서트(테스트명과 커버 일치):
  ```js
  test("§13.6/§11: getButtonClasses definition composes buttonVariants[variant] + buttonSizes[size]", () => {
    const dir = seedTempProject(); try {
      assert.equal(buildCli(["build"], dir), 0);
      const ts = readFileSync(join(dir, "dist/variants.ts"), "utf8");
      assert.match(ts, /export function getButtonClasses\(/);
      assert.match(ts, /buttonVariants\[variant\]/); assert.match(ts, /buttonSizes\[size\]/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  ```

- [ ] `test/smoke-consumer.test.mjs`(초안 기반). `cliAvailable()`는 npm 존재 확인이면 유지하되, R-SCAN은 `bg-primary-active`(패키지-dist 전용) with/without `@source` 차이로 어서트. 버전 가드는 resolved tailwind package.json 읽어 `>=4.1.0`. sentinel `.ds-installed`. skip graceful.

- [ ] 각 스모크 실행(넉넉한 타임아웃; 미가용 시 skip 그린):
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && node --test --test-timeout=240000 test/opacity.test.mjs test/add-color.test.mjs test/smoke-consumer.test.mjs 2>&1 | tail -15
  ```
  기대: `fail 0`(일부 `skipped` 허용).
- [ ] 커밋은 Task 25.

### Task 25: chore — README @source/import 순서 확정 + `ds build --check` 그린 + 최종 커밋(seed+dist+tests) + v0.1.0 태그

**Files:** `README.md`(편집 확인), git 커밋 + 태그

> 리뷰 반영(major): 잘린 최종 태스크를 완성한다. **`git tag -a v0.1.0`을 dist 커밋 이후 명시적으로 생성**하고, 태그 트리에 `dist/`가 있음을 검증한다(R-DIST).

- [ ] README 로드-베어링 라인 확인(Task 1에서 이미 작성; 재확인):
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && grep -F '@import "tailwindcss";' README.md && grep -F '@import "@blomics-platform/design-system/theme.css";' README.md && grep -F '@source "../node_modules/@blomics-platform/design-system/dist/**/*.ts";' README.md && echo "README OK"
  ```
  누락 시 Edit로 해당 블록 보정(`.ts` 글롭, tailwindcss 먼저).

- [ ] 전체 스위트: `cd … && node --test --test-timeout=240000 2>&1 | tail -20` → `fail 0`(스모크 skip 허용).

- [ ] `--check` 그린: `cd … && node ./bin/ds.mjs build --check; echo "check exit=$?"` → `check exit=0`.

- [ ] `--check` 스테일 검출 증명(복원): `cp dist/theme.css /tmp/t.bak && printf '\n/* stray */\n' >> dist/theme.css && (node ./bin/ds.mjs build --check; echo "stale exit=$?"); cp /tmp/t.bak dist/theme.css && rm /tmp/t.bak && node ./bin/ds.mjs build --check && echo "restored exit=$?"` → `stale exit=1` 후 `restored exit=0`.

- [ ] 최종 스테이징 + 커밋(seed + dist + 모든 게이트/스모크 테스트 + scripts + README):
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git add tokens.json design.config.json dist/ test/ scripts/ README.md && git status --short
  ```
  `dist/.gitignore` 미스테이징 확인. 그다음:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git commit -m "$(cat <<'EOF'
  feat: 시드 토큰/config 확정 + dist 생성·커밋 + 완전성/opacity/색추가/cross-package 게이트

  - tokens.json 시드(autoMirrorDark=true, primary 25..900 명시 스케일, 7 semantic, base ~21; secondary는 4슬롯)
  - design.config.json 기본본(7색, secondary/muted/status active omit, surface-overlay emit=false)
  - ds build로 dist/{theme.css,variants.ts,variants.d.ts,tokens.manifest.json} 생성·커밋(R-DIST)
  - §13.5 완전성 게이트(live fortress :root superset, 기계추출+drift 가드), §13.7 opacity color-mix,
    §13.6 teal 색추가 스모크, §13.4 cross-package @source 유/무 + <4.1.0 버전 가드
  - ds build --check 그린(스테일 dist CI 게이트)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )"
  ```

- [ ] **v0.1.0 태그 생성**(dist 커밋 이후) + 태그 트리에 dist 포함 검증:
  ```bash
  cd /Users/jang-gyeongtae/BPMG/blomics/design-system && git tag -a v0.1.0 -m "$(cat <<'EOF'
  release: v0.1.0 — @blomics-platform/design-system Phase 1 (커밋된 dist 포함)

  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  EOF
  )" && git ls-tree -r --name-only v0.1.0 -- dist/ && echo "TAG OK"
  ```
  기대: `dist/theme.css`, `dist/variants.ts`, `dist/variants.d.ts`, `dist/tokens.manifest.json` 나열 후 `TAG OK`. (Task 1의 "v0.1.0은 여기서 만들지 않는다" 노트가 가리키는 지점이 바로 이 스텝이다.)

- [ ] 최종 확인: `cd … && git log --oneline | head && git tag` → 태그 `v0.1.0` 표시.

---

## 시퀀싱 요약(엄격 의존 순서)

1. **A scaffold**(T1) — 매니페스트/bin 경로/테스트 배선이 먼저.
2. **B schema+load**(T2→T3) — 스키마는 `$generate`/`scaleOutput`/`cssLayering` 포함.
3. **C scale-gen**(T4→T5) — load 이후, validate **이전**의 pre-pass(§6.8.2). 변환→expandScales.
4. **D validate**(T6→T7→T8) — expandScales 산출 tokens를 소비. baseColorEmit-인지 중복체크.
5. **E resolve-refs**(T9→T10) — render 이전. autoMirror **매 홉** 적용(light-only 시드 안전).
6. **F render-css/manifest**(T11→T12→T13) — base 순서는 맵 삽입 순서 파생(하드코딩 금지). manifest omittedVars 대시·semantic-only.
7. **G render-variants-dts**(T14) — 슬롯 이름+config 파생(리터럴 불필요). helpers 옵셔널-가드.
8. **H cli-atomic**(T15→T16→T17→T18→T19) — atomicWrite/diff → argv → 파이프라인(억제 pass + expandScales 배선) → 골든 픽스처 → 골든 통합. 골든은 전체 파이프라인이 필요하므로 여기서 저작.
9. **I seed-golden-smoke**(T20→…→T25) — 시드 → dist 빌드 → live-소스 완전성 게이트/opacity/색추가/cross-package → README/`--check`/최종 커밋/**v0.1.0 태그(dist 포함 검증)**.

**핵심 게이트**: validate가 모든 render 전(all-or-nothing, §7.4); resolveRefs가 render-css/manifest 전; 결정적 순서가 T11–T14에서 잠겨 T19 골든이 바이트 안정; live fortress `:root` 대비 superset(T23, R-SURFACE); cross-package 스모크(T24)가 R-SCAN/R-VER 증명이며 v0.1.0에 실리는 **동일 커밋된 dist**를 검증.