'use client'

import { createContext, createElement, useContext } from 'react'

import type {
  FilterCondition,
  FilterOp,
  PropertyDef,
  RollupAgg,
  RollupSource,
} from '@oobleck/collection'
import type { ReactNode } from 'react'

// @oobleck/collection — 관계 집계(롤업) 조건의 원천과 그 규칙.
//
// 롤업은 표 컬럼이 아니라 **거르기만 하는 조건**이다: 「이 파트너가 낸 견적 중 (주문 = A) 의 개수 ≥ 1」.
// 어떤 관계를 셀 수 있는지는 호스트가 안다 — 스키마에 끼워 넣으면 표·속성 패널·CSV 가 모두 가짜 컬럼을 보게 되므로
// 필터 편집기와 칩 레일만 읽는 context 로 따로 알린다.

const FilterRollupContext = createContext<readonly RollupSource[]>([])

/** 필터 편집기·칩 레일에 롤업 원천을 알린다. 없으면 롤업 조건을 만들 수 없고, 저장된 롤업 칩은 키로 보인다. */
export function FilterRollupProvider({
  sources,
  children,
}: {
  sources: readonly RollupSource[]
  children?: ReactNode
}) {
  return createElement(FilterRollupContext.Provider, { value: sources }, children)
}

export function useFilterRollups(): readonly RollupSource[] {
  return useContext(FilterRollupContext)
}

/** 셈 선택지의 값 — `count` 또는 `sum:price` 꼴. */
export type RollupMeasureValue = string

export function rollupMeasureValue(agg: RollupAgg, field?: string): RollupMeasureValue {
  return agg === 'count' || !field ? 'count' : `${agg}:${field}`
}

export function parseRollupMeasure(value: RollupMeasureValue): { agg: RollupAgg; field?: string } {
  const [agg, field] = value.split(':') as [RollupAgg, string | undefined]
  return agg === 'count' || !field ? { agg: 'count' } : { agg, field }
}

/** 셈의 낱말 — 툴바 문구(`viewToolbarCopy`)의 일부. */
export type RollupCopy = {
  rollupCount: string
  rollupAgg: Record<Exclude<RollupAgg, 'count'>, string>
  rollupGroup: string
  rollupSourceOption: (source: string) => string
}

const FIELD_AGGS = ['sum', 'min', 'max', 'avg'] as const

/** 셈 선택지 — 개수, 그리고 숫자 속성마다 합계·최소·최대·평균. */
export function rollupMeasureOptions(
  source: RollupSource,
  t: RollupCopy,
): { value: string; label: string }[] {
  const numeric = source.schema.filter((d) => d.type === 'number')
  return [
    { value: 'count', label: t.rollupCount },
    ...numeric.flatMap((d) =>
      FIELD_AGGS.map((agg) => ({
        value: rollupMeasureValue(agg, d.key),
        label: `${d.label} ${t.rollupAgg[agg]}`,
      })),
    ),
  ]
}

/** 셈의 말 — 「개수」·「견적가 최소」. 모르는 필드는 키로. */
export function rollupMeasureLabel(
  source: RollupSource | undefined,
  agg: RollupAgg,
  field: string | undefined,
  t: RollupCopy,
): string {
  if (agg === 'count' || !field) return t.rollupCount
  const def = source?.schema.find((d) => d.key === field)
  return `${def?.label ?? field} ${t.rollupAgg[agg]}`
}

/**
 * 셈 결과와 비교하는 연산자. 개수·합계는 언제나 숫자라 비어 있음이 없고, 최소·최대·평균은 이어진 값이 없으면
 * 비어 있다(견적이 없는 주문의 최저가).
 */
export function rollupOps(agg: RollupAgg): FilterOp[] {
  const compare: FilterOp[] = ['gte', 'gt', 'eq', 'neq', 'lte', 'lt']
  return agg === 'count' || agg === 'sum' ? compare : [...compare, 'is_empty', 'is_not_empty']
}

/** 원천을 고른 직후의 조건 — 개수, 대상 조건 없음, 값은 비어 있다(채우기 전에는 목록을 좁히지 않는다). */
export function newRollupCondition(source: RollupSource): FilterCondition {
  return { key: source.key, op: 'gte', value: null, rollup: { agg: 'count', where: [] } }
}

/** 셈이 바뀌면 연산자가 새 셈에 없을 수 있다 — 그때는 「≥」로. */
export function withRollupMeasure(condition: FilterCondition, value: RollupMeasureValue) {
  const { agg, field } = parseRollupMeasure(value)
  const op = rollupOps(agg).includes(condition.op) ? condition.op : 'gte'
  return {
    ...condition,
    op,
    value: op === 'is_empty' || op === 'is_not_empty' ? null : (condition.value ?? null),
    rollup: { ...condition.rollup!, agg, ...(field ? { field } : { field: undefined }) },
  }
}

/** 조건 추가 목록의 한 줄 — 원천은 「관계」 머리글 아래에 뜬다. */
export function rollupSourceOption(source: RollupSource, t: RollupCopy) {
  return {
    value: source.key,
    label: t.rollupSourceOption(source.label),
    group: t.rollupGroup,
    hint: t.rollupGroup,
  }
}

export function rollupSourceOf(
  sources: readonly RollupSource[],
  key: string,
): RollupSource | undefined {
  return sources.find((s) => s.key === key)
}

/** 대상 속성 정의 — 원천이 없으면(호스트가 알리지 않은 화면) undefined. */
export function rollupTargetDef(
  source: RollupSource | undefined,
  key: string,
): PropertyDef | undefined {
  return source?.schema.find((d) => d.key === key)
}
