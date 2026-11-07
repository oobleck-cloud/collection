'use client'

import { Lock, MoreHorizontal, Tooltip, Users, beginListReorder, cn, reorderArray } from '../kit'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { useCollectionLocale } from '../i18n'
import {
  flatTabArrangement,
  isSharedSavedView,
  reorderWithin,
  resolveTabViews,
} from '@oobleck/collection'

import { ViewTabMenu, type ViewTabMenuExtra } from './view-tab-menu'
import { ViewDrawer } from './ViewDrawer'
import { viewTabsCopy } from './ViewTabs.messages'

import type { ArrangeTabs, SavedView } from '@oobleck/collection'

export type { ViewTabMenuExtra } from './view-tab-menu'

// @oobleck/collection — 뷰 탭 줄(허브스팟식).
//
// 예전에는 뷰 목록이 곧 탭 목록이었다. 지금은 다르다: 뷰는 서랍(ViewDrawer)에 모여 있고,
// 탭에는 **기본 뷰 + 각자 꺼내 둔 것**만 선다. 그래서 이 컴포넌트는 두 목록을 함께 받는다
// (views = 전체, pinnedViewIds = 내가 꺼낸 것). 어느 쪽도 스스로 저장하지 않는다.
//
// 탭 메뉴에서 가장 조심할 자리는 **"탭에서 제거"와 "뷰 삭제"의 구별**이다. 앞은 내 화면에서만
// 치우는 것이고 뷰는 서랍에 남는다. 뒤는 뷰 자체를 없애고, 공유 뷰라면 남의 화면에서도 사라진다.
// 그래서 둘을 구분선으로 가르고, 각각 아이콘·색·한 줄 설명을 달리 준다.
//
// **덧붙이 자리 둘.** `arrangeTabs` 가 여러 뷰를 1단의 묶음 탭 하나로 접으면, 그 묶음의 뷰가 활성일 때만
// 바로 아래 2단에 그 묶음의 뷰가 선다. 묶음 탭을 누르면 그 묶음에서 마지막으로 본 뷰로, 처음이면 첫
// 뷰로 간다. `tabMenuExtras` 는 활성 탭 메뉴에 항목을 더한다. 업무 그룹(`@oobleck/collection-addons/view-groups`)
// 이 둘을 함께 채운다 — 이 컴포넌트는 그룹이 무엇인지 모른다.
//
// 꺼내 둔 탭은 끌어서 순서를 바꾼다(가로 실시간 스왑 — DS listReorder). 기본 뷰는 첫 자리 고정이라
// 끌리지도 않고 자리를 내주지도 않는다. 4px 넘게 움직여야 끌기로 보고, 끈 직후의 클릭은 삼킨다
// (안 그러면 놓는 순간 탭이 전환되거나 메뉴가 열린다).

export type ViewTabsProps = {
  /** 서랍에 보이는 뷰 전체(내 비공개 + 조직 공유). 탭에 다 서지 않는다. */
  views: SavedView[]
  /** 탭에 꺼내 둔 뷰 id(순서 = 탭 순서). 기본 뷰는 여기 없어도 항상 첫 자리에 선다. */
  pinnedViewIds: string[]
  activeId: string
  /** 항상 첫 자리에 고정되는 뷰 id — 제거·삭제 불가(화면이 만들어 두는 뷰라 저장할 자리가 없다). */
  defaultViewId: string
  /** 현재 사용자 — 소유 판정용. 미지정이면 ownerId 없는 뷰만 내 것으로 본다. */
  currentUserId?: string | null
  /** 관리자 — 남의 공유 뷰도 이름 변경·공유 전환(삭제는 아님). */
  canManageAny?: boolean
  onSwitch: (id: string) => void
  /** 서랍에서 꺼내기 / 탭에서 제거(뷰는 남는다). */
  onPin: (id: string) => void
  onUnpin: (id: string) => void
  /** 현재 조건으로 새 뷰 저장 — name 만 받고 id 생성은 상위(영속 일관성). */
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  /** 뷰 자체를 없앤다 — 공유 뷰면 모두의 화면에서 사라진다. 확인·되돌리기는 호스트 몫. */
  onDelete: (id: string) => void
  /** 전체 공유로 전환(비공개 → 공유). */
  onShare: (id: string) => void
  /** 남의 공유 뷰를 복제해 내 뷰로 — 못 고치는 뷰의 유일한 편집 경로. */
  onDuplicate: (id: string) => void
  /** 꺼내 둔 탭의 새 순서(기본 뷰 제외) — 끌어서 놓았을 때. 없으면 끌기가 꺼진다. */
  onReorder?: (pinnedViewIds: string[]) => void
  /** 탭 줄 배치 — 뷰를 묶음 탭으로 접는다. 없으면 차례로 세운다. */
  arrangeTabs?: ArrangeTabs
  /** 활성 탭 메뉴에 더할 항목(뷰마다). 기본 뷰에는 메뉴가 없다. */
  tabMenuExtras?: (view: SavedView) => readonly ViewTabMenuExtra[]
  /** inline=true: 외부 wrapper(border-b/mb-2) 없이 탭 콘텐츠만 렌더(ViewHeader 등과 합성 시). */
  inline?: boolean
}

