import { z } from 'zod'

// 컬렉션 스키마 config(CollectionSchemaConfig) + 블록 문서의 Zod 검증 — 컬렉션 스키마 PATCH 와
// 워크스페이스 DB 스키마/행 라우트가 공유한다(중복 방지: jscpd dupcheck). collections types 와 정합, JSON 안전.

// SelectOption 의 zod 조각 — ai/workspace-schema/edit-ops 가 setSelectOptions/addOption op 에서 재사용한다
// (옵션 정의 단일 출처: 컬렉션 스키마 PATCH 와 동일 모양). export 소비처: ai/workspace-schema/edit-ops.
export const optionSchema = z.object({
  value: z.string(),
  label: z.string().optional(),
  color: z.string().optional(),
})

// ColumnWidth — 노션식 fixed/fit/fill. px 는 안전 범위(40~800)로 클램프 검증.
const columnWidthSchema = z.union([
  z.object({ mode: z.literal('fixed'), px: z.number().int().min(40).max(800) }),
  z.object({ mode: z.literal('fit'), px: z.number().int().min(40).max(800).optional() }),
  z.object({ mode: z.literal('fill'), minPx: z.number().int().min(40).max(800).optional() }),
])

// 동적 베이스 컬럼 타입 — relation 은 RelationConfig.target 으로 대상 컬렉션을 명시한다.
// export 소비처: ai/workspace-schema/edit-ops 의 changeType op(type 필드 검증, 컬럼 타입 단일 출처).
export const basePropertyTypeSchema = z.enum([
  'text',
  'number',
  'select',
  'multi_select',
  'date',
  'checkbox',
  'url',
  'email',
  'phone',
  'relation',
  'geo',
])
// RelationConfig 의 zod 조각 — ai/workspace-schema/edit-ops 가 changeToRelation op 에서 재사용한다.
export const relationConfigSchema = z.object({
  target: z.string().min(1).max(64),
  cardinality: z.enum(['one', 'many']).optional(),
})
// BasePropertyDef 의 zod 조각 — ai/workspace-schema/edit-ops 가 addColumn op 에서 재사용한다(동적 컬럼 정의 단일 출처).
export const basePropertyDefSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(64),
  type: basePropertyTypeSchema,
  options: z.array(optionSchema).optional(),
  locked: z.boolean().optional(),
  // inherited: (플라톤 연역) 이 컬럼이 프로토타입(Form)이 선언한 *상속 컬럼*인가. true 면 구조 잠금 —
  // 삭제·타입변경·inherited 해제 불가(서버 enforcement: schema-inheritance.findInheritedViolation). 값·label·
  // 옵션·순서·width 는 자유(우연/accidents). 미지정/false = 사용자가 추가한 자유 컬럼. 가산(기존 config 무영향).
  inherited: z.boolean().optional(),
  width: columnWidthSchema.optional(),
  relation: relationConfigSchema.optional(),
  // required: 데이터 API 쓰기 계약에서만 강제되는 필수 플래그(record-schema 가 Zod 로 파생).
  // 가산 optional — 기존 config 는 미지정(=자유)이라 무영향.
  required: z.boolean().optional(),
})

// 필터/정렬 — collections types 와 정합. JSON 안전.
const filterOpSchema = z.enum([
  'eq',
  'neq',
  'contains',
  'not_contains',
  'gt',
  'gte',
  'lt',
  'lte',
  'has',
  'not_has',
  'in',
  'not_in',
  'is_empty',
  'is_not_empty',
])

// 위치(geo) 값 — collections GeoValue 미러(coordinate.x=경도·y=위도·type=좌표계, roadAddress, detailAddress?).
// geo 컬럼의 셀 값이 이 객체이므로 propertyValueSchema 에 포함해야 행 PATCH 가 통과한다(빠지면 geo 편집이 조용히 유실).
const coordinateSystemSchema = z.enum(['WGS84', 'WCONGNAMUL', 'CONGNAMUL', 'WTM', 'TM'])
const geoValueSchema = z.object({
  coordinate: z.object({ x: z.number(), y: z.number(), type: coordinateSystemSchema }),
  roadAddress: z.string(),
  detailAddress: z.string().optional(),
})

/** 프로퍼티 값 — text/select/url=string, number=number, checkbox=boolean, multi_select/relation[]=string[], geo=GeoValue, null=미설정. */
export const propertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  geoValueSchema,
  z.null(),
])

// 필터 leaf(조건). 트리 노드의 잎.
const filterConditionSchema = z.object({
  key: z.string(),
  op: filterOpSchema,
  value: propertyValueSchema.optional(),
})

