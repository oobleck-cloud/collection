import { describe, expect, it } from 'vitest'

import {
  isRelativeValue,
  relativeDateLabel,
  resolveRelativeDate,
  resolveRelativeFilters,
} from './relative-value'

import type { FilterGroup } from './types'

/**
 * 상대값의 계약 — **저장은 식으로, 실행은 리터럴로**.
 *
 * 기준 시각은 언제나 주입한다. 2026-09-12 는 토요일이라 주 경계(월~일)와 달 경계가
 * 한 번에 드러난다.
 */
const NOW = new Date(2026, 8, 12) // 2026-09-12 (토)

describe('상대 날짜 해소', () => {
  it('하루는 한 점이다', () => {
    expect(resolveRelativeDate({ rel: 'date', unit: 'day', offset: 0 }, NOW)).toEqual({
      start: '2026-09-12',
      end: '2026-09-12',
    })
    expect(resolveRelativeDate({ rel: 'date', unit: 'day', offset: -7 }, NOW)).toEqual({
      start: '2026-09-05',
      end: '2026-09-05',
    })
  })

  it('주는 월요일에 시작한다 — 방문 일정이 주 단위로 돈다', () => {
    expect(resolveRelativeDate({ rel: 'date', unit: 'week', offset: 0 }, NOW)).toEqual({
      start: '2026-09-07',
      end: '2026-09-13',
    })
    expect(resolveRelativeDate({ rel: 'date', unit: 'week', offset: -1 }, NOW)).toEqual({
      start: '2026-08-31',
      end: '2026-09-06',
    })
  })

  it('달은 달의 마지막 날을 안다 — 윤년·30일도', () => {
    expect(resolveRelativeDate({ rel: 'date', unit: 'month', offset: 0 }, NOW)).toEqual({
      start: '2026-09-01',
      end: '2026-09-30',
    })
    expect(
      resolveRelativeDate({ rel: 'date', unit: 'month', offset: -7 }, new Date(2024, 8, 12)),
    ).toEqual({ start: '2024-02-01', end: '2024-02-29' })
  })

  it('상대값은 다른 객체값과 섞이지 않는다', () => {
    expect(isRelativeValue({ rel: 'date', unit: 'day', offset: 0 })).toBe(true)
    expect(isRelativeValue({ roadAddress: '서울 강남구' })).toBe(false)
    expect(isRelativeValue({ tag: 'vip' })).toBe(false)
    expect(isRelativeValue('2026-09-12')).toBe(false)
    expect(isRelativeValue(null)).toBe(false)
  })
})

describe('필터 트리 해소', () => {
  const tree = (...children: FilterGroup['children']): FilterGroup => ({ op: 'and', children })

  it('하루 = 는 한 조건 그대로다', () => {
    const out = resolveRelativeFilters(
      tree({ key: 'moveDate', op: 'eq', value: { rel: 'date', unit: 'day', offset: 0 } }),
      { now: NOW },
    )
    expect(out.children[0]).toEqual({ key: 'moveDate', op: 'eq', value: '2026-09-12' })
  })

  it('범위 = 는 두 조건으로 벌어진다 — "이번 주다" 는 한 날짜와 같다는 뜻이 아니다', () => {
    const out = resolveRelativeFilters(
      tree({ key: 'moveDate', op: 'eq', value: { rel: 'date', unit: 'week', offset: 0 } }),
      { now: NOW },
    )
    expect(out.children[0]).toEqual({
      op: 'and',
      children: [
        { key: 'moveDate', op: 'gte', value: '2026-09-07' },
        { key: 'moveDate', op: 'lte', value: '2026-09-13' },
      ],
    })
  })

  it('범위 ≠ 는 그 밖이다 — AND 로 묶으면 아무것도 통과하지 못한다', () => {
    const out = resolveRelativeFilters(
      tree({ key: 'moveDate', op: 'neq', value: { rel: 'date', unit: 'month', offset: 0 } }),
      { now: NOW },
    )
    expect(out.children[0]).toEqual({
      op: 'or',
      children: [
        { key: 'moveDate', op: 'lt', value: '2026-09-01' },
        { key: 'moveDate', op: 'gt', value: '2026-09-30' },
      ],
    })
  })

  it('이후는 범위의 시작, 이전은 범위의 끝을 겨눈다', () => {
    const after = resolveRelativeFilters(
      tree({ key: 'moveDate', op: 'gte', value: { rel: 'date', unit: 'week', offset: 0 } }),
      { now: NOW },
    )
    expect(after.children[0]).toEqual({ key: 'moveDate', op: 'gte', value: '2026-09-07' })

    const before = resolveRelativeFilters(
      tree({ key: 'moveDate', op: 'lte', value: { rel: 'date', unit: 'week', offset: 0 } }),
      { now: NOW },
    )
    expect(before.children[0]).toEqual({ key: 'moveDate', op: 'lte', value: '2026-09-13' })
  })

  it('중첩 그룹 안쪽까지 푼다', () => {
    const out = resolveRelativeFilters(
      tree({
        op: 'or',
        children: [
          { key: 'moveDate', op: 'gte', value: { rel: 'date', unit: 'day', offset: 0 } },
          { key: 'status', op: 'eq', value: 'lead_in' },
        ],
      }),
      { now: NOW },
    )
    expect(out).toEqual({
      op: 'and',
      children: [
        {
          op: 'or',
          children: [
            { key: 'moveDate', op: 'gte', value: '2026-09-12' },
            { key: 'status', op: 'eq', value: 'lead_in' },
          ],
        },
      ],
    })
  })

  it('상대값이 없으면 트리를 그대로 둔다', () => {
    const input = tree({ key: 'status', op: 'eq', value: 'lead_in' })
    expect(resolveRelativeFilters(input, { now: NOW })).toEqual(input)
  })
})

describe('사람이 읽는 표기', () => {
  it('이름 붙은 오프셋은 그 이름으로', () => {
    expect(relativeDateLabel({ rel: 'date', unit: 'day', offset: 0 })).toBe('오늘')
    expect(relativeDateLabel({ rel: 'date', unit: 'day', offset: -1 })).toBe('어제')
    expect(relativeDateLabel({ rel: 'date', unit: 'week', offset: -1 })).toBe('지난주')
    expect(relativeDateLabel({ rel: 'date', unit: 'month', offset: 0 })).toBe('이번 달')
  })

  it('나머지는 세어서 말한다 — 내부 표기(D-7)를 칩에 내보이지 않는다', () => {
    expect(relativeDateLabel({ rel: 'date', unit: 'day', offset: -7 })).toBe('7일 전')
    expect(relativeDateLabel({ rel: 'date', unit: 'day', offset: 3 })).toBe('3일 후')
    expect(relativeDateLabel({ rel: 'date', unit: 'month', offset: -2 })).toBe('2개월 전')
  })
})
