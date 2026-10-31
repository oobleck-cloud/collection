// @mvos/collections — 컬럼 폭 auto-fit 핀.

import { describe, expect, it } from 'vitest'

import { applyAutoWidths, autoSizeColumns, estimateTextWidth, percentile } from './auto-size'

import type { PropertyDef, PropertyValue } from './types'

function col(over: Partial<PropertyDef> & { key: string; label: string }): PropertyDef {
  return { type: 'text', source: 'projection', origin: 'preset', ...over }
}

describe('estimateTextWidth', () => {
  it('빈 문자열은 0', () => {
    expect(estimateTextWidth('')).toBe(0)
  })

  it('한글은 라틴보다 넓다(전각)', () => {
    expect(estimateTextWidth('가나다')).toBeGreaterThan(estimateTextWidth('abc'))
  })

  it('글자가 늘면 폭도 는다(단조)', () => {
    expect(estimateTextWidth('서울시 강남구')).toBeGreaterThan(estimateTextWidth('서울시'))
  })

  it('폰트 크기에 비례한다', () => {
    expect(estimateTextWidth('가나다', 28)).toBeCloseTo(estimateTextWidth('가나다', 14) * 2, 5)
  })

  it('숫자는 소문자보다 넓게 잡는다(tabular 폭 보정)', () => {
    expect(estimateTextWidth('00000')).toBeGreaterThan(estimateTextWidth('ooooo'))
  })
})

describe('percentile', () => {
  it('빈 배열은 0', () => {
    expect(percentile([], 0.9)).toBe(0)
  })

  it('p=1 은 최댓값', () => {
    expect(percentile([10, 50, 30], 1)).toBe(50)
  })

  it('p=0.9 는 이상치 하나를 잘라낸다', () => {
    // 9개는 10, 하나만 1000 → p90 은 10 쪽을 고른다.
    const vals = [...Array(9).fill(10), 1000]
    expect(percentile(vals, 0.9)).toBe(10)
    expect(percentile(vals, 1)).toBe(1000)
  })

  it('범위를 벗어난 p 는 clamp', () => {
    expect(percentile([1, 2, 3], -1)).toBe(1)
    expect(percentile([1, 2, 3], 9)).toBe(3)
  })
})

describe('autoSizeColumns', () => {
  const rows: Record<string, PropertyValue>[] = [
    { code: 'GN01', name: '서울 중랑구 중랑천로 136-1' },
    { code: 'BC02', name: '경기 부천시 소사구 소안로' },
    { code: 'SD03', name: '서울 성동구 독서당로 272' },
  ]

  it('내용이 긴 컬럼이 더 넓다', () => {
    const w = autoSizeColumns(
      [col({ key: 'code', label: '코드' }), col({ key: 'name', label: '주소' })],
      rows,
    )
    expect(w.name).toBeGreaterThan(w.code!)
  })

  it('명시 폭이 있는 컬럼은 건드리지 않는다(수동 우선)', () => {
    const w = autoSizeColumns(
      [col({ key: 'code', label: '코드', width: { mode: 'fixed', px: 999 } })],
      rows,
    )
    expect(w.code).toBeUndefined()
  })

  it('헤더가 내용보다 길면 헤더 기준으로 넓어진다', () => {
    const w = autoSizeColumns([col({ key: 'code', label: '아주아주아주긴헤더라벨' })], rows)
    const short = autoSizeColumns([col({ key: 'code', label: '코드' })], rows)
    expect(w.code).toBeGreaterThan(short.code!)
  })

  it('min/max 로 clamp 된다', () => {
    const w = autoSizeColumns([col({ key: 'name', label: '주소' })], rows, { maxPx: 100 })
    expect(w.name).toBe(100)
    const w2 = autoSizeColumns([col({ key: 'code', label: 'x' })], [{ code: 'a' }], { minPx: 200 })
    expect(w2.code).toBe(200)
  })

  it('이상치 하나가 컬럼을 늘리지 않는다(p90)', () => {
    const many: Record<string, PropertyValue>[] = [
      ...Array(19).fill({ v: '짧음' }),
      { v: '아주'.repeat(60) },
    ]
    const p90 = autoSizeColumns([col({ key: 'v', label: 'v' })], many, { maxPx: 9999 })
    const pMax = autoSizeColumns([col({ key: 'v', label: 'v' })], many, {
      maxPx: 9999,
      percentile: 1,
    })
    expect(p90.v).toBeLessThan(pMax.v!)
  })

  it('autoSize.text 로 실제 표시 문자열을 알려주면 그 폭을 쓴다', () => {
    // 원값은 짧고(synced) 보이는 라벨은 길다(플래너 배정됨) — render 셀의 전형.
    const schema = [
      col({
        key: 'status',
        label: '상태',
        autoSize: { text: () => '플래너 배정됨' },
      }),
    ]
    const withHint = autoSizeColumns(schema, [{ status: 'synced' }])
    const without = autoSizeColumns([col({ key: 'status', label: '상태' })], [{ status: 'synced' }])
    expect(withHint.status).toBeGreaterThan(without.status!)
  })

  it('autoSize.extraPx 가 장식 폭으로 더해진다(배지 패딩 등)', () => {
    const plain = autoSizeColumns([col({ key: 'v', label: 'v' })], [{ v: '접수됨' }])
    const badge = autoSizeColumns(
      [col({ key: 'v', label: 'v', autoSize: { extraPx: 40 } })],
      [{ v: '접수됨' }],
    )
    expect(badge.v! - plain.v!).toBe(40)
  })

  it('행이 없어도 헤더 기준 폭이 나온다(빈 목록에서 컬럼이 붕괴하지 않게)', () => {
    const w = autoSizeColumns([col({ key: 'v', label: '서비스 구역' })], [])
    expect(w.v).toBeGreaterThan(0)
  })
})

