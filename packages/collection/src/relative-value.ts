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
 * ## 지금은 날짜뿐이다
 *
 * `rel` 판별자를 둔 이유는 "나"(현재 사용자) 같은 값이 뒤따르기 때문이다. 다만 그것은
 * **사람을 담는 컬럼이 생긴 뒤**의 일이다. 지금 목록의 어떤 컬럼도 계정을 담지 않아,
 * 지금 넣으면 아무것도 맞히지 못하는 조건이 된다.
 */

/** 상대 날짜의 눈금. 주는 월요일 시작(ISO) — 방문 일정이 주 단위로 도는 업무라 그렇다. */
export type RelativeDateUnit = 'day' | 'week' | 'month'

/**
 * 상대 날짜 값 — `offset` 은 **지금이 속한 칸**에서 몇 칸 떨어졌는가다.
 *  - 오늘 = `{unit:'day', offset:0}` · 어제 = `{unit:'day', offset:-1}`
 *  - 이번 주 = `{unit:'week', offset:0}` · 지난달 = `{unit:'month', offset:-1}`
 *  - D-7 = `{unit:'day', offset:-7}`
 */
export type RelativeDateValue = {
  rel: 'date'
  unit: RelativeDateUnit
  offset: number
}

/** 상대값 — 지금은 날짜뿐이지만 판별자로 열어 둔다. */
export type RelativeValue = RelativeDateValue

/** 이 값이 상대값인가. 다른 객체값(Geo·Button·Tag)과 `rel` 하나로 갈린다. */
export function isRelativeValue(value: unknown): value is RelativeValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rel = (value as { rel?: unknown }).rel
  return rel === 'date'
}

/** 해소된 날짜 범위 — 양끝 포함(`YYYY-MM-DD`). 하루짜리는 start === end. */
export type ResolvedDateRange = { start: string; end: string }

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

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
export function resolveRelativeDate(value: RelativeDateValue, now: Date): ResolvedDateRange {
  if (value.unit === 'day') {
    const day = addDays(now, value.offset)
    return { start: iso(day), end: iso(day) }
  }
  if (value.unit === 'week') {
    const monday = addDays(mondayOf(now), value.offset * 7)
    return { start: iso(monday), end: iso(addDays(monday, 6)) }
  }
  const first = new Date(now.getFullYear(), now.getMonth() + value.offset, 1)
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  return { start: iso(first), end: iso(last) }
}

/** 상대값 해소에 필요한 맥락. 지금은 시각뿐이지만, "나" 가 오면 보는 사람이 여기 붙는다. */
export type RelativeContext = {
  now: Date
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

function resolveNode(node: FilterNode, ctx: RelativeContext): FilterNode {
  if ('children' in node) {
    return { ...node, children: node.children.map((child) => resolveNode(child, ctx)) }
  }
  return resolveCondition(node, ctx)
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

/** 값이 상대값이면 그 뜻을, 아니면 null — 칩·요약이 사람 말로 보여줄 때 쓴다. */
export function relativeValueLabel(value: PropertyValue | undefined): string | null {
  if (!isRelativeValue(value)) return null
  return relativeDateLabel(value)
}

const DAY_LABELS: Record<number, string> = { 0: '오늘', 1: '내일', 2: '모레', [-1]: '어제' }
const WEEK_LABELS: Record<number, string> = { 0: '이번 주', 1: '다음 주', [-1]: '지난주' }
const MONTH_LABELS: Record<number, string> = { 0: '이번 달', 1: '다음 달', [-1]: '지난달' }

/**
 * 사람이 읽는 표기. 이름 붙은 오프셋은 그 이름으로, 나머지는 `N일 전`·`N일 후` 로 센다
 * (`D-7` 같은 내부 표기는 쓰지 않는다 — 필터 칩은 내부 어휘를 몰라도 읽혀야 한다).
 */
export function relativeDateLabel(value: RelativeDateValue): string {
  const named =
    value.unit === 'day' ? DAY_LABELS : value.unit === 'week' ? WEEK_LABELS : MONTH_LABELS
  const exact = named[value.offset]
  if (exact) return exact

  const noun = value.unit === 'day' ? '일' : value.unit === 'week' ? '주' : '개월'
  const n = Math.abs(value.offset)
  return value.offset < 0 ? `${n}${noun} 전` : `${n}${noun} 후`
}
