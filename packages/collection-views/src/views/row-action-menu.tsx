'use client'

import { useState } from 'react'
import { AnchorContextSurface, MoreHorizontal, Trash2, cn } from '../kit'
import { useCollectionLocale } from '../i18n'
import { rowActionMenuCopy } from './row-action-menu.messages'

// @oobleck/collection — 행/카드 hover 액션 메뉴(케밥 ⋯ → "삭제"→휴지통). 표·리스트·갤러리·보드 뷰가
// 공유하는 단일 어포던스(노션: 모든 뷰에서 항목 삭제). onDelete 는 순수 콜백 — 실제 fetch·확인·토스트·복원은
// 호스트(useWorkspaceRecords)가 소유한다. 부모 카드/행 클릭(열기) 전파를 막는다(stopPropagation +
// data-table-row-stop). 부모가 group/* 로 hover 를 관리하면 triggerClassName 으로 hover 노출 규약을 주입한다.

export function RowActionMenu({
  onDelete,
  triggerClassName,
}: {
  onDelete: () => void
  /** 케밥 트리거의 hover 노출 클래스 — 부모의 group/* 이름에 맞춘 group-hover 규약(예: 'group-hover/row:opacity-100'). */
  triggerClassName?: string
}) {
  const c = rowActionMenuCopy(useCollectionLocale())
  const [open, setOpen] = useState(false)
  return (
    // 행 열기 차단막 — 안의 케밥/메뉴에서 올라온 이벤트가 TableRow 의 행 활성화로 새지 않게 한다.
    // 스스로는 인터랙티브가 아니다(role="presentation") — 클릭·키를 *삼키기만* 한다.
    // 키보드도 함께 막는 이유: DS TableRow 는 Enter/Space 로도 행을 여는데, 메뉴 안에서 Enter 를
    // 누르면 메뉴 항목 실행 + 행 열기가 같이 일어난다.
    <span
      data-table-row-stop
      role="presentation"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <AnchorContextSurface
        layout="inline"
        open={open}
        onOpenChange={setOpen}
        panelRole="menu"
        panelPlacement="below"
        panelAriaLabel={c.rowMenuAria}
        panelClassName="w-44 py-1"
        surface={
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={c.rowMenuAria}
            onClick={(e) => {
              e.stopPropagation()
              setOpen((o) => !o)
            }}
            className={cn(
              'inline-flex shrink-0 items-center rounded-md border border-border bg-background p-1 text-fg-muted shadow-sm transition-opacity hover:text-fg focus-visible:opacity-100',
              open ? 'opacity-100' : 'opacity-0',
              triggerClassName,
            )}
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
          </button>
        }
        panel={
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-error transition-colors hover:bg-error/10"
          >
            <Trash2 className="size-3.5 shrink-0" aria-hidden />
            {c.deleteRow}
          </button>
        }
      />
    </span>
  )
}
