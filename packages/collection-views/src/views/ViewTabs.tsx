'use client'

import { Lock, MoreHorizontal, Tooltip, Users, beginListReorder, cn, reorderArray } from '../kit'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

import { useCollectionLocale } from '../i18n'
import { isSharedSavedView, resolveTabViews } from '@oobleck/collection'

import { ViewTabMenu } from './view-tab-menu'
import { ViewDrawer } from './ViewDrawer'
import { viewTabsCopy } from './ViewTabs.messages'

import type { SavedView } from '@oobleck/collection'

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
  inline,
}: ViewTabsProps) {
  const tabs = resolveTabViews(views, pinnedViewIds, { defaultViewId })
  const drag = useTabDrag(
    tabs.filter((v) => v.id !== defaultViewId).map((v) => v.id),
    onReorder,
  )
  const tabItems = (
    <>
      {tabs.map((v) => (
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
          />
        </DraggableTab>
      ))}
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
  if (inline) {
    // overflow 클리핑 금지 — 메뉴·서랍이 잘리지 않아야 한다.
    // 탭이 많아 좁아지면 각 탭이 min-w-0 로 줄며 라벨이 truncate(…)로 잘린다(컨테이너 클립 불필요).
    return <div className="flex min-w-0 flex-1 items-center gap-1 py-1">{tabItems}</div>
  }
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-border py-1">
      {tabItems}
    </div>
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
