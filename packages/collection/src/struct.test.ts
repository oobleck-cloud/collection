import { describe, expect, it } from 'vitest'

import {
  formatStructText,
  parseUnitNumberInput,
  resolveStruct,
  resolveStructFilters,
  resolveStructSorts,
  structSlotColumns,
  toSourceValue,
} from './struct'

import type { PropertyDef } from './types'

const num = (key: string, label: string, unit?: 'won' | 'manwon'): PropertyDef => ({
  key,
  label,
  type: 'number',
  source: 'frontmatter',
  origin: 'base',
  ...(unit ? { unit } : {}),
})

const WISH = num('x:희망_금액', '희망 금액', 'manwon')
const OTHER = num('x:타업체_견적_금액', '타업체 견적 금액', 'manwon')
const LOWEST = { ...num('lowestQuotePrice', '최저 견적가', 'won'), source: 'projection' } as const
const GAP = { ...num('wishPriceGap', '희망가 차이', 'manwon'), source: 'projection' } as const

const COMPARE: PropertyDef = {
  key: 'x:희망가_비교',
  label: '희망가 비교',
  type: 'struct',
  source: 'projection',
  origin: 'base',
  struct: {
    layout: 'compare',
    better: 'lower',
    slots: [
      { role: 'from', label: '기준가', keys: ['x:희망_금액', 'x:타업체_견적_금액'] },
      { role: 'to', label: '전달 최저 견적', keys: ['lowestQuotePrice'] },
      { role: 'diff', keys: ['wishPriceGap'] },
    ],
  },
}

const SCHEMA = [WISH, OTHER, LOWEST, GAP, COMPARE]

describe('resolveStruct', () => {
  it('앞에서부터 첫 값 — 희망 금액이 없으면 타업체 금액을 쓰고, 원 단위 칸을 만 원으로 맞춘다', () => {
    const resolved = resolveStruct(
      COMPARE,
      { 'x:타업체_견적_금액': 200, lowestQuotePrice: 2050000, wishPriceGap: 5 },
      SCHEMA,
    )
    expect(resolved?.slots[0]?.used?.key).toBe('x:타업체_견적_금액')
    expect(resolved?.unit).toBe('manwon')
    expect(resolved?.diff).toBe(5)
    expect(resolved?.diffTone).toBe('bad')
    expect(formatStructText(resolved)).toBe('200만 → 205만 (+5만)')
  })

  it('diff 칸이 없으면 to − from 으로 셈한다', () => {
    const noDiff: PropertyDef = {
      ...COMPARE,
      struct: { ...COMPARE.struct!, slots: COMPARE.struct!.slots.slice(0, 2) },
    }
    const resolved = resolveStruct(
      noDiff,
      { 'x:희망_금액': 180, lowestQuotePrice: 1740000 },
      SCHEMA,
    )
    expect(resolved?.diff).toBe(-6)
    expect(resolved?.diffTone).toBe('good')
  })

  it('스키마에 없는 키(폐기)와 구조 속성 키는 칸에서 빠지고, 모두 비면 빈 값', () => {
    const resolved = resolveStruct(COMPARE, {}, [COMPARE])
    expect(resolved?.empty).toBe(true)
    expect(resolved?.slots[0]?.sources).toEqual([])
    expect(formatStructText(resolved)).toBe('')
  })

  it('range 는 같으면 하나만', () => {
    const range: PropertyDef = {
      ...COMPARE,
      key: 'x:희망가',
      struct: {
        layout: 'range',
        slots: [
          { role: 'min', keys: ['x:희망_금액_하한'] },
          { role: 'max', keys: ['x:희망_금액'] },
        ],
      },
    }
    const schema = [num('x:희망_금액_하한', '희망 금액 하한', 'manwon'), WISH, range]
    expect(
      formatStructText(
        resolveStruct(range, { 'x:희망_금액_하한': 90, 'x:희망_금액': 100 }, schema),
      ),
    ).toBe('90만 ~ 100만')
    expect(
      formatStructText(
        resolveStruct(range, { 'x:희망_금액_하한': 100, 'x:희망_금액': 100 }, schema),
      ),
    ).toBe('100만')
  })

  it('내장 계산 열만으로 칸을 짓고, 이름표를 적지 않은 칸은 행의 출처 값을 이름표로 쓴다', () => {
    const base: PropertyDef = {
      ...num('wishPriceBase', '조율 기준가', 'manwon'),
      source: 'projection',
      cardLabelKey: 'wishPriceBaseSource',
    }
    const delivered = {
      ...num('lowestDeliveredPrice', '전달 최저가', 'manwon'),
      source: 'projection',
    } as const
    const builtIn: PropertyDef = {
      ...COMPARE,
      struct: {
        layout: 'compare',
        better: 'lower',
        slots: [
          { role: 'from', keys: ['wishPriceBase'] },
          { role: 'to', label: '전달 최저 견적', keys: ['lowestDeliveredPrice'] },
          { role: 'diff', keys: ['wishPriceGap'] },
        ],
      },
    }
    const schema = [base, delivered, GAP, builtIn]
    const row = {
      wishPriceBase: 100,
      wishPriceBaseSource: '타업체 견적',
      lowestDeliveredPrice: 120,
      wishPriceGap: 20,
    }
    const resolved = resolveStruct(builtIn, row, schema)
    expect(resolved?.slots.map((s) => [s.label, s.value])).toEqual([
      ['타업체 견적', 100],
      ['전달 최저 견적', 120],
      ['희망가 차이', 20],
    ])
    expect(resolved?.diff).toBe(20)
    // 출처가 비면 열 이름표
    expect(
      resolveStruct(builtIn, { ...row, wishPriceBaseSource: null }, schema)?.slots[0]?.label,
    ).toBe('조율 기준가')
  })
})

