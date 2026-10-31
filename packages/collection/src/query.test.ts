// @mvos/collections — 서버측 쿼리 컴파일러 테스트 (이슈 #16-3)
//
// 핵심 목표:
//   1. 골든 동치 테스트: 동일 레코드+동일 FilterNode 에서
//      (인메모리 passesFilterNode) == (compileFilter → buildInMemoryAdapter) 가 일치.
//   2. 경계·실패·중첩 케이스 커버.
//   3. 실 DB 없이 순수 인메모리로 동작.

import { describe, it, expect } from 'vitest'
import {
  compileFilter,
  compileSort,
  buildInMemoryAdapter,
  queryRecords,
  type CompiledQuery,
  type PageParams,
} from './query'
import { normalizeFilterRoot, passesFilterNode, viewRows, type Row } from './view'
import type {
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOp,
  PropertyValue,
  Sort,
} from './types'

// ─── 테스트 픽스처 ─────────────────────────────────────────────────────────────

type P = Record<string, PropertyValue>

/** 공유 레코드 집합 — view.test.ts 와 동일 데이터로 골든 동치 보장. */
const records: Row<P>[] = [
  {
    id: '1',
    props: { name: 'Alpha', status: 'published', count: 3, tags: ['a', 'b'], when: '2026-01-10' },
  },
  { id: '2', props: { name: 'Beta', status: 'draft', count: 1, tags: ['b'], when: '2026-03-01' } },
  {
    id: '3',
    props: { name: 'Gamma', status: 'published', count: 10, tags: [], when: '2025-12-01' },
  },
  { id: '4', props: { name: 'Delta', status: null, count: 0, tags: ['c'], when: null } },
]

const ids = (rows: Row<P>[]) => rows.map((r) => r.id)

/** 빈 AND 그룹(모두 통과) */
const emptyRoot = (): FilterGroup => ({ op: 'and', children: [] })

/** 평탄 배열을 AND 루트로 감싸는 헬퍼. */
const andRoot = (children: FilterCondition[]): FilterGroup => ({ op: 'and', children })

// ─── 단위: compileFilter ──────────────────────────────────────────────────────

describe('compileFilter — IR 구조', () => {
  it('빈 AND 그룹 → 빈 CompiledGroup(and)', () => {
    const q = compileFilter(emptyRoot())
    expect(q.filter.kind).toBe('group')
    expect(q.filter.op).toBe('and')
    expect(q.filter.children).toHaveLength(0)
  })

  it('단일 조건 → CompiledCondition 잎', () => {
    const q = compileFilter(andRoot([{ key: 'status', op: 'eq', value: 'published' }]))
    expect(q.filter.children).toHaveLength(1)
    const leaf = q.filter.children[0]
    expect(leaf.kind).toBe('condition')
    if (leaf.kind === 'condition') {
      expect(leaf.key).toBe('status')
      expect(leaf.op).toBe('eq')
      expect(leaf.value).toBe('published')
    }
  })

  it('value 미지정(is_empty) → value = null', () => {
    const q = compileFilter(andRoot([{ key: 'status', op: 'is_empty' }]))
    const leaf = q.filter.children[0]
    if (leaf.kind === 'condition') {
      expect(leaf.value).toBeNull()
    }
  })

  it('OR 루트 그룹 — op 보존', () => {
    const group: FilterGroup = {
      op: 'or',
      children: [
        { key: 'status', op: 'eq', value: 'draft' },
        { key: 'count', op: 'gt', value: 5 },
      ],
    }
    const q = compileFilter(group)
    expect(q.filter.op).toBe('or')
    expect(q.filter.children).toHaveLength(2)
  })

  it('중첩 그룹 — 3단 중첩 재귀 변환', () => {
    const node: FilterGroup = {
      op: 'and',
      children: [
        {
          op: 'or',
          children: [
            {
              op: 'and',
              children: [
                { key: 'count', op: 'gt', value: 5 },
                { key: 'status', op: 'eq', value: 'published' },
              ],
            },
            { key: 'status', op: 'eq', value: 'draft' },
          ],
        },
        { key: 'tags', op: 'has', value: 'a' },
      ],
    }
    const q = compileFilter(node)
    expect(q.filter.op).toBe('and')
    expect(q.filter.children).toHaveLength(2)
    const orBranch = q.filter.children[0]
    expect(orBranch.kind).toBe('group')
    if (orBranch.kind === 'group') {
      expect(orBranch.op).toBe('or')
      expect(orBranch.children).toHaveLength(2)
      const innerAnd = orBranch.children[0]
      expect(innerAnd.kind).toBe('group')
      if (innerAnd.kind === 'group') {
        expect(innerAnd.op).toBe('and')
        expect(innerAnd.children).toHaveLength(2)
      }
    }
  })

  it('Sort[] 는 CompiledSort[] 로 보존', () => {
    const sorts: Sort[] = [
      { key: 'name', dir: 'asc' },
      { key: 'count', dir: 'desc' },
    ]
    const q = compileFilter(emptyRoot(), sorts)
    expect(q.sort).toEqual([
      { key: 'name', dir: 'asc' },
      { key: 'count', dir: 'desc' },
    ])
  })

  it('PageParams 보존', () => {
    const page: PageParams = { take: 10, skip: 20 }
    const q = compileFilter(emptyRoot(), [], page)
    expect(q.page).toEqual({ take: 10, skip: 20 })
  })
})

