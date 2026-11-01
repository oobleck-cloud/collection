'use client'

import { type FC, useMemo } from 'react'
import { Plus, cn } from '../kit'
import type { PropertyDef, PropertyValue, ViewConfig } from '@oobleck/collection'
import { GROUP_EMPTY, resolveTitleKey, viewGroups, type Row } from '@oobleck/collection'
import { normalizeOptions, isMultiValueType, isOptionBackedType } from '@oobleck/collection'
import { resolveCardFormat } from '@oobleck/collection'
import { cardDisplayProps, isCoverUrl, RecordCard } from './record-card'
import { formatTitleText } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { galleryViewCopy } from './GalleryView.messages'
import type { ViewSurfaceProps } from './ViewSurface'

// @oobleck/collection — 갤러리 뷰 렌더러(WAVE2/레인G, ViewConfig.type='gallery').
//
// 갤러리 = 반응형 카드 그리드. cardSize(S/M/L)로 열 수·카드 폭 결정.
// groupBy 있으면 viewGroups 로 섹션 분할, 없으면 단일 그리드.
// coverKey 가 있으면 해당 속성값을 URL 로 해석해 커버로 사용(BoardView 동일 규칙).
// 드래그 없음 — 카드 클릭 = onOpen.

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────────

/** cardSize → 그리드 열 수(반응형: 최소 2, 폭에 따라 자동 확장). */
const GRID_COLS: Record<'S' | 'M' | 'L', string> = {
  S: 'grid-cols-[repeat(auto-fill,minmax(176px,1fr))]',
  M: 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]',
  L: 'grid-cols-[repeat(auto-fill,minmax(320px,1fr))]',
}

/** 표시할 카드 속성 목록 — visibleProps 있으면 그 순서, 없으면 schema 전체. titleKey·coverKey·groupByKey 제외. */
function resolveDisplayProps(
  schema: PropertyDef[],
  view: ViewConfig,
  titleKey: string | undefined,
): PropertyDef[] {
  const exclude = new Set<string | undefined>([titleKey, view.coverKey, view.groupBy])
  if (!view.visibleProps || view.visibleProps.length === 0) {
    return schema.filter((d) => !exclude.has(d.key))
  }
  const byKey = new Map(schema.map((d) => [d.key, d]))
  return view.visibleProps.flatMap((k) => {
    if (exclude.has(k)) return []
    const def = byKey.get(k)
    return def ? [def] : []
  })
}

// ─── 섹션(그룹) 렌더 ─────────────────────────────────────────────────────────────

/** DS Tag 색 → Tailwind 배경 클래스 맵. optionColor 에서 반환되는 색 이름과 일치해야 한다. */
const TAG_SWATCH_CLASS: Record<string, string> = {
  gray: 'bg-neutral-400',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  orange: 'bg-orange-400',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  teal: 'bg-teal-500',
}

type GallerySectionProps = {
  groupKey: string
  groupLabel: string
  /** select/multi_select 옵션 색(DS Tag 색 이름). GROUP_EMPTY·없는 값이면 undefined(중립색). */
  groupColor?: string
  rows: Row<Record<string, PropertyValue>>[]
  view: ViewConfig
  titleKey: string | undefined
  displayPropDefs: PropertyDef[]
  /** 전체 스키마 — 빈 속성의 대신 보일 속성(cardFallbackKey)을 찾는다. */
  schema: PropertyDef[]
  onOpen?: (id: string, event?: React.MouseEvent) => void
  onDeleteRow?: (id: string) => void
  onCreate?: () => void | Promise<void>
  createLabel?: string
  showGroupHeader: boolean
}

