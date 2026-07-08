# @blomics-platform/design-system v0.2.0 — Untitled UI 컬러 토큰 모델 전면 재편 설계 명세

> **날짜** 2026-07-08 · **상태** Final · **범위** v0.2.0 (Untitled UI reshape) · **대상 패키지** `@blomics-platform/design-system` (`/Users/jang-gyeongtae/BPMG/blomics/design-system`, 현재 v0.1.0) · **작성** Principal Engineer
>
> 본 명세의 모든 hex/ref 예시는 `docs/tokens_extracted.json`(3개 Untitled UI PDF에서 파싱된 정본)에서 직접 인용했으며, 제너레이터 변경 서술은 현행 v0.1.0 소스(`src/*.mjs`, `bin/ds.mjs`)의 **실제 코드를 실행·검증**하여 근거를 확정했다. 특히 참조 해석·다크 동작·이름 충돌은 코드를 직접 돌려 확인한 결과를 §정정 노트로 명시한다.

---

## 0. 검증으로 확정된 핵심 정정 (구 Draft 대비 blocker/major)

이 절은 v0.1.0 소스와 정본 데이터를 **실제 실행**해 밝혀낸, 반드시 반영해야 하는 사실이다. 이후 절은 전부 이 사실에 맞춰 서술한다.

- **[BLOCKER] 앵커 참조 형태는 `{base.white}` / `{base.black}`이다 (`{white}`/`{black}` 아님).** `resolve-refs.mjs`의 `leafAtPath`/`resolveOne`은 ref 경로를 tokens **루트**에서 `.`으로 분해해 걷는다. 앵커 leaf는 `tokens.base.white`에 있으므로 `{white}`는 `tokens.white`를 찾다가 **`unresolvable reference {white}` throw**한다(실측). `{base.white}`는 `#FFFFFF`로 정상 해결(실측). → 파서/예시/유틸·alpha 규칙 전부 `{base.<name>}`로 통일. (§5.2, §5.3, §5.5, §6.2, §13)
- **[BLOCKER] `semantic` 섹션이 없으면 빌드가 즉시 죽는다.** `enumerateLeaves`(resolve-refs L6)는 `Object.entries(tokens.semantic)`를 **무조건** 실행하고, `validate.mjs`(L28–29)는 `tokens.semantic` 존재 + `minProperties>=1`을 **강제**한다. `semantic` 부재 시 `Cannot convert undefined or null to object` throw(실측). → `resolve-refs.mjs`와 `validate.mjs`는 **KEEP이 아니라 CHANGE**다. "구조에 부어넣기만 하면 된다"는 서술은 폐기. (§2.2, §3, §8)
- **[BLOCKER] `text-white`는 유일한 실제 클래스 충돌이다.** 정본 84+134+20 이름을 전 프리미티브 stem과 교차 검증한 결과, **오직 `text-white` 1건만 충돌**한다: 역할 토큰 `text-white` → `@utility text-white`, 동시에 `@theme`의 `--color-white`가 Tailwind에 `text-white`를 자동 생성. → **`text-white` 역할 토큰은 `@utility`로 발행하지 않는다.** disjoint 단언은 "역할 유틸 − {text-white}"로 재진술. (§5.2, §7.2, §7.3, §8.2)
- **[BLOCKER] Tailwind v4 특정 동작(프리미티브 다크 오버라이드·`_` @utility·opacity 드롭)은 이 리포에서 실증 불가다.** tailwind가 미설치라 컴파일 검증이 불가하므로, 이들은 "검증됨"이 아니라 **"스모크 테스트가 컴파일 출력으로 게이트해야 하는 가정"**으로 격하한다. §7은 @theme 방출 모드를 명시하고 폴백을 규정한다(§7.1, §7.3, §8.3, §11.6).
- **[MAJOR] `29`는 서로 다른 두 집합이다.** 추출 `primitives` 29 = `{gray, gray-dark, 27색}` (**brand 없음**). 방출 `scales` 29 = `{gray(light=gray/dark=gray-dark), 27색, brand}` (**gray-dark 흡수**). 수치만 같을 뿐 집합이 다르다 — 완전성 게이트는 **이름으로** 방출 집합을 검사한다. (§3, §4.2, §11.2)
- **[MAJOR] `_alt` 유틸은 1개가 아니라 10개다.** `utility-brand_alt`(무-스텝) + `utility-brand-<step>_alt` 9개(50/100/200/400/500/600/700/800/900). 이름이 `-<digits>`로 끝나지 않으므로 **이름 기반 스텝 분리를 하면 안 된다**(§6.1).
- **[MAJOR] brand hex는 모드 동일이지만 dark 출력은 light과 다르다.** 각 brand 스텝은 light==dark지만, 역할/유틸이 **모드별로 다른 brand 스텝**을 고른다(예 `utility-brand-600` dark=`{scales.brand.400}`). → brand 50–950을 다 채워야 dark가 성립(§4.3, §4.2).
- **[MAJOR] 프리미티브 var 카운트는 brand 이중계상이었다.** `29×12=348`에 brand가 **이미 포함**. `+brand 12` 중복 제거 → 프리미티브 스텝 350(=348+white/black 2), 총 `--color-*` ≈ **588**(§9.1, §11.2).
- **[MAJOR] 누락된 기존 테스트 3종.** `render-css.test.mjs`·`render-manifest.test.mjs`(구 모델 하드 단언)와 `opacity.test.mjs`(존재하지 않는 `--color-primary` 등 참조)는 신모델에서 반드시 깨진다 → §11 인벤토리에 CHANGE로 편입.
- **[MAJOR] `config.schema.json`의 `required`에 `colors`/`variantFamilies`가 있다.** 필드만 지우고 `required`를 안 고치면 로드 검증이 실패. `required`도 함께 수정(§12).
- **[MINOR] 값 카운트 정정.** semantic 값=168(84×2), utility 값=268(134×2), 합 **436**(구 "268"은 utility만). 전부 0 unresolved(실측)(§5.5).
- **[MINOR] `alphaVal`의 `Number('100%')===100`은 죽은 가드.** `%` 먼저 제거하고 비교(§13).

---

## 1. 개요 · 목표 · 비목표

### 1.1 한 줄 요약
v0.2.0은 `@blomics-platform/design-system`을 **"6-슬롯 시맨틱 컬러 → Tailwind variant 맵(`buttonVariants`)"** 모델에서 **Untitled UI 정본 컬러 토큰 레이어**로 전면 교체한다. 산출물은 **순수 토큰 레이어**(`theme.css` + 토큰 이름 TS export + manifest)뿐이며, variant 헬퍼는 완전히 제거한다. 소비자는 Tailwind 유틸리티(`text-primary`, `bg-brand-solid`, `border-error`, `fg-primary` 등)를 직접 사용한다.

### 1.2 목표 (Goals)
1. **Untitled UI 전면 채택**: 29개 프리미티브 램프(각 12스텝) + 84개 시맨틱 역할 토큰 + 134개 유틸리티 토큰 + 20개 alpha 토큰 전부 방출.
2. **brand 램프 = 명시 입력**: 유저가 25~950(11~12개) hex를 `tokens.json`에 직접 붙여넣는다. `$generate` 미사용. 시맨틱/유틸리티가 `{scales.brand.<step>}`로 참조.
3. **REAL 다크모드**: `autoMirror`가 아니라 토큰 leaf의 per-mode 참조로 실제 다크값을 산출. gray는 light/dark 팔레트가 별개(distinct), 나머지 28개 램프는 light==dark.
4. **깔끔한 Tailwind 유틸 네이밍**: 프리미티브는 `@theme`로 등록(`bg-brand-600`, `text-gray-900` 자동 생성), 역할/유틸/alpha 토큰은 `@utility`로 별도 방출(`text-primary`, `bg-brand-solid` 등)해 어색한 `bg-text-primary` 유틸을 피한다.
5. **결정론적 빌드 + 완전성 게이트**: 골든 테스트, 완전성(전 토큰 방출) 게이트, 다크 정확성, alpha rgba 정확성, **컴파일 출력을 assert하는** Tailwind 스모크를 통과.

### 1.3 비목표 (Non-Goals)
- **variant 헬퍼 유지 안 함**: `render-variants.mjs`, `getButtonClasses`/`getBadgeClasses`/`getInputClasses`, 6-패밀리 파생을 전부 삭제. (LOCKED)
- **brand `$generate` 사용 안 함**: 이번엔 명시 입력. `scale-gen.mjs`의 OKLCH/`$generate` 경로는 코드로 남기되(미래 옵션) 이 시드에서는 타지 않는다.
- **fortress 이관은 별도 작업**: fortress는 아직 이 패키지를 소비하지 않으므로 v0.2.0의 BREAKING 변경이 실사용에 영향 없다. fortress 연결은 이후 별도 명세.
- **컴포넌트/스타일 발행 안 함**: 이 패키지는 순수 토큰 레이어. spacing/radius/typography 토큰은 이번 범위 밖(컬러만).

---

## 2. 배경

