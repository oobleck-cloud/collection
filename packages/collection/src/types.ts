// @mvos/collections — Collection + Views 플랫폼의 도메인 무관 타입(D-8 §3).
// "레코드 = 블록 문서, 속성 = 문서에서 추출(projection), 뷰 = 렌더러"라는 노션식 구조를
// 도메인 특화로 좁힌 타입 집합. 어떤 블록팩(policy·product…)의 문서든 컬렉션이 될 수 있도록
// 블록팩에 역의존하지 않는다 — 블록팩은 projection 인터페이스(BlockPack)만 구현하면 된다.

// 조건부 서식은 필터 어휘(FilterExpr) 위에 세워져 있어 이 파일의 타입에 의존한다 →
// 순환을 피하려고 타입만 역참조한다(값 import 없음, conditional-format.ts 는 types.ts 에서 읽는다).
import type { ConditionalFormatRule } from './conditional-format'

/**
 * 뷰 surface 종류(노션식). facade(CollectionView)가 이 값으로 레지스트리에서 렌더러를 디스패치한다.
 *  - table: 표(기본). - board: 칸반. - gallery: 카드 갤러리(구 'grid' — 어휘 정렬). - list: 리스트. - timeline: 타임라인. - calendar: 월 그리드 캘린더. - feed: 시간순 카드 스트림. - chart: 분포 막대 차트. - dashboard: 스키마 파생 자동 지표 요약. - map: geo 속성 기준 지도 핀.
 * 영속된 레거시 'grid' 값은 로드 시 normalizeViewType 이 'gallery' 로 정규화한다(하위호환).
 */
export type ViewType =
  | 'table'
  | 'board'
  | 'gallery'
  | 'list'
  | 'timeline'
  | 'calendar'
  | 'feed'
  | 'chart'
  | 'dashboard'
  | 'map'

/** 프로퍼티(=뷰 컬럼) 타입 — 노션류를 도메인으로 좁힘. 타입마다 필터 연산자/정렬 규칙이 다르다. */
export type PropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'relation' // 다른 컬렉션 레코드 참조(예: 상품↔플랜)
  | 'url'
  | 'email'
  | 'phone'
  | 'geo' // 위치(경위도 + 도로명주소) — 값은 GeoValue 객체(#45). 지도 뷰는 별도(#36).
  | 'button' // 행 액션 버튼(노션식 버튼 속성) — 값은 ButtonValue 객체, 클릭은 ViewSurfaceProps.onAction 으로 위임.
  | 'person' // 사람(계정) 한 명 — 값은 계정 id. 이름·보조표기는 PropertyDef.options(호스트가 채운 명단)에서 푼다.
  | 'multi_person' // 사람 여러 명 — 값은 계정 id[]. multi_select 와 같은 규칙(has/not_has·그룹 fan-out).
  | 'struct' // 구조 속성 — 자기 값이 없고 다른 속성들을 칸(slot)으로 묶어 보이고 고친다. 정의는 PropertyDef.struct, 규칙은 ./struct.

/**
 * 프로퍼티 정의(컬렉션 레벨의 컬럼 정의).
 * - source: 'frontmatter'(편집형, 셀에서 수정 → 문서 frontmatter 역기록) | 'projection'(계산형, 읽기전용, 본문 파생).
 * - origin: 'base'(사용자가 자유 추가한 동적 컬럼) | 'preset'(블록팩이 정의한 정적 프리셋 세트).
 *   D-8 §3: 스키마 = 동적 베이스 + 정적 프리셋 세트.
 */
/**
 * 노션식 태그 색 이름 — DS `TagColor` 와 동일 집합(구조적 호환). select/multi_select 칩·TagValue 색.
 * 팔레트의 단일 진실원천은 options.ts 의 TAG_PALETTE(OptionColor)이며 이 union 은 그와 일치한다 —
 * 값 하나라도 어긋나면 OptionColor↔TagColorName 상호 대입에서 컴파일 에러가 난다(오타를 컴파일 타임에 차단).
 */
export type TagColorName = 'gray' | 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'teal'

/**
 * select / multi_select 옵션 정의(노션식). 배열 순서 = 표시 순서.
 * - label 미지정 → value 를 라벨로. - color 미지정 → value 해시로 안정 색(노션식).
 */
export type SelectOption = {
  value: string
  label?: string
  /** DS Tag 색 이름(gray|blue|green|orange|red|purple|teal). 미지정 = 값 해시 색. */
  color?: string
  /** 보조 표기 — person 피커가 이름 옆에 보인다(이메일·역할 등). */
  hint?: string
  /**
   * 새로 고를 수 없는 선택지(비활성 계정 등). 이미 들어 있는 값의 이름 풀이에는 쓰이고,
   * 셀 피커 목록에서는 빠진다.
   */
  inactive?: boolean
}

/**
 * 컬럼 폭 — 노션식 3-모드 시스템(JSON 안전, base 동적 컬럼에도 영속 가능):
 *  - `fixed`: 픽셀 고정. 콘텐츠는 셀 내부에서 줄바꿈/잘림(태그가 컬럼을 밀어내지 않음).
 *  - `fit`: 콘텐츠에 맞춤(작은 기본 폭, table-fixed 한계로 실질 ~px 고정).
 *  - `fill`: 남은 공간 채움. 보통 *한 컬럼*에만 적용(title). 두 컬럼 이상이면 비율 분할.
 * 미지정 시 TableView 가 PropertyType 별 기본값을 결정한다.
 */
export type ColumnWidth =
  | { mode: 'fixed'; px: number }
  | { mode: 'fit'; px?: number }
  | { mode: 'fill'; minPx?: number }

/**
 * 커스텀 셀 렌더러가 받는 행 맥락 — 한 셀이 여러 필드를 합쳐 그릴 수 있게 한다.
 * (예: 구역 칩은 `workRegionId` + `workRegionCode` 둘 다 필요하고,
 *  출발지 셀은 `departure` 아래 `departureDetail` 을 작게 붙인다.)
 */
export type CellRenderContext = {
  /** 이 행의 레코드 id. */
  id: string
  /** 이 행의 전체 속성 맵(추출 후). 다른 컬럼 값을 함께 읽을 때. */
  props: Record<string, PropertyValue>
  /** 이 컬럼의 정의(라벨·타입·옵션). */
  def: PropertyDef
  /**
   * 표 전체 스키마 — 한 칸이 다른 컬럼의 정의(라벨·타입·단위)까지 알아야 할 때(구조 속성의 칸).
   * 미지정이면 그 칸은 다른 컬럼을 모르는 것으로 그린다.
   */
  schema?: readonly PropertyDef[]
  /**
   * 이 행의 **다른** 컬럼 값을 고친다 — 구조 속성은 자기 값이 없고 칸이 가리키는 속성을 고친다.
   * 미지정 = 읽기 전용.
   */
  edit?: (key: string, value: PropertyValue) => void
}

/**
 * date 값의 표시 글자 모양 — PropertyDef.dateFormat. 'relative' 는 오늘 기준 「D-3」·「D-day」·「D+2」,
 * 'short' 는 「10/23(목)」(올해가 아니면 「2025/10/23(목)」) — 카드 한 줄에 끼는 짧은 날짜.
 */
export type DateDisplayFormat = 'ko' | 'iso' | 'relative' | 'short'

/**
 * 컬럼 머리 메뉴의 켜고 끄는 설정 한 줄 — 호스트가 컬럼마다 정한다(예: 커스텀 속성의 「콜 기록으로만 수정」).
 * 켜져 있으면 체크로 보이고, 누르면 [onToggle].
 */
export type ColumnToggle = {
  id: string
  label: string
  /** 메뉴 줄 아래 작은 설명(선택). */
  description?: string
  checked: boolean
  onToggle: () => void
}

