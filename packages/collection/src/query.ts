// @mvos/collections — 서버측 쿼리 컴파일러 (이슈 #16-3 WAVE 1 레인 C)
//
// 저장 구조 분석:
//   레코드 properties 는 TipTap JSON 블롭(`Document.content`)에 묻혀 있고,
//   `BlockPack.readProperties()` 가 런타임에 추출한다. 따라서 Prisma where 절로
//   직접 필터링할 수 있는 정형 컬럼이 존재하지 않는다.
//
// 설계 결정:
//   → storage-agnostic 쿼리 IR + 인메모리 어댑터(passesFilterNode / viewRows 위임).
//   Postgres 어댑터가 필요해질 때(properties 컬럼 물질화 이후)를 위해 IR 경계를 명시.
//
// 파일 소유권:
//   신규 파일. view.ts / types.ts / index.ts 를 수정하지 않는다.
//   배럴 export(index.ts) 추가는 통합 단계에서 결정 — 현재는 deep-import 로 소비.

import type { FilterGroup, FilterNode, FilterOp, PropertyValue, RollupAgg, Sort } from './types'
import { normalizeFilterRoot, viewRows } from './view'
import type { Row } from './view'

// ─── 쿼리 IR ─────────────────────────────────────────────────────────────────

/**
 * 컴파일된 조건 노드 IR — 잎(leaf).
 * `key`: 속성 키, `op`: FilterOp, `value`: 비교값.
 */
export type CompiledCondition = {
  kind: 'condition'
  key: string
  op: FilterOp
  value: PropertyValue
  /** 관계 집계 조건이면 그 셈과 대상 조건(AND). 자세한 의미는 `FilterCondition.rollup`. */
  rollup?: CompiledRollup
}

export type CompiledRollup = {
  agg: RollupAgg
  field?: string
  where: CompiledNode[]
}

/**
 * 컴파일된 그룹 노드 IR — AND | OR 결합.
 * children 이 비어 있으면 AND → 모두 통과, OR → 아무것도 통과하지 않음.
 */
export type CompiledGroup = {
  kind: 'group'
  op: 'and' | 'or'
  children: CompiledNode[]
}

/** 쿼리 IR 노드 — 조건(leaf) 또는 그룹(branch). */
export type CompiledNode = CompiledCondition | CompiledGroup

/**
 * 페이지네이션 파라미터 — take/skip 기반 오프셋 방식.
 * cursor 기반 페이지네이션은 향후 확장 포인트로 남긴다.
 */
export type PageParams = {
  /** 한 페이지에 가져올 레코드 수(max 제한은 호출자 책임). 미지정 = 전체. */
  take?: number
  /** 건너뛸 레코드 수(0-based offset). 미지정 = 0. */
  skip?: number
}

/**
 * 컴파일된 정렬 항목 IR — Sort 와 동형이지만 컴파일 결과임을 타입으로 구분.
 */
export type CompiledSort = {
  key: string
  dir: 'asc' | 'desc'
}

/**
 * 컴파일된 쿼리 — 필터 IR 트리 + 정렬 목록 + 페이지네이션 파라미터.
 * storage adapter 가 이 IR 을 소비한다.
 *
 * 현재 구현: `buildInMemoryAdapter` 가 인메모리 어댑터를 반환한다.
 * Postgres 어댑터(미래): `compiledQuery.filter` 트리를 재귀 순회해
 * `Prisma.DocumentWhereInput` 을 생성하는 별도 함수로 구현한다(이 IR 이 경계).
 */
export type CompiledQuery = {
  filter: CompiledGroup
  sort: CompiledSort[]
  page: PageParams
}

// ─── FilterGroup → IR ─────────────────────────────────────────────────────────

/** `FilterNode` 를 `CompiledNode` IR 로 변환(재귀). */
function compileNode(node: FilterNode): CompiledNode {
  if ('children' in node) {
    // FilterGroup 가지 노드
    return {
      kind: 'group',
      op: node.op,
      children: node.children.map(compileNode),
    }
  }
  // FilterCondition 잎 노드
  return {
    kind: 'condition',
    key: node.key,
    op: node.op,
    value: node.value ?? null,
    ...(node.rollup
      ? {
          rollup: {
            agg: node.rollup.agg,
            ...(node.rollup.field ? { field: node.rollup.field } : {}),
            where: node.rollup.where.map(compileNode),
          },
        }
      : {}),
  }
}

