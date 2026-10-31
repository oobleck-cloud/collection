// @oobleck/collection — 캘린더 월 그리드의 "기간 막대(span bar)" 레이아웃 계산(순수).
//
// CalendarView 에서 분리한 순수 로직 — 한 주(7칸) 안에서 각 이벤트(시작~종료 일자 키)를 가로 막대로
// 배치한다. 여러 주에 걸친 이벤트는 주마다 잘려(clip) 세그먼트가 되고, 잘린 쪽은 continuesLeft/Right 로
// 표시(둥근 모서리 생략용). 겹치는 막대는 lane(행)으로 쌓아 충돌을 피한다(그리디 배정). maxLanes 초과분은
// 각 열(day)별 overflow 카운트로 접어 "+k" 로 노출한다.
//
// 일자 키는 'YYYY-MM-DD'(UTC, calendar-grid 규약) — 사전순 비교가 곧 날짜 순서라 문자열 비교로 정렬/교차 판정한다.

/** 캘린더 이벤트 — 한 레코드의 시작~종료 일자(단일이면 start===end). endKey>=startKey 가정(호출자 보장). */
export type CalendarEvent = { id: string; title: string; startKey: string; endKey: string }

/** 한 주 안의 막대 세그먼트 — 열 범위(0..6) + 잘림 여부 + lane. */
export type WeekSegment = {
  id: string
  title: string
  colStart: number
  colEnd: number
  continuesLeft: boolean
  continuesRight: boolean
  lane: number
}

/** 한 주 레이아웃 — 렌더할 세그먼트 + 열별 overflow 카운트(길이 = 주 칸 수). */
export type WeekLayout = { segments: WeekSegment[]; overflowByCol: number[] }

/**
 * 한 주(weekKeys: 7개 연속 일자 키)에 이벤트들을 막대로 배치한다. 이벤트 순서 = lane 우선순위(먼저 온 것이 위 lane).
 * maxLanes 안에 못 들어간 이벤트는 덮는 열마다 overflowByCol++ 로 접는다.
 */
export function layoutWeek(
  weekKeys: string[],
  events: CalendarEvent[],
  maxLanes: number,
): WeekLayout {
  const weekStart = weekKeys[0]
  const weekEnd = weekKeys[weekKeys.length - 1]
  const lanes: Array<Array<{ colStart: number; colEnd: number }>> = []
  const segments: WeekSegment[] = []
  const overflowByCol = new Array<number>(weekKeys.length).fill(0)

  for (const ev of events) {
    // 이 주와 교차하지 않으면 건너뛴다(사전순 비교 = 날짜 비교).
    if (ev.startKey > weekEnd || ev.endKey < weekStart) continue
    const segStartKey = ev.startKey > weekStart ? ev.startKey : weekStart
    const segEndKey = ev.endKey < weekEnd ? ev.endKey : weekEnd
    const colStart = weekKeys.indexOf(segStartKey)
    const colEnd = weekKeys.indexOf(segEndKey)
    if (colStart === -1 || colEnd === -1) continue // 방어(키 불일치)

    // lane 그리디 배정 — 겹치지 않는 첫 lane.
    let lane = 0
    for (;;) {
      const laneSegs = lanes[lane]
      if (!laneSegs) {
        lanes[lane] = []
        break
      }
      const overlaps = laneSegs.some((s) => !(s.colEnd < colStart || colEnd < s.colStart))
      if (!overlaps) break
      lane++
    }
    lanes[lane].push({ colStart, colEnd })

    if (lane < maxLanes) {
      segments.push({
        id: ev.id,
        title: ev.title,
        colStart,
        colEnd,
        continuesLeft: ev.startKey < weekStart,
        continuesRight: ev.endKey > weekEnd,
        lane,
      })
    } else {
      for (let c = colStart; c <= colEnd; c++) overflowByCol[c]++
    }
  }

  return { segments, overflowByCol }
}