// ─── 단위: compileSort ────────────────────────────────────────────────────────

describe('compileSort', () => {
  it('Sort[] → CompiledSort[]', () => {
    expect(compileSort([{ key: 'name', dir: 'asc' }])).toEqual([{ key: 'name', dir: 'asc' }])
  })

  it('빈 배열 → 빈 배열', () => {
    expect(compileSort([])).toEqual([])
  })

  it('여러 키 — 순서 보존', () => {
    const sorts: Sort[] = [
      { key: 'status', dir: 'asc' },
      { key: 'count', dir: 'desc' },
    ]
    expect(compileSort(sorts)).toEqual(sorts)
  })
})

// ─── 골든 동치 테스트: compileFilter + buildInMemoryAdapter == passesFilterNode ─

/**
 * 골든 동치 헬퍼.
 *
 * 동일 레코드·동일 FilterNode 에서:
 *   - 참조 결과: `viewRows(records, { filters: root, sort: [] })` (W0 동결 passesFilterNode 경유)
 *   - 컴파일 결과: `buildInMemoryAdapter(compileFilter(root))(records).rows`
 * 두 결과의 id 목록이 일치하는지 검증.
 */
function assertGoldenEquivalence(group: FilterGroup, sorts: Sort[] = []): void {
  // 참조: W0 동결 passesFilterNode 직접 평가
  const referenceRows = viewRows(records, {
    type: 'table',
    filters: normalizeFilterRoot(group),
    sort: sorts,
  })

  // 컴파일 경로: compileFilter → buildInMemoryAdapter
  const compiled = compileFilter(group, sorts)
  const { rows: compiledRows } = buildInMemoryAdapter<P>(compiled)(records)

  expect(ids(compiledRows)).toEqual(ids(referenceRows))
}

