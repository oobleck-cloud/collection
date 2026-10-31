'use client'

import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { beginListReorder, reorderArray } from '@oobleck/systheme'
import { useCollectionLocale } from '../i18n'
import { inlineTableCopy } from './InlineTable.messages'

// 공용 인라인 테이블 셸 — TipTap 블록(기능·플랜 등 커스텀 블록) 안에서 쓰는 표.
// 일반 테이블(TableView)과 동일한 타이포·디바이더·헤더 언어를 공유하되, "인라인(블록 내장)" 맥락에 맞춤
// (밀도 compact·행 드래그·추가행). 커스텀 블록은 columns(헤더 라벨)+행 셀만 공급하고, 배지·박스·헤더행·
// 디바이더·빈상태·푸터·행 그립/삭제/드래그는 전부 공용 → 블록 간 스타일 차이가 생기지 않는다.
//
// 토큰은 TableView 와 동일한 시맨틱 클래스(text-fg / text-fg-muted / border-border / bg-surface)를 쓴다.
//
// gridClassName 은 반드시 블록 쪽 소스의 "정적 리터럴"이어야 한다 — Tailwind JIT 는 빌드 시 소스를
// 스캔하므로 `grid-cols-[...]` 같은 임의값을 런타임 템플릿으로 만들면 클래스가 생성되지 않는다.

export function InlineTable({
  label,
  count,
  gridClassName,
  columns,
  emptyLabel,
  footer,
  children,
}: {
  label: string
  count: number
  gridClassName: string
  /** 데이터 컬럼 헤더(그립·삭제 칸 제외). 셸이 앞뒤 빈 칸을 채운다. */
  columns: ReactNode[]
  emptyLabel: string
  footer: ReactNode
  children: ReactNode
}) {
  const c = inlineTableCopy(useCollectionLocale())
  return (
    <>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
          {label}
        </span>
        <span className="text-xs text-fg-muted">{c.count(count)}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div
          className={`${gridClassName} border-b border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-fg-muted`}
        >
          <span />
          {columns.map((c, i) => (
            <span key={i}>{c}</span>
          ))}
          <span />
        </div>
        {count === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-fg-muted">{emptyLabel}</div>
        ) : (
          children
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1">{footer}</div>
    </>
  )
}

export function InlineTableRow({
  gridClassName,
  rowRef,
  onGripDown,
  onRemove,
  removeLabel,
  children,
}: {
  gridClassName: string
  rowRef?: (el: HTMLDivElement | null) => void
  onGripDown: (e: ReactPointerEvent) => void
  onRemove: () => void
  removeLabel: string
  children: ReactNode
}) {
  const c = inlineTableCopy(useCollectionLocale())
  return (
    <div
      ref={rowRef}
      className={`group/row ${gridClassName} border-b border-border px-2 py-0.5 transition-colors last:border-b-0`}
    >
      <span
        role="button"
        aria-label={c.rowMove}
        onPointerDown={onGripDown}
        className="flex h-6 w-5 cursor-grab touch-none items-center justify-center rounded text-fg-muted opacity-0 transition-opacity hover:bg-surface hover:text-fg group-hover/row:opacity-100 active:cursor-grabbing"
      >
        ⠿
      </span>
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="flex size-6 items-center justify-center justify-self-center rounded text-fg-muted opacity-0 transition-opacity hover:bg-surface hover:text-fg group-hover/row:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

/**
 * 행 포인터 드래그 정렬(공용) — 네이티브 DnD 는 ProseMirror 와 충돌하므로 그립(⠿)에서 pointer 로 직접 처리.
 * 반환: drag 상태, startDrag(i), rowRef(i). 항목 배열·setter 를 받아 재정렬한다.
 */
export function useInlineRowDrag<T>(items: T[], setItems: (next: T[]) => void) {
  const rowEls = useRef<(HTMLDivElement | null)[]>([])

  const startDrag = (i: number) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // 표시 순서대로의 행 DOM 을 공용 엔진에 넘긴다(인덱스 = items 인덱스). 누락 행이 있으면 중단.
    const list: { dom: HTMLElement }[] = []
    for (let idx = 0; idx < items.length; idx++) {
      const el = rowEls.current[idx]
      if (!el) return
      list.push({ dom: el })
    }
    beginListReorder({
      items: list,
      fromIndex: i,
      startY: e.clientY,
      currentY: e.clientY,
      onCommit: (from, to) => setItems(reorderArray(items, from, to)),
    })
  }

  const rowRef = (i: number) => (el: HTMLDivElement | null) => {
    rowEls.current[i] = el
  }

  return { startDrag, rowRef }
}
