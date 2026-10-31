'use client'

import { Input, Select, X, cn } from '@oobleck/systheme'

import type {
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOp,
  PropertyDef,
  PropertyType,
  PropertyValue,
} from '@oobleck/collection'
import { isRelativeValue, relativeDateLabel, type RelativeDateValue } from '@oobleck/collection'
import { isFilterGroup } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { viewToolbarCopy } from './ViewToolbar.messages'

// @oobleck/collection — 필터 트리 편집기(불리언 빌더) + 그 게이팅 함수들.
//
// ViewToolbar 에서 떼어낸 이유: 툴바 모듈은 view-layout-panel → CollectionView 를 거쳐
// **모든 뷰 서피스 레지스트리**를 끌고 온다. 필터 편집기만 쓰고 싶은 쪽(칩 레일, 그리고
// opsFor 하나만 보는 테스트)이 그 그래프를 통째로 지고 갈 이유가 없다.
// 문구(messages)는 툴바와 공유한다 — 같은 어휘를 두 벌로 만들지 않는다.

// ─── 필터 연산자 ─────────────────────────────────────────────────────────────

/** PropertyType → 가능한 필터 연산자 목록(노션식). */
export function opsFor(type: PropertyType): FilterOp[] {
  switch (type) {
    case 'text':
    case 'url':
      return ['contains', 'not_contains', 'eq', 'neq', 'is_empty', 'is_not_empty']
    case 'number':
    case 'date':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty']
    case 'select':
    case 'relation':
      return ['eq', 'neq', 'is_empty', 'is_not_empty']
    case 'multi_select':
      return ['has', 'not_has', 'is_empty', 'is_not_empty']
    case 'geo':
    case 'button':
      // geo/button 은 객체값 — eq/contains/대소비교가 의미 없다. 존재 여부(empty/not_empty)만 방어적으로
      // 허용(#45 geo 전례). 버튼은 필터 후보(isFilterableType)·정렬 후보(isSortableType)에서 아예 제외된다.
      return ['is_empty', 'is_not_empty']
    case 'checkbox':
      return ['eq']
    default:
      return ['eq']
  }
}

/**
 * PropertyType 이 정렬 가능한가 — geo/button 은 객체값이라 안정적 순서가 없어 정렬 후보에서 제외한다(#45 전례).
 * (코어 compareByKey 는 객체로 깨지진 않지만 의미있는 순서가 없어 — UI 에서 무의미한 정렬 키를 애초에 제시하지 않는다.)
 */
export function isSortableType(type: PropertyType): boolean {
  return type !== 'geo' && type !== 'button'
}

/**
 * PropertyType 이 필터 가능한가 — button 은 액션 셀(값 = 라벨·variant 데이터)이라 조건 대상으로
 * 무의미해 필터 조건 추가 후보에서 제외한다(무의미한 필드를 애초에 제시하지 않음 — isSortableType 동형).
 */
export function isFilterableType(type: PropertyType): boolean {
  return type !== 'button'
}

// ─── 필터 값 입력 ─────────────────────────────────────────────────────────────

