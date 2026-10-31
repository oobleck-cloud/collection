// 대시보드 지표 계산(buildDashboardMetrics) 순수 변환 — total·분포 카드 도출 핀.
//
// 핵심 회귀:
//   - 빈 행 → total 0, 분포 없음(0 나눗셈/NaN 없음).
//   - select 없는 스키마 → total 만(분포 빈 배열 — Total 카드는 항상 동작).
//   - select 분포 → 값별 count 집계(옵션 라벨/색 반영).
//   - multi_select fan-out → 한 행이 멤버 수만큼 여러 그룹에 귀속(코어 viewGroups 규칙).
//   - select/multi_select 가 4개 초과면 앞에서 MAX_DISTRIBUTIONS(4)개만.

import { describe, it, expect } from 'vitest'
import { buildDashboardMetrics, MAX_DISTRIBUTIONS } from './dashboard-metrics'
import type { PropertyDef, PropertyValue, ViewConfig } from '@oobleck/collection'
import type { Row } from '@oobleck/collection'

/** 필터 없는 기본 view(대시보드는 type 만 의미 — filter/sort 빈 값). */
const view: ViewConfig = { type: 'dashboard', filters: { op: 'and', children: [] }, sort: [] }

/** 행 생성 헬퍼 — id + 속성 맵. */
function row(id: string, props: Record<string, PropertyValue>): Row<Record<string, PropertyValue>> {
  return { id, props }
}

/** select/multi_select 프로퍼티 정의 헬퍼. */
function selectDef(
  key: string,
  type: 'select' | 'multi_select',
  options?: PropertyDef['options'],
): PropertyDef {
  return {
    key,
    label: key,
    type,
    source: 'frontmatter',
    origin: 'preset',
    ...(options !== undefined ? { options } : {}),
  }
}

const textDef: PropertyDef = {
  key: 'name',
  label: '이름',
  type: 'text',
  source: 'frontmatter',
  origin: 'preset',
}

describe('buildDashboardMetrics — 지표 요약 도출', () => {
  it('빈 행 → total 0, 분포 없음', () => {
    const schema = [textDef, selectDef('status', 'select', ['active', 'inactive'])]
    const metrics = buildDashboardMetrics([], schema, view)
    expect(metrics.total).toBe(0)
    expect(metrics.distributions).toEqual([])
  })

  it('select/multi_select 가 없는 스키마 → total 만(분포 빈 배열)', () => {
    const schema = [
      textDef,
      {
        key: 'count',
        label: '수',
        type: 'number' as const,
        source: 'frontmatter' as const,
        origin: 'preset' as const,
      },
    ]
    const rows = [row('r1', { name: '알파', count: 3 }), row('r2', { name: '베타', count: 7 })]
    const metrics = buildDashboardMetrics(rows, schema, view)
    expect(metrics.total).toBe(2)
    expect(metrics.distributions).toEqual([])
  })

  it('select 분포 → 값별 count 집계 + 옵션 라벨/색 반영', () => {
    const schema = [
      textDef,
      selectDef('status', 'select', [
        { value: 'active', label: '활성', color: 'green' },
        { value: 'inactive', label: '비활성', color: 'red' },
      ]),
    ]
    const rows = [
      row('r1', { name: '알파', status: 'active' }),
      row('r2', { name: '베타', status: 'active' }),
      row('r3', { name: '감마', status: 'inactive' }),
    ]
    const metrics = buildDashboardMetrics(rows, schema, view)

    expect(metrics.total).toBe(3)
    expect(metrics.distributions).toHaveLength(1)
    const dist = metrics.distributions[0]
    expect(dist.key).toBe('status')
    // 막대: 활성=2, 비활성=1 (옵션 라벨·색 반영).
    const byLabel = new Map(dist.bars.map((b) => [b.label, b]))
    expect(byLabel.get('활성')?.count).toBe(2)
    expect(byLabel.get('활성')?.color).toBe('green')
    expect(byLabel.get('비활성')?.count).toBe(1)
    expect(byLabel.get('비활성')?.color).toBe('red')
    // 최대 그룹(활성=2) = 100%, 비활성=1 → 50%.
    expect(byLabel.get('활성')?.pct).toBe(100)
    expect(byLabel.get('비활성')?.pct).toBe(50)
    // 결정적 정렬: 빈도 내림차순(활성 2 → 비활성 1) — 영속 groupSort 와 무관하게 고정.
    expect(dist.bars.map((b) => b.count)).toEqual([2, 1])
  })

  it('multi_select fan-out → 한 행이 멤버 수만큼 여러 그룹에 귀속', () => {
    const schema = [textDef, selectDef('tags', 'multi_select', ['a', 'b', 'c'])]
    const rows = [
      row('r1', { name: '알파', tags: ['a', 'b'] }),
      row('r2', { name: '베타', tags: ['b'] }),
    ]
    const metrics = buildDashboardMetrics(rows, schema, view)

    expect(metrics.total).toBe(2) // total 은 행 수(fan-out 과 무관).
    const dist = metrics.distributions[0]
    const byLabel = new Map(dist.bars.map((b) => [b.label, b.count]))
    // a: r1 / b: r1,r2 / c: 없음. fan-out 으로 r1 이 a·b 두 그룹에 등장.
    expect(byLabel.get('a')).toBe(1)
    expect(byLabel.get('b')).toBe(2)
  })

  it('select/multi_select 가 4개 초과 → 앞에서 MAX_DISTRIBUTIONS(4)개만', () => {
    const schema = [
      textDef,
      selectDef('s1', 'select', ['x']),
      selectDef('s2', 'select', ['x']),
      selectDef('s3', 'multi_select', ['x']),
      selectDef('s4', 'select', ['x']),
      selectDef('s5', 'select', ['x']), // 5번째 — 잘려야 한다.
    ]
    const rows = [row('r1', { name: '알파', s1: 'x', s2: 'x', s3: ['x'], s4: 'x', s5: 'x' })]
    const metrics = buildDashboardMetrics(rows, schema, view)

    expect(metrics.distributions).toHaveLength(MAX_DISTRIBUTIONS)
    expect(metrics.distributions.map((d) => d.key)).toEqual(['s1', 's2', 's3', 's4'])
  })
})
