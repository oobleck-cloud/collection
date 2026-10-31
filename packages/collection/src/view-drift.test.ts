import { describe, expect, it } from 'vitest'

import { toViewConfig } from './options'
import { normalizeFilterRoot, passesFilterNode, resolveVisibleColumns } from './view'
import {
  collectViewConfigKeys,
  isViewConfigReconciled,
  reconcileSavedViewConfigs,
  reconcileViewConfig,
} from './view-drift'

import type { CollectionViewConfig, PropertyDef, PropertyValue } from './types'

const SCHEMA: PropertyDef[] = [
  { key: 'name', label: '이름', type: 'text', source: 'projection', origin: 'preset' },
  { key: 'status', label: '상태', type: 'select', source: 'projection', origin: 'preset' },
  { key: 'amount', label: '금액', type: 'number', source: 'projection', origin: 'preset' },
]

const KEYS = { columnKeys: SCHEMA.map((d) => d.key) }

describe('reconcileViewConfig — visibleProps', () => {
  it('죽은 키를 걷어내고 사용자 순서는 보존한다', () => {
    const out = reconcileViewConfig({ visibleProps: ['status', 'gone', 'name'] }, KEYS)
    expect(out.visibleProps).toEqual(['status', 'name', 'amount'])
  })

  it('그 사이 새로 생긴 컬럼은 뒤에 붙는다 — 저장된 뷰가 신규 컬럼을 영원히 숨기지 않게', () => {
    const out = reconcileViewConfig({ visibleProps: ['name'] }, KEYS)
    expect(out.visibleProps).toEqual(['name', 'status', 'amount'])
  })

  it('전부 죽으면 필드를 떼어 기본값(스키마 전체)으로 돌아간다 — 컬럼 0개로 무너지지 않는다', () => {
    const out = reconcileViewConfig({ visibleProps: ['gone', 'also-gone'] }, KEYS)
    expect(out.visibleProps).toBeUndefined()
    // 실제 렌더 경로까지 확인 — 이게 "표가 하얗게 비는" 사고의 지점이다.
    const view = toViewConfig(out, KEYS.columnKeys)
    expect(resolveVisibleColumns(SCHEMA, view)).toHaveLength(3)
  })
})

describe('reconcileViewConfig — filters', () => {
  const row: Record<string, PropertyValue> = { name: '홍길동', status: 'active', amount: 10 }

  it('죽은 키의 조건만 떨어지고 나머지는 남는다', () => {
    const out = reconcileViewConfig(
      {
        filters: {
          op: 'and',
          children: [
            { key: 'status', op: 'eq', value: 'active' },
            { key: 'gone', op: 'eq', value: 'x' },
          ],
        },
      },
      KEYS,
    )
    expect(out.filters).toEqual({
      op: 'and',
      children: [{ key: 'status', op: 'eq', value: 'active' }],
    })
  })

  it('OR 그룹의 자식이 다 죽으면 그룹째 제거한다 — 빈 OR 은 "모두 탈락"이라 표를 비운다', () => {
    const out = reconcileViewConfig(
      {
        filters: {
          op: 'and',
          children: [
            { key: 'status', op: 'eq', value: 'active' },
            { op: 'or', children: [{ key: 'gone', op: 'eq', value: 'x' }] },
          ],
        },
      },
      KEYS,
    )
    expect(passesFilterNode(row, normalizeFilterRoot(out.filters))).toBe(true)
  })

  it('루트의 조건이 전부 죽으면 빈 AND(= 모두 통과)로 남는다', () => {
    const out = reconcileViewConfig(
      { filters: { op: 'or', children: [{ key: 'gone', op: 'eq', value: 'x' }] } },
      KEYS,
    )
    expect(out.filters).toEqual({ op: 'and', children: [] })
    expect(passesFilterNode(row, normalizeFilterRoot(out.filters))).toBe(true)
  })

  it('사용자가 조건을 다 지운 빈 그룹은 드리프트가 아니므로 보존한다', () => {
    const out = reconcileViewConfig({ filters: { op: 'or', children: [] } }, KEYS)
    expect(out.filters).toEqual({ op: 'or', children: [] })
  })

  it('레거시 평탄 배열도 같은 규칙으로 걸러진다', () => {
    const out = reconcileViewConfig(
      {
        filters: [
          { key: 'gone', op: 'eq', value: 1 },
          { key: 'amount', op: 'gt', value: 5 },
        ],
      },
      KEYS,
    )
    expect(out.filters).toEqual([{ key: 'amount', op: 'gt', value: 5 }])
  })
})

