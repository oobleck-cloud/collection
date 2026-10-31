import { describe, expect, it, vi } from 'vitest'

// DS 배럴은 vitest 에서 별칭 경로가 풀리지 않는다 — 이 시험은 순수 함수만 보므로 통째로 비운다.
vi.mock('@oobleck/systheme', () => ({}))

import { builtinSuggester } from '@oobleck/collection'
import { opsFor } from './filter-builder'

import type { PropertyDef } from '@oobleck/collection'

describe('관계 속성 — 카디널리티가 연산자를 가른다', () => {
  it('여럿을 담는 관계는 포함·미포함(multi_select 꼴)', () => {
    expect(opsFor('relation', { target: 'region', cardinality: 'many' })).toEqual([
      'has',
      'not_has',
      'in',
      'not_in',
      'is_empty',
      'is_not_empty',
    ])
  })

  it('하나를 담는 관계는 같음·포함목록(select 꼴)', () => {
    expect(opsFor('relation', { target: 'region' })).toEqual([
      'eq',
      'neq',
      'in',
      'not_in',
      'is_empty',
      'is_not_empty',
    ])
  })
})

describe('관계 속성 검색 제안', () => {
  const regions: PropertyDef = {
    key: 'mainWorkRegionIds',
    label: '주구역',
    type: 'relation',
    source: 'frontmatter',
    origin: 'preset',
    relation: { target: 'region', cardinality: 'many' },
    options: [
      { value: 'r-gangnam', label: '강남구' },
      { value: 'r-goyang', label: '고양시' },
    ],
  }

  it('후보 라벨로 겨누고, 여럿 관계는 포함(has)으로 낸다', () => {
    const [s] = builtinSuggester('강남', regions)
    expect(s?.conditions).toEqual([{ key: 'mainWorkRegionIds', op: 'has', value: 'r-gangnam' }])
  })

  it('후보가 없으면 약한 부분일치로 물러선다', () => {
    const [s] = builtinSuggester('강남', { ...regions, options: [] })
    expect(s?.strength).toBe('weak')
  })
})
