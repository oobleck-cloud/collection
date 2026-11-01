'use client'

import { useMemo, useState } from 'react'
import { Lock, Plus, cn } from '../kit'
import type {
  BlockPack,
  PropertyDef,
  PropertyValue,
  RelationProvider,
  TableRecord,
  ViewConfig,
} from '@oobleck/collection'
import { GROUP_EMPTY, resolveVisibleColumns, viewGroups, type Row } from '@oobleck/collection'
import type { QueryMode } from '@oobleck/collection'
import {
  isMultiValueType,
  isPersonType,
  normalizeOptions,
  resolveOptionColor,
  type OptionColor,
} from '@oobleck/collection'
import { resolveCardFormat } from '@oobleck/collection'
import {
  relationTableColumns,
  relationTableDef,
  relationTableRows,
  relationTableSource,
} from '@oobleck/collection'
import {
  RecordCard,
  cardBadgeOf,
  cardDisplayProps,
  isCoverUrl,
  propertyText,
  type CardMetric,
} from './record-card'
import { RelationTable } from './RelationTable'
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
// 조건부 서식: 표와 같은 view.conditionalFormats 를 카드에 입힌다(resolveCardFormat) — 표에서 칸이 칠해질 행은
// 보드에서 카드가 칠해진다. 열 머리는 그룹 속성의 선택지 색 점(표 셀 칩과 같은 색) + 이름 + 수.
//
// 표면 문법(2026-10-26, Atlassian elevation): 열은 테두리 없이 페이지보다 한 단 눌린 면(bg-canvas), 카드는 테두리 없이
// 그림자로 뜬 흰 면. 한 면에 테두리와 그림자를 같이 쓰지 않는다. 끌어다 놓을 열은 테두리 대신 옅은 주색 바탕으로 말한다.
// 빈 열 접기(view.collapseEmptyGroups): 카드 없는 열은 좁은 세로 띠(이름 + 0)로 — 카드를 끄는 동안에는 제 폭으로 펴져
// 놓을 자리가 된다.
//
// 카드 크기(view.cardSize): 보드는 열 폭이 곧 카드 폭이다 — S 240 · M 288(기본, 현행) · L 400px.
// 관계 표(view.relationTable): 카드 아래에 관계 속성이 가리키는 대상 레코드를 작은 표로(RelationTable). 대상의 칸은
// relations[target].records(호스트가 페이지 단위로 미리 읽어 둔 사본)에서 읽는다 — 카드마다 따로 묻지 않는다.
// 표가 그리는 관계 속성은 카드 속성 줄에서 뺀다(같은 것을 칩으로 또 말하지 않는다). 넓은 카드(L)와 함께 쓰는 것을 권한다.

export type BoardViewProps<P> = {
  records: TableRecord[]
  pack: BlockPack<P>
  view: ViewConfig
  schema?: PropertyDef[]
  /** 카드 열기 — 마우스로 열면 원본 이벤트를 함께 넘긴다(⌘/Ctrl·가운데 클릭 = 새 탭, ViewSurfaceProps.onOpen). */
  onOpen?: (id: string, event?: React.MouseEvent) => void
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
  /** 관계 provider 레지스트리 — 관계 표(view.relationTable)가 대상 레코드를 `records` 로 읽는다. */
  relations?: Record<string, RelationProvider>
  /**
   * 'server' 면 받은 행이 이미 서버에서 걸러져 왔다 — 필터·정렬을 다시 돌리지 않고 그대로 묶는다(표와 같은 계약).
   * 다시 돌리면 서버만 아는 열·상대 날짜(「지금」·「오늘」) 조건에서 카드가 전부 빠진다.
   */
  queryMode?: QueryMode
}

/** 카드 이름표 — 행의 다른 값이 이름표면 그 값(「희망」·「타업체 견적」), 아니면 cardLabel → label. */
function cardLabelOf(def: PropertyDef, props: Record<string, PropertyValue>): string {
  const fromRow = def.cardLabelKey ? props[def.cardLabelKey] : null
  if (typeof fromRow === 'string' && fromRow) return fromRow
  return def.cardLabel || def.label
}

/** 카드 크기 → 열 폭(정적 리터럴 — Tailwind 가 소스를 스캔한다). */
const COLUMN_WIDTH: Record<'S' | 'M' | 'L', string> = {
  S: 'w-60',
  M: 'w-72',
  L: 'w-100',
}

type GroupColumn = { key: string; label: string; color?: string }

