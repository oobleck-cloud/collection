'use client'

// @oobleck/collection — 관계 표(카드·문서 안 블록). 순수 규칙은 ../relation-table.ts.
//
// 한 레코드가 관계로 가리키는 대상 레코드들을 작은 표로 보인다 — 보드 카드 아래(compact), 레코드 문서 안(default).
// 도메인을 모른다: 열은 대상 스키마의 PropertyDef(셀은 `render` → 타입별 글자/칩 순), 줄 동작은 호스트가 단 버튼이다.
//
// 표 문법(시안 「관계 표」): 회색 머리 줄 · 줄 사이 가는 선 · 첫 열이 남은 폭을 갖고 말줄임, 나머지 열은 내용 폭.
// 넘치는 줄은 「+ N개 더 · 다음 줄 요약」 한 줄로 접는다(카드가 줄 수만큼 길어지지 않게).
// 카드 안에 놓이므로 버튼 클릭은 카드 열기로 새지 않는다(stopPropagation) — 카드 케밥(⋯)과 같은 규칙.
//
// 모양 두 가지(variant):
//  - 'table'(기본): 위 표 문법 그대로.
//  - 'list': 머리 줄 · 바깥 테두리 · 줄 사이 선이 없다. 카드가 이미 그림자로 뜬 면이라 선을 더 긋지 않는다(2026-10-26).
//    줄은 32px · 줄 사이 10px, 수는 오른쪽 맞춤 고정폭 숫자. 첫 줄 동작은 채운 버튼(가장 먼저 할 일), 나머지는 회색 버튼.
//    「+ N개 더」는 글자 링크 모양 한 줄 — 누르면 그 자리에서 나머지 줄을 편다.
//  - 'rows': 상자 · 줄 사이 선 없는 줄 목록(상세 칸 시스템 DetailList — 구분은 여백, 줄 사이 12px). 버튼이 없다 —
//    **줄 전체가 첫 동작의 입구**이고 끝의 「›」와 머리말(「견적 4곳 · 눌러서 네고 콜」)이 누를 수 있다고 말한다
//    (2026-10-29 조율 보드 시안 C). 줄마다 버튼이 서면 카드가 버튼 기둥이 되고, 상자를 두르면 카드 안에 박스가 겹쳐 무겁다.
//    올리면 옅은 바탕. 「+ N개 더」는 흐린 글자 한 줄 — 누르면 그 자리에서 편다. 수 아닌 열도 오른쪽 맞춤 · 최소 폭.
// 접어 두기(collapsed): 처음엔 「견적 3곳 보기」 한 줄만, 누르면 그 자리에서 편다(카드는 열리지 않는다).

import { Button, ChevronRight, cn } from '@oobleck/systheme'
import { useState } from 'react'

import { useCollectionLocale } from '../i18n'
import { relationTableSlice } from '@oobleck/collection'

import { PropertyChip, propertyText } from './record-card'
import { relationTableCopy } from './RelationTable.messages'

import type { PropertyDef, RelatedRecordRow, RelatedRowAction } from '@oobleck/collection'
import type { ReactNode } from 'react'

export type RelationTableDensity = 'compact' | 'default'
export type RelationTableVariant = 'table' | 'list' | 'rows'

export type RelationTableProps = {
  /** 부모 레코드 id — 줄 동작에 함께 넘긴다. */
  recordId: string
  /** 대상 레코드 줄(이미 정렬된 순서). */
  rows: readonly RelatedRecordRow[]
  /** 표 열(대상 속성) — relationTableColumns 로 고른 것. */
  columns: readonly PropertyDef[]
  /** 보일 최대 줄 수. 미지정 = 기본(3). 접은 줄은 「+ N개 더」. */
  maxRows?: number
  /** 줄 동작 버튼(호스트). */
  actions?: readonly RelatedRowAction[]
  /** 「+ N곳 더」의 셈 단위. 미지정 = 로캘 기본. */
  countUnit?: string
  /** compact = 카드 안(12px · 좁은 여백), default = 문서 안(14px). 기본 compact. */
  density?: RelationTableDensity
  /** 줄이 없을 때의 한 줄. 미지정이면 표를 그리지 않는다(카드에 빈 표를 세우지 않는다). */
  emptyLabel?: string
  /** 'table'(기본 — 머리 줄 · 줄 사이 선) | 'list'(선 없는 목록 줄) | 'rows'(상자 안 줄, 줄 전체가 첫 동작). */
  variant?: RelationTableVariant
  /** true 면 처음엔 「{label} N{unit} 보기」 한 줄로 접어 두고 누르면 편다. 기본 false. */
  collapsed?: boolean
  /** 접힌 줄의 이름(관계 속성 라벨 — 「견적」). 미지정이면 수만 말한다. */
  label?: string
  className?: string
}

