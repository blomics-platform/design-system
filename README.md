# @blomics-platform/design-system

[![npm version](https://img.shields.io/npm/v/@blomics-platform/design-system.svg)](https://www.npmjs.com/package/@blomics-platform/design-system)
[![license](https://img.shields.io/npm/l/@blomics-platform/design-system.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/@blomics-platform/design-system.svg)](https://nodejs.org)

Untitled UI 컬러 토큰 **제너레이터** for Tailwind v4.
설치 → `ds init`로 두 입력 파일(`tokens.json` + `design.config.json`)을 프로젝트에 스캐폴드 → **brand 램프(25~900)만 채우고** → `ds build` → 당신의 프로젝트 안에 `theme.css`(프리미티브 `@theme` + 역할/유틸/alpha `:root` + `@utility`)와 타입드 `tokens.ts`(+ `.d.ts`, `.manifest.json`)가 생성된다.

**제너레이터 모델:** 이 패키지는 빌드된 CSS를 배포하지 않는다 — **당신이 당신의 브랜드로 생성한다.** 생성물은 당신 레포에 커밋된다. 패키지가 ship 하는 것은 CLI(`ds`), 제너레이터 소스(`src/`), 스키마, 그리고 시드 입력(`tokens.json`/`design.config.json`)뿐이다.

설계 근거는 `docs/specs/2026-07-08-untitled-ui-token-reshape-design.md` 참고.

---

## Quick start

```bash
npm install --save-dev @blomics-platform/design-system   # Tailwind v4 (≥ 4.1.0) 프로젝트에서
npx ds init                                              # tokens.json + design.config.json 스캐폴드
# → tokens.json 의 scales.brand 를 당신 팔레트로 교체 (아래 "brand 램프" 참고)
npx ds build                                             # dist/theme.css, dist/tokens.ts, ... 생성
```

`ds init`은 이미 존재하는 입력 파일을 덮어쓰지 않는다(멈추고 알림). 강제로 다시 스캐폴드하려면 `npx ds init --force`.

## 두 개의 입력 파일

`ds init`이 프로젝트 루트에 복사한다. 이 둘만 손대면 된다 — 생성물(`dist/`)은 손대지 말 것(`AUTO-GENERATED` 헤더가 붙는다).

- **`tokens.json`** — 색 원천. 29개 프리미티브 램프(`scales`, gray만 light/dark 분리·나머지 동일·**brand는 당신이 채운다**) + 역할/유틸/alpha 참조. 앵커는 `{base.white}`/`{base.black}`.
- **`design.config.json`** — 방출 설정. `output`(생성물 경로), `darkSelector`(기본 `[data-gnb-theme="dark"]`), `classPrefix`, `baseColorEmit`(특정 프리미티브 억제) 등.

**생성물 경로를 바꾸려면** `design.config.json`의 `output`을 편집한다. 기본값:
```jsonc
"output": {
  "css": "dist/theme.css", "ts": "dist/tokens.ts",
  "dts": "dist/tokens.d.ts", "manifest": "dist/tokens.manifest.json"
}
// 예: "css": "src/styles/theme.css", "ts": "src/generated/tokens.ts"
```

## brand 램프 (필수 — brand는 당신이 채운다)

`tokens.json`의 `scales.brand`는 시드 상태로 Untitled UI violet placeholder가 들어 있다. 실제 브랜드를 적용하려면:

1. 브랜드 팔레트에서 **50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950 — 11스텝 전부**를 hex로 확보한다. 25가 있으면 함께 채운다(선택).
   - **11스텝(50..950)은 필수.** 일부만 채우면 `ds build`의 brand-step 프리플라이트가 누락 스텝을 찾아 throw하고 빌드가 실패한다.
   - light==dark로 채운다(brand는 프리미티브 레벨에서 모드 불변 — 다크 차이는 역할/유틸 토큰이 다른 스텝을 참조해 생긴다).
2. `tokens.json`의 `scales.brand.<step>`을 새 hex로 교체한다.
3. `npx ds build`.

## Wire it up: `globals.css`

**생성된 로컬 파일**을 import 한다(패키지가 아니라 당신 프로젝트의 `dist/`):

```css
@import "tailwindcss";                 /* 당신 소유, 반드시 아래 import보다 위 */
@import "./dist/theme.css";            /* ds build 생성물: @custom-variant + @theme + :root + @utility */
@source "./dist/tokens.ts";            /* 토큰명 상수를 참조하고 생성물이 기본 content 루트 밖이면 필요 */
```
- 경로는 당신의 `design.config.json` `output`에 맞춘다.
- 생성된 `theme.css`는 **Tailwind 소스 파셜**이다 — `@theme`/`@utility` 지시자는 Tailwind 컴파일러가 처리해야 유효하다. `@import "tailwindcss"`나 `@source`는 담지 않는다(당신 소유).
- `@source` 라인은 당신이 JSX 등에 클래스명을 리터럴로 쓰면(예: `class="bg-brand-solid"`) 불필요하다(Tailwind가 기본 content를 스캔). 생성된 `tokens.ts`의 상수(`BG_TOKENS.brandSolid`)를 경유해 참조하고 그 파일이 스캔 루트 밖이면 추가한다.

## 토큰을 쓴다 (markup)

```html
<button class="bg-brand-solid text-primary_on-brand border border-brand-solid_alt hover:bg-brand-solid_hover">저장</button>
<p class="text-secondary">본문</p>
<svg class="fg-brand-primary">…</svg>                         <!-- currentColor 아이콘 -->
<span class="bg-utility-gray-100 text-utility-gray-700">badge</span>
<div class="bg-alpha-black-50">scrim</div>
<div class="bg-brand-500/50">프리미티브 opacity 모디파이어는 정상 동작</div>
```
- **Layer A (프리미티브)**: `bg-brand-600`/`text-gray-900`/`border-gray-200`/`fill-*`/`ring-*`까지 Tailwind가 `@theme` 등록으로 자동 생성. opacity 모디파이어(`bg-brand-500/50`) 지원.
- **Layer B (역할/유틸/alpha)**: `text-primary`/`bg-brand-solid`/`border-secondary`/`fg-primary`/`bg-utility-*`/`bg-alpha-*` 등은 정적 `@utility`. 다크는 `[data-gnb-theme="dark"]`가 조상에 있으면 참조 CSS var가 재선언되어 자동 flip.

## 토큰을 쓴다 (TypeScript)

**생성된 로컬 `tokens.ts`**에서 import 한다(패키지가 아니라 당신 프로젝트의 생성물):

```ts
import { TEXT_TOKENS, BG_TOKENS, BORDER_TOKENS, FG_TOKENS, UTILITY_TOKENS, ALPHA_TOKENS } from "@/generated/tokens";
import type { TextToken, BgToken } from "@/generated/tokens";
```
상수는 **완전한 유틸 클래스명 문자열**(예: `"text-primary"`)을 담는다. 클래스 조합 헬퍼는 없다 — 컴포넌트에서 그냥 클래스로 직접 쓴다.

## §7.6 — 알려진 한계 (반드시 읽을 것)

- **`utility-*`/`alpha-*`는 `bg-`/`text-`만 발행한다.** 프리미티브는 `@theme` 덕에 `border-`/`ring-`/`fill-`/`stroke-`/`divide-`/`from-`/`to-` 전 계열을 얻지만, 역할/유틸/alpha 레이어는 2종(`bg-`, `text-`)뿐이다. `border-utility-gray-200` 같은 유틸은 **없다** — border가 필요하면 프리미티브(`border-gray-200`)로 내려가라.
- **`border-*` 역할 유틸은 `border-color`만 세팅한다(폭 미포함).** `border-error` 단독으로는 아무 테두리도 안 그려진다 — 폭 유틸과 함께 써야 한다(`border border-error`).
- **정적 `@utility`(역할/유틸/alpha)에 opacity 모디파이어(`/NN`)를 붙이면 규칙이 아예 안 나온다.** `bg-brand-solid/50`은 반투명 brand가 아니라 **아무 배경도 안 나온다**. 반투명이 필요하면 `alpha-*` 토큰(`bg-alpha-black-50`) 또는 프리미티브 opacity 모디파이어(`bg-brand-500/50`)를 써라.
- **`text-white` 역할 토큰은 `@utility`를 발행하지 않는다.** 프리미티브 `white`의 자동 유틸(`text-white`)과 이름이 충돌하기 때문(CSS var `--color-text-white` 자체는 방출). 화이트 텍스트는 프리미티브 `text-white`를 그대로 쓰면 동일한 결과.

## CLI

```bash
ds init             # tokens.json + design.config.json 를 CWD에 스캐폴드 (기존 파일 있으면 멈춤)
ds init --force     # 기존 입력 파일을 덮어쓰고 다시 스캐폴드
ds build            # tokens.json + design.config.json → 생성물 재생성 (원자 스왑)
ds build --check    # 인메모리 재생성 후 생성물이 stale이면 non-zero (CI 게이트)
```
`ds build --check`를 CI에 걸어 두면 입력만 바뀌고 생성물을 재커밋하지 않은 드리프트를 잡는다.

## 프로그램 API (고급)

빌드를 직접 스크립트로 돌리고 싶으면 제너레이터 파이프라인을 import 한다:

```js
import { loadInputs, expandScales, validate, resolveRefs, renderCss, renderTokens, renderManifest } from "@blomics-platform/design-system";
```
CLI(`ds build`)가 이들을 순서대로 호출하는 얇은 래퍼다. 대부분의 소비자는 CLI만 쓰면 된다.

## 생성물을 커밋한다

`ds build` 산출물(`dist/…`, 또는 당신이 설정한 `output` 경로)은 **당신 레포에 커밋**한다. brand를 바꾸거나 토큰을 수정하면 `ds build` 후 재커밋. `ds build --check`가 이 규율을 CI에서 강제한다.

## Tailwind 스모크 게이트 (패키지 개발자용)

이 리포에는 Tailwind CLI가 항상 설치돼 있지는 않으므로 `test/smoke-consumer.test.mjs`는 `@tailwindcss/cli`가 resolve되지 않으면 관련 테스트를 skip한다(설치 시 실제 컴파일 출력을 검증: 다크 `bg-gray-900` 실칠, `bg-brand-500/50`→`color-mix`, `_` 포함 `@utility`, 정적 유틸 opacity 드롭, 역할 property 매핑). 두 전제(프리미티브 다크 오버라이드, `_` 포함 `@utility` 이름)와 실패 시 폴백은 스펙 §7.1(b)/§8.3 참고.
