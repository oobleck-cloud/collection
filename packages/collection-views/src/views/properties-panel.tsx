'use client'

// @oobleck/collection — 프로퍼티 show/hide/순서 패널 (노션식).
//
// 노션 §3 ⚙ 프로퍼티 패널:
//   - 표시 중: 토글 켜진 프로퍼티 목록 (드래그로 순서 변경)
//   - 숨김: 토글 꺼진 프로퍼티 목록 (토글하면 표시로 이동)
//   - 각 행에 타입 아이콘 표시 (노션 동일)
//   - "모두 표시" / "모두 숨기기" 숏컷
//
// 사용: buildPropertiesSlot(view, schema, onViewChange) → ViewOptionsSlot

import { useRef, useState } from 'react'
import {
  ArrowLeftRight,
  CalendarDays,
  Hash,
  Link2,
  List,
  Mail,
  Map as MapIcon,
  Phone,
  Settings,
  SquareCheck,
  Tags,
  Type,
  X,
  cn,
  beginListReorder,
  type LucideIcon,
} from '@oobleck/systheme'
import type { ViewOptionsSlot } from './view-options-menu'
import type { PropertyDef, PropertyType, ViewConfig } from '@oobleck/collection'
import { DEFAULT_COLLECTION_LOCALE, useCollectionLocale, type CollectionLocale } from '../i18n'
import { propertiesPanelCopy } from './properties-panel.messages'

// ─── 타입 아이콘 맵 ──────────────────────────────────────────────────────────────

const TYPE_ICON: Partial<Record<PropertyType, LucideIcon>> = {
  text: Type,
  number: Hash,
  select: List,
  multi_select: Tags,
  date: CalendarDays,
  checkbox: SquareCheck,
  relation: ArrowLeftRight,
  url: Link2,
  email: Mail,
  phone: Phone,
  geo: MapIcon,
}

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────

function resolveDisplayOrder(
  schema: PropertyDef[],
  visibleProps: string[] | undefined,
): { visible: PropertyDef[]; hidden: PropertyDef[] } {
  const allKeys = schema.map((d) => d.key)
  if (!visibleProps) {
    return { visible: schema.slice(), hidden: [] }
  }
  const visibleSet = new Set(visibleProps)
  const visible = visibleProps.flatMap((k) => {
    const def = schema.find((d) => d.key === k)
    return def ? [def] : []
  })
  const hidden = schema.filter((d) => !visibleSet.has(d.key))
  return { visible, hidden: hidden.filter((d) => allKeys.includes(d.key)) }
}

// ─── PropertiesPanel ─────────────────────────────────────────────────────────

type PropertiesPanelProps = {
  schema: PropertyDef[]
  view: ViewConfig
  onViewChange: (next: Partial<ViewConfig>) => void
}