### 2.1 v0.1.0 모델 (현행)
- `tokens.json`의 `semantic`이 **6-슬롯 구조**(`base`/`hover`/`active`/`foreground`/`light`/`light-foreground`)를 강제. `config.colors`(7색)와 `variantFamilies`(button/badge/alert/text/card/input)를 조합해 `render-variants.mjs`가 `buttonVariants` 등 클래스 문자열 맵을 생성.
- 산출물: `theme.css`(6-슬롯 순서로 `--color-*` 방출) + `variants.ts`/`variants.d.ts`(`getButtonClasses` 등) + `tokens.manifest.json`(`variantKeys` 포함).
- `validate.mjs`가 6-슬롯 완전성(`SLOT_ORDER`)·`config.colors ⊆ semantic`·`slotOverrides` typo·**`semantic` 존재/minProperties**를 검사.
- 진입점 `.` 는 현재 `dist/variants.ts`(실측 `package.json.exports`).

### 2.2 Untitled UI 모델 (목표)
- **프리미티브(램프) → 역할 토큰(role/semantic) → 소비**의 2단 참조. 역할 토큰은 6-슬롯 카테시안이 아니라 `text-primary`, `bg-brand-solid`, `border-error`, `fg-primary`처럼 **자유형 이름의 flat 토큰**이며 각자 light/dark 참조를 가진다.
- 이 구조는 v0.1.0 제너레이터의 `scales`(프리미티브) + `base`(flat 토큰) 축에 매핑된다. `resolve-refs.mjs`의 **per-mode·per-hop 참조 해석**이 REAL 다크의 엔진이다(§10).
- **단, 무비용 이식은 아니다(정정).** `enumerateLeaves`와 `validate.mjs`는 `tokens.semantic`을 **무조건 요구**하므로(§0), 이 두 모듈은 실제 코드 편집이 필요하다(CHANGE). "구조에 부어넣기만 하면"이라는 프레이밍은 폐기한다.

### 2.3 출처
3개 Untitled UI PDF를 파싱한 정본이 리포에 있다:
- `docs/tokens_extracted.json` — 구조화된 정본. `{ primitives, base_colors, semantic[], utility[], alpha[] }`.
- `docs/global.txt`(프리미티브 원시), `docs/colorvars.txt`(시맨틱 원시), `docs/colorutil.txt`(유틸 원시).

정본에서 **실측 검증**된 카운트:

| 그룹 | 수 | 세부 |
|---|---|---|
| 추출 primitives 키 | **29** | `{gray, gray-dark, 27색}` — **brand 없음** |
| base_colors | 2 | white `#FFFFFF`, black `#000000` |
| 시맨틱 | 84 | text 21 · bg 31 · border 10 · fg 22 (실측) |
| 유틸리티 | 134 | `utility-<color>-<step>` + `_alt` 계열 10개(§6.1) |
| alpha | 20 | `alpha-white-10..100`(10) · `alpha-black-10..100`(10) |
| **방출 `scales`** | **29** | `{gray(light=gray/dark=gray-dark), 27색, brand}` — **gray-dark 흡수** |

> **주의**: "추출 29"와 "방출 29"는 **다른 집합**이다. gray-dark 흡수(−1)와 brand 추가(+1)가 상쇄되어 수치만 우연히 일치할 뿐이다.

---

