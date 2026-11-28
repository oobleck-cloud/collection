'use client'

// @oobleck/collection — RecordCard 프리미티브(WAVE1/레인A).
//
// 도메인 무관 재사용 카드 컴포넌트 — BoardView 의 카드 렌더를 추출해 갤러리/리스트가 공유 가능하게.
// 커버 이미지, 제목, 보조 프로퍼티 칩, 클릭=열기 지원. 드래그 이벤트는 외부에서 props 로 주입.

import {
  ArrowLeftRight,
  Badge,
  CalendarDays,
  Hash,
  LayoutDashboard,
  Link2,
  List,
  Mail,
  Map as MapIcon,
  Phone,
  SquareCheck,
  Tag,
  Tags,
  Type,
  User,
  Users,
  cn,
  formatPhoneNumber,
  type LucideIcon,
} from '../kit'
import { isEmptyCellValue } from '@oobleck/collection'
import { normalizeOptions, resolveOptionColor } from '@oobleck/collection'
import {
  cardFormatClassName,
  textFormatClassName,
  type ConditionalFormatStyle,
  type ConditionalFormatTone,
} from '@oobleck/collection'
import type { PropertyDef, PropertyType, PropertyValue } from '@oobleck/collection'
import { formatGeoLabel, formatTitleText, isGeoValue } from '@oobleck/collection'
import { dayDistance, formatDateValueDisplay, parseDateValueParts } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { recordCardCopy } from './record-card.messages'
import { personIdsOf } from '@oobleck/collection'
import { PersonValue } from './PersonCell'
import { RowActionMenu } from './row-action-menu'
import { StructBand } from './StructCell'
import { openClickHandlers } from './open-click'
import { systhemeTagColor } from './systhemeTagColor'

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
  person: User,
  multi_person: Users,
  struct: LayoutDashboard, // 도달 불가 — 구조 속성은 칩이 아니라 수치 띠(StructBand)로 선다. 맵 완전성용.
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

// ─── 속성 → 글자 ───────────────────────────────────────────────────────────────

/** 칩(태그·사람·체크)으로만 그리는 타입 — 글자로 옮기지 않는다. */
const CHIP_ONLY_TYPES: ReadonlySet<PropertyType> = new Set([
  'select',
  'multi_select',
  'person',
  'multi_person',
  'checkbox',
  'button',
])

/**
 * 카드에 보일 속성 글자 — 날짜(컬럼 dateFormat)·위치·전화 하이픈·`format`. 비었으면 ''.
 * 칩으로만 그리는 타입(선택지·사람·체크·버튼)은 null — 호출부가 PropertyChip 으로 그린다.
 */
export function propertyText(
  def: PropertyDef,
  value: PropertyValue,
  now: Date = new Date(),
): string | null {
  if (CHIP_ONLY_TYPES.has(def.type)) return null
  // geo 값은 GeoValue 객체 — 도로명주소(없으면 좌표) 라벨로. 객체를 String() 하면 "[object Object]" 가 새므로 가드 먼저.
  if (def.type === 'geo') return isGeoValue(value) ? formatGeoLabel(value) : ''
  // 단일/기간/시간 값을 표시용 라벨로(원문 ISO/기간 문자열 노출 방지). 비문자/빈값이면 미표시.
  if (def.type === 'date')
    return typeof value === 'string' ? formatDateValueDisplay(value, def.dateFormat, now) : ''
  if (def.format !== undefined) return def.format(value)
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  // 객체값(geo/button)은 formatTitleText 로 라벨화("[object Object]" 누수 차단).
  if (typeof value === 'object') return formatTitleText(value)
  // 표시만 하이픈(010-1234-5678)
  if (def.type === 'phone') return formatPhoneNumber(String(value))
  return String(value)
}

/**
 * 카드에 보일 속성 목록 — 보이는 속성마다 값과 서식을 붙이고, 비었으면 `cardFallbackKey` 속성으로 바꿔 끼운다
 * (「최근 학습」이 없는 사람은 「가입」). 바꿔 끼운 속성은 자기 이름표를 쓰고, 그것도 비었으면 원래 속성(빈 값)으로 둔다.
 */