/** 탭 라벨 공통 클래스 — 편집 input 과 버튼의 footprint 를 같게 유지(행 높이·정렬 불변). */
const TAB_SHELL =
  'inline-flex min-w-0 max-w-[160px] shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap'

/**
 * 단일 탭. 비활성 클릭 = 전환, 활성 클릭 = 메뉴(이중 책임을 한 버튼에 — 기존 규약 유지).
 * 기본 뷰는 자물쇠만 달고 메뉴가 없다 — 이름 변경·제거·삭제가 모두 막힌 뷰라 열어도 빈 메뉴다.
 */
function ViewTab({
  view,
  active,
  defaultViewId,
  currentUserId,
  canManageAny,
  onSwitch,
  onRename,
  onShare,
  onDuplicate,
  onUnpin,
  onDelete,
  menuExtras,
}: {
  view: SavedView
  active: boolean
  defaultViewId: string
  currentUserId?: string | null
  canManageAny?: boolean
  onSwitch: () => void
  onRename: (name: string) => void
  onShare: () => void
  onDuplicate: () => void
  onUnpin: () => void
  onDelete: () => void
  menuExtras?: readonly ViewTabMenuExtra[]
}) {
  const c = viewTabsCopy(useCollectionLocale())
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(view.name)

  const locked = view.id === defaultViewId
  const shared = isSharedSavedView(view)

  if (editing) {
    return (
      <span className={cn(TAB_SHELL, 'bg-primary/10 ring-1 ring-primary/20')}>
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const next = draft.trim()
              if (next && next !== view.name) onRename(next)
              setEditing(false)
            } else if (e.key === 'Escape') {
              setEditing(false)
            }
          }}
          onBlur={() => {
            const next = draft.trim()
            if (next && next !== view.name) onRename(next)
            setEditing(false)
          }}
          className="w-20 min-w-0 bg-transparent text-xs font-medium text-primary outline-none"
        />
      </span>
    )
  }

  const label = (
    <>
      {locked && <Lock className="size-3 shrink-0 opacity-70" aria-hidden />}
      {!locked && shared && <Users className="size-3 shrink-0 opacity-70" aria-hidden />}
      <span className="truncate">{view.name}</span>
    </>
  )

  const tabClassName = cn(
    TAB_SHELL,
    'transition-colors focus:outline-none focus-visible:outline-none',
    active
      ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
      : 'text-fg-muted hover:bg-surface hover:text-fg',
  )

  if (locked) {
    // 자물쇠 탭 — 메뉴 없음. 왜 손댈 수 없는지는 툴팁으로만 설명한다.
    return (
      <Tooltip content={c.defaultViewLocked} side="bottom" delayDuration={400}>
        <button type="button" onClick={onSwitch} className={tabClassName}>
          {label}
        </button>
      </Tooltip>
    )
  }

  return (
    <ViewTabMenu
      view={view}
      defaultViewId={defaultViewId}
      currentUserId={currentUserId}
      canManageAny={canManageAny}
      open={menuOpen}
      onOpenChange={setMenuOpen}
      onRenameStart={() => {
        setDraft(view.name)
        setEditing(true)
      }}
      onShare={onShare}
      onDuplicate={onDuplicate}
      onUnpin={onUnpin}
      onDelete={onDelete}
      extras={menuExtras}
    >
      {({ onClick, 'aria-expanded': ae }) => (
        <button
          type="button"
          onClick={(e) => {
            if (active) onClick(e)
            else onSwitch()
          }}
          aria-expanded={active ? ae : undefined}
          aria-haspopup={active ? 'menu' : undefined}
          className={tabClassName}
        >
          {label}
          {active && <MoreHorizontal className="size-3 shrink-0 opacity-60" aria-hidden />}
        </button>
      )}
    </ViewTabMenu>
  )
}