export type PropertyDef = {
  key: string
  label: string
  type: PropertyType
  source: 'frontmatter' | 'projection'
  origin: 'base' | 'preset'
  /**
   * select / multi_select 의 옵션. 문자열 배열(레거시) 또는 리치 객체 배열. 배열 순서 = 표시 순서.
   *
   * person / multi_person 에서는 **사람 명단**이다(value = 계정 id, label = 이름, hint = 이메일·역할).
   * 정의가 아니라 호스트가 읽을 때마다 채우는 해석표라, 개명은 다음 렌더에 바로 따라간다.
   * 필터 값 선택·칩 라벨·그룹 라벨이 select 와 같은 자리에서 이름을 푼다.
   */
  options?: string[] | SelectOption[]
  /**
   * person / multi_person 셀의 「나」 지름길이 고를 계정 id(보는 사람). 미지정이면 지름길이 없다.
   * 필터의 「나」는 이것과 무관하다 — 저장된 보기에는 상대값으로 남고 질의 경계에서 풀린다.
   */
  selfPersonId?: string
  /**
   * 옵션 집합 잠금 — true 면 옵션 생성·삭제·순서변경 불가(고정 enum). 선택만 가능.
   * 상품 status 처럼 엔진이 의존하는 고정 enum 을 이 플래그로 표현한다(특수분기 아님).
   */
  locked?: boolean
  /**
   * 손으로 고칠 수 없는 까닭(「콜 기록으로 수정」) — 지정하면 머리에 자물쇠, 읽기 전용 칸과 보드 열 머리에 이 글을 보인다.
   * 칸을 고칠 수 없게 하는 것은 `source: 'projection'` 이고, 이 칸은 까닭을 말하면서 보드가 이 속성으로 묶였을 때 카드를 다른 열로
   * 옮기지 않게 한다(끌기 = 그 값을 고치는 쓰기라서). 호스트가 정한다.
   */
  readOnlyReason?: string
  /**
   * (플라톤 연역) 프로토타입(Form)이 선언한 *상속 컬럼* — true 면 구조 잠김(삭제·타입변경 불가, 값·이름은 자유).
   * 일반 편집(/schema)에선 잠금 표시·비활성, Form 편집(/prototype-schema)에서만 정의/해제. 미지정=자유 컬럼.
   */
  inherited?: boolean
  /**
   * 컬럼 폭(노션식) — 미지정 시 PropertyType 별 기본값(TableView 가 결정). 사용자 드래그 리사이즈 후 영속 시 사용.
   */
  width?: ColumnWidth
  /**
   * 읽기전용 표시 포맷터(선택). projection 값이 스칼라(PropertyValue)가 아닐 때 — 예: 가격범위 {min,max} —
   * 셀에 보일 문자열을 만든다. 지정 시 ReadonlyCell 이 타입별 렌더 대신 이 결과를 쓴다(빈 문자열 = 미설정 '—').
   */
  format?: (value: unknown) => string
  /**
   * 평문으로 옮길 때(CSV 내보내기)의 글자 — 지정 시 타입별 규칙(선택지 라벨 등)보다 앞선다. 관계 칸처럼 값(id)만으로는
   * 사람이 읽을 말을 못 만들고 행의 다른 값(경로 코드)이 필요할 때 화면이 단다.
   */
  exportText?: (value: PropertyValue, props: Record<string, PropertyValue>) => string
  /**
   * date 컬럼이 **날짜만** 담는가(이사일·세일즈콜 날짜처럼 그날 자체가 값인 것). 미지정 = 시각까지 담을 수 있다.
   *
   * 날짜만 든 값은 질의에서 그날 0시로 읽힌다 — `이사일 ≥ 지금` 은 오늘 이사를 떨구고 `이사일 ≤ 3시간 후` 는 오늘 것을
   * 모두 맞힌다. 그래서 필터 편집기가 이 컬럼에는 「N시간 전/후」와 시각 칸을 내지 않는다. 코드가 소유한다.
   */
  dateOnly?: boolean
  /**
   * date 컬럼을 어떤 글자로 보이나 — 표 칸·카드·편집 트리거·자동 폭이 같이 따른다(저장값은 그대로).
   *  - `'ko'`(기본): 「2026. 10. 21.」(시각이 있으면 「2026. 10. 21. 14:30」)
   *  - `'iso'`: 「2026-10-21」(시각이 있으면 「2026-10-21 14:30」) — 날짜가 줄지어 서는 목록에서 자릿수가 맞는다.
   *  - `'relative'`: 오늘(보는 사람의 로컬 날짜) 기준 「D-3」·「D-day」·「D+2」(시각이 있으면 「D-1 14:30」) — 기한처럼
   *    「며칠 남았나」가 값의 뜻인 열. 임박 색은 조건부 서식이 맡는다(이 모양은 글자만 바꾼다).
   * 코드가 소유한다.
   */
  dateFormat?: DateDisplayFormat
  /**
   * 카드(board·gallery)에서 이 속성 앞에 붙는 이름표 — 뷰의 `cardPropLabels` 가 켜졌을 때만 쓴다.
   * 미지정이면 `label`. **빈 문자열이면 이름표 없이** 다른 빈 이름표 속성과 한 줄에 「 · 」로 잇는다
   * (「0 / 7 · 010-2384-1192」 — 무엇인지 값이 스스로 말하는 속성). 코드가 소유한다.
   */
  cardLabel?: string
  /**
   * 카드에서 이 속성이 비었을 때 대신 보일 속성 키 — 「최근 학습」이 없으면 「가입」을 보이는 식.
   * 대신 보이는 속성은 자기 이름표·서식을 쓴다. 대신 보일 것도 비었으면 아무것도 그리지 않는다. 코드가 소유한다.
   */
  cardFallbackKey?: string
  /**
   * 카드에서 이 속성을 이름표 줄이 아니라 **위 메타 한 줄**에 「이름표 값」으로 잇는다(「방문 10/23(목) 11:30」).
   * 이름표 없는(`cardLabel: ''`) 속성과 같은 줄에 「 · 」로 선다. 뷰의 `cardPropLabels` 가 켜졌을 때만. 코드가 소유한다.
   */
  cardMeta?: boolean
  /**
   * 카드 이름표를 행의 **다른 속성 값**에서 읽는다(요약 묶음 — 기준가가 희망가면 「희망가」, 타업체 견적이면 「타업체 견적」).
   * 그 값이 비면 `cardLabel` → `label`. 코드가 소유한다.
   */
  cardLabelKey?: string
  /**
   * 커스텀 셀 렌더러(이스케이프 해치) — 지정 시 이 컬럼의 셀은 타입별 렌더도 `format` 도 타지 않고
   * 이 함수의 반환 노드를 그대로 그린다. 편집형 컨트롤보다도 우선한다(코드가 소유한 표현이므로).
   *
   * 왜 필요한가: 이 플랫폼의 값 어휘(PropertyValue)는 스칼라 + Geo/Button/Tag 뿐이라, 도메인 화면이
   * 이미 쓰는 셀 표현(엔티티 참조 칩, 2줄 스택 텍스트, 주소+상세주소 합성)을 표현할 방법이 없다.
   * `format` 은 문자열만 낼 수 있어 칩·링크·2줄 배치를 못 만든다.
   *
   * 두 번째 인자로 행 맥락을 받는다 — 한 셀이 여러 필드를 합쳐 그리는 경우(구역 id + 코드,
   * 출발지 + 상세주소)가 실제로 흔하기 때문.
   *
   * JSON 안전이 아니다(함수) — `format` 과 같은 규칙으로 **코드가 소유**하며,
   * `CollectionSchemaConfig`(영속 오버라이드)·`BasePropertyDef`(사용자 동적 컬럼)에는 없다.
   */
  render?: (value: PropertyValue, ctx: CellRenderContext) => import('react').ReactNode
  /**
   * 검색어 → 이 컬럼의 필터 제안(자동완성). 미지정 시 `PropertyType` 별 내장 규칙이 쓰인다.
   *
   * 다는 자리는 **값 집합을 코드가 모르는 컬럼**이다 — 서비스 구역처럼 "성북구가 실제로 있는
   * 구역인가" 를 조회해 봐야 아는 것. 그래서 시그니처가 비동기다(내장 규칙은 즉시 resolve).
   *
   * 검증은 **완성형이 아니라 접두형**으로 쓴다. `010` 은 유효한 번호가 아니지만 전화번호로
   * 자라날 수 있으므로 제안이 떠야 한다 — 다 치고 난 뒤에 뜨는 건 자동완성이 아니다.
   *
   * `render`/`format` 과 같은 규칙으로 **코드가 소유**한다(함수 = JSON 안전 아님).
   * 자세한 계약은 ./search-suggest 의 `PropertySuggester`.
   */
  suggest?: import('./search-suggest').PropertySuggester
  /**
   * 일련번호의 자릿수 — **부분 입력과 완성 입력을 가르는 기준**(number 컬럼 전용).
   *
   * 주문번호가 7자리인데 사용자가 `2034` 까지 쳤다면 그건 "이 번호와 같다" 가 아니라
   * "이 조각을 포함한다" 는 뜻이다. 자릿수를 모르면 엔진은 둘을 구별할 수 없어 `= 2034` 를
   * 제안하고 결과는 0건이 된다 — 접두 검증은 넣었는데 **연산자 선택**이 완성형 가정에
   * 머물러 있던 자리다.
   *
   * 미지정이면 판단하지 않고 `=` 와 `포함` 을 둘 다 제안한다(사용자가 고른다).
   * 실제 자릿수가 늘어도(7→8) 완성 입력이 부분으로 취급될 뿐이라 조용히 넓게 동작한다.
   */
  digits?: number
  /**
   * **표에 세우지 않지만 검색·필터는 아는 필드.**
   *
   * 검색 가능한 필드와 표시 컬럼은 같지 않다. 주문 목록은 전화번호를 컬럼으로 보여주지
   * 않지만 서버는 전화번호로 훑는다 — 그래서 `010` 을 치면 낱말 검색은 찾아내는데
   * 자동완성은 제안할 컬럼이 없어 침묵했다. 화면이 아는 것과 검색이 아는 것이 갈리면
   * 사용자는 "이 목록은 전화번호를 모르는구나" 로 잘못 배운다.
   *
   * true 면 컬럼 자리(기본 표시 목록·프로퍼티 패널·정렬 후보)에서는 빠지고,
   * **제안과 필터에서는 살아 있다**. 필터 편집기에도 남는 이유는, 자동완성으로 걸린 조건을
   * 거기서 못 보면 "칩은 있는데 편집기엔 없는" 반쪽 상태가 되기 때문이다.
   */
  searchOnly?: boolean
  /**
   * **자리는 있지만 기본으로는 세우지 않는 컬럼.**
   *
   * `searchOnly` 와 다르다. searchOnly 는 컬럼 자리 자체가 없고(검색·필터만 안다),
   * 이 플래그는 컬럼으로 세울 수 있으나 처음에는 접혀 있다 — 사용자가 프로퍼티 패널에서
   * 켜면 다른 컬럼과 똑같이 동작한다.
   *
   * 왜 필요한가: 커스텀 컬럼 하나에 파생 컬럼이 셋(마지막 수정일·수정한 사람·수정 횟수)
   * 붙는다. 다 세우면 컬럼 다섯 개짜리 표가 스무 개가 된다. 반대로 스키마에서 빼면
   * 필터·정렬 후보에서도 사라져 "언제 바뀌었나" 로 거를 수 없다.
   */
  hiddenByDefault?: boolean
  /**
   * 속성 고르기에서 이 속성이 놓일 자리 — 바깥에서 안쪽으로(`['주문', '일정']`, `['견적', '계약 파트너']`).
   *
   * 속성이 수십 개가 되면(주문: 기본·장소·일정·견적·관계 너머 값) 평평한 목록으로는 찾을 수 없다.
   * 필터 추가 목록이 이 경로로 묶어 머리글 아래 모으고, 검색 중에는 경로를 라벨 옆에 보여
   * 같은 이름(평점)이 어느 관계의 것인지 가른다. 비우면 묶음 없이 맨 앞에 선다.
   */
  group?: string[]
  /** 검색이 이름 말고도 알아들을 말(별칭) — 「이사일」로 「이사 예정일」을 찾는 식. */
  aliases?: string[]
  /**
   * 선택지 색을 팀이 고를 수 있는가 — 헤더 메뉴의 "선택지 색".
   *
   * 미지정이면 플랫폼 기본(`isOptionColorEditable`): 선택지가 있고 셀을 직접 그리지 않는
   * select/multi_select 는 열린다. 옵션 집합이 잠겨 있어도(서버가 정한 enum) 색은 팀이 정한다.
   * `render` 로 그리는 컬럼은 옵션 색을 쓸 때만 `true` 로 밝힌다. 저장은 호스트 몫(`onOptionColorChange`).
   */
  colorEditable?: boolean
  /**
   * 컬럼 폭 자동 계산 힌트(`auto-size.ts`). 미지정이면 값의 문자열화로 폭을 잡는다.
   *
   * `render` 로 그리는 셀은 원값과 보이는 문자열이 다르다(상태 `synced` → 배지 "접수됨").
   * 그런 컬럼은 `text` 로 **실제 보이는 문자열**을 알려줘야 폭이 맞는다.
   * JSON 안전 아님 — `render`/`format` 과 같이 코드가 소유한다.
   */
  autoSize?: {
    /** 폭 계산에 쓸 표시 문자열. */
    text?: (value: PropertyValue, props: Record<string, PropertyValue>) => string
    /** 텍스트 외 장식 폭(배지 패딩·점·아이콘 등). */
    extraPx?: number
    minPx?: number
    maxPx?: number
  }
  /** type='relation' 일 때 대상 컬렉션과 카디널리티 — TableView relations registry 와 매칭. */
  relation?: RelationConfig
  /**
   * 필수 값 여부 — **데이터 API 쓰기 계약에만** 쓰인다(record-schema 가 Zod 로 파생). 미지정 = false(자유).
   * 대시보드 셀 편집은 이 플래그를 강제하지 않는다(노션식 자유 입력 유지) — 강제 지점은 외부에서 들어오는
   * 행 생성(POST)이고, 부분 갱신(PUT 머지)에선 무시된다(보내지 않은 필드는 기존 값을 유지하므로).
   */
  required?: boolean
  /**
   * 수 컬럼의 단위 — 금액이 원과 만 원으로 섞여 있어서 둔다. 표시·구조 속성의 환산·입력 확인이 이 값을 읽는다.
   * 미지정 = 단위 없음(그 수 그대로).
   */
  unit?: NumberUnit
  /** type='struct' 일 때 칸과 배치. 규칙은 ./struct. */
  struct?: StructConfig
}

