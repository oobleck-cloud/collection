'use client'

import { Fragment, useState } from 'react'
import { Plus, Popover, X, cn } from '../kit'
import type {
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOp,
  PropertyDef,
  ViewConfig,
} from '@oobleck/collection'
import { relativeValueLabel } from '@oobleck/collection'
import { isFilterGroup } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { filterChipRailCopy } from './FilterChipRail.messages'
import { viewToolbarCopy } from './ViewToolbar.messages'
import { FilterConditionRow, FilterGroupEditor } from './filter-builder'
import {
  rollupMeasureLabel,
  rollupSourceOf,
  rollupTargetDef,
  useFilterRollups,
} from './filter-rollup'
import type { RollupSource } from '@oobleck/collection'

// @oobleck/collection — 적용된 필터의 칩 레일(Linear/GitHub Issues 문법).
//
// ViewToolbar 의 ⛁ 팝오버는 **편집기**다 — 닫으면 적용된 조건이 뱃지 숫자로만 남는다.
// "3" 이 무엇인지는 열어봐야 안다. 이 레일은 그 공백을 메우는 **상태의 거울**이다:
// 루트 그룹의 자식을 칩 한 줄로 투영하고, 칩의 ✕ 가 그 조건 하나를 제거한다.
//
// 칩 본문 클릭은 **그 조건 하나로 스코프된** 편집 팝오버를 연다. 새 모양의 편집기를
// 만드는 게 아니라 ⛁/＋필터 와 같은 부품(FilterConditionRow·FilterGroupEditor)을 같은
// 상태 위에 좁혀 그리는 것 — 편집기는 여전히 하나고, 동시에 열리는 것도 하나다(openEditor).
//
// 중첩 그룹은 요약 칩("그룹 · N")으로 접는다. 트리 구조를 칩 문법으로 완전히 펴는 순간
// 레일이 읽을 수 없어지기 때문에, 칩은 요약·제거·(클릭 시)그 그룹만 편집까지 맡는다.

export type FilterChipRailProps = {
  /** 칩 라벨·"＋ 필터" 편집기가 참조하는 컬럼 정의. */
  schema: PropertyDef[]
  view: ViewConfig
  /** 칩 제거·편집기 변경을 반영할 부분 갱신 — ViewToolbar 와 같은 계약. */
  onViewChange: (next: Partial<ViewConfig>) => void
  /**
   * 보이기만 한다 — 칩 편집·✕·「＋ 필터」·「모두 지우기」를 그리지 않는다. 다른 자리(일괄 발송 대화상자 등)가
   * 「이 조건으로」를 같은 말로 보일 때 쓴다. 조건이 없으면 아무것도 그리지 않는다.
   */
  readOnly?: boolean
  className?: string
}

/** 비교 연산자는 기호가 더 빨리 읽힌다 — 나머지(포함·비어있음…)는 opLabel 문구를 쓴다. */
const OP_SYMBOL: Partial<Record<FilterOp, string>> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
}

/** 그룹 안의 조건(leaf) 수 — 요약 칩의 N. */
function leafCount(group: FilterGroup): number {
  let count = 0
  for (const child of group.children) {
    count += isFilterGroup(child) ? leafCount(child) : 1
  }
  return count
}

function conditionValueText(
  def: PropertyDef | undefined,
  condition: FilterCondition,
  checkboxLabels: { checked: string; unchecked: string },
): string | null {
  if (condition.op === 'is_empty' || condition.op === 'is_not_empty') return null

  const v = condition.value
  // 값을 채우기 전(편집 중간 상태) — 서버로는 안 나가지만(브리지가 떨군다) 칩으로는 보여
  // 제거할 수 있어야 한다.
  if (v == null || v === '') return '…'
  if (typeof v === 'boolean') return v ? checkboxLabels.checked : checkboxLabels.unchecked
  if (Array.isArray(v)) {
    if (v.length === 0) return '…'
    const labels = v.map((one) => optionLabel(def, one))
    // 칩은 한 줄이다 — 셋을 넘으면 나머지는 개수로 접는다(전부는 칩을 눌러 편집기에서 본다).
    return labels.length > 3
      ? `${labels.slice(0, 3).join(', ')} +${labels.length - 3}`
      : labels.join(', ')
  }
  // 상대값은 뜻을 그대로 보인다 — 칩이 "오늘" 이라고 말해야 저장된 뷰가 왜 매일 다른 행을
  // 보여주는지 읽힌다. 여기서 오늘 날짜로 풀어 보이면 내일 그 칩이 거짓말을 한다.
  const relative = relativeValueLabel(v)
  if (relative) return relative
  if (typeof v === 'object') return '…'
  // 그 분(`2026-10-17T12:00`)은 날짜와 시각 사이를 띄워 읽힌다.
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return v.replace('T', ' ')

  return optionLabel(def, String(v))
}

