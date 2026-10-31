'use client'

import { type ElementType, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronsLeft,
  ChevronsRight,
  Input,
  Menu,
  Plus,
  Popover,
  Search,
  Select,
  Tooltip,
  X,
  cn,
  type MenuItem,
} from '@oobleck/systheme'
import type {
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOp,
  PropertyDef,
  PropertyType,
  PropertyValue,
  RelationProvider,
  Sort,
  ViewConfig,
} from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { viewToolbarCopy } from './ViewToolbar.messages'
import { FilterBuilder, isSortableType, totalFilterCount } from './filter-builder'
import type { ViewOptionsSlot } from './view-options-menu'
import { ViewOptionsMenu } from './view-options-menu'
import { buildLayoutSlot } from './view-layout-panel'

// 필터 편집기·게이팅 함수는 filter-builder 로 분리했다(툴바가 뷰 레지스트리를 통째로
// 끌고 오는 탓에, 그것만 필요한 쪽까지 그 그래프를 지게 되던 문제). 기존 import 경로를
// 깨지 않도록 여기서 다시 내보낸다.
export { isFilterableType, isSortableType, opsFor } from './filter-builder'

// @oobleck/collection — 뷰 툴바(노션식 아이콘 행 + ⋯ 허브, WAVE1/레인B).
//
// 구조: [🔍검색] [↑↓정렬] [⛁필터]   ...좌측 지름길...   [⚙뷰옵션 허브] [＋]
// - 좌측 아이콘 3개: 클릭 시 Popover 패널 열림, 활성 시 카운트/토널 강조.
// - 뷰 옵션 허브: ViewOptionsMenu(슬롯 API). 맨 앞에 Layout 슬롯(레이아웃 그리드+표시옵션)을
//   주입한다 — 레이아웃(표/보드/갤러리…) 전환은 툴바 pill 이 아니라 이 허브 안에서 한다
//   (뷰 = 명명된 인스턴스(탭), 레이아웃 = 그 인스턴스의 속성).
// - 루트 op 보존: FilterBuilder onChange 가 루트 op 를 변경하지 않는다(선결 계약).
//
// 영속 경로: 상위가 onViewChange(next Partial<ViewConfig>) 로 CollectionSchemaConfig.view 에 머지·저장.

