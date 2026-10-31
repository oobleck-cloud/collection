import { normalizeFilterRoot } from './view'

import type { FilterCondition, FilterGroup, FilterNode, PropertyValue } from './types'

/**
 * @mvos/collections — **상대값**: 저장된 뷰가 어제의 답에 못 박히지 않게 한다.
 *
 * 검색창은 이미 `오늘`·`이번 주`를 읽는다(`date-term.ts`). 그런데 그 낱말은 입력 시점에
 * 리터럴 날짜로 굳어 조건에 실린다. 그 조건을 뷰로 저장하면 **그날의 날짜**가 저장된다 —
 * "오늘 방문"이라 이름 붙인 뷰가 다음 날에는 어제를 보여준다. 화면만 봐서는 알 수 없고,
 * 이름이 거짓말을 시작한 것이라 더 나쁘다.
 *
 * 그래서 값에 **식을 저장**하고, 질의를 만드는 경계에서 `now` 를 주입해 푼다.
 * 저장은 표현력 있게, 실행은 리터럴로 — 이 분리가 이 파일의 전부다.
 *
 * ## 왜 값 안에 넣는가
 *
 * `PropertyValue` 에는 이미 자기를 설명하는 객체값이 산다(GeoValue·ButtonValue·TagValue).
 * 상대값도 같은 자리에 둔다. 조건에 `relative` 같은 형제 필드를 새로 두면 값을 읽는 모든
 * 곳이 두 자리를 봐야 하고, 그중 한 곳을 빠뜨리면 조건이 조용히 무시된다.
 *
 * ## 날짜와 「나」
 *
 * `rel` 판별자를 둔 이유는 "나"(현재 사용자) 같은 값이 뒤따르기 때문이었다. 사람 컬럼
 * (`person`·`multi_person`)이 생기며 그 자리가 찼다 — `{rel:'me'}` 는 "보는 사람의 계정 id" 다.
 * "내가 담당인 주문" 보기를 저장하면 그 보기를 연 사람마다 자기 것이 보인다.
 */

/** 범위를 가리키는 눈금(하루·주·달). 주는 월요일 시작(ISO) — 방문 일정이 주 단위로 도는 업무라 그렇다. */
export type RelativeRangeUnit = 'day' | 'week' | 'month'

/**
 * 상대 날짜의 눈금 — 범위 눈금 + **시간**(`hour`).
 *
 * 시간은 칸이 아니라 **순간**이다: 「2시간 전」은 지금에서 정확히 2시간 앞의 그 분이지, 그 시(時) 전체가 아니다.
 * 그래서 범위 해소([resolveRelativeDate])가 아니라 순간 해소([resolveRelativeInstant])를 탄다.
 */
export type RelativeDateUnit = RelativeRangeUnit | 'hour'

/**
 * 상대 날짜 값 — `offset` 은 **지금이 속한 칸**에서 몇 칸 떨어졌는가다.
 *  - 오늘 = `{unit:'day', offset:0}` · 어제 = `{unit:'day', offset:-1}`
 *  - 이번 주 = `{unit:'week', offset:0}` · 지난달 = `{unit:'month', offset:-1}`
 *  - D-7 = `{unit:'day', offset:-7}` — 편집기에서 「N일 전/후」로 아무 N 이나 고를 수 있다.
 *    운영의 「N일 차」(1일 차 = 그날 당일)는 따로 저장하지 않는다: N일 차 = `{unit:'day', offset:-(N-1)}`.
 *  - 오늘 12:00 = `{unit:'day', offset:0, time:'12:00'}` — 하루가 아니라 **그 분**을 가리킨다(일 단위에만 붙는다).
 *    「오늘 오전 방문」(오늘 0시 ≤ 방문 < 오늘 12:00)처럼 하루 안의 경계가 필요한 조건이 이걸로 저장된다.
 *  - 2시간 전 = `{unit:'hour', offset:-2}` · 지금 = `{unit:'hour', offset:0}` — 지금 ± N시간의 그 분.
 *    `time` 은 붙지 않는다(붙어 있어도 무시한다 — 시각을 이미 지금이 정한다).
 */
export type RelativeDateValue = {
  rel: 'date'
  unit: RelativeDateUnit
  offset: number
  /** 그날의 시각 `HH:mm`(로컬). 있으면 날짜 범위가 아니라 `YYYY-MM-DDTHH:mm` 한 순간으로 풀린다. 일 단위에만. */
  time?: string
}

