// 구조 속성(struct) — 자기 값 없이 다른 속성들을 칸(slot)으로 묶어 보이고 고치는 속성(순수, DOM 무관).
//
// 수식 · 롤업과 다르다: 새 값을 계산하지 않는다. 읽을 때 칸이 가리키는 값을 묶고, 고치면 밑 속성을 고친다.
// 그래서 출처 · 이력(수정일 · 수정자 · 횟수)은 밑 속성에 그대로 남고, 구조 속성 키로는 아무것도 쓰지 않는다.
//
// 거르기 · 정렬은 칸 단위다. 조건 키 `구조키.칸`(예: `x:희망가_비교.from`)은 질의 경계에서 밑 키 조건으로
// 풀린다(`resolveStructFilters`) — 상대 날짜와 같은 자리, 같은 이유(실행 계층은 구조 속성을 몰라도 된다).

import { isEmptyCellValue, formatNumberKo } from './aggregations'
import { formatDateValueDisplay } from './date-value'
import { isFilterGroup, normalizeFilterRoot } from './view'

import type {
  FilterCondition,
  FilterGroup,
  FilterNode,
  NumberUnit,
  PropertyDef,
  PropertyValue,
  SelectOption,
  Sort,
  StructConfig,
  StructLayout,
  StructSlot,
  StructSlotRole,
} from './types'

/** 배치마다 쓰는 자리 — 꼭 있어야 하는 자리와 있어도 되는 자리. summary 는 item 만 1~8칸. */
export const STRUCT_LAYOUT_ROLES: Record<
  StructLayout,
  { required: StructSlotRole[]; optional: StructSlotRole[] }
> = {
  compare: { required: ['from', 'to'], optional: ['diff', 'state'] },
  range: { required: ['min', 'max'], optional: ['state'] },
  route: { required: ['from', 'to'], optional: [] },
  summary: { required: ['item'], optional: [] },
}

/** 칸 이름의 기본값(칸 label 도 첫 키의 라벨도 없을 때). */
const ROLE_LABEL: Record<StructSlotRole, string> = {
  from: '기준',
  to: '대상',
  diff: '차이',
  min: '하한',
  max: '상한',
  item: '항목',
  state: '응답',
}

/** 칸의 식별자 — 조건 키 `구조키.칸id` 의 뒷부분. 자리가 겹치는 summary 는 순번을 붙인다(item1, item2…). */
export function structSlotId(
  slot: StructSlot,
  index: number,
  slots: readonly StructSlot[],
): string {
  if (slots.filter((s) => s.role === slot.role).length <= 1) return slot.role
  return `${slot.role}${slots.slice(0, index + 1).filter((s) => s.role === slot.role).length}`
}

/** 칸 조건 키 — `구조키.칸id`. 커스텀 키 문법(`x:[문자·숫자·_-]`)에 `.` 이 없어 겹치지 않는다. */
export function structSlotKey(structKey: string, slotId: string): string {
  return `${structKey}.${slotId}`
}

/** 칸 조건 키 → 구조 속성 키와 칸 id. 구조 칸 키가 아니면 null. */
export function parseStructSlotKey(
  key: string,
  structKeys: ReadonlySet<string>,
): { structKey: string; slotId: string } | null {
  const dot = key.lastIndexOf('.')
  if (dot <= 0) return null
  const structKey = key.slice(0, dot)
  return structKeys.has(structKey) ? { structKey, slotId: key.slice(dot + 1) } : null
}

/** 칸이 가리키는 속성 하나 — 스키마에 있고 구조 속성이 아닌 것만(한 단계). */
export type StructSlotSource = { key: string; def: PropertyDef }

/** 읽은 칸 — 쓰는 값과 그 값을 준 키. 모든 키가 비었으면 value null, used null. */
export type ResolvedStructSlot = {
  id: string
  slot: StructSlot
  label: string
  /** 이 칸이 가리키는 속성(스키마에 없거나 구조 속성인 키는 빠진다 — 폐기된 속성을 가리키는 칸은 빈다). */
  sources: StructSlotSource[]
  /** 앞에서부터 첫 값을 준 속성. */
  used: StructSlotSource | null
  value: PropertyValue
}

