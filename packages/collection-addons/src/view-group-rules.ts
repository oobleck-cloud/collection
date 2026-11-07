import { canEditSavedView, canSaveSavedViewConfig } from '@oobleck/collection'

import type { ArrangeTabs, SavedView, SavedViewGuardContext, TabRowItem } from '@oobleck/collection'

/**
 * 업무 그룹 — 꺼내 둔 탭이 열 개를 넘으면 한 줄에서 찾기 어렵다. 뷰에 **그룹 이름**을 달아 탭 줄 1단에는
 * 그룹 탭(묶음 탭)을, 2단에는 지금 그룹의 뷰만 세운다.
 *
 * 그룹은 따로 저장되는 실체가 아니라 **뷰가 가진 이름**이다. 그래서 그룹 순서는 꺼내 둔 순서에서 처음 나온
 * 자리를 따르고(각자의 탭 배치가 그대로 그룹 배치가 된다), 마지막 뷰가 빠지면 그룹도 사라진다. 기본 뷰는
 * 그룹에 들지 않는다(첫 자리 고정). 이름을 어디에 저장할지는 호스트의 몫이다(뷰를 읽을 때 `group` 에 채운다).
 *
 * 코어 탭 줄(`ViewTabs`)과는 `arrangeTabs` 와 `tabMenuExtras` 두 자리로만 잇는다 — React 쪽은 `./view-groups`.
 */

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
 * 그룹을 옮길 수 있는가 — 이름을 고칠 수 있는 뷰(내 뷰), 또는 설정을 저장할 수 있는 뷰(관리자: 남의 공유 뷰 ·
 * 시스템 뷰). 그룹은 모두에게 보이는 뷰의 속성이라 남의 비공개 뷰는 관리자도 못 옮긴다. 기본 뷰는 누구도 못 옮긴다.
 */
export function canMoveViewToGroup(view: SavedView, guard: SavedViewGuardContext): boolean {
  return canEditSavedView(view, guard) || canSaveSavedViewConfig(view, guard)
}
