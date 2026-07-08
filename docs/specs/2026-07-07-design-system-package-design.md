# @blomics-platform/design-system — 구현 설계 스펙 (Phase 1)

> **Date**: 2026-07-07 · **Status**: Final · **Scope**: Phase 1 (패키지 구축 + fortress 첫 이관)
> **Author**: Platform Eng · **Approach**: R3 (single-source `tokens.json` + code generator)

---

## 1. 개요

fortress(`game-platform`, Next.js 16 / React 19 / Tailwind v4)의 디자인 토큰은 지금 **세 곳에 중복**으로 흩어져 있고(`globals.css`의 `:root` 원시값, 같은 파일의 `@theme inline` 재매핑, `src/lib/utils/design-tokens.ts`의 손수 작성한 variant 맵), 다크모드 인프라는 배선되어 있으나 **다크 색상값 자체가 존재하지 않는다**. 이 스펙은 이 문제를 근본적으로 해결하기 위해 **단일 원천 `tokens.json` + 코드 제너레이터**로 구성된 **설치 가능한 버전드 패키지 `@blomics-platform/design-system`** 를 만들고, fortress를 그 **첫 소비자**로 이관하는 작업(Phase 1)을 정의한다. 산출물은 (1) 프로젝트 무관(config 주도) 패키지와 (2) fortress가 git-tag/`file:` 설치로 그 패키지를 소비하도록 바뀐 상태이며, **기존 472개의 Tailwind 유틸리티 사용처가 그대로 동작**하는 것이 성공 기준의 핵심이다.

> **성공 기준 수치 정의(단일 권위값)**: 이 스펙 전체에서 "그대로 동작해야 하는 사용처"의 수는 **472**로 통일한다. 이는 인벤토리에서 확인한 **`*.tsx`/`*.ts` 내 리터럴 semantic 유틸리티 발생(occurrence) 총계**다. 과거 초안에 등장하던 "~200"은 폐기한다. 수용 게이트는 "이 472개 발생의 컴파일 결과가 이관 전후로 동일"이며, 검증은 §13.3의 열거된 클래스→개수 매니페스트에 대해 수행한다(headline 숫자가 아니라 열거 목록으로 검증).

---

## 2. 목표 & 비목표 (Non-Goals)

### 2.1 목표 (Goals)

- **G1. 단일 원천**: 모든 색 토큰(라이트+다크)이 `tokens.json` 한 곳에서만 정의된다. `globals.css`의 `:root`/`@theme`와 `design-tokens.ts`는 **생성 산출물로 대체**되어 손으로 편집하지 않는다.
- **G2. 규칙 기반 파생**: 모든 semantic 색은 **고정된 6-슬롯**(`base, hover, active, foreground, light, light-foreground`)을 가지며, button/badge/alert/text 등 variant 계열은 이 슬롯에서 **기계적으로 파생**된다.
- **G3. config 주도(프로젝트 무관)**: 다크 셀렉터, 클래스 프리픽스, 색 목록, 출력 경로가 **설정값**이다. 패키지 코드에는 fortress 고유값이 하드코딩되지 않는다.
- **G4. Tailwind-native**: `bg-primary`, `text-primary-600`, `border-danger/20` 같은 **유틸리티 사용법을 유지**한다. 컴포넌트를 `data-variant`/CSS-role 방식으로 갈아엎지 않는다. 기존 `design-tokens.ts`의 **공개 심볼 표면(버튼/뱃지/… variant 맵 + `commonStyles` + 헬퍼 + 타입)** 을 전부 보존한다.
- **G5. 다크 1급**: 토큰마다 light/dark 값을 정의하고, **configurable data-attribute 셀렉터**(기본값은 fortress의 기존 `[data-gnb-theme="dark"]`)로 오버라이드한다.
- **G6. 무결성**: 제너레이터는 단일-패스, all-or-nothing. `--check` 모드로 "산출물이 원천과 일치함"을 CI에서 증명한다.

### 2.2 비목표 (Non-Goals) — 명시적으로 **범위 밖**

- **N1. (Phase 2) 실제 레지스트리 발행** — GitHub Packages / private npm 퍼블리시 파이프라인.
- **N2. (Phase 2) semver 릴리스 프로세스** — 버전 범핑/체인지로그/태깅 자동화, 브레이킹 체인지 정책.
- **N3. (Phase 2) 형제 프로젝트 확산** — `blomics-web`, `event`, `molepgames` 이관.
- **N4.** 컴포넌트 자체를 패키지로 이관(버튼/뱃지 React 컴포넌트 제공). 이 스펙은 **토큰 + variant 문자열 헬퍼**만 배포한다.
- **N5.** input/card 계열을 위한 **생성형(generative) recipe DSL** — 파라미터화된 focus-ring/placeholder/shadow **합성 엔진**. 이들 색-6슬롯 비파생 계열은 **config override의 정적 문자열 맵**으로 처리한다(§7.2, §15).
- **N6.** 색상값 자체의 리디자인. 다크 팔레트는 부트스트랩만 하고(§9.3), 실 팔레트는 이후 데이터 입력으로 채운다.

> **N4/N5와 §7의 관계(스코프 경계 명시)**: `card`/`input` 계열은 **Phase 1 스코프에 포함**되지만 그것은 "토큰에서 파생된 variant 문자열"이 아니라 **config `variantOverrides`에 사람이 저작한 정적 문자열 맵**으로서 포함된다. N5가 배제하는 것은 이 문자열을 **자동 합성하는 recipe DSL**이지, 손저작 override 문자열 자체가 아니다. 즉 `getInputClasses`/`inputVariants`/`cardVariants` 배포는 N4/N5를 위반하지 않는다 — 이들은 "variant 문자열 헬퍼"(G4/N4 인스코프)이며, 다만 그 문자열의 출처가 파생 규칙이 아니라 config 데이터일 뿐이다.

> Phase 2(N1–N3)는 향후 작업으로 §14에 **스케치만** 남긴다. 이 스펙은 그것을 상세 설계하지 않는다.

---

## 3. 배경 & 현재 문제

### 3.1 3층 중복 (three-layer duplication)

토큰 하나의 값이 세 군데를 거친다:

```
:root { --primary: var(--primary-600); }          ← (A) 원시값/의미별칭   globals.css
@theme inline { --color-primary: var(--primary); } ← (B) Tailwind 재매핑    globals.css (동일 파일)
buttonVariants.primary = "bg-primary hover:bg-primary-hover ..." ← (C) variant 문자열  design-tokens.ts
```

(A)와 (B)가 같은 파일에서 토큰마다 두 줄씩 반복되고, (C)는 손으로 조합한 문자열이다. 색을 하나 바꾸려면 최소 (A) 라이트, (A) 슬롯 별칭, (B) `--color-*` 매핑, 그리고 필요 시 (C) variant까지 **여러 곳을 동기화**해야 하며, 이 동기화는 사람 손에 의존한다.

### 3.2 슬롯 불일치 (inconsistent slots)

인벤토리 기준(원본 `globals.css` `:root` 실측), semantic 색마다 슬롯 집합이 다르다:

| 색 | base | hover | active | foreground | light | light-fg | 스케일 | 실측 base 값 |
|---|---|---|---|---|---|---|---|---|
| primary | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **25..900 (11단계)** | `var(--primary-600)`=#2563eb |
| secondary | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | — | #f3f4f6 |
| success | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | — | #10b981 |
| warning | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | — | #f59e0b |
| danger | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | — | #ef4444 |
| info | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | — | #06b6d4 |
| accent | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | — | #8b5cf6 |
| muted | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | — | #f3f4f6 |

`success/warning/danger/info/accent`에 `active`가 없고, `secondary`는 `active`는 **있으나** `light` 쌍이 없다(이 "active 유지·light 생략" 형태가 가장 오매핑되기 쉬운 케이스 — §6.6·§7.3에서 end-to-end 예시로 명시). 그래서 variant 계열을 "색마다 동일하게" 파생할 수 없다 — 이것이 규칙 기반 파생을 막는 근본 원인이다.

### 3.3 다크 색상값 부재 (critical gap)

인프라는 **완비**되어 있다: `ThemeProvider.tsx`가 `html[data-gnb-theme]`를 세팅하고, `useTheme.ts`가 동기화하며, `public/scripts/theme-init.js`가 FOUC를 막고, `globals.css:3`에 `@custom-variant dark (...)`가 있다. 그러나 **`[data-gnb-theme="dark"]` 색상 오버라이드 블록이 어디에도 없다**. `*.css`에서 `data-gnb-theme="dark"`를 grep하면 3번째 줄(변형 선언 자체)만 나온다. 결과적으로 다크 토글은 `html.colorScheme`을 바꾸고 `dark:` 유틸을 매칭 가능하게만 할 뿐, **모든 토큰 색은 라이트 그대로**다.

> **주의 — `dark:` 유틸은 live 의존이다**: fortress JSX에는 이미 `dark:` 유틸 사용처가 **존재**한다(실측: `ThemeToggle.tsx`에 `dark:bg-gray-800` 등 8건, 모두 Tailwind 내장 gray 사용). 따라서 `@custom-variant dark` 라인은 "미래 대비"가 아니라 **현재 동작 중인 의존성**이며, 이관 시 바이트 동일 보존이 필수다(§10 S2, §13.9).

### 3.4 소비 실태 (수치)

