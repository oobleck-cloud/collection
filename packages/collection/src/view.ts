import type {
  ButtonValue,
  FilterExpr,
  FilterGroup,
  FilterNode,
  FilterOp,
  PropertyDef,
  PropertyValue,
  Sort,
  TagValue,
  ViewConfig,
  ViewType,
} from './types'
import { dateValueStart } from './date-value'

// viewRows — 이미 추출된 속성(props)을 입력받아 filter → sort → group 으로 변환하는 순수 함수.
// projection 추출(readProperties)은 블록팩 책임이고, 여기서는 그 결과 행 집합만 다룬다(D-8 §3, §7).
// 도메인 무관: props 는 임의의 string→PropertyValue 맵으로 취급한다.

/** 한 레코드 행 — id + 추출된 속성값 맵. P 는 블록팩이 정의하는 속성 형태. */
export type Row<P> = { id: string; props: P }

/** groupBy 가 지정됐을 때의 묶음. key 는 그룹 기준 값을 문자열로 정규화한 것(빈/누락은 GROUP_EMPTY). */
export type RowGroup<P> = { key: string; rows: Row<P>[] }

/** groupBy 누락/빈 값 그룹의 안정 키. */
export const GROUP_EMPTY = '__empty__'

type Props = Record<string, PropertyValue>

/**
 * ButtonValue 런타임 판별(isGeoValue 동형) — 객체값 유니온(GeoValue·ButtonValue) 중 버튼을 좁힌다.
 * action·label 문자열 필수가 판별자(GeoValue 는 coordinate 객체를 가진다).
 */
export function isButtonValue(v: unknown): v is ButtonValue {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  const b = v as Record<string, unknown>
  return typeof b.action === 'string' && typeof b.label === 'string'
}

/**
 * TagValue 런타임 판별(isButtonValue 동형) — 객체값 유니온(GeoValue·ButtonValue·TagValue) 중 태그를 좁힌다.
 * `tag` 문자열 필수가 판별자(GeoValue 는 coordinate, ButtonValue 는 action·label). 색 힌트를 실은 값을 렌더러가
 * 스키마 없이 색 칩으로 그릴 때 쓴다(RecordDocumentView).
 */
export function isTagValue(v: unknown): v is TagValue {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  const t = v as Record<string, unknown>
  return typeof t.tag === 'string'
}

function readProp(props: Props, key: string): PropertyValue {
  const v = props[key]
  return v === undefined ? null : v
}

// ─── 뷰 타입 정규화(어휘 정렬) ──────────────────────────────────────────────────

/**
 * 저장된 view type 을 정규화 — 레거시 'grid'(노션 gallery 의미) → 'gallery', 미지정 → 'table'.
 * 영속된 구버전 뷰가 깨지지 않게 로드 시점에 통과시킨다(하위호환).
 */
export function normalizeViewType(type: ViewType | 'grid' | undefined | null): ViewType {
  if (type === 'grid') return 'gallery'
  return type ?? 'table'
}

// ─── 카드 뷰 컬럼 해석(board/gallery/list 공통) ──────────────────────────────────

/**
 * 표시할 컬럼(PropertyDef[])을 view.visibleProps 순서로 해석한다 — 카드형 뷰(board/gallery/list)의
 * 단일 진실원천. visibleProps 가 있으면 그 순서(스키마에 없는 키는 건너뜀), 없거나 비었으면 스키마 전체.
 * 첫 컬럼이 곧 제목 컬럼이다(resolveTitleKey). board·gallery·list 가 이 함수를 공유해 제목/표시열을
 * 동일 규칙으로 결정한다(과거 갤러리/리스트가 schema[0] 을 제목으로 쓰던 버그 방지).
 */
export function resolveVisibleColumns(schema: PropertyDef[], view: ViewConfig): PropertyDef[] {
  // 폴백(표시 목록 미설정)에서도 기본 숨김 컬럼은 세우지 않는다 — 그러지 않으면
  // 목록을 한 번도 저장하지 않은 화면에서만 파생 컬럼이 우르르 서는 비대칭이 생긴다.
  if (!view.visibleProps || view.visibleProps.length === 0) {
    return schema.filter((d) => !d.hiddenByDefault)
  }
  const byKey = new Map(schema.map((d) => [d.key, d]))
  return view.visibleProps.flatMap((k) => {
    const def = byKey.get(k)
    return def ? [def] : []
  })
}

