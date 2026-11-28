import type { TreeConfig } from './types'
import type { Row } from './view'

// tree 뷰 줄 펴기(순수) — 위 줄(parent 속성 값 = 위 줄의 match 값, match 미지정이면 레코드 id) 아래에 들여 앞차례(pre-order)로 편다.
// 받은 rows 차례를 형제 차례로 쓴다(정렬은 호출자가 먼저). 위 줄을 rows 에서 찾지 못한 줄은 맨 위 줄이다.
// depth 보다 깊은 줄은 펴지 않고, 보이는 가장 깊은 위 줄의 hidden(하위 N개)에 센다. 고리(서로를 위 줄로 가리킴)는 한 번만 편다.

export type TreeRow<P> = { row: Row<P>; depth: number; children: number; hidden: number }

const DEPTH_MAX = 20

const keyOf = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : Array.isArray(v) ? (v.length ? String(v[0]) : null) : String(v)

export function treeRows<P extends Record<string, unknown>>(rows: Row<P>[], config: TreeConfig): TreeRow<P>[] {
  const depth = Math.max(1, Math.min(DEPTH_MAX, Math.trunc(config.depth ?? DEPTH_MAX)))
  const matchOf = (r: Row<P>) => (config.match ? keyOf(r.props[config.match]) : r.id)
  const byMatch = new Map<string, Row<P>>()
  for (const r of rows) {
    const m = matchOf(r)
    if (m !== null && !byMatch.has(m)) byMatch.set(m, r)
  }
  const kids = new Map<string, Row<P>[]>()
  const roots: Row<P>[] = []
  for (const r of rows) {
    const p = keyOf(r.props[config.parent])
    const up = p === null ? undefined : byMatch.get(p)
    if (!up || up === r) roots.push(r)
    else kids.set(up.id, [...(kids.get(up.id) ?? []), r])
  }
  const out: TreeRow<P>[] = []
  const seen = new Set<string>()
  const count = (r: Row<P>): number => {
    let n = 0
    for (const c of kids.get(r.id) ?? []) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      n += 1 + count(c)
    }
    return n
  }
  const walk = (r: Row<P>, d: number) => {
    seen.add(r.id)
    const own = (kids.get(r.id) ?? []).filter((c) => !seen.has(c.id))
    const item: TreeRow<P> = { row: r, depth: d, children: own.length, hidden: 0 }
    out.push(item)
    if (d >= depth) {
      item.hidden = count(r)
      return
    }
    for (const c of own) if (!seen.has(c.id)) walk(c, d + 1)
  }
  for (const r of roots) if (!seen.has(r.id)) walk(r, 1)
  // 위 줄끼리 서로를 가리켜 맨 위 줄이 없는 고리: 처음 만난 줄부터 편다
  for (const r of rows) if (!seen.has(r.id)) walk(r, 1)
  return out
}