describe('reconcileViewConfig — 파생 키(valueKeys)', () => {
  // 주문 목록의 `__visitScheduled` 처럼 표에 세우지 않지만 행 props 에는 있는 키.
  const keys = { columnKeys: KEYS.columnKeys, valueKeys: [...KEYS.columnKeys, '__derived'] }

  it('컬럼이 아니어도 값이 있는 키의 조건부 서식은 살아남는다', () => {
    const saved: CollectionViewConfig = {
      conditionalFormats: [
        {
          id: 'r1',
          target: 'amount',
          when: { op: 'and', children: [{ key: '__derived', op: 'eq', value: true }] },
          style: { tone: 'warning' },
        },
      ],
    }
    expect(reconcileViewConfig(saved, keys).conditionalFormats).toHaveLength(1)
  })

  it('columnKeys 만 기준으로 삼으면 그 규칙이 사라진다 — 두 키 집합을 나눈 이유', () => {
    const saved: CollectionViewConfig = {
      conditionalFormats: [
        {
          id: 'r1',
          when: { op: 'and', children: [{ key: '__derived', op: 'eq', value: true }] },
          style: { tone: 'warning' },
        },
      ],
    }
    expect(reconcileViewConfig(saved, KEYS).conditionalFormats).toHaveLength(0)
  })
})

describe('reconcileViewConfig — 조건부 서식', () => {
  it('target 이 죽은 컬럼이면 칠할 자리가 없으므로 규칙을 뗀다', () => {
    const out = reconcileViewConfig(
      {
        conditionalFormats: [
          {
            id: 'r1',
            target: 'gone',
            when: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'x' }] },
            style: { bold: true },
          },
        ],
      },
      KEYS,
    )
    expect(out.conditionalFormats).toEqual([])
  })

  it('조건이 전부 죽으면 규칙을 뗀다 — 빈 AND 는 전 행에 항상 적용된다', () => {
    const out = reconcileViewConfig(
      {
        conditionalFormats: [
          {
            id: 'r1',
            target: 'amount',
            when: { op: 'and', children: [{ key: 'gone', op: 'eq', value: 1 }] },
            style: { tone: 'danger' },
          },
        ],
      },
      KEYS,
    )
    expect(out.conditionalFormats).toEqual([])
  })
})

describe('reconcileViewConfig — 그 밖의 키 참조 설정', () => {
  it('sort / groupBy / aggregations / coverKey 의 죽은 키를 떼어낸다', () => {
    const out = reconcileViewConfig(
      {
        sort: [
          { key: 'gone', dir: 'asc' },
          { key: 'name', dir: 'desc' },
        ],
        groupBy: 'gone',
        aggregations: { amount: 'sum', gone: 'count' },
        coverKey: 'gone',
      },
      KEYS,
    )
    expect(out.sort).toEqual([{ key: 'name', dir: 'desc' }])
    expect(out.groupBy).toBeUndefined()
    expect(out.aggregations).toEqual({ amount: 'sum' })
    expect(out.coverKey).toBeUndefined()
  })

  it('timeline — startKey 가 죽으면 통째로, endKey 만 죽으면 endKey 만 뗀다', () => {
    expect(reconcileViewConfig({ timeline: { startKey: 'gone' } }, KEYS).timeline).toBeUndefined()
    expect(
      reconcileViewConfig({ timeline: { startKey: 'name', endKey: 'gone' } }, KEYS).timeline,
    ).toEqual({ startKey: 'name' })
  })

  it('키와 무관한 설정(type·rowHeight·rowOrder 등)은 손대지 않는다', () => {
    const saved: CollectionViewConfig = {
      type: 'board',
      rowHeight: 'L',
      wrapCells: true,
      rowOrder: ['rec-1', 'rec-2'],
      cardOrder: { active: ['rec-1'] },
    }
    expect(reconcileViewConfig(saved, KEYS)).toEqual(saved)
  })

  it('입력을 변형하지 않는다(순수)', () => {
    const saved: CollectionViewConfig = { visibleProps: ['gone', 'name'], sort: [] }
    const snapshot = structuredClone(saved)
    reconcileViewConfig(saved, KEYS)
    expect(saved).toEqual(snapshot)
  })
})