## 3. 토큰 아키텍처 (3층)

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PRIMITIVES  (tokens.json .scales)                          │
│  방출 29 램프 × 12스텝  { "<step>": { light, dark } }                 │
│  · gray        = DISTINCT  light=gray, dark=gray-dark  (엔진)          │
│  · 27개 컬러램프 = light == dark  (단일 팔레트 양 모드 공용)           │
│  · brand       = 유저 명시 입력  (hex 모드동일, 아래 주의)            │
│  →→ @theme { --color-<ramp>-<step> }  →  bg-brand-600, text-gray-900  │
│  ※ 추출 primitives(29)의 gray-dark는 gray.dark로 흡수, brand는 추가   │
└─────────────────────────────────────────────────────────────────────┘
                          ▲ {scales.<ramp>.<step>} 참조
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2 — SEMANTIC ROLE TOKENS  (tokens.json .base, 84개)            │
│  text-* 21 · bg-* 31 · border-* 10 · fg-* 22                          │
│  각 { light: "{scales.gray.900}", dark: "{scales.gray.50}" }         │
│  → :root/[dark] { --color-text-primary } + @utility text-primary     │
│  ※ text-white는 @utility 미발행(§0 BLOCKER: Tailwind text-white 충돌) │
├─────────────────────────────────────────────────────────────────────┤
│  LAYER 3 — UTILITY + ALPHA  (tokens.json .base, 134 + 20)            │
│  utility-<color>-<step>  { light:"{scales.blue.500}", dark:... }     │
│  alpha-white/black-NN     rgba() 리터럴 (모드별)                      │
│  → :root/[dark] { --color-utility-* / --color-alpha-* } + @utility   │
└─────────────────────────────────────────────────────────────────────┘
        ▲ 앵커 leaf 3종(base 최상단): base.white(#FFFFFF), base.black(#000000),
          text-white(리터럴 #FFFFFF).  참조는 {base.white}/{base.black} 형태.
```

**핵심 통찰**: Layer 1은 `tokens.json.scales`, Layer 2·3은 전부 `tokens.json.base`(flat). v0.1.0의 `semantic`(6-슬롯) 섹션은 **빈 객체 `semantic: {}`로 남기거나**(엔진/validate가 존재를 강제하므로 — §0/§8), 그 강제를 코드에서 제거한다. 모든 역할·유틸·alpha 토큰은 `base`로 흡수한다. `resolveRefs`가 per-mode로 해석하므로, **엔진 편집(§8) 후** 데이터를 이 구조에 부으면 REAL 다크가 성립한다.

---

## 4. 프리미티브 (`scales`)

### 4.1 스키마
각 램프 = `{ "<step>": { "light": <hex|ref>, "dark": <hex|ref> } }`. 스텝은 `25,50,100,200,300,400,500,600,700,800,900,950`(12스텝). 현행 `tokens.schema.json`의 `explicitRamp`(`propertyNames: ^[0-9]{2,3}$`, `additionalProperties: leaf{light,dark}`)에 그대로 매핑된다. `meta.autoMirrorDark`는 이 시드에서 **끈다**(생략/false) — 모든 leaf가 light+dark를 명시하므로.

### 4.2 3가지 규칙
1. **gray = DISTINCT** (per-step light≠dark). light = `primitives.gray[step]`, dark = `primitives.gray-dark[step]`. 이것이 REAL 다크의 엔진. **실측: gray 12스텝 중 11개가 light≠dark, 950만 공유(`#0C111D`).**
2. **그 외 27개 컬러 램프 = light == dark**. error, warning, success, gray-blue, gray-cool, gray-modern, gray-neutral, gray-iron, gray-true, gray-warm, moss, green-light, green, teal, cyan, blue-light, blue, **blue-dark**, indigo, violet, purple, fuchsia, pink, rose, **orange-dark**, orange, yellow. (주의: `blue-dark`/`orange-dark`는 이름에 `-dark`가 있지만 **독립 색상 램프**이지 gray처럼 다크 트윈이 아니다.)
3. **brand = 유저 명시 램프** (11~12스텝, `$generate` 미사용). 유저가 편집하는 유일한 램프. **각 스텝 hex는 모드 동일**(light==dark로 채움)이지만, **역할/유틸은 모드별로 다른 brand 스텝을 참조**하므로(예 `utility-brand-600` dark=`{scales.brand.400}`, `bg-brand-solid_hover` dark=`{scales.brand.500}`) **brand의 dark 출력은 light과 다르다**. → 50–950을 전부 채워야 dark가 깨지지 않는다(§4.3).

**방출 `scales` 램프 수**: gray(distinct) + 27컬러 + brand = **29** (추출의 gray-dark는 gray.dark로 흡수, 추출에 없던 brand를 추가 — §0).

> **`gray-dark`는 별도 `scales` 엔트리로 노출하지 않는다** — 그 값은 `gray`의 dark 슬롯으로 흡수된다. **실측: 84 시맨틱·134 유틸의 gray 참조가 전부 `gray-*`만 가리키고 `gray-dark-*` 참조는 0회.** 흡수해도 미해결 참조가 발생하지 않는다.

### 4.3 실제 예 — brand 스켈레톤 (유저가 hex를 채움)
```json
"brand": {
  "25":  { "light": "#________", "dark": "#________" },
  "50":  { "light": "#________", "dark": "#________" },
  "100": { "light": "#________", "dark": "#________" },
  "200": { "light": "#________", "dark": "#________" },
  "300": { "light": "#________", "dark": "#________" },
  "400": { "light": "#________", "dark": "#________" },
  "500": { "light": "#________", "dark": "#________" },
  "600": { "light": "#________", "dark": "#________" },
  "700": { "light": "#________", "dark": "#________" },
  "800": { "light": "#________", "dark": "#________" },
  "900": { "light": "#________", "dark": "#________" },
  "950": { "light": "#________", "dark": "#________" }
}
```
- brand은 hex가 모드동일이 관례지만 스키마가 양쪽을 요구하므로 **동일 hex를 양쪽에 쓴다**.
- **필수 스텝(실측)**: 시맨틱/유틸이 참조하는 brand 스텝은 `50,100,200,300,400,500,600,700,800,900,950`(11개). `brand-25`는 참조되지 않으나 `brand-950`은 참조되므로 **950까지 채우는 것을 강제**한다. 25는 선택.
- **dark 주의**: dark 해석은 `brand-400`/`brand-500` 같은 **중간·저스텝을 특정해서** 끌어온다(예 `utility-brand-600.dark→brand-400`, `fg-brand-primary.dark→brand-500`). 어떤 중간 스텝이라도 비면 **다크가 깨진다**. 유저가 참조되는 스텝을 빠뜨리면 `resolveRefs`가 unresolvable로 throw(빌드 실패 → 안전).

### 4.4 실제 예 — error (전형적 light==dark 램프, 실 hex)
```json
"error": {
  "25":  { "light": "#FFFBFA", "dark": "#FFFBFA" },
  "50":  { "light": "#FEF3F2", "dark": "#FEF3F2" },
  "100": { "light": "#FEE4E2", "dark": "#FEE4E2" },
  "200": { "light": "#FECDCA", "dark": "#FECDCA" },
  "300": { "light": "#FDA29B", "dark": "#FDA29B" },
  "400": { "light": "#F97066", "dark": "#F97066" },
  "500": { "light": "#F04438", "dark": "#F04438" },
  "600": { "light": "#D92D20", "dark": "#D92D20" },
  "700": { "light": "#B42318", "dark": "#B42318" },
  "800": { "light": "#912018", "dark": "#912018" },
  "900": { "light": "#7A271A", "dark": "#7A271A" },
  "950": { "light": "#55160C", "dark": "#55160C" }
}
```

### 4.5 실제 예 — gray (DISTINCT: light=gray, dark=gray-dark, 실 hex)
```json
"gray": {
  "25":  { "light": "#FCFCFD", "dark": "#FAFAFA" },
  "50":  { "light": "#F9FAFB", "dark": "#F5F5F6" },
  "100": { "light": "#F2F4F7", "dark": "#F0F1F1" },
  "200": { "light": "#EAECF0", "dark": "#ECECED" },
  "300": { "light": "#D0D5DD", "dark": "#CECFD2" },
  "400": { "light": "#98A2B3", "dark": "#94969C" },
  "500": { "light": "#667085", "dark": "#85888E" },
  "600": { "light": "#475467", "dark": "#61646C" },
  "700": { "light": "#344054", "dark": "#333741" },
  "800": { "light": "#182230", "dark": "#1F242F" },
  "900": { "light": "#101828", "dark": "#161B26" },
  "950": { "light": "#0C111D", "dark": "#0C111D" }
}
```
**실측 검증**: `text-primary`(light=`{scales.gray.900}`, dark=`{scales.gray.50}`) → light `#101828`, dark `#F5F5F6`. `autoMirror` 없이 REAL 다크(§0 TEST3).

> 나머지 램프의 실 hex는 전부 `docs/tokens_extracted.json`에 있으며, 제너레이터가 이 파일을 소비해 시드 `tokens.json`을 만든다(§13, 파서). 본 명세는 대표 예(error/gray/brand)만 인용한다.

---

## 5. 시맨틱 역할 토큰 (`base`, 84개)

### 5.1 구조
전부 `tokens.base`의 flat 엔트리. 각 엔트리 `{ light, dark }`, 값은 `{scales.<ramp>.<step>}` 참조 또는 **앵커 참조(`{base.white}`/`{base.black}`)** 또는 리터럴. 그룹별 카운트(실측): **text 21 · bg 31 · border 10 · fg 22 = 84**.

### 5.2 앵커 leaf 3종 (특수 참조 대상; `base` 최상단)
```json
"white":      { "light": "#FFFFFF", "dark": "#FFFFFF" },
"black":      { "light": "#000000", "dark": "#000000" },
"text-white": { "light": "#FFFFFF", "dark": "#FFFFFF" }
```
- **`white`/`black`**: `base_colors`. 시맨틱이 raw `"white"`/`"black"`(실측: 시맨틱에 white-ref 5건 등)으로 참조하는 것을 파서가 **`{base.white}`/`{base.black}` ref로 정규화**한다. `{white}`가 아니라 `{base.white}`여야 `resolveRefs`가 해결한다(§0 BLOCKER; TEST1 throw / TEST2 정상).
- **`text-white`**: 정본에서 `text-white` 토큰이 자기 자신(`light=dark="text-white"`)을 참조하는 **추출 아티팩트**(실측: self-ref 2건). ref로 두면 사이클이므로 리터럴 `#FFFFFF`로 굳혀 "항상 흰색" 시맨틱을 보존한다.
- **`text-white` @utility 미발행**: `@theme`의 `--color-white`가 Tailwind에 이미 `text-white` 유틸을 만들므로, 역할 `text-white`를 `@utility`로 또 내면 **동일 클래스 이중정의**가 된다(§0 BLOCKER). 따라서 `text-white`는 `:root` var로만 두고(내부 참조·소비자 var 접근용), **`@utility`는 발행하지 않는다**. "항상 흰색 텍스트"가 필요하면 Tailwind 기본 `text-white` 또는 `fg-white`를 쓴다.

### 5.3 실제 예 (전부 `base` 엔트리, 정본 ref — 앵커는 `{base.*}` 형태)
```json
"text-primary":            { "light": "{scales.gray.900}", "dark": "{scales.gray.50}" },
"text-primary_on-brand":   { "light": "{base.white}",       "dark": "{scales.gray.50}" },
"text-secondary_on-brand": { "light": "{scales.brand.200}", "dark": "{scales.gray.300}" },
"text-brand-primary":      { "light": "{scales.brand.900}", "dark": "{scales.gray.50}" },
"text-error-primary":      { "light": "{scales.error.600}", "dark": "{scales.error.400}" },
"text-white":              { "light": "#FFFFFF",            "dark": "#FFFFFF" },

"bg-primary":              { "light": "{base.white}",       "dark": "{scales.gray.950}" },
"bg-secondary_subtle":     { "light": "{scales.gray.25}",   "dark": "{scales.gray.900}" },
"bg-brand-solid":          { "light": "{scales.brand.600}", "dark": "{scales.brand.600}" },
"bg-brand-solid_hover":    { "light": "{scales.brand.700}", "dark": "{scales.brand.500}" },

"border-primary":          { "light": "{scales.gray.300}",  "dark": "{scales.gray.700}" },
"border-secondary":        { "light": "{scales.gray.200}",  "dark": "{scales.gray.800}" },
"border-error":            { "light": "{scales.error.300}", "dark": "{scales.error.400}" },
"border-brand-solid":      { "light": "{scales.brand.600}", "dark": "{scales.brand.500}" },

"fg-primary":              { "light": "{scales.gray.900}",  "dark": "{base.white}" },
"fg-white":                { "light": "{base.white}",       "dark": "{base.white}" },
"fg-brand-primary":        { "light": "{scales.brand.600}", "dark": "{scales.brand.500}" }
```

**검증 포인트 (per-mode 추적의 정확성):**
- `fg-primary` dark=`{base.white}` → `#FFFFFF` (순수 흰색, gray-50이 아님). 반면 `text-primary` dark=`{scales.gray.50}` → `#F5F5F6`. 둘 다 dark지만 서로 다른 앵커로 갈라진다 → REAL 다크의 핵심 시나리오.
- `border-error` dark=`{scales.error.400}` → error는 light==dark 램프라 `#F97066`.
- `bg-brand-solid` light=dark=`{scales.brand.600}` → 유저 brand 값. 단 `bg-brand-solid_hover`는 dark=`brand-500`이라 hover는 모드별로 스텝이 다르다(§4.3 주의).

### 5.4 10개 border · 22개 fg 전체 이름 (정본)
- **border(10)**: `border-primary, border-secondary, border-tertiary, border-disabled, border-disabled_subtle, border-brand, border-brand-solid, border-brand-solid_alt, border-error, border-error-solid`
- **fg(22)**: `fg-primary, fg-secondary, fg-secondary_hover, fg-tertiary, fg-tertiary_hover, fg-quaternary, fg-quaternary_hover, fg-quinary, fg-quinary_hover, fg-senary, fg-white, fg-disabled, fg-disabled_subtle, fg-brand-primary, fg-brand-primary_alt, fg-brand-secondary, fg-error-primary, fg-error-secondary, fg-warning-primary, fg-warning-secondary, fg-success-primary, fg-success-secondary`

> text(21)·bg(31) 전체 인벤토리는 부록/생성물(manifest·`tokens.ts`)에 담긴다. 제너레이터가 `docs/tokens_extracted.json`을 소비해 84개 전부를 시드에 붓는다.

### 5.5 파서(추출→`tokens.json`)의 ref 정규화 규칙
raw `light`/`dark` 문자열 → `base` leaf 값:
1. `"white"` → `"{base.white}"`; `"black"` → `"{base.black}"`. **(정정: `{white}`가 아니라 `{base.white}` — §0 BLOCKER)**
2. `"text-white"`(self값) → 리터럴 `"#FFFFFF"` (사이클 방지).
3. `"<ramp>-<step>"`(예 `gray-900`, `brand-600`, `blue-dark-500`, `orange-dark-700`) → `"{scales.<ramp>.<step>}"`. 다중 하이픈 램프도 마지막 `-<digits>`만 스텝으로 분리: 정규식 `^(.+)-(\d{2,3})$`. **이 정규식은 항상 VALUE(light/dark 문자열)에만 적용하고, 토큰 NAME에는 절대 적용하지 않는다**(§6.1의 `_alt` 이름 오분리 방지).
4. `"... NN%"` → alpha 규칙(§6.2).

**실측 검증**: 위 규칙으로 **semantic 168 + utility 268 = 436개 값 전부 해결, 미해결 0건**(alpha는 별도 리터럴 40개, 역시 0 미해결). 구 Draft의 "268개"는 utility 값 단독 수치였다 — semantic 168을 포함하면 436이 정확하다. 특수 참조는 white/black/text-white/퍼센트뿐(실측).

---

## 6. 유틸리티 + alpha (`base`)

### 6.1 utility (134개, `utility-<color>-<step>` + `_alt` 계열)
전부 `base` flat 엔트리, per-mode 참조. 실제 예(정본, 앵커 없음 — 전부 램프 참조):
```json
"utility-gray-50":       { "light": "{scales.gray.50}",       "dark": "{scales.gray.900}" },
"utility-blue-500":      { "light": "{scales.blue.500}",      "dark": "{scales.blue.500}" },
"utility-brand-600":     { "light": "{scales.brand.600}",     "dark": "{scales.brand.400}" },
"utility-brand-600_alt": { "light": "{scales.brand.600}",     "dark": "{scales.gray.400}" },
"utility-brand_alt":     { "light": "{scales.brand.300}",     "dark": "{scales.gray.700}" },
"utility-blue-dark-500": { "light": "{scales.blue-dark.500}", "dark": "{scales.blue-dark.500}" },
"utility-error-50":      { "light": "{scales.error.50}",      "dark": "{scales.error.950}" }
```
- **`_alt` 계열 = 10개(정정, §0 MAJOR)**: `utility-brand_alt`(무-스텝, light=`brand-300`) + `utility-brand-<step>_alt` 9개(`50/100/200/400/500/600/700/800/900`). **이 10개는 이름이 `-<digits>`로 끝나지 않는다.** 따라서:
  - **NAME은 불투명 flat 키로 취급**한다(`tokens.ts` 그룹핑·manifest·완전성 카운트는 `utility-*` 전체 이름을 문자열 그대로 다룬다). `utility-brand-600_alt`를 `<color>-<step>`로 이름-분리하려 하면 오분리된다.
  - **VALUE(light/dark)는 정상적인 `<ramp>-<step>`이라 §5.5 규칙 3으로 해결**(예 `_alt`의 값 `brand-600`, `gray-400`은 깨끗). 이름 분리 문제와 값 해결 문제는 별개다.
- **다중 하이픈 램프 스텝 분리(값)**: `blue-dark-500`, `orange-dark-700`, `gray-blue-300`, `blue-light-600` 등 전부 `^(.+)-(\d{2,3})$`로 정확히 분리(실측: 134개 값 전부 해결).

### 6.2 alpha (20개) — rgba() 리터럴 채택
**결정: `color-mix()`가 아니라 `rgba()` 리터럴.** 이유: (a) 결정론 — 빌드 결과가 입력만의 함수라 골든 안정, (b) `resolveRefs`가 값 문자열을 그대로 통과(ref 해결 불필요), (c) 브라우저 호환/단순성, (d) `validate.mjs`의 `COLOR_RE`(`^(#|rgb|rgba|hsl|oklch|\{)`)가 이미 `rgba`를 허용.

**변환 규칙** (실측: alpha 색 base는 white·black·gray-950 3종뿐):
- `"white NN%"`    → `rgba(255,255,255,0.N)`
- `"black NN%"`    → `rgba(0,0,0,0.N)`
- `"gray-950 NN%"` → `rgba(12,17,29,0.N)`  (gray-950 light hex `#0C111D` = `12,17,29`)
- 퍼센트→소수: 10→0.1, 20→0.2, …, 90→0.9, **100→1**.

**모드별 매핑** (실측 정본):
- `alpha-white-NN`: light=`white NN%`, dark=`gray-950 NN%`.
- `alpha-black-NN`: light=`black NN%`, dark=`white NN%`.

실제 예:
```json
"alpha-white-10":  { "light": "rgba(255,255,255,0.1)", "dark": "rgba(12,17,29,0.1)" },
"alpha-white-40":  { "light": "rgba(255,255,255,0.4)", "dark": "rgba(12,17,29,0.4)" },
"alpha-white-100": { "light": "rgba(255,255,255,1)",   "dark": "rgba(12,17,29,1)" },
"alpha-black-10":  { "light": "rgba(0,0,0,0.1)",       "dark": "rgba(255,255,255,0.1)" },
"alpha-black-50":  { "light": "rgba(0,0,0,0.5)",       "dark": "rgba(255,255,255,0.5)" },
"alpha-black-100": { "light": "rgba(0,0,0,1)",         "dark": "rgba(255,255,255,1)" }
```
> `gray-950` rgb(`12,17,29`)는 파서가 `primitives.gray["950"].light`(`#0C111D`)에서 계산해 넣는다(원천 단일화). gray-950은 light==dark(`#0C111D`)라 다크에서도 동일.

### 6.3 base 엔트리 총수
`3(앵커: white/black/text-white) + 81(semantic − text-white는 앵커로 흡수) + 134(utility) + 20(alpha) = 238` flat `base` 엔트리.
(semantic 84 중 text-white 1개가 앵커 3종에 포함되므로 83이 아니라 81을 별도로 더하는 것이 아니라 — 정확히는: 앵커 3 + 나머지 semantic 83 + utility 134 + alpha 20 = 240. text-white는 앵커에 포함되고 semantic 83에서 제외되어 이중계상 없음. **총 240.**)

> 정정 노트: base 엔트리 = 앵커 3(white/black/text-white) + semantic(84 − text-white 1 = 83) + utility 134 + alpha 20 = **240**.

---

## 7. Tailwind 유틸 네이밍 (확정 패턴)

> **HYBRID(2층 분리)** 전략. 두 이름공간은 구조적으로 disjoint(프리미티브 유틸은 항상 `-<step>`로 끝나고, 역할 유틸은 절대 숫자로 끝나지 않음)이며, **단 하나의 예외 `text-white`는 §7.2/§5.2에서 발행 제외**해 충돌을 제거한다.
>
> **검증 상태(정정)**: 아래 Tailwind v4 동작(프리미티브 다크 오버라이드·`_` @utility 수용·opacity 드롭)은 이 리포에 tailwind가 미설치라 **여기서 실증하지 못했다**. 따라서 이들은 "검증된 사실"이 아니라 **스모크 테스트(§11.6)가 컴파일 출력으로 반드시 게이트해야 하는 가정**으로 다룬다. 스모크가 실패하면 §7.1(b)/§8.3 폴백을 적용한다.

### 7.1 Layer A — 프리미티브는 `@theme` 등록 (다크 오버라이드 모드 명시)
```css
@theme {
  --color-gray-900: #101828;  --color-gray-50: #F9FAFB;  /* …전 램프 스텝… */
  --color-error-300: #FDA29B; --color-error-400: #F97066;
  --color-brand-600: #<user>; --color-brand-950: #<user>;
  --color-white: #FFFFFF; --color-black: #000000;
}
```
→ 목표: Tailwind가 `bg-brand-600`, `text-gray-900`, `border-gray-200`, `fill-*`, `ring-*`, **opacity 모디파이어**(`bg-brand-500/50`)까지 자동 생성.

**@theme 방출 모드 결정 (BLOCKER 해소):** 프리미티브는 **`@theme`를 `inline` 없이** 사용한다. 이렇게 해야 Tailwind가 `--color-gray-900`를 `:root`로 방출하고 유틸이 `var(--color-gray-900)`를 참조하므로, 아래 (a)의 **플레인 `[data-*]` 재선언 오버라이드가 유효**해진다.
- **(a) 기본 경로**: 프리미티브 dark(사실상 gray만)는 `@theme` **밖** 플레인 `[data-gnb-theme="dark"]` 규칙에서 `--color-gray-900: #161B26;`로 재선언. 유틸이 var 참조라 자동 flip.
- **(b) 폴백**: 만약 스모크(§11.6)에서 `[data-gnb-theme=dark] .bg-gray-900`가 `#161B26`으로 실제 칠해지지 않으면(즉 Tailwind가 프리미티브를 리터럴로 인라인해 오버라이드가 안 먹으면), **gray의 다크를 프리미티브 유틸에 의존하지 않고 역할 토큰 `:root` 레이어로만 구동**한다(gray 다크가 필요한 지점은 전부 역할 토큰 경유이므로 실사용 손실 없음). 이 경우 프리미티브 `bg-gray-*`의 다크 flip은 "미지원"으로 문서화한다.
- **필수 스모크 단언(§11.6)**: `[data-gnb-theme=dark]`에서 `bg-gray-900`이 **규칙 존재가 아니라 실제 `#161B26`을 칠하는지**, 그리고 `bg-brand-500/50`이 `color-mix(... var(--color-brand-500) 50% ...)`로 컴파일되는지 컴파일 출력으로 확인.

### 7.2 Layer B — 역할/유틸/alpha는 `:root` 플레인 var + `@utility`
역할 토큰을 `@theme`에 넣으면 `--color-text-primary`가 어색한 `bg-text-primary`/`text-text-primary` 유틸을 자동 생성하고 정작 `text-primary`는 안 나온다. 따라서 **역할 var는 `@theme`가 아닌 플레인 `:root`에 정의**(자동 유틸 억제)하고, 토큰마다 정적 `@utility` 규칙을 방출한다.

```css
:root {
  --color-text-primary: #101828;
  --color-bg-brand-solid: #<brand-600>;
  --color-border-secondary: #EAECF0;
  --color-fg-primary: #101828;
  --color-utility-blue-500: #2E90FA;
  --color-alpha-black-50: rgba(0,0,0,0.5);
}
[data-gnb-theme="dark"] {
  --color-text-primary: #F5F5F6;
  --color-fg-primary: #FFFFFF;
  --color-border-secondary: #182230;
  --color-alpha-black-50: rgba(255,255,255,0.5);
}

@utility text-primary     { color: var(--color-text-primary); }
@utility bg-brand-solid   { background-color: var(--color-bg-brand-solid); }
@utility border-secondary { border-color: var(--color-border-secondary); }
@utility fg-primary       { color: var(--color-fg-primary); }
```

**접두사 → property 매핑 규칙:**

| 토큰 접두사 | 방출 유틸 | CSS property | 비고 |
|---|---|---|---|
| `text-*` | `text-<rest>` | `color` | **`text-white`는 제외**(§5.2 BLOCKER) |
| `bg-*` | `bg-<rest>` | `background-color` | |
| `border-*` | `border-<rest>` | `border-color` (폭 없음 — §7.6) | |
| `fg-*` | `fg-<rest>` | `color` (currentColor → 자손 SVG 아이콘) | |
| `utility-*` | `bg-<name>` **및** `text-<name>` | background-color / color | border/ring 등 미발행 — §7.6 |
| `alpha-*` | `bg-<name>` **및** `text-<name>` | background-color / color | 동상 |

### 7.3 다크 flip · opacity · 충돌
- **다크 flip (역할 토큰, 가정→스모크 게이트)**: 각 `@utility` 본문이 `var(--color-<token>)`를 읽고, 그 var가 `[data-gnb-theme="dark"]`에서 재선언되므로 유틸별 다크 규칙 없이 자동 전환. `@custom-variant dark` 라인은 소비자의 명시적 `dark:` 사용을 위해 유지하지만, 기본 flip은 이에 의존하지 않는다. **스모크가 `[data-*=dark] .text-primary` 실칠 값을 확인**한다.
- **opacity (역할/유틸/alpha에서 실패의 정확한 형태)**: 프리미티브 유틸은 opacity 모디파이어 자동 지원(`bg-brand-500/50`). **정적 `@utility`(역할/유틸/alpha)에 `/NN`을 붙이면 "반투명이 되는" 것이 아니라 Tailwind v4가 해당 클래스를 매칭 실패로 처리해 규칙을 아예 안 낸다** — 즉 `bg-brand-solid/50`은 50% brand가 아니라 **아무 배경도 안 나온다**. 이는 프리미티브와 동일해 보이는 이름공간에서의 footgun이다. → **README에 명시 경고 + 스모크가 이 드롭을 확인**. 반투명이 필요하면 `alpha-*` 토큰 또는 프리미티브 유틸(`bg-brand-500/50`)을 쓴다.
- **충돌 (실측 검증)**: 84 시맨틱 + 134 유틸 + 20 alpha 이름 vs 전 프리미티브 유틸 stem(29램프 × 12스텝 + white/black)의 교집합은 **정확히 `{text-white}` 1건**이다. 이 1건은 §5.2/§7.2에서 **`@utility text-white` 발행을 제외**해 해소한다. 그 외에는 `text-primary`의 `primary` 등 어떤 역할 rest도 `<ramp>-<step>`과 겹치지 않는다.

### 7.4 역할 var 값: 참조 vs 해석된 hex
**결정: 역할 var는 해석된 hex(및 alpha는 rgba 리터럴)로 방출** — `resolveRefs`가 이미 per-mode로 계산하며, `@theme`가 아닌 `:root` 사용이라 Tailwind `@theme inline` 변수 스코핑 경고를 원천 회피한다. (라이브 캐스케이드를 원하면 `var(--color-gray-900)` 참조형도 가능하나, 결정론·단순성을 위해 hex를 채택.)

### 7.5 소비 예시
```html
<button class="bg-brand-solid text-primary_on-brand border border-brand-solid_alt hover:bg-brand-solid_hover">저장</button>
<p class="text-secondary">본문</p>
<svg class="fg-brand-primary">…</svg>            <!-- currentColor 아이콘 -->
<span class="bg-utility-gray-100 text-utility-gray-700">badge</span>
<div class="bg-alpha-black-50">scrim</div>
```
`buttonVariants`/`getButtonClasses` 불필요 — 전부 Tailwind 유틸 직접 사용. (`border-brand-solid_alt` 단독은 색만 지정하므로 폭 유틸 `border`를 함께 — §7.6.)

### 7.6 알려진 한계 (문서화 필수)
- **utility-*/alpha-*는 `bg-`/`text-`만 발행**한다. 프리미티브는 `@theme` 덕에 `border-`/`ring-`/`fill-`/`stroke-`/`divide-`/`from-`/`to-` 전 계열을 얻지만, 역할/유틸/alpha 레이어는 2종뿐이다. `border-gray-200`(프리미티브)에서 `border-utility-gray-200`으로 옮기면 **그런 유틸은 없다** — 필요하면 프리미티브로 내려간다. 이 비대칭을 README에 명시.
- **`border-*` 역할 유틸은 `border-color`만 세팅(폭 미포함)**. `border-error` 단독은 아무 테두리도 안 그린다 — 반드시 `border`(폭) 유틸과 함께 쓴다. Untitled UI 관례와 일치하나 footgun이므로 README + 스모크에서 명시. 별도 `border-width` 유틸은 발행하지 않는다.

---

## 8. 제너레이터 개편 (v0.1.0 대비 KEEP / CHANGE / REMOVE)

| 모듈 | 액션 | 요지 |
|---|---|---|
| `src/load.mjs` | **KEEP** | 무수정. `loadInputs`(tokens+config+스키마, sourceHash)는 데이터 모델과 무관. |
| `src/scale-gen.mjs` | **KEEP (no-op)** | OKLCH/`$generate` 함수 유지(미래 옵션). 시드는 explicit hex이라 `expandScales`가 `scales`를 그대로 통과. |
| `src/resolve-refs.mjs` | **CHANGE (정정)** | per-mode·per-hop 해석은 REAL 다크의 엔진(핵심 자산)이나 **KEEP 아님**: `enumerateLeaves`(L6)가 `Object.entries(tokens.semantic)`를 **무조건** 실행 → `semantic` 부재 시 throw(실측). L6를 `if (tokens.semantic)`로 가드. `baseKey`는 언더스코어(`_`)를 **그대로 유지**(§8.3). |
| `src/validate.mjs` | **CHANGE** | 6-슬롯 완전성·`config.colors ⊆ semantic`·`slotOverrides` typo 검사 REMOVE. **`semantic` 존재/minProperties 강제(L28–29)도 REMOVE**(정정, §0). leaf/ref/cycle/dup 검사 KEEP. `@utility` 이름 중복 + 프리미티브 stem disjoint(단 `text-white` 제외) 검사 ADD (§8.2). |
| `src/render-css.mjs` | **CHANGE (구조적 재작성)** | `@custom-variant`/헤더 스캐폴딩은 재사용하나, `emitBody`는 **재작성**: 현행은 `config.colors`×`SLOT_ORDER`로 정렬해 scales+base를 **단일 `@theme`**에 몰아넣는다. 신규는 scales→`@theme`, 역할/유틸/alpha→`:root`+`[dark]`, 그리고 `@utility` 패스로 **분기 라우팅**(§8.1). "골격 그대로"가 아님(정정). |
| `src/render-variants.mjs` | **REMOVE** | 파일 전체 삭제. `buildModel`/`renderVariants`/`getButtonClasses` 등 폐기. |
| `src/render-dts.mjs` | **REMOVE → REPLACE** | `render-tokens.mjs`로 대체. `dist/tokens.ts`+`tokens.d.ts`(토큰 이름 상수/유니온 타입) 방출 (§9.2). 현행 `render-dts`는 `buttonVariants`/`SEMANTIC_COLORS`를 방출(실측). |
| `src/render-manifest.mjs` | **CHANGE** | `variantKeys`/`semanticColors`/`computeOmittedVars` REMOVE. `renderManifest(light,dark,model,config,hash)`에서 **`model` 인자 제거**. 토큰 군별 카운트 + `@utility` 매핑 목록 ADD (§9.3). |
| `src/atomic-write.mjs` | **KEEP** | 무수정. `config.output` 키 순회 원자 스왑. 파일명은 config에서만 조정. |
| `bin/ds.mjs` | **CHANGE** | `renderVariants` import/호출 → `renderTokens`. **`suppress()`의 `config.colors`/`slotOverrides` 의존 제거**(baseColorEmit만 유지 — 정정). `renderManifest` 호출에서 `model` 인자 제거. 성공 메시지 `variants.ts` → `tokens.ts`. `parseArgs`/`--check`/원자쓰기 KEEP. |

### 8.1 `render-css.mjs` 상세
방출 순서(결정론):
1. **헤더** + `@custom-variant dark (&:where([data-gnb-theme="dark"], … *))` (스캐폴딩 KEEP).
2. `@theme { … }` — **프리미티브 램프만** `--color-<ramp>-<step>`(hex 그대로), `inline` 미사용(§7.1). 정렬: `Object.keys(scales)` 삽입순 → 스텝 숫자 오름차순.
3. `[data-gnb-theme="dark"] { … }` — **@theme 밖 플레인 규칙**. gray 스텝은 dark값 재선언(light≠dark). 비-gray 램프는 동일값이므로 재선언 생략 가능. *주의*: 다크 블록을 `@theme` 안에 넣으면 안 됨.
4. `:root { … }` — 역할/유틸/alpha var(`--color-text-primary` 등, light 해석값). **`--color-text-white`는 var로 방출하되(§5.2) @utility는 스킵.**
5. `[data-gnb-theme="dark"] { … }` — 위 var 중 dark≠light인 것만 재선언.
6. `@utility …` 패스 — §7.2 매핑대로 토큰당 규칙 방출. `utility-*`/`alpha-*`는 `bg-`+`text-` 양쪽. **`text-white` 역할 토큰은 @utility 제외.**

### 8.2 `validate.mjs` 상세
- **REMOVE**: `SLOT_ORDER` 6-슬롯 필수/omit(L36–41,42–45), `config.colors ⊆ semantic`(L47–49), `slotOverrides` typo(L50–53), 6-슬롯 claim(L63), **`semantic` 존재/minProperties 강제(L28–29)**(정정).
- **KEEP**: `checkLeaf`(leaf `{light,dark}`, `COLOR_RE`, 미지 키 금지), `resolveLeafValue`(ref/cycle/unresolvable), 중복 emit `claim`(scales·base 대상), `walk`(양 모드 해석).
- **재해석**: `tokens.semantic` 순회(L37–46,56)는 제거하거나 `if (tokens.semantic)` 가드. validate는 `scales` + `base` 두 종류만 검사.
- **ADD**: (a) 모든 `base` ref가 존재하는 scales 스텝/앵커를 가리키는지(walk가 이미 커버), (b) **`base.white`/`base.black`/`text-white` 앵커 존재 프리플라이트** — `{base.*}` 형태 ref가 해결됨을 assert(§0 회귀 방지), (c) alpha 값 rgba 형식, (d) `@utility` 이름 중복 금지 + **역할 유틸 이름 ∩ 프리미티브 stem = {} — 단 `text-white`는 화이트리스트 제외**(정정: 교집합이 공집합이 아니라 `{text-white}`이므로), (e) **brand 필수 스텝 프리플라이트**(시맨틱이 참조하는 50–950 최소셋 안내).

### 8.3 이름 정규화 (`_` 유지 + 스모크 게이트)
정본 토큰 이름에는 `-`와 `_`가 섞이나(`text-secondary_on-brand`, `utility-brand-600_alt`) **`/`는 없다**(실측). v0.1.0 `baseKey`는 `/`→`-`만 치환하므로 이 데이터에 무해. **`_`는 그대로 유지**한다 — (a) Untitled UI 원본 이름과 1:1, (b) CSS 커스텀 프로퍼티/`:root` var 키에 `_`는 합법.
- **정정(가정→게이트)**: `_`가 Tailwind v4 **`@utility` 셀렉터 이름**에 합법인지는 버전 민감하며 이 리포에서 실증 불가하다. 25개 역할 토큰 + 10개 `_alt` 유틸이 `_`를 담으므로(예 `@utility bg-brand-solid_hover`, `@utility text-utility-brand-600_alt`), **스모크(§11.6)가 `_` 포함 @utility의 컴파일 출력을 반드시 확인**한다.
- **폴백**: 피어 하한(≥4.1.0)~§7 주장 버전 중 하나라도 `_` @utility 이름을 거부하면, 두 옵션 중 택1: (i) 피어 하한을 최초 지원 버전으로 올리고 명시, (ii) **CSS 클래스 이름만 `_`→`-` slugify**(CSS var 이름은 verbatim 유지). (ii)를 택하면 `text-secondary-on-brand` 류 충돌 위험을 재검사해야 한다(현재 데이터에선 충돌 없음 실측이나, slugify 후 재확인 필수).

---

## 9. 방출물 (`dist`)

### 9.1 `dist/theme.css` 구조
```
/* AUTO-GENERATED by @blomics-platform/design-system — DO NOT EDIT. Source hash: <h>.
   소비자 globals.css가 @import "tailwindcss"; 를 이 파일 import 위에 두어야 한다. */

@custom-variant dark (&:where([data-gnb-theme="dark"], [data-gnb-theme="dark"] *));

@theme {                                  /* Layer A: 프리미티브 (light), inline 미사용 */
  --color-gray-25: #FCFCFD; … --color-brand-950: #<user>; --color-white:#FFFFFF; --color-black:#000000;
}
[data-gnb-theme="dark"] {                 /* 프리미티브 dark: 사실상 gray만 */
  --color-gray-25:#FAFAFA; … --color-gray-900:#161B26;
}
:root {                                   /* Layer B: 역할/유틸/alpha var (light) */
  --color-text-primary:#101828; --color-text-white:#FFFFFF; --color-bg-brand-solid:#<brand-600>; …
  --color-utility-blue-500:#2E90FA; --color-alpha-black-50:rgba(0,0,0,0.5); …
}
[data-gnb-theme="dark"] {                 /* 역할/유틸/alpha dark 오버라이드 */
  --color-text-primary:#F5F5F6; --color-fg-primary:#FFFFFF; …
}

@utility text-primary { color: var(--color-text-primary); }        /* 83 역할(text-white 제외) */
@utility bg-brand-solid { background-color: var(--color-bg-brand-solid); }
@utility bg-utility-blue-500 { background-color: var(--color-utility-blue-500); }
@utility text-utility-blue-500 { color: var(--color-utility-blue-500); }   /* 134×2 */
@utility bg-alpha-black-50 { background-color: var(--color-alpha-black-50); }  /* 20×2 */
…
```
**정확한 카운트(정정 — brand 이중계상 제거):**
- 프리미티브 스텝 var = 29램프 × 12스텝 = **348**(brand 12 포함) + white/black 2 = **350**.
- 역할 var 84 + 유틸 var 134 + alpha var 20 = 238.
- 총 `--color-*` = 350 + 238 = **588**. (`text-white` var는 방출하되 @utility만 스킵.)
- `@utility` 규칙 수 = 83(역할, text-white 제외) + 134×2 + 20×2 = **391** (Tailwind가 미사용분 트리셰이크). 완전성 테스트가 정확한 수를 assert(§11).
- **주의**: `theme.css`는 Tailwind 소스 파셜(`@theme`/`@utility` 지시자는 Tailwind 컴파일러가 처리해야 유효). 비-Tailwind 파이프라인에 넣으면 무효 — README에 명시.

### 9.2 `dist/tokens.ts` / `tokens.d.ts` (buttonVariants 없음)
```ts
export const PRIMITIVE_RAMPS = ["brand","gray","error","warning","success","gray-blue", …] as const;   // 29
export const PRIMITIVE_STEPS = ["25","50","100","200","300","400","500","600","700","800","900","950"] as const;
export const TEXT_TOKENS   = ["text-primary","text-primary_on-brand","text-secondary", …] as const;   // 21
export const BG_TOKENS     = ["bg-primary","bg-primary_alt","bg-brand-solid", …] as const;             // 31
export const BORDER_TOKENS = ["border-primary","border-error","border-brand-solid_alt", …] as const;   // 10
export const FG_TOKENS     = ["fg-primary","fg-white","fg-brand-primary", …] as const;                 // 22
export const UTILITY_TOKENS= ["utility-gray-50","utility-brand_alt","utility-brand-600_alt", …] as const; // 134 (이름 verbatim)
export const ALPHA_TOKENS  = ["alpha-white-10","alpha-black-100", …] as const;                          // 20
export type TextToken = (typeof TEXT_TOKENS)[number];
export type BgToken = (typeof BG_TOKENS)[number];
export type BorderToken = (typeof BORDER_TOKENS)[number];
export type FgToken = (typeof FG_TOKENS)[number];
export type UtilityToken = (typeof UTILITY_TOKENS)[number];
export type AlphaToken = (typeof ALPHA_TOKENS)[number];
export type PrimitiveRamp = (typeof PRIMITIVE_RAMPS)[number];
export type PrimitiveStep = (typeof PRIMITIVE_STEPS)[number];
```
- 상수는 **완전한 유틸 클래스명**(`"text-primary"`)을 담아 소비자가 `class={TEXT_TOKENS[0]}` 처럼 바로 쓰게 한다.
- **`UTILITY_TOKENS`는 134개 이름을 verbatim**으로 담는다 — `_alt` 10개 포함, **이름 기반 `<color>-<step>` 분리를 하지 않는다**(§6.1). 그룹핑은 정본 JSON의 이름 목록을 그대로 fixture화.
- `.ts`를 그대로 export하는 v0.1.0 관례 유지(소비자가 tsc 처리). `.d.ts`는 동형 declare.

### 9.3 `dist/tokens.manifest.json`
```json
{
  "sourceHash": "…", "generator": "@blomics-platform/design-system", "version": "0.2.0",
  "darkSelector": "[data-gnb-theme=\"dark\"]",
  "primitives": { "ramps": ["brand","gray","error", …], "steps": ["25", …, "950"] },
  "colorVars": { "light": ["--color-…"], "dark": ["--color-…"] },
  "roleTokens": { "text": [ …21 ], "bg": [ …31 ], "border": [ …10 ], "fg": [ …22 ] },
  "utilityTokens": [ …134 ], "alphaTokens": [ …20 ],
  "utilities": { "text-primary": "--color-text-primary", "bg-brand-solid": "--color-bg-brand-solid", … }
}
```
`utilityTokens`는 이름 verbatim(불투명 문자열). `variantKeys`/`semanticColors`/`omittedVars` 제거.

---

## 10. 다크모드 (실제 참조 기반)

핵심 자산은 `resolve-refs.mjs`의 `pickModeValue`/`resolveOne`: **다크 해석 시 매 hop마다 leaf의 dark 값을 따라간다**(실측 §0 TEST3: `text-primary` dark → `#F5F5F6`). `autoMirror` 없이 REAL 다크.

- **gray = 별도 팔레트**: light=`primitives.gray`, dark=`primitives.gray-dark`. 이 distinct가 다크의 회색 계열을 정확히 만든다.
- **비-gray 램프 = light==dark**: 다크에서도 동일 색상 팔레트(에러 빨강은 밝든 어둡든 같은 램프).
- **brand = hex 모드동일이지만 dark 출력은 다름**: 역할/유틸이 dark에서 다른 brand 스텝을 고른다(§4.2/§4.3). "brand은 다크 무관"은 오해 — brand 50–950을 다 채워야 dark가 성립.
- **앵커 분기**: `fg-primary` dark=`{base.white}`(순수 흰) vs `text-primary` dark=`{scales.gray.50}`(#F5F5F6) — per-mode 추적으로 정확히 갈린다.
- **alpha 다크**: 리터럴이라 ref 해석 없이 모드별 rgba 그대로(예 `alpha-white-*` dark=`rgba(12,17,29,x)`).
- `[data-gnb-theme="dark"]` 셀렉터가 조상에 있으면 var가 dark 선언으로 해석되고 `@utility` 본문이 자동 repaint(§7.3, 스모크 게이트).

**시드 설정**: `meta.autoMirrorDark`는 생략/false. 모든 leaf가 light+dark를 명시하므로 `pickModeValue`의 autoMirror 폴백은 타지 않는다(코드는 KEEP).

---

## 11. 검증 · 게이트

**인벤토리 원칙**: §11은 `test/*.test.mjs` 전체를 빠짐없이 분류한다(정정 — 구 Draft는 render-css/render-manifest/opacity를 누락).

1. **골든 테스트** (`cli-golden.test.mjs` 개조): 시드 `tokens.json` → `dist`(theme.css/tokens.ts/tokens.d.ts/tokens.manifest.json) 재빌드가 커밋된 골든과 바이트 동일(`ds build --check` == 0). `DIST_FILES`를 `['theme.css','tokens.ts','tokens.d.ts','tokens.manifest.json']`로 교체, 골든 4파일 재생성.
2. **완전성 게이트** (`completeness.test.mjs` 재작성): `theme.css`가 다음을 전부 var(또는 유틸)로 방출하는지 **이름으로** assert(정정 — 카운트 아닌 방출 집합) —
   - **방출 프리미티브 29램프 × 각 스텝**(brand ∈ 29, gray-dark ∉) + white/black. brand를 별도 항으로 더하지 않는다.
   - 시맨틱 84 + 유틸 134 + alpha 20 = 238 역할 var.
   - 접두 카운트 정확: **text 21, bg 31, border 10, fg 22**.
   - `@utility` 규칙 391개(text-white 제외), 정본 이름 리스트를 fixture로 두고 diff, 누락 0.
3. **다크 정확성**: gray 최소 1스텝 light≠dark(`#F9FAFB`≠`#F5F5F6`); 비-gray 램프(error 등) light==dark; 역할 스팟 — `text-primary` light `#101828`/dark `#F5F5F6`, `fg-primary` dark `#FFFFFF`, `border-error` dark `#F97066`.
4. **alpha rgba 정확성**: `alpha-white-10.light`=`rgba(255,255,255,0.1)`, `alpha-black-50.light`=`rgba(0,0,0,0.5)`, `alpha-white-40.dark`=`rgba(12,17,29,0.4)`, `*-100`은 `,1)`.
5. **@utility 발행/충돌**: `@utility text-primary`/`bg-brand-solid`/`border-secondary`/`fg-primary` 존재; **`@utility text-white` 부재**(발행 제외 확인); 중복 `@utility` 없음; 역할 유틸 ∩ 프리미티브 stem = `{}`(text-white 제외 후).
6. **Tailwind 컴파일 스모크** (`smoke-consumer.test.mjs` 개조, tailwind 부재 시 skip) — **컴파일 출력을 assert**(정정: 규칙 존재가 아니라 실제 값):
   - `@import "tailwindcss"; @import "./theme.css";` + 소비 클래스 컴파일.
   - `[data-gnb-theme=dark]`에서 `bg-gray-900`이 **`#161B26`을 실제 칠하는지**(§7.1 프리미티브 다크 오버라이드 게이트).
   - `bg-brand-500/50`이 `color-mix(... var(--color-brand-500) 50% ...)`로 컴파일되는지.
   - **`_` 포함 @utility**(`text-secondary_on-brand`, `bg-brand-solid_hover`, `text-utility-brand-600_alt`)가 color/background 규칙을 실제 생성하는지(§8.3 게이트). 실패 시 폴백(피어 하한 상향 또는 slugify).
   - `text-primary/40` 같은 정적 @utility opacity가 **규칙을 안 냄**(드롭)을 확인(§7.3).
   - `bg-brand-solid`/`text-primary`/`border-error`+`border`/`fg-brand-primary`가 각각 background/color/border-color 생성.
7. **validate 단위** (`validate.test.mjs` 개조): 사이클 ref, 미해결 ref, 중복 var, 미지 leaf 키에 각각 throw. **`semantic` 부재로 throw하지 않음**(신규 회귀), `{base.white}` 앵커 해결, 6-슬롯/`config.colors` 단언 제거. alpha rgba·유틸 이름중복·stem disjoint(text-white 화이트리스트) ADD.
8. **render-css 단위** (`render-css.test.mjs` **CHANGE/재작성** — 정정): 구 6-슬롯 순서·`config.colors` 정렬·"dark block re-emits every var"·`--color-primary` 단언 전부 제거. 신규: `@theme`에 프리미티브만, `:root`에 역할 var, `@utility` 패스 존재, `text-white` @utility 부재, 결정론(동일 입력→동일 출력) 단언.
9. **render-manifest 단위** (`render-manifest.test.mjs` **CHANGE/재작성** — 정정): `variantKeys`/`semanticColors`/`omittedVars` 단언 제거. 신규: `roleTokens` 그룹 카운트, `utilityTokens` 134 verbatim, `utilities` 매핑, `version:"0.2.0"`.
10. **opacity 단위** (`opacity.test.mjs` **CHANGE/재타겟** — 정정): 현재 `bg-primary/10`·`text-primary-600/50`·`bg-surface-hover/50`와 `--color-primary`/`--color-surface-hover`를 assert하나 신모델에 그 var가 없어 실패. **존재하는 프리미티브로 재타겟**: `bg-brand-500/50`·`text-gray-900/70` → `color-mix`가 `--color-brand-500`/`--color-gray-900` 참조 확인.
11. **KEEP 테스트**: `resolve-refs.test.mjs`(per-mode/2-hop/cycle — fixture만 신모델·`{base.*}` ref로 조정), `scale-gen.test.mjs`(순수 OKLCH — seed 독립), `atomic-write.test.mjs`/`cli-args.test.mjs`(파일명 상수만 조정).
12. **REMOVE 테스트**: `render-variants.test.mjs`(17KB, 6패밀리 byte-exact) 전체 삭제. `add-color.test.mjs` 삭제 또는 재작성. `load.test.mjs`의 6-슬롯/`config.colors` 관련 단언 제거.

---

## 12. 마이그레이션 · 버전

- **버전**: `0.1.0` → **`0.2.0`** (pre-1.0이므로 minor bump으로 BREAKING 표현). git 태그 `v0.2.0`.
- **BREAKING**: variant 헬퍼(`buttonVariants`/`getButtonClasses`) 및 export 제거, `.` 진입점이 `variants.ts` → `tokens.ts`. **fortress가 아직 미소비**라 실사용 영향 없음(LOCKED 수용).
- **package.json**:
  - `version` 0.2.0, `description` "Untitled UI color token layer for Tailwind v4 (primitives + semantic/utility/alpha CSS vars & utilities)."
  - `exports["."]` (현재 `variants.*`) → `{ types: "./dist/tokens.d.ts", import: "./dist/tokens.ts", default: "./dist/tokens.ts" }` (variants export DROP).
  - `./theme.css`, `./tokens`(manifest), `./config-schema`, `./tokens-schema` KEEP. `peerDependencies tailwindcss>=4.1.0` KEEP(§8.3 스모크가 실제 지원 하한을 확정하면 조정).
- **배포**: `dist` 4파일을 태그에 커밋 → 태그 전 `ds build`로 재생성. 삭제: `dist/variants.ts`, `dist/variants.d.ts`, `src/render-variants.mjs`, `src/render-dts.mjs`, `test/render-variants.test.mjs`. 신규: `dist/tokens.ts`, `dist/tokens.d.ts`, `src/render-tokens.mjs`.
- **스키마 변경**:
  - `tokens.schema.json` — top-level `required`를 `["scales","base"]`로(또는 전부 optional); `semanticColor` 6-슬롯 required 삭제; `semantic`은 optional(빈 객체 허용).
  - `config.schema.json` — **`required`에서 `colors`·`variantFamilies` 제거**(정정, 실측 L5 `["classPrefix","darkSelector","darkVariantName","colors","variantFamilies","output"]`). 신 `required` = `["classPrefix","darkSelector","darkVariantName","output"]`. properties에서 `variantFamilies`/`slotOverrides`/`variantOverrides`/`helpers`/`colors` 제거. `output.required`는 `["css","ts","dts","manifest"]` 유지(파일명만 `tokens.*`). `roleUtilities` 매핑 옵션 ADD(또는 코드 하드코딩 — §14 Q7). `colorRef` 패턴·`explicitRamp`·`meta.autoMirrorDark`(default false) KEEP. **`bin/ds.mjs` `suppress()`/`renderAll`이 더 이상 `config.colors`를 읽지 않도록 함께 수정**(정정).
- **README**: `getButtonClasses`/6-슬롯 add-color 워크플로 → 토큰 직접 사용(`text-primary`/`bg-brand-solid`, `tokens.ts` 상수 import) + brand 램프 붙여넣기 절차 + **한계 경고(§7.6: utility/alpha는 bg/text만, border 역할 유틸은 폭 필요, 정적 @utility에 opacity 금지)**로 교체. `@source` glob는 `dist/**/*.ts` 유지.

---

## 13. 구현 분해 (레이어 순서)

권장 5단계 — 각 단계가 이전 산출물에 의존한다.

**(1) 스키마 축소** — `tokens.schema.json`/`config.schema.json`에서 6-슬롯·variant 관련 제거, `scales`+`base` 중심으로. **`config.schema.json.required`에서 `colors`/`variantFamilies` 제거**. `semantic` optional. `roleUtilities` 매핑 필드 추가(선택).

**(2) 시드 `tokens.json` 생성 (1회성 파서 `scripts/build-tokens-from-extracted.mjs`)** — `docs/tokens_extracted.json` 소비:
- **scales**: gray는 `{light: gray[s], dark: gray-dark[s]}` merge; 27 컬러 램프는 `{light: hex, dark: hex}`; brand 스켈레톤(유저가 hex 채움). gray-dark는 별도 노출하지 않음.
- **semantic**: **빈 객체 `semantic: {}`로 출력**(엔진/validate 편집 전 안전망; 편집 후에도 무해).
- **base(240)**: 앵커 3(white/black/text-white) + 시맨틱 81(§5.5) + 유틸 134 + alpha 20(§6.2 rgba). 파서 의사코드(정정: `{base.*}` ref, `%` 먼저 제거):
  ```js
  const toRef = raw =>
    raw==="white" ? "{base.white}" : raw==="black" ? "{base.black}" :
    raw==="text-white" ? "#FFFFFF" :
    (m => m ? `{scales.${m[1]}.${m[2]}}` : err(raw))(raw.match(/^(.+)-(\d{2,3})$/));
  // ↑ toRef는 VALUE에만 적용. 유틸 NAME(utility-brand-600_alt 등)에는 절대 적용 금지.
  const alphaVal = raw => {
    const [c, p] = raw.split(" ");            // p = "10%".."100%"
    const n = Number(p.slice(0, -1));         // % 제거 후 숫자화 (정정: Number("100%")는 NaN)
    const a = n === 100 ? "1" : (n / 100).toString();
    return c === "white" ? `rgba(255,255,255,${a})`
         : c === "black" ? `rgba(0,0,0,${a})`
         : `rgba(${gray950rgb},${a})`;        // gray950rgb = "12,17,29" (primitives.gray.950.light에서 계산)
  };
  ```
- **검증 게이트 사전조건**: 파서 후 정본 카운트(방출 scales 29 / semantic 84 / utility 134 / alpha 20)와 base 240 재확인. `_alt` 10개는 이름 그대로 base 키로.

**(3) 엔진·validate 개편 (CHANGE)** — `resolve-refs.mjs` `enumerateLeaves`에 `if (tokens.semantic)` 가드; `validate.mjs`에서 6-슬롯·`config.colors`·`semantic` 강제(L28–29) 제거, `{base.*}` 앵커 프리플라이트·claim 확장(§8.2). 이 단계에서 시드가 통과해야 다음으로.

**(4) 렌더 개편 + 재배선** — `render-css.mjs` `emitBody` 재작성(§8.1); `render-tokens.mjs` 신설(§9.2); `render-variants.mjs`/`render-dts.mjs` 삭제; `render-manifest.mjs`에서 `variantKeys`/`model` 제거; `bin/ds.mjs`에서 `renderVariants→renderTokens`, `suppress()` `config.colors` 의존 제거, `renderManifest` `model` 인자 제거, 성공 메시지 갱신.

**(5) 빌드 + 검증** — 골든 4파일 재생성(`ds build`), 완전성/다크/alpha/@utility/**컴파일-출력 스모크**(§11.6) 게이트 통과, `ds build --check` == 0 확인 후 `v0.2.0` 태그. 스모크에서 프리미티브 다크 오버라이드·`_` @utility가 실패하면 §7.1(b)/§8.3 폴백 적용.

의존 그래프: (1) → (2) → (3) → (4) → (5). (2)의 파서는 (3)의 validate가 게이트하고, (4)의 렌더가 (2)의 시드를 소비하며, (5)가 전체를 봉인한다.

---

## 14. 미해결 질문 (정정 반영)

1. **`text-white` @utility**: **[해소됨 → 미발행으로 확정]** Tailwind `text-white`(프리미티브)와 충돌하므로 역할 `text-white`는 @utility 미발행, `:root` var만 노출. "항상 흰 텍스트"는 Tailwind `text-white`/`fg-white` 사용.
2. **`--color-white`/`--color-black` var 노출**: 내부 ref로 쓰이며 프리미티브 유틸(`bg-white`)도 생성하므로 **기본 emit 권장**. `baseColorEmit:{white:false}`로 숨김 가능하나 비권장(프리미티브 유틸 손실).
3. **프리미티브 방출 순서**: `@theme` 내 var 순서는 기능 무영향 → `Object.keys(tokens.scales)` 삽입순 권장(`config.colors` 제거됨).
4. **`scaleOutput` hex 고정**: 값이 확정 hex라 OKLCH 변환은 손실 → hex 고정 권장. `$generate` 경로는 코드 유지·미사용.
5. **`gray-dark` 별도 노출**: 현재 `gray.dark`로 흡수(참조 0회 실측). 향후 다크 전용 프리미티브 유틸(`--color-gray-dark-500`) 필요 시 추가.
6. **비-gray 램프의 다크 블록 재방출**: light==dark라 `[dark]`에서 생략(용량 절감) 안전. 완전성 테스트는 var 존재(light)만 요구.
7. **`roleUtilities` config 노출 vs 하드코딩**: 접두사 고정(text/bg/border/fg/utility/alpha)이라 **하드코딩 기본 + 선택적 override** 실용적.
8. **`utility-*`/`alpha-*`의 `text-` 발행 범위**: `bg-`+`text-` 양쪽(§7.2). border/ring 등은 **미발행**(§7.6 한계로 문서화). 트리셰이크 신뢰.
9. **`tokens.ts` 상수 값 형태**: 완전 유틸명(`"text-primary"`) 권장. `UTILITY_TOKENS`는 `_alt` 포함 verbatim.
10. **`border-*` 역할 유틸 폭 미포함**: `border-color`만 — `border-error`는 `border`(폭)와 병용 필수(§7.6). README + 스모크에서 명시. 별도 폭 유틸 미발행.
11. **[신규] Tailwind v4 동작 게이트**: 프리미티브 다크 오버라이드·`_` @utility 수용·정적 @utility opacity 드롭은 **스모크(§11.6)가 컴파일 출력으로 확정**한다. 실패 시 폴백(§7.1(b)/§8.3)을 적용하고 결과를 README에 문서화.