/** 수 단위 — 원 · 만 원. */
export type NumberUnit = 'won' | 'manwon'

/**
 * 구조 속성의 배치 — 칸을 어떤 모양으로 묶는가.
 *  - compare: 비교(from → to, 차이). - range: 범위(min ~ max). - route: 경로(from → to). - summary: 요약 줄(item × n).
 */
export type StructLayout = 'compare' | 'range' | 'route' | 'summary'

/**
 * 칸의 자리 — 배치마다 쓰는 자리가 정해져 있다(compare=from·to·diff, range=min·max, route=from·to, summary=item).
 * state 는 compare · range 의 선택 칸 — 선택 속성 하나가 수 칸을 켜고 끈다(희망가 응답 「금액 받음」일 때만 하한 · 상한).
 */
export type StructSlotRole = 'from' | 'to' | 'diff' | 'min' | 'max' | 'item' | 'state'

/**
 * 구조 속성의 칸 하나.
 *  - keys: 가리키는 속성 키(내장 · `x:` 커스텀). 둘 이상이면 **앞에서부터 첫 값**을 쓴다
 *    (기준가 = 희망 금액, 없으면 타업체 견적 금액).
 *  - label: 칸 이름. 미지정이면 첫 키의 라벨.
 */
export type StructSlot = {
  role: StructSlotRole
  label?: string
  keys: string[]
}

/**
 * 구조 속성 정의 — 값을 저장하지 않는다. 읽을 때 칸이 가리키는 값을 묶고, 고치면 밑 속성이 고쳐진다
 * (출처 · 이력은 밑 속성에 그대로 남는다). 구조 속성은 다른 구조 속성을 가리키지 않는다(한 단계).
 *  - better: compare 의 차이가 어느 쪽이 좋은가 — 색(나쁜 쪽 = warning)을 정한다. 미지정 = 색 없음.
 */
export type StructConfig = {
  layout: StructLayout
  slots: StructSlot[]
  better?: 'lower' | 'higher'
  /**
   * state 칸의 이 값들일 때만 수 칸이 켜진다(예: ['금액 받음']). 다른 값이면 수 칸은 비활성이고 표 · 카드는
   * 응답(「모름」)을 보인다. state 칸이 비어 있으면 켠 것으로 본다(응답을 적지 않은 기존 기록). 미지정 = 늘 켬.
   */
  activeWhen?: string[]
}

/**
 * 사용자가 동적으로 추가한 베이스 프로퍼티(D-8 §3 "동적 베이스") — JSON 안전 형태.
 * applySchemaConfig 가 PropertyDef(origin='base', source='frontmatter')로 변환해 팩 기본 앞에 끼운다.
 * relation 도 base 로 추가 가능 — RelationConfig.target 으로 대상 컬렉션을 명시. format 은 base 에 없음(JSON 안전).
 */