describe('골든 동치 — compileFilter 결과가 passesFilterNode 와 일치', () => {
  it('빈 그룹 — 모두 통과', () => {
    assertGoldenEquivalence(emptyRoot())
  })

  it('eq (select 단일 값)', () => {
    assertGoldenEquivalence(andRoot([{ key: 'status', op: 'eq', value: 'published' }]))
  })

  it('neq', () => {
    assertGoldenEquivalence(andRoot([{ key: 'status', op: 'neq', value: 'published' }]))
  })

  it('contains (text)', () => {
    assertGoldenEquivalence(andRoot([{ key: 'name', op: 'contains', value: 'a' }]))
  })

  it('not_contains', () => {
    assertGoldenEquivalence(andRoot([{ key: 'name', op: 'not_contains', value: 'a' }]))
  })

  it('gt / gte / lt / lte (number)', () => {
    assertGoldenEquivalence(andRoot([{ key: 'count', op: 'gt', value: 3 }]))
    assertGoldenEquivalence(andRoot([{ key: 'count', op: 'gte', value: 3 }]))
    assertGoldenEquivalence(andRoot([{ key: 'count', op: 'lt', value: 3 }]))
    assertGoldenEquivalence(andRoot([{ key: 'count', op: 'lte', value: 3 }]))
  })

  it('gt / lt (date — ISO string epoch 비교)', () => {
    assertGoldenEquivalence(andRoot([{ key: 'when', op: 'gt', value: '2026-01-01' }]))
    assertGoldenEquivalence(andRoot([{ key: 'when', op: 'lt', value: '2026-01-01' }]))
  })

  it('has / not_has (multi_select 배열)', () => {
    assertGoldenEquivalence(andRoot([{ key: 'tags', op: 'has', value: 'b' }]))
    assertGoldenEquivalence(andRoot([{ key: 'tags', op: 'not_has', value: 'b' }]))
  })

  it('is_empty / is_not_empty — null·빈문자·빈배열만 empty', () => {
    assertGoldenEquivalence(andRoot([{ key: 'status', op: 'is_empty' }]))
    assertGoldenEquivalence(andRoot([{ key: 'tags', op: 'is_empty' }]))
    assertGoldenEquivalence(andRoot([{ key: 'count', op: 'is_empty' }]))
    assertGoldenEquivalence(andRoot([{ key: 'when', op: 'is_not_empty' }]))
  })

  it('eq — 배열 집합 동등성(순서 무관)', () => {
    const arrRecords: Row<P>[] = [
      { id: '1', props: { tags: ['a', 'b'] } },
      { id: '2', props: { tags: ['b', 'a'] } },
      { id: '3', props: { tags: ['a'] } },
    ]
    const group = andRoot([{ key: 'tags', op: 'eq', value: ['a', 'b'] }])
    const root = normalizeFilterRoot(group)

    const referenceRows = viewRows(arrRecords, { type: 'table', filters: root, sort: [] })
    const { rows: compiledRows } = buildInMemoryAdapter<P>(compileFilter(group))(arrRecords)
    expect(ids(compiledRows)).toEqual(ids(referenceRows))
    expect(ids(compiledRows)).toEqual(['1', '2'])
  })

  it('OR 루트 그룹 — 하나라도 통과', () => {
    const group: FilterGroup = {
      op: 'or',
      children: [
        { key: 'status', op: 'eq', value: 'draft' },
        { key: 'count', op: 'gt', value: 5 },
      ],
    }
    assertGoldenEquivalence(group)
  })

  it('3단 중첩 AND(OR(AND(...), leaf), leaf)', () => {
    const group: FilterGroup = {
      op: 'and',
      children: [
        {
          op: 'or',
          children: [
            {
              op: 'and',
              children: [
                { key: 'count', op: 'gt', value: 5 },
                { key: 'status', op: 'eq', value: 'published' },
              ],
            },
            { key: 'status', op: 'eq', value: 'draft' },
          ],
        },
        { key: 'tags', op: 'has', value: 'a' },
      ],
    }
    assertGoldenEquivalence(group)
  })

  it('여러 조건 AND 결합', () => {
    assertGoldenEquivalence(
      andRoot([
        { key: 'status', op: 'eq', value: 'published' },
        { key: 'count', op: 'gt', value: 5 },
      ]),
    )
  })

  it('타입 부적합 — contains 에 비문자 값', () => {
    // count(number) 에 contains 를 쓰면 passesFilterNode 는 false → 골든도 동일해야
    assertGoldenEquivalence(andRoot([{ key: 'count', op: 'contains', value: '3' }]))
  })

  it('누락 키(undefined prop) — is_empty 통과, eq 불일치', () => {
    const r: Row<P>[] = [{ id: '1', props: {} }]
    const group1 = andRoot([{ key: 'missing', op: 'is_empty' }])
    const group2 = andRoot([{ key: 'missing', op: 'eq', value: 'x' }])

    for (const group of [group1, group2]) {
      const root = normalizeFilterRoot(group)
      const referenceRows = viewRows(r, { type: 'table', filters: root, sort: [] })
      const { rows } = buildInMemoryAdapter<P>(compileFilter(group))(r)
      expect(ids(rows)).toEqual(ids(referenceRows))
    }
  })

  it('정렬 포함 — count asc', () => {
    assertGoldenEquivalence(emptyRoot(), [{ key: 'count', dir: 'asc' }])
  })

  it('정렬 포함 — 날짜 desc + 빈 값 항상 뒤', () => {
    assertGoldenEquivalence(emptyRoot(), [{ key: 'when', dir: 'desc' }])
  })

  it('다중 키 정렬 — 1순위 동률 시 2순위 tie-break', () => {
    assertGoldenEquivalence(emptyRoot(), [
      { key: 'status', dir: 'asc' },
      { key: 'count', dir: 'desc' },
    ])
  })
})

// ─── 페이지네이션 ─────────────────────────────────────────────────────────────