describe('칸 조건', () => {
  it('칸 컬럼은 검색 전용이고 첫 키의 타입 · 단위를 따른다', () => {
    const columns = structSlotColumns(SCHEMA)
    expect(columns.map((c) => c.key)).toEqual([
      'x:희망가_비교.from',
      'x:희망가_비교.to',
      'x:희망가_비교.diff',
    ])
    expect(columns[0]).toMatchObject({
      label: '희망가 비교 › 기준가',
      type: 'number',
      searchOnly: true,
    })
  })

  it('키 하나인 칸은 바꿔 끼우고, 첫 값 칸은 COALESCE 의미로 편다', () => {
    const resolved = resolveStructFilters(
      {
        op: 'and',
        children: [
          { key: 'x:희망가_비교.to', op: 'gte', value: 1000000 },
          { key: 'x:희망가_비교.from', op: 'lt', value: 100 },
          { key: 'status', op: 'eq', value: 'quote_delivered' },
        ],
      },
      SCHEMA,
    )
    expect(resolved.children[0]).toEqual({ key: 'lowestQuotePrice', op: 'gte', value: 1000000 })
    expect(resolved.children[1]).toEqual({
      op: 'or',
      children: [
        { op: 'and', children: [{ key: 'x:희망_금액', op: 'lt', value: 100 }] },
        {
          op: 'and',
          children: [
            { key: 'x:희망_금액', op: 'is_empty' },
            { key: 'x:타업체_견적_금액', op: 'lt', value: 100 },
          ],
        },
      ],
    })
    expect(resolved.children[2]).toEqual({ key: 'status', op: 'eq', value: 'quote_delivered' })
  })

  it('첫 값 칸의 비어 있음은 모두 비어 있음', () => {
    const resolved = resolveStructFilters(
      { op: 'and', children: [{ key: 'x:희망가_비교.from', op: 'is_empty' }] },
      SCHEMA,
    )
    expect(resolved.children[0]).toEqual({
      op: 'and',
      children: [
        { key: 'x:희망_금액', op: 'is_empty' },
        { key: 'x:타업체_견적_금액', op: 'is_empty' },
      ],
    })
  })

  it('정렬은 키 하나인 칸만 — 첫 값 칸과 구조 속성 자체는 뺀다', () => {
    expect(
      resolveStructSorts(
        [
          { key: 'x:희망가_비교.diff', dir: 'desc' },
          { key: 'x:희망가_비교.from', dir: 'asc' },
          { key: 'x:희망가_비교', dir: 'asc' },
          { key: 'orderedAt', dir: 'desc' },
        ],
        SCHEMA,
      ),
    ).toEqual([
      { key: 'wishPriceGap', dir: 'desc' },
      { key: 'orderedAt', dir: 'desc' },
    ])
  })
})