/**
 * `FilterGroup` 루트를 `CompiledGroup` IR 로 변환.
 *
 * 입력은 반드시 `normalizeFilterRoot` 를 통과한 `FilterGroup` 이어야 한다.
 * raw `FilterExpr`(레거시 평탄 배열 포함)를 받으려면 먼저 `normalizeFilterRoot` 를 호출하라.
 *
 * @example
 * ```ts
 * const root = normalizeFilterRoot(view.config.filters)
 * const q = compileFilter(root, sorts, { take: 20, skip: 0 })
 * ```
 */
export function compileFilter(
  group: FilterGroup,
  sorts: Sort[] = [],
  page: PageParams = {},
): CompiledQuery {
  const filter: CompiledGroup = {
    kind: 'group',
    op: group.op,
    children: group.children.map(compileNode),
  }
  const sort: CompiledSort[] = sorts.map((s) => ({ key: s.key, dir: s.dir }))
  return { filter, sort, page }
}

/**
 * `Sort[]` 를 `CompiledSort[]` IR 로 변환.
 * `compileFilter` 와 분리된 독립 진입점 — 필터 없이 정렬만 필요한 경우.
 */
export function compileSort(sorts: Sort[]): CompiledSort[] {
  return sorts.map((s) => ({ key: s.key, dir: s.dir }))
}

// ─── 인메모리 어댑터 ─────────────────────────────────────────────────────────

/**
 * `CompiledNode` IR 을 `FilterNode`(view.ts 타입)로 재변환.
 * 인메모리 어댑터에서 `passesFilterNode` 에 위임하기 위해 필요.
 * IR ↔ FilterNode 의 형태가 다른 부분(kind 필드)만 제거한다.
 */
function irToFilterNode(node: CompiledNode): FilterNode {
  if (node.kind === 'group') {
    return {
      op: node.op,
      children: node.children.map(irToFilterNode),
    }
  }
  return {
    key: node.key,
    op: node.op,
    value: node.value,
    ...(node.rollup
      ? {
          rollup: {
            agg: node.rollup.agg,
            ...(node.rollup.field ? { field: node.rollup.field } : {}),
            where: node.rollup.where.map(irToFilterNode),
          },
        }
      : {}),
  }
}

/**
 * 쿼리 결과 — 필터+정렬+페이지 적용 후의 레코드 목록과 전체 수(페이지 적용 전).
 */
export type QueryResult<P> = {
  /** 필터+정렬+페이지 적용 결과 행 목록. */
  rows: Row<P>[]
  /**
   * 필터+정렬 적용 후, **페이지 적용 전** 전체 행 수.
   * 호출자가 총 페이지 수를 계산할 때 사용한다.
   */
  total: number
}

/**
 * `CompiledQuery` IR 을 소비하는 인메모리 어댑터를 반환한다.
 *
 * 반환된 함수는 `records` 에 대해 filter → sort → page 를 순서대로 적용한다.
 * 내부 필터 평가는 `passesFilterNode`(W0 동결), 정렬은 `viewRows`(W0 동결)에 완전 위임한다.
 * 동치(equivalence)는 `query.test.ts` 의 골든 테스트가 보장한다.
 *
 * @example
 * ```ts
 * const adapt = buildInMemoryAdapter(compiledQuery)
 * const { rows, total } = adapt(allRecords)
 * ```
 */
export function buildInMemoryAdapter<P>(
  query: CompiledQuery,
): (records: Row<P>[]) => QueryResult<P> {
  // IR → view.ts 내부 타입으로 역변환(passesFilterNode 위임용)
  const filterNode: FilterNode = irToFilterNode(query.filter)
  const rootGroup = normalizeFilterRoot(filterNode as unknown as FilterGroup)

  return (records: Row<P>[]): QueryResult<P> => {
    // 1. 필터 + 정렬 — viewRows 에 완전 위임(W0 동결 semantics)
    const filtered = viewRows(records, {
      type: 'table',
      filters: rootGroup,
      sort: query.sort,
    })

    const total = filtered.length

    // 2. 페이지네이션 — take/skip 오프셋
    const skip = query.page.skip ?? 0
    const rows =
      query.page.take !== undefined
        ? filtered.slice(skip, skip + query.page.take)
        : filtered.slice(skip)

    return { rows, total }
  }
}

/**
 * 단순 헬퍼 — `FilterGroup` + `Sort[]` + `PageParams` + 레코드를 한 번에 처리.
 * 컴파일 결과를 재사용하지 않아도 되는 일회성 호출용.
 */
export function queryRecords<P>(
  records: Row<P>[],
  group: FilterGroup,
  sorts: Sort[] = [],
  page: PageParams = {},
): QueryResult<P> {
  const compiled = compileFilter(group, sorts, page)
  return buildInMemoryAdapter<P>(compiled)(records)
}
