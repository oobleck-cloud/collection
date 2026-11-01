'use client'

import { useState } from 'react'
import { Button, Check, EyeOff, Input, Lock, Plus, Popover, Search, Users, cn } from '../kit'
import type { SavedView } from '@oobleck/collection'
import { isViewPinned, sectionSavedViews } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { viewDrawerCopy } from './ViewDrawer.messages'

// @oobleck/collection — 뷰 서랍(허브스팟식).
//
// 뷰를 만들면 곧 탭이 되던 구조에서는 뷰가 늘수록 탭 줄이 무너졌다. 그래서 **뷰는 서랍에
// 모아 두고 탭에는 각자 꺼내 둔 것만** 세운다. 이 컴포넌트는 그 서랍이다 — 검색해서 찾고,
// 꺼내고(추가), 다시 넣는다(꺼냄 ✓ 를 다시 누름).
//
// 상태를 스스로 갖지 않는다(열림·검색어만 지역 상태). 목록·꺼내기 목록·저장은 모두 상위 소유.

export type ViewDrawerProps = {
  /** 서랍에 보이는 뷰 전체(내 비공개 + 조직 공유). */
  views: SavedView[]
  /** 탭에 꺼내 둔 뷰 id(순서 = 탭 순서). 기본 뷰는 여기 없다(항상 첫 자리). */
  pinnedViewIds: string[]
  /** 항상 첫 자리에 고정되는 뷰 id — 꺼내기/넣기 대상이 아니다. */
  defaultViewId: string
  /** 행을 눌렀을 때 — 꺼내고 그 뷰로 전환한다(서랍은 닫힌다). */
  onPick: (id: string) => void
  /** 꺼내기 토글 — 오른쪽 `추가`/`꺼냄 ✓` 버튼. 서랍은 열린 채로 둔다(여러 개를 연달아 꺼내려고). */
  onPin: (id: string) => void
  onUnpin: (id: string) => void
  /** 지금 화면에 걸린 조건 그대로 새 뷰를 만든다. */
  onCreate: (name: string) => void
}

/** 섹션 머리 — 아이콘 + 라벨 + 개수. 개수는 검색 결과 기준(지금 보이는 것과 숫자가 어긋나지 않게). */
function SectionHeader({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode
  label: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[11px] font-medium text-fg-muted">
      <span className="inline-flex shrink-0">{icon}</span>
      <span>{label}</span>
      {count !== undefined && <span className="tabular-nums opacity-70">· {count}</span>}
    </div>
  )
}

/**
 * 서랍의 한 줄 — 왼쪽(이름·만든 사람)은 "이걸로 보기", 오른쪽 버튼은 "꺼내기/넣기".
 * 두 동작을 한 버튼에 겹치면 목록에서 여러 개를 꺼내는 흐름과 하나를 열어 보는 흐름이 충돌한다.
 */
function ViewRow({
  view,
  pinned,
  locked,
  lockedLabel,
  pinLabel,
  pinnedLabel,
  onPick,
  onTogglePin,
}: {
  view: SavedView
  pinned: boolean
  /** 기본 뷰 — 넣을 수 없으므로 토글 대신 "항상 표시" 배지를 둔다. */
  locked?: boolean
  lockedLabel: string
  pinLabel: string
  pinnedLabel: string
  onPick: () => void
  onTogglePin: () => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-md pr-1 hover:bg-surface">
      <button
        type="button"
        onClick={onPick}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg"
      >
        <span className="truncate">{view.name}</span>
        {view.ownerName && (
          <span className="shrink-0 truncate text-[11px] text-fg-muted">{view.ownerName}</span>
        )}
      </button>
      {locked ? (
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-fg-muted">
          {lockedLabel}
        </span>
      ) : (
        <button
          type="button"
          onClick={onTogglePin}
          aria-pressed={pinned}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors',
            pinned
              ? 'text-primary hover:bg-primary/10'
              : 'text-fg-muted hover:bg-background hover:text-fg',
          )}
        >
          {pinned && <Check className="size-3" aria-hidden />}
          {pinned ? pinnedLabel : pinLabel}
        </button>
      )}
    </div>
  )
}

