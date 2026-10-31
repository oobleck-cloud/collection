// @oobleck/collection — 타임라인 축 눈금(tick) 순수 계산.
//
// TimelineView 에서 분리한 순수 모듈(React·DOM·@oobleck/systheme 비의존) — 단위 테스트 용이.
//
// ★ 타임존 일관성(BL9/N2): date-only 값('YYYY-MM-DD')은 Date.parse 가 **UTC 자정**으로 파싱된다.
//   따라서 틱 경계 정렬·증분·라벨도 **UTC 메서드**(setUTCHours/getUTCDate…)로 맞춘다. 로컬 메서드를
//   쓰면 음수 UTC offset 지역에서 막대가 하루 어긋나고(1/15 → 1/14 틱), 서버(UTC)·클라이언트(로컬)
//   틱이 달라져 hydration 불일치가 난다. UTC 고정으로 결정성 확보.
//
// 순수성: wall-clock(zero-arg new Date()/Date.now()) 호출 없음 — 인자는 모두 데이터 파생 ms.

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter'

/** timestamp(ms) → Date. 데이터에서 파생된 값만 사용(wall-clock new Date()/Date.now() 호출 없음). */
function tsToDate(ts: number): Date {
  return new Date(ts)
}

/** 한 단위 더 큰 줌으로 폴백(day→week→month→quarter, quarter 는 더 못 키움). */
const COARSER_ZOOM: Record<ZoomLevel, ZoomLevel | null> = {
  day: 'week',
  week: 'month',
  month: 'quarter',
  quarter: null,
}

/**
 * 줌 단위별 최대 틱 수 상한(성능 가드). day 줌 + 수년 범위는 수천 노드를 만들 수 있어
 * 렌더가 무거워진다 — 상한 초과 시 한 단계 큰 단위로 자동 폴백(N3).
 */
const MAX_TICKS = 400

/**
 * 줌 단위별 틱(눈금) 생성 — 축 범위(startMs~endMs)를 커버하는 틱 배열(UTC 경계 정렬).
 * 축 범위 자체가 데이터값 기반이므로 '현재 시각' 의존이 없다.
 *
 * 성능 가드(N3): 산출 틱 수가 MAX_TICKS 를 넘으면 한 단계 큰 단위로 폴백해 노드 폭발을 막는다.
 */
export function buildTicks(startMs: number, endMs: number, zoom: ZoomLevel): Date[] {
  const ticks: Date[] = []
  const start = tsToDate(startMs)

  // 틱 시작점을 zoom 단위의 경계로 내림(정렬) — UTC 기준.
  const cursor = new Date(start)
  cursor.setUTCHours(0, 0, 0, 0)

  if (zoom === 'day') {
    // 일 단위: 하루마다 틱.
    while (cursor.getTime() <= endMs) {
      ticks.push(new Date(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  } else if (zoom === 'week') {
    // 주 단위: 월요일 기준(ISO 주).
    const day = cursor.getUTCDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    cursor.setUTCDate(cursor.getUTCDate() + diffToMonday)
    while (cursor.getTime() <= endMs) {
      ticks.push(new Date(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 7)
    }
  } else if (zoom === 'month') {
    // 월 단위: 매 월 1일.
    cursor.setUTCDate(1)
    while (cursor.getTime() <= endMs) {
      ticks.push(new Date(cursor))
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  } else {
    // quarter: 분기 시작(1/4/7/10월).
    cursor.setUTCDate(1)
    const q = Math.floor(cursor.getUTCMonth() / 3) * 3
    cursor.setUTCMonth(q)
    while (cursor.getTime() <= endMs) {
      ticks.push(new Date(cursor))
      cursor.setUTCMonth(cursor.getUTCMonth() + 3)
    }
  }

  // 성능 가드(N3): 틱이 상한을 넘으면 한 단계 큰 단위로 폴백(없으면 그대로 캡).
  if (ticks.length > MAX_TICKS) {
    const coarser = COARSER_ZOOM[zoom]
    if (coarser) return buildTicks(startMs, endMs, coarser)
    return ticks.slice(0, MAX_TICKS)
  }

  return ticks
}

/** 틱 Date → 표시 라벨 문자열. 틱이 UTC 경계이므로 라벨도 UTC 필드로 읽는다(결정성). */
export function tickLabel(date: Date, zoom: ZoomLevel): string {
  const y = date.getUTCFullYear()
  const m = date.getUTCMonth() + 1
  const d = date.getUTCDate()
  if (zoom === 'day') return `${m}/${d}`
  if (zoom === 'week') return `${m}/${d}`
  if (zoom === 'month') return `${y}.${String(m).padStart(2, '0')}`
  // quarter
  const q = Math.floor(date.getUTCMonth() / 3) + 1
  return `${y} Q${q}`
}
