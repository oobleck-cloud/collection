'use client'

// @oobleck/collection — RecordCard 프리미티브(WAVE1/레인A).
//
// 도메인 무관 재사용 카드 컴포넌트 — BoardView 의 카드 렌더를 추출해 갤러리/리스트가 공유 가능하게.
// 커버 이미지, 제목, 보조 프로퍼티 칩, 클릭=열기 지원. 드래그 이벤트는 외부에서 props 로 주입.

import {
  ArrowLeftRight,
  CalendarDays,
  Hash,
  Link2,
  List,
  Mail,
  Map as MapIcon,
  Phone,
  SquareCheck,
  Tag,
  Tags,
  Type,
  cn,
  type LucideIcon,
} from '@oobleck/systheme'
import { resolveOptionColor } from '@oobleck/collection'
import type { PropertyDef, PropertyType, PropertyValue } from '@oobleck/collection'
import { formatGeoLabel, formatTitleText, isGeoValue } from '@oobleck/collection'
import { formatDateValueDisplay } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { recordCardCopy } from './record-card.messages'
import { RowActionMenu } from './row-action-menu'

// ─── 카드 크기 타입 ───────────────────────────────────────────────────────────────

/**
 * 카드 크기 — S(소)/M(중)/L(대). 단일 진실원천은 ViewConfig.cardSize(types.ts).
 *  - S: 좁은 폭(176px), 커버 없음, 제목만.
 *  - M: 표준 폭(240px), 커버 h-20, 보조 프로퍼티 표시.
 *  - L: 넓은 폭(320px), 커버 h-32, 보조 프로퍼티 확장.
 */
export type CardSize = 'S' | 'M' | 'L'

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<PropertyType, LucideIcon> = {
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
  button: SquareCheck, // 도달 불가 — PropertyChip 이 button 을 먼저 걸러 null 반환(아래). 맵 완전성용.
}

/** url 같은 문자열인지 — 카드 커버 후보(http/https 또는 data:image). */
export function isCoverUrl(value: PropertyValue): value is string {
  if (typeof value !== 'string') return false
  return /^(https?:\/\/|data:image)/i.test(value)
}

// S 는 showCover = false 로 도달 불가 — M/L 만 관리(도달 가능 엔트리만 유지).
const COVER_HEIGHT: Record<'M' | 'L', string> = {
  M: 'h-20',
  L: 'h-32',
}

// ─── PropertyChip — 단일 속성 칩(타입별 렌더) ────────────────────────────────────

/**
 * 속성 하나를 칩/뱃지로 렌더. 타입별 렌더:
 *  - select → Badge, multi_select → Badge × N(최대 3 + 오버플로), checkbox → ✓ 표시,
 *  - 그 외(text/number/date/url/relation) → 아이콘 + 텍스트.
 */
export function PropertyChip({ def, value }: { def: PropertyDef; value: PropertyValue }) {
  const Icon = TYPE_ICON[def.type]
  // button 은 액션 셀(클릭=onAction) — 정적 칩으로 표현할 수 없어 카드/칩 표면에선 렌더하지 않는다.
  // (버튼 상호작용은 table/list 뷰가 onAction 과 함께 렌더한다.)
  if (def.type === 'button') return null
  if (def.type === 'select') {
    const v = typeof value === 'string' ? value : ''
    if (!v) return null
    return (
      <Tag color={resolveOptionColor(def, v)} size="sm">
        {v}
      </Tag>
    )
  }
  if (def.type === 'multi_select') {
    const items = Array.isArray(value) ? value.map(String) : []
    if (items.length === 0) return null
    return (
      <>
        {items.slice(0, 3).map((v) => (
          <Tag key={v} color={resolveOptionColor(def, v)} size="sm">
            {v}
          </Tag>
        ))}
        {items.length > 3 && <span className="text-[11px] text-fg-muted">+{items.length - 3}</span>}
      </>
    )
  }
  if (def.type === 'checkbox') {
    return value === true ? <span className="text-xs text-fg-muted">{def.label} ✓</span> : null
  }
  if (def.type === 'geo') {
    // geo 값은 GeoValue 객체 — 도로명주소(없으면 좌표) 라벨로. 객체를 String() 하면 "[object Object]" 가 새므로 가드 먼저.
    if (!isGeoValue(value)) return null
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-fg-muted">
        <Icon className="size-3" aria-hidden />
        {formatGeoLabel(value)}
      </span>
    )
  }
  if (def.type === 'date') {
    // 단일/기간/시간 값을 표시용 라벨로(원문 ISO/기간 문자열 노출 방지). 비문자/빈값이면 미표시.
    const dateText = typeof value === 'string' ? formatDateValueDisplay(value) : ''
    if (!dateText) return null
    return (
      <span className="inline-flex items-center gap-0.5 text-[11px] text-fg-muted">
        <Icon className="size-3" aria-hidden />
        {dateText}
      </span>
    )
  }
  const text =
    def.format !== undefined
      ? def.format(value)
      : value === null || value === undefined
        ? ''
        : Array.isArray(value)
          ? value.join(', ')
          : // 객체값(geo/button)은 formatTitleText 로 라벨화("[object Object]" 누수 차단).
            typeof value === 'object'
            ? formatTitleText(value)
            : String(value)
  if (!text) return null
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-fg-muted">
      <Icon className="size-3" aria-hidden />
      {text}
    </span>
  )
}