export function cardDisplayProps(
  defs: readonly PropertyDef[],
  props: Record<string, PropertyValue>,
  schema: readonly PropertyDef[],
  formats: Record<string, ConditionalFormatStyle>,
): RecordCardProps['displayProps'] {
  return defs.map((def) => {
    // 구조 속성은 자기 값이 없다 — 띠가 행의 다른 칸에서 읽도록 행 값과 스키마를 싣는다.
    if (def.type === 'struct') return { def, value: null, struct: { props, schema } }
    const value = props[def.key] ?? null
    const fallbackDef =
      isEmptyCellValue(value) && def.cardFallbackKey
        ? schema.find((d) => d.key === def.cardFallbackKey)
        : undefined
    const shown = fallbackDef && !isEmptyCellValue(props[fallbackDef.key]) ? fallbackDef : def
    const style = formats[shown.key]
    return { def: shown, value: props[shown.key] ?? null, ...(style ? { format: style } : {}) }
  })
}

// ─── PropertyChip — 단일 속성 칩(타입별 렌더) ────────────────────────────────────

/**
 * 속성 하나를 칩/뱃지로 렌더. 타입별 렌더:
 *  - select → Badge, multi_select → Badge × N(최대 3 + 오버플로), checkbox → ✓ 표시,
 *  - 그 외(text/number/date/url/relation) → 아이콘 + 텍스트.
 */