/** 범위로 풀리는 상대 날짜(시간 단위가 아닌 것) — [resolveRelativeDate] 의 입력. */
export type RelativeRangeValue = RelativeDateValue & { unit: RelativeRangeUnit }

/**
 * 범위 눈금인가 — 시간 단위는 범위가 아니라 순간이다.
 *
 * 허용 목록으로 센다(`unit !== 'hour'` 가 아니다). 저장된 뷰는 서버에 불투명 JSON 으로 실려 런타임 검사를 받지 않으므로,
 * 망가진 값이나 아직 모르는 눈금(minute·quarter…)이 들어올 수 있다 — 그것을 달로 셈해 버리면 칩과 결과가 어긋난다.
 */
export function isRelativeRangeValue(value: RelativeDateValue): value is RelativeRangeValue {
  return value.unit === 'day' || value.unit === 'week' || value.unit === 'month'
}

/** 이 코드가 아는 눈금인가(범위 눈금 + 시간). 모르는 눈금은 해소에서 「아무것도 맞히지 않음」으로 풀린다. */
export function isKnownRelativeUnit(unit: unknown): unit is RelativeDateUnit {
  return unit === 'day' || unit === 'week' || unit === 'month' || unit === 'hour'
}

/** 시각 표기 `HH:mm` 인가. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/

/** 이 상대값이 그 분을 가리키는가(일 단위 + 올바른 시각). 그날의 시각 `HH:mm` 을 돌려준다. */
export function relativeDateTime(value: RelativeDateValue): string | null {
  return value.unit === 'day' && value.time && TIME_OF_DAY.test(value.time) ? value.time : null
}

/** 「나」 — 보는 사람의 계정 id. 사람 컬럼(`person`·`multi_person`) 조건에만 실린다. */
export type RelativeMeValue = {
  rel: 'me'
}

/** 「나」 값 하나 — 필터 편집기·칩이 같은 모양을 쓰도록 상수로 둔다. */
export const ME_VALUE: RelativeMeValue = { rel: 'me' }

/**
 * 보는 사람을 모를 때(로그인 전·세션 없음) 「나」가 풀리는 값 — 어떤 계정 id 와도 같지 않다.
 * 조건을 떨구면 "제약 없음"이 되어 목록이 넓어지므로, **아무도 아닌 사람**으로 푼다.
 */
export const UNRESOLVED_ME = 'me:unresolved'

/** 상대값 — 판별자(`rel`)로 갈린다. */
export type RelativeValue = RelativeDateValue | RelativeMeValue

/** 이 값이 상대값인가. 다른 객체값(Geo·Button·Tag)과 `rel` 하나로 갈린다. */
export function isRelativeValue(value: unknown): value is RelativeValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rel = (value as { rel?: unknown }).rel
  return rel === 'date' || rel === 'me'
}

/** 상대 날짜인가 — 날짜 편집기·범위 해소가 쓴다. */
export function isRelativeDateValue(value: unknown): value is RelativeDateValue {
  return isRelativeValue(value) && value.rel === 'date'
}

/** 「나」인가. */
export function isRelativeMeValue(value: unknown): value is RelativeMeValue {
  return isRelativeValue(value) && value.rel === 'me'
}

/** 해소된 날짜 범위 — 양끝 포함(`YYYY-MM-DD`). 하루짜리는 start === end. */
export type ResolvedDateRange = { start: string; end: string }

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
/** 로컬 분 `YYYY-MM-DDTHH:mm` — 상대값 `오늘 12:00` 이 푸는 모양과 같은 규약(로컬 시각). */
const isoMinute = (d: Date) => `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`

const HOUR_MS = 60 * 60 * 1000

function addDays(d: Date, n: number): Date {
  const c = midnight(d)
  c.setDate(c.getDate() + n)
  return c
}

/** 그 주의 월요일. `getDay()` 는 일=0 이라 월요일까지의 거리를 따로 센다(date-term 과 같은 규약). */
function mondayOf(d: Date): Date {
  const c = midnight(d)
  const back = (c.getDay() + 6) % 7
  return addDays(c, -back)
}

