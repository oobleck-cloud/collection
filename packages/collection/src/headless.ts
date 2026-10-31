// @mvos/collections — 뷰 쿼리의 "헤드리스" 경계.
//
// 왜 필요한가:
//   원본(몬티즈 워크스페이스 DB)은 레코드 전량을 클라이언트가 들고 있는 전제였다. 그래서
//   TableView 가 자기 안에서 viewRows(filter → sort) 를 돌리고 footer 집계도 그 결과로 계산한다.
//   MVOS 의 주문 목록처럼 **서버가 페이지를 잘라 주는** 목록에 그대로 붙이면 조용히 거짓말을 한다:
//     - 툴바에서 건 정렬·필터가 "현재 페이지 안"에서만 돌고,
//     - footer 집계가 전체 900건이 아니라 눈앞의 20건을 세어 "개수 20" 이라고 말한다.
//   침묵하는 오답이라 더 나쁘다 — 화면은 정상으로 보인다.
//
// 그래서 이 파일은 **의미론(무엇을 거를 것인가)** 과 **실행(누가 거를 것인가)** 을 분리한다.
//   - 의미론: 툴바가 만드는 `ViewConfig.filters`/`sort` — UI 는 이것만 만든다(변경 없음).
//   - 실행:   `CollectionQuery`(JSON 안전 IR, query.ts) 로 컴파일해 클라 어댑터에 넘기거나
//             그대로 직렬화해 서버 API 로 보낸다.
//
// 뷰(TableView 등)는 `queryMode` 하나만 안다:
//   - 'client'(기본): 지금까지와 동일 — 넘겨받은 records 전량에 filter/sort 를 적용. 회귀 0.
//   - 'server': 호출자가 **이미 해소된** 행만 넘긴다. 뷰는 재적용하지 않고, 전체 모수를 모르므로
//               집계 범위를 스스로 낮춰 말한다(`totalCount` 를 주면 그 수를 쓴다).
//
// 서버 어댑터를 붙이는 쪽은 `toWireQuery()` 결과를 그대로 쿼리 파라미터/바디에 실으면 된다 —
// 이 IR 이 클라이언트와 서버가 공유하는 유일한 계약이다.

import { compileFilter, type CompiledGroup, type CompiledSort, type PageParams } from './query'
import { normalizeFilterRoot } from './view'

import type { CollectionViewConfig, FilterExpr, Sort, ViewConfig } from './types'

/**
 * 뷰가 요구하는 쿼리 — 필터 트리 + 정렬 + 페이지. JSON 안전(함수 없음)이라
 * 그대로 fetch 바디/쿼리스트링에 실을 수 있다.
 */
export type CollectionQuery = {
  filter: CompiledGroup
  sort: CompiledSort[]
  page: PageParams
}

/**
 * 쿼리 실행 주체.
 *  - `client`: 뷰가 넘겨받은 records 전량에 filter/sort 를 적용한다(기본, 현행 동작).
 *  - `server`: 호출자가 이미 해소한 행을 넘긴다. 뷰는 재적용하지 않는다.
 */
export type QueryMode = 'client' | 'server'

/**
 * 집계(footer)가 무엇을 세고 있는지.
 *  - `all`: 필터를 통과한 전체 — 클라 모드에서 뷰가 전량을 들고 있을 때.
 *  - `page`: 지금 화면의 한 페이지만 — 서버 모드에서 `totalCount` 를 못 받았을 때.
 * 뷰는 `page` 일 때 집계 결과에 범위를 함께 표시한다("이 페이지"). 모수를 모르면서
 * 전체인 척하지 않는다.
 */
export type AggregationScope = 'all' | 'page'

/** 서버 실행 계약 — 호스트가 이 함수를 구현해 REST/Server Action 에 위임한다. */
export type CollectionQueryExecutor<R> = (query: CollectionQuery) => Promise<{
  /** 이 페이지의 레코드. 필터·정렬은 **이미 적용된** 상태여야 한다. */
  records: R[]
  /** 필터 적용 후 페이지 적용 전 전체 수. 주면 footer 집계가 전체 기준으로 말할 수 있다. */
  total: number
}>

/**
 * 뷰 설정 → 실행 가능한 쿼리 IR.
 *
 * `view.filters` 는 레거시 평탄 배열일 수 있어 `normalizeFilterRoot` 로 항상 트리 루트로 정규화한다
 * (view.ts 와 동일 규약 — 정규화 지점을 한 군데로 모은다).
 */