export type BasePropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'date'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'phone'
  | 'relation'
  | 'geo'
  | 'person'
  | 'multi_person'
  | 'struct'

export type BasePropertyDef = {
  key: string
  label: string
  type: BasePropertyType
  options?: SelectOption[]
  locked?: boolean
  /** (플라톤 연역) 프로토타입(Form)이 선언한 상속 컬럼 — 구조 잠금. 자세한 의미는 PropertyDef.inherited 참조. */
  inherited?: boolean
  /** 노션식 컬럼 폭(드래그 리사이즈 영속 등). 미지정 시 PropertyType 별 기본값. */
  width?: ColumnWidth
  /** type='relation' 일 때 대상 컬렉션과 카디널리티. */
  relation?: RelationConfig
  /** 데이터 API 쓰기에서 필수인가(record-schema 파생). 자세한 의미는 PropertyDef.required 참조. */
  required?: boolean
  /** number 의 단위. 자세한 의미는 PropertyDef.unit 참조. */
  unit?: NumberUnit
  /** type='struct' 의 칸 · 배치. 「+」 로 만들 때는 비어 오고, 호스트가 저작 폼으로 채운다. */
  struct?: StructConfig
}

/**
 * Relation 컬럼 메타 — 도메인 무관(컬렉션 키로 간접 참조). TableView 의 relations registry 에서
 * 같은 키의 RelationProvider 를 찾아 검색/해상한다. 노션 DB Relation 과 동형.
 *  - target: 대상 컬렉션의 안정 키(예: 'plan', 'product'). 호스트(앱)가 키와 provider 를 등록.
 *  - cardinality: 'one'(단일 참조, 값=id 문자열) | 'many'(다중, 값=id[]). 기본 'one'.
 */
export type RelationCardinality = 'one' | 'many'

export type RelationConfig = {
  target: string
  cardinality?: RelationCardinality
}

/** Relation 검색·해상 결과의 단일 옵션. id 는 영속값, label 은 표시값, hint 는 보조 메타(상태 등). */
export type RelationOption = {
  id: string
  label: string
  hint?: string
  /**
   * 계층 값의 두 부분 — 칸의 칩을 「앞말(흐리게) + 본말(굵게)」 회색 면 칩으로 그린다(예: 구역 「서울 구로구」 =
   * `{ qualifier: '서울', name: '구로구' }`). 없으면 label 한 덩이의 기본 칩. label 은 그대로 툴팁·검색·필터의 평문이다.
   */
  parts?: { qualifier?: string; name: string }
  /**
   * 이 레코드를 덮는 레코드의 id — 같은 칸에 그 레코드가 함께 있으면 이 칩은 숨긴다(「고양 전체」가 「고양 덕양구」를
   * 덮는다). 덮는 칩을 지우면 덮여 있던 것도 함께 지운다(숨어 있던 값이 되살아나지 않게).
   */
  coveredBy?: string
  /**
   * 가리키는 레코드가 대상 컬렉션에 없다(지워졌거나 옛 버전) — provider 가 대신 적을 말을 label 에 담아 답한다
   * (「알 수 없는 구역」). 칸은 흐린 글자(읽기 전용)·흐린 칩(편집형)으로 그리고 title 에 id 를 남긴다.
   */
  missing?: boolean
}

/**
 * relation 컬럼 추가 시 "연결 대상" 피커의 한 항목 — value(=영속될 RelationConfig.target) + label(표시명).
 * 미지정 시(상품 등) 뷰는 relations 레지스트리 키를 value=label 로 폴백한다(현행 동작).
 * 워크스페이스는 노드 id(value)와 DB 이름(label)이 달라 이 형태로 라벨을 분리 제공한다.
 */
export type RelationTargetOption = {
  value: string
  label: string
}

/**
 * 컬렉션의 RelationProvider — 검색(자동완성)과 해상(id→label)을 제공.
 * 도메인은 호스트가 알고, 플랫폼은 키로만 라우팅한다(역의존 없음).
 *  - search(query): 사용자 입력 변화마다 호출. 빈 query 는 "최근/대표" 류 반환 권장.
 *  - resolve(ids): 셀에 표시할 라벨이 필요할 때 일괄 조회(렌더당 1회). 미해상 id 는 생략 가능.
 */
export type RelationProvider = {
  search: (query: string) => Promise<RelationOption[]> | RelationOption[]
  resolve: (ids: string[]) => Promise<RelationOption[]> | RelationOption[]
  /**
   * 대상 레코드의 속성(선택) — 관계 표(카드·문서 안 블록)가 대상 레코드의 칸을 그릴 때 읽는다.
   * 미지정이면 관계 표를 그릴 수 없다(칩만 — 현행). 자세한 계약은 `RelatedRecordSource`.
   */
  records?: RelatedRecordSource
}

/** 관계 표 한 줄 — 대상 레코드 하나(id + 속성 행). */
export type RelatedRecordRow = {
  id: string
  props: Record<string, PropertyValue>
}

/**
 * 관계 표 줄의 동작 버튼(호스트가 단다) — 줄 오른쪽 끝에 놓인다. 실행은 호스트(순수 콜백).
 * 함수를 담으므로 JSON 안전이 아니다 — 뷰 설정이 아니라 코드가 소유한다(`render`·`format` 과 같은 규칙).
 */
export type RelatedRowAction = {
  id: string
  /** 버튼 글자 — 동사 하나(「네고 콜」). */
  label: string
  /** 이 줄에 보일까. 미지정 = 모든 줄. */
  visible?: (row: RelatedRecordRow) => boolean
  /** 실행 — 카드(부모 레코드) id 와 줄(대상 레코드) id. */
  run: (ctx: { recordId: string; relatedId: string }) => void
}

/**
 * 관계 대상 레코드의 읽기 창구 — 관계 표가 대상 레코드의 속성을 표로 그리게 한다(도메인 무관).
 *
 * **동기 읽기다.** 호스트가 화면에 필요한 대상 레코드를 이미 한 번에 읽어 두고(페이지 단위 일괄 조회) 그 사본을 건넨다 —
 * 카드마다 따로 묻지 않는다(N+1 금지). 아직 읽는 중이면 빈 배열을 돌려주면 된다(표를 그리지 않는다).
 */
export type RelatedRecordSource = {
  /** 대상 컬렉션의 속성 정의 — 표 열의 후보·셀 렌더(`render`·`format` 도 쓴다). */
  schema: PropertyDef[]
  /** 기본 열(속성 키) — 뷰가 열을 고르지 않았을 때. 미지정 = 대상 스키마에서 숨김 아닌 것 전부. */
  defaultColumns?: string[]
  /** id 들 → 대상 레코드 행(**넘긴 순서대로**). 모르는 id 는 빠진다. */
  read: (ids: readonly string[]) => RelatedRecordRow[]
  /** 「+ N곳 더」의 셈 단위(「곳」·「건」). 미지정 = 로캘 기본(「개」). */
  countUnit?: string
  /** 줄 동작 버튼. */
  rowActions?: RelatedRowAction[]
}

/**
 * 컬럼별 합계/집계 종류(노션식 footer aggregation). table 뷰의 마지막 행이 컬럼당 한 결과를 표시.
 *  - none: 비활성
 *  - count: 전체 행 수(컬럼 무관, 일관성 유지를 위해 컬럼 단위 표시)
 *  - count_empty / count_not_empty: 빈 셀 수 / 값 있는 셀 수
 *  - count_unique: 고유 값 개수(배열은 평탄화 후 집합)
 *  - sum / avg / min / max: 숫자/날짜 컬럼 집계(타입 부적합이면 0/—)
 */
export type AggregationType =
  | 'none'
  | 'count'
  | 'count_empty'
  | 'count_not_empty'
  | 'count_unique'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'

/**
 * 타임라인 뷰 축 설정 — JSON 안전, optional(미설정 허용).
 * - startKey: 시작 날짜로 쓸 date 타입 속성 키(필수). 미설정 시 안내 상태.
 * - endKey: 종료 날짜 속성 키(optional). 설정 시 기간 막대, 미설정 시 점/짧은 막대.
 * - zoom: 시간축 눈금 단위. 미설정 = 'month'.
 */
export type TimelineConfig = {
  startKey: string
  endKey?: string
  zoom?: 'day' | 'week' | 'month' | 'quarter'
}

