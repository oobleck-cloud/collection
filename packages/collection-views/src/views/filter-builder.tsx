'use client'

import {
  Input,
  MultiSelect,
  NumberInput,
  RadioGroup,
  SearchFieldAutocomplete,
  Select,
  Tag,
  X,
  cn,
} from '@oobleck/systheme'
import { useEffect, useId, useState } from 'react'
import type { SelectOption } from '@oobleck/systheme'

import type {
  FilterCondition,
  FilterGroup,
  FilterNode,
  FilterOp,
  PropertyDef,
  PropertyType,
  PropertyValue,
  RelationConfig,
  RelationOption,
  RelationProvider,
  RollupSource,
} from '@oobleck/collection'
import {
  ME_LABEL,
  ME_VALUE,
  isRelativeDateValue,
  isRelativeMeValue,
  relativeDateLabel,
  relativeDayOrdinal,
  type RelativeDateValue,
} from '@oobleck/collection'
import { isFilterGroup } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { viewToolbarCopy } from './ViewToolbar.messages'
import {
  newRollupCondition,
  rollupMeasureOptions,
  rollupMeasureValue,
  rollupOps,
  rollupSourceOf,
  rollupSourceOption,
  useFilterRollups,
  withRollupMeasure,
} from './filter-rollup'

// @oobleck/collection — 필터 트리 편집기(불리언 빌더) + 그 게이팅 함수들.
//
// ViewToolbar 에서 떼어낸 이유: 툴바 모듈은 view-layout-panel → CollectionView 를 거쳐
// **모든 뷰 서피스 레지스트리**를 끌고 온다. 필터 편집기만 쓰고 싶은 쪽(칩 레일, 그리고
// opsFor 하나만 보는 테스트)이 그 그래프를 통째로 지고 갈 이유가 없다.
// 문구(messages)는 툴바와 공유한다 — 같은 어휘를 두 벌로 만들지 않는다.

// ─── 필터 연산자 ─────────────────────────────────────────────────────────────

/**
 * PropertyType → 가능한 필터 연산자 목록(노션식).
 *
 * 관계는 카디널리티가 연산자를 가른다 — 여럿을 담는 관계(`many`)는 multi_select 와 같은 꼴(포함·미포함)이고,
 * 하나를 담는 관계는 select 와 같은 꼴이다. 값 후보는 호스트가 `def.options` 로 채운다(없으면 id 를 적는다).
 */
export function opsFor(type: PropertyType, relation?: RelationConfig): FilterOp[] {
  switch (type) {
    case 'text':
    case 'url':
      return ['contains', 'not_contains', 'eq', 'neq', 'is_empty', 'is_not_empty']
    case 'number':
    case 'date':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is_empty', 'is_not_empty']
    case 'select':
    case 'person':
      return ['eq', 'neq', 'in', 'not_in', 'is_empty', 'is_not_empty']
    case 'relation':
      return relation?.cardinality === 'many'
        ? ['has', 'not_has', 'in', 'not_in', 'is_empty', 'is_not_empty']
        : ['eq', 'neq', 'in', 'not_in', 'is_empty', 'is_not_empty']
    case 'multi_select':
    case 'multi_person':
      return ['has', 'not_has', 'in', 'not_in', 'is_empty', 'is_not_empty']
    case 'geo':
    case 'button':
      // geo/button 은 객체값 — eq/contains/대소비교가 의미 없다. 존재 여부(empty/not_empty)만 방어적으로
      // 허용(#45 geo 전례). 버튼은 필터 후보(isFilterableType)·정렬 후보(isSortableType)에서 아예 제외된다.
      return ['is_empty', 'is_not_empty']
    case 'checkbox':
      return ['eq']
    case 'struct':
      // 구조 속성 자체에는 조건이 없다 — 칸(`구조.칸`, 검색 전용 컬럼)으로 건다(./struct).
      return []
    default:
      return ['eq']
  }
}

/**
 * PropertyType 이 정렬 가능한가 — geo/button 은 객체값이라 안정적 순서가 없어 정렬 후보에서 제외한다(#45 전례).
 * (코어 compareByKey 는 객체로 깨지진 않지만 의미있는 순서가 없어 — UI 에서 무의미한 정렬 키를 애초에 제시하지 않는다.)
 */