- 총 **472개**의 리터럴 semantic 유틸리티 발생 (`*.tsx`/`*.ts`). **이 472가 이 스펙의 유일한 성공-기준 수치다**(§1).
- 상위: `text-primary`(=`--color-text-primary`, 브랜드 아님) ×29, `text-foreground` ×28, `text-primary-600`(브랜드 스케일) ×27, `border-border` ×26, `text-secondary` ×21, `bg-card` ×16, `bg-primary-600` ×13, `bg-primary` ×12.
- **인라인 `var()`는 전 트리에서 단 1곳**: `layout.tsx:64` `bg-[var(--background)] text-[var(--foreground)]`.
- opacity modifier 사용 중(실측 인벤토리): `ring-ring/20` ×6, `ring-danger/20` ×4, `bg-primary/10` ×3, `border-primary/40`, `border-primary/30`, `bg-danger/10`, `bg-surface-hover/50`, `text-success-light-foreground/80`, `shadow-primary/20`, `shadow-primary-500/25`(**스케일 스텝에 opacity**) 등 — 색이 **유효한 Tailwind 색 토큰**이어야 `/NN`이 동작한다. 이 다양한 슬롯-종류(semantic 별칭 / 스케일 스텝 / base surface / light-foreground)를 §13.7이 모두 커버한다.
- **네이밍 충돌**: 유틸 `text-primary`는 텍스트 계층 `--color-text-primary`(#101828)로 해석되며 **브랜드 `--primary`가 아니다**. 브랜드 텍스트는 `text-primary-600`을 쓴다. 두 네임스페이스를 분리 유지해야 한다.

**결론**: `@theme`은 모든 토큰(의미별칭 + primary 25..900 스케일 + base)에 대해 `--color-*`를 계속 방출해야 하며, 아니면 유틸이 **조용히** 깨진다.

---

## 4. 설계 원칙

1. **단일 원천 (Single Source of Truth)** — `tokens.json`만이 색 값의 진실이다. `theme.css`·`variants.ts`는 파생 아티팩트이며 헤더에 `AUTO-GENERATED — DO NOT EDIT`를 단다.
2. **규칙 기반 파생 (Convention over Configuration)** — 고정 6-슬롯이 button/badge/alert/text variant를 결정론적으로 생성한다. 예외는 config의 escape hatch로만 허용한다.
3. **config 주도 (Project-agnostic)** — 프로젝트마다 다른 축(`darkSelector`, `classPrefix`, `colors`, `output`)만 config로 뽑고, 보편 규칙(6-슬롯, 리프 형태)은 패키지에 둔다.
4. **Tailwind-native** — 컴포넌트는 리터럴 유틸리티 문자열을 계속 쓴다. 동적 클래스(`bg-${c}`) 금지 — 스캐너가 못 본다.
5. **다크 1급 (Dark-mode first-class)** — 모든 리프는 `{light, dark}` 형태를 강제한다. 다크는 라이트와 같아도 **타이핑**해야 한다(부트스트랩용 `autoMirrorDark` 완화값 존재).
6. **관용적 CSS 출력 (Idiomatic output)** — 생성 `theme.css`는 **plain `@theme`에 라이트 리터럴을 `--color-*`에 직접** 정의하고, 다크 셀렉터에서 `--color-*`를 오버라이드한다(§7.3). `@theme inline`+`var()` 패스스루 2층 구조는 **채택하지 않는다**(불필요한 인다이렉션·딥 var 체인·오버라이드 대상 모호성을 유발). 최소-diff가 리뷰 목적으로 정말 필요할 때만 **명시적 전환 옵션**으로 inline 형태를 지원한다(§7.5).

---

## 5. 아키텍처 개요

### 5.1 패키지 폴더 구조

```
@blomics-platform/design-system/
├─ package.json               # exports/bin/files/peerDeps
├─ tokens.json                # ★ 단일 원천 (기본 팔레트)
├─ design.config.json         # ★ 기본 config (fortress 매칭 디폴트)
├─ tokens.schema.json         # tokens.json JSON Schema (검증 + 에디터 자동완성)
├─ config.schema.json         # design.config JSON Schema
├─ bin/
│  └─ ds.mjs                  # 제너레이터 CLI (`ds build`, `ds build --check`)
├─ src/                       # 제너레이터 구현 (파서/검증/렌더러)
│  ├─ load.mjs   validate.mjs   resolve-refs.mjs
│  ├─ render-css.mjs   render-variants.mjs   render-dts.mjs
│  └─ atomic-write.mjs
└─ dist/                      # ★ 커밋되어 배포되는 산출물 (prebuilt)
   ├─ theme.css               # @custom-variant + @theme(라이트) + 다크 오버라이드 블록
   ├─ variants.ts             # SEMANTIC_COLORS, *Variants, commonStyles, get*Classes
   ├─ variants.d.ts           # 리터럴 타입 보존
   └─ tokens.manifest.json    # 방출된 var/유틸 전체 목록 (diff/검증용)
```

> **theme.css는 `@import "tailwindcss"`를 담지 않는다**(§7.3, §8.2). Tailwind 진입은 **소비자가 소유**한다.

> **Phase 1 배포 규칙**: `dist/`는 **git 태그에 커밋**되어 배포된다. `file:`/`git+#tag` 설치는 패키지 build를 자동 실행하지 않으므로, dist가 태그에 없으면 소비자는 빈 dist를 받는다(§12 R-DIST). 대안으로 `prepare` 스크립트가 설치 시 build하게 할 수 있으나, Phase 1은 **커밋된 dist**를 채택한다(툴체인 의존 0).

### 5.2 데이터 흐름 (ASCII)

```
                 ┌──────────────────────┐
                 │  tokens.json         │  (색 값: light/dark, 6-슬롯, scale)
                 │  design.config.json  │  (darkSelector, classPrefix, colors, output)
                 └──────────┬───────────┘
                            │  ds build   (load → validate → resolve refs → render → atomic swap)
                            ▼
        ┌───────────────────────────────────────────────┐
        │            generator (bin/ds.mjs)              │
        │  1 LOAD+VALIDATE  2 RENDER(in-memory)  3 SWAP  │
        └───────┬─────────────────────┬──────────────────┘
                ▼                     ▼
        dist/theme.css         dist/variants.ts (+ .d.ts, manifest)
                │                     │
   consumer globals.css        consumer *.tsx
   @import "tailwindcss";       import { getButtonClasses, ColorVariant } from "@blomics-platform/design-system"
   @import ".../theme.css";           │
   @source ".../dist/**";             │
                │                     │
                ▼                     ▼
        Tailwind v4 빌드 (소비자) ──▶ @source가 소비자 JSX + 패키지 dist를 스캔 ──▶ 최종 CSS
```

핵심: 값은 **패키지→theme.css→소비자 CSS**로, 타입/문자열은 **패키지→variants.ts→소비자 JSX**로 흐른다. 두 경로는 독립이며 유일한 결합점은 **다크 셀렉터 텍스트**(config 한 값)다. **`@import "tailwindcss"`와 소비자-src `@source`는 소비자 globals.css가 소유**하고, 패키지 theme.css는 소유하지 않는다(§7.3, §8.2, §8.4).

---

## 6. 토큰 모델 & `tokens.json` 스키마

### 6.1 리프(leaf) 규칙 — DTCG-lite

색 값을 갖는 모든 엔트리는 **정확히 `{light, dark}` 키만 갖는 리프 객체**다. 맨 문자열(bare string)은 금지 — 이것이 "모든 토큰에 다크를 강제 사고"하게 만든다.

- 리프 값 문법: CSS 색 문자열(`#hex`, `rgb()`, `rgba()`, `hsl()`, `oklch()`) **또는** 참조 토큰 `{scales.brand.600}` / `{semantic.brand.base}`.
- 참조는 **같은 모드 내에서** 해석된다(light 참조는 light 램프, dark는 dark 램프) → 다크 별칭이 자동으로 다크 램프를 가리킨다.
- **참조는 섹션 교차·다단(transitive)으로 해석된다**: `base` → `semantic` → `scales`처럼 여러 홉을 타고, 각 홉을 최종 색 리터럴까지 **모드별로** 완전 해석한다. 순환 참조는 **하드 에러**(§7.4).
- `rgba()`도 리프로 허용(예: `surface/overlay`) — 값 타입(hex/alias/rgba)을 제너레이터가 모두 지원한다.

### 6.2 3개 섹션

- **`scales`** (선택): `<color>.<shade>`(`"25".."900"`) 숫자 램프. **primary(brand)의 25..900 heavy 사용**(text-primary-600 ×27, from-primary-500 등)을 보존하기 위해서만 존재. 스케일 없는 semantic 색도 6-슬롯만으로 완전 동작한다.
- **`semantic`** (필수, minProperties≥1): 각 색은 **정확히 6-슬롯**(`base, hover, active, foreground, light, light-foreground`)을 갖는다. 하나라도 빠지면 **하드 에러**(파생 가능성 보장). 색이 특정 슬롯을 갖지 않아야 하면 config `slotOverrides.<color>.omit`으로 **명시적으로** 생략한다(생략 슬롯은 스키마 검증에서 면제). 슬롯 값은 참조 가능(`"active": {"light":"{scales.brand.800}", ...}`).
- **`base`** (선택): 비-semantic 토큰. `"group/name"` 플랫 키(`text/primary`, `surface/hover`). 슬래시는 가독용이며 제너레이터가 `--text-primary` → 유틸 `text-text-primary`로 평탄화(현행 사용과 일치). base 리프는 슬롯 강제 없음.

### 6.3 스케일-백드 semantic (primary 특수성)

primary는 6-슬롯을 **자기 스케일 위의 별칭**으로 두고, 25..900 램프는 별도 `scales` 블록으로 보존한다. 인벤토리상 현재 별칭 값 = 스케일 값이므로 접기(folding)가 무손실이다: `base=600(#2563eb)`, `hover=700`, `active=800`, `light=100`, `light-fg=800`; `foreground`만 자체값(#ffffff). 제너레이터는 **의미 별칭 `--color-primary*` 와 스케일 `--color-primary-25..900` 을 둘 다** 방출해 `text-primary-600`·`from-primary-500`·`bg-primary-50` 사용처를 살린다.

### 6.4 `muted` 처리 — 타입 표면 축소 명시

`muted`는 base+foreground만 있고 filled variant로 쓰인 적이 없다(`bg-muted`, `text-muted-foreground`, `text-muted`). **base/neutral 토큰으로 분류**하며 6-슬롯을 강제하지 않는다(config `slotOverrides.muted.omit`로 나머지 4슬롯 억제, §7.1).

> **⚠️ `ColorVariant` 유니온 8→7 축소(의도적 breaking, 검증 완료)**: 현행 `ColorVariant`는 `primary|secondary|success|warning|danger|info|accent|muted`로 **8 멤버**다(실측). `config.colors`가 muted를 제외해 생성 `SEMANTIC_COLORS`/`ColorVariant`는 **7 멤버**가 되어 `muted`가 빠진다. 이는 순수 additive가 아니라 **타입 표면 축소**다. **안전성 검증**: fortress 전 트리를 grep한 결과 `'muted'`를 `ColorVariant` 값으로 넘기는 곳(예 `getButtonClasses('muted')`, `badgeVariants['muted']`)은 **0건**이며, `ColorVariant` 심볼은 `src/components/ui/index.ts`에서 **재export만** 된다. 따라서 8→7 축소는 **타입체크 안전**하다. §13.11이 "새 `ColorVariant`가 구 유니온의 문서화된 subset임"을 어서트하고, 만약 미래에 `'muted'` 사용처가 생기면 config `colors`에 `muted`를 도로 넣거나 deprecated 멤버로 유지한다.

### 6.5 형식 스키마 (요약, `tokens.schema.json`으로 배포)

```jsonc
{
  "$id": "https://blomics.dev/design-system/tokens.schema.json",
  "type": "object",
  "required": ["semantic"],
  "properties": {
    "meta":     { "$ref": "#/$defs/meta" },
    "scales":   { "type": "object", "additionalProperties": { "$ref": "#/$defs/scaleRamp" } },
    "semantic": { "type": "object", "minProperties": 1,
                  "additionalProperties": { "$ref": "#/$defs/semanticColor" } },
    "base":     { "type": "object", "additionalProperties": { "$ref": "#/$defs/leaf" } }
  },
  "$defs": {
    "leaf": { "type": "object", "required": ["light", "dark"], "additionalProperties": false,
              "properties": { "light": { "$ref": "#/$defs/colorRef" }, "dark": { "$ref": "#/$defs/colorRef" } } },
    "colorRef": { "type": "string", "pattern": "^(#|rgb|rgba|hsl|oklch|\\{).+" },
    "scaleRamp": { "type": "object", "minProperties": 1,
                   "propertyNames": { "pattern": "^[0-9]{2,3}$" },
                   "additionalProperties": { "$ref": "#/$defs/leaf" } },
    "semanticColor": {
      "type": "object",
      "required": ["base","hover","active","foreground","light","light-foreground"],
      "additionalProperties": false,
      "properties": {
        "base": {"$ref":"#/$defs/leaf"}, "hover": {"$ref":"#/$defs/leaf"},
        "active": {"$ref":"#/$defs/leaf"}, "foreground": {"$ref":"#/$defs/leaf"},
        "light": {"$ref":"#/$defs/leaf"}, "light-foreground": {"$ref":"#/$defs/leaf"}
      }
    },
    "meta": { "type": "object",
              "properties": { "autoMirrorDark": { "type": "boolean", "default": false } } }
  }
}
```

> **스키마 vs `slotOverrides.omit`**: 스키마의 `required`는 6-슬롯 **완전본**을 요구하지만, 제너레이터는 검증 단계에서 `config.slotOverrides.<c>.omit`에 나열된 슬롯을 **required 집합에서 제외**한 뒤 검증한다. 즉 secondary는 `omit:["light","light-foreground"]`가 있으면 4-슬롯만으로 통과한다(§7.4의 cross-check).

> **`autoMirrorDark`**: 유일한 완화값. `true`면 리프에서 `dark`를 생략할 수 있고 라이트 값을 복사한다. fortress는 다크 값이 없으므로 이 값으로 **부트스트랩** 가능(동일 다크 엔트리를 손으로 안 쓴다). 기본값 `false`로 그린필드에서는 엄격 유지. **주의**: `autoMirrorDark=true`이면 dark==light가 되어 다크 오버라이드 블록이 라이트와 동일한 값을 갖고 다크 토글이 "색 변화 없음"이 된다 — 이 상호작용은 §9.3·§13.8에서 명시적으로 다룬다.

### 6.6 실제 예시 `tokens.json` (fortress 완전본)

> **이 예시의 위상**: 아래는 **7개 semantic 색 전부 + base 전부**를 concrete하게 보인 **완전한 참조 형태**다. §13.1의 골든 파일은 여기서 시드된다. 단, 이 완전본은 §15 Q2/Q3의 미해결 결정을 **양쪽 다 예시하기 위해** 실 다크 팔레트와 파생 `active`를 함께 담고 있다. **Phase 1 실제 seed는 §15 권고에 따라** `meta.autoMirrorDark=true`로 시작하고 신규 `active`는 `slotOverrides.omit`으로 억제한다(§9.3, §10.3 R-A). 즉 이 절은 "형태의 완전본"이고, seed의 부트스트랩 정책은 §15가 확정한다.

```jsonc
{
  "$schema": "./tokens.schema.json",
  "meta": { "autoMirrorDark": false },   // ← 형태 예시. 실 seed는 §15 Q3에 따라 true로 부트스트랩.

  "scales": {
    "primary": {
      "25":  { "light": "#f5f9ff", "dark": "#0b1220" },
      "50":  { "light": "#eff6ff", "dark": "#0d1a2e" },
      "100": { "light": "#dbeafe", "dark": "#14294a" },
      "200": { "light": "#bfdbfe", "dark": "#1c3a66" },
      "300": { "light": "#93c5fd", "dark": "#2b5490" },
      "400": { "light": "#60a5fa", "dark": "#3f76c4" },
      "500": { "light": "#3b82f6", "dark": "#5b93f0" },
      "600": { "light": "#2563eb", "dark": "#6ea3f5" },
      "700": { "light": "#1d4ed8", "dark": "#8fbaf8" },
      "800": { "light": "#1e40af", "dark": "#b3d1fb" },
      "900": { "light": "#1e3a8a", "dark": "#d6e6fd" }
    }
  },

  "semantic": {
    "primary": {
      "base":             { "light": "{scales.primary.600}", "dark": "{scales.primary.500}" },
      "hover":            { "light": "{scales.primary.700}", "dark": "{scales.primary.400}" },
      "active":           { "light": "{scales.primary.800}", "dark": "{scales.primary.300}" },
      "foreground":       { "light": "#ffffff",              "dark": "#0b1220" },
      "light":            { "light": "{scales.primary.100}", "dark": "{scales.primary.200}" },
      "light-foreground": { "light": "{scales.primary.800}", "dark": "{scales.primary.100}" }
    },

    "secondary": {
      // ★ 아웃라이어: active는 있고 light 쌍은 없다. config.slotOverrides.secondary.omit로 light/light-foreground 생략.
      "base":       { "light": "#f3f4f6", "dark": "#1f2937" },
      "hover":      { "light": "#e5e7eb", "dark": "#374151" },
      "active":     { "light": "#d1d5db", "dark": "#4b5563" },
      "foreground": { "light": "#1f2937", "dark": "#e5e7eb" }
      // light / light-foreground 없음 (omit)
    },

    "success": {
      "base":             { "light": "#10b981", "dark": "#34d399" },
      "hover":            { "light": "#059669", "dark": "#10b981" },
      "active":           { "light": "#047857", "dark": "#059669" },   // ← 신규 파생 (seed에선 §15 Q2에 따라 omit 가능)
      "foreground":       { "light": "#ffffff", "dark": "#052e1f" },
      "light":            { "light": "#d1fae5", "dark": "#0f3d2e" },
      "light-foreground": { "light": "#065f46", "dark": "#a7f3d0" }
    },

    "warning": {
      "base":             { "light": "#f59e0b", "dark": "#fbbf24" },
      "hover":            { "light": "#d97706", "dark": "#f59e0b" },
      "active":           { "light": "#b45309", "dark": "#d97706" },   // ← 신규 파생
      "foreground":       { "light": "#ffffff", "dark": "#1f1500" },
      "light":            { "light": "#fef3c7", "dark": "#3d2f0a" },
      "light-foreground": { "light": "#92400e", "dark": "#fde68a" }
    },

    "danger": {
      "base":             { "light": "#ef4444", "dark": "#f87171" },
      "hover":            { "light": "#dc2626", "dark": "#ef4444" },
      "active":           { "light": "#b91c1c", "dark": "#dc2626" },   // ← 신규 파생
      "foreground":       { "light": "#ffffff", "dark": "#1a0a0a" },
      "light":            { "light": "#fee2e2", "dark": "#3a1414" },
      "light-foreground": { "light": "#991b1b", "dark": "#fecaca" }
    },

    "info": {
      "base":             { "light": "#06b6d4", "dark": "#22d3ee" },
      "hover":            { "light": "#0891b2", "dark": "#06b6d4" },
      "active":           { "light": "#0e7490", "dark": "#0891b2" },   // ← 신규 파생
      "foreground":       { "light": "#ffffff", "dark": "#04222a" },
      "light":            { "light": "#cffafe", "dark": "#0b3a44" },
      "light-foreground": { "light": "#155e75", "dark": "#a5f3fc" }
    },

    "accent": {
      "base":             { "light": "#8b5cf6", "dark": "#a78bfa" },
      "hover":            { "light": "#7c3aed", "dark": "#8b5cf6" },
      "active":           { "light": "#6d28d9", "dark": "#7c3aed" },   // ← 신규 파생
      "foreground":       { "light": "#ffffff", "dark": "#1a0f2e" },
      "light":            { "light": "#ede9fe", "dark": "#2e2148" },
      "light-foreground": { "light": "#5b21b6", "dark": "#ddd6fe" }
    }
  },

  "base": {
    "background":       { "light": "#ffffff", "dark": "#0b0f1a" },
    "foreground":       { "light": "#111827", "dark": "#e5e7eb" },
    "card":             { "light": "#ffffff", "dark": "#111827" },
    "card/foreground":  { "light": "#111827", "dark": "#e5e7eb" },
    "text/primary":     { "light": "#101828", "dark": "#f2f4f7" },
    "text/secondary":   { "light": "#344054", "dark": "#cbd5e1" },
    "text/tertiary":    { "light": "#6b7280", "dark": "#94a3b8" },
    "text/muted":       { "light": "#9ca3af", "dark": "#64748b" },
    "border":           { "light": "#e5e7eb", "dark": "#1f2937" },
    "border/hover":     { "light": "#d1d5db", "dark": "#374151" },
    "input":            { "light": "#e5e7eb", "dark": "#1f2937" },
    "surface":          { "light": "#ffffff", "dark": "#111827" },
    "surface/hover":    { "light": "#f9fafb", "dark": "#1a2232" },
    "surface/active":   { "light": "#f3f4f6", "dark": "#232c3d" },
    "surface/raised":   { "light": "#ffffff", "dark": "#1a2232" },
    "surface/overlay":  { "light": "rgba(0,0,0,0.5)", "dark": "rgba(0,0,0,0.7)" },
    "muted":            { "light": "#f3f4f6", "dark": "#1f2937" },
    "muted/foreground": { "light": "#6b7280", "dark": "#94a3b8" },
    "ring":             { "light": "{semantic.primary.base}", "dark": "{semantic.primary.base}" }
  }
}
```

### 6.7 완전성 체크리스트 (7색 × 슬롯, 문서화된 omit 반영)

seed가 semantic var를 하나도 빠뜨리지 않았음을 사람이 확인하는 표(§13.5가 이를 자동 강제):

| 색 | base | hover | active | foreground | light | light-fg | 생성 var 수 |
|---|---|---|---|---|---|---|---|
| primary | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 6 (+ 스케일 11) |
| secondary | ✅ | ✅ | ✅ | ✅ | omit | omit | 4 |
| success | ✅ | ✅ | ✅* | ✅ | ✅ | ✅ | 6 |
| warning | ✅ | ✅ | ✅* | ✅ | ✅ | ✅ | 6 |
| danger | ✅ | ✅ | ✅* | ✅ | ✅ | ✅ | 6 |
| info | ✅ | ✅ | ✅* | ✅ | ✅ | ✅ | 6 |
| accent | ✅ | ✅ | ✅* | ✅ | ✅ | ✅ | 6 |

`*` = 신규 파생 `active`(Phase 1 seed에서는 §15 Q2에 따라 `omit` 가능 → 그 경우 해당 색 5 var). primary 스케일 11개는 별도. base 토큰(≈21개)은 §13.5가 원본 `:root` 대비 superset임을 별도 강제. **가독성 노트**: `primary`는 스케일-백드 패턴, `danger`는 스케일 없는 6-슬롯 패턴, `secondary`는 "active 유지·light 생략" 패턴 — 세 형태 모두 §7.3 theme.css에 end-to-end로 나타난다. `--ring`은 `{semantic.primary.base}` 참조로 **cross-color/다단 의존성을 인라인하지 않고 보존**한다(2홉: base→semantic→scale, §7.4).

---

## 6.8 스케일 자동 생성 (`$generate`: base hex → 25~900, OKLCH) — 통합 색 엔진

> **동기 (2026-07-08 확정, 사용자)**: `fortress-template-generator`의 "메인색 1개 선택 → 25~900 자동 생성" 역할을 **이 패키지가 흡수**한다. 즉 `@blomics-platform/design-system`이 통합 색 엔진이 되고, 템플릿 스캐폴더는 이 엔진을 소비한다. 스케일을 11개 리프로 손저작하는 대신 base hex 하나로 램프를 만든다.

### 6.8.1 형태 (additive, opt-in)

`scales.<color>`는 **(기존) 명시 11-리프** 또는 **(신규) 생성 디렉티브** 중 하나다. 둘은 혼용 가능(색A는 명시, 색B는 생성).

```jsonc
"scales": {
  "primary": {
    "$generate": {
      "base":   { "light": "#2563eb", "dark": "#6ea3f5" },  // dark 생략 가능 → autoMirrorDark 규칙 적용
      "anchor": 600                                          // base 색이 놓이는 스텝 (기본 600)
    }
  }
}
```

### 6.8.2 파이프라인 위치 — pre-pass (완전 additive)

scale-gen은 **로드 직후, validate 이전의 pre-pass**다(`src/scale-gen.mjs`, 계약: `expandScales(rawTokens, config) -> rawTokens'`). `$generate`를 **명시 11-리프로 전개**한 뒤 기존 파이프라인(validate → resolve-refs → render-css/variants)이 그대로 소비한다. 따라서 다운스트림 모듈은 **무변경**이고, `$generate`를 안 쓰면 파이프라인은 종전과 동일하다.

### 6.8.3 알고리즘 (결정론적, per-mode)

1. **변환**: base hex → OKLCH `(L, C, H)`. sRGB→linear-sRGB→OKLab→OKLCH 표준 변환을 `scale-gen.mjs`에 **내장**한다(런타임 의존 0; 변환 매트릭스는 공개 표준).
2. **고정 L 사다리(11스텝, 기본값)**:
   `{25:0.985, 50:0.970, 100:0.940, 200:0.885, 300:0.805, 400:0.715, 500:0.640, 600:0.575, 700:0.505, 800:0.430, 900:0.355}`
   이어 **anchor 정렬**: `ΔL = base.L − ladder[anchor]`를 모든 스텝 L에 더하고 `[0,1]`로 clamp. → base 색이 **정확히 anchor(600) 스텝**에 위치(무손실 앵커).
3. **H 고정**(전 스텝 동일 색상). **C 감쇠**(아주 밝은 끝만): `L_step ≥ 0.9`인 스텝은 `C_step = base.C × (1 − L_step)/0.1`로 채도 축소(파스텔 과채도 방지), 그 외는 `base.C` 유지. 정확한 채도 곡선/사다리 값은 §15 Q9 튜닝 대상(목표: 현행 fortress blue 스케일과 근사).
4. **출력**: 각 스텝 = `oklch(L C H)` 문자열(Tailwind v4 네이티브; opacity modifier `/NN`은 oklch에서도 `color-mix`로 정상). `config.scaleOutput: "oklch" | "hex"`(기본 `"oklch"`)로 hex(sRGB clamp) 출력도 선택 가능.

### 6.8.4 다크 램프

`base.dark`가 있으면 **동일 사다리를 dark base의 L로 재정렬**해 다크 램프를 생성한다(hue/chroma는 dark base 것). 없으면 `meta.autoMirrorDark` 규칙(라이트 복사)을 따른다. Phase 1 seed는 autoMirrorDark=true이므로 dark base 생략 시 미러.

### 6.8.5 검증 (§13에 태스크로 추가)

- **앵커 무손실**: 생성된 anchor(600) 스텝이 base 색과 **지각적으로 동일**(ΔE00 ≤ 소임계)함을 어서트.
- **결정론**: 같은 입력 → 바이트 동일 출력(램프에 랜덤·시간 요소 없음).
- **단조성**: L이 25→900로 단조 감소, clamp 후에도 스텝 간 L 유일(중복 붕괴 없음)함을 어서트.
- **회귀(선택)**: fortress 현행 blue 스케일 대비 생성 램프의 ΔE 리포트(튜닝 근거, 실패-게이트는 아님).

> **스코프 노트**: scale-gen은 semantic 6-슬롯이 아니라 **numeric 램프**만 만든다. semantic 별칭(base/hover/…)은 종전대로 스케일 스텝을 참조(`{scales.primary.600}`)하거나 자체 리터럴을 쓴다. 즉 이 기능은 §6.3(스케일-백드 semantic)과 직교하며 그 위에 얹힌다.

---

## 7. 제너레이터 설계

### 7.1 `design.config.json` 스키마 (fortress 매칭 디폴트)

config는 **소비자 레포**에 산다(fortress는 자기 것, blomics-web는 다른 것). 제너레이터는 `tokens.json` + `design.config.json`을 읽어 dist를 쓴다.

```jsonc
{
  "$schema": "@blomics-platform/design-system/config.schema.json",

  "classPrefix": "",
  // Tailwind 유틸 프리픽스. "" → bg-primary (fortress 현행). Phase 1은 "" 만 보증(§7.6).
  // 비어있지 않은 prefix의 정확한 규칙(특히 슬래시-평탄화 base 토큰)은 §7.6에서 스코프 아웃.

  "darkSelector": "[data-gnb-theme=\"dark\"]",
  // 다크 값을 켜는 셀렉터. 기본값이 fortress의 @custom-variant 라인 + theme-init.js와 일치.
  // @custom-variant 와 오버라이드 블록 양쪽에 verbatim 방출.

  "darkVariantName": "dark",

  "colors": ["primary", "secondary", "success", "warning", "danger", "info", "accent"],
  // tokens.json의 어떤 semantic 색이 ColorVariant union + variant 계열이 되는지.
  // muted 제외 → ColorVariant 8→7 (§6.4, 검증 완료).
  // tokens.json엔 있으나 여기 없는 색은 CSS var(raw 유틸)는 나오지만 TS variant엔 불참 → 색 스테이징 가능.

  "variantFamilies": ["button", "badge", "alert", "text", "card", "input"],

  "output": {
    "css":      "dist/theme.css",
    "ts":       "dist/variants.ts",
    "dts":      "dist/variants.d.ts",
    "manifest": "dist/tokens.manifest.json"
  },

  "slotOverrides": {
    // escape hatch #1 (토큰 레벨): 색별 6-슬롯 이탈. 여기 나열된 슬롯은 스키마 required에서 면제.
    "secondary": { "omit": ["light", "light-foreground"] },
    "muted":     { "omit": ["hover", "active", "light", "light-foreground"] }
    // (선택) Phase 1 seed에서 §15 Q2에 따라 active 억제 시:
    // "success":{"omit":["active"]}, "warning":{"omit":["active"]}, "danger":{"omit":["active"]},
    // "info":{"omit":["active"]}, "accent":{"omit":["active"]}
  },

  "baseColorEmit": {
    // base 토큰별 @theme --color-* 방출 여부. 기본 true. 현행과 일치시키기 위해 overlay만 false.
    "surface/overlay": false
  },

  "variantOverrides": {
    // escape hatch #2 (variant 레벨): 파생 문자열을 대체/확장. 생성 후 병합, 사람-의도로 마킹.
    "button": {
      "primary-ghost":   "text-primary hover:bg-primary-light hover:text-primary-light-foreground",
      "secondary-ghost": "text-text-secondary hover:bg-secondary",
      "danger-ghost":    "text-danger hover:bg-danger-light hover:text-danger-light-foreground",
      "secondary-outline": "border-2 border-border text-text-secondary hover:bg-secondary"
    },
    "input": {
      "default": "bg-background border border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20",
      "filled":  "bg-muted border border-transparent text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20",
      "outlined":"bg-transparent border-2 border-border text-foreground placeholder:text-muted-foreground focus:border-primary",
      "error":   "bg-background border border-danger text-foreground placeholder:text-muted-foreground focus:border-danger focus:ring-2 focus:ring-danger/20"
    },
    "text": {
      "link": "text-primary hover:text-primary-hover underline"
    }
  },

  "helpers": {
    "button": { "base": "inline-flex items-center justify-center font-medium", "defaultRounded": "lg" },
    "badge":  { "base": "inline-flex items-center font-semibold rounded-full" },
    "input":  { "base": "w-full rounded-lg outline-none" }
  }
}
```

> `design.config.ts`(TS) 변형도 허용 — `satisfies DesignConfig`로 타입체크. 제너레이터가 tsx/esbuild로 로드한다. **왜 config인가**: `darkSelector`·`classPrefix`·`colors`·`output`이 fortress와 형제 프로젝트가 다른 축이다. 나머지(6-슬롯 규칙, 리프 형태)는 보편이므로 패키지에 둔다.

### 7.2 입력/출력 계약

**입력**: `tokens.json` + `design.config.json`(둘 다 소비자 소유; 패키지는 자체 기본본을 dist와 함께 배포).
**출력**: 4개 아티팩트, 각 파일 상단에 `AUTO-GENERATED` 헤더(소스 해시 포함, 타임스탬프 없음 → 재실행 시 spurious diff 없음).

계약 요점:
- **input/card 계열은 색 6-슬롯에서 파생 불가**(focus ring, placeholder, ring/20 opacity, shadow, bg-surface). 이들은 **거의 전적으로 `variantOverrides`가 소유**한다 — 규칙 파생이 아니라 설정 데이터. Phase 1은 이를 수용한다(N5: 생성형 recipe DSL은 over-engineering, §15).
- **아웃라인/고스트 파생과 `text-primary` 네이밍 충돌 규칙(명시)**: outline 파생 규칙 `border-2 border-C text-C hover:bg-C hover:text-C-foreground`에서 **C=primary일 때 `text-primary`는 의도적으로 계층 토큰(`--color-text-primary`, #101828)으로 해석된다** — 이는 **현행 손저작 `primary-outline`과 문자열 바이트 동일**이다(실측: 현행 `'border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground'`). 즉 파생은 primary를 특수 케이스하지 않고 그대로 `text-primary`를 방출하며, 우연이 아니라 **의도적으로 현행과 일치**한다. §13.6이 `primary-outline`/`danger-outline` 파생 문자열이 현행과 바이트 동일함을 어서트한다.

### 7.3 생성물 포맷 (대표 스니펫)

#### FILE 1 — `dist/theme.css` (채택: plain `@theme` + 다크 오버라이드)

생성 `theme.css`는 **관용적 단일-층** 형태다: 라이트 값은 `@theme` 안에서 **`--color-*`에 직접 리터럴**로 정의하고, 다크 셀렉터가 **같은 `--color-*`를 리터럴로 오버라이드**한다. `@theme inline`+`var()` 패스스루 2층 구조는 채택하지 않는다 — 이유는 (1) `--color-*`가 유틸이 실제로 참조하는 **살아있는 오버라이드 대상**이 되어 config-주도/프로젝트-무관 목표에 부합하고, (2) 딥 `var()` 체인이 사라져 opacity `color-mix` no-op 위험(R-OPACITY)이 줄며, (3) R-INLINE 불변식과 전용 lint가 **불필요**해지기 때문이다. `theme.css`는 **`@import "tailwindcss"`를 담지 않는다**(소비자 소유, §8.2). `@source`도 담지 않는다(소비자 소유, §8.4).

primary 스케일(25..900)은 다단 참조 해석의 소스라서, 스케일 스텝도 `--color-primary-25..900`으로 **리터럴** 방출하고 다크 블록에서 리터럴로 오버라이드한다. semantic 별칭 슬롯은 스케일 스텝을 가리키는 대신 **해석된 리터럴을 직접** 방출한다(딥 체인 제거, cross-mode-target 버그 원천 제거 — §7.3 note b 참조).

```css
/* AUTO-GENERATED by @blomics-platform/design-system — DO NOT EDIT. Source hash: <sha>.
   Edit tokens.json / design.config.json and run `ds build`.
   NOTE: 소비자 globals.css가 `@import "tailwindcss";` 를 이 파일 import 위에 두어야 한다. */

@custom-variant dark (&:where([data-gnb-theme="dark"], [data-gnb-theme="dark"] *));

@theme {
    /* ── scales.primary (25..900) — 리터럴 ── */
    --color-primary-25: #f5f9ff; --color-primary-50: #eff6ff; --color-primary-100: #dbeafe;
    --color-primary-200: #bfdbfe; --color-primary-300: #93c5fd; --color-primary-400: #60a5fa;
    --color-primary-500: #3b82f6; --color-primary-600: #2563eb; --color-primary-700: #1d4ed8;
    --color-primary-800: #1e40af; --color-primary-900: #1e3a8a;

    /* ── semantic.primary — 6 슬롯 (참조는 라이트 램프로 해석된 리터럴) ── */
    --color-primary: #2563eb;                 /* {scales.primary.600} 해석 */
    --color-primary-hover: #1d4ed8;
    --color-primary-active: #1e40af;
    --color-primary-foreground: #ffffff;
    --color-primary-light: #dbeafe;
    --color-primary-light-foreground: #1e40af;

    /* ── semantic.secondary — active 유지, light 생략 (slotOverrides) ── */
    --color-secondary: #f3f4f6;
    --color-secondary-hover: #e5e7eb;
    --color-secondary-active: #d1d5db;
    --color-secondary-foreground: #1f2937;

    /* ── semantic.danger (스케일 없는 6-슬롯) ── */
    --color-danger: #ef4444; --color-danger-hover: #dc2626; --color-danger-active: #b91c1c;
    --color-danger-foreground: #ffffff; --color-danger-light: #fee2e2; --color-danger-light-foreground: #991b1b;
    /* … success/warning/info/accent 동형 6-슬롯 (base: success #10b981 / warning #f59e0b / info #06b6d4 / accent #8b5cf6) … */

    /* ── base ── */
    --color-background: #ffffff; --color-foreground: #111827;
    --color-card: #ffffff; --color-card-foreground: #111827;
    --color-text-primary: #101828; --color-text-secondary: #344054;
    --color-text-tertiary: #6b7280; --color-text-muted: #9ca3af;
    --color-border: #e5e7eb; --color-border-hover: #d1d5db; --color-input: #e5e7eb;
    --color-surface: #ffffff; --color-surface-hover: #f9fafb;
    --color-surface-active: #f3f4f6; --color-surface-raised: #ffffff;   /* ← 현행 @theme inline과 동일하게 매핑 */
    --color-muted: #f3f4f6; --color-muted-foreground: #6b7280;
    --color-ring: #2563eb;                    /* {semantic.primary.base}→{scales.primary.600} 2홉 해석된 리터럴 */
    /* 주의: --color-surface-overlay 는 방출하지 않는다(baseColorEmit.surface/overlay=false).
       rgba 값이라 유틸로 노출하지 않는 현행 동작을 재현. §12 R-DBLALPHA 참조. */
}

/* ── DARK OVERRIDES — 같은 --color-* 이름, 다크 리터럴. 모든 유틸이 셀렉터 활성 시 리페인트. ── */
[data-gnb-theme="dark"] {
    --color-primary-25: #0b1220; --color-primary-50: #0d1a2e; --color-primary-100: #14294a;
    --color-primary-200: #1c3a66; --color-primary-300: #2b5490; --color-primary-400: #3f76c4;
    --color-primary-500: #5b93f0; --color-primary-600: #6ea3f5; --color-primary-700: #8fbaf8;
    --color-primary-800: #b3d1fb; --color-primary-900: #d6e6fd;

    --color-primary: #5b93f0;                 /* {scales.primary.500} 다크 해석 */
    --color-primary-hover: #3f76c4;
    --color-primary-active: #2b5490;
    --color-primary-foreground: #0b1220;
    --color-primary-light: #1c3a66;           /* {scales.primary.200} 다크 — light가 다른 스텝을 가리켜도 리터럴이라 안전 */
    --color-primary-light-foreground: #14294a;

    --color-secondary: #1f2937; --color-secondary-hover: #374151;
    --color-secondary-active: #4b5563; --color-secondary-foreground: #e5e7eb;

    --color-danger: #f87171; --color-danger-hover: #ef4444; --color-danger-active: #dc2626;
    --color-danger-foreground: #1a0a0a; --color-danger-light: #3a1414; --color-danger-light-foreground: #fecaca;
    /* … success/warning/info/accent 다크 6-슬롯 … */

    --color-background: #0b0f1a; --color-foreground: #e5e7eb;
    --color-card: #111827; --color-card-foreground: #e5e7eb;
    --color-text-primary: #f2f4f7; --color-text-secondary: #cbd5e1;
    --color-text-tertiary: #94a3b8; --color-text-muted: #64748b;
    --color-border: #1f2937; --color-border-hover: #374151; --color-input: #1f2937;
    --color-surface: #111827; --color-surface-hover: #1a2232;
    --color-surface-active: #232c3d; --color-surface-raised: #1a2232;
    --color-muted: #1f2937; --color-muted-foreground: #94a3b8;
    --color-ring: #6ea3f5;                    /* 다크 2홉 해석 리터럴 — 딥 체인 없음, ring-ring/20 안전 */
}
```

계약 요점:
- **(a)** 유틸이 참조하는 변수는 `--color-*` **자체**다(딥 인다이렉션 없음). 따라서 config-주도 리컬러의 오버라이드 대상이 명확히 `--color-*`이며, opacity `color-mix`는 `var(--color-primary)` 등 **살아있는 색**을 직접 참조한다.
- **(b)** 다크 블록은 **모든 슬롯을 리터럴로 재방출**한다. "dark==light인 슬롯은 스킵" 같은 최적화는 **채택하지 않는다** — 슬롯의 참조 타깃이 모드마다 다를 수 있어(예 light `--color-primary-light`={100}, dark={200}) 스킵 최적화가 **cross-mode 오참조 버그**를 낳기 때문이다. dark==light인 값은 그냥 같은 리터럴을 다시 쓰며, 이는 결정론·검증 단순성(§13.5)을 위해 의도적이다.
- **(c)** `@custom-variant` 라인은 디폴트일 때 **fortress 현행 `globals.css:3`과 바이트 동일** → `dark:` 유틸 무회귀(§13.9).
- **(d)** `--color-ring`은 2홉 참조(`base.ring`→`semantic.primary.base`→`scales.primary.600`)를 **해석된 리터럴**로 방출한다. 라이트/다크 모두 유효 색이므로 `ring-ring/20`(×6)이 양 모드에서 `color-mix`로 정상 컴파일된다(§13.7).

> **왜 plain `@theme`인가 (INLINE TRAP 원천 제거)**: `@theme inline`에 리터럴 색을 넣으면 다크 오버라이드가 무시된다(리서치 경고). 과거 초안은 "inline + `var()` 패스스루"로 이를 우회하려 했으나, 그 형태는 (1) 유틸이 `--color-*`가 아니라 원시 `--primary`를 참조하게 되어 "오버라이드 가능한 런타임 변수"가 `--color-*`가 아닌 원시 네임스페이스가 되는 **혼란한 footgun**을 낳고, (2) `--color-ring`→`var(--ring)`→`var(--primary)`→`var(--primary-600)`→#hex 같은 **4홉 체인**을 만들어 opacity `color-mix`가 조용히 드롭될 위험 표면을 키운다. 채택한 plain `@theme` 형태는 이 두 문제를 **구조적으로 제거**하므로 R-INLINE 불변식과 전용 inline-lint가 **불필요**하다. 최소-diff-to-current가 리뷰용으로 요구되면 §7.5의 전환 옵션(inline)을 명시 플래그로만 사용한다.

#### FILE 2 — `dist/variants.ts`

```ts
/* AUTO-GENERATED by @blomics-platform/design-system — DO NOT EDIT. Source hash: <sha>. */
export const SEMANTIC_COLORS = [
  "primary", "secondary", "success", "warning", "danger", "info", "accent",
] as const;
export type ColorVariant = (typeof SEMANTIC_COLORS)[number];   // 7 members (muted 제외, §6.4)

/* buttonVariants — 6-슬롯에서 색마다 파생:
   filled  = bg-C hover:bg-C-hover active:bg-C-active text-C-foreground   (active 없는 색은 active: 생략)
   light   = bg-C-light text-C-light-foreground hover:bg-C hover:text-C-foreground
   outline = border-2 border-C text-C hover:bg-C hover:text-C-foreground  (C=primary의 text-primary는 계층토큰, §7.2)  */
export const buttonVariants = {
  primary: "bg-primary hover:bg-primary-hover active:bg-primary-active text-primary-foreground",
  secondary: "bg-secondary hover:bg-secondary-hover active:bg-secondary-active text-secondary-foreground",
  success: "bg-success hover:bg-success-hover active:bg-success-active text-success-foreground",
  warning: "bg-warning hover:bg-warning-hover active:bg-warning-active text-warning-foreground",
  danger: "bg-danger hover:bg-danger-hover active:bg-danger-active text-danger-foreground",
  info: "bg-info hover:bg-info-hover active:bg-info-active text-info-foreground",
  accent: "bg-accent hover:bg-accent-hover active:bg-accent-active text-accent-foreground",
  "primary-light": "bg-primary-light text-primary-light-foreground hover:bg-primary hover:text-primary-foreground",
  "success-light": "bg-success-light text-success-light-foreground hover:bg-success hover:text-success-foreground",
  "warning-light": "bg-warning-light text-warning-light-foreground hover:bg-warning hover:text-warning-foreground",
  "danger-light":  "bg-danger-light text-danger-light-foreground hover:bg-danger hover:text-danger-foreground",
  "primary-outline": "border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground",
  "danger-outline":  "border-2 border-danger text-danger hover:bg-danger hover:text-danger-foreground",
  /* ── config.variantOverrides.button (human-authored) ── */
  "primary-ghost":   "text-primary hover:bg-primary-light hover:text-primary-light-foreground",
  "secondary-ghost": "text-text-secondary hover:bg-secondary",
  "danger-ghost":    "text-danger hover:bg-danger-light hover:text-danger-light-foreground",
  "secondary-outline": "border-2 border-border text-text-secondary hover:bg-secondary",
} as const;
export type ButtonVariant = keyof typeof buttonVariants;

export const badgeVariants = {
  primary: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
  danger: "bg-danger text-danger-foreground",
  info: "bg-info text-info-foreground",
  accent: "bg-accent text-accent-foreground",
  "primary-light": "bg-primary-light text-primary-light-foreground",
  "success-light": "bg-success-light text-success-light-foreground",
  "warning-light": "bg-warning-light text-warning-light-foreground",
  "danger-light":  "bg-danger-light text-danger-light-foreground",
  "info-light":    "bg-info-light text-info-light-foreground",
  "accent-light":  "bg-accent-light text-accent-light-foreground",
} as const;

export const alertVariants = {
  /* 파생: bg-C-light text-C-light-foreground border border-C/20 */
  info:    "bg-info-light text-info-light-foreground border border-info/20",
  success: "bg-success-light text-success-light-foreground border border-success/20",
  warning: "bg-warning-light text-warning-light-foreground border border-warning/20",
  danger:  "bg-danger-light text-danger-light-foreground border border-danger/20",
} as const;

export const textVariants = {
  primary:   "text-text-primary",   // 계층 토큰 (브랜드 아님)
  secondary: "text-text-secondary",
  tertiary:  "text-text-tertiary",
  muted:     "text-text-muted",
  success: "text-success", warning: "text-warning", danger: "text-danger",
  info: "text-info", accent: "text-accent",
  link: "text-primary hover:text-primary-hover underline",   // from override
} as const;

export const cardVariants = {
  default:  "bg-card text-card-foreground border border-border",
  elevated: "bg-card text-card-foreground shadow-md",
  outlined: "bg-transparent border border-border",
  filled:   "bg-surface text-foreground",
} as const;

export const inputVariants = {
  /* 전부 config.variantOverrides.input (구조적, 색 파생 불가) */
  default:  "bg-background border border-input text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20",
  filled:   "bg-muted border border-transparent text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20",
  outlined: "bg-transparent border-2 border-border text-foreground placeholder:text-muted-foreground focus:border-primary",
  error:    "bg-background border border-danger text-foreground placeholder:text-muted-foreground focus:border-danger focus:ring-2 focus:ring-danger/20",
} as const;

export const buttonSizes = { xs:"px-2 py-1 text-xs", sm:"px-3 py-1.5 text-sm", md:"px-4 py-2 text-sm", lg:"px-5 py-2.5 text-base", xl:"px-6 py-3 text-lg" } as const;
export const badgeSizes  = { xs:"px-1.5 py-0.5 text-[10px]", sm:"px-2 py-0.5 text-xs", md:"px-2.5 py-1 text-xs", lg:"px-3 py-1 text-sm" } as const;
export const inputSizes  = { sm:"px-3 py-1.5 text-sm", md:"px-4 py-2 text-sm", lg:"px-4 py-3 text-base" } as const;
export const rounded = { none:"rounded-none", sm:"rounded-sm", md:"rounded-md", lg:"rounded-lg", xl:"rounded-xl", full:"rounded-full" } as const;

/* ── commonStyles — 현행 design-tokens.ts 공개 표면 보존 (§10 S3 배럴이 superset 되도록) ── */
export const commonStyles = {
  focusRing: "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  transition: "transition-colors duration-200",
  transitionAll: "transition-all duration-200",
  rounded,                                     // 위 rounded 재사용
  shadow: { none:"shadow-none", sm:"shadow-sm", md:"shadow-md", lg:"shadow-lg", xl:"shadow-xl", "2xl":"shadow-2xl", inner:"shadow-inner" },
} as const;

export function getButtonClasses(
  variant: ButtonVariant = "primary",
  size: keyof typeof buttonSizes = "md",
  options?: { rounded?: keyof typeof commonStyles.rounded; disabled?: boolean },
): string {
  const base = "inline-flex items-center justify-center font-medium"; // config.helpers.button.base
  return [
    base, buttonVariants[variant], buttonSizes[size],
    commonStyles.rounded[options?.rounded ?? "lg"], commonStyles.transitionAll,
    options?.disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
  ].filter(Boolean).join(" ");
}
export function getBadgeClasses(variant: keyof typeof badgeVariants = "primary", size: keyof typeof badgeSizes = "sm"): string {
  const base = "inline-flex items-center font-semibold rounded-full";  // config.helpers.badge.base
  return [base, badgeVariants[variant], badgeSizes[size]].join(" ");
}
export function getInputClasses(variant: keyof typeof inputVariants = "default", size: keyof typeof inputSizes = "md"): string {
  const base = "w-full rounded-lg outline-none";  // config.helpers.input.base
  return [base, inputVariants[variant], inputSizes[size], commonStyles.transition].join(" ");
}
```

계약 요점: **(a)** `SEMANTIC_COLORS`가 union + 모든 계열 루프를 구동 — 색 하나 추가 시 union과 모든 맵이 한 패스로 자란다. **(b)** `variantOverrides`는 계열별로 append되고 사람-저작으로 주석 마킹. **(c)** `as const` + `keyof typeof`로 현행 손수 파일과 **동일한 리터럴-키 자동완성**을 보존. **(d)** **`commonStyles`(focusRing/transition/transitionAll/rounded/shadow)를 반드시 포함** — 현행 `getButtonClasses`/`getInputClasses`가 `commonStyles`에 내부 의존하고, 소비자 코드가 `import { commonStyles }`로 직접 참조하므로(실측), 이를 빠뜨리면 §10 S3 배럴 재export가 superset이 아니게 되어 "JSX 변경 0" 주장이 깨진다.

#### FILE 3 — `dist/variants.d.ts`

`.ts`와 **나란히**(tsc 아님) 방출해 리터럴 문자열 타입이 verbatim 보존된다:

```ts
/* AUTO-GENERATED — DO NOT EDIT. */
export declare const SEMANTIC_COLORS: readonly ["primary","secondary","success","warning","danger","info","accent"];
export type ColorVariant = (typeof SEMANTIC_COLORS)[number];
export declare const buttonVariants: {
  readonly primary: "bg-primary hover:bg-primary-hover active:bg-primary-active text-primary-foreground";
  /* …정확한 리터럴 타입… */
};
export type ButtonVariant = keyof typeof buttonVariants;
export declare const commonStyles: {
  readonly focusRing: "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  readonly transition: "transition-colors duration-200";
  readonly transitionAll: "transition-all duration-200";
  readonly rounded: { /* … */ };
  readonly shadow: { /* … */ };
};
export declare function getButtonClasses(variant?: ButtonVariant, size?: keyof typeof buttonSizes, options?: { rounded?: keyof typeof commonStyles.rounded; disabled?: boolean }): string;
/* …badge/alert/text/card/input 미러… */
```

#### FILE 4 — `package.json`

```jsonc
{
  "name": "@blomics-platform/design-system",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "description": "Config-driven Tailwind v4 design tokens + generated variant helpers.",
  "files": ["dist", "bin", "tokens.schema.json", "config.schema.json"],
  "bin": { "ds": "./bin/ds.mjs" },
  "scripts": {
    "build": "node ./bin/ds.mjs build",
    "check": "node ./bin/ds.mjs build --check"
  },
  "exports": {
    ".":               { "types": "./dist/variants.d.ts", "import": "./dist/variants.ts", "default": "./dist/variants.ts" },
    "./theme.css":     "./dist/theme.css",
    "./tokens":        "./dist/tokens.manifest.json",
    "./config-schema": "./config.schema.json",
    "./tokens-schema": "./tokens.schema.json"
  },
  "peerDependencies": { "tailwindcss": ">=4.1.0" }
}
```

> **peerDep `tailwindcss >=4.1.0`은 하드 최소요건이나 install-시 경고는 약한 가드다**: node_modules `@source` 오버라이드는 v4.1.0(PR #17255)부터 존재한다. 그 미만에서는 `@source`가 있어도 패키지 유틸이 조용히 미생성. **그러나 npm/pnpm/yarn은 미충족 peer를 하드-에러하지 않고 경고만** 하며(쉽게 놓침), 이미 4.0.x가 설치돼 있으면 조용히 지나갈 수 있다 — 정확히 우리가 막으려는 침묵 실패다. 따라서 **peer 경고에 의존하지 않고**, §13.4 스모크의 **빌드-타임 버전 어서트를 1차 가드**로 삼는다(소비자 설치 tailwind 버전을 읽어 <4.1.0이면 빌드 실패). fortress 실측: `package.json`은 `tailwindcss: "^4"`(범위)이나 **resolved lockfile = 4.1.18**이라 안전. 스펙은 `^4` 범위가 아니라 **해석된 4.1.18**을 근거로 안전을 주장한다.
> **`.ts` vs `.js` 배포**: `exports.import`이 `dist/variants.ts`를 직접 가리킨다. Next 16은 node_modules TS를 트랜스파일하므로 Phase 1(fortress-only)엔 충분하고 리터럴-타입 충실도가 최고다. 두 번째 소비자(plain Vite/Jest/ts-node)가 생기면 `dist/variants.js`를 추가 방출하고 `import`→`.js`로 전환하며, **그 시점에 `@source` 글롭과 README를 매니페스트 기반으로 lockstep 재생성**한다(§15 Q4, §8.4).

### 7.4 단일-패스(all-or-nothing) 보장

1. **LOAD + VALIDATE FIRST, WRITE LAST**: (a) `tokens.json`+`design.config.json` 파싱, (b) 스키마 검증 + cross-check:
   - `config.colors`의 모든 색이 `tokens.semantic`에 존재;
   - 각 색이 `slotOverrides.<c>.omit`을 제외한 **모든 required 슬롯**을 가짐(누락 금지);
   - 모든 `{ref}`가 **양 모드에서, 다단·섹션교차로 최종 색 리터럴까지** 해석됨(`base`→`semantic`→`scales` 허용);
   - **참조 그래프에 순환 없음**(있으면 하드 에러);
   - 방출 var 이름 중복 없음.
   **어느 실패든 → 에러 출력, non-zero exit, 아무것도 안 씀.** 기존 dist 무손상 → 소비자는 마지막 정상본으로 계속 빌드.
2. **BUILD ALL IN MEMORY**: 4개 아티팩트를 전부 문자열로 렌더 후 파일 I/O 시작. 렌더 중 버그는 첫 write 전에 throw.
3. **ATOMIC SWAP (디렉터리 rename)**: 4개 산출물을 sibling temp 디렉터리(`dist/.tmp-<pid>/`)에 모두 쓰고 fsync한 뒤, **디렉터리 단위로 `rename()`** 하여 `dist/`를 통째 교체한다. 단일 rename이므로 POSIX atomic이 **파일 간(cross-file) 일관성까지** 보장한다 — theme.css는 새것·variants.ts는 옛것인 중간 상태가 관측되지 않는다. (개별 파일 4회 rename은 파일 간 원자성을 주지 못하므로 채택하지 않는다.) 단, 리더가 old dist 디렉터리 inode를 이미 열고 있으면 그 핸들은 유효하게 유지된다(POSIX 시맨틱). 디렉터리 rename이 불가한 환경 폴백은 §12 R-SWAP에 명시.
4. **DETERMINISTIC ORDER**: 색은 `config.colors` 순, 슬롯은 고정 순, base는 `tokens.json` 키 순 → 바이트 동일 출력 → 깨끗한 diff. `ds build --check`가 재생성 후 diff로 stale dist를 CI에서 실패.
5. **IDEMPOTENT**: 입력 무변경 재실행은 동일 바이트. 헤더는 타임스탬프가 아니라 **소스 해시**만 → spurious diff 없음.

### 7.5 (옵션) 전환용 `@theme inline` 형태 — 기본 아님

리뷰/이관 초기에 **현행 `globals.css`와 최소 diff**가 굳이 필요하면, 제너레이터는 config 플래그 `cssLayering: "inline-passthrough"`로 과거 형태(`:root` 원시 var + `@theme inline` var 패스스루 + 다크 원시 var 오버라이드)를 방출할 수 있다. **이 형태를 쓸 때만** 다음 제약이 활성된다: (1) `@theme inline` 안에 리터럴 색을 절대 넣지 않는다(넣으면 다크 무효), (2) 오버라이드 가능한 런타임 변수는 `--color-*`가 아니라 **원시 `--primary`** 임을 문서화(소비자/툴은 원시 네임스페이스를 타깃), (3) inline-lint(§13.2-opt)로 리터럴 색 부재를 강제. **기본값은 `cssLayering: "plain"`**(§7.3)이며, Phase 1 fortress 이관은 plain으로 진행한다 — 유틸/var 이름이 두 형태에서 동일하고 `:root`/`@theme` 층 구조는 어떤 소비자 JSX도 관측하지 않으므로 "최소 diff" 제약은 CSS 내부에 존재하지 않는다.

---

## 8. 소비 방식

### 8.1 설치 (Phase 1, 레지스트리 없음)

```jsonc
// fortress/package.json
"dependencies": {
  "@blomics-platform/design-system": "git+file:///Users/jang-gyeongtae/BPMG/blomics/design-system#v0.1.0"
  // 로컬 개발 중엔: "file:../design-system"
}
```

커밋된 prebuilt `dist/`가 함께 오므로 **build 스텝 0으로 plain install** 동작. 자기 `tokens.json`을 갖는 소비자는 `npx ds build`로 재생성.

### 8.2 `globals.css` — 소비자가 tailwind import를 소유

**theme.css는 `@import "tailwindcss"`를 담지 않는다.** 소비자가 자기 진입에서 tailwind를 먼저 import하고, 그 다음 패키지 theme.css를 import한다. `@import` 규칙은 CSS 스펙상 **다른 규칙보다 먼저** 와야 하므로 순서가 중요하다.

```css
@import "tailwindcss";                          /* ← 소비자 소유, 반드시 1행 */
@import "@blomics-platform/design-system/theme.css";     /* @custom-variant + @theme(light) + dark 오버라이드 */
@source "./**/*.{ts,tsx}";                      /* (선택) 소비자 앱 src — 자동감지로 보통 불필요 */
@source "../node_modules/@blomics-platform/design-system/dist/**/*.ts";  /* ★ 패키지 유틸 스캔(§8.4) */

/* fortress 고유 extras(스크롤바/.ci-*/html.transitioning 등)는 이 아래에 유지 */
```

왜 소비자가 tailwind를 소유하는가: `@import "tailwindcss"`를 패키지 파일 안에 중첩하면 (1) 소비자가 (자기 `@source`/`@custom-variant` 등록을 위해) tailwind를 또 import할 때 **중복 import**로 preflight/theme 방출이 이중화되고, (2) `@import`가 패키지 파일 기준으로 한 단계 깊이 들어가 버전 민감·미지원 패턴이 된다. **소비자가 1행에서 tailwind를 소유**하는 것이 관용적·검증된 패턴이다.

### 8.3 TS import

```tsx
import { getButtonClasses, badgeVariants, commonStyles, SEMANTIC_COLORS, type ColorVariant }
  from "@blomics-platform/design-system";
```

### 8.4 ★ 가장 중요한 리스크 — Tailwind v4 cross-package 유틸 감지

**문제**: Tailwind v4 자동 콘텐츠 감지는 **기본적으로 `node_modules`를 무시**한다(공식 문서: "except … `node_modules` … `.gitignore` files"). 그래서 패키지의 `variants.ts`에 `"bg-primary hover:bg-primary-hover …"` 리터럴이 있어도 소비자 Tailwind가 스캔하지 않아 **그 유틸의 CSS를 아무것도 생성하지 않는다**. 버튼이 무스타일로 렌더된다. **에러도 경고도 없는 완전 침묵 실패** — 이것이 #1 실패 모드다.

**소유권 분리(중요)**: 소비자-src `@source`와 패키지-dist `@source`는 **모두 소비자 globals.css가 소유**한다. **패키지 theme.css는 어떤 `@source`도 방출하지 않는다** — 이유는 `theme.css`가 `node_modules/@blomics-platform/design-system/dist/`에 살고 Tailwind는 상대 `@source` 글롭을 **그 CSS 파일 위치 기준**으로 해석하므로, 패키지가 방출한 `../src/**`는 소비자 앱이 아니라 **패키지 자신의 `src/`(제너레이터 소스)** 를 가리키기 때문이다. 소비자 src 경로는 패키지가 알 수 없다. 따라서 소비자가 자기 root 기준으로 두 `@source`를 직접 저작한다(§8.2).

**채택 해결책 (defense-in-depth, 두 티어)**:

**Tier 1 (기본, 필수) — 소비자 globals.css의 명시적 `@source`** (§8.2 참조):

```css
@source "../node_modules/@blomics-platform/design-system/dist/**/*.ts";
```

v4.1.0부터 **명시적 `@source`가 node_modules 제외와 .gitignore를 모두 이긴다**(PR #17255). 이것이 idiomatic v4 답이며 출력이 최소(실제 쓰인 클래스만)다. **소비자 tailwindcss >=4.1.0 필수**(§13.4 버전 어서트가 1차 가드).

**canonical `@source` 글롭(단일 확정)**: 오늘 dist가 배포하는 유일한 유틸-소스는 `dist/variants.ts`(**`.ts`만**)이므로 canonical 글롭은 **`dist/**/*.ts`** 다. `{js,mjs,tsx}` 같은 **배포되지 않는 확장자를 광고하지 않는다** — 아무 이득 없이 `.js` 전환 footgun만 부른다. 빌드-타임 어서트가 "광고된 `@source` 확장자 ⊇ 실제 배포 dist 확장자"를 강제한다. §15 Q4에서 `.js`로 전환하면 제너레이터가 매니페스트 기반으로 올바른 글롭을 방출하고 README를 lockstep 재생성한다.

Tier 1 성립 규칙(패키지/제너레이터가 지켜야):
- `variants.ts`는 **완전 정적 클래스 문자열**만. `bg-${color}` 절대 금지 — 스캐너가 보간을 못 본다.
- 클래스 문자열이 plain text로 살아남게 aggressive mangling 금지(일반 ESM 출력이면 안전).
- **`dist/` 안에 `.gitignore`를 배포하지 않는다**(중첩 .gitignore가 재-제외 유발; issues #15452/#16669/#19040).
- `@source` 글롭 확장자를 **실제 배포 확장자(`.ts`)와 일치**시킨다.

**Tier 2 (안전망) — prebuilt `dist/styles.css` 폴백**. `@source`를 못/안 쓰거나 <4.1.0인 소비자용. 패키지 빌드 시 Tailwind를 **패키지 자신의 plain-`@theme` theme.css + variants.ts** 위에 돌려 **컴파일된 유틸 규칙**을 담은 `styles.css`를 함께 배포한다. 규칙은 `var(--color-*)`(§7.3 채택 형태와 **동일 네임스페이스**)를 참조하므로, 소비자가 자기 theme.css를 import해 `--color-*`를 오버라이드하면 **값 리컬러가 여전히 먹는다**. 소비자는 `@import "@blomics-platform/design-system/styles.css"`만.

Tier 2의 **정확한 한계(명시)**:
- Tier 2는 **값 리컬러만 가능하고 표면 확장은 불가**하다. 클래스 표면은 빌드 시점의 **패키지 기본 색 목록에 고정**된다 — 소비자가 `teal`을 추가해도 Tier 2에서는 `bg-teal`이 나오지 않는다(이 경우 Tier 1 필요).
- Tier 2 유틸이 참조하는 변수 네임스페이스는 **`--color-*`** 다(채택한 plain `@theme` 형태와 정렬). 만약 §7.5 inline 전환 옵션을 쓰면 유틸이 `--primary`(원시)를 참조하게 되어 Tier 2와 네임스페이스가 어긋나므로, **Tier 2는 plain 형태에 대해서만 배포**한다.
- Tier 2는 정적 CSS 파일이므로 소비자의 다크 리컬러가 먹으려면 **소비자가 패키지 theme.css의 다크 오버라이드 블록도 함께 import**해야 한다(styles.css 단독으로는 다크 안 뒤집힘).
- 단점: 고정 클래스 표면·큰 CSS — 그래서 **폴백**이지 기본 아님.

**왜 둘 다**: Tier 1은 정확하고 lean하지만 버전 민감한 실패 표면이 실재한다. Tier 2는 오설정이어도 픽셀을 보장한다. "472 사용처가 그대로 동작"이 락된 요건이고 "조용한 미스타일"이 최악이므로 **둘 다 배포하고 config로 선택**한다.

> **주의 — `exports`/`sideEffects`는 도움 안 됨**: Tailwind는 파일시스템 글롭으로 텍스트를 읽지 모듈 그래프를 풀지 않는다. `@source`는 bare 스펙(`@blomics-platform/...`)을 못 받고 **파일시스템 경로**가 필요하다. `exports`는 오직 `theme.css`/`styles.css`의 bare `@import` 해석에만 기여한다. 둘을 혼동하지 말 것.

---

## 9. 다크모드 설계

### 9.1 configurable data-attribute 셀렉터

제너레이터는 **config 한 값(`darkSelector`)에서 두 가지**를 방출한다:

1. **다크 오버라이드 블록**: `[data-gnb-theme="dark"] { --color-primary: …; --color-background: …; … }` — **색을 실제로 뒤집는 것은 이 블록이다.**
2. **`@custom-variant dark (...)`**: `dark:` **유틸 변형**(예: `dark:bg-gray-800`)만 구동. 색은 여기서 안 뒤집힌다.

```
@custom-variant ${variantName} (&:where(${selector}, ${selector} *));
${selector} { /* dark --color-* overrides */ }
```

기본값 `[data-gnb-theme="dark"]`이면 fortress **드롭인**. `.dark` 클래스나 `[data-theme=dark]`로 테마하는 소비자는 config 값만 바꾸고 재생성한다. 셀렉터 텍스트가 유일한 결합점이므로 "config 주도, fortress 하드코딩 아님" 요건을 완전 충족.

### 9.2 light/dark 미러

`tokens.json`의 모든 리프가 `{light, dark}`를 가지므로, `@theme`(라이트)와 다크 블록(다크)이 **동일 `--color-*` 이름**을 서로 다른 리터럴로 정의한다. 유틸은 `--color-*`를 직접 참조하므로 **셀렉터 활성 시 자동 리페인트**된다 — primary 25..900 스케일과 surface 계층을 포함해 **모든** 토큰이 뒤집힌다(현재 갭의 정확한 해소). (surface-overlay는 현행처럼 유틸 미노출이므로 리페인트 대상 아님, §7.3.)

### 9.3 기존 ThemeProvider와의 연결 (변경 없음) & 부트스트랩 정책

- `ThemeProvider.tsx`는 계속 `html.setAttribute('data-gnb-theme', resolved)` + `html.style.colorScheme`을 세팅. **수정 불필요** — 우리가 생성한 셀렉터가 그 속성과 정확히 일치.
- `useTheme.ts`, `store/uiAtom.ts`(themeAtom), `public/scripts/theme-init.js`(FOUC) 전부 **그대로**.
- **기존 `dark:` 유틸(예 `ThemeToggle.tsx`의 `dark:bg-gray-800` ×8)은 `@custom-variant dark` 라인에 의존**하며, 그 라인이 바이트 동일 보존되므로 무회귀(§13.9).
- `.ci-light`/`.ci-dark` 로고 스왑 규칙은 색 오버라이드가 아니라 display 토글이므로 **fortress 로컬 CSS에 유지**(패키지 밖).

**부트스트랩 정책(§13.8과 정합)**: fortress는 다크 값이 없다. **Phase 1 권장은 옵션 (a)** `meta.autoMirrorDark=true`로 다크≈라이트 배선만 먼저 배포하는 것이다. **주의 — autoMirrorDark ↔ 다크블록의 상호작용**: `autoMirrorDark=true`이면 모든 토큰이 dark==light가 되어 **다크 오버라이드 블록은 (모든 슬롯을 리터럴로 재방출하되) 라이트와 동일한 값**을 갖는다. 즉 블록은 비어있지 않지만 **시각적 색 변화는 0**이다. 따라서 이 부트스트랩 모드에서 **§13.8 다크 토글 테스트는 "색이 바뀜"이 아니라 "색이 안 바뀜(그리고 인프라는 배선됨)"을 어서트**하도록 반전한다. 실 다크 팔레트를 저작하는 옵션 (b)를 택하면 §13.8은 정상적으로 "색 변화"를 어서트한다. **§3.3 갭의 "실제 해소 증명"은 옵션 (b) 또는 다크 값 증분 입력 이후에 성립**한다. 이 결정은 §15 Q3에서 확정한다.

> §7.3 note (b)의 "모든 슬롯 리터럴 재방출" 규칙 덕에, autoMirrorDark 모드에서도 다크 블록이 형식적으로 비지 않는다("빈 `{}` 블록" 산출물이 나오지 않음). 다만 값이 라이트와 같아 무-변화일 뿐이다.

---

## 10. fortress 이관 계획 (단계별)

### 10.1 단계

**S0. 패키지 스캐폴드** — `~/BPMG/blomics/design-system`에 §5.1 구조 생성. `tokens.json`을 fortress 현행 `globals.css` `:root` 값에서 1:1 시드(§6.6 형태, seed 정책은 §15: `autoMirrorDark=true` + `active` omit). `design.config.json`을 §7.1 디폴트(darkSelector=`[data-gnb-theme="dark"]`, colors=현행 7색(muted 제외), `slotOverrides.secondary/muted` **필수 포함**)로. `ds build` → dist 생성. `v0.1.0` 태그, dist 커밋.

**S0.5. 사전 인벤토리(이관 전 grep) — 회귀 사각지대 제거**:
- **472 매니페스트**: `*.tsx`/`*.ts`에서 semantic 유틸 발생을 열거해 `class→count` 목록 산출(§13.3 기준선).
- **`dark:` 사용처**: `grep -rn "dark:" src --include=*.tsx --include=*.ts` → 열거(실측 8건, 전부 `ThemeToggle.tsx`의 내장 gray). §13.9가 대표 `dark:` 유틸의 이관 후 컴파일을 어서트.
- **`ColorVariant` / `'muted'`**: `ColorVariant`를 값으로 쓰는 곳과 `'muted'`가 ColorVariant 자리로 전달되는 곳 grep(실측 0건 → 8→7 축소 안전, §6.4).
- **구 `design-tokens.ts` import 심볼 전수**: 배럴이 재export해야 할 심볼 집합 확정(`buttonVariants`/`badgeVariants`/`alertVariants`/`textVariants`/`cardVariants`/`inputVariants`/`*Sizes`/`rounded`/**`commonStyles`**/`getButtonClasses`/`getBadgeClasses`/`getInputClasses`/`ColorVariant`/`SizeVariant`). §13.10이 "배럴 export ⊇ 구 import 심볼"을 강제.

**S1. 패키지 도입** — fortress에 `git+file:…#v0.1.0` 또는 `file:../design-system` 의존성 추가. `npm i`. dist가 node_modules에 존재 확인.

**S2. `globals.css` 교체** — 현행 `:root` + `@theme inline` + `@custom-variant` 블록 전체를 다음으로 대체:
```css
@import "tailwindcss";                          /* 소비자 소유, 1행 유지 */
@import "@blomics-platform/design-system/theme.css";
@source "../node_modules/@blomics-platform/design-system/dist/**/*.ts";
```
fortress 고유 스크롤바/`.ci-*`/`html.transitioning`/`body{}` 규칙은 import 아래 유지. **주의**: 현행 `body{}`는 `var(--background)`(원시)를 참조하는데, 채택한 plain `@theme` 형태는 원시 `--background`가 아니라 `--color-background`를 방출한다 → **이 한 곳은 `var(--color-background)`로 수정**(또는 `bg-background`/`@apply` 대체)해야 한다(§10.3 R-E, §13.3 시각 회귀로 검출).

**S3. `design-tokens.ts` 교체** — `src/lib/utils/design-tokens.ts`를 re-export 배럴로 대체:
```ts
// src/lib/utils/design-tokens.ts  (얇은 배럴, 점진 마이그레이션용)
export * from "@blomics-platform/design-system";   // buttonVariants/…/commonStyles/get*Classes/ColorVariant 전부 re-export
```
배럴이 구 파일의 **모든** 공개 심볼(특히 `commonStyles`, §7.3 FILE2)을 superset 해야 `import { commonStyles } from "@/lib/utils/design-tokens"` 사용처가 그대로 산다 → **JSX/컴포넌트 변경 0**. `SizeVariant`처럼 패키지가 방출하지 않는 순수-타입 심볼이 있으면 배럴에서 로컬 재선언(§13.10이 누락을 검출). 이후 여유 있게 import 경로를 패키지로 코드모드.

**S4. 검증** — §13 전략 실행: 생성물 스냅샷, 472 유틸 매니페스트 대비 시각 회귀, per-token 완전성 게이트, 타입체크, `dark:` 보존, 다크 토글 스모크(부트스트랩 모드에 맞춰 반전).

### 10.2 매핑 표 (기존 토큰 → 신규)

값과 유틸 이름은 **전부 동일**(최소 diff 설계). 바뀌는 것은 "어디서 정의되는가" + "`--color-*`가 곧 오버라이드 대상"이라는 층 구조다.

| 기존 (globals.css / design-tokens.ts) | 신규 (tokens.json 경로) | 유틸(불변) | 비고 |
|---|---|---|---|
| `:root --primary-25..900` | `scales.primary.25..900` | `bg-primary-600`, `from-primary-500`, … | 스케일 보존, `--color-primary-*` 리터럴 |
| `--primary` = `var(--primary-600)` | `semantic.primary.base` = `{scales.primary.600}` | `bg-primary` | 별칭 무손실(해석 리터럴) |
| `--primary-hover/active/foreground/light/light-foreground` | `semantic.primary.{hover,active,foreground,light,light-foreground}` | `bg-primary-hover`, `bg-primary-active`, … | 그대로 |
| `--secondary{,-hover,-active,-foreground}` | `semantic.secondary.{base,hover,active,foreground}` | `bg-secondary`, `active:bg-secondary-active`, … | `light`/`light-fg`는 `slotOverrides.omit` (★ active 유지·light 생략) |
| `--success/warning/danger/info/accent{,-hover,-foreground,-light,-light-foreground}` | `semantic.<c>.{base,hover,foreground,light,light-foreground}` | 그대로 | **`active` 신규 파생**(seed에서는 §15 Q2에 따라 omit) |
| `--muted{,-foreground}` | `base.muted`, `base.muted/foreground` | `bg-muted`, `text-muted-foreground` | base로 재분류, `slotOverrides.omit`; **`ColorVariant`에서 제거(8→7)** |
| `--background/foreground/card/card-foreground` | `base.{background,foreground,card,card/foreground}` | `bg-card`, `text-foreground`, … | 그대로. `body{}`는 `var(--color-background)`로 조정(§10.1 S2, R-E) |
| `--border/border-hover/input` | `base.{border,border/hover,input}` | `border-border`, `border-input` | 그대로 |
| `--ring` = `var(--primary-600)` | `base.ring` = `{semantic.primary.base}` | `ring-ring`, `focus:ring-ring/20` | 2홉 참조 → 해석 리터럴(딥 체인 제거) |
| `--text-primary/secondary/tertiary/muted` | `base.text/{primary,secondary,tertiary,muted}` | `text-text-primary`(=util `text-primary`) | **네이밍 충돌 유지** |
| `--surface{,-hover,-active,-raised,-overlay}` | `base.surface{,/hover,/active,/raised,/overlay}` | `bg-surface`, `bg-surface-hover`, `bg-surface-active`, `bg-surface-raised` | overlay만 `@theme` 미방출(현행 동일) |
| `buttonVariants`/…/`commonStyles` (손수) | 6-슬롯 파생 + `variantOverrides` + `commonStyles` 재방출 | — | 파생 = 손수와 문자열 동일; `commonStyles` 보존 |

> **네이밍 유지 결정 (open question 해소)**: fortress `tokens.json`의 색 키를 **`primary`로 유지**한다. `brand`로 표준화하면 `bg-primary` 등 유틸이 깨진다. `primary→brand` 리네임은 별도 코드모드로 이후 처리(§15).

### 10.3 위험 (이관 특정)

- **R-A. `active` 신규값 시각 변화**: success/warning/danger/info/accent에 `active`가 새로 생기면 `buttonVariants.<c>`가 `active:bg-<c>-active`를 얻어 **버튼 press 시 색이 달라진다**. 완화: **Phase 1 seed는 §15 Q2 권고대로 `slotOverrides.<c>.omit:["active"]`로 억제**해 라이트 픽셀 동일 유지(무회귀 이관). 이후 별도 PR에서 derive-and-review.
- **R-B. `secondary`/`muted` omit 누락 시 검증 실패**: 이 두 색에 `slotOverrides.omit`을 config에 넣지 않으면 6-슬롯 필수 검증이 하드 에러. → S0에서 config에 반드시 포함.
- **R-C. `@source` 누락**: S2에서 `@source` 한 줄을 빠뜨리면 패키지 유틸이 조용히 미생성(§8.4, §12). → S4 스모크에서 sentinel 유틸로 검출.
- **R-D. surface 계층 `@theme` 방출(현행 실측 정정)**: **현행 `globals.css`는 `--color-surface`, `--color-surface-hover`, `--color-surface-active`, `--color-surface-raised`를 모두 `@theme inline`에 매핑하고 있으며(실측 globals.css:191–194), `--color-surface-overlay`만 미매핑**(rgba, `:root`에만). 과거 초안의 "일부만 매핑" 서술은 **오류**였다. 제너레이터 config는 `surface/surface-hover/surface-active/surface-raised`에 대해 `--color-*`를 **방출**하고 `surface/overlay`만 `baseColorEmit=false`로 **생략**한다(§7.1). 이로써 현행 동작을 정확히 재현.
- **R-E. `body{}`의 원시 var 참조**: 현행 `body{}`가 `var(--background)`(원시)를 참조하나 plain 형태는 원시 `--background`를 방출하지 않는다 → `var(--color-background)`로 조정(§10.1 S2). §13.3 시각 회귀로 검출.

---

## 11. "색 하나 추가" 워크플로

### 11.1 Before (현행, 6곳+)

새 색 `teal`을 추가하려면: (1) `:root` 라이트 5줄, (2) 다크 블록 5줄(현재는 블록 자체가 없어 신설), (3) `@theme inline` `--color-teal*` 5줄, (4) `buttonVariants`, (5) `badgeVariants`, (6) `alertVariants`/`textVariants`, (7) `ColorVariant` union 수기 추가 → **최소 6파일 위치, 사람 손 동기화, 다크/슬롯 누락이 조용히 발생.**

### 11.2 After (tokens.json 1곳 + 명령)

**STEP 1 — `tokens.json` 편집(유일 색 파일)**:
```jsonc
"semantic": {
  "teal": {
    "base":             { "light": "#14b8a6", "dark": "#2dd4bf" },
    "hover":            { "light": "#0d9488", "dark": "#14b8a6" },
    "active":           { "light": "#0f766e", "dark": "#0d9488" },
    "foreground":       { "light": "#ffffff", "dark": "#042f2c" },
    "light":            { "light": "#ccfbf1", "dark": "#0f3d38" },
    "light-foreground": { "light": "#115e59", "dark": "#99f6e4" }
  }
}
```
6-슬롯이 필수라 **스키마가 다크 hover 누락을 거부** → 잊을 수 없다.

**STEP 2 — `design.config.json`에 등록**: `"colors": [..., "teal"]` (생략하면 CSS var + raw `bg-teal`은 나오되 union/variant엔 불참 — 의도적 2-스텝 게이트).

**STEP 3 — 생성(단일 명령)**: `npx ds build` → `theme.css`에 `@theme`+다크 양쪽 `--color-teal*`; `variants.ts`에 `SEMANTIC_COLORS`/`buttonVariants`/`badgeVariants`/`alertVariants`/`textVariants` 전반에 `teal`; `variants.d.ts` 리터럴 타입 갱신. **추가 편집 0.**

**STEP 4 — 사용(이미 타입 안전)**:
```tsx
<button className={getButtonClasses("teal")}>…</button>
<span className="bg-teal-light text-teal-light-foreground">…</span>
```

> Before 6곳 수기·동기화 위험 → After **1 JSON 편집 + 1 명령**, all-or-nothing(디렉터리 rename)으로 CSS/TS 불일치 중간 상태 없음.

---

## 12. 엣지케이스·위험·완화

| ID | 위험 | 영향 | 완화 |
|---|---|---|---|
| **R-SCAN** | cross-package 감지 누락(`@source` 없음/오설정) | 패키지 유틸 CSS 0개, **완전 침묵**, 버튼 무스타일 | Tier1 `@source`(소비자 소유, canonical `dist/**/*.ts`) 필수 + Tier2 `styles.css` 폴백 + sentinel 유틸 `.ds-installed` + §13.4 버전 어서트 |
| **R-VER** | 소비자 tailwindcss <4.1.0 | node_modules `@source` 오버라이드 부재 → 유틸 미생성 | **빌드-타임 버전 어서트가 1차 가드**(§13.4); peerDep `>=4.1.0`은 보조(경고만이라 약함). fortress resolved=4.1.18 |
| **R-OPACITY** | `bg-primary/50`류가 non-color/딥체인으로 no-op | opacity 유틸 조용히 드롭 | plain `@theme`로 유틸이 `--color-*` **직접** 참조(딥 체인 제거). 모든 슬롯/스케일/base가 라이트·다크 양쪽 유효 색. alpha를 토큰에 굽지 않기 |
| **R-DBLALPHA** | alpha 내장 토큰(surface-overlay)을 유틸로 노출 시 opacity modifier와 이중 적용 | `bg-surface-overlay/50` = 0.5×0.5 | surface-overlay는 `@theme` 미방출(유틸 없음) 유지. §15 Q7에서 노출 결정 시 **fully-opaque 저장 + modifier로만 alpha** 규칙 |
| **R-SCALE** | primary 25..900 다크 오버라이드 누락 | 스케일 유틸이 다크에서 라이트값 | 스케일 스텝도 `@theme`+다크 양쪽 **리터럴** 방출(§7.3). 다단 참조는 해석 리터럴로 접힘 |
| **R-EDIT** | 생성 파일 수기 편집으로 divergence | 재생성 시 손수 변경 유실 | `AUTO-GENERATED` 헤더 + `ds build --check` CI 게이트(재생성 diff=0 아니면 실패) |
| **R-CONFIG** | config 기본값 어긋남(darkSelector 오타/colors 누락) | 다크 안 뒤집힘/색 variant 누락, 침묵 | 기본 config를 fortress 매칭으로 배포; `--check` + 시각 회귀; darkSelector를 `@custom-variant` 라인과 **바이트 비교** |
| **R-DIST** | `file:`/`git+#tag` 설치가 build 미실행 → 빈 dist | `@source`가 아무것도 못 찾음 | dist를 **태그에 커밋**(Phase 1 채택) 또는 `prepare` 스크립트 |
| **R-DUAL** | 두 현행 위치(:root/design-tokens.ts)가 완전 대체 안 됨 | 손수본·생성본 drift | S2/S3에서 원본 삭제/배럴 대체; `--check`로 drift 감지 |
| **R-VARIANT-DUAL** | `@custom-variant`만 or 다크 블록만 방출 | `dark:` 유틸은 되나 색 안 뒤집힘(혹은 반대) | 제너레이터가 **둘 다** 방출, 단일 config 셀렉터 구동 |
| **R-SURFACE** | dropped 무-JSX 토큰(surface-active/raised)이 시각 회귀에 안 잡힘 | seed 누락이 영원히 통과 | §13.5 완전성 게이트: **live globals.css `:root` 대비 superset** 강제(골든 대비 아님) |
| **R-SYMBOL** | `commonStyles` 등 구 표면이 생성물에서 누락 | 배럴 재export 깨짐, `import { commonStyles }` 실패 | §13.10: 구 `design-tokens.ts` import 심볼 전수 grep → 배럴 superset 어서트; `commonStyles` 생성물 포함(§7.3) |
| **R-SWAP** | 디렉터리 rename 불가 환경 | 원자적 스왑 실패 | 폴백: 개별 파일 temp+rename(파일 원자성만 보장, cross-file 일관성은 best-effort). 러닝 워처 대상 `ds build` 회피 권고 |
| **R-DARKATTR** | 이관 후 기존 `dark:` 유틸 미컴파일 | `ThemeToggle` 등 다크 스타일 소실 | `@custom-variant` 바이트 동일 보존 + §13.9 대표 `dark:` 유틸 컴파일 어서트 |

---

## 13. 테스트 & 검증 전략

1. **생성물 스냅샷 (골든 파일)**: 고정 픽스처 `tokens.json`+`config` → `ds build` → `theme.css`/`variants.ts`/`.d.ts`/`manifest`를 커밋된 골든과 바이트 비교. `ds build --check`가 CI에서 stale dist를 실패(idempotent·deterministic 덕에 안정).
2. **(옵션) INLINE 트랩 lint**: §7.5 inline 전환 형태를 쓸 때만 활성 — 생성 `theme.css`의 `@theme inline` 블록에 리터럴 색(`#`/`rgb`/`oklch`) 부재를 어서트. **채택된 plain `@theme` 기본 형태에서는 inline 블록 자체가 없으므로 이 lint가 불필요**하다.
3. **fortress 시각 회귀 (472 매니페스트 기준)**: S0.5에서 만든 `class→count` 매니페스트를 기준으로 주요 화면(대시보드/커뮤니티/폼/버튼·뱃지·얼럿 팔레트)을 라이트/다크 스크린샷. 기준선은 **이관 직전** fortress. `active` 슬롯을 omit한 seed에서는 라이트가 **픽셀 동일**해야 한다(무회귀 증명). `body{}` `var(--color-background)` 조정(R-E)도 여기서 검출.
4. **cross-package + 버전 스모크**: 깨끗한 소비자(임시 Next 앱)에 설치 → (a) `@source` 있음/없음 두 케이스로 `bg-primary` 생성/미생성 확인(R-SCAN 재현), (b) **소비자 tailwind resolved 버전을 읽어 <4.1.0이면 빌드 실패**(R-VER 1차 가드). sentinel `.ds-installed` 유틸 존재로 설치 성공 시각 확인.
5. **per-token 완전성 게이트 (live 소스 대비)**: **현행 `globals.css`를 파싱**해 `:root`의 전체 `--*` 이름 집합을 추출하고, 생성 `theme.css`의 `@theme` 방출이 그 **superset**(문서화된 리네임 `text/primary`→`--color-text-primary`, 그리고 의도적 미방출 `surface-overlay` 제외)임을 어서트. 추가로 **다크 블록이 light≠dark인 모든 토큰을 커버**함을 어서트. **골든이 아니라 live globals.css를 원천**으로 삼아 lossy seed(예: JSX 사용 0인 `surface-active`/`surface-raised` 누락)를 S0에서 잡는다(R-SURFACE).
6. **"색 추가" 스모크 + 파생 문자열 동치**: §11 워크플로 자동화(`teal` 주입 → 빌드 → `theme.css`/`variants.ts`/`getButtonClasses("teal")` 어서트). 추가로 **`primary-outline`/`danger-outline` 파생 문자열이 현행 손저작과 바이트 동일**임을 어서트(§7.2, §10.2 "파생=손수" 검증). `text-primary`가 C=primary outline에서 계층 토큰으로 해석됨을 명시 확인.
7. **opacity 검증 (슬롯-종류 전수 × 양 모드)**: 빌드 산출 CSS + `getComputedStyle`로 **각 값-종류/슬롯-종류마다** `/NN`이 `color-mix(... var(--color-*) NN% ...)`로 유효 색 위에 컴파일됨을 확인 — semantic 별칭(`bg-primary/10`), 스케일 스텝(`shadow-primary-500/25`), base 토큰(`bg-surface-hover/50`), light-foreground 슬롯(`text-success-light-foreground/80`), 그리고 ring 2홉 체인(`ring-ring/20`). **각 어서션을 라이트·다크 두 스코프에서** `getComputedStyle`로 실행(빌드-타임 grep만이 아님). ring이 다크에서도 유효 색으로 해석됨을 특히 확인(§7.3 (d)).
8. **다크 토글 스모크 (부트스트랩 모드 정합)**: `html[data-gnb-theme]` light↔dark 토글. **옵션 (b)(실 다크 팔레트)** 이면 `--color-background`/`--color-primary`가 실제로 바뀜을 어서트(§3.3 갭 해소 증명). **옵션 (a)(autoMirrorDark 부트스트랩)** 이면 **색이 안 바뀜 + 인프라 배선됨**(셀렉터 활성/`dark:` 변형 매칭)을 어서트(§9.3). 두 모드가 서로 모순되지 않도록 테스트가 seed 정책을 읽어 분기.
9. **`dark:` 유틸 보존**: 생성 `@custom-variant` 라인이 `globals.css:3`과 **바이트 동일**함 + S0.5에서 열거한 대표 `dark:` 유틸(예 `dark:bg-gray-800`)이 이관 후에도 컴파일됨을 어서트(R-DARKATTR). 사용처가 있으므로 live 의존 검증.
10. **심볼 표면 완전성(배럴 superset)**: S0.5의 구 `design-tokens.ts` import 심볼 집합에 대해 `@blomics-platform/design-system` 배럴(+로컬 재선언)이 **모두** 제공함을 어서트 — 특히 `commonStyles`(및 `.focusRing`/`.transition`/`.transitionAll`/`.rounded`/`.shadow`), `getInputClasses`, `SizeVariant`(로컬). 누락 시 실패(R-SYMBOL).
11. **타입 체크 + ColorVariant subset**: `tsc --noEmit`으로 리터럴 키 자동완성 동등성 보장. 신 `ColorVariant`(7)가 구(8)의 **문서화된 subset**(muted 제거)임을 어서트하고, `'muted'`를 ColorVariant 자리에 넘기는 사용처가 0임을 grep으로 재확인(§6.4).

---

## 14. Phase 2 (범위 밖, 향후) — 스케치만

> 이 절은 **설계하지 않는다**. 방향만 남긴다.

- **레지스트리 발행**: `@blomics-platform/design-system`을 GitHub Packages(또는 private npm)에 퍼블리시. `.npmrc` 스코프 라우팅, CI 발행 토큰, `publishConfig`.
- **버전 릴리스**: semver 정책(토큰 값 변경=patch/minor, 슬롯/키 제거=major), Changesets류로 체인지로그·태깅·범프 자동화. 브레이킹 체인지(색 리네임 등) 마이그레이션 가이드.
- **형제 확산**: `blomics-web`/`event`/`molepgames`가 각자 `tokens.json`+`design.config.json`으로 소비. 프로젝트별 `darkSelector`/`classPrefix` 차이는 이미 config로 흡수됨. 공통 팔레트 vs 프로젝트 오버레이 전략.
- **컴포넌트 계층(N4 후속)**: variant 문자열을 넘어 React 컴포넌트(Button/Badge)까지 패키지화할지 별도 결정.

---

## 15. 미해결 질문 (권고 + §6.6 예시와의 정합 메모)

> **§6.6과의 정합**: §6.6 canonical 예시는 "형태 완전본"이라 실 팔레트/파생 active를 담지만, **Phase 1 seed는 아래 Q2/Q3 권고를 따른다**(예시 헤더에 명시). 예시가 결정을 선점하지 않도록 이 관계를 §6.6 상단에 못박았다.

1. **primary vs brand 네이밍**: fortress는 `primary` 유지(무료·무회귀) 확정. 패키지 기본 팔레트를 `brand`로 갈지, `meta.aliases:{primary:brand}`로 동시 방출(브리지)할지는 이후. **권장: Phase 1 fortress `primary` 유지, 리네임은 코드모드.**
2. **`active` 부트스트랩 정책 (R-A)**: **권장(확정): Phase 1 seed는 `slotOverrides.omit:["active"]`로 억제**해 무회귀 이관 → 별도 PR에서 derive-and-review. (§6.6 예시는 파생을 보이지만 seed는 omit.)
3. **다크 팔레트 부트스트랩 (§9.3)**: **✅ 결정됨 (사용자 확정 2026-07-08): `autoMirrorDark=true`로 배선만 먼저**(다크 토글 "동작하되 색 변화 없음"). 실제 다크 팔레트는 디자인 합의 후 별도 PR로. §13.8이 이 모드에서 "무-변화"를 어서트하도록 정합됨. (§6.6 예시는 실 다크 팔레트를 보이나 seed는 미러.) 이 결정에 따라 **Q2 `active` omit도 확정**(무회귀 라이트 이관).
4. **`.ts` vs `.js` 배포 (§7.3 FILE4)**: Phase 1은 `.ts` 직수출. 두 번째 소비자 등장 시 `.js`+`.d.ts` 전환 + `@source` 글롭/README lockstep 재생성이 트리거.
5. **Tier 2 `styles.css` 상시 배포 여부**: 상시(안전, 용량↑) vs config 플래그. fortress는 Tier1로 충분하나 형제 확산 대비 상시가 나을 수 있음. plain `@theme` 형태에 한해 배포(§8.4).
6. **input/card recipe DSL (N5)**: Phase 1은 `variantOverrides` 정적 문자열(권장). override가 늘면 생성형 recipe DSL 임계 재검토.
7. **`surface-overlay` 유틸 노출**: 현행처럼 `@theme` 미방출(유틸 없음) 유지 vs `--color-surface-overlay` 방출. **노출 시 double-alpha 주의**(R-DBLALPHA): rgba alpha가 내장돼 있으므로 노출하려면 **fully-opaque로 저장하고 alpha는 modifier로만** 적용. 사용처 없어 기본은 미노출.
8. **소비자 로컬 재생성 위치**: 커밋된 기본 dist + `ds` bin 노출(권장). 커스텀 `tokens.json` 소비자의 build 훅 위치(수동 `npx ds build` vs postinstall/prebuild)는 문서화 필요.

9. **스케일 생성 사다리·채도 곡선 튜닝 (§6.8, R-A)**: 기본 L 사다리/채도 감쇠는 현행 fortress blue 스케일과 근사하도록 잡았으나, 정확값은 튜닝 대상. **권장: Phase 1은 기본 사다리로 생성하되, primary는 당분간 명시 스케일(현행 hex) 유지**하고 `$generate`는 신규 색부터 적용 → 무회귀. 사다리 확정 후 primary도 `$generate`로 전환. `scaleOutput` 기본은 `oklch`(hex 필요 소비자만 전환).

### 검증 근거 부록 (실측 grep 결과)

- `commonStyles`(focusRing/transition/transitionAll/rounded/shadow) 실재 + `getButtonClasses`/`getInputClasses`가 내부 의존: `src/lib/utils/design-tokens.ts:177-179, 215-262`.
- `dark:` JSX 사용처 8건, 전부 `src/components/shared/ThemeToggle.tsx`(내장 gray).
- `ColorVariant` = 8 멤버(muted 포함), 값으로 `'muted'` 전달 0건, 심볼 재export는 `src/components/ui/index.ts:27`.
- surface 계층 `@theme inline` 매핑: `--color-surface/-hover/-active/-raised` 모두 매핑(`globals.css:191-194`), `--color-surface-overlay`만 미매핑(`:root`의 `globals.css:102`).
- tailwind 핀 `^4`(package.json), resolved 4.1.18.
- `@custom-variant dark (...)` = `globals.css:3`.