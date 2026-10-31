// @mvos/collections — 영속된 뷰 설정의 스키마 드리프트 정리(reconcile).
//
// 왜 필요한가:
//   뷰 설정을 저장하는 순간, 저장된 것과 코드가 선언한 컬럼이 어긋날 수 있다. 컬럼 키를 하나
//   지우거나 이름을 바꾸면, 어제 저장된 뷰는 이제 없는 키를 가리킨다. 그걸 그대로 렌더러에
//   넘기면 조용히 나쁜 일이 벌어진다:
//     - `visibleProps` 가 전부 죽은 키면 resolveVisibleColumns 가 빈 배열을 반환한다 → **컬럼 0개**.
//     - 필터 조건의 키가 죽으면 그 조건은 항상 거짓이다(readProp → null) → **행 0개**.
//   둘 다 "표가 하얗게 빈다". 사용자는 자기가 저장한 뷰가 화면을 지웠다는 것도 모른다.
//
// 규칙은 하나다 — **드리프트는 넓히는 쪽으로 무너진다**. 모르는 키를 가리키는 설정은 버리고
// 기본값으로 돌아간다. 좁히는 쪽(빈 컬럼·빈 행)으로는 절대 무너지지 않는다.
//
// 키 집합이 둘인 이유(columnKeys / valueKeys):
//   컬럼으로 그려지지 않지만 행 props 에는 있는 **파생 키**가 있다(예: 주문 목록의
//   `__visitScheduled` — 조건부 서식의 근거일 뿐 표에 세우지 않는 열). 스키마 컬럼만으로
//   잘라내면 이런 코드 소유 규칙이 통째로 사라진다. 그래서 "그려지는 자리"(columnKeys)와
//   "값을 읽는 자리"(valueKeys)를 나눈다.

import { isFilterGroup } from './view'

import type { AggregationType, CollectionViewConfig, FilterExpr, FilterNode, Sort } from './types'
import type { ConditionalFormatRule } from './conditional-format'

/** reconcileViewConfig 가 "살아있는 키"를 판단하는 기준. */
export type ViewKeySets = {
  /**
   * 스키마가 실제로 그리는 컬럼 키 — visibleProps·aggregations·coverKey·timeline·
   * conditionalFormats.target·groupBy 처럼 **화면의 자리를 가리키는** 설정의 판정 기준.
   */
  columnKeys: readonly string[]
  /**
   * 행 props 에서 값을 읽을 수 있는 키 — 필터·정렬·조건부 서식 조건처럼 **값을 평가하는**
   * 설정의 판정 기준. 파생 프로퍼티를 포함한다. 미지정 시 columnKeys 와 같다.
   */
  valueKeys?: readonly string[]
  /**
   * 표시 목록에 **자동으로 붙일** 컬럼 키. 미지정 시 columnKeys 와 같다(현행 동작).
   *
   * columnKeys 와 갈라지는 이유: `hiddenByDefault` 컬럼은 살아 있는 컬럼이지만(사용자가 켜 두면
   * 그대로 남아야 한다) 저절로 세워지면 안 된다. 두 판정을 한 집합으로 하면 둘 중 하나를
   * 포기하게 된다 — 켜 둔 것이 다음 로드에 지워지거나, 켜지 않은 것이 저절로 선다.
   */
  autoShowKeys?: readonly string[]
}

/** 노드 정리 결과 — null 은 "이 노드는 통째로 버린다"(부모 children 에서 빠짐). */
type PrunedNode = FilterNode | null

/**
 * 필터 트리에서 죽은 키의 조건을 걷어낸다.
 *
 * 빈 그룹 처리가 핵심이다. `{op:'or', children:[죽은 조건]}` 을 자식만 비우고 남기면 빈 OR 은
 * "통과 조건 0개" = **모두 탈락**이 되어 표가 빈다(passesFilterNode 의 정의). 그래서 자식이
 * 다 걷힌 그룹은 남기지 않고 **부모에서 제거**한다 — 조건이 사라지는 방향, 즉 행이 더 보이는
 * 쪽으로 무너뜨린다.
 */
function pruneFilterNode(node: FilterNode, valueKeys: ReadonlySet<string>): PrunedNode {
  if (!isFilterGroup(node)) return valueKeys.has(node.key) ? node : null
  const children = node.children
    .map((child) => pruneFilterNode(child, valueKeys))
    .filter((child): child is FilterNode => child !== null)
  // 원래도 비어 있던 그룹(사용자가 조건을 다 지운 상태)은 보존한다 — 그건 드리프트가 아니다.
  if (children.length === 0 && node.children.length > 0) return null
  return { op: node.op, children }
}