export function isSortableType(type: PropertyType): boolean {
  return type !== 'geo' && type !== 'button' && type !== 'struct'
}

/**
 * PropertyType 이 필터 가능한가 — button 은 액션 셀(값 = 라벨·variant 데이터)이라 조건 대상으로
 * 무의미해 필터 조건 추가 후보에서 제외한다(무의미한 필드를 애초에 제시하지 않음 — isSortableType 동형).
 */
export function isFilterableType(type: PropertyType): boolean {
  return type !== 'button' && type !== 'struct'
}

/**
 * 조건 추가 목록의 한 줄 — 속성의 자리(`group`)를 머리글로, 별칭을 검색어로 싣는다.
 * 경로는 머리글이자 검색 중 보조 글이다: 「평점」이 계약 파트너 것인지 참여 파트너 것인지 가른다.
 */
export function propertyOption(def: PropertyDef): SelectOption {
  const path = def.group && def.group.length > 0 ? def.group.join(' › ') : undefined
  return {
    value: def.key,
    label: def.label,
    ...(path ? { group: path, hint: path } : {}),
    ...(def.aliases && def.aliases.length > 0 ? { keywords: def.aliases } : {}),
  }
}

// ─── 필터 값 입력 ─────────────────────────────────────────────────────────────

/** 값을 여러 개 받는 연산자 — 값이 문자열 목록이다. */
export function isMultiValueOp(op: FilterOp): boolean {
  return op === 'in' || op === 'not_in'
}

/**
 * 연산자를 바꿀 때 이미 고른 값을 새 모양으로 옮긴다 — `= 취소됨` 을 `다음 중 하나` 로 바꾸면
 * 취소됨이 첫 값으로 남아야 한다. 되돌릴 때는 첫 값만 남긴다.
 */
export function valueForOp(op: FilterOp, value: PropertyValue | undefined): PropertyValue {
  if (op === 'is_empty' || op === 'is_not_empty') return null
  // 「2시간 전」은 한 분이다 — `= 2시간 전` 은 거의 아무것도 맞히지 않고 `≠` 는 거의 다 맞힌다.
  // 같다·같지 않다로 옮기면 값을 비워 다시 고르게 한다(편집기도 그 연산자에는 시간 단위를 내지 않는다).
  if (!isHourAllowedOp(op) && isRelativeDateValue(value) && value.unit === 'hour') return null
  if (isMultiValueOp(op)) {
    if (Array.isArray(value)) return value
    return typeof value === 'string' && value !== '' ? [value] : []
  }
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** 시간 단위 상대값(「N시간 전/후」·「지금」)을 받는 연산자인가 — 한 분과 같다·같지 않다는 뜻이 서지 않는다. */
function isHourAllowedOp(op: FilterOp): boolean {
  return op !== 'eq' && op !== 'neq'
}

/** select·person 컬럼의 값 후보 — 칩 레일과 편집기가 같은 라벨을 쓴다. */
function optionItems(def: PropertyDef): { value: string; label: string }[] {
  return (Array.isArray(def.options) ? def.options : []).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value },
  )
}

