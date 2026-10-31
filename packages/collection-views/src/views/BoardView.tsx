'use client'

import { useMemo, useState } from 'react'
import { Badge, Plus, cn } from '@oobleck/systheme'
import type { BlockPack, PropertyDef, PropertyValue, TableRecord, ViewConfig } from '@oobleck/collection'
import { GROUP_EMPTY, resolveVisibleColumns, viewGroups, type Row } from '@oobleck/collection'
import { normalizeOptions } from '@oobleck/collection'
import { RecordCard, isCoverUrl } from './record-card'
import { formatTitleText } from '@oobleck/collection'
import { useCollectionLocale, type CollectionLocale } from '../i18n'
import { boardViewCopy } from './BoardView.messages'

// @oobleck/collection — 보드(칸반) 뷰 렌더러(D-8 §6, ViewConfig.type='board'). 노션 보드 동형.
//
// 그룹 모드:
//  - groupBy 가 select: 한 카드가 한 컬럼에만 등장(값 = 컬럼 key).
//  - groupBy 가 multi_select: 카드의 각 태그마다 한 컬럼에 등장(같은 카드가 N 컬럼에 노출).
//  - 빈 값: GROUP_EMPTY 컬럼.
//
// 드래그-드롭(HTML5 native):
//  - 단일(select): 카드를 다른 컬럼으로 드롭 = 그 컬럼 값으로 교체(onEdit).
//  - 다중(multi_select): 카드를 다른 컬럼으로 드롭 = 그 컬럼 값을 *추가*(중복 없게). 노션 동일.
//      (제거는 카드의 multi 셀 X 로. 보드 드래그가 제거에 모호한 의미가 되지 않게.)
//  - 같은 컬럼 내 드롭(다른 카드 위): cardOrder 갱신(노션식 수동 정렬 영속).
//
// 카드 커버: view.coverKey 의 속성값이 url 처럼 보이면 카드 상단에 배경 이미지로(노션 동일).
// 카드 렌더: RecordCard 프리미티브를 소비(갤러리/리스트와 공유 — record-card.tsx).

export type BoardViewProps<P> = {
  records: TableRecord[]
  pack: BlockPack<P>
  view: ViewConfig
  schema?: PropertyDef[]
  onOpen?: (id: string) => void
  /** 카드(=행) 삭제(→휴지통) — 지정 시 카드 우상단 hover 케밥에 "삭제" 노출. 실행은 호스트(순수 콜백). */
  onDeleteRow?: (id: string) => void
  /**
   * 그룹 값 변경(드래그-드롭) — groupBy 키의 값을 새 컬럼 값으로 역기록.
   * 미지정 시 컬럼 간 이동 비활성.
   */
  onEdit?: (id: string, key: string, value: PropertyValue) => void
  /** 새 카드 생성(컬럼 푸터 "+ 새 카드"). 미지정 시 affordance 비표시. */
  onCreate?: () => void | Promise<void>
  /**
   * 카드 수동 정렬 영속 — 한 컬럼 내 드래그-드롭으로 순서가 바뀔 때 호출.
   * 인자: 그룹 키(컬럼 값 또는 GROUP_EMPTY), 새 카드 id 순서. 호스트는 view.cardOrder[groupKey] 에 영속.
   */
  onCardOrderChange?: (groupKey: string, orderedIds: string[]) => void
}

type GroupColumn = { key: string; label: string; color?: string }

/** 그룹 컬럼 키 목록 — select 면 옵션 순서로(빈 컬럼 포함), 그 외는 등장 순서. */
function resolveGroupColumns(
  def: PropertyDef | undefined,
  presentKeys: string[],
  locale: CollectionLocale,
): GroupColumn[] {
  const c = boardViewCopy(locale)
  if (def?.type === 'select' || def?.type === 'multi_select') {
    const opts = normalizeOptions(def.options)
    const result: GroupColumn[] = opts.map((o) => ({
      key: o.value,
      label: o.label ?? o.value,
      ...(o.color !== undefined ? { color: o.color } : {}),
    }))
    const defined = new Set(opts.map((o) => o.value))
    for (const k of presentKeys) {
      if (k === GROUP_EMPTY) continue
      if (!defined.has(k)) result.push({ key: k, label: k })
    }
    if (presentKeys.includes(GROUP_EMPTY)) {
      result.push({ key: GROUP_EMPTY, label: c.groupNone })
    }
    return result
  }
  const result: GroupColumn[] = []
  for (const k of presentKeys) {
    if (k === GROUP_EMPTY) continue
    result.push({ key: k, label: k })
  }
  if (presentKeys.includes(GROUP_EMPTY)) result.push({ key: GROUP_EMPTY, label: c.groupNone })
  return result
}

