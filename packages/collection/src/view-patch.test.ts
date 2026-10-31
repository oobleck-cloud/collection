// @oobleck/collection — 뷰 설정 차이(view-patch) 순수 규칙.
//  - 차이는 최상위 항목 단위다. 손대지 않은 항목은 지금 저장된 값을 따라간다.
//  - 지운 항목은 null 로 적는다(JSON 왕복에서 살아남아야 한다).

import { describe, expect, it } from 'vitest'

import { applyViewConfigPatch, diffViewConfig, isEmptyViewConfigPatch } from './view-patch'

import type { CollectionViewConfig } from './types'

const BASE: CollectionViewConfig = {
  visibleProps: ['name', 'status'],
  sort: [{ key: 'name', dir: 'asc' }],
}

describe('diffViewConfig / applyViewConfigPatch', () => {
  it('같으면 빈 차이', () => {
    expect(diffViewConfig(BASE, { ...BASE })).toEqual({})
  })

  it('바꾼 항목만 담고, 지운 항목은 null 로 적는다', () => {
    const next: CollectionViewConfig = { visibleProps: ['name'], rowHeight: 'L' }
    const patch = diffViewConfig(BASE, next)
    expect(patch).toEqual({ visibleProps: ['name'], sort: null, rowHeight: 'L' })
    // JSON 왕복 뒤에도 같은 결과 — 저장소에 담기는 모양이다.
    const roundTrip = JSON.parse(JSON.stringify(patch))
    expect(applyViewConfigPatch(BASE, roundTrip)).toEqual(next)
  })

  it('손대지 않은 항목은 지금 저장된 값을 따라간다 — 그사이 공유 뷰가 바뀌어도', () => {
    const patch = diffViewConfig(BASE, { ...BASE, rowHeight: 'M' })
    const updatedShared: CollectionViewConfig = { ...BASE, sort: [{ key: 'status', dir: 'desc' }] }
    expect(applyViewConfigPatch(updatedShared, patch)).toEqual({ ...updatedShared, rowHeight: 'M' })
  })

  it('빈 정렬·조건 없는 필터는 항목이 없는 것과 같다 — 표시 컬럼은 예외', () => {
    expect(diffViewConfig({}, { sort: [], filters: { op: 'and', children: [] } })).toEqual({})
    expect(diffViewConfig({}, { columnWidths: {} })).toEqual({})
    expect(diffViewConfig({}, { visibleProps: [] })).toEqual({ visibleProps: [] })
  })

  it('입력을 바꾸지 않는다', () => {
    const base = { ...BASE }
    applyViewConfigPatch(base, { sort: null })
    expect(base).toEqual(BASE)
  })

  it('knownProps 만 다른 차이는 편집이 아니다', () => {
    expect(isEmptyViewConfigPatch({})).toBe(true)
    expect(isEmptyViewConfigPatch({ knownProps: ['name'] })).toBe(true)
    expect(isEmptyViewConfigPatch({ knownProps: ['name'], sort: null })).toBe(false)
  })
})