/** 열 머리 색 점 — 선택지 색(표 셀 칩의 점과 같은 토큰). 정적 리터럴(Tailwind 스캔). */
const DOT_CLASS: Record<OptionColor, string> = {
  gray: 'bg-tag-gray-dot',
  red: 'bg-tag-red-dot',
  orange: 'bg-tag-orange-dot',
  green: 'bg-tag-green-dot',
  teal: 'bg-tag-teal-dot',
  blue: 'bg-tag-blue-dot',
  purple: 'bg-tag-purple-dot',
}

/** 열 머리 — 색 점(선택지 색이 정해진 열만) + 이름(14px 굵게) + 수(같은 크기, 흐리게). */
type BoardSegment = { kind: 'column'; col: GroupColumn } | { kind: 'rail'; cols: GroupColumn[] }

/** 열 순서를 지키며 접힌 열이 이웃하면 띠 하나로 묶는다 — 「진행 중」만 비면 그 자리에 띠, 「실패 · 대상 아님」은 한 띠. */
function boardSegments(
  cols: readonly GroupColumn[],
  collapsed: (col: GroupColumn) => boolean,
): BoardSegment[] {
  const out: BoardSegment[] = []
  for (const col of cols) {
    const last = out.at(-1)
    if (!collapsed(col)) out.push({ kind: 'column', col })
    else if (last?.kind === 'rail') last.cols.push(col)
    else out.push({ kind: 'rail', cols: [col] })
  }
  return out
}

function ColumnHeader({
  col,
  groupDef,
  count,
}: {
  col: GroupColumn
  groupDef: PropertyDef | undefined
  count: number
}) {
  // 묶은 속성을 손으로 고칠 수 없으면(「콜 기록으로 수정」) 열 머리에 자물쇠 — 카드를 다른 열로 옮기지 않는 까닭을 말한다.
  const lock = groupDef?.readOnlyReason ? (
    <span className="ml-auto inline-flex shrink-0" title={groupDef.readOnlyReason}>
      <Lock className="size-3 text-fg-muted" aria-label={groupDef.readOnlyReason} />
    </span>
  ) : null
  const dot =
    col.color && groupDef ? (
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          DOT_CLASS[resolveOptionColor(groupDef, col.key)],
        )}
      />
    ) : null
  return (
    <div className="flex min-w-0 items-center gap-2 px-1 py-0.5 text-sm">
      {dot}
      <span className="truncate font-semibold text-fg">{col.label}</span>
      <span className="tabular-nums text-fg-muted">{count}</span>
      {lock}
    </div>
  )
}

/**
 * 그룹 컬럼 키 목록 — select 면 옵션 순서로(빈 컬럼 포함), 그 외는 등장 순서.
 * 사람은 **값이 있는 사람만** 세운다(이름 오름차순) — 명단 전체를 세우면 빈 열이 계정 수만큼 생긴다.
 */