/** 셀 하나 — 코드 소유 `render` 가 먼저, 아니면 타입별 글자(날짜·전화·format), 칩 타입(선택지·사람)은 칩. */
function cellNode(def: PropertyDef, row: RelatedRecordRow): ReactNode {
  const value = row.props[def.key] ?? null
  if (def.render) return def.render(value, { id: row.id, props: row.props, def })
  const text = propertyText(def, value)
  if (text === null) return <PropertyChip def={def} value={value} />
  return text || <span className="text-fg-muted">—</span>
}

/** 접은 줄 요약에 쓸 평문 — CSV 와 같은 `exportText` 가 먼저, 아니면 타입별 글자. */
function cellText(def: PropertyDef, row: RelatedRecordRow): string {
  const value = row.props[def.key] ?? null
  if (def.exportText) return def.exportText(value, row.props)
  return propertyText(def, value) ?? (typeof value === 'string' ? value : '')
}

/** 줄 동작 버튼들 — 보일 줄에만. 카드(부모) 열기로 새지 않게 클릭·키 전파를 막는다(줄 동작은 카드 클릭과 독립). */
function RowActions({
  recordId,
  row,
  actions,
  tone = 'ghost',
}: {
  recordId: string
  row: RelatedRecordRow
  actions: readonly RelatedRowAction[]
  /** 버튼 모양 — 표는 ghost(24px), 목록은 첫 줄 primary · 나머지 secondary(28px). */
  tone?: 'ghost' | 'primary' | 'secondary'
}) {
  return (
    <span className="inline-flex justify-end gap-1">
      {actions
        .filter((a) => a.visible?.(row) ?? true)
        .map((a) => (
          <Button
            key={a.id}
            type="button"
            variant={tone}
            size="sm"
            density="compact"
            className={tone === 'ghost' ? 'h-6' : undefined}
            onClick={(e) => {
              e.stopPropagation()
              a.run({ recordId, relatedId: row.id })
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {a.label}
          </Button>
        ))}
    </span>
  )
}

/** 머리 줄 — 대상 속성 라벨. 수 열은 오른쪽 맞춤, 첫 열이 남은 폭을 갖는다. 동작 열은 화면 읽기용 이름만. */
function HeaderRow({
  columns,
  hasActions,
  cellClassName,
  actionsLabel,
}: {
  columns: readonly PropertyDef[]
  hasActions: boolean
  cellClassName: string
  actionsLabel: string
}) {
  return (
    <tr>
      {columns.map((def, i) => (
        <th
          key={def.key}
          scope="col"
          className={cn(
            'whitespace-nowrap font-normal',
            cellClassName,
            def.type === 'number' ? 'text-right' : 'text-left',
            i === 0 && 'w-full',
          )}
        >
          {def.label}
        </th>
      ))}
      {hasActions && (
        <th scope="col" className={cellClassName}>
          <span className="sr-only">{actionsLabel}</span>
        </th>
      )}
    </tr>
  )
}

const DENSITY = {
  compact: { text: 'text-xs', head: 'px-2 py-1', cell: 'px-2 py-1', more: 'px-2 py-1' },
  default: { text: 'text-sm', head: 'px-3 py-1.5', cell: 'px-3 py-2', more: 'px-3 py-1.5' },
} as const

/** 카드 안 버튼의 클릭·키가 카드 열기로 새지 않게(카드 케밥과 같은 규칙). */
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

/** 줄의 첫 동작 — 'rows' 모양은 줄 전체가 이 동작이다(보이는 것 중 첫째). */
function primaryAction(
  row: RelatedRecordRow,
  actions: readonly RelatedRowAction[],
): RelatedRowAction | undefined {
  return actions.find((a) => a.visible?.(row) ?? true)
}

/**
 * 'rows' 모양 — 테두리 상자 안의 줄들. 줄을 누르면(또는 Enter · Space) 첫 동작을 부른다. 동작이 없는 줄은 누를 수 없고 「›」도 없다.
 * 카드 열기로 새지 않게 클릭 · 키 전파를 막는다.
 */
function RowsList({
  recordId,
  shown,
  total,
  columns,
  actions,
  moreText,
  onMore,
  label,
  countUnit,
  className,
}: {
  recordId: string
  shown: readonly RelatedRecordRow[]
  total: number
  columns: readonly PropertyDef[]
  actions: readonly RelatedRowAction[]
  moreText: string | null
  onMore: () => void
  label?: string
  countUnit?: string
  className?: string
}) {
  const c = relationTableCopy(useCollectionLocale())
  const actionLabel = actions[0]?.label
  return (
    <div
      data-relation-table=""
      data-variant="rows"
      className={cn('flex flex-col text-sm text-fg', className)}
    >
      <div className="mb-1 truncate text-xs text-fg-subtle">
        {c.rowsCaption(label, total, countUnit, actionLabel)}
      </div>
      {shown.map((row) => {
        const action = primaryAction(row, actions)
        const run = action
          ? (e: { stopPropagation: () => void }) => {
              e.stopPropagation()
              action.run({ recordId, relatedId: row.id })
            }
          : undefined
        const name = columns[0] ? cellText(columns[0], row) : ''
        return (
          <div
            key={row.id}
            data-relation-row=""
            role={run ? 'button' : undefined}
            tabIndex={run ? 0 : undefined}
            aria-label={action ? `${name} ${action.label}`.trim() : undefined}
            title={action?.label}
            onClick={run}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (run && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                run(e)
              }
            }}
            // 줄 높이 32px(글자 20 + 사이 12). 올렸을 때 바탕이 글자에 붙지 않게 좌우로 8px 내민다.
            className={cn(
              '-mx-2 flex h-8 items-center gap-3 rounded-md px-2',
              run &&
                'cursor-pointer transition-colors hover:bg-container-low focus-visible:bg-container-low focus-visible:outline-none',
            )}
          >
            {columns.map((def, i) => (
              <span
                key={def.key}
                className={cn(
                  'whitespace-nowrap',
                  i === 0 ? 'min-w-0 flex-1 truncate' : 'min-w-12 shrink-0 text-right tabular-nums',
                  i > 0 && def.type !== 'number' && 'text-xs',
                  def.type === 'number' && 'font-semibold',
                )}
              >
                {cellNode(def, row)}
              </span>
            ))}
            {actions.length > 0 && (
              <ChevronRight
                aria-hidden
                className={cn('size-4 shrink-0 text-fg-muted', !run && 'invisible')}
              />
            )}
          </div>
        )
      })}
      {moreText && (
        <button
          type="button"
          onClick={(e) => {
            stop(e)
            onMore()
          }}
          onKeyDown={stop}
          className="mt-1 self-start truncate text-left text-xs text-fg-subtle underline-offset-2 transition-colors hover:text-fg hover:underline"
        >
          {moreText}
        </button>
      )}
    </div>
  )
}

