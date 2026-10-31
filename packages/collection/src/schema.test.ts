import { describe, it, expect } from 'vitest'
import { composeSchema } from './schema'
import type { PropertyDef, PresetSet } from './types'

const def = (key: string, over: Partial<PropertyDef> = {}): PropertyDef => ({
  key,
  label: over.label ?? key,
  type: over.type ?? 'text',
  source: over.source ?? 'frontmatter',
  origin: over.origin ?? 'preset',
  options: over.options,
})

const productPreset: PresetSet = {
  id: 'product_basic',
  label: '상품 기본',
  props: [
    def('status', {
      type: 'select',
      options: ['draft', 'published', 'archived'],
      origin: 'preset',
    }),
    def('category', { type: 'select', origin: 'preset' }),
    def('tags', { type: 'multi_select', origin: 'preset' }),
  ],
}

describe('composeSchema — 동적 베이스 + 정적 프리셋 세트', () => {
  it('충돌 없으면 base 먼저, 그 뒤 프리셋 순서로 합친다', () => {
    const base = [
      def('note', { origin: 'base' }),
      def('priority', { type: 'number', origin: 'base' }),
    ]
    const result = composeSchema(base, [productPreset])
    expect(result.map((p) => p.key)).toEqual(['note', 'priority', 'status', 'category', 'tags'])
  })

  it('key 충돌은 base 가 우선한다(프리셋 정의를 덮음)', () => {
    const base = [def('status', { type: 'text', label: '내 상태', origin: 'base' })]
    const result = composeSchema(base, [productPreset])
    const status = result.find((p) => p.key === 'status')!
    expect(status.origin).toBe('base')
    expect(status.type).toBe('text')
    expect(status.label).toBe('내 상태')
    // 프리셋 status 는 흡수되어 중복 출력되지 않는다.
    expect(result.filter((p) => p.key === 'status')).toHaveLength(1)
  })

  it('프리셋 세트끼리 충돌하면 먼저 적용된 세트가 우선', () => {
    const setA: PresetSet = { id: 'a', label: 'A', props: [def('owner', { label: 'A-owner' })] }
    const setB: PresetSet = { id: 'b', label: 'B', props: [def('owner', { label: 'B-owner' })] }
    const result = composeSchema([], [setA, setB])
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('A-owner')
  })

  it('한 세트 내부 중복 key 는 먼저 나온 것이 우선', () => {
    const dup: PresetSet = {
      id: 'dup',
      label: 'dup',
      props: [def('x', { label: 'first' }), def('x', { label: 'second' })],
    }
    const result = composeSchema([], [dup])
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('first')
  })

  it('base 내부 중복 key 는 첫 정의만 남는다', () => {
    const base = [
      def('a', { label: 'first', origin: 'base' }),
      def('a', { label: 'second', origin: 'base' }),
    ]
    const result = composeSchema(base, [])
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('first')
  })

  it('빈 입력 — base 와 presets 모두 비면 빈 배열', () => {
    expect(composeSchema([], [])).toEqual([])
  })

  it('프리셋만 있으면 프리셋 그대로', () => {
    expect(composeSchema([], [productPreset]).map((p) => p.key)).toEqual([
      'status',
      'category',
      'tags',
    ])
  })

  it('base 만 있으면 base 그대로', () => {
    const base = [def('x', { origin: 'base' })]
    expect(composeSchema(base, []).map((p) => p.key)).toEqual(['x'])
  })
})
