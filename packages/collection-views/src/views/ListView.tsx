'use client'

import { type FC, useMemo } from 'react'
import { Button, Plus } from '@oobleck/systheme'
import type { ButtonValue, PropertyDef, PropertyValue, ViewConfig } from '@oobleck/collection'
import { GROUP_EMPTY, isButtonValue, resolveTitleKey, viewGroups, type Row } from '@oobleck/collection'
import { normalizeOptions, isMultiValueType, isOptionBackedType } from '@oobleck/collection'
import { openClickHandlers } from './open-click'
import { PropertyChip } from './record-card'
import { RowActionMenu } from './row-action-menu'
import { formatTitleText } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { listViewCopy } from './ListView.messages'
import type { ViewSurfaceProps } from './ViewSurface'

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

// @oobleck/collection — 리스트 뷰 렌더러(WAVE2/레인G, ViewConfig.type='list').
//
// 리스트 = 미니멀 행(제목 + 소수 표시 프로퍼티, 컬럼 헤더 없음). Anatomy §5.4.
// groupBy 있으면 viewGroups 로 섹션 분할. 클릭 = onOpen.
// 표 뷰의 컬럼 헤더·인라인 편집·드래그 기능은 없다 — 리스트는 인덱스/문서 목록용.

// ─── 내부 헬퍼 ───────────────────────────────────────────────────────────────────

/**
 * 행에 표시할 보조 속성 — visibleProps 있으면 그 순서, 없으면 schema 전체.
 * titleKey·coverKey·groupBy 제외(제목은 별도 표시, groupBy 는 그룹 헤더로 이미 보임 → 행에서 중복 제거).
 * 갤러리(resolveDisplayProps)·보드와 동일 제외 규칙.
 */
function resolveRowProps(
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

// ─── 단일 행 ─────────────────────────────────────────────────────────────────────

type ListRowProps = {
  row: Row<Record<string, PropertyValue>>
  titleKey: string | undefined
  rowPropDefs: PropertyDef[]
  /** 행 열기 — 마우스로 열면 원본 이벤트를 함께 넘긴다(⌘/Ctrl·가운데 클릭 = 새 탭). */
  onOpen?: (id: string, event?: React.MouseEvent) => void
  /** 버튼 프로퍼티(type='button') 클릭 — (rowId, action). 미지정 시 버튼 비활성. */
  onAction?: (id: string, action: string) => void
  /** 행 삭제(→휴지통) — 지정 시 행 우측 hover 케밥에 "삭제" 노출. 실행은 호스트(순수 콜백). */
  onDeleteRow?: (id: string) => void
}

function ListRow({ row, titleKey, rowPropDefs, onOpen, onAction, onDeleteRow }: ListRowProps) {
  const c = listViewCopy(useCollectionLocale())
  const titleValue = titleKey ? row.props[titleKey] : null
  const titleText = formatTitleText(titleValue ?? null)

  const visibleProps = rowPropDefs
    .filter((def) => def.type !== 'button')
    .map((def) => ({ def, value: row.props[def.key] ?? null }))
    .filter(({ value }) => value !== null && value !== '')

  // 버튼 프로퍼티 = 행 우측 액션(칩과 별도) — ButtonValue 만 렌더(값 없으면 미표시). 클릭은 행 열기로
  // 전파되지 않게 stopPropagation(행 전체가 onOpen 클릭 타깃이므로).
  const actionProps = rowPropDefs
    .filter((def) => def.type === 'button')
    .map((def) => ({ def, value: row.props[def.key] ?? null }))
    .filter((p): p is { def: PropertyDef; value: ButtonValue } => isButtonValue(p.value))

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      {...openClickHandlers(onOpen ? (e) => onOpen(row.id, e) : undefined)}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpen(row.id)
              }
            }
          : undefined
      }
      className="group/listrow flex cursor-pointer items-center gap-3 border-b border-border/60 px-2 py-2 transition-colors hover:bg-surface/60"
    >
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
        {titleText || c.titleNone}
      </span>
      {visibleProps.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {visibleProps.slice(0, 4).map(({ def, value }) => (
            <PropertyChip key={def.key} def={def} value={value} />
          ))}
          {visibleProps.length > 4 && (
            <span className="text-[11px] text-fg-muted">+{visibleProps.length - 4}</span>
          )}
        </div>
      )}
      {actionProps.length > 0 && (
        <div className="flex shrink-0 items-center gap-1.5">
          {actionProps.map(({ def, value }) => (
            <Button
              key={def.key}
              variant={value.variant ?? 'outline'}
              size="sm"
              disabled={value.disabled === true || !onAction}
              onClick={(e) => {
                e.stopPropagation()
                onAction?.(row.id, value.action)
              }}
            >
              {value.label}
            </Button>
          ))}
        </div>
      )}
      {onDeleteRow && (
        <RowActionMenu
          onDelete={() => onDeleteRow(row.id)}
          triggerClassName="group-hover/listrow:opacity-100"
        />
      )}
    </div>
  )
}