export type ViewToolbarProps = {
  /** 컬럼 정의 — 정렬/필터 키 선택 옵션. */
  schema: PropertyDef[]
  view: ViewConfig
  /** 뷰 부분 갱신 — sort/filters/type/groupBy 중 바뀐 것만 머지해 영속. */
  onViewChange: (next: Partial<ViewConfig>) => void
  /** 생성 버튼("＋") 클릭. 미지정 시 버튼 숨김. createMenu 가 있으면 이 콜백은 쓰이지 않는다. */
  onCreate?: () => void | Promise<void>
  /** 생성 버튼 라벨(기본 "새로 만들기"). */
  createLabel?: string
  /**
   * 생성 **방법이 여럿일 때**의 선택지 — 주면 ＋ 버튼이 곧장 만들지 않고 이 항목들을 드롭다운으로 편다
   * (예: 빈 행으로 시작 / AI와 함께 만들기). 미지정이면 기존 그대로 onCreate 즉시 실행(회귀 0).
   *
   * **도메인 무지성**: 라벨·아이콘·동작을 전부 표면이 소유하고, 툴바는 "선택지가 있으면 편다"만 안다
   * (hubSlots 와 동형의 슬롯 관용구). 여기 항목엔 기본 생성도 표면이 직접 넣는다 — 그래야 표면이
   * "빈 상품 추가"처럼 자기 도메인 말로 라벨을 지을 수 있다.
   */
  createMenu?: MenuItem[]
  /** createMenu 항목 선택. createMenu 를 줄 때 필수(없으면 선택이 무시된다). */
  onCreateMenuSelect?: (id: string) => void
  /**
   * ⋯ 허브 추가 슬롯 — W2 가 프로퍼티 show/hide·레이아웃 옵션·그룹 옵션 패널을 코드 추가 없이 주입.
   * 빈 배열이면 허브가 "설정 옵션이 없습니다"를 표시한다.
   */
  hubSlots?: ViewOptionsSlot[]
  /**
   * 검색어 변경 콜백(휘발, 영속 안 함) — 상위가 레코드를 제목·텍스트로 필터링하는 데 사용.
   * 미지정 시 검색 아이콘 노출되지 않음.
   */
  onSearchChange?: (query: string) => void
  /**
   * "어떤 행을 보일까" 컨트롤(검색·정렬·필터)을 툴바가 제공할지. 미지정 = true(현행).
   *
   * false 로 끄는 자리는 **정렬·필터가 아무 데도 반영되지 않는** 화면이다. 눌러도 아무 일
   * 없는 컨트롤을 남기느니 아예 없앤다.
   *
   * 서버가 행을 고르는 화면(주문 목록)은 false 가 아니라 **true** 다 — 툴바의 정렬·필터가
   * 뷰 상태로 올라가 서버 쿼리로 컴파일되므로 눌린 대로 동작한다. 다만 `onSearchChange` 는
   * 주지 않는다: 그 검색은 넘겨받은 한 페이지 안에서만 도는 로컬 필터라, 서버로 가는 검색
   * 입력 옆에 두면 둘의 결과가 조용히 어긋난다(검색은 헤더의 상시 입력이 소유).
   *
   * "어떻게 보일까" 컨트롤(레이아웃·프로퍼티 표시/순서·행 높이)은 이 플래그와 무관하게 남는다 —
   * 그건 서버가 아니라 뷰가 소유하는 것이라 서버 페이지네이션과 충돌하지 않는다.
   */
  rowQueryControls?: boolean
  /**
   * inline=true: 외부 mb-2 wrapper 없이 아이콘 행만 렌더(ViewTabs 옆에 합성 시).
   * 이 모드에서는 축소(>>/<<) 버튼이 활성화되며, 부모가 group/vh 클래스를 가지면
   * >> 버튼이 호버 시에만 표시된다.
   */
  inline?: boolean
  /**
   * 관계 provider 레지스트리 — 레이아웃 패널의 「관계 표」가 대상 레코드의 열 후보(`records.schema`)를 읽는다.
   * 미지정이면 관계 표 열은 고를 수 없고(provider 기본 열), 관계 속성만 고른다.
   */
  relations?: Record<string, RelationProvider>
}

// ─── 필터/정렬 아이콘 ─────────────────────────────────────────────────────────

/**
 * FilterIcon — 필터 지름길 아이콘(노션식 funnel, 3개 줄이 좁아지는 형태). @oobleck/systheme 미제공이라 인라인 SVG.
 *
 * width/height 속성을 반드시 함께 둔다. 이 패키지의 클래스는 앱의 Tailwind `@source` 범위 밖이라
 * 여기서만 쓰는 유틸리티는 생성되지 않을 수 있는데, 크기를 클래스에만 맡기면 그 순간 svg 가
 * **0×0 으로 접혀 아이콘이 통째로 사라진다**(버튼은 남아서 "빈 칸을 누르는" 화면이 된다).
 * 속성이 있으면 최악의 경우에도 기본 크기로 보인다 — 클래스는 그 위에서 덮어쓸 뿐이다.
 */
function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 5h16M7 12h10M10 19h4" />
    </svg>
  )
}

/** CaretIcon — 생성 드롭다운의 "펴진다" 신호. @oobleck/systheme 가 ChevronDown 을 재수출하지 않아 인라인 SVG(FilterIcon 전례). */
function CaretIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}

/**
 * SortIcon — 정렬 지름길 전용 아이콘. @oobleck/systheme 에 ArrowUpDown 이 없으므로
 * ArrowUp + ArrowDown 을 인라인 SVG 로 합성해 정렬을 직관적으로 표현한다.
 * SlidersHorizontal(필터)와 시각적으로 구분된다.
 */
function SortIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 3v10M4 3L2 5M4 3l2 2" />
      <path d="M12 13V3M12 13l-2-2M12 13l2-2" />
    </svg>
  )
}