/** 컬럼 내 카드 정렬 — view.cardOrder[colKey] 가 있으면 그 순서로, 미등록 카드는 끝에. */
function applyCardOrder<P>(rows: Row<P>[], order: string[] | undefined): Row<P>[] {
  if (!order || order.length === 0) return rows
  const rank = new Map<string, number>()
  order.forEach((id, i) => rank.set(id, i))
  const unranked = order.length
  return [...rows].sort((a, b) => (rank.get(a.id) ?? unranked) - (rank.get(b.id) ?? unranked))
}

export function BoardView<P>({
  records,
  pack,
  view,
  schema,
  onOpen,
  onDeleteRow,
  onEdit,
  onCreate,
  onCardOrderChange,
}: BoardViewProps<P>) {
  const locale = useCollectionLocale()
  const c = boardViewCopy(locale)
  const propertySchema = schema ?? pack.propertySchema
  const groupBy = view.groupBy
  const groupDef = useMemo(
    () => (groupBy ? propertySchema.find((d) => d.key === groupBy) : undefined),
    [propertySchema, groupBy],
  )
  const isMulti = groupDef?.type === 'multi_select'
  const cardProps = useMemo(
    () => resolveVisibleColumns(propertySchema, view),
    [propertySchema, view],
  )
  const titleKey = cardProps[0]?.key
  const nonTitleProps = useMemo(
    () =>
      cardProps.filter((p) => p.key !== titleKey && p.key !== groupBy && p.key !== view.coverKey),
    [cardProps, titleKey, groupBy, view.coverKey],
  )

  // 레코드 → 속성 추출, 코어 viewGroups(filter→sort→group, multi_select fan-out 포함)로 그룹화.
  // 그룹핑 단일 진실원천(#16-2): BoardView 는 자체 bucketing 을 재구현하지 않고 코어를 소비한다.
  const { rowsByGroup, presentKeys } = useMemo(() => {
    const all: Row<Record<string, PropertyValue>>[] = records.map((r) => ({
      id: r.id,
      props: pack.readProperties(r.doc) as unknown as Record<string, PropertyValue>,
    }))
    const groups = viewGroups(all, view, { multiGroup: isMulti })
    const bucket = new Map<string, Row<Record<string, PropertyValue>>[]>()
    const seen: string[] = []
    for (const g of groups) {
      bucket.set(g.key, g.rows)
      seen.push(g.key)
    }
    return { rowsByGroup: bucket, presentKeys: seen }
  }, [records, pack, view, isMulti])

  const groupColumns = useMemo(() => {
    const all = resolveGroupColumns(groupDef, presentKeys, locale)
    if (view.hideEmptyGroups) {
      // 빈 컬럼(카드 0)을 숨긴다. GROUP_EMPTY(미분류) 컬럼도 동일 규칙으로 처리.
      return all.filter((col) => (rowsByGroup.get(col.key)?.length ?? 0) > 0)
    }
    return all
  }, [groupDef, presentKeys, view.hideEmptyGroups, rowsByGroup, locale])

  // 컬럼 내 카드 순서 적용(view.cardOrder).
  const orderedByGroup = useMemo(() => {
    const map = new Map<string, Row<Record<string, PropertyValue>>[]>()
    for (const [k, rs] of rowsByGroup.entries()) {
      map.set(k, applyCardOrder(rs, view.cardOrder?.[k]))
    }
    return map
  }, [rowsByGroup, view.cardOrder])

  // 드래그 상태 — 드래그 중인 카드의 id + 어느 컬럼에서 시작했는지 + 어디 위에 있는지.
  const [drag, setDrag] = useState<{ id: string; fromCol: string } | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [overCard, setOverCard] = useState<string | null>(null)

  const canDrag = !!groupBy && !!onEdit

  const handleDragStart = (id: string, fromCol: string) => (e: React.DragEvent) => {
    if (!canDrag) return
    e.dataTransfer.setData('text/montize-card-id', id)
    e.dataTransfer.effectAllowed = 'move'
    setDrag({ id, fromCol })
  }
  const handleDragEnd = () => {
    setDrag(null)
    setOverCol(null)
    setOverCard(null)
  }
  const handleColDragOver = (colKey: string) => (e: React.DragEvent) => {
    if (!canDrag || !drag) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overCol !== colKey) setOverCol(colKey)
  }
  const handleCardDragOver = (cardId: string, colKey: string) => (e: React.DragEvent) => {
    if (!canDrag || !drag) return
    e.preventDefault()
    e.stopPropagation()
    if (overCol !== colKey) setOverCol(colKey)
    if (overCard !== cardId) setOverCard(cardId)
  }

  /** 컬럼 내 새 순서 계산 — drag 카드가 toCol 의 어느 위치(targetCardId 위)로 가는지. */
  const computeNewOrder = (
    colKey: string,
    targetCardId: string | null,
    fromSameCol: boolean,
  ): string[] => {
    const current = (orderedByGroup.get(colKey) ?? []).map((r) => r.id)
    if (!drag) return current
    const without = fromSameCol ? current.filter((id) => id !== drag.id) : current
    const insertIdx = targetCardId ? without.indexOf(targetCardId) : without.length // 컬럼 빈 영역에 drop → 맨 끝
    const at = insertIdx === -1 ? without.length : insertIdx
    return [...without.slice(0, at), drag.id, ...without.slice(at)]
  }

  const handleDrop = (colKey: string) => (e: React.DragEvent) => {
    if (!canDrag || !drag || !groupBy || !onEdit) return
    e.preventDefault()
    e.stopPropagation()
    const id = drag.id
    const fromCol = drag.fromCol
    const fromSameCol = fromCol === colKey
    const targetCardId = overCard

    // 1) 그룹 값 갱신(컬럼 이동인 경우만). 단일/다중에 따라 정책 다름.
    if (!fromSameCol) {
      const record = records.find((r) => r.id === id)
      if (record) {
        const current = pack.readProperties(record.doc) as unknown as Record<string, PropertyValue>
        const cur = current[groupBy]
        if (isMulti) {
          // multi: 타겟 값 추가(중복 회피, 빈 컬럼이면 제거 → null).
          const arr = Array.isArray(cur) ? cur.map(String) : []
          if (colKey === GROUP_EMPTY) {
            // 다중에서 "없음" 으로 드롭 = 모든 태그 제거(노션 동일).
            onEdit(id, groupBy, null)
          } else if (!arr.includes(colKey)) {
            onEdit(id, groupBy, [...arr, colKey])
          }
        } else {
          // single: 교체. 빈 컬럼은 null.
          onEdit(id, groupBy, colKey === GROUP_EMPTY ? null : colKey)
        }
      }
    }

    // 2) 컬럼 내 순서 영속(같은 컬럼 reorder 또는 cross-column 이동의 도착 컬럼).
    if (onCardOrderChange) {
      const order = computeNewOrder(colKey, targetCardId, fromSameCol)
      onCardOrderChange(colKey, order)
      // cross-column: 출발 컬럼에서도 빼주기(다음 렌더에서 보이지 않게).
      if (!fromSameCol) {
        const fromCurrent = (orderedByGroup.get(fromCol) ?? [])
          .map((r) => r.id)
          .filter((x) => x !== id)
        onCardOrderChange(fromCol, fromCurrent)
      }
    }

    setDrag(null)
    setOverCol(null)
    setOverCard(null)
  }

  if (!groupBy) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
        {c.pickGroup}
      </div>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {groupColumns.map((col) => {
        const groupRows = orderedByGroup.get(col.key) ?? []
        const isOver = overCol === col.key
        return (
          <div
            key={col.key}
            onDragOver={handleColDragOver(col.key)}
            onDragLeave={() => setOverCol((prev) => (prev === col.key ? null : prev))}
            onDrop={handleDrop(col.key)}
            className={cn(
              'flex w-72 shrink-0 flex-col gap-2 rounded-md border border-border bg-surface/40 p-2 transition-colors',
              isOver && 'border-primary bg-primary/5',
            )}
          >
            <div className="flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-1.5">
                {col.color ? (
                  <Badge variant="default" size="sm">
                    {col.label}
                  </Badge>
                ) : (
                  <span className="text-xs font-medium text-fg">{col.label}</span>
                )}
                <span className="text-[11px] text-fg-muted">{groupRows.length}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {groupRows.map((row) => {
                const titleValue = titleKey ? row.props[titleKey] : null
                const titleText = formatTitleText(titleValue ?? null)
                const displayProps = nonTitleProps.map((def) => ({
                  def,
                  value: row.props[def.key] ?? null,
                }))
                const coverVal = view.coverKey ? row.props[view.coverKey] : null
                const cover = isCoverUrl(coverVal) ? coverVal : null
                const isDragging = drag?.id === row.id
                return (
                  <RecordCard
                    key={row.id}
                    cover={cover}
                    title={titleText}
                    displayProps={displayProps}
                    onOpen={onOpen ? () => onOpen(row.id) : undefined}
                    onDelete={onDeleteRow ? () => onDeleteRow(row.id) : undefined}
                    draggable={canDrag}
                    isDragging={isDragging}
                    onDragStart={handleDragStart(row.id, col.key)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleCardDragOver(row.id, col.key)}
                    onDrop={handleDrop(col.key)}
                  />
                )
              })}
              {groupRows.length === 0 && (
                <div className="rounded-md border border-dashed border-border/60 px-2 py-3 text-center text-[11px] text-fg-muted">
                  {c.empty}
                </div>
              )}
            </div>
            {onCreate && (
              <button
                type="button"
                onClick={() => void onCreate()}
                className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
              >
                <Plus className="size-3.5" aria-hidden />
                {c.newCard}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