/**
 * 상대 날짜 → 날짜 범위. **`now` 는 반드시 주입받는다** — 안에서 `new Date()` 를 부르면
 * 테스트가 달력에 따라 깨지고, 그 실패는 코드가 아니라 날짜 탓이라 원인을 찾기 어렵다.
 */
export function resolveRelativeDate(value: RelativeRangeValue, now: Date): ResolvedDateRange {
  if (value.unit === 'day') {
    const day = addDays(now, value.offset)
    return { start: iso(day), end: iso(day) }
  }
  if (value.unit === 'week') {
    const monday = addDays(mondayOf(now), value.offset * 7)
    return { start: iso(monday), end: iso(addDays(monday, 6)) }
  }
  if (value.unit === 'month') {
    const first = new Date(now.getFullYear(), now.getMonth() + value.offset, 1)
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
    return { start: iso(first), end: iso(last) }
  }
  // 눈금을 더하면 여기서 컴파일이 멈춘다 — 모르는 눈금을 조용히 달로 세던 자리다.
  const unknown: never = value.unit
  throw new Error(`알 수 없는 상대 날짜 눈금: ${String(unknown)}`)
}

/**
 * 상대 날짜 → **한 순간**(`YYYY-MM-DDTHH:mm`, 로컬 분) 또는 null(범위로 풀리는 값).
 *
 * 순간을 가리키는 값은 둘이다.
 *  - 일 단위 + 시각(`오늘 12:00`) — 그날의 그 분.
 *  - 시간 단위(`2시간 전`) — 지금 ± N시간의 그 분. 달력이 아니라 경과 시간으로 센다(밀리초 더하기) —
 *    자정을 넘으면 날짜도 넘어간다(23:30 + 2시간 = 다음 날 01:30). 초 아래는 버린다(필터의 시각 값은 분까지).
 *
 * `now` 는 [resolveRelativeDate] 와 같은 이유로 주입받는다.
 */
export function resolveRelativeInstant(value: RelativeDateValue, now: Date): string | null {
  if (value.unit === 'hour') return isoMinute(new Date(now.getTime() + value.offset * HOUR_MS))
  const time = relativeDateTime(value)
  if (!time || !isRelativeRangeValue(value)) return null
  return `${resolveRelativeDate(value, now).start}T${time}`
}

/** 상대값 해소에 필요한 맥락 — 지금 시각과 보는 사람. */
export type RelativeContext = {
  now: Date
  /** 보는 사람의 계정 id. 없으면 「나」는 [UNRESOLVED_ME] 로 풀린다(아무도 맞히지 않는다). */
  me?: string | null
}

/**
 * 조건 하나를 리터럴 조건(들)로 편다.
 *
 * 범위를 가리키는 값(이번 주·지난달)에 `eq` 가 걸리면 **두 조건으로 벌어진다** —
 * "이번 주다" 는 한 날짜와 같다는 뜻이 아니라 그 주 안에 있다는 뜻이기 때문이다.
 * 비교 연산자는 무엇을 겨누는지가 정해져 있다: 이후(`gte`·`gt`)는 범위의 시작,
 * 이전(`lte`·`lt`)은 범위의 끝. "이번 주 이후"가 주 중간에서 잘리면 뜻이 어긋난다.
 */