export type ResolvedStruct = {
  layout: StructLayout
  slots: ResolvedStructSlot[]
  /** 수 칸을 맞춰 보일 단위(칸 중 만 원이 있으면 만 원, 원만 있으면 원). */
  unit: NumberUnit | null
  /**
   * compare 의 차이 — diff 칸이 있으면 그 값(목록 조건과 같은 계산 열), 없으면 to − from(표시 단위).
   * 둘 중 하나라도 수가 아니면 null.
   */
  diff: number | null
  /** 차이의 좋고 나쁨 — better 와 부호로. 차이가 없거나 better 미지정이면 null. */
  diffTone: 'good' | 'bad' | null
  /** 모든 칸이 비었는가. */
  empty: boolean
  /**
   * 수 칸이 켜졌는가 — state 칸에 activeWhen 밖의 값(「모름」)이 있으면 false. 꺼지면 차이도 없고 표 · 카드는 응답을 보인다.
   */
  active: boolean
  /** state 칸(있으면). */
  state: ResolvedStructSlot | null
}

function schemaIndex(schema: readonly PropertyDef[]): Map<string, PropertyDef> {
  return new Map(schema.map((d) => [d.key, d]))
}

function slotSources(slot: StructSlot, byKey: Map<string, PropertyDef>): StructSlotSource[] {
  return slot.keys.flatMap((key) => {
    const def = byKey.get(key)
    return def && def.type !== 'struct' ? [{ key, def }] : []
  })
}

function slotLabel(slot: StructSlot, sources: StructSlotSource[]): string {
  return slot.label?.trim() || sources[0]?.def.label || ROLE_LABEL[slot.role]
}

/**
 * 행에서 읽은 칸 이름표 — 칸에 이름표를 적지 않았고 쓴 열이 이름표를 행의 다른 값에서 읽으면(`cardLabelKey`) 그 값.
 * 조율 기준가는 출처에 따라 「희망가」·「타업체 견적」으로 선다(보드 카드 요약과 같은 규칙).
 */
function rowSlotLabel(
  slot: StructSlot,
  sources: StructSlotSource[],
  used: StructSlotSource | null,
  props: Record<string, PropertyValue>,
): string {
  const labelKey = slot.label?.trim() ? undefined : used?.def.cardLabelKey
  const fromRow = labelKey ? props[labelKey] : null
  return typeof fromRow === 'string' && fromRow ? fromRow : slotLabel(slot, sources)
}

/** 수 값을 단위 사이에서 바꾼다(원 ↔ 만 원). 단위를 모르면 그대로. */
export function convertUnit(
  n: number,
  from: NumberUnit | undefined,
  to: NumberUnit | null,
): number {
  if (!from || !to || from === to) return n
  return from === 'won' ? n / 10000 : n * 10000
}

function displayUnit(slots: ResolvedStructSlot[]): NumberUnit | null {
  const units = slots.flatMap((s) => s.sources.map((src) => src.def.unit)).filter(Boolean)
  if (units.includes('manwon')) return 'manwon'
  if (units.includes('won')) return 'won'
  return null
}

/** 칸 값을 표시 단위의 수로 — 수가 아니면 null. */
export function slotNumber(slot: ResolvedStructSlot, unit: NumberUnit | null): number | null {
  if (typeof slot.value !== 'number' || !Number.isFinite(slot.value)) return null
  return convertUnit(slot.value, slot.used?.def.unit, unit)
}

/**
 * 구조 속성을 행 값에서 읽는다 — 칸마다 앞에서부터 첫 값.
 *
 * 값은 이미 행에 있다(목록 행이 내장 열과 커스텀 속성 값을 싣고 온다). 서버를 다시 치지 않는다 —
 * 같은 사실의 출처가 둘이 되면 둘이 어긋나는 순간이 생긴다.
 */