// 필터 트리 노드 — 조건(leaf) 또는 그룹(branch, 재귀). z.lazy 로 자기참조.
type FilterNodeShape =
  | z.infer<typeof filterConditionSchema>
  | { op: 'and' | 'or'; children: FilterNodeShape[] }
const filterNodeSchema: z.ZodType<FilterNodeShape> = z.lazy(() =>
  z.union([
    filterConditionSchema,
    z.object({ op: z.enum(['and', 'or']), children: z.array(filterNodeSchema) }),
  ]),
)
const filterGroupSchema = z.object({
  op: z.enum(['and', 'or']),
  children: z.array(filterNodeSchema),
})

// 영속 필터 표현 — 트리 루트(FilterGroup) 또는 레거시 평탄 배열(FilterCondition[]). 로더가 정규화.
const filterExprSchema = z.union([filterGroupSchema, z.array(filterConditionSchema)])
const sortSchema = z.object({ key: z.string(), dir: z.enum(['asc', 'desc']) })

const aggregationTypeSchema = z.enum([
  'none',
  'count',
  'count_empty',
  'count_not_empty',
  'count_unique',
  'sum',
  'avg',
  'min',
  'max',
])

/**
 * 행 쿼리 표면(POST /rows/query) 입력 — filter/sort/search/aggregate/keyset 페이지.
 * lib/workspace/row-query 의 RowQuery 와 동형. 영속 뷰 config 와 *같은* building block(필터/정렬/집계)을
 * 재사용해 검증 어휘를 한 곳에 모은다(드리프트 0). page.limit 상한은 표면(row-query)이 클램프한다.
 */
export const rowQuerySchema = z.object({
  filter: filterExprSchema.optional(),
  sort: z.array(sortSchema).optional(),
  search: z.string().optional(),
  aggregate: z.record(z.string(), aggregationTypeSchema).optional(),
  page: z
    .object({
      limit: z.number().int().optional(),
      cursor: z.string().optional(),
    })
    .optional(),
})

// 뷰 surface 종류 — 영속 가능한 ViewType 집합(노션식). 'grid' 는 레거시(노션 gallery) 입력으로만 받는다.
// export 소비처: ai/workspace-schema/edit-ops 의 setViewType op(viewType 필드 검증, 뷰 타입 단일 출처).
// transform 전 raw enum(입력 표면)으로, viewSchema.type 과 setViewType op 이 같은 어휘를 공유한다(드리프트 방지).
export const viewTypeSchema = z.enum([
  'table',
  'grid',
  'gallery',
  'board',
  'list',
  'timeline',
  'calendar',
  'feed',
  'chart',
  'dashboard',
  'map',
])

// 타임라인 축 설정 — TimelineConfig 미러(startKey 필수, endKey/zoom 선택).
const timelineConfigSchema = z.object({
  startKey: z.string(),
  endKey: z.string().optional(),
  zoom: z.enum(['day', 'week', 'month', 'quarter']).optional(),
})

const viewSchema = z.object({
  visibleProps: z.array(z.string()).optional(),
  // 이 뷰가 이미 아는 컬럼(CollectionViewConfig.knownProps). 빠지면 PATCH 마다 strip 되어
  // 숨긴 컬럼이 다음 로드에 "새 컬럼"으로 되살아난다.
  knownProps: z.array(z.string()).optional(),
  sort: z.array(sortSchema).optional(),
  // 트리(FilterGroup) 또는 레거시 평탄 배열. 로드 시 normalizeFilterRoot 가 정규화.
  filters: filterExprSchema.optional(),
  groupBy: z.string().optional(),
  groupEmptyAs: z.string().optional(),
  // 'grid' 는 레거시(노션 gallery) — 입력은 받되 즉시 'gallery' 로 정규화해 영속(어휘 정렬, 하위호환).
  type: viewTypeSchema.transform((t) => (t === 'grid' ? ('gallery' as const) : t)).optional(),
  aggregations: z.record(z.string(), aggregationTypeSchema).optional(),
  // 그룹값 → 카드 id 순서. 키는 GROUP_EMPTY 같은 sentinel 도 허용.
  cardOrder: z.record(z.string(), z.array(z.string())).optional(),
  // 행 id 의 수동 정렬 순서(table 뷰 드래그). 미추가 시 PATCH 마다 strip → 순서 영속 안 됨.
  rowOrder: z.array(z.string()).optional(),
  coverKey: z.string().optional(),
  // 아래 필드들은 CollectionViewConfig 에 있으나 과거 Zod 에 누락돼 PATCH 마다 strip → 영속되지 않던 뷰 설정들
  // (카드 크기·타임라인 축·빈 그룹 숨김·행 높이·셀 줄바꿈·그룹 정렬). collections types 와 정합시켜 라운드트립 보장.
  cardSize: z.enum(['S', 'M', 'L']).optional(),
  cardPropLabels: z.boolean().optional(),
  // 보드 카드의 관계 표(RelationTableConfig) — 빠지면 PATCH 마다 strip 되어 표 설정이 저장되지 않는다.
  relationTable: z
    .object({
      key: z.string(),
      columns: z.array(z.string()).optional(),
      maxRows: z.number().int().min(1).max(20).optional(),
      variant: z.enum(['table', 'list', 'rows']).optional(),
      collapsed: z.boolean().optional(),
    })
    .optional(),
  // 보드 카드 짜임(CardLayoutConfig) — 빠지면 PATCH 마다 strip 되어 배지 · 숫자 띠가 저장되지 않는다.
  cardLayout: z
    .object({
      badgeKey: z.string().optional(),
      metrics: z.array(z.string()).max(4).optional(),
    })
    .optional(),
  timeline: timelineConfigSchema.optional(),
  hideEmptyGroups: z.boolean().optional(),
  // 보드의 빈 열을 좁은 띠로 접기(collapseEmptyGroups) — 빠지면 PATCH 마다 strip 된다.
  collapseEmptyGroups: z.boolean().optional(),
  rowHeight: z.enum(['S', 'M', 'L']).optional(),
  wrapCells: z.boolean().optional(),
  groupSort: z.enum(['manual', 'name', 'count']).optional(),
  // 뷰별 컬럼 폭(키 → px). 범위는 PropertyDef.width 의 px 와 같은 40~800 — 빠지면 PATCH 마다 strip 되어
  // 끌어서 맞춘 폭이 저장되지 않는다.
  columnWidths: z.record(z.string(), z.number().int().min(40).max(800)).optional(),
})