function GallerySection({
  groupKey,
  groupLabel,
  groupColor,
  rows,
  view,
  titleKey,
  displayPropDefs,
  schema,
  onOpen,
  onDeleteRow,
  onCreate,
  createLabel,
  showGroupHeader,
}: GallerySectionProps) {
  const c = galleryViewCopy(useCollectionLocale())
  const size = view.cardSize ?? 'M'
  const gridCols = GRID_COLS[size]
  const swatchClass = groupColor ? (TAG_SWATCH_CLASS[groupColor] ?? 'bg-neutral-400') : undefined

  return (
    <div className="flex flex-col gap-3">
      {showGroupHeader && (
        <div className="flex items-center gap-2 border-b border-border pb-2">
          {swatchClass ? (
            <span
              className={cn('size-2.5 shrink-0 rounded-full', swatchClass)}
              aria-hidden
              data-testid="group-color-swatch"
            />
          ) : (
            <span
              className="size-2.5 shrink-0 rounded-full bg-neutral-300"
              aria-hidden
              data-testid="group-color-swatch"
            />
          )}
          <span className="text-sm font-medium text-fg">
            {groupKey === GROUP_EMPTY ? c.groupNone : groupLabel}
          </span>
          <span className="text-xs text-fg-muted">{rows.length}</span>
        </div>
      )}
      <div className={cn('grid gap-3', gridCols)}>
        {rows.map((row) => {
          const titleValue = titleKey ? row.props[titleKey] : null
          const titleText = formatTitleText(titleValue ?? null)
          const coverVal = view.coverKey ? row.props[view.coverKey] : null
          const cover = isCoverUrl(coverVal) ? coverVal : null
          // 조건부 서식 — 표와 같은 규칙을 카드에(보드와 같다, resolveCardFormat).
          const format = resolveCardFormat(view.conditionalFormats, row.props, [
            ...(titleKey ? [titleKey] : []),
            ...displayPropDefs.map((d) => d.key),
          ])
          const displayProps = cardDisplayProps(displayPropDefs, row.props, schema, format.byKey)
          return (
            <RecordCard
              key={row.id}
              cover={cover}
              title={titleText}
              displayProps={displayProps}
              format={format.card}
              size={size}
              labels={view.cardPropLabels ?? false}
              onOpen={onOpen ? (e) => onOpen(row.id, e) : undefined}
              onDelete={onDeleteRow ? () => onDeleteRow(row.id) : undefined}
            />
          )
        })}
      </div>
      {onCreate && (
        <button
          type="button"
          onClick={() => void onCreate()}
          className="inline-flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
        >
          <Plus className="size-3.5" aria-hidden />
          {createLabel ?? c.newCard}
        </button>
      )}
    </div>
  )
}

// ─── GalleryView ─────────────────────────────────────────────────────────────────

/**
 * GalleryView — 카드 격자 뷰(ViewConfig.type='gallery').
 *
 * - cardSize(S/M/L)로 그리드 열 수와 카드 폭 결정. 미지정 시 M.
 * - coverKey 있으면 해당 속성값을 커버 이미지로(isCoverUrl 검증). BoardView 와 동일 규칙.
 * - groupBy 있으면 코어 viewGroups 로 섹션 분할(single/multi-select 모두).
 * - viewGroups 가 filter → sort → group 을 일괄 처리(재구현 금지).
 * - 드래그 없음; 카드 클릭 = onOpen.
 */
export const GalleryView: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  onOpen,
  onDeleteRow,
  onCreate,
  createLabel,
}) => {
  const c = galleryViewCopy(useCollectionLocale())
  const propertySchema = schema ?? pack.propertySchema
  // 제목 = visibleProps 의 첫 컬럼(board 와 동일 규칙). schema[0] 직접 사용 금지(상품 schema[0]=status).
  const titleKey = resolveTitleKey(propertySchema, view)
  const groupByDef = view.groupBy ? propertySchema.find((d) => d.key === view.groupBy) : undefined
  const isMulti = groupByDef ? isMultiValueType(groupByDef.type) : false

  const displayPropDefs = useMemo(
    () => resolveDisplayProps(propertySchema, view, titleKey),
    [propertySchema, view, titleKey],
  )

  const showGroupHeader = !!view.groupBy

  // 그룹 키 → 표시 라벨·색 맵핑(select/multi_select 옵션 라벨·색 해석).
  const { groupLabelMap, groupColorMap } = useMemo(() => {
    const labelMap = new Map<string, string>()
    const colorMap = new Map<string, string>()
    if (!view.groupBy || !groupByDef) return { groupLabelMap: labelMap, groupColorMap: colorMap }
    if (isOptionBackedType(groupByDef.type)) {
      const opts = normalizeOptions(groupByDef.options)
      for (const opt of opts) {
        labelMap.set(opt.value, opt.label ?? opt.value)
        if (opt.color) colorMap.set(opt.value, opt.color)
      }
    }
    return { groupLabelMap: labelMap, groupColorMap: colorMap }
  }, [view.groupBy, groupByDef])

  const groups = useMemo(() => {
    const all: Row<Record<string, PropertyValue>>[] = records.map((r) => ({
      id: r.id,
      props: pack.readProperties(r.doc) as Record<string, PropertyValue>,
    }))
    return viewGroups(all, view, { multiGroup: isMulti, groupLabelMap })
  }, [records, pack, view, isMulti, groupLabelMap])

  if (groups.length === 0 || groups.every((g) => g.rows.length === 0)) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
        {c.noRecords}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <GallerySection
          key={group.key}
          groupKey={group.key}
          groupLabel={groupLabelMap.get(group.key) ?? group.key}
          groupColor={group.key !== GROUP_EMPTY ? groupColorMap.get(group.key) : undefined}
          rows={group.rows}
          view={view}
          titleKey={titleKey}
          displayPropDefs={displayPropDefs}
          schema={propertySchema}
          onOpen={onOpen}
          onDeleteRow={onDeleteRow}
          onCreate={onCreate}
          createLabel={createLabel}
          showGroupHeader={showGroupHeader}
        />
      ))}
    </div>
  )
}