/**
 * 카드/행 제목으로 쓸 컬럼 키 — 표시 컬럼(resolveVisibleColumns)의 첫 키. 없으면 undefined.
 * 노션식 "첫 컬럼 = 제목" 규칙. visibleProps 기반이므로 사용자가 정한 첫 노출 컬럼을 따른다.
 */
export function resolveTitleKey(schema: PropertyDef[], view: ViewConfig): string | undefined {
  return resolveVisibleColumns(schema, view)[0]?.key
}

// ─── 필터 ─────────────────────────────────────────────────────────────────────

function isEmptyValue(v: PropertyValue): boolean {
  if (v === null) return true
  if (typeof v === 'string') return v.length === 0
  if (Array.isArray(v)) return v.length === 0
  return false // number / boolean 은 비어있음으로 보지 않음(0·false 는 유효값)
}

/** 숫자/날짜 비교용 정규화 — number 는 그대로, date(ISO string/기간/시간)는 *시작* epoch ms, 그 외는 NaN. */
function toComparableNumber(v: PropertyValue): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const t = Date.parse(dateValueStart(v))
    return Number.isNaN(t) ? Number.NaN : t
  }
  return Number.NaN
}

/**
 * PropertyValue → 비교용 문자열. 원시값은 그대로, 객체값(GeoValue·ButtonValue)은 JSON 으로 —
 * String(obj) 의 '[object Object]' 함정을 피한다(필터 비교는 실질적으로 스칼라를 다루지만 타입 안전).
 */