describe('buildInMemoryAdapter — 페이지네이션', () => {
  const compiled = compileFilter(emptyRoot(), [{ key: 'count', dir: 'asc' }])

  it('take 만 지정 — 앞 N 개', () => {
    const q: CompiledQuery = { ...compiled, page: { take: 2 } }
    const { rows, total } = buildInMemoryAdapter<P>(q)(records)
    // count asc → [4(0), 2(1), 1(3), 3(10)], take=2
    expect(ids(rows)).toEqual(['4', '2'])
    expect(total).toBe(4)
  })

  it('skip 만 지정 — 오프셋 이후 전체', () => {
    const q: CompiledQuery = { ...compiled, page: { skip: 2 } }
    const { rows, total } = buildInMemoryAdapter<P>(q)(records)
    expect(ids(rows)).toEqual(['1', '3'])
    expect(total).toBe(4)
  })

  it('take + skip — 범위 슬라이스', () => {
    const q: CompiledQuery = { ...compiled, page: { take: 2, skip: 1 } }
    const { rows, total } = buildInMemoryAdapter<P>(q)(records)
    expect(ids(rows)).toEqual(['2', '1'])
    expect(total).toBe(4)
  })

  it('skip >= total → 빈 결과, total 은 전체 수', () => {
    const q: CompiledQuery = { ...compiled, page: { skip: 100 } }
    const { rows, total } = buildInMemoryAdapter<P>(q)(records)
    expect(rows).toHaveLength(0)
    expect(total).toBe(4)
  })

  it('take=0 → 빈 결과, total 은 전체 수', () => {
    const q: CompiledQuery = { ...compiled, page: { take: 0 } }
    const { rows, total } = buildInMemoryAdapter<P>(q)(records)
    expect(rows).toHaveLength(0)
    expect(total).toBe(4)
  })

  it('페이지 미지정 — 전체 반환', () => {
    const q: CompiledQuery = { ...compiled, page: {} }
    const { rows, total } = buildInMemoryAdapter<P>(q)(records)
    expect(rows).toHaveLength(4)
    expect(total).toBe(4)
  })

  it('total 은 필터 후 페이지 이전 수', () => {
    // status=published 인 레코드는 2개
    const group = andRoot([{ key: 'status', op: 'eq', value: 'published' }])
    const q = compileFilter(group, [], { take: 1 })
    const { rows, total } = buildInMemoryAdapter<P>(q)(records)
    expect(rows).toHaveLength(1)
    expect(total).toBe(2) // 페이지 이전 필터 결과 수
  })
})

// ─── queryRecords 헬퍼 ────────────────────────────────────────────────────────

describe('queryRecords — 원스텝 헬퍼', () => {
  it('기본 사용 — 필터 + 정렬', () => {
    const group = andRoot([{ key: 'status', op: 'eq', value: 'published' }])
    const { rows, total } = queryRecords(records, group, [{ key: 'count', dir: 'desc' }])
    expect(ids(rows)).toEqual(['3', '1'])
    expect(total).toBe(2)
  })

  it('빈 records — 빈 결과', () => {
    const { rows, total } = queryRecords([], emptyRoot())
    expect(rows).toHaveLength(0)
    expect(total).toBe(0)
  })

  it('페이지네이션 포함', () => {
    const { rows, total } = queryRecords(records, emptyRoot(), [], { take: 2, skip: 1 })
    expect(rows).toHaveLength(2)
    expect(total).toBe(4)
  })

  it('골든 동치 — queryRecords == viewRows', () => {
    const group = andRoot([
      { key: 'status', op: 'eq', value: 'published' },
      { key: 'count', op: 'gte', value: 1 },
    ])
    const sorts: Sort[] = [{ key: 'count', dir: 'asc' }]
    const root = normalizeFilterRoot(group)
    const referenceRows = viewRows(records, { type: 'table', filters: root, sort: sorts })
    const { rows } = queryRecords(records, group, sorts)
    expect(ids(rows)).toEqual(ids(referenceRows))
  })
})

// ─── 경계·실패 케이스 ─────────────────────────────────────────────────────────

