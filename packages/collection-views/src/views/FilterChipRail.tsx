'use client'

import { useState } from 'react'
import { Plus, Popover, X, cn } from '@oobleck/systheme'
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
  if (Array.isArray(v)) return v.join(', ')
  // 상대값은 뜻을 그대로 보인다 — 칩이 "오늘" 이라고 말해야 저장된 뷰가 왜 매일 다른 행을
  // 보여주는지 읽힌다. 여기서 오늘 날짜로 풀어 보이면 내일 그 칩이 거짓말을 한다.
  const relative = relativeValueLabel(v)
  if (relative) return relative
  if (typeof v === 'object') return '…'

  // select 값은 옵션 라벨로 — 칩은 사용자가 고른 말로 말해야 한다.
  if (def && Array.isArray(def.options)) {
    const opt = def.options.find((o) => (typeof o === 'string' ? o === v : o.value === v))
    if (opt && typeof opt !== 'string') return opt.label ?? opt.value
  }
  return String(v)
}

/** 동시에 열리는 편집기는 하나 — 칩 인덱스 또는 "＋ 필터"(add). */
type OpenEditor = number | 'add' | null

export function FilterChipRail({ schema, view, onViewChange, className }: FilterChipRailProps) {
  const locale = useCollectionLocale()
  const c = filterChipRailCopy(locale)
  const t = viewToolbarCopy(locale)
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
    const def = schema.find((d) => d.key === child.key)
    return {
      key: `${child.key}_${i}`,
      index: i,
      child,
      label: def?.label ?? child.key,
      op: OP_SYMBOL[child.op] ?? t.opLabel(child.op),
      value: conditionValueText(def, child, {
        checked: t.checkboxChecked,
        unchecked: t.checkboxUnchecked,
      }),
    }
  })

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