export function buildCollectionQuery(
  view: Pick<ViewConfig, 'sort'> & { filters?: FilterExpr },
  page: PageParams = {},
): CollectionQuery {
  return compileFilter(normalizeFilterRoot(view.filters), view.sort ?? [], page)
}

/** 저장된 뷰 설정(JSON)에서 바로 — `CollectionViewConfig` 는 sort/filters 가 optional 이다. */
export function buildQueryFromConfig(
  config: CollectionViewConfig,
  page: PageParams = {},
): CollectionQuery {
  return compileFilter(normalizeFilterRoot(config.filters), config.sort ?? [], page)
}

/**
 * 전송용 평탄화 — 쿼리스트링에 실을 수 있는 문자열 맵.
 * 필터 트리는 중첩이라 JSON 문자열로, 정렬은 `key:dir` 목록으로 접는다.
 * (POST 바디를 쓸 수 있으면 `CollectionQuery` 를 그대로 보내는 편이 낫다 — 이건 GET 용 편의.)
 */
export function toWireQuery(query: CollectionQuery): Record<string, string> {
  const wire: Record<string, string> = {}
  if (query.filter.children.length > 0) wire.filter = JSON.stringify(query.filter)
  if (query.sort.length > 0) wire.sort = query.sort.map((s) => `${s.key}:${s.dir}`).join(',')
  if (query.page.take !== undefined) wire.take = String(query.page.take)
  if (query.page.skip) wire.skip = String(query.page.skip)
  return wire
}

/**
 * `toWireQuery` 의 역변환 — 서버(또는 BFF Server Action)가 쿼리스트링을 IR 로 되돌릴 때.
 * 깨진 입력은 조용히 빈 조건으로 떨어뜨린다(요청 하나 때문에 목록 전체가 500 이 되지 않게).
 */
export function fromWireQuery(wire: Record<string, string | undefined>): CollectionQuery {
  let filter: CompiledGroup = { kind: 'group', op: 'and', children: [] }
  if (wire.filter) {
    try {
      const parsed: unknown = JSON.parse(wire.filter)
      if (isCompiledGroup(parsed)) filter = parsed
    } catch {
      // 깨진 필터 = 필터 없음. 침묵하지만 결과가 "더 많이" 나오는 방향이라 안전하다.
    }
  }
  const sort: CompiledSort[] = (wire.sort ?? '')
    .split(',')
    .filter(Boolean)
    .map((part) => {
      const [key, dir] = part.split(':')
      return { key: key ?? '', dir: dir === 'desc' ? ('desc' as const) : ('asc' as const) }
    })
    .filter((s) => s.key.length > 0)

  const page: PageParams = {}
  const take = Number(wire.take)
  const skip = Number(wire.skip)
  if (Number.isFinite(take) && take > 0) page.take = take
  if (Number.isFinite(skip) && skip > 0) page.skip = skip

  return { filter, sort, page }
}

/** 런타임 셰이프 가드 — 외부(쿼리스트링)에서 온 필터 트리는 신뢰하지 않는다. */
function isCompiledGroup(v: unknown): v is CompiledGroup {
  if (typeof v !== 'object' || v === null) return false
  const g = v as Partial<CompiledGroup>
  if (g.kind !== 'group') return false
  if (g.op !== 'and' && g.op !== 'or') return false
  if (!Array.isArray(g.children)) return false
  return g.children.every((child) => {
    if (typeof child !== 'object' || child === null) return false
    const c = child as { kind?: unknown; key?: unknown; op?: unknown }
    if (c.kind === 'group') return isCompiledGroup(child)
    return c.kind === 'condition' && typeof c.key === 'string' && typeof c.op === 'string'
  })
}

/**
 * 정렬 토글 — 툴바/컬럼 헤더가 만드는 `Sort[]` 변경을 한 곳에 모은다.
 * 서버 모드에서도 UI 는 동일하게 이 함수만 쓰고, 결과 `Sort[]` 를 쿼리로 컴파일해 서버에 보낸다.
 */
export function toggleSort(sorts: Sort[], key: string): Sort[] {
  const existing = sorts.find((s) => s.key === key)
  if (!existing) return [...sorts, { key, dir: 'asc' }]
  if (existing.dir === 'asc') return sorts.map((s) => (s.key === key ? { ...s, dir: 'desc' } : s))
  return sorts.filter((s) => s.key !== key)
}