export function ViewTabs({
  views,
  pinnedViewIds,
  activeId,
  defaultViewId,
  currentUserId,
  canManageAny,
  onSwitch,
  onPin,
  onUnpin,
  onCreate,
  onRename,
  onDelete,
  onShare,
  onDuplicate,
  onReorder,
  arrangeTabs = flatTabArrangement,
  tabMenuExtras,
  inline,
}: ViewTabsProps) {
  const c = viewTabsCopy(useCollectionLocale())
  const tabs = resolveTabViews(views, pinnedViewIds, { defaultViewId })
  const { items, activeBundle, activeBundleViews } = arrangeTabs(tabs, { defaultViewId, activeId })

  // 묶음마다 마지막으로 본 뷰 — 묶음 탭을 다시 눌렀을 때 하던 자리로 돌아간다(이 화면을 연 동안만).
  const lastInBundle = useRef(new Map<string, string>())
  if (activeBundle !== null) lastInBundle.current.set(activeBundle, activeId)

  // 끌기는 **한 줄 안에서만** — 1단의 묶이지 않은 뷰끼리, 2단의 같은 묶음 뷰끼리. 놓으면 그 뷰들이
  // 차지하던 자리 안에서만 순서가 바뀐다(다른 묶음의 자리는 그대로).
  const reorderSubset = onReorder
    ? (ordered: string[]) => onReorder(reorderWithin(pinnedViewIds, ordered))
    : undefined
  const looseDrag = useTabDrag(
    items.flatMap((i) => (i.kind === 'view' && i.view.id !== defaultViewId ? [i.view.id] : [])),
    reorderSubset,
  )
  const bundleDrag = useTabDrag(
    activeBundleViews.map((v) => v.id),
    reorderSubset,
  )

  const renderTab = (v: SavedView, drag: TabDrag | null) => (
    <DraggableTab key={v.id} id={v.id} drag={v.id === defaultViewId ? null : drag}>
      <ViewTab
        view={v}
        active={v.id === activeId}
        defaultViewId={defaultViewId}
        currentUserId={currentUserId}
        canManageAny={canManageAny}
        onSwitch={() => onSwitch(v.id)}
        onRename={(name) => onRename(v.id, name)}
        onShare={() => onShare(v.id)}
        onDuplicate={() => onDuplicate(v.id)}
        onUnpin={() => onUnpin(v.id)}
        onDelete={() => onDelete(v.id)}
        menuExtras={tabMenuExtras?.(v)}
      />
    </DraggableTab>
  )

  const firstRow = (
    <>
      {items.map((item) => {
        if (item.kind === 'view') return renderTab(item.view, looseDrag)
        const remembered = lastInBundle.current.get(item.key)
        const target = item.views.some((v) => v.id === remembered) ? remembered : item.views[0]?.id
        return (
          <BundleTab
            key={`bundle:${item.key}`}
            label={item.label}
            count={item.views.length}
            active={item.key === activeBundle}
            onClick={() => {
              if (item.key !== activeBundle && target) onSwitch(target)
            }}
          />
        )
      })}
      <ViewDrawer
        views={views}
        pinnedViewIds={pinnedViewIds}
        defaultViewId={defaultViewId}
        onPick={(id) => {
          onPin(id)
          onSwitch(id)
        }}
        onPin={onPin}
        onUnpin={onUnpin}
        onCreate={onCreate}
      />
    </>
  )

  // 2단 — 활성 묶음의 뷰. 1단과 같은 탭 모양을 쓰고 바탕만 한 단 가라앉혀 "이 묶음 안"임을 보인다.
  const activeItem = items.find((i) => i.kind === 'bundle' && i.key === activeBundle)
  const activeLabel = activeItem?.kind === 'bundle' ? activeItem.label : activeBundle
  const secondRow =
    activeBundle === null ? null : (
      <div
        role="group"
        aria-label={`${activeLabel} ${c.bundleViewsAria}`}
        className="-mx-1 flex min-w-0 items-center gap-1 border-t border-border bg-surface px-1 py-1"
      >
        {activeBundleViews.map((v) => renderTab(v, bundleDrag))}
      </div>
    )

  if (inline) {
    // overflow 클리핑 금지 — 메뉴·서랍이 잘리지 않아야 한다.
    // 탭이 많아 좁아지면 각 탭이 min-w-0 로 줄며 라벨이 truncate(…)로 잘린다(컨테이너 클립 불필요).
    return (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-1 py-1">{firstRow}</div>
        {secondRow}
      </div>
    )
  }
  return (
    <div className="mb-2 flex flex-col border-b border-border">
      <div className="flex flex-wrap items-center gap-1 py-1">{firstRow}</div>
      {secondRow}
    </div>
  )
}

