// @mvos/collections — 헤드리스 쿼리 경계(뷰 설정 → IR → 전송 → 복원) 핀.

import { describe, expect, it } from 'vitest'

import {
  buildCollectionQuery,
  buildQueryFromConfig,
  fromWireQuery,
  toggleSort,
  toWireQuery,
} from './headless'

import type { CollectionQuery } from './headless'
import type { Sort } from './types'

describe('buildCollectionQuery', () => {
  it('빈 뷰 → 빈 AND 그룹 + 빈 정렬(전체 조회)', () => {
    const q = buildCollectionQuery({ sort: [] })
    expect(q.filter).toEqual({ kind: 'group', op: 'and', children: [] })
    expect(q.sort).toEqual([])
    expect(q.page).toEqual({})
  })

  it('필터 트리와 정렬을 IR 로 컴파일한다', () => {
    const q = buildCollectionQuery({
      sort: [{ key: 'createdAt', dir: 'desc' }],
      filters: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'active' }] },
    })
    expect(q.filter).toEqual({
      kind: 'group',
      op: 'and',
      children: [{ kind: 'condition', key: 'status', op: 'eq', value: 'active' }],
    })
    expect(q.sort).toEqual([{ key: 'createdAt', dir: 'desc' }])
  })

  it('레거시 평탄 배열 필터도 AND 루트로 정규화한다', () => {
    const q = buildCollectionQuery({
      sort: [],
      filters: [{ key: 'status', op: 'eq', value: 'active' }],
    })
    expect(q.filter.op).toBe('and')
    expect(q.filter.children).toHaveLength(1)
  })

  it('페이지 파라미터를 그대로 싣는다', () => {
    const q = buildCollectionQuery({ sort: [] }, { take: 20, skip: 40 })
    expect(q.page).toEqual({ take: 20, skip: 40 })
  })
})

describe('buildQueryFromConfig', () => {
  it('저장된 뷰 설정(sort/filters optional)에서 바로 컴파일한다', () => {
    const q = buildQueryFromConfig({ sort: [{ key: 'name', dir: 'asc' }] }, { take: 10 })
    expect(q.sort).toEqual([{ key: 'name', dir: 'asc' }])
    expect(q.page.take).toBe(10)
  })

  it('sort·filters 미지정이어도 안전하다', () => {
    const q = buildQueryFromConfig({})
    expect(q.sort).toEqual([])
    expect(q.filter.children).toEqual([])
  })
})

describe('전송 인코딩 round-trip', () => {
  it('빈 쿼리는 빈 파라미터(URL 을 더럽히지 않는다)', () => {
    expect(toWireQuery(buildCollectionQuery({ sort: [] }))).toEqual({})
  })

  it('필터·정렬·페이지가 round-trip 된다', () => {
    const original: CollectionQuery = buildCollectionQuery(
      {
        sort: [
          { key: 'createdAt', dir: 'desc' },
          { key: 'name', dir: 'asc' },
        ],
        filters: {
          op: 'or',
          children: [
            { key: 'status', op: 'eq', value: 'active' },
            { op: 'and', children: [{ key: 'amount', op: 'gt', value: 100 }] },
          ],
        },
      },
      { take: 20, skip: 40 },
    )
    const wire = toWireQuery(original)
    expect(wire.sort).toBe('createdAt:desc,name:asc')
    expect(wire.take).toBe('20')
    expect(wire.skip).toBe('40')
    expect(fromWireQuery(wire)).toEqual(original)
  })

  it('skip=0 은 싣지 않는다(기본값)', () => {
    const wire = toWireQuery(buildCollectionQuery({ sort: [] }, { take: 20, skip: 0 }))
    expect(wire.skip).toBeUndefined()
    expect(wire.take).toBe('20')
  })
})

describe('fromWireQuery — 신뢰할 수 없는 입력', () => {
  it('깨진 JSON 필터는 "필터 없음"으로 떨어진다(500 대신)', () => {
    const q = fromWireQuery({ filter: '{not json' })
    expect(q.filter).toEqual({ kind: 'group', op: 'and', children: [] })
  })

  it('셰이프가 다른 필터는 거부한다', () => {
    expect(fromWireQuery({ filter: '{"kind":"nope"}' }).filter.children).toEqual([])
    expect(fromWireQuery({ filter: '[]' }).filter.children).toEqual([])
    expect(fromWireQuery({ filter: 'null' }).filter.children).toEqual([])
    // children 안에 조건 셰이프가 아닌 게 섞이면 트리 전체를 버린다.
    expect(
      fromWireQuery({ filter: '{"kind":"group","op":"and","children":[{"kind":"condition"}]}' })
        .filter.children,
    ).toEqual([])
  })

  it('중첩 그룹은 재귀 검증을 통과한다', () => {
    const nested = JSON.stringify({
      kind: 'group',
      op: 'and',
      children: [
        {
          kind: 'group',
          op: 'or',
          children: [{ kind: 'condition', key: 'a', op: 'eq', value: 1 }],
        },
      ],
    })
    expect(fromWireQuery({ filter: nested }).filter.children).toHaveLength(1)
  })

  it('잘못된 정렬 방향은 asc 로, 빈 키는 버린다', () => {
    expect(fromWireQuery({ sort: 'name:sideways,:desc,age:desc' }).sort).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'age', dir: 'desc' },
    ])
  })

  it('음수·NaN 페이지 값은 무시한다', () => {
    expect(fromWireQuery({ take: '-5', skip: 'abc' }).page).toEqual({})
  })

  it('파라미터가 아예 없으면 전체 조회', () => {
    const q = fromWireQuery({})
    expect(q).toEqual({ filter: { kind: 'group', op: 'and', children: [] }, sort: [], page: {} })
  })
})

describe('toggleSort', () => {
  it('없음 → asc → desc → 없음 순환', () => {
    let sorts: Sort[] = []
    sorts = toggleSort(sorts, 'name')
    expect(sorts).toEqual([{ key: 'name', dir: 'asc' }])
    sorts = toggleSort(sorts, 'name')
    expect(sorts).toEqual([{ key: 'name', dir: 'desc' }])
    sorts = toggleSort(sorts, 'name')
    expect(sorts).toEqual([])
  })

  it('다른 키를 토글해도 기존 정렬은 남는다(다중 정렬)', () => {
    const sorts = toggleSort([{ key: 'name', dir: 'asc' }], 'age')
    expect(sorts).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'age', dir: 'asc' },
    ])
  })

  it('입력 배열을 변형하지 않는다(순수)', () => {
    const original: Sort[] = [{ key: 'name', dir: 'asc' }]
    toggleSort(original, 'name')
    expect(original).toEqual([{ key: 'name', dir: 'asc' }])
  })
})
