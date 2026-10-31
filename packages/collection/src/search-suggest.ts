// @mvos/collections — 검색어 → 구조화 필터 제안(자동완성 엔진).
//
// 왜 스키마에서 파생하는가:
//   "부평" 을 쳤을 때 무엇을 제안할 수 있는지는 **그 컬렉션의 컬럼이 이미 알고 있다**.
//   주문에는 출발지·서비스구역이 있고 플래너에는 이름·연락처가 있다. 화면마다 제안 목록을
//   손으로 적으면 컬럼이 하나 늘 때마다 세 화면을 따라 고쳐야 하고, 실제로는 안 고쳐서
//   "표에는 있는데 검색은 모르는 컬럼" 이 남는다. 그래서 규칙은 `PropertyDef` 에서만 나온다.
//
// **검증기는 완성형이 아니라 접두(prefix) 검증기다.**
//   `010` 은 유효한 전화번호가 아니다. 완성형으로 검증하면 다 치고 난 뒤에야 제안이 뜨는데,
//   그건 자동완성이 아니라 사후 확인이다. 그래서 모든 규칙이 묻는 것은 "이것이 유효한가" 가
//   아니라 **"이것이 이 속성으로 자라날 수 있는가"** 다.
//
// **판정은 비동기 단일 시그니처다.**
//   서비스 구역처럼 값 집합을 코드가 모르는 컬럼은 실제로 조회해 봐야 안다(API 콜).
//   내장 규칙(즉답)과 조사형 규칙(API)을 다른 모양으로 두면 호출부가 경로를 둘로 나눠야 하므로,
//   전부 Promise 로 통일하고 즉답 가능한 것은 그냥 즉시 resolve 한다. 대신 호출부(useSearchSuggest)가
//   **즉답을 기다리지 않고 먼저 그리고**, 늦게 오는 것만 끼워 넣는다.

import { isExplicitDateTerm, parseDateTerm } from './date-term'
import { normalizeOptions } from './options'
import { ME_LABEL, ME_VALUE } from './relative-value'

import type { FilterOp, PropertyDef, PropertyType, PropertyValue } from './types'

/**
 * 이 낱말이 이 속성일 가능성.
 *  - `strong`: 형태가 이 속성을 가리킨다(`010…` → 전화, `오늘` → 날짜, 옵션 라벨 일치).
 *  - `weak`:   가능은 하지만 근거가 약하다(아무 텍스트나 부분일치하는 text 컬럼).
 *  - `none`:   불가능. 제안하지 않는다.
 * 정렬에만 쓰이며 `none` 은 목록에서 빠진다 — 노이즈를 거르는 지점이 여기다.
 */
export type SuggestStrength = 'strong' | 'weak' | 'none'

/** 제안이 필터 트리에 넣을 조건 하나. */
export type SuggestionCondition = { key: string; op: FilterOp; value: PropertyValue }

/**
 * 제안 하나 — 고르면 `conditions` 가 통째로 필터 트리에 들어간다.
 *
 * **조건이 배열인 이유**: `이번 주` 같은 범위는 시작·끝 두 조건이 한 쌍으로 있어야 뜻이
 * 성립한다. `≥ 월요일` 만 넣으면 "이번 주" 가 아니라 "이번 주부터 영원히" 다.
 *
 * 표시 조각(propertyLabel·opLabel·valueLabel)을 엔진이 만든다 — 연산자를 사람 말로 옮기는
 * 어휘가 UI 로 새면 화면마다 달라진다.
 */
export type SearchSuggestion = {
  /** 안정 식별자 — 목록 키·중복 제거용. */
  id: string
  conditions: SuggestionCondition[]
  /** 컬럼 라벨("출발지"). */
  propertyLabel: string
  /** 연산자 표기("=", "≥", "포함"). 범위 제안은 빈 문자열 — 라벨 자체가 범위다. */
  opLabel: string
  /** 값의 표시형("성북구", "플래너 배정됨") — 원시값과 다를 수 있다(select 옵션). */
  valueLabel: string
  strength: SuggestStrength
}