/**
 * 묶음 탭 — 1단에서 여러 뷰를 대신한다. 메뉴가 없다(묶음을 고치는 일은 각 뷰의 메뉴에서 덧붙이가
 * 한다). 오른쪽 숫자는 꺼내 둔 뷰 수.
 */
function BundleTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        TAB_SHELL,
        'transition-colors focus:outline-none focus-visible:outline-none',
        active
          ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
          : 'text-fg-muted hover:bg-surface hover:text-fg',
      )}
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 tabular-nums opacity-70">{count}</span>
    </button>
  )
}

/** 끌기를 시작했다고 보는 움직임(px) — 그 아래는 클릭이다. */
const DRAG_THRESHOLD = 4

type TabDrag = {
  register: (id: string) => (el: HTMLSpanElement | null) => void
  onPointerDown: (id: string) => (e: ReactPointerEvent) => void
  /** 방금 끌었으면 true 를 돌려주고 플래그를 지운다 — 놓는 순간의 클릭을 삼킨다. */
  consumeClick: () => boolean
}

/** 꺼내 둔 탭(기본 뷰 제외) 가로 끌기 정렬. onReorder 가 없거나 탭이 하나뿐이면 null. */
function useTabDrag(ids: string[], onReorder?: (ids: string[]) => void): TabDrag | null {
  const els = useRef(new Map<string, HTMLSpanElement>())
  const dragged = useRef(false)
  if (!onReorder || ids.length < 2) return null

  return {
    register: (id) => (el) => {
      if (el) els.current.set(id, el)
      else els.current.delete(id)
    },
    onPointerDown: (id) => (e) => {
      if (e.button !== 0) return
      // 이름 고치는 중(input)에는 끌지 않는다 — 글자 선택이 끌기가 되면 안 된다.
      if ((e.target as HTMLElement).closest('input')) return
      const fromIndex = ids.indexOf(id)
      const startX = e.clientX
      const onMove = (ev: PointerEvent) => {
        if (Math.abs(ev.clientX - startX) < DRAG_THRESHOLD) return
        cleanup()
        const items: { dom: HTMLElement }[] = []
        for (const tid of ids) {
          const el = els.current.get(tid)
          if (!el) return
          items.push({ dom: el })
        }
        dragged.current = true
        beginListReorder({
          items,
          fromIndex,
          axis: 'x',
          startX,
          currentX: ev.clientX,
          draggingClass: 'opacity-90',
          onCommit: (from, to) => onReorder(reorderArray(ids, from, to)),
        })
      }
      const cleanup = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', cleanup)
        window.removeEventListener('pointercancel', cleanup)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', cleanup)
      window.addEventListener('pointercancel', cleanup)
    },
    consumeClick: () => {
      const was = dragged.current
      dragged.current = false
      return was
    },
  }
}

/** 탭 하나를 끌 수 있게 감싼다. drag 가 null 이면(기본 뷰·끌기 꺼짐) 그대로 둔다. */
function DraggableTab({
  id,
  drag,
  children,
}: {
  id: string
  drag: TabDrag | null
  children: React.ReactNode
}) {
  if (!drag) return <>{children}</>
  return (
    <span
      ref={drag.register(id)}
      data-view-tab={id}
      className="inline-flex min-w-0 shrink-0 cursor-grab touch-pan-y active:cursor-grabbing"
      onPointerDown={drag.onPointerDown(id)}
      onClickCapture={(e) => {
        if (drag.consumeClick()) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      {children}
    </span>
  )
}