/** select 값은 옵션 라벨로 — 칩은 사용자가 고른 말로 말해야 한다. */
function optionLabel(def: PropertyDef | undefined, v: string): string {
  if (def && Array.isArray(def.options)) {
    const opt = def.options.find((o) => (typeof o === 'string' ? o === v : o.value === v))
    if (opt && typeof opt !== 'string') return opt.label ?? opt.value
  }
  return v
}

/**
 * 칩의 연산자 표기. 단일값 컬럼의 「다음 중 하나」 는 `=` 뒤에 값을 늘어놓는 편이
 * 낱말보다 빨리 읽힌다(`상태 = 취소됨, 중복됨`). 다중값 컬럼은 `=` 가 「정확히 이 묶음」으로
 * 읽힐 수 있어 낱말을 쓴다.
 */
function chipOp(def: PropertyDef | undefined, op: FilterOp, label: (op: FilterOp) => string) {
  if ((op === 'in' || op === 'not_in') && def && (def.type === 'select' || def.type === 'person')) {
    return op === 'in' ? '=' : '≠'
  }
  return OP_SYMBOL[op] ?? label(op)
}

type ChipText = { label: string; op: string | null; value: string | null }

/** 조건 하나의 칩 말(라벨 · 연산자 · 값) — 편집 레일과 읽기 전용 트리가 같은 말을 쓴다. */
function conditionChip(
  schema: PropertyDef[],
  condition: FilterCondition,
  t: ReturnType<typeof viewToolbarCopy>,
  rollups: readonly RollupSource[] = [],
): ChipText {
  if (condition.rollup) return rollupChip(condition, rollupSourceOf(rollups, condition.key), t)
  const def = schema.find((d) => d.key === condition.key)
  return {
    label: def?.label ?? condition.key,
    op: chipOp(def, condition.op, t.opLabel),
    value: conditionValueText(def, condition, {
      checked: t.checkboxChecked,
      unchecked: t.checkboxUnchecked,
    }),
  }
}

/**
 * 롤업 조건의 칩 — 「견적 개수 · 주문 = 1002, 상태 ≠ lost」 ≥ 1. 대상 조건은 라벨 뒤에 같은 말로 이어 적는다
 * (참조값은 칩 한 줄에서 해상하지 않는다 — 번호가 곧 주문·파트너 번호다).
 */
function rollupChip(
  condition: FilterCondition,
  source: RollupSource | undefined,
  t: ReturnType<typeof viewToolbarCopy>,
): ChipText {
  const rollup = condition.rollup!
  const where = rollup.where
    .filter((n): n is FilterCondition => !isFilterGroup(n))
    .map((w) => {
      const chip = conditionChip(source?.schema ?? [], w, t)
      const def = rollupTargetDef(source, w.key)
      return [def?.label ?? chip.label, chip.op, chip.value].filter(Boolean).join(' ')
    })
  const head = `${source?.label ?? condition.key} ${rollupMeasureLabel(source, rollup.agg, rollup.field, t)}`
  return {
    label: where.length > 0 ? `${head} · ${where.join(', ')}` : head,
    op: chipOp(undefined, condition.op, t.opLabel),
    value: conditionValueText(undefined, condition, {
      checked: t.checkboxChecked,
      unchecked: t.checkboxUnchecked,
    }),
  }
}

function StaticChip({ chip }: { chip: ChipText }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2.5 text-xs">
      <span className="text-fg-muted">{chip.label}</span>
      {chip.op !== null && <span className="text-fg-muted/70">{chip.op}</span>}
      {chip.value !== null && <span className="font-medium text-primary">{chip.value}</span>}
    </span>
  )
}

/**
 * 보이기만 하는 조건 트리 — 편집·제거 입구 없이, 하위 그룹도 접지 않고 편다(`(… AND …) OR (…)`). 레일은 한 줄을 지키려
 * 그룹을 「그룹 · N」으로 접지만, 읽기 전용 자리(일괄 발송의 「대상 조건」)는 무엇에 보내는지가 그대로 읽혀야 한다.
 * 결합어는 편집기 토글과 같은 AND/OR 다.
 */
function ReadOnlyFilterTree({
  schema,
  group,
  nested = false,
}: {
  schema: PropertyDef[]
  group: FilterGroup
  nested?: boolean
}) {
  const t = viewToolbarCopy(useCollectionLocale())
  const rollups = useFilterRollups()
  const joiner = group.op === 'and' ? 'AND' : 'OR'
  return (
    <span
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1.5',
        nested && 'rounded-xl border border-dashed border-border px-1.5 py-1',
      )}
    >
      {group.children.map((child, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-[11px] font-medium text-fg-muted">{joiner}</span>}
          {isFilterGroup(child) ? (
            <ReadOnlyFilterTree schema={schema} group={child} nested />
          ) : (
            <StaticChip chip={conditionChip(schema, child, t, rollups)} />
          )}
        </Fragment>
      ))}
    </span>
  )
}