describe('toSourceValue', () => {
  it('만 원으로 받은 값을 원 단위 속성에는 원으로 쓴다', () => {
    expect(toSourceValue(205, { key: 'lowestQuotePrice', def: LOWEST }, 'manwon')).toBe(2050000)
    expect(toSourceValue(95, { key: 'x:희망_금액', def: WISH }, 'manwon')).toBe(95)
  })
})

describe('parseUnitNumberInput', () => {
  it('만 · 원 · 쉼표를 읽고 속성 단위로 바꾼다', () => {
    expect(parseUnitNumberInput('190만', 'manwon')).toEqual({ value: 190, suspect: false })
    expect(parseUnitNumberInput('1,900,000원', 'manwon')).toEqual({ value: 190, suspect: false })
    expect(parseUnitNumberInput('190만원', 'won')).toEqual({ value: 1900000, suspect: false })
    expect(parseUnitNumberInput('', 'manwon')).toEqual({ value: null, suspect: false })
  })

  it('만 원 칸에 단위 없이 1만 이상이면 의심한다', () => {
    expect(parseUnitNumberInput('1900000', 'manwon')).toEqual({ value: 1900000, suspect: true })
    expect(parseUnitNumberInput('190', 'manwon')).toEqual({ value: 190, suspect: false })
    expect(parseUnitNumberInput('1900000', 'won').suspect).toBe(false)
  })
})

describe('응답 칸(state)', () => {
  const ANSWER: PropertyDef = {
    key: 'x:희망가_응답',
    label: '희망가 응답',
    type: 'select',
    source: 'frontmatter',
    origin: 'base',
    options: [{ value: '금액 받음' }, { value: '모름' }],
  }
  const LOW = num('x:희망_금액_하한', '희망 금액 하한', 'manwon')
  const WISH_RANGE: PropertyDef = {
    key: 'x:희망가',
    label: '희망가',
    type: 'struct',
    source: 'projection',
    origin: 'base',
    struct: {
      layout: 'range',
      activeWhen: ['금액 받음'],
      slots: [
        { role: 'state', keys: ['x:희망가_응답'] },
        { role: 'min', label: '하한', keys: ['x:희망_금액_하한'] },
        { role: 'max', label: '상한', keys: ['x:희망_금액'] },
      ],
    },
  }
  const schema = [ANSWER, LOW, WISH, WISH_RANGE]

  it('켜는 응답이면 범위, 아니면 응답을 보인다', () => {
    const on = { 'x:희망가_응답': '금액 받음', 'x:희망_금액_하한': 90, 'x:희망_금액': 100 }
    expect(formatStructText(resolveStruct(WISH_RANGE, on, schema))).toBe('90만 ~ 100만')
    const off = { 'x:희망가_응답': '모름' }
    const resolved = resolveStruct(WISH_RANGE, off, schema)
    expect(resolved?.active).toBe(false)
    expect(formatStructText(resolved)).toBe('모름')
  })

  it('응답이 비었으면 켠 것으로 본다(기존 기록)', () => {
    const resolved = resolveStruct(WISH_RANGE, { 'x:희망_금액': 100 }, schema)
    expect(resolved?.active).toBe(true)
    expect(formatStructText(resolved)).toBe('— ~ 100만')
  })
})