// ─── ListView ────────────────────────────────────────────────────────────────────

/**
 * ListView — 미니멀 행 목록 뷰(ViewConfig.type='list'). Anatomy §5.4.
 *
 * - 컬럼 헤더 없음, 구분선만(노션 리스트 동형).
 * - 각 행 = 제목 + 소수 표시 프로퍼티 칩(최대 4개 + 오버플로).
 * - groupBy 있으면 코어 viewGroups 로 섹션 분할.
 * - 드래그·인라인 편집 없음. 클릭 = onOpen.
 */
export const ListView: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  onOpen,
  onAction,
  onDeleteRow,
  onCreate,
  createLabel,
}) => {
  const c = listViewCopy(useCollectionLocale())
  const propertySchema = schema ?? pack.propertySchema
  // 제목 = visibleProps 의 첫 컬럼(board 와 동일 규칙). schema[0] 직접 사용 금지(상품 schema[0]=status).
  const titleKey = resolveTitleKey(propertySchema, view)
  const groupByDef = view.groupBy ? propertySchema.find((d) => d.key === view.groupBy) : undefined
  const isMulti = groupByDef ? isMultiValueType(groupByDef.type) : false

  const rowPropDefs = useMemo(
    () => resolveRowProps(propertySchema, view, titleKey),
    [propertySchema, view, titleKey],
  )

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

  const showGroupHeader = !!view.groupBy

  if (groups.length === 0 || groups.every((g) => g.rows.length === 0)) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
        {c.noRecords}
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {groups.map((group) => {
        const groupColor = group.key !== GROUP_EMPTY ? groupColorMap.get(group.key) : undefined
        const swatchClass = groupColor
          ? (TAG_SWATCH_CLASS[groupColor] ?? 'bg-neutral-400')
          : 'bg-neutral-300'
        return (
          <div key={group.key} className="flex flex-col">
            {showGroupHeader && (
              <div className="flex items-center gap-2 bg-surface/40 px-2 py-1.5">
                <span
                  className={`size-2 shrink-0 rounded-full ${swatchClass}`}
                  aria-hidden
                  data-testid="group-color-swatch"
                />
                <span className="text-xs font-semibold text-fg">
                  {group.key === GROUP_EMPTY
                    ? c.groupNone
                    : (groupLabelMap.get(group.key) ?? group.key)}
                </span>
                <span className="text-[11px] text-fg-muted">{group.rows.length}</span>
              </div>
            )}
            {group.rows.map((row) => (
              <ListRow
                key={row.id}
                row={row}
                titleKey={titleKey}
                rowPropDefs={rowPropDefs}
                onOpen={onOpen}
                onAction={onAction}
                onDeleteRow={onDeleteRow}
              />
            ))}
          </div>
        )
      })}
      {onCreate && (
        <button
          type="button"
          onClick={() => void onCreate()}
          className="inline-flex items-center gap-1 border-b border-border/60 px-2 py-2 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
        >
          <Plus className="size-3.5" aria-hidden />
          {createLabel ?? c.newItem}
        </button>
      )}
    </div>
  )
}