/**
 * 관계 표(카드 블록) 설정 — JSON 안전, optional. 보드 카드 아래에 관계 속성이 가리키는 대상 레코드를 작은 표로 그린다.
 * - key: 관계(type='relation') 속성 키. 대상 provider 에 `records` 가 있어야 그려진다.
 * - columns: 대상 레코드의 열(속성 키, 순서대로). 미지정 = provider 의 기본 열.
 * - maxRows: 카드에 보일 최대 줄 수(기본 3). 넘치면 「+ N개 더」 한 줄로 접는다.
 * - variant: 'table'(기본 — 머리 줄 · 줄 사이 선이 있는 작은 표) | 'list'(머리 줄 · 테두리 · 구분선 없는 목록 줄,
 *   첫 줄 동작이 채운 버튼). 카드가 이미 떠 있는 면이라 목록이 덜 시끄럽다.
 * - collapsed: true 면 처음엔 「견적 3곳 보기」 한 줄로 접어 두고, 누르면 그 자리에서 펼친다(카드는 열리지 않는다).
 */
export type RelationTableConfig = {
  key: string
  columns?: string[]
  maxRows?: number
  variant?: 'table' | 'list' | 'rows'
  collapsed?: boolean
}

/**
 * 카드 짜임(board) — JSON 안전, optional. 보이는 속성 중 일부를 이름표 줄 대신 정해진 자리에 세운다.
 * - badgeKey: 제목 오른쪽 배지(「D-1」). 상대 날짜(dateFormat 'relative')는 오늘 · 내일 · 지남이면 주의 색,
 *   그 밖의 색은 조건부 서식(그 속성을 대상으로 한 tone)이 정한다.
 * - metrics: 요약 묶음(옅은 바탕 하나). **첫째가 무게중심** — 왼쪽에 이름표 위 · 큰 값(「줄여야 할 금액 +20만」), 나머지는
 *   오른쪽에 작은 「이름표 값」 줄(「희망가 100만」·「최저 견적 120만」). 이름표는 cardLabelKey → cardLabel → label.
 *   값 색은 조건부 서식(그 속성을 대상으로 한 tone). 빈 값은 「—」.
 * 여기 든 속성은 visibleProps 에 있어야 서고, 이름표 줄에서는 빠진다.
 */
export type CardLayoutConfig = {
  badgeKey?: string
  metrics?: string[]
}

/**
 * 한 저장 뷰의 설정 부분 — visibleProps/sort/filters/groupBy/aggregations/cardOrder/coverKey/cardSize/timeline.
 * 노션식 다중 SavedView 의 단위. `type` 별로 의미 있는 필드만 사용된다.
 */
export type CollectionViewConfig = {
  visibleProps?: string[]
  /**
   * 이 뷰가 **이미 아는 컬럼** — visibleProps 에 없으면 "사용자가 숨긴 것"으로 읽는 키들.
   *
   * visibleProps 만으로는 "숨긴 컬럼"과 "저장 뒤에 새로 생긴 컬럼"이 둘 다 그냥 "목록에 없음"이라
   * 구별되지 않는다. 그래서 드리프트 정리가 새 컬럼을 드러내려고 빠진 것을 다 붙이면, 사용자가
   * 일부러 숨긴 컬럼까지 새로고침마다 되살아났다. 이 목록에 든 키는 다시 붙이지 않는다 — 자동
   * 노출은 **여기에도 없는(정말 처음 보는) 컬럼**에만 적용된다(`reconcileViewConfig`).
   *
   * 숨기는 경로(열 머리·속성 패널·드래그…)마다 "숨겼음"을 따로 적는 대신 "알던 것"을 적는 이유:
   * 경로가 몇 개든 기록하는 자리는 정리(로드)와 visibleProps 편집 두 군데로 끝난다.
   * 미지정 = 기록 이전에 저장된 뷰 → 예전 동작(빠진 컬럼을 모두 새 컬럼으로 본다).
   */
  knownProps?: string[]
  sort?: Sort[]
  /**
   * 필터 — 트리(FilterGroup) 또는 레거시 평탄 배열(FilterCondition[]). 로드 시 normalizeFilterRoot 로
   * 항상 FilterGroup 루트로 정규화된다(하위호환). 신규 영속은 FilterGroup 을 쓴다.
   */
  filters?: FilterExpr
  /** 그룹핑 기준 키(board) — select/multi_select 컬럼이 적합. */
  groupBy?: string
  /**
   * 빈 그룹값을 이 값의 그룹으로 본다(board 등) — 「기록이 없으면 신규」처럼 값이 비어 있는 레코드가 맨 끝 「없음」 열이 아니라
   * 그 옵션 열에 서게. 저장된 값은 바꾸지 않는다(카드를 옮길 때만 그 열의 값이 적힌다). 미설정 = 빈 값은 「없음」 그룹(현행).
   */
  groupEmptyAs?: string
  /** 뷰 surface — 미지정 = 'table'. 레거시 'grid' 는 로드 시 'gallery' 로 정규화. */
  type?: ViewType
  /** 컬럼 키 → 집계 종류. table 뷰 footer 에 표시. 'none' 또는 미지정 = 표시 안 함. */
  aggregations?: Record<string, AggregationType>
  /**
   * board 뷰 — 그룹값(GROUP_EMPTY 포함) → 카드 id 순서. 사용자 드래그 수동 정렬을 영속.
   * 비어있으면 viewRows 의 정렬을 그대로 사용(기본). cross-group 이동 시 호출자가 양쪽 그룹의 order 를 갱신.
   */
  cardOrder?: Record<string, string[]>
  /**
   * table 뷰 — 행 id 의 수동 정렬 순서(노션식 드래그). 사용자가 그립을 끌어 영속한 행 순서.
   * 비어있으면 records 순서(createdAt) 그대로. sort 가 걸리면 무시(정렬이 우선). 미등록 행은 끝에.
   */
  rowOrder?: string[]
  /** board/gallery 뷰 — 카드 상단 커버로 쓸 속성 키(주로 url 타입). 미지정 = 커버 없음. */
  coverKey?: string
  /**
   * board/gallery 뷰 — 카드 크기(S/M/L). 단일 진실원천은 ViewConfig.cardSize.
   * - S: 좁은 폭(176px), 커버 없음, 제목만.
   * - M: 표준 폭(240px, 기본), 커버 h-20, 보조 프로퍼티 표시.
   * - L: 넓은 폭(320px), 커버 h-32, 보조 프로퍼티 확장.
   * 보드는 열 폭이 곧 카드 폭이다 — S 240px · M 288px(기본, 현행) · L 400px(관계 표가 들어가는 넓은 카드).
   */
  cardSize?: 'S' | 'M' | 'L'
  /**
   * board/gallery 뷰 — 카드 속성을 아이콘 칩 대신 **이름표 붙은 글자 줄**로(「최근 학습 2026-10-21」).
   * 이름표는 속성의 `cardLabel`(없으면 `label`), 빈 이름표 속성은 한 줄에 「 · 」로 잇는다. 기본 false(아이콘 칩).
   */
  cardPropLabels?: boolean
  /**
   * board 뷰 — 카드 아래 관계 표(관계 속성이 가리키는 대상 레코드를 작은 표로). 미설정 = 표 없음(현행).
   * 자세한 의미는 `RelationTableConfig`.
   */
  relationTable?: RelationTableConfig
  /** board 뷰 — 카드 짜임(제목 옆 배지 · 숫자 띠). 미설정 = 이름표 줄만(현행). 자세한 의미는 `CardLayoutConfig`. */
  cardLayout?: CardLayoutConfig
  /**
   * timeline 뷰 — 날짜 축 설정. JSON 안전(함수 없음). 미설정 = 안내 상태.
   * startKey 필수, endKey 있으면 기간 막대(없으면 점/짧은 막대), zoom 으로 눈금 단위.
   */
  timeline?: TimelineConfig
  /**
   * 빈 그룹 숨김 — true 면 rows 0인 그룹 섹션(gallery/list) 및 카드 없는 컬럼(board)을 미표시.
   * groupBy 미설정 시 이 값은 무시된다. 기본 false(빈 그룹 표시 — 현행 동작).
   */
  hideEmptyGroups?: boolean
  /**
   * board 뷰 — 카드 없는 열을 좁은 세로 띠(라벨 + 0)로 접는다. 카드를 끄는 동안에는 다시 펼쳐져 놓을 자리가 된다.
   * hideEmptyGroups 가 켜져 있으면 빈 열은 아예 없으므로 이 값은 의미가 없다. 기본 false(빈 열도 제 폭 — 현행).
   */
  collapseEmptyGroups?: boolean
  /**
   * 표 행 높이(table 뷰) → DS Table density 토큰에 매핑(line-clamp 아님). 미설정 = 'S'(현행 compact, 회귀 0).
   *  - S: compact(기본, 현행 동작 불변). 셀 py 4px.
   *  - M: default. 셀 py 12px.
   *  - L: comfortable. 셀 py 16px.
   */
  rowHeight?: 'S' | 'M' | 'L'
  /**
   * 표 셀 줄바꿈(table 뷰). 미설정/false = 현행 동작(회귀 0).
   * true 면 편집형 multi_select·relation 셀의 칩 한 줄 클리핑(「+N」)을 해제해 칩이 줄바꿈된다(행 높이가 늘어남).
   * 읽기전용 셀은 이 플래그와 무관하게 항상 전부 표시한다.
   */
  wrapCells?: boolean
  /**
   * 그룹 정렬 모드(gallery/list/board 뷰의 그룹 섹션/컬럼 순서).
   *  - 미설정/'manual': 현행 first-appearance 순(회귀 0 — 기존 동작 불변).
   *  - 'name': 그룹 라벨 오름차순.
   *  - 'count': 행 수 내림차순.
   * GROUP_EMPTY(빈/누락 값 그룹)는 모드와 무관하게 항상 마지막.
   */
  groupSort?: 'manual' | 'name' | 'count'
  /**
   * 조건부 서식 규칙(스프레드시트식) — 조건은 필터와 같은 어휘(FilterExpr), 결과는 셀 서식.
   * 배열 순서가 의미 있다(앞선 규칙이 충돌하는 속성을 이긴다). 미지정/빈 배열 = 서식 없음.
   * JSON 안전이라 이 config 에 그대로 영속된다. 정의·평가는 `conditional-format.ts`.
   */
  conditionalFormats?: ConditionalFormatRule[]
  /**
   * 컬럼 키 → 사용자가 끌어서 정한 폭(px, table 뷰). **뷰마다** 따로 산다 — 같은 화면이라도 뷰가
   * 다르면 폭이 다르다. 렌더 시 PropertyDef.width 위에 `{ mode:'fixed', px }` 로 덮인다
   * (applyViewColumnWidths). 미설정 키 = 스키마 폭(자동/기본) 그대로. 미설정 = 현행 동작(회귀 0).
   */
  columnWidths?: Record<string, number>
}

