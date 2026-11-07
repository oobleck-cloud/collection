import { canEditSavedView, canSaveSavedViewConfig } from '@oobleck/collection'

import type { ArrangeTabs, SavedView, SavedViewGuardContext, TabRowItem } from '@oobleck/collection'

/**
 * 업무 그룹 — 꺼내 둔 탭이 열 개를 넘으면 한 줄에서 찾기 어렵다. 뷰에 **그룹 이름**을 달아 탭 줄 1단에는
 * 그룹 탭(묶음 탭)을, 2단에는 지금 그룹의 뷰만 세운다.
 *
 * 그룹은 따로 저장되는 실체가 아니라 **뷰가 가진 이름**이다. 그래서 그룹 탭은 꺼내 둔 순서에서 처음 나온
 * 자리에 서고, 마지막 뷰가 빠지면 그룹도 사라진다. 그룹 탭끼리의 순서는 사람마다 따로 고를 수 있다
 * (`arrangeTabsByGroupOrder` — 그룹 탭이 선 자리 안에서만 바뀌고, 묶이지 않은 뷰 자리는 그대로). 기본 뷰는
 * 그룹에 들지 않는다(첫 자리 고정). 이름을 어디에 저장할지는 호스트의 몫이다(뷰를 읽을 때 `group` 에 채운다).
 *
 * 코어 탭 줄(`ViewTabs`)과는 `arrangeTabs` 와 `tabMenuExtras` 두 자리로만 잇는다 — React 쪽은 `./view-groups`.
 */

/** 탭 줄 1단의 묶음(그룹) 탭. */
type BundleItem = Extract<TabRowItem, { kind: 'bundle' }>

/** 그룹 이름을 가진 뷰 — 미지정 · 빈 문자열이면 그룹 없음. */
export type GroupedSavedView = SavedView & { group?: string }

/** 그룹 이름 정규화 — 앞뒤 공백을 떼고, 빈 이름은 그룹 없음(null). */
export function normalizeGroupName(name: string | null | undefined): string | null {
  const trimmed = (name ?? '').trim()
  return trimmed === '' ? null : trimmed
}

/** 이 뷰의 그룹 — 없으면 null. */
export function viewGroupOf(view: SavedView): string | null {
  return normalizeGroupName((view as GroupedSavedView).group)
}

/** 뷰에 그룹을 단다(null 이면 뗀다) — 원본은 그대로. */
export function withViewGroup<V extends SavedView>(view: V, group: string | null): V {
  const { group: _drop, ...rest } = view as V & { group?: string }
  const next = normalizeGroupName(group)
  return (next === null ? rest : { ...rest, group: next }) as V
}

/** 목록에 있는 그룹 이름 — 처음 나온 순서, 중복 없이(그룹으로 옮길 때의 선택지). */
export function viewGroupNames(views: readonly SavedView[]): string[] {
  const names: string[] = []
  for (const view of views) {
    const group = viewGroupOf(view)
    if (group !== null && !names.includes(group)) names.push(group)
  }
  return names
}

/** 탭 줄 배치 — 그룹 탭은 그 그룹의 뷰가 처음 나온 자리에 선다. 묶음 key 는 그룹 이름 그대로. */
export const arrangeTabsByGroup: ArrangeTabs = (tabs, { defaultViewId, activeId }) => {
  const items: TabRowItem[] = []
  const groups = new Map<string, SavedView[]>()
  let activeBundle: string | null = null
  for (const view of tabs) {
    const group = view.id === defaultViewId ? null : viewGroupOf(view)
    if (view.id === activeId) activeBundle = group
    if (group === null) {
      items.push({ kind: 'view', view })
      continue
    }
    const members = groups.get(group)
    if (members) {
      members.push(view)
      continue
    }
    const created = [view]
    groups.set(group, created)
    items.push({ kind: 'bundle', key: group, label: group, views: created })
  }
  return {
    items,
    activeBundle,
    activeBundleViews: activeBundle === null ? [] : (groups.get(activeBundle) ?? []),
  }
}

/**
 * 그룹 순서를 따르는 탭 줄 배치 — 그룹 탭이 선 **자리**는 그대로 두고, 그 자리들 안에서 `order` 순으로 다시 세운다.
 * `order` 에 없는 그룹은 저장된 그룹 뒤에, 처음 나온 순서대로. 묶이지 않은 뷰는 움직이지 않는다.
 */
export function arrangeTabsByGroupOrder(order: readonly string[]): ArrangeTabs {
  if (order.length === 0) return arrangeTabsByGroup
  const rank = new Map(order.map((name, i) => [name, i]))
  return (tabs, ctx) => {
    const arranged = arrangeTabsByGroup(tabs, ctx)
    const bundles = arranged.items.filter((i): i is BundleItem => i.kind === 'bundle')
    const sorted = bundles
      .map((item, appeared) => ({ item, appeared }))
      .sort(
        (a, b) =>
          (rank.get(a.item.key) ?? order.length) - (rank.get(b.item.key) ?? order.length) ||
          a.appeared - b.appeared,
      )
      .map((x) => x.item)
    let next = 0
    return {
      ...arranged,
      items: arranged.items.map((item) => (item.kind === 'bundle' ? sorted[next++]! : item)),
    }
  }
}

/**
 * 그룹 탭을 끌어 놓은 뒤 저장할 순서 — 지금 탭 줄에 선 그룹(새 순서)을 앞에, 저장돼 있던 나머지(지금 탭에 없는 그룹)를
 * 그 뒤에 둔다. 탭에서 잠시 빠진 그룹도 다시 나오면 고른 자리로 돌아온다.
 */
export function nextGroupOrder(saved: readonly string[], shown: readonly string[]): string[] {
  const head = [...new Set(shown)]
  return [...head, ...saved.filter((name) => !head.includes(name))]
}

/**
 * 그룹을 옮길 수 있는가 — 이름을 고칠 수 있는 뷰(내 뷰), 또는 설정을 저장할 수 있는 뷰(관리자: 남의 공유 뷰 ·
 * 시스템 뷰). 그룹은 모두에게 보이는 뷰의 속성이라 남의 비공개 뷰는 관리자도 못 옮긴다. 기본 뷰는 누구도 못 옮긴다.
 */
export function canMoveViewToGroup(view: SavedView, guard: SavedViewGuardContext): boolean {
  return canEditSavedView(view, guard) || canSaveSavedViewConfig(view, guard)
}