export function PropertyChip({
  def,
  value,
  className,
}: {
  def: PropertyDef
  value: PropertyValue
  /** 글자 칩(텍스트·날짜·위치)에 덧입힐 클래스 — 조건부 서식의 글자색(textFormatClassName). */
  className?: string
}) {
  const Icon = TYPE_ICON[def.type]
  // 선택지는 값이 아니라 라벨로 읽는다(표 셀과 같은 말) — 값 「inProgress」가 카드에 새지 않게.
  const optionLabel = (v: string) =>
    normalizeOptions(def.options).find((o) => o.value === v)?.label ?? v
  // button 은 액션 셀(클릭=onAction) — 정적 칩으로 표현할 수 없어 카드/칩 표면에선 렌더하지 않는다.
  // (버튼 상호작용은 table/list 뷰가 onAction 과 함께 렌더한다.)
  if (def.type === 'button') return null
  if (def.type === 'select') {
    const v = typeof value === 'string' ? value : ''
    if (!v) return null
    return (
      <Tag variant="subtle" shape="pill" color={systhemeTagColor(resolveOptionColor(def, v))} size="sm">
        {optionLabel(v)}
      </Tag>
    )
  }
  if (def.type === 'multi_select') {
    const items = Array.isArray(value) ? value.map(String) : []
    if (items.length === 0) return null
    return (
      <>
        {items.slice(0, 3).map((v) => (
          <Tag key={v} variant="subtle" shape="pill" color={systhemeTagColor(resolveOptionColor(def, v))} size="sm">
            {optionLabel(v)}
          </Tag>
        ))}
        {items.length > 3 && <span className="text-[11px] text-fg-muted">+{items.length - 3}</span>}
      </>
    )
  }
  if (def.type === 'person' || def.type === 'multi_person') {
    // 이름은 명단(def.options)에서 푼다 — 카드도 표와 같은 이름 칩을 쓴다.
    if (personIdsOf(value).length === 0) return null
    return <PersonValue def={def} value={value} />
  }
  if (def.type === 'checkbox') {
    return value === true ? <span className="text-xs text-fg-muted">{def.label} ✓</span> : null
  }
  const text = propertyText(def, value)
  if (!text) return null
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] text-fg-muted', className)}>
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
  /** 제목 외 표시할 속성 목록 (이미 필터링·정렬된). format = 그 속성을 대상으로 한 조건부 서식(글자색). */
  displayProps: {
    def: PropertyDef
    value: PropertyValue
    format?: ConditionalFormatStyle
    /** 구조 속성 — 이름표 줄 · 칩 대신 수치 띠로 선다(행 값에서 칸을 읽는다). */
    struct?: { props: Record<string, PropertyValue>; schema: readonly PropertyDef[] }
  }[]
  /** 카드 전체 조건부 서식(resolveCardFormat().card) — 바탕·테두리. 미지정 = 서식 없음. */
  format?: ConditionalFormatStyle | null
  /** 카드 크기(S/M/L). 기본 M. */
  size?: CardSize
  /**
   * 속성을 이름표 붙은 글자 줄로(뷰의 `cardPropLabels`). 기본 false — 아이콘 칩 한 줄.
   * 이름표는 `cardLabel`(없으면 `label`), 빈 이름표 속성은 한 줄에 「 · 」로 잇는다.
   */
  labels?: boolean
  /**
   * 카드 클릭 = 레코드 열기. 미지정 시 클릭 인터랙션 비활성.
   * 마우스로 열면 원본 이벤트를 넘긴다 — 호스트가 ⌘/Ctrl+클릭·가운데 클릭을 「새 탭에서 열기」로 읽는다(표 제목과 같다).
   * 키보드(Enter·Space)로 열면 이벤트 없이 부른다.
   */
  onOpen?: (event?: React.MouseEvent) => void
  /** 지정 시 카드 우상단 hover 케밥(⋯)에 "삭제"(→휴지통) 노출. 실행은 호스트(순수 콜백). */
  onDelete?: () => void
  /**
   * 속성 아래에 붙는 카드 블록(관계 표 등) — 카드 폭을 다 쓴다. 블록 안 버튼은 스스로 클릭 전파를 막는다
   * (카드 클릭 = 열기와 독립). 미지정 = 블록 없음(현행).
   */
  block?: React.ReactNode
  /** 제목 오른쪽 배지(뷰의 `cardLayout.badgeKey` — 「D-1」). tone = 상태 색. 미지정 = 배지 없음. */
  badge?: CardBadge | null
  /** 제목 아래 숫자 띠(뷰의 `cardLayout.metrics`). 빈 배열·미지정 = 띠 없음. */
  metrics?: CardMetric[]
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
  format = null,
  size = 'M',
  labels = false,
  onOpen,
  onDelete,
  block,
  badge,
  metrics,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: RecordCardProps) {
  const c = recordCardCopy(useCollectionLocale())
  const showCover = cover !== null && size !== 'S'
  const bands = displayProps.filter((p) => p.struct)
  const lines = bands.length > 0 ? displayProps.filter((p) => !p.struct) : displayProps
  const hasSummary = (metrics?.length ?? 0) > 0

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      {...openClickHandlers(onOpen)}
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
      // 표면 문법(2026-10-26, Atlassian elevation): 카드는 테두리 없이 그림자로 뜬 흰 면 — 열(눌린 면) 위에 선다.
      // 테두리와 그림자를 한 면에 같이 쓰지 않는다. 호버는 그림자 한 단, 끄는 중은 한 단 더.
      className={cn(
        'group/card relative cursor-pointer overflow-hidden rounded-md bg-background shadow-float transition-shadow hover:shadow-dialog',
        isDragging && 'opacity-60 shadow-panel',
        cardFormatClassName(format),
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
      {/* 블록(제목 · 속성 · 카드 블록) 사이 12px, 안쪽 여백 16px. 블록 안의 줄은 각자 촘촘하게.
          짜임(요약 묶음)이 있는 넓은 카드는 상세 패널과 같은 리듬 — 안쪽 20px · 덩어리 사이 16px. */}
      <div className={cn('flex flex-col', hasSummary ? 'gap-4 p-5' : 'gap-3 p-4')}>
        <div className={cn('flex flex-col gap-1.5', !labels && 'contents')}>
          <div className="flex min-w-0 items-center gap-2">
            <div
              data-card-title
              className={cn(
                'min-w-0 flex-1 truncate text-fg',
                labels ? 'text-sm font-semibold' : 'text-[13px] font-medium',
                badge && 'text-base font-bold',
                format?.tone === 'muted' && 'text-fg-muted',
                format?.bold && 'font-semibold',
              )}
            >
              {title || c.noTitle}
            </div>
            {badge && (
              // 케밥(⋯)이 뜨는 자리를 비켜 선다 — 케밥은 호버 때만 보이지만 배지를 덮지 않게.
              <Badge
                data-card-badge=""
                size="sm"
                variant={BADGE_VARIANT[badge.tone ?? 'muted']}
                className={cn(
                  'tabular-nums',
                  // 중립은 회색 바탕(테두리 없음) — 상태 배지는 채운 모양 하나로 말한다(상세 칸 시스템).
                  !badge.tone || badge.tone === 'muted'
                    ? 'border-transparent bg-container text-fg-subtle'
                    : undefined,
                  onDelete && 'group-hover/card:invisible',
                )}
              >
                {badge.text}
              </Badge>
            )}
          </div>
          {labels && hasMetaProp(lines) && <CardMetaLine displayProps={lines} />}
        </div>
        {metrics && hasSummary && <CardSummary metrics={metrics} />}
        {bands.map(
          ({ def, struct }) =>
            struct && (
              <StructBand key={def.key} def={def} props={struct.props} schema={struct.schema} />
            ),
        )}
        {labels && hasLabeledProp(lines) && (
          <div className="flex flex-col gap-1">
            <CardPropLines displayProps={lines} />
          </div>
        )}
        {!labels && lines.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {lines.map(({ def, value, format: propFormat }) => (
              <PropertyChip
                key={def.key}
                def={def}
                value={value}
                className={textFormatClassName(propFormat)}
              />
            ))}
          </div>
        )}
        {block}
      </div>
    </div>
  )
}

