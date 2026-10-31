import { describe, it, expect } from 'vitest'
import {
  dateValueStart,
  dateValueEnd,
  dateValueHasTime,
  dateValueStartMs,
  parseDateValueParts,
  buildDateValue,
  formatDateValueDisplay,
} from './date-value'

// date 값 표현(노션식 확장): 'YYYY-MM-DD' | 'YYYY-MM-DDTHH:mm'(시간) | '<start>/<end>'(기간).
// 하위호환('YYYY-MM-DD' 그대로) + 기간/시간에서도 정렬/필터/투영이 시작 성분으로 안전하게 동작해야 한다.

describe('date-value — 성분 추출', () => {
  it('dateValueStart/End — 기간은 분리, 단일/시간은 시작만', () => {
    expect(dateValueStart('2026-07-01')).toBe('2026-07-01')
    expect(dateValueEnd('2026-07-01')).toBeNull()
    expect(dateValueStart('2026-07-01T14:30')).toBe('2026-07-01T14:30')
    expect(dateValueStart('2026-07-01/2026-07-05')).toBe('2026-07-01')
    expect(dateValueEnd('2026-07-01/2026-07-05')).toBe('2026-07-05')
  })

  it('dateValueHasTime — 시작 성분의 T 유무', () => {
    expect(dateValueHasTime('2026-07-01')).toBe(false)
    expect(dateValueHasTime('2026-07-01T14:30')).toBe(true)
    expect(dateValueHasTime('2026-07-01T09:00/2026-07-05T17:00')).toBe(true)
    expect(dateValueHasTime('2026-07-01/2026-07-05')).toBe(false)
  })

  it('dateValueStartMs — 기간 값도 시작 기준 epoch(널 아님)', () => {
    expect(dateValueStartMs('2026-07-01/2026-07-05')).toBe(Date.parse('2026-07-01'))
    expect(dateValueStartMs('garbage')).toBeNull()
  })
})

describe('date-value — parseDateValueParts (로컬 앵커)', () => {
  it("'YYYY-MM-DD' → 로컬 자정 시작, end/시간 없음(전날 밀림 없음)", () => {
    const p = parseDateValueParts('2026-07-01')
    expect(p.start?.getFullYear()).toBe(2026)
    expect(p.start?.getMonth()).toBe(6)
    expect(p.start?.getDate()).toBe(1)
    expect(p.end).toBeNull()
    expect(p.hasTime).toBe(false)
  })

  it('datetime → 시각 파싱', () => {
    const p = parseDateValueParts('2026-07-01T14:30')
    expect(p.start?.getHours()).toBe(14)
    expect(p.start?.getMinutes()).toBe(30)
    expect(p.hasTime).toBe(true)
  })

  it('기간(시간 포함) → start·end 각각 파싱', () => {
    const p = parseDateValueParts('2026-07-01T09:00/2026-07-05T17:00')
    expect(p.start?.getDate()).toBe(1)
    expect(p.start?.getHours()).toBe(9)
    expect(p.end?.getDate()).toBe(5)
    expect(p.end?.getHours()).toBe(17)
    expect(p.hasTime).toBe(true)
  })

  it('빈값 → start null', () => {
    expect(parseDateValueParts('').start).toBeNull()
    expect(parseDateValueParts(null).start).toBeNull()
  })
})

describe('date-value — buildDateValue', () => {
  it('단일/시간/기간 직렬화', () => {
    expect(buildDateValue({ start: new Date(2026, 6, 1) })).toBe('2026-07-01')
    expect(buildDateValue({ start: new Date(2026, 6, 1, 14, 30), hasTime: true })).toBe(
      '2026-07-01T14:30',
    )
    expect(buildDateValue({ start: new Date(2026, 6, 1), end: new Date(2026, 6, 5) })).toBe(
      '2026-07-01/2026-07-05',
    )
  })

  it('역전된 기간은 시작<=종료로 교환', () => {
    expect(buildDateValue({ start: new Date(2026, 6, 5), end: new Date(2026, 6, 1) })).toBe(
      '2026-07-01/2026-07-05',
    )
  })

  it('라운드트립 — parse → build 동일', () => {
    for (const v of ['2026-07-01', '2026-07-01T14:30', '2026-07-01/2026-07-05']) {
      const p = parseDateValueParts(v)
      expect(buildDateValue({ start: p.start!, end: p.end, hasTime: p.hasTime })).toBe(v)
    }
  })
})

describe('date-value — formatDateValueDisplay', () => {
  it('단일은 날짜, 기간은 "~", 시간은 HH:mm 포함', () => {
    expect(formatDateValueDisplay('2026-07-01')).toContain('2026')
    expect(formatDateValueDisplay('2026-07-01/2026-07-05')).toContain('~')
    expect(formatDateValueDisplay('2026-07-01T14:30')).toContain('14:30')
    expect(formatDateValueDisplay('')).toBe('')
  })
})
