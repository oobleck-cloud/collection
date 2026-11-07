'use client'

import { useState } from 'react'

import type { SavedView } from '@oobleck/collection'
import { useCollectionLocale } from '@oobleck/collection-views'
import { Check, Input, Tags, cn } from '@oobleck/collection-views/kit'
import {
  ViewTabMenuBack,
  ViewTabMenuRow,
  type ViewTabMenuExtra,
} from '@oobleck/collection-views/views/view-tab-menu'

import {
  arrangeTabsByGroupOrder,
  canMoveViewToGroup,
  nextGroupOrder,
  normalizeGroupName,
  viewGroupNames,
  viewGroupOf,
} from './view-group-rules'
import { viewGroupsCopy } from './view-groups.messages'

import type { ViewTabsProps } from '@oobleck/collection-views/views/ViewTabs'

export * from './view-group-rules'

/**
 * 그룹 고르기 — 탭 메뉴 자리에서 바뀌어 열린다. 있는 그룹 · 그룹 없음 · 새 그룹 이름 입력. 지금 그룹에는 체크.
 */
export function ViewGroupPicker({
  current,
  groupNames,
  onBack,
  onPick,
}: {
  current: string | null
  groupNames: readonly string[]
  onBack: () => void
  onPick: (group: string | null) => void
}) {
  const c = viewGroupsCopy(useCollectionLocale())
  const [draft, setDraft] = useState('')
  const submit = () => {
    const name = normalizeGroupName(draft)
    if (name !== null) onPick(name)
  }
  const choice = (group: string | null, label: string) => (
    <ViewTabMenuRow
      key={group ?? ''}
      icon={
        <Check
          className={cn('size-3.5', current === group ? 'opacity-100' : 'opacity-0')}
          aria-hidden
        />
      }
      label={label}
      onClick={() => onPick(group)}
    />
  )
  return (
    <div role="menu" aria-label={c.moveToGroup} className="flex flex-col">
      <ViewTabMenuBack label={c.moveToGroup} onBack={onBack} />
      {groupNames.map((group) => choice(group, group))}
      {choice(null, c.noGroup)}
      <div className="p-1">
        <Input
          size="sm"
          value={draft}
          onValueChange={setDraft}
          placeholder={c.newGroupPlaceholder}
          onEnterKey={submit}
        />
      </div>
    </div>
  )
}

export type UseViewGroupTabsOptions = {
  /** 서랍의 뷰 전체 — 고를 그룹 이름을 여기서 모은다. */
  views: readonly SavedView[]
  defaultViewId: string
  currentUserId?: string | null
  canManageAny?: boolean
  /** 뷰를 그룹으로 옮긴다(null = 그룹에서 빼기). 없으면 탭만 묶고 메뉴 항목은 없다. */
  onMoveToGroup?: (id: string, group: string | null) => void
  /** 이 사람이 고른 그룹 탭 순서(그룹 이름). 없거나 비면 꺼내 둔 순서에서 처음 나온 자리대로. */
  groupOrder?: readonly string[]
  /** 그룹 탭을 끌어 놓았을 때 저장할 순서 — 탭에 없는 그룹의 자리도 담는다. 없으면 그룹 탭은 끌리지 않는다. */
  onReorderGroups?: (groupOrder: string[]) => void
}

/**
 * 업무 그룹을 `ViewTabs` 에 건다 — 돌려준 값을 그대로 펼쳐 넘긴다.
 *
 * ```tsx
 * const groups = useViewGroupTabs({ views, defaultViewId, currentUserId, onMoveToGroup, groupOrder, onReorderGroups })
 * <ViewTabs {...props} {...groups} />
 * ```
 *
 * "그룹으로 이동"은 `canMoveViewToGroup` 인 뷰에만 선다 — 내 뷰, 관리자에게는 남의 공유 뷰 · 시스템 뷰까지.
 */
export function useViewGroupTabs({
  views,
  defaultViewId,
  currentUserId,
  canManageAny,
  onMoveToGroup,
  groupOrder = NO_ORDER,
  onReorderGroups,
}: UseViewGroupTabsOptions): Required<Pick<ViewTabsProps, 'arrangeTabs' | 'tabMenuExtras'>> &
  Pick<ViewTabsProps, 'onReorderBundles'> {
  const c = viewGroupsCopy(useCollectionLocale())
  const groupNames = viewGroupNames(views)
  const guard = { defaultViewId, currentUserId, canManageAny }

  const tabMenuExtras = (view: SavedView): ViewTabMenuExtra[] => {
    if (!onMoveToGroup || !canMoveViewToGroup(view, guard)) return []
    const current = viewGroupOf(view)
    return [
      {
        key: 'view-group',
        icon: <Tags className="size-3.5" aria-hidden />,
        label: c.moveToGroup,
        value: current ?? c.noGroup,
        panel: ({ back, close }) => (
          <ViewGroupPicker
            current={current}
            groupNames={groupNames}
            onBack={back}
            onPick={(group) => {
              close()
              onMoveToGroup(view.id, group)
            }}
          />
        ),
      },
    ]
  }

  return {
    arrangeTabs: arrangeTabsByGroupOrder(groupOrder),
    tabMenuExtras,
    onReorderBundles: onReorderGroups
      ? (shown) => onReorderGroups(nextGroupOrder(groupOrder, shown))
      : undefined,
  }
}

const NO_ORDER: readonly string[] = []