/**
 * 필터 표현(루트) 정리 — 루트는 항상 살아남되, 자식이 다 걷히면 빈 AND(= 모두 통과)가 된다.
 * 레거시 평탄 배열도 그대로 받는다(정규화는 toViewConfig 가 한다).
 */
function pruneFilterExpr(expr: FilterExpr, valueKeys: ReadonlySet<string>): FilterExpr {
  if (Array.isArray(expr)) return expr.filter((c) => valueKeys.has(c.key))
  const pruned = pruneFilterNode(expr, valueKeys)
  if (pruned === null) return { op: 'and', children: [] }
  // 루트가 잎일 수는 없다(FilterExpr 루트는 FilterGroup) — 타입 좁히기용 가드.
  return isFilterGroup(pruned) ? pruned : { op: 'and', children: [pruned] }
}

/** 필터 표현에 조건이 하나라도 남아 있는가 — 조건부 서식 규칙의 생존 판정에 쓴다. */
function hasCondition(expr: FilterExpr): boolean {
  if (Array.isArray(expr)) return expr.length > 0
  return expr.children.some((child) => (isFilterGroup(child) ? hasCondition(child) : true))
}

/**
 * 조건부 서식 규칙 정리.
 *  - `target` 이 죽은 컬럼이면 칠할 자리가 없다 → 규칙 제거.
 *  - `when` 의 조건이 전부 걷히면 규칙이 **모든 행에 항상 적용**된다(빈 AND = 통과). 표 전체가
 *    빨개지는 것도 조용한 사고다 → 규칙 제거. (원래부터 조건이 빈 규칙은 사용자가 만든 게
 *    아니므로 이 경우도 같이 떨어진다.)
 */
function pruneConditionalFormats(
  rules: readonly ConditionalFormatRule[],
  columnKeys: ReadonlySet<string>,
  valueKeys: ReadonlySet<string>,
): ConditionalFormatRule[] {
  return rules.flatMap((rule) => {
    if (rule.target !== undefined && !columnKeys.has(rule.target)) return []
    const when = pruneFilterExpr(rule.when, valueKeys)
    if (!hasCondition(when)) return []
    return [{ ...rule, when }]
  })
}

/**
 * visibleProps 정리 — 죽은 키를 걷어내고, **그 사이 새로 생긴 컬럼을 뒤에 붙인다**.
 *
 * 새 컬럼을 붙이는 이유: 저장된 순간의 목록을 그대로 존중하면, 그 뒤 추가된 컬럼은 이 사용자
 * 화면에서 영원히 안 보인다(뷰를 저장했다는 이유만으로 신기능이 사라진다). 순서는 사용자가
 * 정한 것이 앞, 새 것이 뒤 — 사용자의 선택을 재배치하지 않으면서 새 컬럼을 드러낸다.
 *
 * 전부 죽어서 남는 게 없으면 `undefined` 를 반환한다 — 빈 배열을 남기면 "선택 0개"가 아니라
 * resolveVisibleColumns 의 폴백(스키마 전체)로 접히긴 하지만, 그건 우연히 맞는 것이다.
 * 필드를 지워 기본값으로 돌아가는 쪽이 의도가 분명하다.
 */
function pruneVisibleProps(
  visibleProps: readonly string[],
  columnKeys: readonly string[],
  autoShowKeys: readonly string[],
): string[] | undefined {
  const known = new Set(columnKeys)
  const kept = visibleProps.filter((key) => known.has(key))
  if (kept.length === 0) return undefined
  const seen = new Set(kept)
  return [...kept, ...autoShowKeys.filter((key) => !seen.has(key))]
}