// ─── CardPropLines — 이름표 붙은 글자 줄(cardPropLabels) ──────────────────────────────

type DisplayProp = RecordCardProps['displayProps'][number]

/** 메타 한 줄에 서는 속성인가 — 이름표 없는 것(값이 스스로 말한다) · `cardMeta`(「방문 10/23(목)」). */
function isMetaProp(def: PropertyDef): boolean {
  return def.cardLabel === '' || def.cardMeta === true
}

/** 메타 줄 · 이름표 줄로 그릴 속성이 하나라도 있나 — 다 비었으면 빈 블록이 틈만 남기지 않게. */
function hasMetaProp(displayProps: DisplayProp[]): boolean {
  return displayProps.some((p) => isMetaProp(p.def) && propValueNode(p) != null)
}
function hasLabeledProp(displayProps: DisplayProp[]): boolean {
  return displayProps.some((p) => !isMetaProp(p.def) && propValueNode(p) != null)
}

/** 한 속성의 값 노드 — 글자로 옮길 수 있으면 글자, 칩 타입이면 칩. 비었으면 null. */
function propValueNode({ def, value }: DisplayProp): React.ReactNode {
  const text = propertyText(def, value)
  if (text === null) return <PropertyChip def={def} value={value} />
  return text || null
}

const textOf = (p: DisplayProp) => propertyText(p.def, p.value) ?? ''
const metaText = (p: DisplayProp) =>
  p.def.cardMeta ? `${p.def.cardLabel ?? p.def.label} ${textOf(p)}` : textOf(p)

/**
 * 메타 한 줄 — 「희망가Gap(칩) · 방문 10/23(목) 11:30 · 견적 마감됨(칩)」. 칩 · 글자를 한 줄로 잇고 넘치면 자른다(전체는 title).
 */