describe('collectViewConfigKeys', () => {
  it('모든 자리에서 참조 키를 모은다(중첩 필터·조건부 서식 포함)', () => {
    const keys = collectViewConfigKeys({
      visibleProps: ['name'],
      sort: [{ key: 'amount', dir: 'asc' }],
      filters: {
        op: 'and',
        children: [
          { key: 'status', op: 'eq', value: 'x' },
          { op: 'or', children: [{ key: 'nested', op: 'is_empty' }] },
        ],
      },
      groupBy: 'status',
      aggregations: { amount: 'sum' },
      coverKey: 'cover',
      timeline: { startKey: 'from', endKey: 'to' },
      conditionalFormats: [
        {
          id: 'r',
          target: 'amount',
          when: { op: 'and', children: [{ key: '__derived', op: 'eq', value: true }] },
          style: {},
        },
      ],
    })
    expect(new Set(keys)).toEqual(
      new Set(['name', 'amount', 'status', 'nested', 'cover', 'from', 'to', '__derived']),
    )
  })

  it('빈 설정이면 빈 배열', () => {
    expect(collectViewConfigKeys({})).toEqual([])
  })

  it('기본 뷰에 돌리면 파생 키가 valueKeys 로 살아난다 — 화면이 목록을 손으로 관리하지 않아도 된다', () => {
    const initial: CollectionViewConfig = {
      conditionalFormats: [
        {
          id: 'visit-scheduled',
          target: 'name',
          when: { op: 'and', children: [{ key: '__visitScheduled', op: 'eq', value: true }] },
          style: { tone: 'warning' },
        },
      ],
    }
    const keys = {
      columnKeys: KEYS.columnKeys,
      valueKeys: [...KEYS.columnKeys, ...collectViewConfigKeys(initial)],
    }
    expect(reconcileViewConfig(initial, keys).conditionalFormats).toHaveLength(1)
  })
})

describe('isViewConfigReconciled', () => {
  it('떨어진 게 없으면 false, 있으면 true', () => {
    const clean: CollectionViewConfig = { sort: [{ key: 'name', dir: 'asc' }] }
    expect(isViewConfigReconciled(clean, reconcileViewConfig(clean, KEYS))).toBe(false)
    const dirty: CollectionViewConfig = { sort: [{ key: 'gone', dir: 'asc' }] }
    expect(isViewConfigReconciled(dirty, reconcileViewConfig(dirty, KEYS))).toBe(true)
  })
})

describe('reconcileSavedViewConfigs', () => {
  it('뷰 배열의 config 만 정리하고 id·name 은 그대로 둔다', () => {
    const out = reconcileSavedViewConfigs(
      [
        { id: 'a', name: '전체', config: { sort: [{ key: 'gone', dir: 'asc' }] } },
        { id: 'b', name: '활성', config: { groupBy: 'status' } },
      ],
      KEYS,
    )
    expect(out).toEqual([
      { id: 'a', name: '전체', config: { sort: [] } },
      { id: 'b', name: '활성', config: { groupBy: 'status' } },
    ])
  })
})