export function PropertiesPanel({ schema, view, onViewChange }: PropertiesPanelProps) {
  const c = propertiesPanelCopy(useCollectionLocale())
  const { visible, hidden } = resolveDisplayOrder(schema, view.visibleProps)
  const itemRefsRef = useRef<Map<string, HTMLElement>>(new Map())
  const [dragging, setDragging] = useState<string | null>(null)

  const setRef = (key: string) => (el: HTMLElement | null) => {
    if (el) itemRefsRef.current.set(key, el)
    else itemRefsRef.current.delete(key)
  }

  const toggleProp = (key: string) => {
    const currentVisible = visible.map((d) => d.key)
    const isVisible = currentVisible.includes(key)
    const nextVisible = isVisible
      ? currentVisible.filter((k) => k !== key)
      : [...currentVisible, key]
    onViewChange({ visibleProps: nextVisible })
  }

  const showAll = () => {
    onViewChange({ visibleProps: schema.map((d) => d.key) })
  }

  const hideAll = () => {
    // 최소 1개는 남겨야 한다(노션 동일).
    if (visible.length <= 1) return
    onViewChange({ visibleProps: [visible[0].key] })
  }

  const handleDragCommit = (from: number, to: number) => {
    const keys = visible.map((d) => d.key)
    const copy = keys.slice()
    const [moved] = copy.splice(from, 1)
    copy.splice(Math.max(0, Math.min(to, copy.length)), 0, moved)
    onViewChange({ visibleProps: copy })
  }

  const handleDragStart = (fromIndex: number, startY: number) => {
    const keys = visible.map((d) => d.key)
    const items = keys.flatMap((key) => {
      const dom = itemRefsRef.current.get(key)
      return dom ? [{ dom }] : []
    })
    if (items.length < 2) return
    setDragging(keys[fromIndex])
    beginListReorder({
      items,
      fromIndex,
      startY,
      draggingClass: 'opacity-50',
      onCommit: (from, to) => {
        setDragging(null)
        handleDragCommit(from, to)
      },
    })
    const cleanup = () => {
      setDragging(null)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
    }
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 표시 중 섹션 */}
      <div>
        {/* 섹션 헤더 + 전체 숨기기 */}
        <div className="mb-0.5 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
            {c.showing}
          </span>
          {visible.length > 1 && (
            <button
              type="button"
              onClick={hideAll}
              className="text-[10px] text-fg-muted transition-colors hover:text-fg"
            >
              {c.hideAll}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-0.5">
          {visible.length === 0 && (
            <div className="py-1 text-xs text-fg-muted">{c.noVisibleProps}</div>
          )}
          {visible.map((def, idx) => {
            const Icon = TYPE_ICON[def.type] ?? Type
            return (
              <div
                key={def.key}
                ref={setRef(def.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded px-1 py-1 text-xs',
                  dragging === def.key ? 'opacity-50' : 'hover:bg-surface',
                )}
              >
                {/* 드래그 핸들 */}
                <button
                  type="button"
                  aria-label={c.reorderAria(def.label)}
                  className="cursor-grab touch-none text-fg-muted/60 active:cursor-grabbing"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    handleDragStart(idx, e.clientY)
                  }}
                >
                  <svg
                    width="10"
                    height="14"
                    viewBox="0 0 10 14"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <circle cx="3" cy="2" r="1.5" />
                    <circle cx="7" cy="2" r="1.5" />
                    <circle cx="3" cy="7" r="1.5" />
                    <circle cx="7" cy="7" r="1.5" />
                    <circle cx="3" cy="12" r="1.5" />
                    <circle cx="7" cy="12" r="1.5" />
                  </svg>
                </button>

                {/* 타입 아이콘 */}
                <Icon className="size-3.5 shrink-0 text-fg-muted" aria-hidden />

                {/* 라벨 */}
                <span className="min-w-0 flex-1 truncate text-fg">{def.label}</span>

                {/* 숨기기 버튼 */}
                <button
                  type="button"
                  aria-label={c.hideAria(def.label)}
                  onClick={() => toggleProp(def.key)}
                  className="inline-flex size-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-border hover:text-fg"
                >
                  {/* 눈 열림 아이콘 */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* 숨김 섹션 */}
      {hidden.length > 0 && (
        <div>
          {/* 섹션 헤더 + 전체 표시 */}
          <div className="mb-0.5 flex items-center justify-between px-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
              {c.hidden}
            </span>
            <button
              type="button"
              onClick={showAll}
              className="text-[10px] text-fg-muted transition-colors hover:text-fg"
            >
              {c.showAll}
            </button>
          </div>

          <div className="flex flex-col gap-0.5">
            {hidden.map((def) => {
              const Icon = TYPE_ICON[def.type] ?? Type
              return (
                <div
                  key={def.key}
                  className="flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-surface"
                >
                  {/* 핸들 플레이스홀더 */}
                  <span className="w-[10px] shrink-0" />

                  {/* 타입 아이콘 (흐리게) */}
                  <Icon className="size-3.5 shrink-0 text-fg-muted/50" aria-hidden />

                  {/* 라벨 */}
                  <span className="min-w-0 flex-1 truncate text-fg-muted">{def.label}</span>

                  {/* 표시 버튼 */}
                  <button
                    type="button"
                    aria-label={c.showAria(def.label)}
                    onClick={() => toggleProp(def.key)}
                    className="inline-flex size-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-border hover:text-fg"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 완전히 모두 표시됐을 때 안내 */}
      {hidden.length === 0 && visible.length > 0 && (
        <div className="px-1 text-[10px] text-fg-muted">{c.allShown}</div>
      )}
    </div>
  )
}

// ─── buildPropertiesSlot ──────────────────────────────────────────────────────

export function buildPropertiesSlot(
  view: ViewConfig,
  schema: PropertyDef[],
  onViewChange: (next: Partial<ViewConfig>) => void,
  locale: CollectionLocale = DEFAULT_COLLECTION_LOCALE,
): ViewOptionsSlot {
  return {
    id: 'properties',
    label: propertiesPanelCopy(locale).slotLabel,
    icon: Settings,
    // searchOnly 는 컬럼이 아니다 — 표시/숨김 토글 목록에 세우면 켤 수 있는 것처럼 보인다.
    panel: (
      <PropertiesPanel
        schema={schema.filter((d) => !d.searchOnly)}
        view={view}
        onViewChange={onViewChange}
      />
    ),
  }
}
