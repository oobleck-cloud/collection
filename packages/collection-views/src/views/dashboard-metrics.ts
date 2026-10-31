// @oobleck/collection — 대시보드 지표 계산 순수 변환(#37).
//
// DashboardView 에서 분리한 순수 모듈(React·DOM·@oobleck/systheme 비의존) — 단위 테스트 용이.
// "필터된 행 + 스키마 → 지표 요약(총 레코드 수 + select/multi_select 분포 카드)" 변환만 담당한다.
// 분포 막대 모델은 차트 뷰와 동일한 toBars 를 재사용한다(막대 수학 재구현 없음).
//
// 그룹 버킷팅 자체는 코어 viewGroups 가 한다 — 여기서는 그 결과(키+행수)를 toBars 로 넘길 뿐.
// multi_select 는 viewGroups 의 fan-out(한 행이 멤버 수만큼 여러 그룹)을 그대로 따른다.

import type { PropertyDef, PropertyValue, ViewConfig } from '@oobleck/collection'
import { normalizeOptions } from '@oobleck/collection'
import { viewGroups, type Row } from '@oobleck/collection'
import { toBars, type ChartBar } from './chart-bars'

/** 분포 카드가 대상으로 삼는 프로퍼티 타입(노션식 카테고리 축). */
const DISTRIBUTION_TYPES: ReadonlySet<PropertyDef['type']> = new Set(['select', 'multi_select'])

/** 표시할 분포 카드 수 상한 — 첫 N 개 select/multi_select 만(과밀 방지, v1 고정). */
export const MAX_DISTRIBUTIONS = 4

/** 한 분포 카드의 표시 모델 — 프로퍼티 식별 + 라벨 + 값 분포 막대(toBars 산출). */
export type DashboardDistribution = {
  /** 대상 프로퍼티 키(React key·식별용). */
  key: string
  /** 대상 프로퍼티 라벨(카드 제목). */
  label: string
  /** 값 분포 막대 목록(차트 뷰와 동일 모델 — 라벨·count·pct·색). */
  bars: ChartBar[]
}

/** buildDashboardMetrics 결과 — 총 레코드 수 + 분포 카드 목록. */
export type DashboardMetrics = {
  /** 필터된 총 레코드 수(Total 카드). */
  total: number
  /** select/multi_select 분포 카드(첫 MAX_DISTRIBUTIONS 개). 없으면 빈 배열. */
  distributions: DashboardDistribution[]
}

/** buildDashboardMetrics 옵션 — 어떤 모수를 세고 있는지(서버 모드) 알린다. */
export type DashboardMetricsOptions = {
  /**
   * 행이 이미 걸러져 왔는가(서버 모드). true 면 필터를 다시 적용하지 않는다.
   * 자세한 계약은 `view.ViewGroupsOptions.preFiltered`.
   */
  preFiltered?: boolean
}

/**
 * select/multi_select 프로퍼티의 옵션 정의 → 그룹 키 라벨/색 맵(ChartView 동일 규칙).
 * 옵션 라벨이 있으면 그것을, 색이 있으면(또는 해시 폴백) 막대 색으로 쓴다.
 */
function optionMaps(def: PropertyDef): {
  labelMap: Map<string, string>
  colorMap: Map<string, string>
} {
  const labelMap = new Map<string, string>()
  const colorMap = new Map<string, string>()
  for (const opt of normalizeOptions(def.options)) {
    labelMap.set(opt.value, opt.label ?? opt.value)
    if (opt.color) colorMap.set(opt.value, opt.color)
  }
  return { labelMap, colorMap }
}

/**
 * 필터된 행 + 스키마 → 대시보드 지표(순수). 사이드 이펙트·DOM 없음.
 *  - total: rows.length(이미 viewRows 가 적용된 행을 받는다 — 필터링은 호출자 책임).
 *  - distributions: 스키마의 select/multi_select 프로퍼티 중 앞에서 MAX_DISTRIBUTIONS 개.
 *      각 카드의 막대는 viewGroups(groupBy=prop.key, multiGroup=multi_select 여부)로 버킷팅 후 toBars.
 *      multi_select 면 한 행이 멤버 수만큼 여러 그룹에 fan-out(코어 viewGroups 규칙 그대로).
 * select/multi_select 가 하나도 없으면 distributions=[] (Total 카드만 — 항상 동작).
 *
 * @param rows  이미 viewRows(필터·정렬)가 적용된 행 목록.
 * @param schema 컬럼 정의(분포 카드 후보 — 순서가 표시 순서).
 * @param view  뷰 설정(분포 버킷팅의 바탕 — groupBy 는 프로퍼티마다 덮어쓴다).
 * @param opts  서버 모드 여부(preFiltered) — 필터 재적용을 막는다.
 */
export function buildDashboardMetrics(
  rows: Row<Record<string, PropertyValue>>[],
  schema: PropertyDef[],
  view: ViewConfig,
  opts: DashboardMetricsOptions = {},
): DashboardMetrics {
  // 행이 없으면 분포도 없다(빈 막대 카드만 늘어나는 무의미한 출력 방지) — total 0 + 빈 분포.
  if (rows.length === 0) return { total: 0, distributions: [] }

  const distributionDefs = schema
    .filter((d) => DISTRIBUTION_TYPES.has(d.type))
    .slice(0, MAX_DISTRIBUTIONS)

  const distributions = distributionDefs.map((def) => {
    const isMulti = def.type === 'multi_select'
    const { labelMap, colorMap } = optionMaps(def)
    // 코어 viewGroups 로 버킷팅(필터·multi_select fan-out 재사용). 그 키+행수를 toBars 로 변환.
    // groupBy 를 이 프로퍼티 키로 덮어쓰고, 자동 요약이 *결정적*이도록 정렬·빈그룹 정책을 고정한다
    // (영속 view 의 groupSort/hideEmptyGroups 가 분포에 새는 것 방지): 빈도 내림차순 + '없음' 표시.
    const groups = viewGroups(
      rows,
      { ...view, groupBy: def.key, groupSort: 'count', hideEmptyGroups: false },
      { multiGroup: isMulti, groupLabelMap: labelMap, preFiltered: opts.preFiltered ?? false },
    )
    const bars = toBars(
      groups.map((g) => ({ key: g.key, count: g.rows.length })),
      labelMap,
      colorMap,
    )
    return { key: def.key, label: def.label, bars }
  })

  return { total: rows.length, distributions }
}