function FilterValueInput({
  def,
  op,
  value,
  onChange,
}: {
  def: PropertyDef
  op: FilterOp
  value: PropertyValue | undefined
  onChange: (v: PropertyValue) => void
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  if (op === 'is_empty' || op === 'is_not_empty') return null

  if (def.type === 'checkbox') {
    return (
      <Select
        size="sm"
        options={[
          { value: 'true', label: c.checkboxChecked },
          { value: 'false', label: c.checkboxUnchecked },
        ]}
        value={value === true ? 'true' : 'false'}
        onChange={(v) => onChange(v === 'true')}
      />
    )
  }

  if (def.type === 'select' || def.type === 'multi_select') {
    const options = (Array.isArray(def.options) ? def.options : []).map((o) =>
      typeof o === 'string'
        ? { value: o, label: o }
        : { value: o.value, label: o.label ?? o.value },
    )
    return (
      <Select
        size="sm"
        searchable
        options={options}
        value={typeof value === 'string' ? value : ''}
        onChange={onChange}
        placeholder={c.selectValuePlaceholder}
      />
    )
  }

  if (def.type === 'number') {
    return (
      <Input
        size="sm"
        type="number"
        value={typeof value === 'number' ? String(value) : ''}
        onValueChange={(s) => {
          const n = s === '' ? null : Number(s)
          onChange(n !== null && Number.isFinite(n) ? n : null)
        }}
      />
    )
  }

  if (def.type === 'date') {
    return <DateValueInput value={value} onChange={onChange} />
  }

  return (
    <Input
      size="sm"
      value={typeof value === 'string' ? value : ''}
      onValueChange={onChange}
      placeholder={c.valuePlaceholder}
    />
  )
}

/**
 * 날짜 조건의 값 — **고정 날짜와 상대 날짜 중 하나**.
 *
 * 저장된 뷰가 어제의 답에 못 박히지 않으려면 상대값을 고를 수 있어야 한다. "오늘 방문" 이라
 * 이름 붙인 뷰가 다음 날 어제를 보여주는 것이 지금까지의 동작이었고, 화면만 봐서는 알 수 없다.
 *
 * 기준 드롭다운을 먼저 고르게 한다 — 고정을 고르면 달력이, 상대를 고르면 그 뜻이 남는다.
 * 두 입력을 나란히 두지 않는 이유: 어느 쪽이 실제로 걸려 있는지 한눈에 갈리지 않는다.
 */
function DateValueInput({
  value,
  onChange,
}: {
  value: PropertyValue | undefined
  onChange: (v: PropertyValue) => void
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const relative = isRelativeValue(value) ? value : null

  return (
    <div className="flex items-center gap-1.5">
      <Select
        size="sm"
        options={[
          { value: FIXED_DATE, label: c.dateModeFixed },
          ...RELATIVE_DATE_PRESETS.map((preset) => ({
            value: presetKey(preset),
            label: relativeDateLabel(preset),
          })),
        ]}
        value={relative ? presetKey(relative) : FIXED_DATE}
        onChange={(next) => {
          if (next === FIXED_DATE) {
            // 상대 → 고정으로 옮길 때 값을 지운다. 남겨 두면 방금 고른 뜻과 다른 날짜가
            // 달력에 남아, 사용자가 고르지 않은 조건이 걸린 채로 보인다.
            onChange(null)
            return
          }
          const preset = RELATIVE_DATE_PRESETS.find((p) => presetKey(p) === next)
          if (preset) onChange(preset)
        }}
      />
      {!relative && (
        <Input
          size="sm"
          type="date"
          value={typeof value === 'string' ? value : ''}
          onValueChange={onChange}
        />
      )}
    </div>
  )
}

/** 기준 드롭다운의 "고정 날짜" 자리 — 상대 프리셋 키와 겹치지 않는 값. */
const FIXED_DATE = 'fixed'

/** 상대값 → 드롭다운 키. 저장 형태(unit·offset)에서 파생하므로 목록과 값이 어긋나지 않는다. */
function presetKey(value: RelativeDateValue): string {
  return `${value.unit}:${value.offset}`
}

/**
 * 고를 수 있는 상대 날짜. 운영에서 실제로 쓰는 말만 둔다 — 목록이 길어지면 고르는 일이
 * 느려지고, 임의의 오프셋은 이 자리가 아니라 검색창의 낱말(`D-7`)이 받는다.
 */
const RELATIVE_DATE_PRESETS: RelativeDateValue[] = [
  { rel: 'date', unit: 'day', offset: 0 },
  { rel: 'date', unit: 'day', offset: -1 },
  { rel: 'date', unit: 'day', offset: 1 },
  { rel: 'date', unit: 'day', offset: -7 },
  { rel: 'date', unit: 'day', offset: 7 },
  { rel: 'date', unit: 'week', offset: 0 },
  { rel: 'date', unit: 'week', offset: -1 },
  { rel: 'date', unit: 'week', offset: 1 },
  { rel: 'date', unit: 'month', offset: 0 },
  { rel: 'date', unit: 'month', offset: -1 },
]

// ─── 루트 조건 헬퍼 ──────────────────────────────────────────────────────────

/** 루트 그룹의 전체 노드 수(leaf + 하위 그룹 포함) — 필터 뱃지용. */
export function totalFilterCount(root: FilterGroup): number {
  let count = 0
  const visit = (node: FilterNode): void => {
    if (isFilterGroup(node)) {
      node.children.forEach(visit)
    } else {
      count++
    }
  }
  root.children.forEach(visit)
  return count
}

// ─── 필터 빌더 (불리언 트리) ─────────────────────────────────────────────────

/**
 * 단일 FilterCondition 행 렌더러.
 * 그룹 내에서도 재사용(depth ≥ 1). 칩 레일의 칩 클릭 편집 팝오버도 이 행 하나를 그대로 쓴다
 * — 같은 상태에 다른 모양의 편집기를 만들지 않는다.
 */
export function FilterConditionRow({
  schema,
  condition,
  onChange,
  onRemove,
}: {
  schema: PropertyDef[]
  condition: FilterCondition
  onChange: (next: FilterCondition) => void
  onRemove: () => void
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const def = schema.find((d) => d.key === condition.key)
  if (!def) return null
  const ops = opsFor(def.type)
  // 명시적 grid: 속성명 · 연산자 · 값(채움) · 제거. 내부 DS 컨트롤(combobox/input)을
  // 강제로 cell 폭에 맞춰(w-full) 값 입력이 찌그러지지 않게 한다.
  return (
    <div className="grid grid-cols-[4.5rem_5.5rem_minmax(0,1fr)_1.25rem] items-center gap-1 [&_button[role=combobox]]:w-full [&_input]:w-full">
      <span className="truncate text-xs text-fg">{def.label}</span>
      <Select
        size="sm"
        options={ops.map((op) => ({ value: op, label: c.opLabel(op) }))}
        value={condition.op}
        onChange={(op) => onChange({ ...condition, op: op as FilterOp })}
      />
      <div className="min-w-0">
        <FilterValueInput
          def={def}
          op={condition.op}
          value={condition.value}
          onChange={(v) => onChange({ ...condition, value: v })}
        />
      </div>
      <button
        type="button"
        aria-label={c.remove}
        onClick={onRemove}
        className="inline-flex size-5 items-center justify-center justify-self-end rounded text-fg-muted hover:bg-surface hover:text-fg"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

/**
 * 중첩 FilterGroup 편집 패널 — 재귀 렌더(최대 2~3 단).
 * - group 의 op 토글(AND/OR).
 * - 그룹 내 조건 추가/제거.
 * - 그룹 전체 제거(onRemove 제공 시 표시).
 * - 하위 그룹 추가.
 * depth=0 은 루트이므로 제거 버튼 없음.
 */
/**
 * 필터 트리 편집기 — 툴바 ⛁ 팝오버와 칩 레일 "＋ 필터" 가 **같은 것**을 연다.
 * 같은 상태에 편집기가 둘이면 어느 쪽이 이겼는지 화면만 보고 알 수 없다.
 */
export function FilterGroupEditor({
  schema,
  group,
  depth,
  onChange,
  onRemove,
}: {
  schema: PropertyDef[]
  group: FilterGroup
  depth: number
  onChange: (next: FilterGroup) => void
  onRemove?: () => void
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const addCondition = (key: string) => {
    const def = schema.find((d) => d.key === key)
    if (!def) return
    const ops = opsFor(def.type)
    const cond: FilterCondition = { key, op: ops[0], value: null }
    onChange({ ...group, children: [...group.children, cond] })
  }

  const addSubGroup = () => {
    const subGroup: FilterGroup = { op: 'and', children: [] }
    onChange({ ...group, children: [...group.children, subGroup] })
  }

  const removeChildAt = (i: number) => {
    onChange({ ...group, children: group.children.filter((_, j) => j !== i) })
  }

  const updateChildAt = (i: number, next: FilterNode) => {
    onChange({ ...group, children: group.children.map((c, j) => (j === i ? next : c)) })
  }

  const toggleOp = () => {
    onChange({ ...group, op: group.op === 'and' ? 'or' : 'and' })
  }

  // button 등 필터 무의미 타입은 조건 추가 후보에서 제외(isFilterableType — 정렬의 isSortableType 동형).
  const addItems = schema
    .filter((d) => isFilterableType(d.type))
    .map((d) => ({ value: d.key, label: d.label }))

  // 루트(depth=0) 표시 여부에 따라 그룹 헤더 스타일을 조정한다.
  const isRoot = depth === 0
  const groupLabel = isRoot ? null : (
    <div className="mb-1 flex items-center gap-1">
      {/* 그룹 AND/OR 토글 */}
      <button
        type="button"
        onClick={toggleOp}
        className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted transition-colors hover:bg-surface hover:text-fg"
        aria-label={c.groupCombinatorAria(group.op === 'and' ? 'AND' : 'OR')}
      >
        {group.op === 'and' ? 'AND' : 'OR'}
      </button>
      <span className="flex-1 text-[10px] text-fg-muted">{c.groupLabel}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={c.removeGroup}
          onClick={onRemove}
          className="inline-flex size-4 items-center justify-center rounded text-fg-muted hover:bg-surface hover:text-fg"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )

  return (
    <div
      className={cn('flex flex-col gap-1', !isRoot && 'ml-2 rounded border border-border/60 p-2')}
    >
      {groupLabel}

      {/* 루트 AND/OR 토글 (루트 레벨에서만 헤더 위치에) */}
      {isRoot && group.children.length > 1 && (
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[10px] text-fg-muted">{c.combine}</span>
          <button
            type="button"
            onClick={toggleOp}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
              group.op === 'and'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border text-fg-muted hover:bg-surface hover:text-fg',
            )}
            aria-label={c.andAria}
            aria-pressed={group.op === 'and'}
          >
            AND
          </button>
          <button
            type="button"
            onClick={toggleOp}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
              group.op === 'or'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border text-fg-muted hover:bg-surface hover:text-fg',
            )}
            aria-label={c.orAria}
            aria-pressed={group.op === 'or'}
          >
            OR
          </button>
        </div>
      )}

      {group.children.length === 0 && (
        <div className="text-xs text-fg-muted">{isRoot ? c.noFilterRoot : c.noFilterGroup}</div>
      )}

      {group.children.map((child, i) => {
        if (isFilterGroup(child)) {
          return (
            <FilterGroupEditor
              key={i}
              schema={schema}
              group={child}
              depth={depth + 1}
              onChange={(next) => updateChildAt(i, next)}
              onRemove={() => removeChildAt(i)}
            />
          )
        }
        return (
          <FilterConditionRow
            key={`${child.key}_${i}`}
            schema={schema}
            condition={child}
            onChange={(next) => updateChildAt(i, next)}
            onRemove={() => removeChildAt(i)}
          />
        )
      })}

      <div className="flex flex-wrap gap-1 pt-0.5">
        {/* 속성이 수십 개라(주문: 상태·구역·방문·견적 …) 목록을 훑지 않고 이름으로 찾는다. 고르면 조건이 생기고 선택은 비운다. */}
        <div className="w-56">
          <Select
            size="sm"
            searchable
            options={addItems}
            value=""
            onChange={addCondition}
            placeholder={c.addFilter}
            aria-label={c.addFilter}
          />
        </div>
        {/* 하위 그룹 추가는 루트·1단 그룹에서만(과도한 깊이 방지) */}
        {depth < 2 && (
          <button
            type="button"
            onClick={addSubGroup}
            className="self-start rounded px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface hover:text-fg"
          >
            {c.addFilterGroup}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * 필터 빌더 패널 — 루트 FilterGroup 전체를 트리로 편집.
 *
 * 선결 계약:
 * - onChange 가 루트 op 를 보존한다(op:'or' 루트를 AND 로 강등하지 않음).
 * - 중첩 그룹을 손실하지 않는다.
 * W1 signature(FilterCondition[], rootOp) → W2 로 FilterGroup 전체 onChange 로 변경.
 */
export function FilterBuilder({
  schema,
  root,
  onChange,
}: {
  schema: PropertyDef[]
  root: FilterGroup
  onChange: (next: FilterGroup) => void
}) {
  return <FilterGroupEditor schema={schema} group={root} depth={0} onChange={onChange} />
}