export function resolveStruct(
  def: PropertyDef,
  props: Record<string, PropertyValue>,
  schema: readonly PropertyDef[],
): ResolvedStruct | null {
  const config = def.struct
  if (def.type !== 'struct' || !config) return null
  const byKey = schemaIndex(schema)
  const slots = config.slots.map((slot, index): ResolvedStructSlot => {
    const sources = slotSources(slot, byKey)
    const used = sources.find((src) => !isEmptyCellValue(props[src.key])) ?? null
    return {
      id: structSlotId(slot, index, config.slots),
      slot,
      label: rowSlotLabel(slot, sources, used, props),
      sources,
      used,
      value: used ? (props[used.key] ?? null) : null,
    }
  })
  const unit = displayUnit(slots)
  const state = slots.find((s) => s.slot.role === 'state') ?? null
  const active = isActive(state, config.activeWhen)
  const diff = active && config.layout === 'compare' ? compareDiff(slots, unit) : null
  return {
    layout: config.layout,
    slots,
    unit,
    diff,
    diffTone: diffTone(diff, config.better),
    empty: slots.every((s) => s.used === null),
    active,
    state,
  }
}

/** state 칸이 수 칸을 켜는가 — 응답이 비었거나 activeWhen 안이면 켠다. */
function isActive(state: ResolvedStructSlot | null, activeWhen: string[] | undefined): boolean {
  if (!state || !activeWhen || activeWhen.length === 0) return true
  const value = state.value
  if (typeof value !== 'string' || value === '') return true
  return activeWhen.includes(value)
}

function compareDiff(slots: ResolvedStructSlot[], unit: NumberUnit | null): number | null {
  const diffSlot = slots.find((s) => s.slot.role === 'diff')
  if (diffSlot) return slotNumber(diffSlot, unit)
  const from = slots.find((s) => s.slot.role === 'from')
  const to = slots.find((s) => s.slot.role === 'to')
  const a = from ? slotNumber(from, unit) : null
  const b = to ? slotNumber(to, unit) : null
  return a === null || b === null ? null : Math.round((b - a) * 10) / 10
}

function diffTone(diff: number | null, better: StructConfig['better']): 'good' | 'bad' | null {
  if (diff === null || diff === 0 || !better) return null
  return diff > 0 === (better === 'lower') ? 'bad' : 'good'
}

// ─── 표시 글자 ──────────────────────────────────────────────────────────────

/** 단위 붙인 수 — 만 원은 「205만」, 원은 「2,050,000원」, 단위 없음은 천단위 구분. */
export function formatUnitNumber(n: number, unit: NumberUnit | null | undefined): string {
  if (unit === 'manwon') return `${formatNumberKo(n)}만`
  if (unit === 'won') return `${formatNumberKo(n)}원`
  return formatNumberKo(n)
}

/** 부호 붙인 차이 — 「+5만」 · 「-3만」 · 「0」. */
export function formatSignedUnitNumber(n: number, unit: NumberUnit | null): string {
  const body = formatUnitNumber(Math.abs(n), unit)
  if (n > 0) return `+${body}`
  if (n < 0) return `-${body}`
  return body
}

function optionLabel(def: PropertyDef, value: string): string {
  const option = (def.options ?? []).find(
    (o): o is SelectOption => typeof o !== 'string' && o.value === value,
  )
  return option?.label ?? value
}

