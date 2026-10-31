// 캘린더 월 그리드 — 그리드 구조 + 타임존 일관성 회귀 핀(BL9/N2, #34).
//
// date-only 값은 Date.parse 가 UTC 자정으로 파싱한다. 셀 키·일자 귀속이 로컬 메서드를 쓰면
// 음수 UTC offset 지역에서 하루 어긋나므로, 음수 offset TZ 를 강제해 회귀를 잡는다.
//   - 구현(로컬 메서드)이면: '2026-06-01' → 6/1 셀이 아니라 5/31 셀에 귀속 → 실패.
//   - 수정(UTC 메서드)이면: 어떤 TZ 에서도 6/1 셀에 귀속 → 통과.
//
// Node 는 런타임 process.env.TZ 변경을 Date 에 반영하므로 import 전에 설정한다.
process.env.TZ = 'America/New_York' // UTC-5/-4 (음수 offset)

import { describe, it, expect } from 'vitest'
import { buildMonthGrid, isoToDayKey } from './calendar-grid'

describe('calendar-grid — 월 그리드 구조(일요일 시작, UTC)', () => {
  it('그리드 길이는 항상 7의 배수(주 단위로 꽉 채움)', () => {
    // 여러 달을 표본으로 — 4·5·6주 케이스가 모두 7의 배수여야 함.
    for (const [y, m] of [
      [2026, 0], // 2026-01
      [2026, 5], // 2026-06 (오늘 기준 달)
      [2024, 1], // 2024-02 (윤년)
      [2026, 1], // 2026-02 (평년)
      [2026, 10], // 2026-11
    ] as const) {
      const { days } = buildMonthGrid(y, m)
      expect(days.length % 7).toBe(0)
    }
  })

  it('첫 주 선행 오프셋: 1일의 요일만큼 앞쪽 인접월 셀로 채운다', () => {
    // 2026-06-01 은 월요일(getUTCDay=1) → 그리드 첫 셀은 일요일 2026-05-31, 인접월(inMonth=false).
    const { days } = buildMonthGrid(2026, 5)
    expect(days[0]).toEqual({ date: '2026-05-31', inMonth: false })
    expect(days[1]).toEqual({ date: '2026-06-01', inMonth: true })
  })

  it('1일이 일요일이면 선행 채움 0칸(첫 셀이 곧 1일)', () => {
    // 2026-03-01 은 일요일 → 선행 인접월 셀 없이 바로 시작.
    const { days } = buildMonthGrid(2026, 2)
    expect(days[0]).toEqual({ date: '2026-03-01', inMonth: true })
  })

  it('31일 달(2026-01): inMonth 셀이 정확히 31개', () => {
    const { days } = buildMonthGrid(2026, 0)
    const inMonth = days.filter((d) => d.inMonth)
    expect(inMonth).toHaveLength(31)
    expect(inMonth[0].date).toBe('2026-01-01')
    expect(inMonth[30].date).toBe('2026-01-31')
  })

  it('윤년 2월(2024-02): inMonth 셀 29개, 29일 존재', () => {
    const { days } = buildMonthGrid(2024, 1)
    const inMonth = days.filter((d) => d.inMonth)
    expect(inMonth).toHaveLength(29)
    expect(inMonth.at(-1)?.date).toBe('2024-02-29')
  })

  it('평년 2월(2026-02): inMonth 셀 28개, 29일 없음', () => {
    const { days } = buildMonthGrid(2026, 1)
    const inMonth = days.filter((d) => d.inMonth)
    expect(inMonth).toHaveLength(28)
    expect(inMonth.at(-1)?.date).toBe('2026-02-28')
    expect(days.some((d) => d.date === '2026-02-29')).toBe(false)
  })

  it('월 경계: 직전/직후 달의 채움 셀은 inMonth=false', () => {
    // 2026-06(1일=월요일) 그리드 — 선행은 5월, 후행은 7월 셀. 모두 inMonth=false 여야 함.
    const { days } = buildMonthGrid(2026, 5)
    const leading = days.filter((d) => d.date.startsWith('2026-05'))
    const trailing = days.filter((d) => d.date.startsWith('2026-07'))
    expect(leading.length).toBeGreaterThan(0)
    expect(trailing.length).toBeGreaterThan(0)
    for (const d of [...leading, ...trailing]) expect(d.inMonth).toBe(false)
  })

  it('연말 경계(2026-12): 다음 해 1월 셀로 후행 채움(연도 롤오버 정확)', () => {
    const { days } = buildMonthGrid(2026, 11)
    const inMonth = days.filter((d) => d.inMonth)
    expect(inMonth.at(-1)?.date).toBe('2026-12-31')
    // 후행 채움은 2027-01-xx — 연도 비교가 틀리면 inMonth 오판 발생.
    const trailing = days.filter((d) => d.date.startsWith('2027-01'))
    for (const d of trailing) expect(d.inMonth).toBe(false)
  })

  it('주 수: 2026-08(토요일 시작)은 6주(42칸)', () => {
    // 2026-08-01 은 토요일 → 1일 단독 주 + 31일까지 → 6주 그리드.
    const { days } = buildMonthGrid(2026, 7)
    expect(days.length).toBe(42)
    expect(days[0]).toEqual({ date: '2026-07-26', inMonth: false })
  })
})

describe('isoToDayKey — ISO 날짜값 → UTC 일자 키', () => {
  it('date-only 값은 그 날짜 키로(음수 offset TZ 에서도 어긋남 없음)', () => {
    // 로컬 메서드였다면 UTC-5 에서 5/31 로 어긋났을 값.
    expect(isoToDayKey('2026-06-01')).toBe('2026-06-01')
  })

  it('datetime(타임존 포함) 값도 UTC 일자로 환산', () => {
    // 2026-06-01T23:30:00Z → UTC 기준 6/1.
    expect(isoToDayKey('2026-06-01T23:30:00Z')).toBe('2026-06-01')
  })

  it('빈 문자열·null·파싱 불가 값은 null', () => {
    expect(isoToDayKey('')).toBeNull()
    expect(isoToDayKey(null)).toBeNull()
    expect(isoToDayKey(undefined)).toBeNull()
    expect(isoToDayKey('not-a-date')).toBeNull()
  })
})