/** 판정기가 받는 맥락 — 지금은 컬럼 정의뿐이지만, 뷰/로캘이 필요해지면 여기로 넓힌다. */
export type SuggestContext = {
  def: PropertyDef
  /** 취소 신호 — 낡은 요청의 API 콜을 끊는 데 쓴다. 판정기는 존중하는 것이 권장. */
  signal?: AbortSignal
}

/**
 * 속성 판정기. `PropertyDef.suggest` 로 컬럼이 직접 달거나, 없으면 타입별 내장 규칙이 쓰인다.
 *
 * 반환은 제안 목록이다 — 판정 결과(strength)가 제안마다 붙으므로 별도 필드가 아니다.
 * 빈 배열 = `none`(제안 없음). 던지면 호출부가 빈 배열로 취급한다(하나가 죽어도 목록은 산다).
 *
 * 함수라서 JSON 안전이 아니다 — `render`/`format` 과 같은 규칙으로 **코드가 소유하는**
 * `PropertyDef` 에만 달 수 있고, 사용자가 UI 로 추가한 동적 컬럼(`BasePropertyDef`)은
 * 타입별 내장 규칙만 탄다. 동적 컬럼에도 조사가 필요해지면 함수가 아니라 "조사 방법의 선언"
 * (예: `{ kind: 'relation', target: 'work-region' }`)으로 한 겹 빼야 한다.
 */
export type PropertySuggester = (
  term: string,
  ctx: SuggestContext,
) => Promise<SearchSuggestion[]> | SearchSuggestion[]

// ─── 낱말 정규화 ──────────────────────────────────────────────────────────────

/** 숫자만 남긴다 — 하이픈·공백·점·괄호를 전부 벗긴 뒤 자릿수로 판단하기 위해. */
export function digitsOf(term: string): string {
  return term.replace(/\D/g, '')
}

/** 구분자를 뺀 나머지가 전부 숫자인가 — `010-1234`, `010 1234`, `(02)123` 모두 참. */
function isDigitsWithSeparators(term: string): boolean {
  return /^[\d\s.\-()]+$/.test(term) && /\d/.test(term)
}

/**
 * 전화번호로 **자라날 수 있는가**(러프 판정).
 *
 * 완성된 번호를 검사하지 않는다 — `010` 한 조각도 참이어야 타이핑 중에 제안이 뜬다.
 * 선행 `0` 이 핵심 힌트다: 국내 번호는 전부 0 으로 시작하고, 주문번호 같은 일련번호는
 * 0 으로 시작하지 않는다. 그래서 `010…` 은 전화 쪽으로, `203…` 은 번호 쪽으로 갈린다.
 */
export function phoneStrength(term: string): SuggestStrength {
  if (!isDigitsWithSeparators(term)) return 'none'
  const d = digitsOf(term)
  if (d.length === 0) return 'none'
  // 0 으로 시작 = 국내 전화 형태. 한 자리 '0' 만으로는 아직 아무것도 아니다.
  if (d.startsWith('0')) return d.length >= 2 ? 'strong' : 'weak'
  // 0 으로 시작하지 않는 숫자도 번호 일부일 수 있다(가운데부터 기억해 치는 경우) — 약하게.
  return d.length >= 4 ? 'weak' : 'none'
}

/** 수로 자라날 수 있는가 — 선행 0 은 일련번호가 아니므로 제외(전화·날짜 쪽으로 보낸다). */
export function numberPrefixStrength(term: string): SuggestStrength {
  const t = term.trim()
  if (!/^\d+$/.test(t)) return 'none'
  if (t.startsWith('0')) return 'none'
  return 'strong'
}

// ─── 타입별 내장 판정기 ───────────────────────────────────────────────────────

/** 연산자 → 사람 말. 비교는 기호가 낱말보다 빨리 읽힌다. */
const OP_LABEL: Partial<Record<FilterOp, string>> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  contains: '포함',
  not_contains: '미포함',
  has: '포함',
  not_has: '미포함',
}

