// @oobleck/collection — 뷰별 컬럼 폭(column-widths) 순수 규칙.
//  - 뷰에 적힌 키만 `{ mode:'fixed', px }` 로 덮고, 나머지는 스키마 폭 그대로.
//  - columnWidths 가 없으면 **같은 배열**을 돌려준다(기존 뷰는 한 픽셀도 바뀌지 않는다).

import { describe, expect, it } from 'vitest'

import {
  COLUMN_WIDTH_MAX_PX,
  COLUMN_WIDTH_MIN_PX,
  applyViewColumnWidths,
  clampColumnWidth,
  setColumnWidth,
} from './column-widths'

import type { PropertyDef } from './types'

const SCHEMA: PropertyDef[] = [
  { key: 'name', label: '이름', type: 'text', source: 'projection', origin: 'preset' },
  {
    key: 'status',
    label: '상태',
    type: 'select',
    source: 'projection',
    origin: 'preset',
    width: { mode: 'fixed', px: 130 },
  },
  {
    key: 'owner',
    label: '담당자',
    type: 'person',
    source: 'frontmatter',
    origin: 'base',
    width: { mode: 'fill', minPx: 120 },
  },
]

describe('applyViewColumnWidths', () => {
  it('columnWidths 가 없거나 비면 스키마를 그대로(같은 참조) 돌려준다', () => {
    expect(applyViewColumnWidths(SCHEMA, undefined)).toBe(SCHEMA)
    expect(applyViewColumnWidths(SCHEMA, {})).toBe(SCHEMA)
  })

  it('적힌 키만 fixed px 로 덮는다 — 자동 폭·fill 위에도', () => {
    const out = applyViewColumnWidths(SCHEMA, { status: 200, owner: 150 })
    expect(out[0]).toBe(SCHEMA[0])
    expect(out[1]?.width).toEqual({ mode: 'fixed', px: 200 })
    expect(out[2]?.width).toEqual({ mode: 'fixed', px: 150 })
    // 입력은 변형하지 않는다.
    expect(SCHEMA[1]?.width).toEqual({ mode: 'fixed', px: 130 })
  })

  it('저장된 값이 범위를 벗어나도 그릴 때 클램프한다', () => {
    const out = applyViewColumnWidths(SCHEMA, { name: 5, status: 9999 })
    expect(out[0]?.width).toEqual({ mode: 'fixed', px: COLUMN_WIDTH_MIN_PX })
    expect(out[1]?.width).toEqual({ mode: 'fixed', px: COLUMN_WIDTH_MAX_PX })
  })
})

describe('clampColumnWidth · setColumnWidth', () => {
  it('60~800 정수로 맞춘다', () => {
    expect(clampColumnWidth(10)).toBe(60)
    expect(clampColumnWidth(123.6)).toBe(124)
    expect(clampColumnWidth(5000)).toBe(800)
    expect(clampColumnWidth(Number.NaN)).toBe(60)
  })

  it('키 하나를 바꾸고, null 이면 지우고, 다 지우면 undefined', () => {
    const a = setColumnWidth(undefined, 'status', 200)
    expect(a).toEqual({ status: 200 })
    const b = setColumnWidth(a, 'name', 900)
    expect(b).toEqual({ status: 200, name: 800 })
    expect(a).toEqual({ status: 200 }) // 불변
    expect(setColumnWidth(b, 'status', null)).toEqual({ name: 800 })
    expect(setColumnWidth({ name: 300 }, 'name', null)).toBeUndefined()
  })
})