// ─── 정렬 빌더 ────────────────────────────────────────────────────────────────

function SortBuilder({
  schema,
  sort,
  onChange,
}: {
  schema: PropertyDef[]
  sort: Sort[]
  onChange: (next: Sort[]) => void
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const usedKeys = new Set(sort.map((s) => s.key))
  // geo 등 정렬 불가 타입은 후보에서 제외(객체값이라 안정 순서가 없음 — #45).
  // searchOnly 는 표에 없는 필드라 정렬 기준이 될 수 없다 — 보이지 않는 열로 정렬하면
  // 순서가 왜 그런지 화면에서 설명되지 않는다.
  const available = schema.filter(
    (d) => !usedKeys.has(d.key) && isSortableType(d.type) && !d.searchOnly,
  )

  const updateAt = (i: number, patch: Partial<Sort>) =>
    onChange(sort.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const removeAt = (i: number) => onChange(sort.filter((_, j) => j !== i))
  const addItems: MenuItem[] = available.map((d) => ({ id: d.key, label: d.label }))
  const addSort = (key: string) => onChange([...sort, { key, dir: 'asc' }])

  return (
    <div className="flex flex-col gap-2">
      {sort.length === 0 && <div className="text-xs text-fg-muted">{c.noSort}</div>}
      {sort.map((s, i) => {
        const def = schema.find((d) => d.key === s.key)
        return (
          <div key={`${s.key}_${i}`} className="flex items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-xs text-fg">{def?.label ?? s.key}</span>
            <button
              type="button"
              aria-label={c.toggleDirection}
              onClick={() => updateAt(i, { dir: s.dir === 'asc' ? 'desc' : 'asc' })}
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
            >
              {s.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
              {s.dir === 'asc' ? c.ascShort : c.descShort}
            </button>
            <button
              type="button"
              aria-label={c.remove}
              onClick={() => removeAt(i)}
              className="inline-flex size-5 items-center justify-center rounded text-fg-muted hover:bg-surface hover:text-fg"
            >
              <X className="size-3" />
            </button>
          </div>
        )
      })}
      {available.length > 0 && (
        <Menu
          items={addItems}
          onSelect={addSort}
          density="compact"
          trigger={({ onClick, 'aria-expanded': ae }) => (
            <button
              type="button"
              onClick={onClick}
              aria-expanded={ae}
              className="self-start rounded px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
            >
              {c.addSort}
            </button>
          )}
        />
      )}
    </div>
  )
}

// ─── 아이콘 버튼(지름길) ──────────────────────────────────────────────────────

/** 툴바 아이콘 버튼 — 호버 툴팁(label) + aria-label 포함. 활성 시 primary 토널, 뱃지로 카운트 표시. */
function IconShortcut({
  icon: Icon,
  label,
  active,
  badge,
  onClick,
  ariaExpanded,
}: {
  icon: ElementType
  label: string
  active: boolean
  badge?: string
  onClick: () => void
  ariaExpanded?: boolean
}) {
  return (
    <Tooltip content={label} side="bottom" delayDuration={400}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-expanded={ariaExpanded}
        // h-8/size-[18px] — 이 아이콘들은 목록 화면에서 가장 자주 눌리는 컨트롤이라 h-7·size-4
        // 로는 타깃이 작았다(WCAG 2.5.8 최소 24px 은 넘지만 실사용에서 조준이 걸린다).
        // 옆 검색 입력(h-8)과도 높이가 맞아 툴바 줄의 기준선이 흔들리지 않는다.
        className={cn(
          'inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors',
          active ? 'bg-primary/10 text-primary' : 'text-fg-muted hover:bg-surface hover:text-fg',
        )}
      >
        <Icon className="size-5" />
        {badge && <span className="tabular-nums">{badge}</span>}
      </button>
    </Tooltip>
  )
}

// ─── 검색 인라인 필드 ─────────────────────────────────────────────────────────

/**
 * 검색 아이콘 → 인라인 필드 토글. 검색어는 휘발(영속 안 함) — onSearchChange 로 상위에 전달.
 * 닫기: X 버튼 또는 Escape 키로, 쿼리를 빈 문자열로 초기화.
 */
function SearchShortcut({ onSearchChange }: { onSearchChange: (q: string) => void }) {
  const c = viewToolbarCopy(useCollectionLocale())
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const open = () => {
    setExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const close = () => {
    setExpanded(false)
    setQuery('')
    onSearchChange('')
  }

  const handleChange = (v: string) => {
    setQuery(v)
    onSearchChange(v)
  }

  if (expanded) {
    return (
      <div className="inline-flex h-7 items-center gap-1 rounded border border-border bg-background px-2">
        <Search className="size-3.5 shrink-0 text-fg-muted" />
        <Input
          ref={inputRef}
          size="sm"
          chrome="ghost"
          className="h-full w-36 text-xs focus-visible:ring-0"
          value={query}
          onValueChange={handleChange}
          placeholder={c.searchPlaceholder}
          onEscapeKey={close}
        />
        <button
          type="button"
          aria-label={c.closeSearch}
          onClick={close}
          className="inline-flex size-4 items-center justify-center rounded text-fg-muted hover:text-fg"
        >
          <X className="size-3" />
        </button>
      </div>
    )
  }

  return <IconShortcut icon={Search} label={c.search} active={false} onClick={open} />
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function ViewToolbar({
  schema,
  view,
  onViewChange,
  onCreate,
  createLabel,
  createMenu,
  onCreateMenuSelect,
  hubSlots = [],
  onSearchChange,
  rowQueryControls = true,
  inline,
  relations,
}: ViewToolbarProps) {
  const locale = useCollectionLocale()
  const c = viewToolbarCopy(locale)
  const resolvedCreateLabel = createLabel ?? c.createDefault
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [layoutOpen, setLayoutOpen] = useState(false)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)

  const sortCount = view.sort.length
  const filterCount = totalFilterCount(view.filters)

  const layoutSlot = buildLayoutSlot(view, schema, onViewChange, locale, relations)
  const propertiesSlot = hubSlots.find((s) => s.id === 'properties')
  const remainingSlots = hubSlots.filter((s) => s.id !== 'properties')
  // collapse 시 허브에 레이아웃·프로퍼티 포함 — 개별 버튼이 숨겨지므로 여기서 접근 가능해야 함
  const collapsedHubSlots = [
    layoutSlot,
    ...(propertiesSlot ? [propertiesSlot] : []),
    ...remainingSlots,
  ]

  const icons = (
    <div className={cn('flex shrink-0 items-center gap-1', inline && 'ml-auto py-1')}>
      {minimized ? (
        /* ── 축소 상태: << 확장 + ⋯ 허브만 ── */
        <>
          <Tooltip content={c.expand} side="bottom" delayDuration={400}>
            <button
              type="button"
              aria-label={c.expand}
              onClick={() => setMinimized(false)}
              className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-surface hover:text-fg"
            >
              <ChevronsLeft className="size-5" />
            </button>
          </Tooltip>
          <ViewOptionsMenu slots={collapsedHubSlots} />
        </>
      ) : (
        /* ── 전개 상태: 전체 아이콘 행 ── */
        <>
          {/* 🔍 검색 */}
          {rowQueryControls && onSearchChange && <SearchShortcut onSearchChange={onSearchChange} />}

          {rowQueryControls && (
            <>
              {/* ↑↓ 정렬 */}
              <Popover
                open={sortOpen}
                onOpenChange={setSortOpen}
                side="bottom"
                align="end"
                contentClassName="w-72 p-3"
                trigger={({ onClick, 'aria-expanded': ae }) => (
                  <IconShortcut
                    icon={SortIcon}
                    label={c.sort}
                    active={sortCount > 0}
                    badge={sortCount > 0 ? `${sortCount}` : undefined}
                    onClick={() => onClick()}
                    ariaExpanded={ae}
                  />
                )}
              >
                <SortBuilder
                  schema={schema}
                  sort={view.sort}
                  onChange={(next) => onViewChange({ sort: next })}
                />
              </Popover>

              {/* ⛁ 필터 */}
              <Popover
                open={filterOpen}
                onOpenChange={setFilterOpen}
                side="bottom"
                align="end"
                contentClassName="w-96 p-3"
                trigger={({ onClick, 'aria-expanded': ae }) => (
                  <IconShortcut
                    icon={FilterIcon}
                    label={c.filter}
                    active={filterCount > 0}
                    badge={filterCount > 0 ? c.filterBadge(filterCount) : undefined}
                    onClick={() => onClick()}
                    ariaExpanded={ae}
                  />
                )}
              >
                <FilterBuilder
                  schema={schema}
                  root={view.filters}
                  onChange={(next) => onViewChange({ filters: next })}
                />
              </Popover>
            </>
          )}

          {/* ⊞ 레이아웃 — 아이콘만(라벨 없음) */}
          <Popover
            open={layoutOpen}
            onOpenChange={setLayoutOpen}
            side="bottom"
            align="end"
            contentClassName="w-56 p-3"
            trigger={({ onClick, 'aria-expanded': ae }) => (
              <IconShortcut
                icon={layoutSlot.icon}
                label={layoutSlot.label}
                active={false}
                onClick={() => onClick()}
                ariaExpanded={ae}
              />
            )}
          >
            {layoutSlot.panel}
          </Popover>

          {/* ⚙ 프로퍼티 — 아이콘만(라벨 없음) */}
          {propertiesSlot && (
            <Popover
              open={propertiesOpen}
              onOpenChange={setPropertiesOpen}
              side="bottom"
              align="end"
              contentClassName="w-56 p-3"
              trigger={({ onClick, 'aria-expanded': ae }) => (
                <IconShortcut
                  icon={propertiesSlot.icon}
                  label={propertiesSlot.label}
                  active={false}
                  onClick={() => onClick()}
                  ariaExpanded={ae}
                />
              )}
            >
              {propertiesSlot.panel}
            </Popover>
          )}

          {/* ⋯ 추가 슬롯 */}
          {remainingSlots.length > 0 && <ViewOptionsMenu slots={remainingSlots} />}

          {/* >> 축소 버튼 — inline 모드 + 호버 시만 노출 */}
          {inline && (
            <Tooltip content={c.collapse} side="bottom" delayDuration={400}>
              <button
                type="button"
                aria-label={c.collapse}
                onClick={() => setMinimized(true)}
                className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted opacity-0 transition-all group-hover/vh:opacity-100 hover:bg-surface hover:text-fg"
              >
                <ChevronsRight className="size-5" />
              </button>
            </Tooltip>
          )}
        </>
      )}

      {/* ＋ 생성 — 항상 노출. createMenu 가 있으면 즉시 생성 대신 방법을 고르게 편다(표면이 선택지 소유). */}
      {createMenu && createMenu.length > 0 ? (
        <Menu
          items={createMenu}
          onSelect={(id) => onCreateMenuSelect?.(id)}
          density="compact"
          trigger={({ onClick, 'aria-expanded': ae }) => (
            <button
              type="button"
              onClick={onClick}
              aria-expanded={ae}
              aria-haspopup="menu"
              className="inline-flex h-7 items-center gap-1 rounded bg-primary px-2 text-xs font-medium text-primary-fg transition-colors hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
              {resolvedCreateLabel}
              <CaretIcon className="size-3" />
            </button>
          )}
        />
      ) : (
        onCreate && (
          <button
            type="button"
            onClick={() => void onCreate()}
            className="inline-flex h-7 items-center gap-1 rounded bg-primary px-2 text-xs font-medium text-primary-fg transition-colors hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            {resolvedCreateLabel}
          </button>
        )
      )}
    </div>
  )

  if (inline) return icons
  // standalone: 좌(검색·정렬·필터) · 우(레이아웃·프로퍼티·생성) 분리 레이아웃은 제거됨.
  // 모든 아이콘이 우측 정렬되도록 justify-end 유지.
  return <div className="mb-2 flex justify-end">{icons}</div>
}
