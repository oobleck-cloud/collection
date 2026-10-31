import { describe, expect, it } from 'vitest'
import type { PropertyDef } from '@oobleck/collection'
import {
  bucketByGroup,
  groupPath,
  hasAnyGroup,
  matchesQuery,
  reorderWithinGroup,
} from './properties-panel-groups'

const def = (key: string, group?: string[], extra: Partial<PropertyDef> = {}): PropertyDef =>
  ({ key, label: key, type: 'text', ...(group ? { group } : {}), ...extra }) as PropertyDef

describe('properties-panel-groups', () => {
  it('경로를 › 로 잇고 그룹 없으면 빈 문자열', () => {
    expect(groupPath(def('a', ['견적', '참여 파트너']))).toBe('견적 › 참여 파트너')
    expect(groupPath(def('a'))).toBe('')
    expect(groupPath(def('a', []))).toBe('')
  })

  it('묶음은 처음 나온 순서, 그룹 없음은 맨 뒤, 안쪽 순서 보존', () => {
    const b = bucketByGroup([def('x'), def('a', ['A']), def('b', ['B']), def('c', ['A'])])
    expect(b.map((g) => [g.path, g.items.map((d) => d.key)])).toEqual([
      ['A', ['a', 'c']],
      ['B', ['b']],
      ['', ['x']],
    ])
  })

  it('group 이 하나도 없으면 hasAnyGroup false', () => {
    expect(hasAnyGroup([def('a')])).toBe(false)
    expect(hasAnyGroup([def('a'), def('b', ['B'])])).toBe(true)
  })

  it('라벨·별칭·경로로 검색', () => {
    const d = def('moveDate', ['주문', '일정'], { label: '이사 예정일', aliases: ['이사일'] })
    expect(matchesQuery(d, '')).toBe(true)
    expect(matchesQuery(d, '예정')).toBe(true)
    expect(matchesQuery(d, '이사일')).toBe(true)
    expect(matchesQuery(d, '일정')).toBe(true)
    expect(matchesQuery(d, '출발')).toBe(false)
  })

  it('그룹 안 순서 변경은 다른 그룹 자리를 건드리지 않는다', () => {
    // a1 b1 a2 a3 b2  — A 그룹 [a1 a2 a3] 에서 a3 를 맨 앞으로
    const next = reorderWithinGroup(['a1', 'b1', 'a2', 'a3', 'b2'], ['a1', 'a2', 'a3'], 2, 0)
    expect(next).toEqual(['a3', 'b1', 'a1', 'a2', 'b2'])
  })
})