function resolveCondition(condition: FilterCondition, ctx: RelativeContext): FilterNode {
  const value = condition.value
  if (!isRelativeValue(value)) return condition
  // 「나」는 연산자와 무관하게 값만 바꾼다 — is·is not·has·not_has 모두 "그 계정"을 비교한다.
  if (value.rel === 'me') return { ...condition, value: ctx.me || UNRESOLVED_ME }

  // 모르는 눈금(망가진 저장값·다음 판의 눈금) — 조건을 떨구면 목록이 넓어지므로 「나」와 같은 생각으로
  // **아무것도 맞히지 않게** 푼다. 칩도 「알 수 없는 날짜」로 읽혀 결과(0건)와 어긋나지 않는다.
  if (!isKnownRelativeUnit(value.unit) || !Number.isFinite(value.offset)) {
    return matchNothing(condition.key)
  }

  // 그 분 — 범위가 아니라 한 순간이다. 연산자와 무관하게 리터럴 하나로 풀린다(`< 오늘 12:00`·`≥ 2시간 전`).
  // `= 2시간 전` 은 그 1분만 맞힌다 — 편집기는 시간 단위를 같다·같지 않다에 내지 않는다(filter-builder `valueForOp`).
  const instant = resolveRelativeInstant(value, ctx.now)
  if (instant) return { ...condition, value: instant }
  // 위에서 아는 눈금만 남겼고 시간은 순간으로 풀렸다 — 여기는 범위 눈금뿐이다. 타입을 좁히는 가드다.
  if (!isRelativeRangeValue(value)) return matchNothing(condition.key)

  const range = resolveRelativeDate(value, ctx.now)
  const single = range.start === range.end

  switch (condition.op) {
    case 'eq':
      if (single) return { ...condition, value: range.start }
      return {
        op: 'and',
        children: [
          { key: condition.key, op: 'gte', value: range.start },
          { key: condition.key, op: 'lte', value: range.end },
        ],
      }
    case 'neq':
      if (single) return { ...condition, value: range.start }
      // "이번 주가 아니다" = 그 주 **밖**이다. 두 조건을 AND 로 묶으면 아무것도 통과하지 못한다.
      return {
        op: 'or',
        children: [
          { key: condition.key, op: 'lt', value: range.start },
          { key: condition.key, op: 'gt', value: range.end },
        ],
      }
    case 'gte':
    case 'gt':
      return { ...condition, value: range.start }
    case 'lte':
    case 'lt':
      return { ...condition, value: range.end }
    default:
      // 값이 필요 없는 연산자(is_empty 등)에 상대값이 붙을 일은 없다. 붙어 있어도 값은 무시된다.
      return condition
  }
}

/** 어떤 행도 맞히지 않는 조건 — 비어 있으면서 비어 있지 않다. SQL·인메모리 두 엔진이 모두 아는 연산자로만 짠다. */
function matchNothing(key: string): FilterNode {
  return {
    op: 'and',
    children: [
      { key, op: 'is_empty' },
      { key, op: 'is_not_empty' },
    ],
  }
}

function resolveNode(node: FilterNode, ctx: RelativeContext): FilterNode {
  if ('children' in node) {
    return { ...node, children: node.children.map((child) => resolveNode(child, ctx)) }
  }
  // 롤업의 대상 조건도 같은 시각으로 푼다 — 「최근 30일에 낸 견적」이 저장된 날에 못 박히지 않게.
  const resolved = node.rollup
    ? {
        ...node,
        rollup: { ...node.rollup, where: node.rollup.where.map((w) => resolveNode(w, ctx)) },
      }
    : node
  return resolveCondition(resolved, ctx)
}

/**
 * 필터 트리의 상대값을 지금 시각으로 푼다(순수, 입력 미변형).
 *
 * 질의를 만드는 경계에서 한 번만 부른다. 그 아래(SQL 컴파일러·인메모리 매처·전송 계약)는
 * 상대값을 몰라도 되고, 몰라야 한다 — 실행 계층마다 "지금이 언제인가"를 각자 판단하기
 * 시작하면 같은 뷰가 계층에 따라 다른 날을 가리킨다.
 */
export function resolveRelativeFilters(filters: FilterGroup, ctx: RelativeContext): FilterGroup {
  return resolveNode(normalizeFilterRoot(filters), ctx) as FilterGroup
}

/**
 * 이 필터가 **분 단위로 낡는가** — 시간 단위 상대값(「2시간 전」·「지금」)이 하나라도 걸려 있으면 true.
 * 목록 화면이 다시 풀 시점을 고를 때 쓴다(없으면 날이 바뀔 때만 다시 풀어도 답이 같다).
 */
export function hasMinuteRelative(filters: FilterNode | undefined | null): boolean {
  if (!filters) return false
  if ('children' in filters) return filters.children.some((child) => hasMinuteRelative(child))
  if (filters.rollup?.where.some((child) => hasMinuteRelative(child))) return true
  return isRelativeDateValue(filters.value) && filters.value.unit === 'hour'
}

/**
 * 상대값을 다시 풀어야 하는 때를 가르는 열쇠 — 시간 단위가 걸려 있으면 그 분(`YYYY-MM-DDTHH:mm`), 아니면 그날.
 * 열쇠가 바뀌면 같은 필터가 다른 리터럴로 풀린다. 목록 화면의 메모 의존성으로 쓴다.
 */
