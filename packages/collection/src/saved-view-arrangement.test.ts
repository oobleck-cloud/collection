import { describe, expect, it } from 'vitest'

import { flatTabArrangement, reorderWithin } from './saved-views'

describe('flatTabArrangement', () => {
  it('묶지 않고 차례로 세우며 2단이 없다', () => {
    const tabs = [
      { id: 'default', name: '기본', config: {} },
      { id: 'a', name: 'a', config: {} },
    ]
    const arranged = flatTabArrangement(tabs, { defaultViewId: 'default', activeId: 'a' })
    expect(arranged.items.map((i) => (i.kind === 'view' ? i.view.id : i.key))).toEqual([
      'default',
      'a',
    ])
    expect(arranged.activeBundle).toBeNull()
    expect(arranged.activeBundleViews).toEqual([])
  })
})

describe('reorderWithin', () => {
  it('일부만 끌어도 나머지 자리는 그대로', () => {
    expect(reorderWithin(['a', 'x', 'b', 'y', 'c'], ['c', 'a', 'b'])).toEqual([
      'c',
      'x',
      'a',
      'y',
      'b',
    ])
  })

  it('목록에 없는 id 는 무시한다', () => {
    expect(reorderWithin(['a', 'b'], ['ghost', 'b', 'a'])).toEqual(['b', 'a'])
  })
})