function suggestion(
  def: PropertyDef,
  op: FilterOp,
  value: PropertyValue,
  valueLabel: string,
  strength: SuggestStrength,
): SearchSuggestion {
  return {
    id: `${def.key}:${op}:${String(value)}`,
    conditions: [{ key: def.key, op, value }],
    propertyLabel: def.label,
    opLabel: OP_LABEL[op] ?? op,
    valueLabel,
    strength,
  }
}

/** 범위 제안 — 시작·끝 두 조건이 한 쌍으로 들어간다(`이번 주`, `8월`). */
function rangeSuggestion(
  def: PropertyDef,
  start: string,
  end: string,
  label: string,
): SearchSuggestion {
  return {
    id: `${def.key}:range:${start}~${end}`,
    conditions: [
      { key: def.key, op: 'gte', value: start },
      { key: def.key, op: 'lte', value: end },
    ],
    propertyLabel: def.label,
    opLabel: '',
    valueLabel: label,
    strength: 'strong',
  }
}

/**
 * select / multi_select — 옵션 **라벨**과 부분일치. 사용자는 '접수됨' 을 치지 'lead_in' 을 치지 않는다.
 * 값은 원시값 그대로 나간다(서버가 아는 말).
 */
function suggestSelect(term: string, def: PropertyDef): SearchSuggestion[] {
  const t = term.trim().toLowerCase()
  if (t === '') return []
  const has = def.type === 'multi_select' || def.relation?.cardinality === 'many'
  return normalizeOptions(def.options)
    .filter((o) => (o.label ?? o.value).toLowerCase().includes(t))
    .map((o) => suggestion(def, has ? 'has' : 'eq', o.value, o.label ?? o.value, 'strong'))
}

/**
 * person / multi_person — 명단의 **이름·보조표기(이메일)** 와 부분일치. 값은 계정 id 로 나간다.
 * `나` 를 치면 「나」(보는 사람) 조건을 맨 앞에 낸다 — 저장된 보기에 상대값으로 남는다.
 */
function suggestPerson(term: string, def: PropertyDef): SearchSuggestion[] {
  const t = term.trim().toLowerCase()
  if (t === '') return []
  const op: FilterOp = def.type === 'multi_person' ? 'has' : 'eq'
  const me =
    t === ME_LABEL
      ? [
          {
            ...suggestion(def, op, ME_VALUE, ME_LABEL, 'strong'),
            id: `${def.key}:${op}:@me`,
          },
        ]
      : []
  const people = normalizeOptions(def.options)
    .filter(
      (o) =>
        (o.label ?? o.value).toLowerCase().includes(t) ||
        (o.hint?.toLowerCase().includes(t) ?? false),
    )
    .map((o) => suggestion(def, op, o.value, o.label ?? o.value, 'strong'))
  return [...me, ...people]
}