/** 칸 값 한 조각의 글자 — 수는 표시 단위로, 선택지는 라벨로, 날짜는 날짜 표시로. 비었으면 ''. */
export function slotText(slot: ResolvedStructSlot, unit: NumberUnit | null): string {
  const value = slot.value
  const def = slot.used?.def
  if (!def || isEmptyCellValue(value)) return ''
  if (typeof value === 'number') {
    const n = slotNumber(slot, unit)
    return n === null ? '' : formatUnitNumber(n, def.unit ? unit : null)
  }
  if (typeof value === 'boolean') return value ? '✓' : ''
  if (Array.isArray(value)) return value.map((v) => optionLabel(def, v)).join(', ')
  if (typeof value === 'string') {
    if (def.type === 'date') return formatDateValueDisplay(value, def.dateFormat)
    if (def.type === 'select' || def.type === 'person') return optionLabel(def, value)
    return value
  }
  if (typeof value === 'object' && value && 'roadAddress' in value) return value.roadAddress
  return ''
}

function slotOf(resolved: ResolvedStruct, role: StructSlotRole): ResolvedStructSlot | undefined {
  return resolved.slots.find((s) => s.slot.role === role)
}

/**
 * 표 칸 한 줄 — compare 「200만 → 205만 (+5만)」, range 「90만 ~ 100만」(같으면 하나), route 「A → B」,
 * summary 「a · b · c」. 비었으면 ''. 폭 계산 · CSV · 카드 title 도 이 글자를 쓴다.
 */
export function formatStructText(resolved: ResolvedStruct | null): string {
  if (!resolved || resolved.empty) return ''
  const text = (role: StructSlotRole) => {
    const slot = slotOf(resolved, role)
    return slot ? slotText(slot, resolved.unit) : ''
  }
  // 수 칸이 꺼졌으면 응답이 곧 값이다 — 「모름」.
  if (!resolved.active && resolved.state) return slotText(resolved.state, resolved.unit)
  switch (resolved.layout) {
    case 'compare': {
      const pair = joinPair(text('from'), text('to'), ' → ')
      return resolved.diff === null
        ? pair
        : `${pair} (${formatSignedUnitNumber(resolved.diff, resolved.unit)})`
    }
    case 'range': {
      const [min, max] = [text('min'), text('max')]
      return min && min === max ? min : joinPair(min, max, ' ~ ')
    }
    case 'route':
      return joinPair(text('from'), text('to'), ' → ')
    case 'summary':
      return resolved.slots
        .map((s) => slotText(s, resolved.unit))
        .filter(Boolean)
        .join(' · ')
  }
}

/** 한쪽이 비면 그 자리를 「—」로 — 「200만 → —」. 둘 다 비면 ''. */
function joinPair(a: string, b: string, sep: string): string {
  if (!a && !b) return ''
  return `${a || '—'}${sep}${b || '—'}`
}

// ─── 거르기 · 정렬 ───────────────────────────────────────────────────────────

/**
 * 칸 조건 컬럼 — 필터 편집기 · 자동완성이 칸을 「희망가 비교 › 기준가」로 고를 수 있게 하는 검색 전용 컬럼.
 *
 * 컬럼 자리(표 · 정렬 후보)에는 서지 않는다(`searchOnly`). 칸의 타입 · 선택지 · 단위는 첫 키를 따른다.
 * 키 없이 셈하는 차이(compare 의 diff 칸이 없을 때)는 칸이 아니라 조건 후보가 없다 — 차이로 거르려면
 * diff 칸에 계산 열을 건다.
 */
export function structSlotColumns(schema: readonly PropertyDef[]): PropertyDef[] {
  const byKey = schemaIndex(schema)
  return schema.flatMap((def) => {
    if (def.type !== 'struct' || !def.struct) return []
    const slots = def.struct.slots
    return slots.flatMap((slot, index): PropertyDef[] => {
      const sources = slotSources(slot, byKey)
      const first = sources[0]?.def
      if (!first) return []
      const column: PropertyDef = {
        key: structSlotKey(def.key, structSlotId(slot, index, slots)),
        label: `${def.label} › ${slotLabel(slot, sources)}`,
        type: first.type,
        source: 'projection',
        origin: 'preset',
        searchOnly: true,
      }
      if (first.options) column.options = first.options
      if (first.unit) column.unit = first.unit
      if (first.dateFormat) column.dateFormat = first.dateFormat
      return [column]
    })
  })
}