/**
 * 뷰 공개 범위 — 'private' 는 만든 사람만, 'shared' 는 조직 전체가 본다.
 * **미지정은 'private'** 로 읽는다: 공개 범위 개념이 없던 시절에 저장된 뷰가 갑자기 남에게
 * 보이면 안 된다(하위호환의 안전한 쪽). 판정은 `savedViewVisibility` 하나로만 한다.
 */
export type SavedViewVisibility = 'private' | 'shared'

/**
 * 저장된 명명 뷰 — 컬렉션마다 N 개. 각자 sort/filter/visibleProps 를 독립 유지.
 *  - id: 안정 식별자(uuid/slug).
 *  - name: 사용자 보이는 라벨.
 *  - config: 위 CollectionViewConfig.
 *
 * 소유·공개 필드는 **모두 선택**이다. 뷰가 기기 안에만 살던 때에는 "누구 것"이 없었고,
 * 그때 저장된 payload 가 그대로 읽혀야 하기 때문. 미지정의 뜻은 아래 각 필드 주석에 있다.
 */
export type SavedView = {
  id: string
  name: string
  config: CollectionViewConfig
  /** 공개 범위. 미지정 = 'private'(만든 사람만). */
  visibility?: SavedViewVisibility
  /**
   * 만든 사람의 식별자. **미지정 = 내 것**으로 취급한다 — 소유자 개념 이전에 만들어진 뷰는
   * 정의상 이 기기(=이 사람)가 만든 것이고, 남의 것으로 보면 자기 뷰를 자기가 못 고친다.
   */
  ownerId?: string
  /** 만든 사람의 표시 이름(목록에 "만든 사람"으로 보인다). 미지정 = 표시 안 함. */
  ownerName?: string
  /**
   * 코드(시스템)가 정의한 뷰인가 — 이름·공유·삭제는 누구도 못 한다. 설정(컬럼·정렬·필터)은 관리자가
   * 고쳐 저장할 수 있다(어디에 남기는지는 호스트의 몫).
   */
  system?: boolean
}

/**
 * 컬렉션 스키마 오버라이드 — 통합 Document(ownerType='collection') content 에 저장하는 JSON 안전 부분.
 * 팩이 주는 기본 PropertyDef[](타입·라벨·format 함수 포함)는 코드에 두고, 여기엔 "편집 가능한" 옵션 정의·잠금·
 * 사용자 동적 베이스·뷰 설정만 둔다 (함수는 JSON 직렬화 불가). 로드 시 applySchemaConfig 로 팩 기본 위에 머지.
 */
export type CollectionSchemaConfig = {
  /**
   * 컬렉션(워크스페이스 DB) 설명 — 노션식 헤더의 편집 가능한 부제. 제목(node.title) 아래에 표시·편집한다.
   * 노드 메타가 아니라 스키마 config(JSON)에 둬 Prisma 마이그레이션 없이 영속한다(기존 schema PATCH 경계 재사용).
   */
  description?: string
  /**
   * 프로퍼티 키 → 라벨/옵션/잠금/폭 오버라이드(팩 정의된 프로퍼티에 대한 패치).
   * - label: 노션식 컬럼 "이름 변경"으로 사용자가 바꾼 표시 이름을 영속(미지정 시 팩 기본 라벨).
   * - width: 노션식 드래그 리사이즈로 사용자가 정한 폭을 영속(미지정 시 PropertyType 기본).
   */
  properties?: Record<
    string,
    { label?: string; options?: SelectOption[]; locked?: boolean; width?: ColumnWidth }
  >
  /** 사용자가 추가한 동적 베이스 컬럼(노션식 "+" 로 만든 자유 컬럼). 표시 순서 = 배열 순서, 팩 기본 앞에 배치. */
  base?: BasePropertyDef[]
  /** 명명 뷰 목록(노션식 다중 SavedView). 비어있으면 호출자가 기본 뷰를 하나 생성한다. */
  views?: SavedView[]
  /** 현재 활성 뷰 id — views 중 매칭. 누락/불일치 시 호출자가 첫 뷰로 폴백. */
  activeViewId?: string
  /**
   * 레거시 단일 뷰(deprecated, 마이그레이션용). 신규 코드는 views[] 를 쓴다.
   * 로드 시 호출자가 views 미정의면 이 값을 단일 뷰로 변환해 마이그레이션한다.
   */
  view?: CollectionViewConfig
}

/**
 * 좌표계 — 외부 Address 타입의 미러(필드명 유지). 기본 'WGS84'(GPS 표준 경위도).
 * 카카오/네이버 지오코딩이 쓰는 한국형 좌표계(WCONGNAMUL/CONGNAMUL/WTM/TM)도 값으로 허용한다(#45).
 */
export type CoordinateSystem = 'WGS84' | 'WCONGNAMUL' | 'CONGNAMUL' | 'WTM' | 'TM'

/**
 * 위치 프로퍼티 값(type='geo') — 외부 Address 타입의 미러(필드명 유지). JSON 안전 → frontmatter 영속 가능.
 *  - coordinate: x=경도(lng), y=위도(lat), type=좌표계(기본 WGS84). 노션식 셀/카드는 도로명주소 우선 표시.
 *  - roadAddress: 도로명주소(표시 라벨의 1순위).
 *  - detailAddress: 상세주소(동·호수 등, optional).
 * 지도 렌더·주소 검색은 별도 작업(#36) — 데이터 레이어만(#45).
 */
export type GeoValue = {
  coordinate: { x: number; y: number; type: CoordinateSystem }
  roadAddress: string
  detailAddress?: string
}

/**
 * 행 액션 버튼 값(type='button') — buttonBlock(에디터 substrate 액션 블록, #234 라벨+액션 atom)을
 * 컬렉션 프로퍼티 어휘로 일반화한 것(PlanPublishButton 이 예고한 "노션식 버튼 속성").
 * JSON 안전(함수 없음) — 클릭 실행은 뷰가 ViewSurfaceProps.onAction(rowId, action) 으로 위임한다
 * (RSC 경계를 넘는 건 언제나 이 순수 데이터뿐, #237).
 *  - action: onAction 으로 전달되는 액션 식별자(팩/호스트 어휘, 예: 'restore').
 *  - label: 버튼 라벨(행별로 달라질 수 있음 — 예: 설치/해제 토글).
 *  - variant: DS Button variant 부분집합. 기본 'outline'.
 *  - disabled: true 면 비활성(진행 중 등).
 */