/** 내장 규칙 — 타입만 보고 판정한다. 컬럼이 `suggest` 를 달면 이건 쓰이지 않는다. */
export function builtinSuggester(term: string, def: PropertyDef, now?: Date): SearchSuggestion[] {
  const t = term.trim()
  if (t === '') return []

  switch (def.type) {
    case 'select':
    case 'multi_select':
      return suggestSelect(t, def)

    case 'person':
    case 'multi_person':
      return suggestPerson(t, def)

    // 관계는 호스트가 후보(옵션)를 채웠으면 select 와 같이 라벨로 겨눈다. 없으면 아래 약한 부분일치.
    case 'relation':
      return normalizeOptions(def.options).length > 0
        ? suggestSelect(t, def)
        : [suggestion(def, 'contains', t, t, 'weak')]

    case 'phone': {
      const s = phoneStrength(t)
      return s === 'none' ? [] : [suggestion(def, 'contains', t, t, s)]
    }

    case 'date': {
      const d = parseDateTerm(t, now)
      if (!d) return []
      // 하루면 "그 날"(eq) 로 족하다. 그보다 넓은 범위(주·달·해)는 시작과 끝이 달라 eq 로
      // 표현할 수 없으므로 **두 조건이 한 쌍인 범위 제안**이 맨 앞에 온다.
      const primary =
        d.precision === 'day'
          ? suggestion(def, 'eq', d.start, d.label, 'strong')
          : rangeSuggestion(def, d.start, d.end, d.label)
      return [
        primary,
        suggestion(def, 'gte', d.start, `${d.label} 이후`, 'strong'),
        suggestion(def, 'lte', d.end, `${d.label} 이전`, 'strong'),
      ]
    }

    case 'number': {
      // `#2034479` — 주문번호를 옮겨 적을 때 붙는 표기. 벗기고 본다.
      const n = t.replace(/^#/, '')
      if (numberPrefixStrength(n) === 'none') return []

      // 완성 입력이면 "그 번호"(eq), 부분 입력이면 "이 조각을 포함"(contains).
      // 자릿수를 모르면 판단하지 않고 둘 다 낸다 — 우리가 모르는 걸 추측하지 않는다.
      const complete = def.digits === undefined ? undefined : n.length === def.digits
      const eq = suggestion(def, 'eq', Number(n), n, 'strong')
      const has = suggestion(def, 'contains', n, n, 'strong')
      if (complete === true) return [eq]
      if (complete === false) return [has]
      return [eq, has]
    }

    case 'checkbox':
      return []

    // geo/button 은 객체값이라 낱말로 겨눌 수 없다. 조사가 필요하면 컬럼이 `suggest` 를 단다.
    case 'geo':
    case 'button':
      return []

    // text/url/email/relation — 부분일치는 언제나 가능하지만 근거가 약하다.
    default:
      return [suggestion(def, 'contains', t, t, 'weak')]
  }
}

// ─── 조립 ────────────────────────────────────────────────────────────────────

/** 필터 후보에서 빠지는 타입은 제안에서도 뺀다(ViewToolbar 의 isFilterableType 과 같은 규약). */
function isSuggestable(type: PropertyType): boolean {
  return type !== 'button' && type !== 'struct'
}

/** strong 이 weak 보다 먼저. 같은 등급 안에서는 스키마 선언 순서(= 표의 컬럼 순서)를 지킨다. */
const RANK: Record<SuggestStrength, number> = { strong: 0, weak: 1, none: 2 }

export function rankSuggestions(items: SearchSuggestion[]): SearchSuggestion[] {
  const seen = new Set<string>()
  return items
    .filter((s) => s.strength !== 'none' && !seen.has(s.id) && (seen.add(s.id), true))
    .map((s, i) => ({ s, i }))
    .sort((a, b) => RANK[a.s.strength] - RANK[b.s.strength] || a.i - b.i)
    .map(({ s }) => s)
}

/**
 * 동기 제안만 — 컬럼이 `suggest` 를 달지 않은 것들. 키 입력 즉시 그릴 수 있다.
 * 조사형(비동기) 컬럼은 여기서 빠지고 `asyncSuggesters` 로 따로 나간다.
 */
function singleTermSuggestions(
  term: string,
  schema: PropertyDef[],
  now?: Date,
): SearchSuggestion[] {
  const out: SearchSuggestion[] = []
  for (const def of schema) {
    if (!isSuggestable(def.type) || def.suggest) continue
    out.push(...builtinSuggester(term, def, now))
  }
  return out
}

/** 컬럼별 첫 제안만 — 복합 조합이 같은 컬럼의 변형(범위/이후/이전)으로 부풀지 않게. */
function primaryPerColumn(items: SearchSuggestion[]): SearchSuggestion[] {
  const seen = new Set<string>()
  return items.filter((s) => {
    const key = s.conditions[0]?.key ?? ''
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** 복합 제안은 최대 이만큼 — 목록이 조합으로 뒤덮이지 않게. */
const MAX_COMPOSITE = 4

/**
 * 낱말이 여럿일 때의 **복합 제안** — `관악 8월` 처럼 조건 두 개를 한 번에 건다.
 *
 * 아무 때나 쪼개면 안 된다. `서울 강남` 은 두 조건이 아니라 **한 주소 구문**이고, 그걸
 * 쪼개 `출발지 포함 서울 AND 도착지 포함 강남` 을 제안하면 뜻이 없다. 그래서 조건을 건다:
 *
 *  1. 조각이 2~3개일 때만(그 이상은 문장이지 조건이 아니다).
 *  2. **적어도 한 조각이 strong** 이어야 한다 — 날짜·번호·전화·옵션처럼 형태가 스스로를
 *     설명하는 것. 전부 텍스트 부분일치(weak)면 그건 쪼갤 구문이지 조건 둘이 아니다.
 *  3. 조각마다 **다른 컬럼**을 겨눠야 한다(같은 컬럼 두 번은 서로를 지운다).
 *
 * 조사형(비동기) 컬럼은 아직 복합에 들어가지 않는다 — 조합을 만들려면 조사 결과를 기다려야
 * 해서 "즉답 먼저" 원칙과 부딪힌다. `관악` 은 여기선 텍스트 부분일치로만 참여한다.
 */
export function compositeSuggestions(
  term: string,
  schema: PropertyDef[],
  now?: Date,
): SearchSuggestion[] {
  const parts = term.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2 || parts.length > 3) return []
  // 전체가 하나의 날짜면(`8월 13일`·`이번 주`) 쪼갤 대상이 아니다.
  if (parseDateTerm(term, now)) return []

  const perPart = parts.map((p) =>
    primaryPerColumn(rankSuggestions(singleTermSuggestions(p, schema, now))),
  )
  if (perPart.some((list) => list.length === 0)) return []
  // 전부 weak = 쪼갤 구문이지 조건 둘이 아니다.
  if (!perPart.some((list) => list.some((s) => s.strength === 'strong'))) return []

  let combos: SearchSuggestion[][] = perPart[0]!.map((s) => [s])
  for (const list of perPart.slice(1)) {
    combos = combos.flatMap((acc) =>
      list
        .filter((s) => !acc.some((a) => a.conditions[0]?.key === s.conditions[0]?.key))
        .map((s) => [...acc, s]),
    )
  }

  return combos.slice(0, MAX_COMPOSITE).map((combo) => ({
    id: `composite:${combo.map((s) => s.id).join('+')}`,
    conditions: combo.flatMap((s) => s.conditions),
    propertyLabel: '',
    opLabel: '',
    valueLabel: combo
      .map((s) => [s.propertyLabel, s.opLabel, s.valueLabel].filter(Boolean).join(' '))
      .join(' · '),
    strength: 'strong',
  }))
}

export function syncSuggestions(
  term: string,
  schema: PropertyDef[],
  now?: Date,
): SearchSuggestion[] {
  // 복합이 먼저 — 낱말을 여럿 친 사용자는 대개 조건도 여럿을 원한다.
  const out = [
    ...compositeSuggestions(term, schema, now),
    ...singleTermSuggestions(term, schema, now),
  ]
  // 명시적 날짜(`오늘`·`8월 13일`)면 텍스트 부분일치는 노이즈다 — 주소에 그런 말은 없다.
  const pruned = isExplicitDateTerm(term, now) ? out.filter((s) => s.strength !== 'weak') : out
  return rankSuggestions(pruned)
}

/** 조사형 컬럼들 — 호출부가 디바운스·취소·캐시를 붙여 따로 돌린다. */
export function asyncSuggesters(schema: PropertyDef[]): PropertyDef[] {
  return schema.filter((def) => isSuggestable(def.type) && def.suggest)
}

/** 조사형 판정기가 제안을 만들 때 쓰는 헬퍼 — 표시 조각 조립을 엔진과 같게 유지한다. */
export function buildSuggestion(
  def: PropertyDef,
  op: FilterOp,
  value: PropertyValue,
  valueLabel: string,
  strength: SuggestStrength = 'strong',
): SearchSuggestion {
  return suggestion(def, op, value, valueLabel, strength)
}