/** 하단 "현재 조건으로 새 뷰 저장" — 누르면 같은 자리에서 이름 입력으로 펼쳐진다(팝오버 중첩 회피). */
function CreateViewFooter({ onCreate }: { onCreate: (name: string) => void }) {
  const c = viewDrawerCopy(useCollectionLocale())
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const submit = () => {
    const next = name.trim()
    if (!next) return
    onCreate(next)
    setName('')
    setNaming(false)
  }

  if (!naming) {
    return (
      <button
        type="button"
        onClick={() => setNaming(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] text-fg-muted transition-colors hover:bg-surface hover:text-fg"
      >
        <Plus className="size-3.5 shrink-0" aria-hidden />
        {c.saveCurrent}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="text-xs font-medium text-fg-muted">{c.newViewName}</div>
      <Input
        autoFocus
        size="sm"
        value={name}
        onValueChange={setName}
        placeholder={c.viewNamePlaceholder}
        onEnterKey={submit}
        onEscapeKey={() => setNaming(false)}
      />
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => setNaming(false)}>
          {c.cancel}
        </Button>
        <Button variant="primary" size="sm" onClick={submit} disabled={!name.trim()}>
          {c.save}
        </Button>
      </div>
    </div>
  )
}

/**
 * 뷰 서랍 — `+ 뷰` 버튼을 누르면 열리는 popover.
 * 검색 · 섹션(기본 / 내 뷰 / 공유 뷰) · 꺼내기 토글 · 현재 조건으로 새 뷰 저장.
 */
export function ViewDrawer({
  views,
  pinnedViewIds,
  defaultViewId,
  onPick,
  onPin,
  onUnpin,
  onCreate,
}: ViewDrawerProps) {
  const c = viewDrawerCopy(useCollectionLocale())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const sections = sectionSavedViews(views, { defaultViewId, query })
  const empty =
    !sections.defaultView && sections.privateViews.length === 0 && sections.sharedViews.length === 0

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    // 닫을 때 검색어를 비운다 — 다시 열었을 때 지난 검색어가 목록을 절반만 보여주면
    // "뷰가 사라졌다"로 읽힌다.
    if (!next) setQuery('')
  }

  const rowProps = (view: SavedView) => ({
    view,
    pinned: isViewPinned(pinnedViewIds, view.id, { defaultViewId }),
    lockedLabel: c.alwaysVisible,
    pinLabel: c.pin,
    pinnedLabel: c.pinned,
    onPick: () => {
      onPick(view.id)
      handleOpenChange(false)
    },
    onTogglePin: () => {
      if (isViewPinned(pinnedViewIds, view.id, { defaultViewId })) onUnpin(view.id)
      else onPin(view.id)
    },
  })

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      side="bottom"
      align="start"
      contentClassName="w-72 p-0"
      trigger={({ onClick, 'aria-expanded': ae }) => (
        <button
          type="button"
          onClick={onClick}
          aria-expanded={ae}
          aria-label={c.drawerAria}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg"
        >
          <Plus className="size-3.5" aria-hidden />
          {c.openDrawer}
        </button>
      )}
    >
      <div className="flex flex-col">
        <div className="relative border-b border-border p-2">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-fg-muted"
            aria-hidden
          />
          <Input
            autoFocus
            size="sm"
            value={query}
            onValueChange={setQuery}
            placeholder={c.searchPlaceholder}
            aria-label={c.searchPlaceholder}
            className="h-8 w-full pl-7 text-[13px]"
            onEscapeKey={() => handleOpenChange(false)}
          />
        </div>

        <div className="max-h-72 overflow-y-auto p-1">
          {sections.defaultView && (
            <>
              <SectionHeader
                icon={<Lock className="size-3" aria-hidden />}
                label={c.sectionDefault}
              />
              <ViewRow {...rowProps(sections.defaultView)} locked />
            </>
          )}

          {sections.privateViews.length > 0 && (
            <>
              <SectionHeader
                icon={<EyeOff className="size-3" aria-hidden />}
                label={c.sectionPrivate}
                count={sections.privateViews.length}
              />
              {sections.privateViews.map((v) => (
                <ViewRow key={v.id} {...rowProps(v)} />
              ))}
            </>
          )}

          {sections.sharedViews.length > 0 && (
            <>
              <SectionHeader
                icon={<Users className="size-3" aria-hidden />}
                label={c.sectionShared}
                count={sections.sharedViews.length}
              />
              {sections.sharedViews.map((v) => (
                <ViewRow key={v.id} {...rowProps(v)} />
              ))}
            </>
          )}

          {empty && <p className="px-2 py-6 text-center text-xs text-fg-muted">{c.empty}</p>}
        </div>

        <div className="border-t border-border p-1">
          <CreateViewFooter
            onCreate={(name) => {
              onCreate(name)
              handleOpenChange(false)
            }}
          />
        </div>
      </div>
    </Popover>
  )
}