/** 동시에 열리는 편집기는 하나 — 칩 인덱스 또는 "＋ 필터"(add). */
type OpenEditor = number | 'add' | null

export function FilterChipRail({
  schema,
  view,
  onViewChange,
  readOnly = false,
  className,
}: FilterChipRailProps) {
  const locale = useCollectionLocale()
  const c = filterChipRailCopy(locale)
  const t = viewToolbarCopy(locale)
  const rollups = useFilterRollups()
  const [openEditor, setOpenEditor] = useState<OpenEditor>(null)

  const root = view.filters
  const removeChildAt = (index: number) => {
    onViewChange({ filters: { ...root, children: root.children.filter((_, i) => i !== index) } })
  }
  const updateChildAt = (index: number, next: FilterNode) => {
    onViewChange({
      filters: { ...root, children: root.children.map((ch, i) => (i === index ? next : ch)) },
    })
  }
  const clearAll = () => onViewChange({ filters: { ...root, children: [] } })

  const chips = root.children.map((child, i) => {
    if (isFilterGroup(child)) {
      return {
        key: `group_${i}`,
        index: i,
        child,
        label: c.groupChip(leafCount(child)),
        op: null,
        value: null,
      }
    }
    return {
      key: `${child.key}_${i}`,
      index: i,
      child,
      ...conditionChip(schema, child, t, rollups),
    }
  })

  if (readOnly) {
    if (root.children.length === 0) return null
    return (
      <div className={cn('min-w-0', className)}>
        <ReadOnlyFilterTree schema={schema} group={root} />
      </div>
    )
  }

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-8 shrink-0 items-center overflow-hidden rounded-full border border-primary/25 bg-primary/8 text-xs"
        >
          {/* 칩 본문 = 그 조건으로 스코프된 편집기의 트리거. */}
          <Popover
            open={openEditor === chip.index}
            onOpenChange={(o) => setOpenEditor(o ? chip.index : null)}
            side="bottom"
            align="start"
            contentClassName="w-96 p-3"
            className="h-full"
            trigger={({ onClick, 'aria-expanded': ae }) => (
              <button
                type="button"
                onClick={() => onClick()}
                aria-expanded={ae}
                aria-label={c.editChip(chip.label)}
                className="flex h-full items-center gap-1 pl-2.5 pr-1.5 transition-colors hover:bg-primary/15"
              >
                <span className="text-fg-muted">{chip.label}</span>
                {chip.op !== null && <span className="text-fg-muted/70">{chip.op}</span>}
                {chip.value !== null && (
                  <span className="font-medium text-primary">{chip.value}</span>
                )}
              </button>
            )}
          >
            {isFilterGroup(chip.child) ? (
              <FilterGroupEditor
                schema={schema}
                group={chip.child}
                depth={0}
                onChange={(next) => updateChildAt(chip.index, next)}
              />
            ) : (
              <FilterConditionRow
                schema={schema}
                condition={chip.child}
                onChange={(next) => updateChildAt(chip.index, next)}
                onRemove={() => {
                  removeChildAt(chip.index)
                  setOpenEditor(null)
                }}
              />
            )}
          </Popover>
          <button
            type="button"
            aria-label={c.removeChip(chip.label)}
            onClick={() => removeChildAt(chip.index)}
            className="inline-flex h-full items-center border-l border-primary/20 px-1.5 text-fg-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <X className="size-4" />
          </button>
        </span>
      ))}

      {/* ＋ 필터 — ⛁ 과 같은 편집기를 여는 두 번째 입구(편집기 자체는 하나). */}
      <Popover
        open={openEditor === 'add'}
        onOpenChange={(o) => setOpenEditor(o ? 'add' : null)}
        side="bottom"
        align="start"
        contentClassName="w-96 p-3"
        trigger={({ onClick, 'aria-expanded': ae }) => (
          <button
            type="button"
            onClick={() => onClick()}
            aria-expanded={ae}
            // 접근성 이름은 "필터 추가" — 툴바 ⛁(aria-label "필터")와 이름이 겹치지 않게.
            aria-label={c.addFilterAria}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 text-xs font-medium text-fg-muted transition-colors hover:bg-surface hover:text-fg"
          >
            <Plus className="size-4" />
            {c.addFilter}
          </button>
        )}
      >
        <FilterGroupEditor
          schema={schema}
          group={root}
          depth={0}
          onChange={(next) => onViewChange({ filters: next })}
        />
      </Popover>

      {chips.length >= 2 && (
        <button
          type="button"
          onClick={clearAll}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
        >
          {c.clearAll}
        </button>
      )}
    </div>
  )
}
