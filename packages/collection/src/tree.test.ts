import { describe, expect, it } from 'vitest'
import { treeRows } from './tree'

const row = (id: string, props: Record<string, unknown>) => ({ id, props })
const shape = (out: ReturnType<typeof treeRows>) => out.map((t) => `${'  '.repeat(t.depth - 1)}${t.row.id}${t.hidden ? `+${t.hidden}` : ''}`)

describe('treeRows', () => {
  const rows = [
    row('1', { slug: 'a', parent: null }),
    row('2', { slug: 'b', parent: 'a' }),
    row('3', { slug: 'c', parent: 'b' }),
    row('4', { slug: 'd', parent: 'a' }),
    row('5', { slug: 'e', parent: 'zz' }),
    row('6', { slug: 'f', parent: ['c'] }),
  ]

  it('위 줄 아래에 받은 차례대로 들여 펴고, 위 줄을 못 찾은 줄은 맨 위 줄이다', () => {
    expect(shape(treeRows(rows, { parent: 'parent', match: 'slug' }))).toEqual(['1', '  2', '    3', '      6', '  4', '5'])
    expect(treeRows(rows, { parent: 'parent', match: 'slug' })[0].children).toBe(2)
  })

  it('깊이보다 깊은 줄은 펴지 않고 보이는 위 줄의 하위 수로 센다', () => {
    expect(shape(treeRows(rows, { parent: 'parent', match: 'slug', depth: 2 }))).toEqual(['1', '  2+2', '  4', '5'])
    expect(shape(treeRows(rows, { parent: 'parent', match: 'slug', depth: 0 }))).toEqual(['1+4', '5'])
  })

  it('match 를 주지 않으면 레코드 id 와 견주고, 서로를 가리키는 고리도 한 번씩만 편다', () => {
    expect(shape(treeRows([row('x', { up: null }), row('y', { up: 'x' })], { parent: 'up' }))).toEqual(['x', '  y'])
    expect(shape(treeRows([row('p', { up: 'q' }), row('q', { up: 'p' }), row('r', { up: 'r' })], { parent: 'up' }))).toEqual(['r', 'p', '  q'])
  })
})