function structIndex(schema: readonly PropertyDef[]) {
  const structs = new Map(
    schema.filter((d) => d.type === 'struct' && d.struct).map((d) => [d.key, d]),
  )
  return { structs, keys: new Set(structs.keys()), byKey: schemaIndex(schema) }
}

/** 칸 id → 그 칸이 가리키는 (스키마에 있는) 키 목록. 칸을 못 찾으면 null. */
function slotKeys(
  index: ReturnType<typeof structIndex>,
  structKey: string,
  slotId: string,
): string[] | null {
  const slots = index.structs.get(structKey)?.struct?.slots ?? []
  const at = slots.findIndex((slot, i) => structSlotId(slot, i, slots) === slotId)
  if (at < 0) return null
  return slotSources(slots[at] as StructSlot, index.byKey).map((src) => src.key)
}

const EMPTY_OPS = new Set(['is_empty'])
const NOT_EMPTY_OPS = new Set(['is_not_empty'])

/**
 * 칸 조건 하나 → 밑 키 조건. 칸이 「앞에서부터 첫 값」이면 첫 값이 그 키일 때만 조건을 본다:
 *   (k1 조건) OR (k1 비어 있음 AND k2 조건) OR …
 * 「비어 있음」은 모든 키가 비어 있음, 「비어 있지 않음」은 하나라도 있음.
 */
function expandSlotCondition(cond: FilterCondition, keys: string[]): FilterNode {
  // 가리키는 속성이 모두 사라진 칸 — 「비어 있음」은 늘 참, 나머지는 원래 조건을 그대로 둔다
  // (모르는 `x:` 키 조건은 질의 계층이 0건으로 답한다. 빈 OR 그룹은 브리지가 「제약 없음」으로 떨궈 목록이 넓어진다).
  if (keys.length === 0) return EMPTY_OPS.has(cond.op) ? { op: 'and', children: [] } : cond
  if (keys.length === 1) return { ...cond, key: keys[0] as string }
  if (EMPTY_OPS.has(cond.op))
    return { op: 'and', children: keys.map((key) => ({ key, op: 'is_empty' })) }
  if (NOT_EMPTY_OPS.has(cond.op))
    return { op: 'or', children: keys.map((key) => ({ key, op: 'is_not_empty' })) }
  return {
    op: 'or',
    children: keys.map((key, i) => ({
      op: 'and',
      children: [
        ...keys.slice(0, i).map((prev): FilterCondition => ({ key: prev, op: 'is_empty' })),
        { ...cond, key },
      ],
    })),
  }
}

function resolveNode(node: FilterNode, index: ReturnType<typeof structIndex>): FilterNode {
  if (isFilterGroup(node))
    return { op: node.op, children: node.children.map((child) => resolveNode(child, index)) }
  const parsed = parseStructSlotKey(node.key, index.keys)
  if (!parsed) return node
  const keys = slotKeys(index, parsed.structKey, parsed.slotId)
  return keys === null ? node : expandSlotCondition(node, keys)
}

/**
 * 필터 트리의 칸 조건(`구조키.칸`)을 밑 키 조건으로 푼다(순수, 입력 미변형).
 * 질의를 만드는 경계에서 상대값 풀기와 함께 한 번 부른다. 구조 속성이 없으면 그대로 돌려준다.
 */
export function resolveStructFilters(
  filters: FilterGroup,
  schema: readonly PropertyDef[],
): FilterGroup {
  const index = structIndex(schema)
  if (index.keys.size === 0) return filters
  return resolveNode(normalizeFilterRoot(filters), index) as FilterGroup
}

/**
 * 정렬의 칸 키 → 밑 키. 키가 하나인 칸만 정렬할 수 있다(「첫 값」 칸은 서버 COALESCE 정렬이 필요해 아직 아니다) —
 * 그런 칸과 구조 속성 자체의 정렬은 뺀다.
 */