describe('autoSizeColumns — 날짜는 셀이 그리는 글자로 잰다', () => {
  it('저장값(2026-10-21)보다 표시(2026. 10. 21.)가 길다 — 표시로 재야 칸 안에 한 줄로 든다', () => {
    const rows = [{ d: '2026-10-21' }]
    const asDate = autoSizeColumns([col({ key: 'd', label: 'd', type: 'date' })], rows, {
      minPx: 0,
    })
    const asText = autoSizeColumns([col({ key: 'd', label: 'd' })], rows, { minPx: 0 })
    expect(asDate.d).toBeGreaterThan(asText.d!)
  })

  it("dateFormat 'iso' 컬럼은 「2026-10-21」로 잰다 — 저장값과 같은 글자라 같은 폭", () => {
    const rows = [{ d: '2026-10-21' }]
    const iso = autoSizeColumns(
      [col({ key: 'd', label: 'd', type: 'date', dateFormat: 'iso' })],
      rows,
      { minPx: 0 },
    )
    const asText = autoSizeColumns([col({ key: 'd', label: 'd' })], rows, { minPx: 0 })
    expect(iso.d).toBe(asText.d)
  })
})

describe('applyAutoWidths', () => {
  const schema = [col({ key: 'a', label: 'A' }), col({ key: 'b', label: 'B' })]

  it('계산된 폭을 fixed 로 얹는다', () => {
    const out = applyAutoWidths(schema, { a: 120, b: 200 })
    expect(out[0]?.width).toEqual({ mode: 'fixed', px: 120 })
    expect(out[1]?.width).toEqual({ mode: 'fixed', px: 200 })
  })

  it('fillKey 컬럼은 fill(minPx) 로 — 표가 가로를 채우게', () => {
    const out = applyAutoWidths(schema, { a: 120, b: 200 }, 'b')
    expect(out[1]?.width).toEqual({ mode: 'fill', minPx: 200 })
  })

  it('명시 폭은 보존한다', () => {
    const fixed = [col({ key: 'a', label: 'A', width: { mode: 'fixed', px: 50 } })]
    expect(applyAutoWidths(fixed, { a: 999 })[0]?.width).toEqual({ mode: 'fixed', px: 50 })
  })

  it('입력 스키마를 변형하지 않는다(순수)', () => {
    applyAutoWidths(schema, { a: 120 })
    expect(schema[0]?.width).toBeUndefined()
  })
})