function FilterValueInput({
  def,
  op,
  value,
  onChange,
  relations,
}: {
  def: PropertyDef
  op: FilterOp
  value: PropertyValue | undefined
  onChange: (v: PropertyValue) => void
  relations?: Record<string, RelationProvider>
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  if (op === 'is_empty' || op === 'is_not_empty') return null

  // 관계 대상이 많으면(주문·파트너) 후보를 미리 펼 수 없다 — provider 로 검색해 고른다(참조값).
  const provider =
    def.type === 'relation' && def.relation ? relations?.[def.relation.target] : undefined
  if (provider) {
    return (
      <RelationValueInput
        provider={provider}
        multiple={isMultiValueOp(op)}
        value={value}
        onChange={onChange}
      />
    )
  }

  if (isMultiValueOp(op)) {
    return (
      <MultiSelect
        size="sm"
        searchable
        options={optionItems(def)}
        value={Array.isArray(value) ? value : []}
        onChange={onChange}
        placeholder={c.selectValuePlaceholder}
      />
    )
  }

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

  if (def.type === 'person' || def.type === 'multi_person') {
    return <PersonValueInput def={def} value={value} onChange={onChange} />
  }

  // 관계는 호스트가 후보를 채웠을 때만 고르는 입력이다 — 없으면 아래 텍스트 입력으로 id 를 적는다.
  const pickable = def.type === 'relation' && optionItems(def).length > 0
  if (def.type === 'select' || def.type === 'multi_select' || pickable) {
    return (
      <Select
        size="sm"
        searchable
        options={optionItems(def)}
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
    return (
      <DateValueInput
        value={value}
        onChange={onChange}
        allowHour={isHourAllowedOp(op) && !def.dateOnly}
        dateOnly={def.dateOnly === true}
      />
    )
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
 * 관계 값(참조값) — 검색해서 고른 레코드를 칩으로 보인다. 값은 레코드 id(여럿이면 id 목록)이고, 칩 글자는
 * provider 가 해상한 라벨이다. 하나만 받는 연산자는 새로 고르면 바꾸고, 여럿을 받는 연산자는 더한다.
 */
function RelationValueInput({
  provider,
  multiple,
  value,
  onChange,
}: {
  provider: RelationProvider
  multiple: boolean
  value: PropertyValue | undefined
  onChange: (v: PropertyValue) => void
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const ids = Array.isArray(value)
    ? value.map(String)
    : typeof value === 'string' && value !== ''
      ? [value]
      : typeof value === 'number'
        ? [String(value)]
        : []
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<RelationOption[]>([])
  const [loading, setLoading] = useState(false)

  const idsKey = ids.join('\u0000')
  useEffect(() => {
    const unknown = idsKey === '' ? [] : idsKey.split('\u0000').filter((id) => !(id in labels))
    if (unknown.length === 0) return
    let live = true
    void Promise.resolve(provider.resolve(unknown)).then((found) => {
      if (!live) return
      setLabels((prev) => ({ ...prev, ...Object.fromEntries(found.map((o) => [o.id, o.label])) }))
    })
    return () => {
      live = false
    }
    // labels 는 이미 아는 것을 거르는 데만 쓴다 — 바뀔 때마다 다시 해상할 이유가 없다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, provider])

  useEffect(() => {
    const q = query.trim()
    if (q === '') {
      setOptions([])
      return
    }
    let live = true
    setLoading(true)
    void Promise.resolve(provider.search(q)).then((found) => {
      if (!live) return
      setOptions(found)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [query, provider])

  const pick = (option: { id: string; label: string }) => {
    setLabels((prev) => ({ ...prev, [option.id]: option.label }))
    setQuery('')
    if (!multiple) onChange(option.id)
    else if (!ids.includes(option.id)) onChange([...ids, option.id])
  }
  const remove = (id: string) => {
    if (!multiple) onChange(null)
    else onChange(ids.filter((one) => one !== id))
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {ids.map((id) => (
            <Tag key={id} size="sm" onRemove={() => remove(id)}>
              {labels[id] ?? id}
            </Tag>
          ))}
        </div>
      )}
      {(multiple || ids.length === 0) && (
        <SearchFieldAutocomplete
          size="sm"
          value={query}
          onValueChange={setQuery}
          options={options.map((o) => ({
            id: o.id,
            label: o.label,
            ...(o.hint ? { description: o.hint } : {}),
          }))}
          onOptionSelect={pick}
          minQueryLength={1}
          listDensity="compact"
          isLoading={loading}
          placeholder={c.relationSearchPlaceholder}
        />
      )}
    </div>
  )
}

/**
 * 날짜 조건의 값 — **고정 날짜와 상대 날짜 중 하나**, 그리고 선택으로 **시각**.
 *
 * 저장된 뷰가 어제의 답에 못 박히지 않으려면 상대값을 고를 수 있어야 한다. "오늘 방문" 이라
 * 이름 붙인 뷰가 다음 날 어제를 보여주는 것이 지금까지의 동작이었고, 화면만 봐서는 알 수 없다.
 *
 * 기준 드롭다운을 먼저 고르게 한다 — 고정을 고르면 달력이, 상대를 고르면 그 뜻이 남는다.
 * 두 입력을 나란히 두지 않는 이유: 어느 쪽이 실제로 걸려 있는지 한눈에 갈리지 않는다.
 *
 * 자주 쓰는 말(오늘·어제·이번 주…)은 프리셋으로, 그 밖은 「직접」으로 센다 — 「N일 전/후」와 「N시간 전/후」.
 * 직접을 고르면 숫자 칸과 방향(전/후)이 선다. 저장 형태는 프리셋과 같다(`{unit, offset:±N}`) — 프리셋에 없는
 * 오프셋으로 저장된 뷰(3일 전)를 열면 드롭다운이 「직접」으로 열리고 3 · 「전」이 채워진다.
 * 일 단위 「전」에는 운영이 세는 말 「N일 차」(1일 차 = 당일)를 보조로 붙인다 — 「4일 차」를 걸려는 사람이
 * 3 을 넣어야 하는지 4 를 넣어야 하는지 헷갈리지 않게.
 *
 * 시각 칸은 하루를 가리킬 때(고정 날짜 · 일 단위 상대값)만 선다 — 비워 두면 그날 전체, 채우면 그 분이다
 * (`방문 일시 < 오늘 12:00`). 주·달·시간에 시각을 붙이는 것은 뜻이 서지 않는다(시간은 지금이 시각을 정한다).
 *
 * 「N시간 전/후」는 두 경우에 내지 않는다 — 날짜만 든 컬럼(`dateOnly`: 이사일·세일즈콜 날짜는 그날 0시로 읽혀
 * `이사일 ≥ 지금` 이 오늘 이사를 떨군다)과 같다·같지 않다(한 분과 같은 값은 거의 없다). 같은 이유로 날짜만 든
 * 컬럼에는 시각 칸도 세우지 않는다(이미 시각이 든 저장값은 지울 수 있게 보인다).
 */
function DateValueInput({
  value,
  onChange,
  allowHour,
  dateOnly,
}: {
  value: PropertyValue | undefined
  onChange: (v: PropertyValue) => void
  allowHour: boolean
  dateOnly: boolean
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const relative = isRelativeDateValue(value) ? value : null
  const fixed = typeof value === 'string' ? splitFixedDate(value) : { date: '', time: '' }
  const time = relative ? (relative.time ?? '') : fixed.time
  const showTime =
    (relative ? relative.unit === 'day' : fixed.date !== '') && (!dateOnly || time !== '')
  // 「직접」에 들어선 뒤에는 숫자가 프리셋과 겹쳐도(0·1·7) 숫자 칸을 지킨다 — 2 → 1 로 내린 순간
  // 드롭다운이 「어제」로 튀면 입력하던 칸이 사라진다. 프리셋에 없는 값(3일 전)으로 열린 뷰도 처음부터 직접이다.
  const [stickyCustom, setStickyCustom] = useState(() => isCustomDayValue(relative))
  // 0 에는 전/후가 없다 — 마지막으로 쓴 방향을 기억해 두었다가 0 을 지나 다시 올릴 때 그쪽으로 센다(3후 → 0 → 2후).
  const [lastDirection, setLastDirection] = useState<RelativeDirection>(() =>
    relative && relative.offset > 0 ? 'future' : 'past',
  )
  const mode = dateModeOf(relative, stickyCustom)

  const setTime = (next: string) => {
    if (relative) {
      const { time: _old, ...rest } = relative
      onChange(next ? { ...rest, time: next } : rest)
      return
    }
    onChange(next ? `${fixed.date}T${next}` : fixed.date)
  }

  const options = dateModeOptions(c, relative, mode, allowHour)

  const onModeChange = (next: string) => {
    if (next === mode) return
    if (next === FIXED_DATE) {
      setStickyCustom(false)
      // 상대 → 고정으로 옮길 때 값을 지운다. 남겨 두면 방금 고른 뜻과 다른 날짜가
      // 달력에 남아, 사용자가 고르지 않은 조건이 걸린 채로 보인다.
      onChange(null)
      return
    }
    if (next === CUSTOM_DAY) {
      setStickyCustom(true)
      // 일 단위에서 옮겨 오면 그 날을 그대로 센다(어제 → 1 · 전). 시각도 남긴다.
      const offset = relative?.unit === 'day' ? relative.offset : 0
      onChange(
        time ? { rel: 'date', unit: 'day', offset, time } : { rel: 'date', unit: 'day', offset },
      )
      return
    }
    if (next === CUSTOM_HOUR) {
      setStickyCustom(false)
      onChange({ rel: 'date', unit: 'hour', offset: 0 })
      return
    }
    const preset = RELATIVE_DATE_PRESETS.find((p) => presetKey(p) === next)
    if (!preset) return
    setStickyCustom(false)
    // 고른 시각은 하루를 가리키는 동안 남긴다(오늘 12:00 → 어제 12:00).
    onChange(preset.unit === 'day' && time ? { ...preset, time } : preset)
  }

  // 기준 드롭다운 한 줄, 그 아래 숫자·방향 / 날짜·시각 칸 — 값 칸이 좁아(조건 행의 셋째 칸) 한 줄에 두면 서로 찌그러진다.
  return (
    <div className="flex flex-col gap-1">
      <Select size="sm" options={options} value={mode} onChange={onModeChange} />
      {relative && (mode === CUSTOM_DAY || mode === CUSTOM_HOUR) && (
        <RelativeAmountInput
          value={relative}
          lastDirection={lastDirection}
          onDirectionUsed={setLastDirection}
          onChange={onChange}
        />
      )}
      {(!relative || showTime) && (
        <div className="flex items-center gap-1">
          {!relative && (
            <Input
              size="sm"
              type="date"
              value={fixed.date}
              onValueChange={(date) =>
                onChange(date && fixed.time ? `${date}T${fixed.time}` : date)
              }
            />
          )}
          {showTime && (
            <Input
              size="sm"
              type="time"
              aria-label={c.dateTimeOfDay}
              value={time}
              onValueChange={setTime}
            />
          )}
        </div>
      )}
    </div>
  )
}

type RelativeDirection = 'past' | 'future'

/**
 * 「직접」의 숫자 · 방향 — `offset = ±N`. 숫자는 0 이상 정수로, 눈금마다 상한까지만 받는다.
 * 숫자 칸 옆에 단위(일·시간)를 글로 둔다 — NumberInput 은 단위를 그리지 않는다(anatomy usage.limits.label).
 * 보조 표기: 일 단위 오늘·과거는 「(N+1일 차)」, 시간 0 은 「(지금)」 — 숫자 칸의 설명(aria-describedby)으로도 읽힌다.
 */
function RelativeAmountInput({
  value,
  lastDirection,
  onDirectionUsed,
  onChange,
}: {
  value: RelativeDateValue
  lastDirection: RelativeDirection
  onDirectionUsed: (d: RelativeDirection) => void
  onChange: (v: PropertyValue) => void
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const auxId = useId()
  const hour = value.unit === 'hour'
  const limit = hour ? RELATIVE_HOUR_LIMIT : RELATIVE_DAY_LIMIT
  const amount = Math.abs(value.offset)
  const direction: RelativeDirection =
    value.offset < 0 ? 'past' : value.offset > 0 ? 'future' : lastDirection

  const emit = (n: number, d: RelativeDirection) => {
    // 쓴 방향을 기억한다 — 0 을 지나도(3후 → 0 → 2) 방향이 「전」으로 돌아가지 않게.
    onDirectionUsed(d)
    // -0 을 저장하지 않는다 — 0 은 방향이 없고, 저장값 비교(프리셋 키·테스트)가 갈린다.
    const offset = n === 0 ? 0 : d === 'past' ? -n : n
    onChange({ ...value, offset })
  }

  const ordinal = relativeDayOrdinal(value)
  const aux = hour
    ? amount === 0
      ? c.relativeNow
      : null
    : ordinal !== null && direction === 'past'
      ? c.relativeDayOrdinal(ordinal)
      : null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <NumberInput
          size="sm"
          className="min-w-0 flex-1"
          aria-label={hour ? c.relativeHourCount : c.relativeDayCount}
          aria-describedby={aux ? auxId : undefined}
          min={0}
          max={limit}
          value={amount}
          onChange={(n) => emit(clampAmount(n, limit), direction)}
        />
        <span className="text-xs whitespace-nowrap text-fg-muted">
          {hour ? c.relativeHourUnit : c.relativeDayUnit}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroup
          size="sm"
          orientation="horizontal"
          aria-label={c.relativeDirection}
          value={direction}
          options={[
            { value: 'past', label: c.relativePast },
            { value: 'future', label: c.relativeFuture },
          ]}
          onChange={(next) => emit(amount, next === 'future' ? 'future' : 'past')}
        />
        {aux && (
          <span id={auxId} className="text-xs whitespace-nowrap text-fg-muted tabular-nums">
            ({aux})
          </span>
        )}
      </div>
    </div>
  )
}

/** 숫자 칸 → 0 이상 정수, 상한까지. 소수·음수·넘친 값은 가까운 쪽으로 접는다. */
function clampAmount(n: number, limit: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(limit, Math.max(0, Math.trunc(n)))
}

/** 기준 드롭다운의 자리들 — 고정 · 프리셋 · 직접(일·시간). */
function dateModeOptions(
  c: ReturnType<typeof viewToolbarCopy>,
  relative: RelativeDateValue | null,
  mode: string,
  allowHour: boolean,
): SelectOption[] {
  const options: SelectOption[] = [
    { value: FIXED_DATE, label: c.dateModeFixed },
    ...RELATIVE_DATE_PRESETS.map((preset) => ({
      value: presetKey(preset),
      label: relativeDateLabel(preset),
    })),
    { value: CUSTOM_DAY, label: c.dateModeCustomDay },
    ...(allowHour ? [{ value: CUSTOM_HOUR, label: c.dateModeCustomHour }] : []),
  ]
  // 프리셋에도 직접에도 없는 저장값(3주 전처럼 예전에 다른 경로로 저장된 주·달, 시간을 내지 않는 자리에 이미 걸린
  // 시간 값)은 그 뜻 그대로 한 자리를 더 둔다 — 없으면 드롭다운이 빈 칸으로 보여 무엇이 걸렸는지 알 수 없다.
  if (!options.some((o) => o.value === mode) && relative) {
    options.push({
      value: mode,
      label: mode === CUSTOM_HOUR ? c.dateModeCustomHour : relativeDateLabel(relative),
    })
  }

  return options
}

/** 저장값 → 기준 드롭다운의 자리. 시간은 언제나 직접, 일 단위는 프리셋에 없거나 직접에 들어선 뒤면 직접. */
function dateModeOf(relative: RelativeDateValue | null, stickyCustom: boolean): string {
  if (!relative) return FIXED_DATE
  if (relative.unit === 'hour') return CUSTOM_HOUR
  if (relative.unit === 'day' && (stickyCustom || isCustomDayValue(relative))) return CUSTOM_DAY
  return presetKey(relative)
}

/** 프리셋에 없는 일 단위 값인가(3일 전·10일 후) — 편집기가 처음부터 「직접」으로 연다. */
function isCustomDayValue(relative: RelativeDateValue | null): boolean {
  if (!relative || relative.unit !== 'day') return false
  const key = presetKey(relative)
  return !RELATIVE_DATE_PRESETS.some((p) => presetKey(p) === key)
}

/** 고정 날짜 값 → 날짜·시각 칸(`2026-10-17T12:00` → 2026-10-17 · 12:00). */
function splitFixedDate(value: string): { date: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(value)
  return m ? { date: m[1] ?? '', time: m[2] ?? '' } : { date: '', time: '' }
}

/** 사람 값 드롭다운의 「나」 자리 — 계정 id(UUID)와 겹치지 않는 키. */
const ME_KEY = '@me'

/**
 * 사람 조건의 값 — 「나」 + 명단(호스트가 `def.options` 로 채운 계정). 값은 계정 id 로 저장된다.
 *
 * 「나」는 계정 id 가 아니라 상대값(`{rel:'me'}`)으로 저장한다. 보기를 저장하면 그 보기를 연
 * 사람마다 자기 것이 보여야 하기 때문이다(질의 경계에서 보는 사람으로 풀린다).
 * 비활성 계정도 목록에 남긴다 — 지난 담당 기록으로 거르는 것은 여전히 뜻이 있다.
 */
function PersonValueInput({
  def,
  value,
  onChange,
}: {
  def: PropertyDef
  value: PropertyValue | undefined
  onChange: (v: PropertyValue) => void
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const people = (Array.isArray(def.options) ? def.options : []).flatMap((o) =>
    typeof o === 'string' ? [] : [{ value: o.value, label: o.label ?? o.value }],
  )
  return (
    <Select
      size="sm"
      searchable
      options={[{ value: ME_KEY, label: ME_LABEL }, ...people]}
      value={isRelativeMeValue(value) ? ME_KEY : typeof value === 'string' ? value : ''}
      onChange={(next) => onChange(next === ME_KEY ? ME_VALUE : next)}
      placeholder={c.selectValuePlaceholder}
    />
  )
}

/** 기준 드롭다운의 "고정 날짜" 자리 — 상대 프리셋 키와 겹치지 않는 값. */
const FIXED_DATE = 'fixed'

/** 기준 드롭다운의 「직접」 자리 — 프리셋 키(`unit:offset`)와 겹치지 않는 값. */
const CUSTOM_DAY = 'custom:day'
const CUSTOM_HOUR = 'custom:hour'

/** 「직접」 숫자의 상한 — 일은 10년, 시간은 30일. 그보다 먼 조건은 고정 날짜가 더 읽힌다. */
const RELATIVE_DAY_LIMIT = 3650
const RELATIVE_HOUR_LIMIT = 720

/** 상대값 → 드롭다운 키. 저장 형태(unit·offset)에서 파생하므로 목록과 값이 어긋나지 않는다. */
function presetKey(value: RelativeDateValue): string {
  return `${value.unit}:${value.offset}`
}

/**
 * 이름으로 고르는 상대 날짜. 운영에서 실제로 쓰는 말만 둔다 — 목록이 길어지면 고르는 일이
 * 느려진다. 그 밖의 오프셋은 「직접」(N일 전/후 · N시간 전/후)이 받는다.
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
  relations,
}: {
  schema: PropertyDef[]
  condition: FilterCondition
  onChange: (next: FilterCondition) => void
  onRemove: () => void
  /** 관계 속성의 값을 검색해 고르는 provider(`relation.target` 키) — 롤업 대상 조건이 참조값을 고를 때. */
  relations?: Record<string, RelationProvider>
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const rollups = useFilterRollups()
  if (condition.rollup) {
    const source = rollupSourceOf(rollups, condition.key)
    return source ? (
      <RollupConditionRow
        source={source}
        condition={condition}
        onChange={onChange}
        onRemove={onRemove}
      />
    ) : null
  }
  const def = schema.find((d) => d.key === condition.key)
  if (!def) return null
  const ops = opsFor(def.type, def.relation)
  // 명시적 grid: 속성명 · 연산자 · 값(채움) · 제거. 내부 DS 컨트롤(combobox/input)을
  // 강제로 cell 폭에 맞춰(w-full) 값 입력이 찌그러지지 않게 한다.
  return (
    <div className="grid grid-cols-[4.5rem_5.5rem_minmax(0,1fr)_1.25rem] items-center gap-1 [&_button[role=combobox]]:w-full [&_input]:w-full">
      <span className="truncate text-xs text-fg">{def.label}</span>
      <Select
        size="sm"
        options={ops.map((op) => ({ value: op, label: c.opLabel(op) }))}
        value={condition.op}
        onChange={(next) => {
          const op = next as FilterOp
          onChange({ ...condition, op, value: valueForOp(op, condition.value) })
        }}
      />
      <div className="min-w-0">
        <FilterValueInput
          def={def}
          op={condition.op}
          value={condition.value}
          onChange={(v) => onChange({ ...condition, value: v })}
          relations={relations}
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
 * 관계 집계(롤업) 조건 행 — 첫 줄은 「견적 · 개수 ≥ 3」, 그 아래 들여 쓴 칸은 「이어진 견적 중」 대상 조건(모두 만족).
 *
 * 대상 조건은 AND 만 받는다 — 하위 그룹이 없다. 조건 한 줄은 바깥 목록과 같은 부품(FilterConditionRow)이고,
 * 관계 속성(주문·파트너)은 원천의 provider 로 검색해 고른다(「주문 A 에 낸 견적 중」).
 */
function RollupConditionRow({
  source,
  condition,
  onChange,
  onRemove,
}: {
  source: RollupSource
  condition: FilterCondition
  onChange: (next: FilterCondition) => void
  onRemove: () => void
}) {
  const c = viewToolbarCopy(useCollectionLocale())
  const rollup = condition.rollup!
  const where = rollup.where.filter((n): n is FilterCondition => !isFilterGroup(n))
  const setWhere = (next: FilterCondition[]) =>
    onChange({ ...condition, rollup: { ...rollup, where: next } })
  const addWhere = (key: string) => {
    const def = source.schema.find((d) => d.key === key)
    if (!def) return
    setWhere([...where, { key, op: opsFor(def.type, def.relation)[0], value: null }])
  }
  const ops = rollupOps(rollup.agg)
  const valueless = condition.op === 'is_empty' || condition.op === 'is_not_empty'

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem_4.5rem_1.25rem] items-center gap-1 [&_button[role=combobox]]:w-full [&_input]:w-full">
        <span className="truncate text-xs font-medium text-fg">{source.label}</span>
        <Select
          size="sm"
          options={rollupMeasureOptions(source, c)}
          value={rollupMeasureValue(rollup.agg, rollup.field)}
          onChange={(next) => onChange(withRollupMeasure(condition, next))}
        />
        <Select
          size="sm"
          options={ops.map((op) => ({ value: op, label: c.opLabel(op) }))}
          value={condition.op}
          onChange={(next) => {
            const op = next as FilterOp
            onChange({ ...condition, op, value: valueForOp(op, condition.value) })
          }}
        />
        {valueless ? (
          <span />
        ) : (
          <Input
            size="sm"
            type="number"
            value={typeof condition.value === 'number' ? String(condition.value) : ''}
            onValueChange={(raw) => {
              const n = raw === '' ? null : Number(raw)
              onChange({ ...condition, value: n !== null && Number.isFinite(n) ? n : null })
            }}
          />
        )}
        <button
          type="button"
          aria-label={c.remove}
          onClick={onRemove}
          className="inline-flex size-5 items-center justify-center justify-self-end rounded text-fg-muted hover:bg-surface hover:text-fg"
        >
          <X className="size-3" />
        </button>
      </div>
      <div className="ml-2 flex flex-col gap-1 border-l border-border/60 pl-2">
        <span className="text-[10px] text-fg-muted">
          {where.length > 0 ? c.rollupWhere(source.label) : c.rollupAllLinked(source.label)}
        </span>
        {where.map((child, i) => (
          <FilterConditionRow
            key={`${child.key}_${i}`}
            schema={source.schema}
            condition={child}
            relations={source.relations}
            onChange={(next) => setWhere(where.map((w, j) => (j === i ? next : w)))}
            onRemove={() => setWhere(where.filter((_, j) => j !== i))}
          />
        ))}
        <div className="w-48">
          <Select
            size="sm"
            searchable
            options={source.schema.filter((d) => isFilterableType(d.type)).map(propertyOption)}
            value=""
            onChange={addWhere}
            placeholder={c.rollupAddCondition(source.label)}
            aria-label={c.rollupAddCondition(source.label)}
          />
        </div>
      </div>
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
  const rollups = useFilterRollups()
  const addCondition = (key: string) => {
    const source = rollupSourceOf(rollups, key)
    if (source) {
      onChange({ ...group, children: [...group.children, newRollupCondition(source)] })
      return
    }
    const def = schema.find((d) => d.key === key)
    if (!def) return
    const ops = opsFor(def.type, def.relation)
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
  // 롤업 원천(「견적 (집계)」)은 「관계」 머리글로 맨 뒤에 붙는다.
  const addItems = [
    ...schema.filter((d) => isFilterableType(d.type)).map(propertyOption),
    ...rollups.map((source) => rollupSourceOption(source, c)),
  ]

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
