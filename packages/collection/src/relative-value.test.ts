import { describe, expect, it } from 'vitest'

import {
  ME_VALUE,
  UNRESOLVED_ME,
  hasMinuteRelative,
  isRelativeDateValue,
  isRelativeRangeValue,
  isRelativeMeValue,
  isRelativeValue,
  relativeDateLabel,
  relativeDayOfOrdinal,
  relativeClockKey,
  relativeDayOrdinal,
  relativeValueLabel,
  resolveRelativeDate,
  resolveRelativeFilters,
  resolveRelativeInstant,
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

describe('「나」 — 보는 사람', () => {
  const tree = (...children: FilterGroup['children']): FilterGroup => ({ op: 'and', children })

  it('보는 사람의 계정 id 로 풀린다 — is·has 모두 값만 바뀐다', () => {
    const out = resolveRelativeFilters(
      tree(
        { key: 'x:담당', op: 'eq', value: ME_VALUE },
        { key: 'x:함께', op: 'not_has', value: ME_VALUE },
      ),
      { now: NOW, me: 'acc-1' },
    )
    expect(out.children).toEqual([
      { key: 'x:담당', op: 'eq', value: 'acc-1' },
      { key: 'x:함께', op: 'not_has', value: 'acc-1' },
    ])
  })

  it('보는 사람을 모르면 아무도 아닌 사람으로 풀린다 — 조건을 떨궈 목록이 넓어지지 않게', () => {
    const out = resolveRelativeFilters(tree({ key: 'x:담당', op: 'eq', value: ME_VALUE }), {
      now: NOW,
    })
    expect(out.children[0]).toEqual({ key: 'x:담당', op: 'eq', value: UNRESOLVED_ME })
  })

  it('상대값으로 판별되고, 칩에는 「나」로 보인다', () => {
    expect(isRelativeValue(ME_VALUE)).toBe(true)
    expect(isRelativeMeValue(ME_VALUE)).toBe(true)
    expect(isRelativeDateValue(ME_VALUE)).toBe(false)
    expect(relativeValueLabel(ME_VALUE)).toBe('나')
  })
})

describe('그 분 — 일 단위 상대값 + 시각', () => {
  const NOON = { rel: 'date', unit: 'day', offset: 0, time: '12:00' } as const

  it('연산자와 무관하게 `YYYY-MM-DDTHH:mm` 한 순간으로 풀린다', () => {
    const filters: FilterGroup = {
      op: 'and',
      children: [
        { key: 'visitAt', op: 'lt', value: NOON },
        { key: 'visitAt', op: 'eq', value: { ...NOON, offset: -1 } },
      ],
    }
    expect(resolveRelativeFilters(filters, { now: NOW })).toEqual({
      op: 'and',
      children: [
        { key: 'visitAt', op: 'lt', value: '2026-09-12T12:00' },
        { key: 'visitAt', op: 'eq', value: '2026-09-11T12:00' },
      ],
    })
  })

  it('표기는 날 + 시각', () => {
    expect(relativeDateLabel(NOON)).toBe('오늘 12:00')
    expect(relativeDateLabel({ ...NOON, offset: -1, time: '00:00' })).toBe('어제 00:00')
  })

  it('주·달에 붙은 시각과 깨진 시각은 무시한다 — 범위 그대로', () => {
    expect(relativeDateLabel({ rel: 'date', unit: 'week', offset: 0, time: '12:00' })).toBe(
      '이번 주',
    )
    const broken: FilterGroup = {
      op: 'and',
      children: [{ key: 'd', op: 'eq', value: { ...NOON, time: '25:00' } }],
    }
    expect(resolveRelativeFilters(broken, { now: NOW }).children).toEqual([
      { key: 'd', op: 'eq', value: '2026-09-12' },
    ])
  })
})

describe('임의의 일 수 — N일 전/후', () => {
  const tree = (...children: FilterGroup['children']): FilterGroup => ({ op: 'and', children })

  it('프리셋 밖 오프셋도 같은 저장 형태로 그 날이 된다', () => {
    expect(resolveRelativeDate({ rel: 'date', unit: 'day', offset: -3 }, NOW)).toEqual({
      start: '2026-09-09',
      end: '2026-09-09',
    })
    // 달·해를 넘긴다.
    expect(resolveRelativeDate({ rel: 'date', unit: 'day', offset: 120 }, NOW)).toEqual({
      start: '2027-01-10',
      end: '2027-01-10',
    })
  })

  it('연산자마다 그 날 하나로 풀린다(하루짜리 범위)', () => {
    const v = { rel: 'date', unit: 'day', offset: -3 } as const
    expect(
      resolveRelativeFilters(
        tree(
          { key: 'visitAt', op: 'eq', value: v },
          { key: 'visitAt', op: 'neq', value: v },
          { key: 'visitAt', op: 'lt', value: v },
          { key: 'visitAt', op: 'gte', value: v },
        ),
        { now: NOW },
      ).children,
    ).toEqual([
      { key: 'visitAt', op: 'eq', value: '2026-09-09' },
      { key: 'visitAt', op: 'neq', value: '2026-09-09' },
      { key: 'visitAt', op: 'lt', value: '2026-09-09' },
      { key: 'visitAt', op: 'gte', value: '2026-09-09' },
    ])
  })

  it('시각이 붙으면 그날의 그 분', () => {
    expect(
      resolveRelativeInstant({ rel: 'date', unit: 'day', offset: -3, time: '18:00' }, NOW),
    ).toBe('2026-09-09T18:00')
    expect(resolveRelativeInstant({ rel: 'date', unit: 'day', offset: -3 }, NOW)).toBeNull()
    expect(resolveRelativeInstant({ rel: 'date', unit: 'week', offset: 0 }, NOW)).toBeNull()
  })

  it('표기 — 이름 없는 오프셋은 세어서', () => {
    expect(relativeDateLabel({ rel: 'date', unit: 'day', offset: -3 })).toBe('3일 전')
    expect(relativeDateLabel({ rel: 'date', unit: 'day', offset: 30 })).toBe('30일 후')
    expect(relativeDateLabel({ rel: 'date', unit: 'day', offset: -3, time: '18:00' })).toBe(
      '3일 전 18:00',
    )
  })
})

describe('N일 차 — 1일 차 = 당일, 별도 저장 형태 없음', () => {
  it('N일 차 = (N-1)일 전', () => {
    expect(relativeDayOfOrdinal(1)).toEqual({ rel: 'date', unit: 'day', offset: 0 })
    expect(relativeDayOfOrdinal(4)).toEqual({ rel: 'date', unit: 'day', offset: -3 })
    expect(relativeDayOfOrdinal(0)).toEqual({ rel: 'date', unit: 'day', offset: 0 })
  })

  it('저장값 → N(오늘·과거만). 미래·다른 눈금은 없다', () => {
    expect(relativeDayOrdinal({ rel: 'date', unit: 'day', offset: 0 })).toBe(1)
    expect(relativeDayOrdinal({ rel: 'date', unit: 'day', offset: -5 })).toBe(6)
    expect(relativeDayOrdinal({ rel: 'date', unit: 'day', offset: 2 })).toBeNull()
    expect(relativeDayOrdinal({ rel: 'date', unit: 'hour', offset: -2 })).toBeNull()
    expect(relativeDayOrdinal({ rel: 'date', unit: 'week', offset: 0 })).toBeNull()
  })
})

describe('시간 — N시간 전/후는 지금 ± N시간의 그 분', () => {
  const AT = new Date(2026, 9, 17, 14, 25, 41) // 2026-10-17 14:25:41 (로컬)
  const hour = (offset: number) => ({ rel: 'date', unit: 'hour', offset }) as const

  it('지금 ± N시간 — 초 아래는 버린다', () => {
    expect(resolveRelativeInstant(hour(0), AT)).toBe('2026-10-17T14:25')
    expect(resolveRelativeInstant(hour(-2), AT)).toBe('2026-10-17T12:25')
    expect(resolveRelativeInstant(hour(3), AT)).toBe('2026-10-17T17:25')
    expect(resolveRelativeInstant(hour(-48), AT)).toBe('2026-10-15T14:25')
  })

  it('자정을 넘는다 — 23:30 + 2시간 = 다음 날 01:30, 00:30 - 1시간 = 전날 23:30', () => {
    expect(resolveRelativeInstant(hour(2), new Date(2026, 9, 17, 23, 30))).toBe('2026-10-18T01:30')
    expect(resolveRelativeInstant(hour(-1), new Date(2026, 9, 1, 0, 30))).toBe('2026-09-30T23:30')
    // 해도 넘는다.
    expect(resolveRelativeInstant(hour(1), new Date(2026, 11, 31, 23, 15))).toBe('2027-01-01T00:15')
  })

  it('연산자와 무관하게 리터럴 하나로 풀린다 — 범위로 벌어지지 않는다', () => {
    const filters: FilterGroup = {
      op: 'and',
      children: [
        { key: 'visitAt', op: 'eq', value: hour(-2) },
        { key: 'visitAt', op: 'neq', value: hour(-2) },
        { key: 'visitAt', op: 'lt', value: hour(-2) },
        { key: 'visitAt', op: 'lte', value: hour(0) },
        { key: 'visitAt', op: 'gt', value: hour(1) },
        { key: 'visitAt', op: 'gte', value: hour(1) },
      ],
    }
    expect(resolveRelativeFilters(filters, { now: AT }).children).toEqual([
      { key: 'visitAt', op: 'eq', value: '2026-10-17T12:25' },
      { key: 'visitAt', op: 'neq', value: '2026-10-17T12:25' },
      { key: 'visitAt', op: 'lt', value: '2026-10-17T12:25' },
      { key: 'visitAt', op: 'lte', value: '2026-10-17T14:25' },
      { key: 'visitAt', op: 'gt', value: '2026-10-17T15:25' },
      { key: 'visitAt', op: 'gte', value: '2026-10-17T15:25' },
    ])
  })

  it('시각 칸(time)은 시간 단위에 붙지 않는다 — 붙어 있어도 지금이 시각을 정한다', () => {
    expect(resolveRelativeInstant({ ...hour(-2), time: '09:00' }, AT)).toBe('2026-10-17T12:25')
    expect(relativeDateLabel({ ...hour(-2), time: '09:00' })).toBe('2시간 전')
  })

  it('표기 — 지금 · N시간 전 · N시간 후', () => {
    expect(relativeDateLabel(hour(0))).toBe('지금')
    expect(relativeDateLabel(hour(-2))).toBe('2시간 전')
    expect(relativeDateLabel(hour(24))).toBe('24시간 후')
    expect(relativeValueLabel(hour(-1))).toBe('1시간 전')
  })

  it('입력을 바꾸지 않는다(순수)', () => {
    const filters: FilterGroup = {
      op: 'and',
      children: [{ key: 'visitAt', op: 'gte', value: hour(-2) }],
    }
    const before = JSON.stringify(filters)
    resolveRelativeFilters(filters, { now: AT })
    expect(JSON.stringify(filters)).toBe(before)
  })
})

describe('모르는 눈금 — 망가진 저장값·다음 판의 눈금', () => {
  // 저장된 뷰는 서버에 불투명 JSON 으로 실린다 — 런타임 검사가 없으니 모르는 눈금이 들어올 수 있다.
  const odd = (unit: string, offset = -2) =>
    ({ rel: 'date', unit, offset }) as unknown as Parameters<typeof relativeDateLabel>[0]

  it('범위 눈금은 허용 목록으로 센다 — 시간도 모르는 눈금도 범위가 아니다', () => {
    expect(isRelativeRangeValue(odd('day'))).toBe(true)
    expect(isRelativeRangeValue(odd('week'))).toBe(true)
    expect(isRelativeRangeValue(odd('month'))).toBe(true)
    expect(isRelativeRangeValue(odd('hour'))).toBe(false)
    expect(isRelativeRangeValue(odd('quarter'))).toBe(false)
  })

  it('모르는 눈금은 달로 세지 않고 아무것도 맞히지 않는 조건으로 풀린다(조건을 떨궈 넓히지도 않는다)', () => {
    for (const op of ['eq', 'neq', 'lt', 'lte', 'gt', 'gte'] as const) {
      const out = resolveRelativeFilters(
        { op: 'and', children: [{ key: 'visitAt', op, value: odd('quarter') }] },
        { now: NOW },
      )
      expect(out.children).toEqual([
        {
          op: 'and',
          children: [
            { key: 'visitAt', op: 'is_empty' },
            { key: 'visitAt', op: 'is_not_empty' },
          ],
        },
      ])
    }
  })

  it('표기도 결과(0건)와 어긋나지 않게 「알 수 없는 날짜」로 원래 값을 보인다', () => {
    expect(relativeDateLabel(odd('quarter'))).toBe('알 수 없는 날짜(quarter -2)')
    expect(relativeValueLabel(odd('minute', 5))).toBe('알 수 없는 날짜(minute 5)')
  })
})

describe('다시 풀 때 — 분 단위로 낡는 필터', () => {
  const AT = new Date(2026, 9, 19, 10, 17, 42)
  const group = (value: unknown): FilterGroup => ({
    op: 'and',
    children: [
      { key: 'status', op: 'eq', value: 'x' },
      { op: 'or', children: [{ key: 'visitAt', op: 'lte', value: value as never }] },
    ],
  })

  it('시간 단위가 어디든(중첩 그룹 포함) 걸려 있으면 분, 아니면 그날', () => {
    const hourFilter = group({ rel: 'date', unit: 'hour', offset: -2 })
    const dayFilter = group({ rel: 'date', unit: 'day', offset: 0, time: '12:00' })
    expect(hasMinuteRelative(hourFilter)).toBe(true)
    expect(hasMinuteRelative(dayFilter)).toBe(false)
    expect(hasMinuteRelative(undefined)).toBe(false)
    expect(relativeClockKey(hourFilter, AT)).toBe('2026-10-19T10:17')
    expect(relativeClockKey(dayFilter, AT)).toBe('2026-10-19')
  })
})