// 명명 뷰(SavedView) — 다중 뷰. 노션 DB 의 좌상단 탭 단위.
const savedViewSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(64),
  config: viewSchema,
})

/** CollectionSchemaConfig 의 JSON 안전 부분(설명 · properties 오버라이드 · 동적 base · 명명 뷰). */
export const collectionConfigSchema = z.object({
  // 컬렉션 설명(노션식 헤더 부제) — 타입(CollectionSchemaConfig.description)과 정합. 미지정/빈값은 생략.
  description: z.string().max(500).optional(),
  properties: z
    .record(
      z.string(),
      z.object({
        // label: 프리셋(팩 정의) 컬럼의 "이름 변경" 오버라이드(예: 'title'→'이름'). 타입엔 있으나 Zod 에
        // 누락돼 있어 PATCH 마다 strip → 프리셋 컬럼 rename 이 영속되지 않던 버그. base 컬럼 label(min1·max64)과
        // 정렬. (동적 base 컬럼은 base[].label 로 영속되므로 영향 없었고, 프리셋만 이 경로를 탔다.)
        label: z.string().max(64).optional(),
        options: z.array(optionSchema).optional(),
        locked: z.boolean().optional(),
        width: columnWidthSchema.optional(),
      }),
    )
    .optional(),
  base: z.array(basePropertyDefSchema).optional(),
  views: z.array(savedViewSchema).optional(),
  activeViewId: z.string().optional(),
  /** 레거시 단일 view — 신규 클라이언트는 views[] 로 보낸다. 호환을 위해 받기만. */
  view: viewSchema.optional(),
})

// 셀 단위 신뢰등급(R-37) — BlockDocument.trust 의 전송 검증 미러. properties 와 *형제*이므로 여기서도
// 따로 받아야 한다: 빠지면 행 PATCH 마다 Zod 가 trust 를 strip 해 **값만 남고 근거가 조용히 사라진다**
// (등급이 전부 hypothesis 로 리셋되는 것과 같다). 격자 정의의 SoT 는 trust.ts 의 GRADES 다.
const cellTrustSchema = z.object({
  g: z.enum(['hypothesis', 'claimed', 'sourced', 'verified']),
  /** 근거 출처(사람이 읽는 한 줄) — '행안부 인허가' · '제보 2건' 등. */
  src: z.string().max(200).optional(),
  /** 근거를 확인한 시각(ISO) — 신선도 강등(decayStale)의 입력. */
  at: z.string().max(40).optional(),
})

/** 블록 문서(레코드=행) — properties(frontmatter) + body(블록 트리) + locked + trust(셀 등급). 워크스페이스 DB 행에 사용. */
export const blockDocumentSchema = z.object({
  properties: z.record(z.string(), propertyValueSchema).optional(),
  body: z.array(z.record(z.string(), z.unknown())).optional(),
  locked: z.boolean().optional(),
  trust: z.record(z.string(), cellTrustSchema).optional(),
})
