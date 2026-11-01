'use client'

import { Copy, EyeOff, Pencil, Popover, Trash2, Users, cn } from '../kit'

import { useCollectionLocale } from '../i18n'
import {
  canDeleteSavedView,
  canDuplicateSavedView,
  canEditSavedView,
  canRemoveViewFromTabs,
  isSharedSavedView,
} from '@oobleck/collection'

import { viewTabsCopy } from './ViewTabs.messages'

import type { SavedView } from '@oobleck/collection'

// @oobleck/collection — 활성 뷰 탭의 메뉴(ViewTabs 전용, 배럴 비노출).
//
// 이 메뉴의 존재 이유 절반은 **"탭에서 제거"와 "뷰 삭제"를 갈라 놓는 것**이다. 둘은 결과가
// 전혀 다른데 이름은 비슷하다. 그래서 구분선으로 나누고, 아이콘(가림 ↔ 휴지통)·색(기본 ↔ 위험)·
// 한 줄 설명을 각각 달리 준다. 공유 뷰의 삭제는 라벨에 "모두에게서"까지 적는다.
//
// DS 의 Menu 는 항목에 위험색·구분선·설명줄을 줄 수 없어(라벨 문자열 한 줄뿐) 여기서는
// Popover + 직접 만든 행을 쓴다 — 같은 패키지의 view-options-menu·row-action-menu 와 같은 방식.

/** 메뉴 한 줄 — 라벨 + (있으면) 결과를 적은 설명. danger 는 되돌릴 수 없는 것에만. */
function MenuRow({
  icon,
  label,
  caption,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  caption?: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
        danger ? 'text-error hover:bg-error/10' : 'text-fg hover:bg-surface',
      )}
    >
      <span className="mt-0.5 inline-flex shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px]">{label}</span>
        {caption && (
          <span className={cn('block text-[11px]', danger ? 'opacity-80' : 'text-fg-muted')}>
            {caption}
          </span>
        )}
      </span>
    </button>
  )
}

export type ViewTabMenuProps = {
  view: SavedView
  defaultViewId: string
  currentUserId?: string | null
  /** 관리자 — 남의 공유 뷰도 이름 변경·공유 전환(삭제는 아님). */
  canManageAny?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 인라인 이름 편집 모드로 들어간다(이름 변경은 탭 자리에서 한다). */
  onRenameStart: () => void
  onShare: () => void
  onDuplicate: () => void
  onUnpin: () => void
  onDelete: () => void
  /** 트리거 — 탭 버튼 자체가 트리거다. */
  children: (props: {
    onClick: (e: React.MouseEvent) => void
    'aria-expanded': boolean
  }) => React.ReactNode
}

/**
 * 탭 메뉴 — 소유 여부로 항목이 갈린다.
 *  - 내 뷰: 이름 변경 · (비공개면) 전체 공유로 전환 · 탭에서 제거 · 뷰 삭제
 *  - 남의 공유 뷰: 복제해서 내 뷰로 · 탭에서 제거 (이름 변경·삭제 없음 — 남의 것은 복제해서 고친다)
 */
export function ViewTabMenu({
  view,
  defaultViewId,
  currentUserId,
  canManageAny,
  open,
  onOpenChange,
  onRenameStart,
  onShare,
  onDuplicate,
  onUnpin,
  onDelete,
  children,
}: ViewTabMenuProps) {
  const c = viewTabsCopy(useCollectionLocale())
  const guard = { defaultViewId, currentUserId, canManageAny }
  const shared = isSharedSavedView(view)
  const editable = canEditSavedView(view, guard)
  const removable = canRemoveViewFromTabs(view.id, guard)
  const deletable = canDeleteSavedView(view, guard)
  const duplicable = canDuplicateSavedView(view, guard)
  const deleteLabel = shared ? c.deleteSharedView : c.deleteView
  const deleteCaption = shared ? c.deleteSharedViewCaption : c.deleteViewCaption

  const run = (fn: () => void) => () => {
    onOpenChange(false)
    fn()
  }

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      side="bottom"
      align="start"
      contentClassName="w-64 p-1"
      trigger={({ onClick, 'aria-expanded': ae }) =>
        children({ onClick: () => onClick(), 'aria-expanded': ae })
      }
    >
      <div role="menu" aria-label={c.viewMenuAria} className="flex flex-col">
        {editable && (
          <MenuRow
            icon={<Pencil className="size-3.5" aria-hidden />}
            label={c.rename}
            onClick={run(onRenameStart)}
          />
        )}
        {editable && !shared && (
          <MenuRow
            icon={<Users className="size-3.5" aria-hidden />}
            label={c.share}
            onClick={run(onShare)}
          />
        )}
        {duplicable && (
          <MenuRow
            icon={<Copy className="size-3.5" aria-hidden />}
            label={c.duplicateToMine}
            onClick={run(onDuplicate)}
          />
        )}

        {/* 구분선 — 위는 "뷰를 손보는 것", 아래는 "치우거나 없애는 것". */}
        {(removable || deletable) && <div className="my-1 h-px bg-border" />}

        {removable && (
          <MenuRow
            icon={<EyeOff className="size-3.5" aria-hidden />}
            label={c.removeFromTabs}
            caption={c.removeFromTabsCaption}
            onClick={run(onUnpin)}
          />
        )}
        {deletable && (
          <MenuRow
            icon={<Trash2 className="size-3.5" aria-hidden />}
            label={deleteLabel}
            caption={deleteCaption}
            danger
            onClick={run(onDelete)}
          />
        )}
      </div>
    </Popover>
  )
}