describe('경계·실패 케이스', () => {
  it('빈 OR 그룹 = 아무것도 통과하지 않음', () => {
    const group: FilterGroup = { op: 'or', children: [] }
    const { rows } = buildInMemoryAdapter<P>(compileFilter(group))(records)
    expect(rows).toHaveLength(0)
  })

  it('빈 AND 그룹 = 모두 통과', () => {
    const { rows } = buildInMemoryAdapter<P>(compileFilter(emptyRoot()))(records)
    expect(rows).toHaveLength(4)
  })

  it('passesFilterNode 직접 호출과 동치 — 빈 OR', () => {
    const group: FilterGroup = { op: 'or', children: [] }
    const props: P = { status: 'published' }
    const directResult = passesFilterNode(props, group)
    expect(directResult).toBe(false)

    const { rows } = buildInMemoryAdapter<P>(compileFilter(group))(records)
    expect(rows.every((r) => passesFilterNode(r.props, group))).toBe(true)
    expect(rows).toHaveLength(0)
  })

  it('is_empty — 0 과 false 는 비어있지 않음(골든)', () => {
    const r: Row<P>[] = [
      { id: 'zero', props: { v: 0 } },
      { id: 'false', props: { v: false } },
      { id: 'null', props: { v: null } },
      { id: 'empty-str', props: { v: '' } },
      { id: 'empty-arr', props: { v: [] } },
    ]
    const group = andRoot([{ key: 'v', op: 'is_empty' }])
    const root = normalizeFilterRoot(group)
    const referenceIds = ids(viewRows(r, { type: 'table', filters: root, sort: [] }))
    const { rows } = buildInMemoryAdapter<P>(compileFilter(group))(r)
    expect(ids(rows)).toEqual(referenceIds)
    // 0, false 는 비어있지 않음 — null, '', [] 만 비어있음
    expect(ids(rows)).toEqual(['null', 'empty-str', 'empty-arr'])
  })

  it('date epoch 비교 — ISO string gt 는 숫자 비교와 동치(골든)', () => {
    const r: Row<P>[] = [
      { id: 'old', props: { d: '2025-01-01' } },
      { id: 'new', props: { d: '2026-06-01' } },
      { id: 'null', props: { d: null } },
    ]
    const group = andRoot([{ key: 'd', op: 'gt', value: '2026-01-01' }])
    const root = normalizeFilterRoot(group)
    const referenceIds = ids(viewRows(r, { type: 'table', filters: root, sort: [] }))
    const { rows } = buildInMemoryAdapter<P>(compileFilter(group))(r)
    expect(ids(rows)).toEqual(referenceIds)
    expect(ids(rows)).toEqual(['new'])
  })

  it('eq 배열 집합 동등성 — 순서 무관, passesFilterNode 와 동치(골든)', () => {
    const props: P = { tags: ['b', 'a'] }
    const node: FilterNode = { key: 'tags', op: 'eq', value: ['a', 'b'] }
    expect(passesFilterNode(props, node)).toBe(true)

    const r: Row<P>[] = [{ id: '1', props }]
    const group = andRoot([{ key: 'tags', op: 'eq', value: ['a', 'b'] }])
    const { rows } = buildInMemoryAdapter<P>(compileFilter(group))(r)
    expect(rows).toHaveLength(1)
  })

  it('compileFilter 재사용 — 같은 CompiledQuery 로 여러 records 집합 평가', () => {
    const compiled = compileFilter(andRoot([{ key: 'status', op: 'eq', value: 'published' }]))
    const adapt = buildInMemoryAdapter<P>(compiled)

    const { rows: r1 } = adapt(records)
    const { rows: r2 } = adapt([records[0]]) // Alpha(published) 만
    expect(ids(r1)).toEqual(['1', '3'])
    expect(ids(r2)).toEqual(['1'])
  })

  it('sorts 없고 filter 없으면 입력 순서 그대로', () => {
    const compiled = compileFilter(emptyRoot())
    const { rows } = buildInMemoryAdapter<P>(compiled)(records)
    expect(ids(rows)).toEqual(['1', '2', '3', '4'])
  })

  it('빈 records → 항상 empty, total=0', () => {
    const compiled = compileFilter(
      andRoot([{ key: 'status', op: 'eq', value: 'published' }]),
      [{ key: 'count', dir: 'asc' }],
      { take: 5 },
    )
    const { rows, total } = buildInMemoryAdapter<P>(compiled)([])
    expect(rows).toHaveLength(0)
    expect(total).toBe(0)
  })
})

// ─── 모든 FilterOp 에 대한 골든 동치 일람 ────────────────────────────────────

describe('FilterOp 전수 골든 동치', () => {
  const allOpCases: { op: FilterOp; value?: PropertyValue }[] = [
    { op: 'eq', value: 'published' },
    { op: 'neq', value: 'published' },
    { op: 'contains', value: 'lph' },
    { op: 'not_contains', value: 'lph' },
    { op: 'gt', value: 3 },
    { op: 'gte', value: 3 },
    { op: 'lt', value: 3 },
    { op: 'lte', value: 3 },
    { op: 'has', value: 'b' },
    { op: 'not_has', value: 'b' },
    { op: 'is_empty', value: undefined },
    { op: 'is_not_empty', value: undefined },
  ]

  const opToKey: Record<string, string> = {
    eq: 'status',
    neq: 'status',
    contains: 'name',
    not_contains: 'name',
    gt: 'count',
    gte: 'count',
    lt: 'count',
    lte: 'count',
    has: 'tags',
    not_has: 'tags',
    is_empty: 'status',
    is_not_empty: 'status',
  }

  for (const { op, value } of allOpCases) {
    it(`${op} — compileFilter == passesFilterNode`, () => {
      const key = opToKey[op]
      const cond: FilterCondition = value !== undefined ? { key, op, value } : { key, op }
      const group = andRoot([cond])
      assertGoldenEquivalence(group)
    })
  }
})