export function relativeClockKey(filters: FilterNode | undefined | null, now: Date): string {
  return hasMinuteRelative(filters) ? isoMinute(now) : iso(now)
}

/** 값이 상대값이면 그 뜻을, 아니면 null — 칩·요약이 사람 말로 보여줄 때 쓴다. */
export function relativeValueLabel(value: PropertyValue | undefined): string | null {
  if (!isRelativeValue(value)) return null
  if (value.rel === 'me') return ME_LABEL
  return relativeDateLabel(value)
}

/** 「나」의 표기 — 필터 칩·값 선택지·사람 셀의 지름길이 같은 낱말을 쓴다. */
export const ME_LABEL = '나'

const DAY_LABELS: Record<number, string> = { 0: '오늘', 1: '내일', 2: '모레', [-1]: '어제' }
const WEEK_LABELS: Record<number, string> = { 0: '이번 주', 1: '다음 주', [-1]: '지난주' }
const MONTH_LABELS: Record<number, string> = { 0: '이번 달', 1: '다음 달', [-1]: '지난달' }
const HOUR_LABELS: Record<number, string> = { 0: '지금' }

/** 눈금별 이름 붙은 오프셋과 셀 때의 명사. */
const UNIT_WORDS: Record<RelativeDateUnit, { named: Record<number, string>; noun: string }> = {
  day: { named: DAY_LABELS, noun: '일' },
  week: { named: WEEK_LABELS, noun: '주' },
  month: { named: MONTH_LABELS, noun: '개월' },
  hour: { named: HOUR_LABELS, noun: '시간' },
}

/**
 * 사람이 읽는 표기. 이름 붙은 오프셋은 그 이름으로, 나머지는 `N일 전`·`N시간 후` 로 센다
 * (`D-7` 같은 내부 표기는 쓰지 않는다 — 필터 칩은 내부 어휘를 몰라도 읽혀야 한다).
 *
 * 「N일 차」는 칩에 쓰지 않는다 — 「4일 차」는 **어느 날을 1일 차로 세는가**(방문일·접수일…)를 컬럼이 정해야
 * 읽히는 말이고, `이사일 = 4일 차` 처럼 미래를 가리키는 컬럼에선 뜻이 서지 않는다. 칩은 컬럼 이름 옆에
 * 놓이므로 `방문 일시 = 3일 전` 이 어느 컬럼에서도 같은 뜻으로 읽힌다. 「N일 차」는 편집기가 보조 표기로 보여준다.
 */
export function relativeDateLabel(value: RelativeDateValue): string {
  const time = relativeDateTime(value)
  const day = relativeUnitLabel(value)
  return time ? `${day} ${time}` : day
}

/** 모르는 눈금의 표기 — 질의가 아무것도 맞히지 않으므로(resolveCondition) 칩도 「무엇인지 모른다」고 말한다. */
const UNKNOWN_UNIT_LABEL = '알 수 없는 날짜'

function relativeUnitLabel(value: RelativeDateValue): string {
  if (!isKnownRelativeUnit(value.unit) || !Number.isFinite(value.offset)) {
    return `${UNKNOWN_UNIT_LABEL}(${String(value.unit)} ${String(value.offset)})`
  }
  const words = UNIT_WORDS[value.unit]
  const exact = words.named[value.offset]
  if (exact) return exact

  const n = Math.abs(value.offset)
  return value.offset < 0 ? `${n}${words.noun} 전` : `${n}${words.noun} 후`
}

/**
 * 「N일 차」의 N — 일 단위 상대값이 오늘 또는 과거를 가리킬 때만(1일 차 = 오늘 = offset 0, 4일 차 = 3일 전).
 * 미래(offset > 0)·다른 눈금은 null. 편집기의 보조 표기가 쓴다.
 */
export function relativeDayOrdinal(value: RelativeDateValue): number | null {
  if (value.unit !== 'day' || value.offset > 0) return null
  return -value.offset + 1
}

/** 「N일 차」 → 저장 형태(`{unit:'day', offset:-(N-1)}`). N < 1 은 1일 차(오늘)로 본다. */
export function relativeDayOfOrdinal(n: number): RelativeDateValue {
  const days = Math.max(1, Math.trunc(n)) - 1
  return { rel: 'date', unit: 'day', offset: days === 0 ? 0 : -days }
}