/** aggregations 정리 — 죽은 컬럼의 집계는 표시할 자리가 없다. 남는 게 없으면 필드 자체를 뗀다. */
function pruneAggregations(
  aggregations: Record<string, AggregationType>,
  columnKeys: ReadonlySet<string>,
): Record<string, AggregationType> | undefined {
  const entries = Object.entries(aggregations).filter(([key]) => columnKeys.has(key))
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

/** sort 정리 — 죽은 키의 정렬은 아무 일도 안 하는 정렬이다(compareByKey 가 항상 동률). */
function pruneSort(sort: readonly Sort[], valueKeys: ReadonlySet<string>): Sort[] {
  return sort.filter((s) => valueKeys.has(s.key))
}

/**
 * 영속된 뷰 설정 → 현재 스키마에 맞게 정리된 뷰 설정(순수, 입력 미변형).
 *
 * 죽은 키를 가리키는 설정만 떨어진다. 나머지(type·rowHeight·cardSize·rowOrder 등 키와 무관한
 * 설정)는 그대로 통과한다. **표를 비우지 않는다** — 이 함수의 유일한 계약이다.
 *
 * `rowOrder`·`cardOrder` 는 컬럼 키가 아니라 레코드 id 를 담으므로 여기서 건드리지 않는다
 * (stale id 는 applyRowOrder/applyCardOrder 가 이미 무시한다).
 */
export function reconcileViewConfig(
  saved: CollectionViewConfig,
  keys: ViewKeySets,
): CollectionViewConfig {
  const columnKeys = new Set(keys.columnKeys)
  const valueKeys = new Set(keys.valueKeys ?? keys.columnKeys)
  const next: CollectionViewConfig = { ...saved }

  if (saved.visibleProps) {
    const visible = pruneVisibleProps(
      saved.visibleProps,
      keys.columnKeys,
      keys.autoShowKeys ?? keys.columnKeys,
    )
    if (visible) next.visibleProps = visible
    else delete next.visibleProps
  }
  if (saved.sort) next.sort = pruneSort(saved.sort, valueKeys)
  if (saved.filters) next.filters = pruneFilterExpr(saved.filters, valueKeys)
  if (saved.groupBy !== undefined && !columnKeys.has(saved.groupBy)) delete next.groupBy
  if (saved.aggregations) {
    const aggregations = pruneAggregations(saved.aggregations, columnKeys)
    if (aggregations) next.aggregations = aggregations
    else delete next.aggregations
  }
  if (saved.coverKey !== undefined && !columnKeys.has(saved.coverKey)) delete next.coverKey
  if (saved.timeline) {
    // startKey 가 죽으면 축 자체가 성립하지 않는다 → 타임라인 설정을 통째로 뗀다(안내 상태로 폴백).
    if (!columnKeys.has(saved.timeline.startKey)) delete next.timeline
    else if (saved.timeline.endKey !== undefined && !columnKeys.has(saved.timeline.endKey)) {
      const { endKey: _dropped, ...rest } = saved.timeline
      next.timeline = rest
    }
  }
  if (saved.conditionalFormats) {
    next.conditionalFormats = pruneConditionalFormats(
      saved.conditionalFormats,
      columnKeys,
      valueKeys,
    )
  }

  return next
}

/** 필터 트리가 참조하는 키를 모은다(재귀). */
function collectFilterKeys(expr: FilterExpr, out: Set<string>): void {
  const nodes: FilterNode[] = Array.isArray(expr) ? expr : expr.children
  for (const node of nodes) {
    if (isFilterGroup(node)) collectFilterKeys(node, out)
    else out.add(node.key)
  }
}

/**
 * 이 뷰 설정이 참조하는 모든 프로퍼티 키.
 *
 * 쓰임새는 하나다 — **코드가 선언한 기본 뷰**에 이걸 돌려 valueKeys 를 자동으로 만든다.
 * 기본 뷰가 언급하는 키는 정의상 살아 있는 키다(코드가 방금 그렇게 썼으니까). 그러면 화면마다
 * "파생 프로퍼티 목록"을 손으로 관리하지 않아도 `__visitScheduled` 같은 비컬럼 키가 지켜진다.
 */
export function collectViewConfigKeys(config: CollectionViewConfig): string[] {
  const keys = new Set<string>()
  config.visibleProps?.forEach((k) => keys.add(k))
  config.sort?.forEach((s) => keys.add(s.key))
  if (config.filters) collectFilterKeys(config.filters, keys)
  if (config.groupBy) keys.add(config.groupBy)
  if (config.aggregations) Object.keys(config.aggregations).forEach((k) => keys.add(k))
  if (config.coverKey) keys.add(config.coverKey)
  if (config.timeline) {
    keys.add(config.timeline.startKey)
    if (config.timeline.endKey) keys.add(config.timeline.endKey)
  }
  config.conditionalFormats?.forEach((rule) => {
    if (rule.target) keys.add(rule.target)
    collectFilterKeys(rule.when, keys)
  })
  return [...keys]
}

/**
 * 정리 과정에서 무언가 떨어졌는가 — 호출자가 "정리된 뷰를 다시 저장할지" 판단할 때 쓴다.
 * 구조 비교(JSON)로 충분하다: reconcileViewConfig 는 순수하고 키 순서를 보존한다.
 */
export function isViewConfigReconciled(
  saved: CollectionViewConfig,
  reconciled: CollectionViewConfig,
): boolean {
  return JSON.stringify(saved) !== JSON.stringify(reconciled)
}

/** SavedView 배열 전체를 정리 — 다중 명명 뷰(ViewTabs)의 로드 경로용. */
export function reconcileSavedViewConfigs<T extends { config: CollectionViewConfig }>(
  views: readonly T[],
  keys: ViewKeySets,
): T[] {
  return views.map((v) => ({ ...v, config: reconcileViewConfig(v.config, keys) }))
}