export function RelationTable({
  recordId,
  rows,
  columns,
  maxRows,
  actions = [],
  countUnit,
  density = 'compact',
  emptyLabel,
  variant = 'table',
  collapsed = false,
  label,
  className,
}: RelationTableProps) {
  const c = relationTableCopy(useCollectionLocale())
  const [opened, setOpened] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const d = DENSITY[density]
  const isList = variant === 'list'
  if (columns.length === 0) return null
  if (rows.length === 0) {
    if (emptyLabel === undefined) return null
    return (
      <div
        className={cn(
          isList ? 'text-fg-muted' : 'rounded-md border border-border px-2 py-1.5 text-fg-muted',
          d.text,
          className,
        )}
      >
        {emptyLabel}
      </div>
    )
  }
  if (collapsed && !opened) {
    return (
      <button
        type="button"
        data-relation-table=""
        aria-expanded={false}
        onClick={(e) => {
          stop(e)
          setOpened(true)
        }}
        onKeyDown={stop}
        className={cn(
          'self-start text-fg-muted underline-offset-2 transition-colors hover:text-fg hover:underline',
          d.text,
          className,
        )}
      >
        {c.show(label, rows.length, countUnit)}
      </button>
    )
  }
  const { shown, hidden } = relationTableSlice(rows, showAll ? rows.length : maxRows)
  const hasActions = actions.length > 0
  const next = hidden[0]
  const preview = next
    ? columns
        .slice(0, 2)
        .map((def) => cellText(def, next))
        .filter(Boolean)
        .join(' ')
    : ''
  const moreText = [c.more(hidden.length, countUnit), preview].filter(Boolean).join(' · ')

  if (variant === 'rows') {
    return (
      <RowsList
        recordId={recordId}
        shown={shown}
        total={rows.length}
        columns={columns}
        actions={actions}
        moreText={hidden.length > 0 ? moreText : null}
        onMore={() => setShowAll(true)}
        label={label}
        countUnit={countUnit}
        className={className}
      />
    )
  }

  if (isList) {
    return (
      <div data-relation-table="" data-variant="list" className={cn('flex flex-col', className)}>
        {/* 줄 사이 10px — border-spacing 은 위·아래 끝에도 생기므로 음수 여백으로 상쇄한다. */}
        <table
          className={cn(
            '-my-2.5 w-full border-separate border-spacing-x-0 border-spacing-y-2.5 text-fg',
            d.text,
          )}
        >
          <tbody>
            {shown.map((row, rowIndex) => (
              <tr key={row.id} className="h-8">
                {columns.map((def, i) => (
                  <td
                    key={def.key}
                    className={cn(
                      i > 0 && 'pl-3',
                      def.type === 'number'
                        ? 'whitespace-nowrap text-right tabular-nums'
                        : 'whitespace-nowrap',
                      // 머리 줄이 없으니 첫 칸이 직접 남은 폭을 갖는다(w-full) — 그래야 말줄임 폭이 0 으로 접히지 않는다.
                      i === 0 && 'w-full max-w-0 truncate',
                    )}
                  >
                    {cellNode(def, row)}
                  </td>
                ))}
                {hasActions && (
                  <td className="whitespace-nowrap pl-3 text-right">
                    <RowActions
                      recordId={recordId}
                      row={row}
                      actions={actions}
                      tone={rowIndex === 0 ? 'primary' : 'secondary'}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {hidden.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              stop(e)
              setShowAll(true)
            }}
            onKeyDown={stop}
            className={cn(
              'mt-2.5 truncate text-left text-fg-muted underline-offset-2 transition-colors hover:text-fg hover:underline',
              d.text,
            )}
          >
            {moreText}
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      data-relation-table=""
      className={cn('overflow-hidden rounded-md border border-border bg-background', className)}
    >
      <table className={cn('w-full border-collapse text-fg', d.text)}>
        <thead className="bg-surface text-fg-muted">
          <HeaderRow
            columns={columns}
            hasActions={hasActions}
            cellClassName={d.head}
            actionsLabel={c.actions}
          />
        </thead>
        <tbody>
          {shown.map((row) => (
            <tr key={row.id} className="border-t border-border">
              {columns.map((def, i) => (
                <td
                  key={def.key}
                  className={cn(
                    d.cell,
                    def.type === 'number'
                      ? 'whitespace-nowrap text-right tabular-nums'
                      : 'whitespace-nowrap',
                    // 첫 열이 남은 폭을 갖고 말줄임 — 이름이 길어도 금액·상태 열을 밀어내지 않는다.
                    i === 0 && 'max-w-0 truncate',
                  )}
                >
                  {cellNode(def, row)}
                </td>
              ))}
              {hasActions && (
                <td className={cn('whitespace-nowrap text-right', d.cell)}>
                  <RowActions recordId={recordId} row={row} actions={actions} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {hidden.length > 0 && (
        <div className={cn('truncate border-t border-border text-fg-muted', d.text, d.more)}>
          {moreText}
        </div>
      )}
    </div>
  )
}