export type ButtonValue = {
  action: string
  label: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
  disabled?: boolean
}

/**
 * 색 힌트를 실은 태그 값 — 팩-무관 렌더러(RecordDocumentView)가 스키마 없이도 select 옵션 색 칩을 그리게
 * 하는 자기기술 값(ButtonValue 가 클릭 실행 정보를, GeoValue 가 좌표를 값에 싣는 것과 동형). 스키마(옵션색)를
 * 아는 doc 빌더(toPackDetailDoc·toAiInferenceDetailDoc·endpointDetailRecord)가 resolveOptionColor 로 색을
 * 미리 해소해 이 값으로 실어 보낸다 — 렌더러는 스키마에 의존하지 않고 값에 실린 색만 읽는다(팩-무관 계약 유지).
 * JSON 안전(함수 없음, RSC 경계 안전 #237). color 미지정이면 렌더러가 label 해시색으로 폴백한다.
 *  - tag: 표시 라벨(옵션 label 이 있으면 label, 없으면 값). 판별자(string) — GeoValue/ButtonValue 와 구분.
 *  - color: 노션식 팔레트 색(gray|blue|green|orange|red|purple|teal). 미지정 = 라벨 해시색.
 */
export type TagValue = {
  tag: string
  color?: TagColorName
}

/** 프로퍼티 값 — 타입에 따라 형태가 다르다(text/select/url=string, number=number, checkbox=boolean,
 *  multi_select=string[], date=ISO string, relation=레코드 id 또는 id[], geo=GeoValue 객체,
 *  button=ButtonValue 객체, 색 힌트 실은 태그=TagValue 객체). null = 미설정. */
export type PropertyValue =
  | string
  | number
  | boolean
  | string[]
  | GeoValue
  | ButtonValue
  | TagValue
  /**
   * 상대값(`{rel:'date',…}`) — **필터 조건의 값으로만** 나타난다. 레코드의 속성값이 상대값인
   * 일은 없다: 저장된 사실은 이미 확정된 것이고, "지금으로부터" 라는 말이 붙을 자리가 없다.
   * 질의 경계에서 리터럴로 풀린다(`relative-value.resolveRelativeFilters`).
   */
  | import('./relative-value').RelativeValue
  | null

/**
 * 블록 문서 = 정본 레코드(D-8 §3). properties(프론트매터, 편집형 메타데이터의 정본) + body(블록 트리).
 * 본문 블록은 type 을 가진 자유 형태 노드(제목·문단·도메인 블록…)로, 블록팩이 projection 으로 해석한다.
 */
export type BlockDocument = {
  properties?: Record<string, PropertyValue>
  body?: { type: string; [k: string]: unknown }[]
  /**
   * 문서 잠금(편집 가능 여부) — 통합 Document 모델이 문서 단위로 보유(D-8). true = 읽기전용
   * (제목 인라인 편집 등 비활성). 미설정/false = 편집 가능. '고정 문서'를 이 플래그로 잠근다.
   */
  locked?: boolean
  /**
   * 셀 단위 신뢰등급(R-37) — { 컬럼키: CellTrust }. properties 와 형제로 둔다: 이건 속성이
   * 아니라 **속성에 대한 메타**이고, PropertyValue 유니온에 임의 레코드를 끼워넣지 않기 위함.
   * 등급을 모르는 기존 뷰·팩은 이 필드를 무시하면 되고, 읽기·쓰기는 ./trust 의 헬퍼가 정본.
   */
  trust?: Record<string, CellTrust>
}

/** 신뢰등급 격자(낮음→높음) — 순서가 의미를 갖는다(비교는 trust.ts 의 gradeRank). */
export type Grade = 'hypothesis' | 'claimed' | 'sourced' | 'verified'

/** 셀 하나에 붙는 신뢰 메타. */
export type CellTrust = {
  /** 등급. */
  g: Grade
  /** 근거 출처(URL 또는 소스명). sourced 이상은 필수(불변식 I1). */
  src?: string
  /** 최종 확인 시각(ISO) — 신선도 판정·"확인 필요" 강등의 입력. */
  at?: string
}

/**
 * 뷰 렌더러 입력 레코드 — id + 정본 블록 문서. 뷰는 doc 을 BlockPack.readProperties 로
 * 속성 행으로 환산해 렌더한다(도메인 무관). 페이지 로더가 저장소 → 이 형태로 매핑한다.
 */
export type TableRecord = { id: string; doc: BlockDocument }

/** 필터 연산자 — 타입별로 일부만 의미가 있다(viewRows 가 검증·적용). */
export type FilterOp =
  | 'eq' // 같음 (text/number/select/checkbox/date/url/relation)
  | 'neq' // 다름
  | 'contains' // 부분 문자열 포함 (text/url)
  | 'not_contains'
  | 'gt' // 초과 (number/date)
  | 'gte'
  | 'lt' // 미만 (number/date)
  | 'lte'
  | 'has' // 배열이 값을 포함 (multi_select/relation[])
  | 'not_has'
  | 'in' // 값 목록 중 하나 (select/person — 다중값 셀이면 하나라도 겹침). value = string[]
  | 'not_in' // 값 목록 어느 것도 아님
  | 'is_empty' // 값이 비어 있음(null/''/[])
  | 'is_not_empty'

/**
 * 단일 필터 조건(잎 노드) — 한 컬럼에 한 연산자. 노션식 필터 트리의 leaf.
 * (구버전 `Filter` 와 동형 — 트리화 이전 평탄 배열의 원소였다. 하위호환 alias `Filter` 유지.)
 */
export type FilterCondition = {
  key: string
  op: FilterOp
  /** is_empty / is_not_empty 는 value 불필요. */
  value?: PropertyValue
  /**
   * 관계 집계(롤업) 조건 — 있으면 `key` 는 롤업 원천(`RollupSource.key`)이고, `value` 는 집계한 숫자와 비교할 값이다.
   * 「이 파트너가 낸 견적 중 (주문 = A · 상태 ≠ lost) 의 개수 ≥ 1」.
   */
  rollup?: RollupSpec
}

/** 롤업의 셈. 개수·합계는 이어진 레코드가 없으면 0, 최소·최대·평균은 값이 없다(비어 있음). */
export type RollupAgg = 'count' | 'sum' | 'min' | 'max' | 'avg'

export type RollupSpec = {
  agg: RollupAgg
  /** `count` 외에는 접을 필드 — 원천 스키마의 숫자 속성 키. */
  field?: string
  /**
   * 관계 대상 쪽 조건 — 모두 만족(AND). 편집기는 조건만 만든다. 노드 타입인 것은 상대값을 풀면 한 조건이
   * 그룹(「이번 주」 → 시작 ≤ x ≤ 끝)이 되기 때문이다.
   */
  where: FilterNode[]
}

/**
 * 롤업 원천 — 「이 행에 이어진 ○○」 하나. 호스트가 필터 편집기에 알려 주면(`FilterRollupProvider`) 조건 추가 목록에
 * 원천이 뜨고, 고르면 대상 조건(AND)과 셈을 정하는 조건이 생긴다. 표 컬럼은 아니다 — 거르기만 한다.
 */
export type RollupSource = {
  /** 조건 키 — 서버의 롤업 관계 키와 같다(`rel:quotes`). */
  key: string
  /** 원천 이름(「견적」). */
  label: string
  /** 대상 레코드의 속성 — 대상 조건의 후보이자 셈의 필드 후보(숫자만). 관계 속성은 `relations` 로 값을 고른다. */
  schema: PropertyDef[]
  /** 대상 조건의 관계 속성(참조값)을 검색·해상하는 provider — `PropertyDef.relation.target` 으로 찾는다. */
  relations?: Record<string, RelationProvider>
}

/**
 * 하위호환 alias — 트리화 이전 평탄 `Filter[]` 를 쓰던 코드/영속 데이터와의 호환을 위해 유지.
 * 신규 코드는 `FilterCondition` 를 쓴다(의미 동일).
 */
export type Filter = FilterCondition

/**
 * 필터 그룹(가지 노드) — children 을 op('and'|'or')로 결합. 중첩 가능(그룹 안에 그룹).
 * 판별자: `children` 필드의 존재 여부로 FilterCondition 과 구분한다(FilterCondition 엔 children 없음).
 */
export type FilterGroup = {
  op: 'and' | 'or'
  children: FilterNode[]
}

