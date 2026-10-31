import type { AggregationType, PropertyValue } from './types'
import { dateValueStart } from './date-value'

// 컬럼 footer 집계(노션식) — 한 컬럼의 모든 셀 값을 받아 한 문자열로 반환. 순수·DOM 무관.
// 셀 값은 PropertyValue(스칼라/배열/null). 결과는 화면 표시용 문자열(빈 결과 = '').

/** 값이 비어있는지 — null/undefined, 빈 문자열, 빈 배열. number/boolean(0/false) 는 비어있지 않음. */
export function isEmptyCellValue(v: PropertyValue | undefined): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.length === 0
  if (Array.isArray(v)) return v.length === 0
  return false
}

/** 숫자/날짜 정규화 — number 그대로, ISO date(기간/시간 포함)는 *시작* epoch ms. 그 외 NaN. */
function toNumber(v: PropertyValue | undefined): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(dateValueStart(v))
    return Number.isNaN(t) ? Number.NaN : t
  }
  return Number.NaN
}

/** 한국식 천단위 구분 + 정수면 정수 표시. (ProjectionAdapter 가 SQL 수치 집계 결과를 동일 포맷으로 맞추는 데 공유.) */
export function formatNumberKo(n: number): string {
  if (!Number.isFinite(n)) return ''
  if (Number.isInteger(n)) return n.toLocaleString('ko-KR')
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
}

/**
 * 컬럼 footer 집계 계산. type='none' 이거나 미지정 셀들이면 빈 문자열.
 *  - count: 전체 행 수(컬럼 값과 무관)
 *  - count_empty / count_not_empty: 빈/값 있음 갯수
 *  - count_unique: 고유 값 개수(배열은 평탄화)
 *  - sum/avg/min/max: 숫자만 — 비숫자 셀은 스킵. 모두 비숫자면 빈 문자열.
 */
export function computeAggregation(
  type: AggregationType,
  values: (PropertyValue | undefined)[],
): string {
  if (type === 'none') return ''
  const n = values.length

  if (type === 'count') return String(n)
  if (type === 'count_empty') return String(values.filter(isEmptyCellValue).length)
  if (type === 'count_not_empty') return String(values.filter((v) => !isEmptyCellValue(v)).length)
  if (type === 'count_unique') {
    const set = new Set<string>()
    for (const v of values) {
      if (isEmptyCellValue(v)) continue
      if (Array.isArray(v)) for (const x of v) set.add(String(x))
      // 객체값(geo 등)은 String(v) 가 모두 "[object Object]" 로 뭉개져 서로 다른 위치가 1 로
      // 집계되는 버그가 있다. 코어→views 의존(레이어링 위반) 없이, 객체는 JSON.stringify 로
      // 구조 기반 키를 만들어 구분한다(서로 다른 객체 = 서로 다른 키).
      else if (typeof v === 'object') set.add(JSON.stringify(v))
      else set.add(String(v))
    }
    return String(set.size)
  }

  // 수치 집계 — 숫자만.
  const nums: number[] = []
  for (const v of values) {
    const x = toNumber(v)
    if (Number.isFinite(x)) nums.push(x)
  }
  if (nums.length === 0) return ''
  if (type === 'sum') return formatNumberKo(nums.reduce((a, b) => a + b, 0))
  if (type === 'avg') return formatNumberKo(nums.reduce((a, b) => a + b, 0) / nums.length)
  if (type === 'min') return formatNumberKo(Math.min(...nums))
  if (type === 'max') return formatNumberKo(Math.max(...nums))
  return ''
}

/** 집계 라벨(메뉴/표시용) — 한국어. type='none' 은 호출자가 '비활성' 등으로 처리. */
export const AGGREGATION_LABEL: Record<AggregationType, string> = {
  none: '없음',
  count: '전체 수',
  count_empty: '빈 값',
  count_not_empty: '값 있음',
  count_unique: '고유 값',
  sum: '합계',
  avg: '평균',
  min: '최솟값',
  max: '최댓값',
}