function resolveGroupColumns(
  def: PropertyDef | undefined,
  presentKeys: string[],
  locale: CollectionLocale,
): GroupColumn[] {
  const c = boardViewCopy(locale)
  if (def && isPersonType(def.type)) {
    const names = new Map(normalizeOptions(def.options).map((o) => [o.value, o.label ?? o.value]))
    const result: GroupColumn[] = presentKeys
      .filter((k) => k !== GROUP_EMPTY)
      .map((k) => ({ key: k, label: names.get(k) ?? k }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
    if (presentKeys.includes(GROUP_EMPTY)) result.push({ key: GROUP_EMPTY, label: c.groupNone })
    return result
  }
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
  relations,
  queryMode = 'client',
}: BoardViewProps<P>) {
  const locale = useCollectionLocale()
  const c = boardViewCopy(locale)
  const propertySchema = schema ?? pack.propertySchema
  const groupBy = view.groupBy
  const groupDef = useMemo(
    () => (groupBy ? propertySchema.find((d) => d.key === groupBy) : undefined),
    [propertySchema, groupBy],
  )
  const isMulti = groupDef ? isMultiValueType(groupDef.type) : false
  const cardProps = useMemo(
    () => resolveVisibleColumns(propertySchema, view),
    [propertySchema, view],
  )
  const titleKey = cardProps[0]?.key
  // 관계 표 — 관계 속성 · 대상 읽기 창구 · 열. 셋 중 하나라도 없으면 표 없는 카드(현행).
  const relationTable = view.relationTable
  const tableDef = useMemo(
    () => relationTableDef(propertySchema, relationTable),
    [propertySchema, relationTable],
  )
  const tableSource = relationTableSource(tableDef, relations)
  const tableColumns = useMemo(
    () => (tableSource ? relationTableColumns(tableSource, relationTable?.columns) : []),
    [tableSource, relationTable?.columns],
  )
  const tableKey = tableSource && tableColumns.length > 0 ? tableDef?.key : undefined
  // 카드 짜임 — 보이는 속성 중 배지 · 숫자 띠 자리에 설 것(보이지 않는 속성은 세우지 않는다).
  const cardLayout = view.cardLayout
  const badgeDef = useMemo(
    () =>
      cardLayout?.badgeKey && cardLayout.badgeKey !== titleKey
        ? cardProps.find((p) => p.key === cardLayout.badgeKey)
        : undefined,
    [cardProps, cardLayout?.badgeKey, titleKey],
  )
  const metricDefs = useMemo(
    () =>
      (cardLayout?.metrics ?? []).flatMap((k) => {
        const def = k !== titleKey ? cardProps.find((p) => p.key === k) : undefined
        return def ? [def] : []
      }),
    [cardProps, cardLayout?.metrics, titleKey],
  )
  const nonTitleProps = useMemo(() => {
    const placed = new Set([badgeDef?.key, ...metricDefs.map((d) => d.key)])
    return cardProps.filter(
      (p) =>
        p.key !== titleKey &&
        p.key !== groupBy &&
        p.key !== view.coverKey &&
        p.key !== tableKey &&
        !placed.has(p.key),
    )
  }, [cardProps, titleKey, groupBy, view.coverKey, tableKey, badgeDef, metricDefs])
  // 카드에 보이는 속성 — 조건부 서식은 이 속성을 근거로 한 것만 카드를 칠한다(근거가 안 보이는 색은 읽을 수 없다).
  const cardKeys = useMemo(
    () => [
      ...(titleKey ? [titleKey] : []),
      ...nonTitleProps.map((p) => p.key),
      ...(badgeDef ? [badgeDef.key] : []),
      ...metricDefs.map((d) => d.key),
    ],
    [titleKey, nonTitleProps, badgeDef, metricDefs],
  )
  // 배지 · 숫자 띠 칸은 제 색으로 말한다 — 그 속성을 대상으로 한 서식은 카드 바탕을 칠하지 않는다.
  const selfColoredKeys = useMemo(
    () => [...(badgeDef ? [badgeDef.key] : []), ...metricDefs.map((d) => d.key)],
    [badgeDef, metricDefs],
  )

  // 레코드 → 속성 추출, 코어 viewGroups(filter→sort→group, multi_select fan-out 포함)로 그룹화.
  // 그룹핑 단일 진실원천(#16-2): BoardView 는 자체 bucketing 을 재구현하지 않고 코어를 소비한다.
  const { rowsByGroup, presentKeys } = useMemo(() => {
    const all: Row<Record<string, PropertyValue>>[] = records.map((r) => ({
      id: r.id,
      props: pack.readProperties(r.doc) as unknown as Record<string, PropertyValue>,
    }))
    const groups = viewGroups(all, view, {
      multiGroup: isMulti,
      preFiltered: queryMode === 'server',
    })
    const bucket = new Map<string, Row<Record<string, PropertyValue>>[]>()
    const seen: string[] = []
    for (const g of groups) {
      bucket.set(g.key, g.rows)
      seen.push(g.key)
    }
    return { rowsByGroup: bucket, presentKeys: seen }
  }, [records, pack, view, isMulti, queryMode])

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
  // 묶은 속성을 손으로 고칠 수 없다고 호스트가 까닭을 달았으면(readOnlyReason — 콜 기록으로만 고치는 커스텀 속성) 카드를 다른 열로
  // 옮기지 않는다. 옮기면 그 값을 고치는 쓰기가 나가는데, 그 쓰기는 거절된다. 같은 열 안의 순서는 보기 설정이라 그대로 끈다.
  // (source 로 가르지 않는다 — projection 속성으로 묶고 끌기를 호스트가 받아 주는 보드가 있다.)
  const canMoveAcross = !groupDef?.readOnlyReason

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
    if (!canMoveAcross && colKey !== drag.fromCol) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overCol !== colKey) setOverCol(colKey)
  }
  const handleCardDragOver = (cardId: string, colKey: string) => (e: React.DragEvent) => {
    if (!canDrag || !drag) return
    if (!canMoveAcross && colKey !== drag.fromCol) return
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
    if (!fromSameCol && !canMoveAcross) {
      setDrag(null)
      setOverCol(null)
      setOverCard(null)
      return
    }
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

  const dropHandlersOf = (colKey: string) => ({
    onDragOver: handleColDragOver(colKey),
    onDragLeave: () => setOverCol((prev) => (prev === colKey ? null : prev)),
    onDrop: handleDrop(colKey),
  })
  // 빈 열 접기 — 끄는 중이 아니면 이웃한 빈 열들을 띠 하나에 「이름 0」 줄로 쌓는다(글자를 세로로 세우면 한 자씩 끊겨 읽히지 않는다).
  // 끄는 동안엔 제 폭으로 펴서 카드를 놓을 수 있게 한다.
  const segments = boardSegments(
    groupColumns,
    (col) =>
      Boolean(view.collapseEmptyGroups) &&
      !drag &&
      (orderedByGroup.get(col.key) ?? []).length === 0,
  )

  return (
    <div className="flex items-start gap-3 overflow-x-auto pb-2">
      {segments.map((segment) => {
        if (segment.kind === 'rail') {
          return (
            <div
              key={`rail:${segment.cols[0]!.key}`}
              data-board-rail=""
              className="flex w-28 shrink-0 flex-col gap-1 rounded-lg bg-canvas p-2"
            >
              {segment.cols.map((col) => (
                <div
                  key={col.key}
                  data-board-column={col.key}
                  data-collapsed=""
                  {...dropHandlersOf(col.key)}
                >
                  <ColumnHeader col={col} groupDef={groupDef} count={0} />
                </div>
              ))}
            </div>
          )
        }
        const col = segment.col
        const groupRows = orderedByGroup.get(col.key) ?? []
        const isOver = overCol === col.key
        const dropHandlers = dropHandlersOf(col.key)
        return (
          <div
            key={col.key}
            data-board-column={col.key}
            {...dropHandlers}
            className={cn(
              'flex shrink-0 flex-col gap-2 rounded-lg bg-canvas p-2 transition-colors',
              COLUMN_WIDTH[view.cardSize ?? 'M'],
              isOver && 'bg-brand-50',
            )}
          >
            <ColumnHeader col={col} groupDef={groupDef} count={groupRows.length} />
            <div className="flex flex-col gap-2">
              {groupRows.map((row) => {
                const titleValue = titleKey ? row.props[titleKey] : null
                const titleText = formatTitleText(titleValue ?? null)
                const format = resolveCardFormat(
                  view.conditionalFormats,
                  row.props,
                  cardKeys,
                  selfColoredKeys,
                )
                const displayProps = cardDisplayProps(
                  nonTitleProps,
                  row.props,
                  propertySchema,
                  format.byKey,
                )
                const badge = badgeDef
                  ? cardBadgeOf(
                      badgeDef,
                      row.props[badgeDef.key] ?? null,
                      format.byKey[badgeDef.key],
                    )
                  : null
                const metrics: CardMetric[] = metricDefs.map((def) => {
                  const style = format.byKey[def.key]
                  return {
                    key: def.key,
                    label: cardLabelOf(def, row.props),
                    text: propertyText(def, row.props[def.key] ?? null) ?? '',
                    ...(style ? { format: style } : {}),
                  }
                })
                const coverVal = view.coverKey ? row.props[view.coverKey] : null
                const cover = isCoverUrl(coverVal) ? coverVal : null
                const isDragging = drag?.id === row.id
                const block =
                  tableKey && tableSource ? (
                    <RelationTable
                      recordId={row.id}
                      rows={relationTableRows(tableSource, row.props[tableKey])}
                      columns={tableColumns}
                      maxRows={relationTable?.maxRows}
                      actions={tableSource.rowActions}
                      countUnit={tableSource.countUnit}
                      variant={relationTable?.variant}
                      collapsed={relationTable?.collapsed}
                      label={tableDef?.label}
                    />
                  ) : null
                return (
                  <RecordCard
                    key={row.id}
                    cover={cover}
                    title={titleText}
                    displayProps={displayProps}
                    format={format.card}
                    labels={view.cardPropLabels ?? false}
                    onOpen={onOpen ? (e) => onOpen(row.id, e) : undefined}
                    onDelete={onDeleteRow ? () => onDeleteRow(row.id) : undefined}
                    block={block}
                    badge={badge}
                    metrics={metrics}
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
                <div className="px-2 py-3 text-center text-xs text-fg-muted">{c.empty}</div>
              )}
            </div>
            {onCreate && (
              <button
                type="button"
                onClick={() => void onCreate()}
                className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-container-high hover:text-fg"
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
