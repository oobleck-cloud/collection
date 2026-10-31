// @oobleck/collection — 프로퍼티 패널의 계층(group 경로) 묶기·검색·그룹 내 순서 계산.
//
// 필터 추가 목록(filter-builder.propertyOption)과 같은 `PropertyDef.group` 경로를 쓴다.
// 순수 함수만 둔다 — 렌더/상태는 properties-panel.tsx.

import type { PropertyDef } from '@oobleck/collection'

export const GROUP_SEPARATOR = ' › '

export type PropertyBucket = {
  /** 경로 문자열(`주문 › 일정`). 그룹 없는 속성은 빈 문자열. */
  path: string
  items: PropertyDef[]
}

/** 속성의 경로 문자열 — group 이 없거나 비면 ''. */
export function groupPath(def: PropertyDef): string {
  return def.group && def.group.length > 0 ? def.group.join(GROUP_SEPARATOR) : ''
}

/**
 * 같은 경로끼리 묶는다 — 묶음은 처음 나온 순서, 묶음 안은 입력 순서.
 * 그룹 없는 묶음('')은 항상 맨 뒤. 입력 순서는 건드리지 않는다(표시 중 목록은 visibleProps 순서).
 */
export function bucketByGroup(defs: PropertyDef[]): PropertyBucket[] {
  const map = new Map<string, PropertyDef[]>()
  for (const def of defs) {
    const p = groupPath(def)
    const list = map.get(p)
    if (list) list.push(def)
    else map.set(p, [def])
  }
  const named = [...map.entries()].filter(([p]) => p !== '')
  const loose = map.get('')
  return [
    ...named.map(([path, items]) => ({ path, items })),
    ...(loose ? [{ path: '', items: loose }] : []),
  ]
}

/** 스키마에 group 이 하나라도 있나 — 없으면 패널은 예전처럼 평평하게 그린다. */
export function hasAnyGroup(defs: PropertyDef[]): boolean {
  return defs.some((d) => groupPath(d) !== '')
}

/** 라벨·별칭·경로에 질의가 들어 있나(대소문자 무시). 빈 질의는 모두 통과. */
export function matchesQuery(def: PropertyDef, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  const hay = [def.label, def.key, groupPath(def), ...(def.aliases ?? [])]
  return hay.some((s) => s.toLowerCase().includes(q))
}

/**
 * 한 그룹 안에서 `from` 번째를 `to` 로 옮긴 결과를 전체 visibleProps 순서에 되돌려 쓴다.
 * 그룹 멤버가 차지하던 자리(슬롯)만 새 순서로 채우고, 다른 그룹 속성의 자리는 그대로 둔다.
 */
export function reorderWithinGroup(
  allKeys: string[],
  groupKeys: string[],
  from: number,
  to: number,
): string[] {
  const reordered = groupKeys.slice()
  const [moved] = reordered.splice(from, 1)
  if (moved === undefined) return allKeys
  reordered.splice(Math.max(0, Math.min(to, reordered.length)), 0, moved)
  const members = new Set(groupKeys)
  let i = 0
  return allKeys.map((k) => (members.has(k) ? reordered[i++] : k))
}
