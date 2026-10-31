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
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Hash,
  Link2,
  List,
  Mail,
  Map as MapIcon,
  Phone,
  Search,
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
import {
  bucketByGroup,
  groupPath,
  hasAnyGroup,
  matchesQuery,
  reorderWithinGroup,
  type PropertyBucket,
} from './properties-panel-groups'

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

const EYE_ICON = (
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
)

const GRIP_ICON = (
  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
    <circle cx="3" cy="2" r="1.5" />
    <circle cx="7" cy="2" r="1.5" />
    <circle cx="3" cy="7" r="1.5" />
    <circle cx="7" cy="7" r="1.5" />
    <circle cx="3" cy="12" r="1.5" />
    <circle cx="7" cy="12" r="1.5" />
  </svg>
)

// 속성이 수십 개라 패널이 화면을 넘는다 — 검색창은 shrink-0 로 고정하고 목록만 스크롤한다.
const PANEL_SHELL = 'flex max-h-[min(70vh,560px)] flex-col gap-2'
const SCROLL_AREA = 'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5'
const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-widest text-fg-muted'
const ICON_BTN =
  'inline-flex size-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-border hover:text-fg'

export function PropertiesPanel({ schema, view, onViewChange }: PropertiesPanelProps) {
  const c = propertiesPanelCopy(useCollectionLocale())
  const { visible, hidden } = resolveDisplayOrder(schema, view.visibleProps)
  const itemRefsRef = useRef<Map<string, HTMLElement>>(new Map())
  const [dragging, setDragging] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // 숨김 그룹은 기본 접힘 — 펼친 것만 기억한다(패널 로컬 상태, 뷰에 저장하지 않음).
  const [openHidden, setOpenHidden] = useState<Set<string>>(() => new Set())

  const grouped = hasAnyGroup(schema)
  const searching = query.trim() !== ''
  const visibleKeys = visible.map((d) => d.key)
  const visibleSet = new Set(visibleKeys)

  const setRef = (key: string) => (el: HTMLElement | null) => {
    if (el) itemRefsRef.current.set(key, el)
    else itemRefsRef.current.delete(key)
  }

  const toggleProp = (key: string) => {
    const nextVisible = visibleSet.has(key)
      ? visibleKeys.filter((k) => k !== key)
      : [...visibleKeys, key]
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

  /** 숨김 그룹 하나를 통째로 표시 — 표시 중 목록 뒤에 그룹 순서대로 붙인다. */
  const showGroup = (defs: PropertyDef[]) => {
    onViewChange({ visibleProps: [...visibleKeys, ...defs.map((d) => d.key)] })
  }

  const toggleOpen = (path: string) => {
    setOpenHidden((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  /** 드래그 — `groupDefs` 안에서만 옮기고, 결과는 전체 visibleProps 순서에 되돌려 쓴다. */
  const handleDragStart = (groupDefs: PropertyDef[], fromIndex: number, startY: number) => {
    const groupKeys = groupDefs.map((d) => d.key)
    const items = groupKeys.flatMap((key) => {
      const dom = itemRefsRef.current.get(key)
      return dom ? [{ dom }] : []
    })
    if (items.length < 2) return
    setDragging(groupKeys[fromIndex])
    beginListReorder({
      items,
      fromIndex,
      startY,
      draggingClass: 'opacity-50',
      onCommit: (from, to) => {
        setDragging(null)
        onViewChange({ visibleProps: reorderWithinGroup(visibleKeys, groupKeys, from, to) })
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

  const visibleRow = (def: PropertyDef, idx: number, groupDefs: PropertyDef[]) => {
    const Icon = TYPE_ICON[def.type] ?? Type
    return (
      <div
        key={def.key}
        ref={setRef(def.key)}
        className={cn(
          'flex items-center gap-1.5 rounded px-1 py-1 text-xs',
          grouped && 'pl-3',
          dragging === def.key ? 'opacity-50' : 'hover:bg-surface',
        )}
      >
        <button
          type="button"
          aria-label={c.reorderAria(def.label)}
          className="cursor-grab touch-none text-fg-muted/60 active:cursor-grabbing"
          onPointerDown={(e) => {
            e.preventDefault()
            handleDragStart(groupDefs, idx, e.clientY)
          }}
        >
          {GRIP_ICON}
        </button>
        <Icon className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-fg">{def.label}</span>
        <button
          type="button"
          aria-label={c.hideAria(def.label)}
          onClick={() => toggleProp(def.key)}
          className={ICON_BTN}
        >
          {EYE_ICON}
        </button>
      </div>
    )
  }

  const hiddenRow = (def: PropertyDef) => {
    const Icon = TYPE_ICON[def.type] ?? Type
    return (
      <div
        key={def.key}
        className={cn(
          'flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-surface',
          grouped && 'pl-3',
        )}
      >
        <span className="w-[10px] shrink-0" />
        <Icon className="size-3.5 shrink-0 text-fg-muted/50" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-fg-muted">{def.label}</span>
        <button
          type="button"
          aria-label={c.showAria(def.label)}
          onClick={() => toggleProp(def.key)}
          className={ICON_BTN}
        >
          <X className="size-3" />
        </button>
      </div>
    )
  }

  const bucketLabel = (path: string) => (path === '' ? c.ungrouped : path)

  // ── 검색 중: 평평한 결과 + 경로를 보조 글로(같은 이름이 어느 그룹 것인지 가른다) ──
  if (searching) {
    const results = schema.filter((d) => matchesQuery(d, query))
    return (
      <div className={PANEL_SHELL}>
        {searchBox()}
        <div className={cn(SCROLL_AREA, 'gap-0.5')}>
          {results.length === 0 && <div className="py-1 text-xs text-fg-muted">{c.noResults}</div>}
          {results.map((def) => {
            const Icon = TYPE_ICON[def.type] ?? Type
            const on = visibleSet.has(def.key)
            const path = groupPath(def)
            return (
              <div
                key={def.key}
                className="flex items-center gap-1.5 rounded px-1 py-1 text-xs hover:bg-surface"
              >
                <Icon
                  className={cn('size-3.5 shrink-0', on ? 'text-fg-muted' : 'text-fg-muted/50')}
                  aria-hidden
                />
                <span className={cn('min-w-0 flex-1 truncate', on ? 'text-fg' : 'text-fg-muted')}>
                  {def.label}
                  {path && <span className="ml-1.5 text-[10px] text-fg-muted/70">{path}</span>}
                </span>
                <button
                  type="button"
                  aria-label={on ? c.hideAria(def.label) : c.showAria(def.label)}
                  onClick={() => toggleProp(def.key)}
                  className={ICON_BTN}
                >
                  {on ? EYE_ICON : <X className="size-3" />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function searchBox() {
    // 속성이 적으면(그룹도 없으면) 검색창이 군더더기라 감춘다.
    if (!grouped && schema.length <= 10) return null
    return (
      <div className="flex shrink-0 items-center gap-1.5 rounded bg-surface px-2 py-1">
        <Search className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={c.searchPlaceholder}
          aria-label={c.searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-muted"
        />
      </div>
    )
  }

  const visibleBuckets = grouped
    ? bucketByGroup(visible)
    : [{ path: '', items: visible } as PropertyBucket]
  const hiddenBuckets = grouped
    ? bucketByGroup(hidden)
    : [{ path: '', items: hidden } as PropertyBucket]

  return (
    <div className={PANEL_SHELL}>
      {searchBox()}

      <div className={SCROLL_AREA}>
        {/* 표시 중 섹션 */}
        <div>
          <div className="mb-0.5 flex items-center justify-between px-1">
            <span className={SECTION_LABEL}>
              {c.showing}
              {grouped && ` · ${visible.length}`}
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
            {visibleBuckets.map((bucket) => {
              if (bucket.items.length === 0) return null
              const total = schema.filter((d) => groupPath(d) === bucket.path).length
              return (
                <div key={bucket.path} className="flex flex-col gap-0.5">
                  {grouped && (
                    <div className="mt-1 flex items-center gap-1.5 rounded bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-fg">
                      <span className="min-w-0 flex-1 truncate">{bucketLabel(bucket.path)}</span>
                      <span className="text-[10px] font-normal text-fg-muted">
                        {bucket.items.length}/{total}
                      </span>
                    </div>
                  )}
                  {bucket.items.map((def, idx) => visibleRow(def, idx, bucket.items))}
                </div>
              )
            })}
          </div>
        </div>

        {/* 숨김 섹션 */}
        {hidden.length > 0 && (
          <div>
            <div className="mb-0.5 flex items-center justify-between px-1">
              <span className={SECTION_LABEL}>
                {c.hidden}
                {grouped && ` · ${hidden.length}`}
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
              {hiddenBuckets.map((bucket) => {
                if (bucket.items.length === 0) return null
                if (!grouped) return bucket.items.map(hiddenRow)
                const open = openHidden.has(bucket.path)
                const label = bucketLabel(bucket.path)
                return (
                  <div key={bucket.path} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1 rounded bg-surface/60 px-1 py-0.5 text-[11px] font-semibold text-fg-muted">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={c.toggleGroupAria(label)}
                        onClick={() => toggleOpen(bucket.path)}
                        className="flex min-w-0 flex-1 items-center gap-1 text-left hover:text-fg"
                      >
                        {open ? (
                          <ChevronDown className="size-3 shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight className="size-3 shrink-0" aria-hidden />
                        )}
                        <span className="min-w-0 truncate">{label}</span>
                        <span className="text-[10px] font-normal">{bucket.items.length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => showGroup(bucket.items)}
                        className="text-[10px] font-normal text-primary transition-colors hover:underline"
                      >
                        {c.showGroup}
                      </button>
                    </div>
                    {open && bucket.items.map(hiddenRow)}
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