function stringifyValue(v: PropertyValue): string {
  if (v === null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function asArray(v: PropertyValue): string[] {
  if (Array.isArray(v)) return v
  if (v === null) return []
  return [stringifyValue(v)]
}

/**
 * 부분 포함 — 양쪽을 문자열로 보고 비교한다(수·불리언 포함).
 * 값이 없으면(null) 포함할 것도 없다. 빈 문자열은 "무조건 참" 이 되어 필터가 무의미해지므로 제외.
 */
function containsLoose(cell: PropertyValue, value: PropertyValue): boolean {
  if (cell === null || value === null || Array.isArray(value)) return false
  const needle = stringifyValue(value)
  if (needle === '') return false
  // 대소문자는 그대로 구분한다(기존 규약). 서버 CONTAINS_TOKEN 은 대소문자를 무시하므로
  // 영문 값에서는 아직 둘이 갈린다 — 어휘를 통일하려면 화면 전반의 필터 동작이 바뀌는
  // 별도 결정이라 여기서 슬쩍 바꾸지 않는다.
  return stringifyValue(cell).includes(needle)
}

/** `YYYY-MM-DD` 하나뿐인 값인가 — 조건이 "그 날"을 가리키는지 판별. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * 날짜 조건의 눈금을 셀 쪽에 맞춘다 — 조건이 "그 날"이면 셀도 날짜 부분만 본다.
 *
 * 달력·검색 자동완성이 내는 값은 언제나 날짜뿐(`2026-08-16`)인데 셀은 컬럼에 따라 시각을
 * 달고 있다(`2026-08-16T21:45:00Z`). 문자열/타임스탬프 그대로 비교하면 `= 그 날` 이 한 건도
 * 못 맞히고, `≤ 그 날` 은 그날 자정 이후 주문을 통째로 뺀다 — 화면만 봐선 알 수 없는 오답이다.
 * (서버 쪽 두 엔진 — SQL·인메모리 매처 — 도 같은 규칙으로 접는다. 같은 조건에 답이 갈리면
 *  안 되는 자리라 규칙을 한 벌로 맞춘다.)
 */
function alignDateGranularity(cell: PropertyValue, value: PropertyValue): PropertyValue {
  if (typeof cell !== 'string' || typeof value !== 'string') return cell
  if (DATETIME_MINUTE.test(value)) return alignToMinute(cell)
  if (!DATE_ONLY.test(value)) return cell
  const day = /^\d{4}-\d{2}-\d{2}/.exec(cell)
  return day ? day[0] : cell
}

/** `YYYY-MM-DDTHH:mm` — 조건이 "그 분"을 가리키는지 판별(상대값 `오늘 12:00` 도 이 모양으로 풀린다). */
const DATETIME_MINUTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/**
 * 조건이 "그 분"이면 셀도 로컬 분(`YYYY-MM-DDTHH:mm`)으로 접는다 — 셀은 초·오프셋을 달고 있어(`…T03:00:00Z`) 그대로는 `= 12:00`
 * 이 한 건도 못 맞힌다. 날짜만 든 셀은 그날 0시로 읽는다(`Date.parse` 는 날짜만 든 값을 UTC 로 읽어 시각대만큼 어긋난다).
 */
function alignToMinute(cell: string): string {
  const start = dateValueStart(cell)
  if (DATE_ONLY.test(start)) return `${start}T00:00`
  const t = Date.parse(start)
  if (Number.isNaN(t)) return cell
  const d = new Date(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 단일 (op, value, cell) 술어. 타입 비의존 — 값 형태로 의미를 정한다. */
function matchOp(op: FilterOp, cell: PropertyValue, value: PropertyValue): boolean {
  switch (op) {
    case 'is_empty':
      return isEmptyValue(cell)
    case 'is_not_empty':
      return !isEmptyValue(cell)
    case 'eq':
      return equals(alignDateGranularity(cell, value), value)
    case 'neq':
      return !equals(alignDateGranularity(cell, value), value)
    // 문자열화해서 비교한다 — 일련번호(주문번호 2034479) 같은 수 컬럼에 "2034 포함" 이
    // 실제로 쓰이는 조건이기 때문. 예전엔 문자열끼리만 비교해 수 컬럼의 contains 가 항상
    // false 였고, 같은 조건을 서버(CONTAINS_TOKEN)는 맞히는데 클라는 0건을 내 어긋났다.
    case 'contains':
      return containsLoose(cell, value)
    case 'not_contains':
      return !containsLoose(cell, value)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareNumeric(op, cell, value)
    case 'has':
      return value !== null && value !== undefined && asArray(cell).includes(stringifyValue(value))
    case 'not_has':
      return !(
        value !== null &&
        value !== undefined &&
        asArray(cell).includes(stringifyValue(value))
      )
    // 값 목록이 비어 있으면 아직 고르는 중이다 — 0건으로 무너뜨리지 않고 제약 없음으로 둔다
    // (서버 브리지가 미완성 조건을 떨구는 것과 같은 답).
    case 'in':
      return isEmptyValue(value ?? null) || overlaps(cell, value)
    case 'not_in':
      return isEmptyValue(value ?? null) || !overlaps(cell, value)
  }
}

function compareNumeric(
  op: 'gt' | 'gte' | 'lt' | 'lte',
  rawCell: PropertyValue,
  value: PropertyValue,
) {
  // eq/neq 와 같은 규칙 — 조건이 날짜뿐이면 셀도 하루 단위로 접어 경계를 그날의 끝에 세운다.
  const cell = alignDateGranularity(rawCell, value)
  const a = toComparableNumber(cell)
  const b = toComparableNumber(value ?? null)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  if (op === 'gt') return a > b
  if (op === 'gte') return a >= b
  if (op === 'lt') return a < b
  return a <= b
}

/** in/not_in — 셀(단일·다중값)과 값 목록이 하나라도 겹치는가. */
function overlaps(cell: PropertyValue, value: PropertyValue | undefined): boolean {
  const wanted = new Set(asArray(value ?? null))
  return asArray(cell).some((v) => wanted.has(v))
}

/** eq/neq 동등 비교 — 배열은 동일 멤버 집합(순서 무관), 그 외는 원시 동등. */
function equals(a: PropertyValue, b: PropertyValue | undefined): boolean {
  if (b === undefined) b = null
  if (Array.isArray(a) || Array.isArray(b)) {
    const sa = [...asArray(a)].sort()
    const sb = [...asArray(b)].sort()
    return sa.length === sb.length && sa.every((x, i) => x === sb[i])
  }
  return a === b
}

/** 노드가 그룹(가지)인지 — 판별자는 `children` 필드의 존재(FilterCondition 엔 없음). */
export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return Array.isArray((node as FilterGroup).children)
}

/**
 * 레거시/입력 필터 표현(FilterExpr)을 항상 FilterGroup 루트로 정규화(하위호환).
 *  - 평탄 배열(FilterCondition[]) → { op:'and', children:[...] }
 *  - 이미 FilterGroup → 그대로(불변)
 *  - undefined/null → 빈 AND 그룹(모두 통과)
 * 영속된 구버전 뷰(`filters: Filter[]`)가 깨지지 않게 로드 시점에 이걸 통과시킨다.
 */
export function normalizeFilterRoot(expr: FilterExpr | undefined | null): FilterGroup {
  if (!expr) return { op: 'and', children: [] }
  if (Array.isArray(expr)) return { op: 'and', children: expr }
  return expr
}

/**
 * 필터 트리 재귀 평가(순수). 그룹은 op('and'|'or')로 자식을 결합, 잎은 matchOp 로 평가.
 *  - 빈 AND 그룹 → true(필터 없음 = 모두 통과). 빈 OR 그룹 → false(통과 조건 0개).
 */
export function passesFilterNode(props: Props, node: FilterNode): boolean {
  if (isFilterGroup(node)) {
    if (node.op === 'or') return node.children.some((c) => passesFilterNode(props, c))
    return node.children.every((c) => passesFilterNode(props, c)) // 'and'(빈 그룹 = true)
  }
  const cond = node
  return matchOp(cond.op, readProp(props, cond.key), cond.value ?? null)
}

// ─── 정렬 ─────────────────────────────────────────────────────────────────────

/**
 * 두 셀 비교 — 타입 적응형.
 *  - 둘 다 숫자/날짜로 환산되면 수치 비교.
 *  - 그 외(텍스트/select)는 문자열 locale 비교.
 *  - null/빈 값은 항상 뒤로(asc·desc 무관하게 끝쪽) — 누락이 정렬 머리에 끼지 않도록.
 */
/** 비어있지 않은 두 셀의 비교(방향 미적용). 숫자/날짜면 수치, 그 외는 문자열 locale 비교. */
function compareNonEmpty(a: PropertyValue, b: PropertyValue): number {
  const na = toComparableNumber(a)
  const nb = toComparableNumber(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb ? 0 : na < nb ? -1 : 1
  // 비배열 객체값(geo 등)은 String(a) 가 모두 "[object Object]" 로 뭉개져 항상 동률(0)이 되어
  // 정렬이 무의미해진다. 코어→views 의존(레이어링 위반) 없이, 객체는 JSON.stringify 로 결정적
  // 문자열을 만들어 안정 비교한다(aggregations.ts count_unique 선례와 동일한 처리).
  return sortKeyOf(a).localeCompare(sortKeyOf(b))
}

/** 비교용 문자열 키 — 비배열 객체는 JSON.stringify(결정적), 그 외는 String. (compareNonEmpty 전용.) */
function sortKeyOf(v: PropertyValue): string {
  if (v !== null && !Array.isArray(v) && typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

/**
 * 한 정렬 키에 대한 두 행의 비교값(이미 dir 반영). 빈 값은 dir 과 무관하게 항상 뒤로.
 * (emptiness 처리를 dir 부호 반전 *밖*에서 하므로 asc/desc 모두 빈 값이 끝쪽에 남는다.)
 */
function compareByKey(a: PropertyValue, b: PropertyValue, dir: 'asc' | 'desc'): number {
  const aEmpty = isEmptyValue(a)
  const bEmpty = isEmptyValue(b)
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1 // 빈 값은 항상 뒤
  if (bEmpty) return -1
  const cmp = compareNonEmpty(a, b)
  return dir === 'asc' ? cmp : -cmp
}

function applySort<P>(rows: Row<P>[], sort: Sort[]): Row<P>[] {
  if (sort.length === 0) return rows
  // 안정 정렬 보장을 위해 인덱스를 동반(동률이면 원래 순서 유지).
  return rows
    .map((row, index) => ({ row, index }))
    .sort((x, y) => {
      for (const s of sort) {
        const cmp = compareByKey(
          readProp(x.row.props as Props, s.key),
          readProp(y.row.props as Props, s.key),
          s.dir,
        )
        if (cmp !== 0) return cmp
      }
      return x.index - y.index // tie-break: 입력 순서 유지(빈 sort 키들 사이에서도 안정)
    })
    .map((w) => w.row)
}

/**
 * 행 수동 정렬 — view.rowOrder(table 뷰의 노션식 드래그 순서)가 있으면 그 순서로 재배치한다.
 * 미등록 행(신규 생성·rowOrder 누락)은 끝으로, 등록 행끼리는 rowOrder 순. stale id 는 무시.
 * order 미지정/빈 배열이면 원본을 그대로 반환(회귀 0). 순수 함수(입력 미변형). BoardView.applyCardOrder 와 동형.
 */
export function applyRowOrder<P>(rows: Row<P>[], order: string[] | undefined): Row<P>[] {
  if (!order || order.length === 0) return rows
  const rank = new Map<string, number>()
  order.forEach((id, i) => rank.set(id, i))
  const unranked = order.length // 미등록 행은 모두 동일 랭크 → 안정 정렬이 입력 순서를 보존(끝에 모임).
  return [...rows].sort((a, b) => (rank.get(a.id) ?? unranked) - (rank.get(b.id) ?? unranked))
}

// ─── 그룹 ─────────────────────────────────────────────────────────────────────

/**
 * 셀 값 → 이 레코드가 속하는 그룹 키 목록(단일 진실원천 — board fan-out 규칙을 코어에 흡수).
 *  - 빈/누락 값 → [GROUP_EMPTY] (한 그룹).
 *  - multi(=true, multi_select) → 배열의 *각 멤버마다* 한 키(fan-out: 한 레코드가 여러 그룹에 등장).
 *      빈 배열 → [GROUP_EMPTY]. 비배열 스칼라가 와도 단일 멤버로 취급.
 *  - 단일(=false, select 등) → [한 키]. 배열이 오면 첫 멤버만(과거 select 동작 보존).
 * (BoardView 의 cardGroupKeys 가 이 함수로 통일된다.)
 */
export function groupKeysOf(v: PropertyValue, multi: boolean): string[] {
  if (isEmptyValue(v)) return [GROUP_EMPTY]
  if (multi) {
    if (Array.isArray(v)) return v.length > 0 ? v.map(String) : [GROUP_EMPTY]
    return [keyOf(v)]
  }
  if (Array.isArray(v)) return v.length > 0 ? [String(v[0])] : [GROUP_EMPTY]
  return [keyOf(v)]
}

/**
 * 단일 스칼라/객체 값 → 그룹 키 문자열. 비배열 객체값(geo 등)은 String(v) 가 모두
 * "[object Object]" 로 뭉개져 서로 다른 객체가 한 그룹에 섞이는 버그가 있다. 코어→views
 * 의존(레이어링 위반) 없이 객체는 JSON.stringify 로 구조 기반 키를 만들어 구분한다
 * (서로 다른 객체 = 서로 다른 키). aggregations.ts 의 count_unique 선례와 동일한 처리.
 * (배열은 호출부에서 이미 처리하므로 여기엔 오지 않는다 — 스칼라/비배열 객체만.)
 */
function keyOf(v: PropertyValue): string {
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function applyGroup<P>(
  rows: Row<P>[],
  groupBy: string,
  multi: boolean,
  emptyAs: string | undefined,
): RowGroup<P>[] {
  const order: string[] = [] // 그룹 첫 등장 순서 보존
  const buckets = new Map<string, Row<P>[]>()
  for (const row of rows) {
    // multi_select 면 한 행이 여러 키로 fan-out(여러 그룹에 등장). 단일이면 1개 키.
    // 빈 값을 정해 둔 그룹으로 보는 보기(groupEmptyAs)면 「없음」 대신 그 그룹에 넣는다.
    const keys = groupKeysOf(readProp(row.props as Props, groupBy), multi).map((k) =>
      k === GROUP_EMPTY && emptyAs ? emptyAs : k,
    )
    for (const key of keys) {
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = []
        buckets.set(key, bucket)
        order.push(key)
      }
      bucket.push(row)
    }
  }
  return order.map((key) => ({ key, rows: buckets.get(key)! }))
}

// ─── 공개 API ──────────────────────────────────────────────────────────────────

/**
 * read(이미 추출된 props) → filter → sort 순수 변환. 그룹핑 없는 평탄 행 목록을 반환한다.
 * (table/grid/list 의 기본 형태. groupBy 가 있어도 평탄 결과가 필요하면 이 함수를 쓴다.)
 */
export function viewRows<P>(records: Row<P>[], view: ViewConfig): Row<P>[] {
  // view.filters 는 정규화된 FilterGroup 루트지만, 레거시 평탄 배열이 흘러와도 안전하게 정규화한다.
  const root = normalizeFilterRoot(view.filters)
  const filtered = records.filter((r) => passesFilterNode(r.props as Props, root))
  return applySort(filtered, view.sort)
}

/** viewGroups 옵션 — 도메인 무관 시그널만. multiGroup=true 면 groupBy 컬럼을 multi_select 로 보고 fan-out. */
export type ViewGroupsOptions = {
  /** groupBy 컬럼이 multi_select 인가 — true 면 한 레코드가 멤버 수만큼 여러 그룹에 등장(fan-out). 기본 false. */
  multiGroup?: boolean
  /**
   * 빈 그룹 숨김 — true 면 rows 가 0인 그룹을 결과에서 제거한다.
   * groupBy 미지정(단일 GROUP_EMPTY 그룹) 시에는 적용하지 않는다.
   * view.hideEmptyGroups 를 그대로 전달하면 된다. 기본 false(현행 동작 불변).
   */
  hideEmptyGroups?: boolean
  /**
   * 그룹 키 → 표시 라벨 맵. groupSort='name' 시 label 오름차순 정렬에 사용.
   * 미제공 시 키를 그대로 라벨로 사용한다.
   */
  groupLabelMap?: Map<string, string>
  /**
   * 행이 **이미 걸러져 왔는가**(서버 모드) — true 면 viewRows(필터·정렬)를 적용하지 않고
   * 받은 순서 그대로 그룹핑한다. `headless.QueryMode='server'` 의 그룹핑 짝이다.
   *
   * 왜 필요한가: 서버가 필터를 적용해 보낸 한 페이지에 클라 semantics 로 필터를 한 번 더 걸면
   * 서버가 맞힌 행이 사라진다. 표(TableView)는 이미 이 분기를 갖고 있는데 차트·대시보드만
   * 없어서, 같은 뷰 설정이 surface 에 따라 다른 모수를 세고 있었다.
   * 기본 false — 클라 모드의 현행 동작 불변.
   */
  preFiltered?: boolean
}

/**
 * 그룹 목록을 groupSort 모드에 따라 정렬한다(순수).
 *  - manual/미설정: 현행 first-appearance 순(회귀 0 — 변경 없음).
 *  - name: 라벨 오름차순(groupLabelMap 참조, 없으면 키 그대로).
 *  - count: 행 수 내림차순.
 * GROUP_EMPTY 는 모드와 무관하게 항상 마지막.
 */
function sortGroups<P>(
  groups: RowGroup<P>[],
  mode: 'manual' | 'name' | 'count' | undefined,
  labelMap: Map<string, string> | undefined,
): RowGroup<P>[] {
  if (!mode || mode === 'manual') return groups

  // GROUP_EMPTY 는 분리해서 항상 마지막에 붙인다.
  const empty = groups.filter((g) => g.key === GROUP_EMPTY)
  const rest = groups.filter((g) => g.key !== GROUP_EMPTY)

  if (mode === 'count') {
    rest.sort((a, b) => b.rows.length - a.rows.length)
  } else {
    // name — 라벨 오름차순(localeCompare)
    rest.sort((a, b) => {
      const la = labelMap?.get(a.key) ?? a.key
      const lb = labelMap?.get(b.key) ?? b.key
      return la.localeCompare(lb)
    })
  }

  return [...rest, ...empty]
}

/**
 * filter → sort → group 까지 적용해 그룹 묶음을 반환한다(주로 board). 그룹핑 단일 진실원천(#16-2).
 *  - groupBy 미지정 → 전체를 단일 그룹(key=GROUP_EMPTY).
 *  - select(multiGroup=false) → 레코드당 한 그룹. multi_select(multiGroup=true) → fan-out(여러 그룹).
 *  - hideEmptyGroups(opts 또는 view.hideEmptyGroups) → rows 0인 그룹을 결과에서 제거.
 *    groupBy 미지정인 단일 GROUP_EMPTY 그룹에는 적용하지 않는다.
 *  - groupSort(view.groupSort): manual/미설정=first-appearance(회귀 0), name=라벨 오름차순, count=행수 내림차순.
 *    GROUP_EMPTY 는 항상 마지막.
 * BoardView 는 자체 그룹핑을 재구현하지 않고 이 함수를 소비한다.
 */
export function viewGroups<P>(
  records: Row<P>[],
  view: ViewConfig,
  opts: ViewGroupsOptions = {},
): RowGroup<P>[] {
  const rows = opts.preFiltered ? records : viewRows(records, view)
  if (!view.groupBy) return [{ key: GROUP_EMPTY, rows }]
  const grouped = applyGroup(rows, view.groupBy, opts.multiGroup ?? false, view.groupEmptyAs)
  const hideEmpty = opts.hideEmptyGroups ?? view.hideEmptyGroups ?? false
  const filtered = hideEmpty ? grouped.filter((g) => g.rows.length > 0) : grouped
  return sortGroups(filtered, view.groupSort, opts.groupLabelMap)
}
