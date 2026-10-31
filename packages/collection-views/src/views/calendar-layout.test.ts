import { describe, it, expect } from 'vitest'
import { layoutWeek, type CalendarEvent } from './calendar-layout'

// 한 주 = 2026-06-01(월요일 아님 무관) ~ 06-07 의 7개 연속 일자 키.
const WEEK = [
  '2026-06-01',
  '2026-06-02',
  '2026-06-03',
  '2026-06-04',
  '2026-06-05',
  '2026-06-06',
  '2026-06-07',
]

const ev = (id: string, startKey: string, endKey: string): CalendarEvent => ({
  id,
  title: id,
  startKey,
  endKey,
})

describe('layoutWeek', () => {
  it('단일 일자 → 한 칸 세그먼트(잘림 없음)', () => {
    const { segments } = layoutWeek(WEEK, [ev('a', '2026-06-02', '2026-06-02')], 3)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({
      id: 'a',
      colStart: 1,
      colEnd: 1,
      continuesLeft: false,
      continuesRight: false,
      lane: 0,
    })
  })

  it('주 내 기간 → 열 범위 세그먼트', () => {
    const { segments } = layoutWeek(WEEK, [ev('a', '2026-06-02', '2026-06-04')], 3)
    expect(segments[0]).toMatchObject({
      colStart: 1,
      colEnd: 3,
      continuesLeft: false,
      continuesRight: false,
    })
  })

  it('주 시작 이전부터 → 왼쪽 잘림(continuesLeft, colStart=0)', () => {
    const { segments } = layoutWeek(WEEK, [ev('a', '2026-05-30', '2026-06-02')], 3)
    expect(segments[0]).toMatchObject({
      colStart: 0,
      colEnd: 1,
      continuesLeft: true,
      continuesRight: false,
    })
  })

  it('주 끝 이후까지 → 오른쪽 잘림(continuesRight, colEnd=6)', () => {
    const { segments } = layoutWeek(WEEK, [ev('a', '2026-06-06', '2026-06-10')], 3)
    expect(segments[0]).toMatchObject({
      colStart: 5,
      colEnd: 6,
      continuesLeft: false,
      continuesRight: true,
    })
  })

  it('주 전체를 덮는 기간 → 양쪽 잘림(0..6)', () => {
    const { segments } = layoutWeek(WEEK, [ev('a', '2026-05-01', '2026-07-01')], 3)
    expect(segments[0]).toMatchObject({
      colStart: 0,
      colEnd: 6,
      continuesLeft: true,
      continuesRight: true,
    })
  })

  it('교차하지 않는 이벤트는 세그먼트 없음', () => {
    const { segments } = layoutWeek(WEEK, [ev('a', '2026-06-20', '2026-06-25')], 3)
    expect(segments).toHaveLength(0)
  })

  it('겹치는 두 이벤트 → 서로 다른 lane', () => {
    const { segments } = layoutWeek(
      WEEK,
      [ev('a', '2026-06-02', '2026-06-04'), ev('b', '2026-06-03', '2026-06-05')],
      3,
    )
    expect(segments.find((s) => s.id === 'a')?.lane).toBe(0)
    expect(segments.find((s) => s.id === 'b')?.lane).toBe(1)
  })

  it('겹치지 않는 두 이벤트 → 같은 lane 재사용', () => {
    const { segments } = layoutWeek(
      WEEK,
      [ev('a', '2026-06-01', '2026-06-02'), ev('b', '2026-06-04', '2026-06-05')],
      3,
    )
    expect(segments.find((s) => s.id === 'a')?.lane).toBe(0)
    expect(segments.find((s) => s.id === 'b')?.lane).toBe(0)
  })

  it('maxLanes 초과 → 덮는 열마다 overflowByCol 증가, 세그먼트 제외', () => {
    const { segments, overflowByCol } = layoutWeek(
      WEEK,
      [
        ev('a', '2026-06-02', '2026-06-03'),
        ev('b', '2026-06-02', '2026-06-03'),
        ev('c', '2026-06-02', '2026-06-03'),
      ],
      2,
    )
    // a→lane0, b→lane1, c→overflow(lane2 >= maxLanes 2).
    expect(segments.map((s) => s.id).sort()).toEqual(['a', 'b'])
    expect(overflowByCol[1]).toBe(1) // 06-02 열
    expect(overflowByCol[2]).toBe(1) // 06-03 열
    expect(overflowByCol[0]).toBe(0)
  })
})
