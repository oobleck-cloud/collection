import { describe, expect, it } from 'vitest'

import {
  RELATION_TABLE_DEFAULT_ROWS,
  relationIds,
  relationTableColumns,
  relationTableDef,
  relationTableRows,
  relationTableSlice,
  relationTableSource,
} from './relation-table'

import type { PropertyDef, RelatedRecordSource, RelationProvider } from './types'

const def = (
  d: Partial<PropertyDef> & Pick<PropertyDef, 'key' | 'label' | 'type'>,
): PropertyDef => ({ source: 'projection', origin: 'preset', ...d })

const TARGET_SCHEMA: PropertyDef[] = [
  def({ key: 'name', label: '이름', type: 'text' }),
  def({ key: 'amount', label: '금액', type: 'number' }),
  def({ key: 'state', label: '상태', type: 'text' }),
  def({ key: 'note', label: '메모', type: 'text', hiddenByDefault: true }),
  def({ key: 'hiddenSearch', label: '검색만', type: 'text', searchOnly: true }),
  def({ key: 'act', label: '버튼', type: 'button' }),
]

const ROWS = {
  a: { id: 'a', props: { name: 'A', amount: 1 } },
  b: { id: 'b', props: { name: 'B', amount: 2 } },
  c: { id: 'c', props: { name: 'C', amount: 3 } },
}

function source(extra: Partial<RelatedRecordSource> = {}): RelatedRecordSource {
  return {
    schema: TARGET_SCHEMA,
    read: (ids) => ids.flatMap((id) => (id in ROWS ? [ROWS[id as keyof typeof ROWS]] : [])),
    ...extra,
  }
}

const SCHEMA: PropertyDef[] = [
  def({ key: 'title', label: '제목', type: 'text' }),
  def({ key: 'related', label: '관계', type: 'relation', relation: { target: 'things' } }),
  def({ key: 'plain', label: '평문', type: 'text' }),
]

describe('relationIds', () => {
  it('단일·다중·빈 값을 id 배열로', () => {
    expect(relationIds('x')).toEqual(['x'])
    expect(relationIds(['x', '', 'y'])).toEqual(['x', 'y'])
    expect(relationIds(null)).toEqual([])
    expect(relationIds('')).toEqual([])
    expect(relationIds(undefined)).toEqual([])
  })
})

describe('relationTableDef / relationTableSource', () => {
  it('설정 키가 관계 속성일 때만 정의를 돌려준다', () => {
    expect(relationTableDef(SCHEMA, { key: 'related' })?.key).toBe('related')
    expect(relationTableDef(SCHEMA, { key: 'plain' })).toBeUndefined()
    expect(relationTableDef(SCHEMA, { key: 'gone' })).toBeUndefined()
    expect(relationTableDef(SCHEMA, undefined)).toBeUndefined()
  })

  it('대상 provider 에 records 가 있어야 창구가 생긴다', () => {
    const related = relationTableDef(SCHEMA, { key: 'related' })
    const withRecords: RelationProvider = { search: () => [], resolve: () => [], records: source() }
    const withoutRecords: RelationProvider = { search: () => [], resolve: () => [] }
    expect(relationTableSource(related, { things: withRecords })).toBe(withRecords.records)
    expect(relationTableSource(related, { things: withoutRecords })).toBeUndefined()
    expect(relationTableSource(related, undefined)).toBeUndefined()
  })
})

describe('relationTableColumns', () => {
  it('고른 열을 그 순서대로, 모르는 키는 건너뛴다', () => {
    const cols = relationTableColumns(source(), ['state', 'gone', 'name'])
    expect(cols.map((d) => d.key)).toEqual(['state', 'name'])
  })

  it('고른 열이 없거나 전부 죽었으면 provider 기본 열', () => {
    const s = source({ defaultColumns: ['amount', 'name'] })
    expect(relationTableColumns(s, undefined).map((d) => d.key)).toEqual(['amount', 'name'])
    expect(relationTableColumns(s, ['gone']).map((d) => d.key)).toEqual(['amount', 'name'])
  })

  it('기본 열도 없으면 숨김·검색 전용·버튼을 뺀 대상 속성 전부', () => {
    expect(relationTableColumns(source(), undefined).map((d) => d.key)).toEqual([
      'name',
      'amount',
      'state',
    ])
  })

  it('숨김 기본 속성도 고르면 선다(검색 전용·버튼은 아니다)', () => {
    expect(
      relationTableColumns(source(), ['note', 'hiddenSearch', 'act']).map((d) => d.key),
    ).toEqual(['note'])
  })
})

describe('relationTableSlice', () => {
  const rows = [1, 2, 3, 4, 5]
  it(`기본 ${String(RELATION_TABLE_DEFAULT_ROWS)}줄, 나머지는 접는다`, () => {
    expect(relationTableSlice(rows, undefined)).toEqual({ shown: [1, 2, 3], hidden: [4, 5] })
  })
  it('maxRows 대로, 줄이 모자라면 접을 것이 없다', () => {
    expect(relationTableSlice(rows, 2)).toEqual({ shown: [1, 2], hidden: [3, 4, 5] })
    expect(relationTableSlice([1], 3)).toEqual({ shown: [1], hidden: [] })
  })
  it('0 이하는 1줄로 무너진다(표를 비우지 않는다)', () => {
    expect(relationTableSlice(rows, 0).shown).toEqual([1])
  })
})

describe('relationTableRows', () => {
  it('관계 값 id 순서대로 읽고 모르는 id 는 뺀다', () => {
    expect(relationTableRows(source(), ['c', 'zz', 'a']).map((r) => r.id)).toEqual(['c', 'a'])
  })
  it('빈 값이면 읽지 않는다', () => {
    let called = false
    const s = source({
      read: () => {
        called = true
        return []
      },
    })
    expect(relationTableRows(s, null)).toEqual([])
    expect(called).toBe(false)
  })
})