export function resolveStructSorts(sorts: Sort[], schema: readonly PropertyDef[]): Sort[] {
  const index = structIndex(schema)
  if (index.keys.size === 0) return sorts
  return sorts.flatMap((sort) => {
    if (index.keys.has(sort.key)) return []
    const parsed = parseStructSlotKey(sort.key, index.keys)
    if (!parsed) return [sort]
    const keys = slotKeys(index, parsed.structKey, parsed.slotId)
    return keys?.length === 1 ? [{ ...sort, key: keys[0] as string }] : []
  })
}

/**
 * 칸 편집 결과를 밑 속성 값으로 — 수 칸은 표시 단위로 받은 값을 그 속성의 단위로 되돌린다.
 * (카드 · 폼이 「만」으로 보여 주고 원 단위 속성에 쓰는 경우.)
 */
export function toSourceValue(
  value: PropertyValue,
  source: StructSlotSource,
  unit: NumberUnit | null,
): PropertyValue {
  if (typeof value !== 'number') return value
  return convertUnit(value, unit ?? undefined, source.def.unit ?? null)
}

// ─── 저작 ───────────────────────────────────────────────────────────────────

/** 칸 하나에 걸 수 있는 키 수 · summary 칸 수 — 서버 검사와 같은 한도. */
export const STRUCT_MAX_KEYS_PER_SLOT = 4
export const STRUCT_MAX_SUMMARY_SLOTS = 8

/**
 * 칸이 가리킬 수 있는 속성 — 구조 속성 · 검색 전용 · 파생 이력 컬럼(`@`)은 뺀다(한 단계, 값이 있는 것만).
 */
export function structSlotCandidates(schema: readonly PropertyDef[]): PropertyDef[] {
  return schema.filter((d) => d.type !== 'struct' && !d.searchOnly && !d.key.includes('@'))
}

/** 배치를 바꿀 때 칸 뼈대 — 같은 자리의 칸은 옮겨 담는다(비교 → 경로에서 from · to 가 남는다). */
export function structSlotsForLayout(
  layout: StructLayout,
  previous: readonly StructSlot[],
): StructSlot[] {
  if (layout === 'summary') {
    const kept = previous
      .filter((s) => s.keys.length > 0)
      .map((s) => ({ ...s, role: 'item' as const }))
    return kept.length > 0 ? kept.slice(0, STRUCT_MAX_SUMMARY_SLOTS) : [{ role: 'item', keys: [] }]
  }
  const roles = STRUCT_LAYOUT_ROLES[layout]
  // 응답(state) 칸은 맨 앞 — 폼 · 편집기에서 응답을 먼저 고르고 수 칸이 따라 켜진다.
  const ordered = [
    ...roles.optional.filter((r) => r === 'state'),
    ...roles.required,
    ...roles.optional.filter((r) => r !== 'state'),
  ]
  return ordered.map((role) => previous.find((s) => s.role === role) ?? { role, keys: [] })
}

/**
 * 저장 전 검사 — 문제가 있으면 사람이 읽을 한 문장, 없으면 null. 서버도 같은 규칙으로 거절한다
 * (여기는 저장 버튼을 끄고 이유를 보이는 예의다).
 */