/** 필터 트리 노드 — 조건(leaf) 또는 그룹(branch). passesFilterNode 가 재귀 평가한다. */
export type FilterNode = FilterCondition | FilterGroup

/**
 * 영속/입력에 쓰는 필터 표현 — 트리 루트(FilterGroup) 또는 레거시 평탄 배열(FilterCondition[]).
 * 로드 시점에 `normalizeFilterRoot` 가 항상 FilterGroup 루트로 정규화한다(하위호환).
 */
export type FilterExpr = FilterGroup | FilterCondition[]

export type Sort = {
  key: string
  dir: 'asc' | 'desc'
}

/** 뷰 설정 — records 를 어떤 surface(table/board/gallery/list/timeline)로, 어떤 필터·정렬·그룹·표시컬럼으로 렌더할지. */
export type ViewConfig = {
  type: ViewType
  /**
   * 필터 트리 루트 — 항상 정규화된 FilterGroup(루트). 렌더러/코어는 이 형태만 받는다.
   * (저장 config 의 레거시 평탄 배열은 toViewConfig/로더가 normalizeFilterRoot 로 변환해 채운다.)
   */
  filters: FilterGroup
  sort: Sort[]
  /** 그룹핑 기준 프로퍼티 키(주로 board). 지정 시 viewRows 는 그룹 묶음을 반환할 수 있다. */
  groupBy?: string
  /** 빈 그룹값을 이 값의 그룹으로 본다. 자세한 의미는 `CollectionViewConfig.groupEmptyAs`. */
  groupEmptyAs?: string
  /** 표시할 컬럼(미지정 = 전체). 렌더러 힌트 — viewRows 변환 자체에는 영향 없음. */
  visibleProps?: string[]
  /** 컬럼 키 → footer 집계 종류(table 뷰). 미설정 키는 표시 안 함. */
  aggregations?: Record<string, AggregationType>
  /** 그룹값 → 카드 id 순서(board 뷰의 수동 정렬). 미설정 그룹은 viewRows 정렬에 의존. */
  cardOrder?: Record<string, string[]>
  /** 행 id 의 수동 정렬 순서(table 뷰의 노션식 드래그). sort 가 있으면 무시. 미등록 행은 끝에. */
  rowOrder?: string[]
  /** 카드 커버용 속성 키(board/gallery 뷰). url 타입 권장. */
  coverKey?: string
  /**
   * 카드 크기(board/gallery 뷰). 단일 진실원천 — 갤러리·보드가 이 값을 소비한다.
   * - S: 좁은 폭(176px), 커버 없음, 제목만.
   * - M: 표준 폭(240px, 기본), 커버 h-20, 보조 프로퍼티 표시.
   * - L: 넓은 폭(320px), 커버 h-32, 보조 프로퍼티 확장.
   * 보드는 열 폭이 곧 카드 폭이다 — S 240px · M 288px(기본, 현행) · L 400px(관계 표가 들어가는 넓은 카드).
   */
  cardSize?: 'S' | 'M' | 'L'
  /**
   * board/gallery 뷰 — 카드 속성을 아이콘 칩 대신 **이름표 붙은 글자 줄**로(「최근 학습 2026-10-21」).
   * 이름표는 속성의 `cardLabel`(없으면 `label`), 빈 이름표 속성은 한 줄에 「 · 」로 잇는다. 기본 false(아이콘 칩).
   */
  cardPropLabels?: boolean
  /**
   * board 뷰 — 카드 아래 관계 표(관계 속성이 가리키는 대상 레코드를 작은 표로). 미설정 = 표 없음(현행).
   * 자세한 의미는 `RelationTableConfig`.
   */
  relationTable?: RelationTableConfig
  /** board 뷰 — 카드 짜임(제목 옆 배지 · 숫자 띠). 미설정 = 이름표 줄만(현행). 자세한 의미는 `CardLayoutConfig`. */
  cardLayout?: CardLayoutConfig
  /**
   * timeline 뷰 — 날짜 축 설정. JSON 안전(함수 없음). 미설정 = 안내 상태.
   * startKey 필수, endKey 있으면 기간 막대(없으면 점/짧은 막대), zoom 으로 눈금 단위.
   */
  timeline?: TimelineConfig
  /**
   * 빈 그룹 숨김 — true 면 rows 0인 그룹 섹션(gallery/list) 및 카드 없는 컬럼(board)을 미표시.
   * groupBy 미설정 시 이 값은 무시된다. 기본 false(빈 그룹 표시 — 현행 동작).
   */
  hideEmptyGroups?: boolean
  /**
   * board 뷰 — 카드 없는 열을 좁은 세로 띠(라벨 + 0)로 접는다. 카드를 끄는 동안에는 다시 펼쳐져 놓을 자리가 된다.
   * hideEmptyGroups 가 켜져 있으면 빈 열은 아예 없으므로 이 값은 의미가 없다. 기본 false(빈 열도 제 폭 — 현행).
   */
  collapseEmptyGroups?: boolean
  /**
   * 표 행 높이(table 뷰) → DS Table density 토큰에 매핑(line-clamp 아님). 미설정 = 'S'(현행 compact, 회귀 0).
   *  - S: compact(기본, 현행 동작 불변). 셀 py 4px.
   *  - M: default. 셀 py 12px.
   *  - L: comfortable. 셀 py 16px.
   */
  rowHeight?: 'S' | 'M' | 'L'
  /**
   * 표 셀 줄바꿈(table 뷰). 미설정/false = 현행 동작(회귀 0).
   * true 면 편집형 multi_select·relation 셀의 칩 한 줄 클리핑(「+N」)을 해제해 칩이 줄바꿈된다(행 높이가 늘어남).
   * 읽기전용 셀은 이 플래그와 무관하게 항상 전부 표시한다.
   */
  wrapCells?: boolean
  /**
   * 그룹 정렬 모드(gallery/list 뷰의 그룹 섹션 순서, board 의 groupSort 적용 여부는 아래 참고).
   *  - 미설정/'manual': 현행 first-appearance 순(회귀 0 — 기존 동작 불변).
   *  - 'name': 그룹 라벨 오름차순.
   *  - 'count': 행 수 내림차순.
   * GROUP_EMPTY(빈/누락 값 그룹)는 모드와 무관하게 항상 마지막.
   * Board 뷰: resolveGroupColumns 가 select 옵션 정의 순서를 사용하므로 board 는 groupSort 적용 대상 외(manual 고정).
   */
  groupSort?: 'manual' | 'name' | 'count'
  /** 조건부 서식 규칙 — CollectionViewConfig 동명 필드의 런타임 형태(정규화 없음, 그대로 전달). */
  conditionalFormats?: ConditionalFormatRule[]
  /** 컬럼 폭 오버라이드 — CollectionViewConfig 동명 필드의 런타임 형태(그대로 전달). */
  columnWidths?: Record<string, number>
}

/** 블록팩이 정의하는 이름 붙은 정적 프로퍼티 묶음(D-8 §3 "프리셋 세트"). 예: "상품 기본" = status·category·tags·owner. */
export type PresetSet = {
  id: string
  label: string
  props: PropertyDef[]
}

/**
 * 블록팩이 collections 에 제공하는 계약(D-8 §3).
 * collections 는 이 인터페이스만 알면 어떤 도메인 문서든 컬렉션으로 다룰 수 있다(도메인 역의존 없음).
 * 세 멤버 모두 순수 함수여야 한다(테스트 가능).
 */
export type BlockPack<P> = {
  /** frontmatter 키·타입 + projection 정의(source 로 구분). 동적 베이스 + 프리셋 세트를 합쳐 둘 수도, 프리셋만 둘 수도 있다. */
  propertySchema: PropertyDef[]
  /** frontmatter + projection 을 병합해 레코드의 속성값을 읽는다(읽기). */
  readProperties: (doc: BlockDocument) => P
  /** 편집형(frontmatter) 셀 수정을 문서에 역기록한 새 문서를 반환(불변). projection 키는 무시하고 원본 반환. */
  writeProperty: (doc: BlockDocument, key: string, value: PropertyValue) => BlockDocument
  /**
   * 제목(첫 컬럼=projection, 예: 본문 H1)을 역기록한 새 문서를 반환(불변, 선택).
   * 지정 시 뷰의 제목 셀이 인라인 편집 가능해진다(단, doc.locked 면 비활성). 미지정 = 제목 읽기전용.
   */
  writeTitle?: (doc: BlockDocument, value: string) => BlockDocument
}