// ─── RecordCard ──────────────────────────────────────────────────────────────────

/**
 * RecordCard props — 도메인 무관 재사용 카드 컴포넌트.
 * 드래그 관련 이벤트는 optional(BoardView 가 주입; 갤러리/리스트는 안 씀).
 */
export type RecordCardProps = {
  /** 카드 상단 커버 이미지 URL. null = 커버 없음. */
  cover: string | null
  /** 카드 제목 텍스트. 비어있으면 '제목 없음'으로 폴백. */
  title: string
  /** 제목 외 표시할 속성 목록 (이미 필터링·정렬된). */
  displayProps: { def: PropertyDef; value: PropertyValue }[]
  /** 카드 크기(S/M/L). 기본 M. */
  size?: CardSize
  /** 카드 클릭 = 레코드 열기. 미지정 시 클릭 인터랙션 비활성. */
  onOpen?: () => void
  /** 지정 시 카드 우상단 hover 케밥(⋯)에 "삭제"(→휴지통) 노출. 실행은 호스트(순수 콜백). */
  onDelete?: () => void
  // ─ 드래그-드롭 (BoardView 가 주입 — 갤러리/리스트는 미사용) ─
  draggable?: boolean
  isDragging?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
}

/**
 * RecordCard — 커버 이미지 + 제목 + 보조 속성 칩.
 *
 * BoardView, GalleryView, ListView 가 공유하는 도메인 무관 카드 프리미티브.
 * 드래그-드롭은 BoardView 가 props 로 주입; 미지정 시 비활성(갤러리/리스트 친화적).
 */
export function RecordCard({
  cover,
  title,
  displayProps,
  size = 'M',
  onOpen,
  onDelete,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: RecordCardProps) {
  const c = recordCardCopy(useCollectionLocale())
  const showCover = cover !== null && size !== 'S'

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onOpen}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen()
              }
            }
          : undefined
      }
      className={cn(
        'group/card relative cursor-pointer overflow-hidden rounded-md border border-border bg-background shadow-xs transition-shadow hover:shadow-sm',
        isDragging && 'opacity-50',
      )}
    >
      {/* 우상단 hover 케밥(삭제→휴지통) — 카드 클릭(열기)과 독립. onDelete 있을 때만. */}
      {onDelete && (
        <div className="absolute right-1.5 top-1.5 z-10">
          <RowActionMenu onDelete={onDelete} triggerClassName="group-hover/card:opacity-100" />
        </div>
      )}
      {showCover && (
        <div
          aria-hidden
          className={cn('w-full bg-cover bg-center', COVER_HEIGHT[size])}
          style={{ backgroundImage: `url("${cover}")` }}
        />
      )}
      <div className="flex flex-col gap-1.5 p-2">
        <div className="truncate text-[13px] font-medium text-fg">{title || c.noTitle}</div>
        {displayProps.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {displayProps.map(({ def, value }) => (
              <PropertyChip key={def.key} def={def} value={value} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