export function validateStructConfig(
  config: StructConfig,
  schema: readonly PropertyDef[],
): string | null {
  const byKey = schemaIndex(schema)
  const roles = STRUCT_LAYOUT_ROLES[config.layout]
  for (const role of roles.required) {
    const slot = config.slots.find((s) => s.role === role)
    if (!slot || slot.keys.length === 0)
      return `「${ROLE_LABEL[role]}」 칸에 속성을 하나 이상 고르세요.`
  }
  if (config.layout === 'summary' && config.slots.length > STRUCT_MAX_SUMMARY_SLOTS)
    return `요약 칸은 ${STRUCT_MAX_SUMMARY_SLOTS}개까지입니다.`
  for (const slot of config.slots) {
    if (slot.keys.length > STRUCT_MAX_KEYS_PER_SLOT)
      return `한 칸에는 속성을 ${STRUCT_MAX_KEYS_PER_SLOT}개까지 걸 수 있습니다.`
    for (const key of slot.keys) {
      const def = byKey.get(key)
      if (!def) return `없는 속성을 가리킵니다: ${key}`
      if (def.type === 'struct') return '구조 속성은 다른 구조 속성을 가리킬 수 없습니다.'
    }
  }
  if (config.better && config.layout !== 'compare') return '좋고 나쁨은 비교 배치에만 있습니다.'
  const state = config.slots.find((s) => s.role === 'state' && s.keys.length > 0)
  if (config.activeWhen && config.activeWhen.length > 0 && !state)
    return '「켜는 응답」을 쓰려면 응답 칸에 속성을 고르세요.'
  return null
}

/** 저장할 모양 — 빈 칸(선택 자리) · 빈 이름을 걷어 낸다. */
export function cleanStructConfig(config: StructConfig): StructConfig {
  return {
    layout: config.layout,
    slots: config.slots
      .filter((s) => s.keys.length > 0)
      .map((s) => ({
        role: s.role,
        keys: s.keys,
        ...(s.label?.trim() ? { label: s.label.trim() } : {}),
      })),
    ...(config.layout === 'compare' && config.better ? { better: config.better } : {}),
    ...(config.activeWhen?.length &&
    config.slots.some((s) => s.role === 'state' && s.keys.length > 0)
      ? { activeWhen: config.activeWhen }
      : {}),
  }
}

/** 자리 이름(저작 폼의 칸 머리). */
export function structRoleLabel(role: StructSlotRole): string {
  return ROLE_LABEL[role]
}

// ─── 수 단위 입력 ─────────────────────────────────────────────────────────────

/** 만 원 칸에 이 값 이상이 오면 원으로 적은 것으로 의심한다(1만 만 원 = 1억 원 — 이사 금액에 없는 값). */
export const MANWON_SUSPECT_MIN = 10000

/**
 * 수 입력 글자 → 그 속성 단위의 수. 「1,900,000」「190만」「190만원」「1900000원」을 모두 읽는다.
 *  - 「만」이 붙으면 만 원, 「원」만 붙으면 원으로 읽고 속성 단위로 바꾼다.
 *  - 단위 없이 적은 수는 속성 단위 그대로다.
 *  - suspect: 만 원 칸에 단위 없이 1만 이상을 적었다 — 원으로 적었을 가능성이 크다(호스트가 묻는다).
 * 읽을 수 없으면 value null(빈 글자도 null — 해제).
 */
export function parseUnitNumberInput(
  text: string,
  unit: NumberUnit | undefined,
): { value: number | null; suspect: boolean } {
  const t = text.replace(/[\s,]/g, '')
  if (t === '') return { value: null, suspect: false }
  const match = /^(-?\d+(?:\.\d+)?)(만원?|원)?$/.exec(t)
  if (!match) {
    const n = Number(t)
    return { value: Number.isFinite(n) ? n : null, suspect: false }
  }
  const n = Number(match[1])
  const written: NumberUnit | undefined =
    match[2] === undefined ? undefined : match[2].startsWith('만') ? 'manwon' : 'won'
  if (written) return { value: convertUnit(n, written, unit ?? null), suspect: false }
  return { value: n, suspect: unit === 'manwon' && Math.abs(n) >= MANWON_SUSPECT_MIN }
}

/**
 * 스키마 + 칸 조건 컬럼 — 목록 화면이 스키마를 조립한 끝에 한 번 감싼다(필터 편집기 · 자동완성이 칸을 안다).
 * 구조 속성이 없으면 같은 배열을 돌려준다.
 */
export function withStructSlotColumns(schema: PropertyDef[]): PropertyDef[] {
  const slots = structSlotColumns(schema)
  return slots.length === 0 ? schema : [...schema, ...slots]
}
