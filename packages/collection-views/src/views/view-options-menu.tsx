'use client'

// @oobleck/collection — ⋯ 뷰 옵션 허브 슬롯 API.
//
// W1 이후 패널(프로퍼티 show/hide · 레이아웃 옵션 · 그룹 옵션)을 *코드 추가 없이* 꽂도록
// 최소 인터페이스를 노출한다. 과설계 금지 — 슬롯 배열 + 구분선 플래그만.
//
// 사용 예 (W2):
//   const propertiesSlot: ViewOptionsSlot = {
//     id: 'properties',
//     label: '프로퍼티',
//     icon: Settings,
//     panel: <PropertiesPanel ... />,
//   }
//   <ViewOptionsMenu slots={[propertiesSlot]} ... />

import { useState, type ElementType, type ReactNode } from 'react'
import { SlidersHorizontal, Popover, Tooltip, cn } from '@oobleck/systheme'
import { useCollectionLocale } from '../i18n'
import { viewOptionsMenuCopy } from './view-options-menu.messages'

/** 허브 메뉴의 단일 슬롯 정의 — W2 가 이 배열에 추가해 코드 없이 꽂는다. */
export type ViewOptionsSlot = {
  /** 안정 식별자 — 배열 내 중복 금지. */
  id: string
  /** 메뉴 행 라벨(한국어). */
  label: string
  /** 메뉴 행 아이콘 — @oobleck/systheme 아이콘 또는 인라인 SVG 컴포넌트({ className }). */
  icon: ElementType
  /**
   * 클릭 시 열리는 서브패널 콘텐츠(ReactNode).
   * 제공 안 하면 onClick 콜백으로만 동작(단순 액션 — 복제·삭제 등).
   */
  panel?: ReactNode
  /** panel 대신 단순 클릭 액션을 처리할 때(panel 없는 슬롯). */
  onClick?: () => void
  /** 슬롯 위에 구분선을 그린다. */
  dividerBefore?: boolean
  /** 슬롯 비활성 여부(회색 + 클릭 불가). */
  disabled?: boolean
  /** 위험 동작 시각화(빨간색). */
  danger?: boolean
}

type ViewOptionsMenuProps = {
  /** W2 가 주입할 슬롯 목록. 빈 배열이면 "이 뷰의 옵션이 없습니다" 안내. */
  slots?: ViewOptionsSlot[]
  /** 추가 className (트리거 버튼 래퍼). */
  className?: string
}

/**
 * ⋯ 뷰 옵션 허브 메뉴 — 모든 뷰 설정의 단일 진입점(노션 §3).
 * slots 배열을 받아 메뉴 행을 렌더하고, panel 이 있는 항목은 서브패널을 인라인으로 연다.
 * W2 가 slots 를 추가하면 이 컴포넌트 자체는 수정할 필요 없다(슬롯 패턴).
 */
export function ViewOptionsMenu({ slots = [], className }: ViewOptionsMenuProps) {
  const c = viewOptionsMenuCopy(useCollectionLocale())
  const [open, setOpen] = useState(false)
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null)

  const activeSlot = activeSlotId ? slots.find((s) => s.id === activeSlotId) : null

  const handleSlotClick = (slot: ViewOptionsSlot) => {
    if (slot.disabled) return
    if (slot.panel) {
      setActiveSlotId((prev) => (prev === slot.id ? null : slot.id))
    } else {
      slot.onClick?.()
      setOpen(false)
      setActiveSlotId(null)
    }
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setActiveSlotId(null)
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      side="bottom"
      align="end"
      contentClassName="w-56 p-1"
      trigger={({ onClick, 'aria-expanded': ae }) => (
        <Tooltip content={c.settings} side="bottom" delayDuration={400}>
          <button
            type="button"
            onClick={onClick}
            aria-expanded={ae}
            aria-label={c.viewOptions}
            className={cn(
              'inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface hover:text-fg',
              ae && 'bg-surface text-fg',
              className,
            )}
          >
            <SlidersHorizontal className="size-5" />
          </button>
        </Tooltip>
      )}
    >
      {/* 메뉴 행 목록 */}
      {slots.length === 0 && (
        <div className="px-2 py-3 text-center text-xs text-fg-muted">{c.noOptions}</div>
      )}
      {slots.map((slot) => {
        const Icon = slot.icon
        const isActive = activeSlotId === slot.id
        return (
          <div key={slot.id}>
            {slot.dividerBefore && <div className="my-1 border-t border-border" />}
            <button
              type="button"
              disabled={slot.disabled}
              onClick={() => handleSlotClick(slot)}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
                slot.disabled
                  ? 'cursor-not-allowed text-fg-muted opacity-50'
                  : slot.danger
                    ? 'text-error hover:bg-error/10'
                    : isActive
                      ? 'bg-surface text-fg'
                      : 'text-fg hover:bg-surface',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{slot.label}</span>
              {slot.panel && (
                <span
                  className={cn(
                    'ml-auto text-xs transition-transform',
                    isActive ? 'rotate-180' : '',
                  )}
                >
                  ›
                </span>
              )}
            </button>

            {/* 서브패널 — 같은 popover 안에서 인라인 펼침(메뉴 → 패널 2단 깊이). */}
            {isActive && activeSlot?.panel && (
              <div className="border-t border-border px-2 py-2">{activeSlot.panel}</div>
            )}
          </div>
        )
      })}
    </Popover>
  )
}
