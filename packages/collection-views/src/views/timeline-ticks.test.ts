// 타임라인 틱 — 타임존 일관성 회귀 핀(BL9/N2).
//
// date-only 값은 Date.parse 가 UTC 자정으로 파싱한다. 틱 생성/라벨이 로컬 메서드를 쓰면
// 음수 UTC offset 지역에서 하루 어긋나므로, 음수 offset TZ 를 강제해 회귀를 잡는다.
//   - 구현(로컬 메서드)이면: '2026-01-15' → 틱[0] 라벨 '1/14', getTime ≠ UTC 자정 → 실패.
//   - 수정(UTC 메서드)이면: 어떤 TZ 에서도 '1/15', getTime === Date.UTC(2026,0,15) → 통과.
//
// Node 는 런타임 process.env.TZ 변경을 Date 에 반영하므로 import 전에 설정한다.
process.env.TZ = 'America/New_York' // UTC-5/-4 (음수 offset)

import { describe, it, expect } from 'vitest'
import { buildTicks, tickLabel } from './timeline-ticks'

/** parseDate 와 동일 규칙(date-only → UTC 자정). */
const ms = (iso: string) => Date.parse(iso)

describe('timeline-ticks — 타임존 일관성(UTC 고정)', () => {
  it('day 줌: date-only 값이 음수 offset TZ 에서도 자기 날짜 틱에 정렬(하루 어긋남 없음)', () => {
    const start = ms('2026-01-15')
    const ticks = buildTicks(start, ms('2026-01-17'), 'day')

    expect(ticks).toHaveLength(3)
    // 첫 틱이 정확히 UTC 자정 1/15 — 로컬 메서드였다면 1/14 05:00Z 로 어긋났을 것.
    expect(ticks[0].getTime()).toBe(Date.UTC(2026, 0, 15))
    expect(tickLabel(ticks[0], 'day')).toBe('1/15')
    expect(tickLabel(ticks[1], 'day')).toBe('1/16')
    expect(tickLabel(ticks[2], 'day')).toBe('1/17')
  })

  it('month 줌: 매월 1일 UTC 경계 + 라벨이 TZ 무관하게 결정적', () => {
    const ticks = buildTicks(ms('2026-01-10'), ms('2026-03-05'), 'month')
    expect(ticks.map((t) => t.getTime())).toEqual([
      Date.UTC(2026, 0, 1),
      Date.UTC(2026, 1, 1),
      Date.UTC(2026, 2, 1),
    ])
    expect(ticks.map((t) => tickLabel(t, 'month'))).toEqual(['2026.01', '2026.02', '2026.03'])
  })

  it('week 줌: 월요일(UTC) 경계로 정렬', () => {
    // 2026-01-15 는 목요일 → 그 주 월요일은 2026-01-12.
    const ticks = buildTicks(ms('2026-01-15'), ms('2026-01-20'), 'week')
    expect(ticks[0].getTime()).toBe(Date.UTC(2026, 0, 12))
    expect(ticks[0].getUTCDay()).toBe(1) // 월요일
  })

  it('quarter 줌: 분기 시작월(1/4/7/10) UTC 경계 + Q 라벨', () => {
    const ticks = buildTicks(ms('2026-02-10'), ms('2026-08-01'), 'quarter')
    expect(ticks[0].getTime()).toBe(Date.UTC(2026, 0, 1)) // Q1
    expect(tickLabel(ticks[0], 'quarter')).toBe('2026 Q1')
    expect(tickLabel(ticks[1], 'quarter')).toBe('2026 Q2')
    expect(tickLabel(ticks[2], 'quarter')).toBe('2026 Q3')
  })

  it('성능 가드(N3): day 줌이 MAX_TICKS 초과 시 한 단계 큰 단위로 폴백', () => {
    // 약 3년 범위 → day 틱 ~1095 > 400 → week 로 폴백(틱 수 대폭 감소).
    const dayTicks = buildTicks(ms('2026-01-01'), ms('2028-12-31'), 'day')
    expect(dayTicks.length).toBeLessThanOrEqual(400)
  })
})