function CardMetaLine({ displayProps }: { displayProps: DisplayProp[] }) {
  const meta = displayProps
    .filter((p) => isMetaProp(p.def))
    .map((p) => ({ p, node: propValueNode(p) }))
    .filter((x): x is { p: DisplayProp; node: NonNullable<React.ReactNode> } => x.node != null)
  return (
    <div
      className="flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap text-xs text-fg-subtle"
      title={
        meta
          .map(({ p }) => metaText(p))
          .filter(Boolean)
          .join(' · ') || undefined
      }
    >
      {meta.map(({ p, node }, i) => (
        <span
          key={p.def.key}
          className={cn('inline-flex min-w-0 items-center gap-1', textFormatClassName(p.format))}
        >
          {i > 0 && <span aria-hidden>·</span>}
          {p.def.cardMeta && <span className="shrink-0">{p.def.cardLabel ?? p.def.label}</span>}
          <span className={cn('truncate', p.def.cardMeta && 'text-fg')}>{node}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * 이름표 줄 — 「기한 D-3」 「최근 학습 2026-10-21」. 줄마다 한 줄로 자르고 전체는 title 에.
 * 서식(조건부)이 걸린 속성 줄은 그 글자색으로 — 카드 바탕은 카드 서식이 이미 칠했다. 메타 줄 속성은 위에서 그렸다.
 */
function CardPropLines({ displayProps }: { displayProps: DisplayProp[] }) {
  const labeled = displayProps
    .filter((p) => !isMetaProp(p.def))
    .map((p) => ({ p, node: propValueNode(p) }))
    .filter((x): x is { p: DisplayProp; node: NonNullable<React.ReactNode> } => x.node != null)
  return (
    <>
      {labeled.map(({ p, node }) => {
        const label = p.def.cardLabel ?? p.def.label
        return (
          <div
            key={p.def.key}
            className={cn(
              'flex min-w-0 items-center gap-1 whitespace-nowrap text-xs text-fg-muted',
              p.format?.tone && p.format.tone !== 'muted' && 'font-medium',
              textFormatClassName(p.format),
            )}
            title={`${label} ${textOf(p)}`.trim()}
          >
            <span className="shrink-0">{label}</span>
            {/* 값은 이름표보다 한 단 진하게 — 같은 회색이면 이름표와 값이 한 덩어리로 읽힌다. 서식 색이 있으면 그 색. */}
            <span className={cn('min-w-0 truncate', !p.format?.tone && 'text-fg')}>{node}</span>
          </div>
        )
      })}
    </>
  )
}

// ─── 카드 짜임 — 제목 옆 배지 · 숫자 띠(cardLayout) ───────────────────────────────────

/** 제목 옆 배지 한 개 — 글자와 상태 색. */
export type CardBadge = { text: string; tone?: ConditionalFormatTone }
/** 요약 묶음의 숫자 하나 — 이름표 · 값 글자 · 값의 서식(조건부). */
export type CardMetric = {
  key: string
  label: string
  text: string
  format?: ConditionalFormatStyle
}

/** 상태 색 → DS 배지 모양. 무채색은 회색 바탕(아래에서 덧입힌다). */
const BADGE_VARIANT: Record<
  ConditionalFormatTone,
  'default' | 'warning' | 'error' | 'success' | 'info' | 'primary'
> = {
  danger: 'error',
  warning: 'warning',
  success: 'success',
  info: 'info',
  accent: 'primary',
  muted: 'default',
}

/**
 * 배지 — 보일 글자와 색. 색은 조건부 서식이 먼저, 없으면 상대 날짜(「D-n」)의 임박(오늘 · 내일 · 지남)만 주의 색.
 * 비었으면 null(배지를 세우지 않는다).
 */
export function cardBadgeOf(
  def: PropertyDef,
  value: PropertyValue,
  format: ConditionalFormatStyle | undefined,
  now: Date = new Date(),
): CardBadge | null {
  const text = propertyText(def, value, now)
  if (!text) return null
  if (format?.tone) return { text, tone: format.tone }
  if (def.type === 'date' && def.dateFormat === 'relative' && typeof value === 'string') {
    const start = parseDateValueParts(value).start
    if (start && dayDistance(start, now) <= 1) return { text, tone: 'warning' }
  }
  return { text }
}

/**
 * 요약 묶음 — 첫 숫자가 무게중심(왼쪽, 크게), 나머지는 오른쪽에 작은 「이름표 값」 줄로 받친다(상세 칸 시스템의 DetailInset:
 * 테두리 · 칸 사이 선 없이 옅은 바탕 하나). 같은 크기 숫자를 칸으로 나란히 세우면 박스가 겹쳐 무겁고 어느 것을 볼지 흐려진다.
 */
function CardSummary({ metrics }: { metrics: CardMetric[] }) {
  const [hero, ...details] = metrics
  if (!hero) return null
  return (
    <div
      data-card-metrics=""
      className="flex items-end justify-between gap-4 rounded-md bg-container-low px-4 py-3.5"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-fg-subtle">{hero.label}</span>
        <span
          className={cn(
            'truncate text-xl font-bold tabular-nums text-fg',
            textFormatClassName(hero.format),
          )}
        >
          {hero.text || '—'}
        </span>
      </div>
      {details.length > 0 && (
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          {details.map((m) => (
            <div key={m.key} className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className="text-fg-subtle">{m.label}</span>
              <span
                className={cn('font-medium tabular-nums text-fg', textFormatClassName(m.format))}
              >
                {m.text || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
