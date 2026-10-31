'use client'

import {
  AnchorContextSurface,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Button,
  CalendarDays,
  Check,
  Checkbox,
  ChevronRight,
  EyeOff,
  FileText,
  Hash,
  Input,
  LayoutDashboard,
  Link2,
  List,
  Lock,
  Mail,
  Map as MapIcon,
  MoreHorizontal,
  MousePointerClick,
  TagSelect,
  PanelRight,
  Pencil,
  Phone,
  Plus,
  SquareCheck,
  Table,
  TableBody,
  TableCell,
  TableFrame,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tags,
  Trash2,
  Type,
  User,
  Users,
  beginListReorder,
  cn,
  formatPhoneNumber,
  reorderArray,
  type LucideIcon,
} from '@oobleck/systheme'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { AGGREGATION_LABEL, computeAggregation } from '@oobleck/collection'
import { applyViewColumnWidths, clampColumnWidth } from '@oobleck/collection'
import {
  aggregationTone,
  conditionalFormatClassName,
  resolveCellFormat,
  textFormatClassName,
  type ConditionalFormatTone,
} from '@oobleck/collection'
import { formatDateValueDisplay } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { isOptionColorEditable, normalizeOptions, resolveOptionColor } from '@oobleck/collection'
import { applyRowOrder, isButtonValue, isTagValue, viewRows, type Row } from '@oobleck/collection'

import { CellEditor, DateCellEditor, GeoCellEditor } from './CellEditor'
import { isSortableType } from './filter-builder'
import { formatGeoLabel, isGeoValue } from '@oobleck/collection'
import { PersonCell, PersonValue } from './PersonCell'
import { RelationCell } from './RelationCell'
import { StructCell } from './StructCell'
import { formatUnitNumber, parseUnitNumberInput } from '@oobleck/collection'
import {
  CollectionStatusBlock,
  isBlockingStatus,
  type CollectionViewStatus,
} from './CollectionStatus'
import { RowActionMenu } from './row-action-menu'
import { openClickHandlers } from './open-click'
import { tableViewCopy } from './TableView.messages'

import type { AggregationScope, QueryMode } from '@oobleck/collection'
import type {
  AggregationType,
  BasePropertyDef,
  BasePropertyType,
  BlockPack,
  CellRenderContext,
  ColumnToggle,
  ColumnWidth,
  NumberUnit,
  PropertyDef,
  PropertyType,
  PropertyValue,
  RelationProvider,
  RelationTargetOption,
  SelectOption,
  Sort,
  TableRecord,
  ViewConfig,
} from '@oobleck/collection'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react'

// @oobleck/collection — 테이블 뷰 렌더러(D-8 §6). 도메인 무관: BlockPack 계약만 알면
// 어떤 블록팩(policy·product…)의 문서 집합이든 표로 렌더한다.
//   레코드 → pack.readProperties 로 속성 추출 → viewRows(filter/sort) → DS Table.
// 컬럼 = pack.propertySchema 의 표시 대상. 셀은 PropertyType 별로 렌더한다.
// frontmatter(source: 'frontmatter') 컬럼은 편집 가능(onChange → onEdit 상위 콜백),
// projection 컬럼은 읽기전용(본문 파생값이라 표에서 직접 못 고침 — D-8 §5).

/**
 * 제목(첫) 컬럼의 성격.
 *  - `page`(기본): 행이 곧 문서인 노션 DB. 문서 아이콘 + 살짝 큰 제목. 열기는 hover 버튼으로.
 *  - `plain`: 도메인 목록(주문번호·플래너 이름 등). 아이콘 없음(모든 행에 같은 아이콘은 정보가 0),
 *    DS 본문 타이포, **제목 자체가 링크**라 클릭하면 바로 열린다.
 */
export type TitleVariant = 'page' | 'plain'

export type TableViewProps<P> = {
  records: TableRecord[]
  pack: BlockPack<P>
  view: ViewConfig
  /**
   * 쿼리 실행 주체(headless.ts 참조). 미지정 = 'client' — 현행 동작 그대로(회귀 0).
   *
   * 'server' 면 `records` 는 **이미 필터·정렬·페이지가 적용된** 행이라고 보고 뷰가 재적용하지 않는다.
   * 서버 페이지네이션 목록에 'client' 를 쓰면 정렬·필터가 현재 페이지 안에서만 돌고 footer 집계가
   * 전체 대신 한 페이지를 세면서도 화면은 멀쩡해 보인다 — 그 조용한 오답을 막는 스위치다.
   */
  /** 제목(첫) 컬럼의 성격. 미지정 = 'page'(회귀 0). */
  titleVariant?: TitleVariant
  queryMode?: QueryMode
  /**
   * 필터 적용 후 **페이지 적용 전** 전체 행 수. 'server' 모드에서만 의미가 있다.
   * 주면 footer 집계 중 행 수 계열(count)이 전체 기준으로 답하고, 안 주면 집계가
   * "이 페이지" 범위임을 스스로 밝힌다(모수를 모르면서 전체인 척하지 않는다).
   */
  totalCount?: number
  /** 행 클릭(상세 열기). 편집 컨트롤 클릭은 DS TableRow 가 걸러 행 열기로 새지 않는다. */
  onOpen?: (id: string, event?: ReactMouseEvent) => void
  /**
   * 행(=노션 페이지) 삭제 — (id). 지정 시 제목 셀 hover 케밥에 "삭제"가 켜진다. 삭제는 소프트(휴지통)이며
   * 실제 fetch·확인(발행 플랜 force)·토스트·복원은 호스트가 소유한다(순수 콜백만 받음). 미지정 시 케밥 미표시.
   */
  onDeleteRow?: (id: string) => void
  /**
   * 버튼 프로퍼티(type='button') 클릭 — (rowId, action). ButtonValue 는 라벨·variant 만 담는 순수
   * 데이터고 실행은 호스트 몫(휴지통 복원, 팩 설치/해제 등). 미지정 시 버튼 셀이 비활성으로 렌더된다.
   */
  onAction?: (id: string, action: string) => void
  /**
   * frontmatter 셀 편집 콜백 — (id, key, value). 상위에서 pack.writeProperty 로 역기록 후 저장한다.
   * 미지정 시 frontmatter 컬럼도 읽기전용으로 렌더(편집 컨트롤 비표시).
   */
  onEdit?: (id: string, key: string, value: PropertyValue) => void
  /**
   * 제목(첫 컬럼) 인라인 편집 콜백 — (id, value). pack.writeTitle 로 본문 H1 역기록 후 저장한다.
   * pack.writeTitle 이 있고 문서가 잠기지 않았을 때만 제목 셀이 편집 가능해진다(미지정 = 읽기전용).
   */
  onEditTitle?: (id: string, value: string) => void
  /** 컬렉션 스키마 오버라이드(옵션 순서·색·잠금) — 지정 시 pack.propertySchema 대신 컬럼 정의로 사용. */
  schema?: PropertyDef[]
  /** select/multi 옵션 정의 변경(순서·색·생성·삭제) — (key, options). 상위가 컬렉션 스키마에 영속. */
  onOptionsChange?: (key: string, options: SelectOption[]) => void
  /** 선택지 색 변경(헤더 메뉴) — (key, value, color). `colorEditable` 컬럼에만 열린다. 색 undefined = 기본. */
  onOptionColorChange?: (key: string, value: string, color: string | undefined) => void
  /**
   * 이름 변경이 허용되는 컬럼 범위. 기본 `'all'`(현행 동작 — 팩 프리셋 컬럼도 이름을 바꾼다).
   *
   * `'base'` 는 **사용자가 추가한 컬럼만** 이름을 바꾼다. 스키마를 코드가 소유하는 목록
   * (주문·고객)에서는 프리셋 컬럼의 새 이름을 둘 자리가 없어, 그대로 두면 눌러도 아무 일
   * 없는 메뉴가 된다. 삭제·타입변경은 이미 같은 규칙(`origin === 'base'`)을 쓴다.
   */
  renameScope?: 'all' | 'base'
  /**
   * 행 수동 재정렬 콜백 — 지정 시 행 앞에 ⠿ 그립이 생기고 노션식 드래그-스왑이 켜진다.
   * 인자는 드롭 후의 *표시 순서대로의 레코드 id 배열*. 상위가 그 순서를 영속화한다.
   * 정렬(view.sort)이 적용된 뷰에선 수동 순서가 무의미하므로 호출자가 정렬 없는 뷰에서만 전달할 것.
   */
  onReorder?: (orderedIds: string[]) => void
  /**
   * 신규 항목 생성 콜백 — 지정 시 빈 상태 첫 placeholder 행이 "+ 새 항목" 으로 표시되고
   * 클릭하면 호출된다(노션 "+ New page" 패턴). 후속 행은 시각 placeholder 만.
   */
  onCreate?: () => void | Promise<void>
  /** onCreate 트리거 행 라벨 — 기본 "+ 새 항목". 도메인별로 "+ 새 상품" 등 지정. */
  createLabel?: string
  /**
   * 컬럼 헤더 메뉴(▼) — 정렬 변경 콜백. 지정 시 각 컬럼 헤더 클릭에 오름차순/내림차순 메뉴가 켜진다.
   * 인자는 *적용할 정렬 배열 전체*(빈 배열 = 정렬 해제). 단일 정렬 키 가정(v1).
   */
  onSortChange?: (sort: Sort[]) => void
  /**
   * 컬럼 숨김 콜백 — 지정 시 헤더 메뉴에 "숨기기" 항목이 켜진다.
   * 상위는 view.visibleProps 에서 해당 키를 제거해 다시 내려준다(마지막 1개는 호출자가 막을 수 있음).
   */
  onColumnHide?: (key: string) => void
  /**
   * 새 동적 베이스 컬럼 추가 콜백 — 지정 시 헤더 맨 끝에 "+" 버튼이 켜진다(노션식).
   * 사용자가 라벨·타입을 입력해 자유 컬럼 생성. 상위는 CollectionSchemaConfig.base 에 추가해 영속.
   */
  onAddProperty?: (def: BasePropertyDef) => void
  /**
   * 컬럼 폭 변경 콜백 — 헤더 우측 엣지 드래그 리사이즈(노션식). 미지정 시 리사이즈 핸들 비표시.
   * 인자: 컬럼 키, 새 폭(px, 60~800 클램프 후). 상위는 뷰 설정 `columnWidths` 에 영속하고(뷰별),
   * 표는 그 값을 PropertyDef.width 위에 `{ mode:'fixed', px }` 로 덮어 그린다(applyViewColumnWidths).
   */
  onColumnResize?: (key: string, px: number) => void
  /**
   * 컬럼 폭 초기화 — 리사이즈 핸들 더블클릭(노션식). 상위는 뷰의 columnWidths 에서 그 키를 지워
   * 스키마 폭(자동/기본)으로 되돌린다. 미지정 시 더블클릭은 아무 일도 하지 않는다.
   */
  onColumnResetWidth?: (key: string) => void
  /**
   * 컬럼 순서 변경 콜백 — 헤더 왼쪽 ⠿ 그립으로 가로 드래그 스왑(노션식). 미지정 시 그립 비표시.
   * 인자: 드롭 후 *표시 순서대로의* 컬럼 키 배열. 상위는 view.visibleProps 로 영속한다.
   */
  onColumnReorder?: (orderedKeys: string[]) => void
  /**
   * 컬럼 이름 변경 콜백 — 지정 시 헤더 메뉴에 "이름 변경" 항목이 켜진다.
   * 인자: 컬럼 키, 새 라벨. 상위는 PropertyDef.label 을 갱신해 schema 를 재내려준다.
   */
  onRenameColumn?: (key: string, label: string) => void
  /**
   * 관계 자동완성 공급자 레지스트리(노션식 Relation). 컬렉션 키 → RelationProvider.
   * 관계 컬럼(`type: 'relation'` + `relation.target = key`)의 셀이 이 레지스트리에서 provider 를 찾아
   * 검색/해상을 위임. 미등록 키면 셀은 읽기전용 텍스트로 폴백(현재 id 표시).
   */
  relations?: Record<string, RelationProvider>
  /**
   * relation 컬럼 추가 시 "연결 대상" 후보(value=target, label=표시명). 미지정 시 relations 키를 value=label 로 폴백.
   * 워크스페이스처럼 target(노드 id)과 표시명(DB 이름)이 다를 때 라벨을 분리 제공(상품은 미전달 → 키=라벨 현행 동작).
   */
  relationTargetOptions?: RelationTargetOption[]
  /**
   * 「속성 추가」에 **사람** 타입을 보일까. 호스트가 사람 컬럼에 계정 명단(`PropertyDef.options`)을
   * 채울 수 있을 때만 켠다 — 명단 없는 사람 컬럼은 이름을 풀 수도, 고를 수도 없다. 기본 false.
   */
  peopleEnabled?: boolean
  /**
   * relation 셀의 연결 대상 열기 — (target, id). 지정 시 셀 칩에 "열기" affordance 가 켜진다(노션식 링크).
   * 미지정 시(상품 등) 칩은 편집만(현행 동작 불변). 워크스페이스는 연결된 인스턴스 행 페이지로 이동한다.
   */
  onOpenRelation?: (target: string, id: string) => void
  /**
   * 컬럼별 footer 집계 변경 콜백 — 헤더 메뉴의 "집계" 서브메뉴에서 종류를 고를 때 호출.
   * 미지정 시 메뉴 항목 비표시. 인자: 컬럼 키, 새 집계 타입. 'none' 이면 표시 안 함.
   * 영속: view.aggregations[key] = type.
   */
  onAggregationChange?: (key: string, type: AggregationType) => void
  /**
   * 동적 베이스 컬럼 타입 변경 — (key, newType). 지정 시 base 컬럼 헤더 메뉴에 "유형 변경" 서브메뉴가 켜진다.
   * preset(origin='preset') 컬럼에는 노출하지 않음.
   */
  onChangePropertyType?: (key: string, type: BasePropertyType) => void
  /**
   * 동적 베이스 컬럼 삭제 — (key). 지정 시 base 컬럼 헤더 메뉴 하단에 "삭제" 항목이 켜진다.
   */
  onDeleteProperty?: (key: string) => void
  /**
   * 타입별 설정 창 열기(base 컬럼의 구조 속성 칸 · 배치, 수 단위) — 지정 시 머리 메뉴에 항목이 켜진다.
   * 창(저작 폼 `StructConfigForm`)과 저장은 호스트 몫이다.
   */
  onConfigureProperty?: (key: string) => void
  /** 「+」 속성 추가에 구조 속성 타입과 수 단위를 보일까. 호스트가 둘을 저장할 수 있을 때만. 기본 false. */
  structEnabled?: boolean
  /**
   * (플라톤) 프로토타입(Form) 편집 모드 — true 면 상속 컬럼이 잠금 표시(🔒) 대신 *편집 가능*이 되고, base
   * 컬럼 메뉴에 "상속(Form) 지정/해제"가 노출된다. 미지정/false=일반 편집(상속 컬럼 잠금).
   */
  formMode?: boolean
  /** base 컬럼의 상속(inherited) 토글 — Form 모드에서만 메뉴에 노출. (key). */
  onToggleInherited?: (key: string) => void
  /**
   * 머리 메뉴의 켜고 끄는 설정 — 컬럼마다 호스트가 줄을 정한다(없으면 빈 배열). 예: 커스텀 속성의 「콜 기록으로만 수정」.
   * 미지정 = 메뉴에 설정 줄 없음(현행).
   */
  columnToggles?: (def: PropertyDef) => readonly ColumnToggle[]
  /**
   * 컬럼 헤더(thead)를 세로 sticky 로 — 스크롤해도 헤더 행이 상단에 남는다(노션식).
   * 전제: 가로·세로 스크롤을 모두 소유하는 overflow-auto 조상 컨테이너 안에서 렌더될 것.
   * (켜면 표 자체의 가로 스크롤 래퍼가 꺼지고 그 조상이 가로 스크롤도 담당한다 — DS Table 참조.)
   * 임베드 표(InlineTable 등)처럼 컨테이너를 보장할 수 없는 곳은 기본값(off) 그대로 둘 것.
   */
  stickyHeader?: boolean
  /**
   * 본문 불러오기 상태 — loading·error 면 컬럼 머리는 그대로 두고 행 자리(한 칸 colSpan)에 상태 블록을 그린다.
   * 빈 자리표시 행·footer 집계·「+ 새 항목」은 그리지 않는다(0행이 아니라 아직 모르는 것이다). 미지정 = 준비됨.
   */
  status?: CollectionViewStatus
  /**
   * 행 선택(체크박스) — 지정하면 맨 앞에 체크박스 열이 선다(노션·허브스팟식). 선택은 호스트가 소유한다:
   * 표는 지금 그린 행의 id 만 더하고 빼며, 다른 페이지에서 고른 id 는 건드리지 않는다(서버 페이지 목록에서
   * 페이지를 넘겨도 선택이 이어진다). 머리 체크박스 = 지금 보이는 행 전체. Shift+클릭 = 마지막으로 누른 행부터 범위.
   * 미지정 = 체크박스 열 없음(현행).
   */
  selection?: RowSelection
}

/** 행 선택 상태 — 고른 id 집합과 바꾸는 콜백. 표는 새 집합을 만들어 넘긴다(받은 집합을 고치지 않는다). */
export type RowSelection = {
  selected: ReadonlySet<string>
  onChange: (next: ReadonlySet<string>) => void
}

/** 체크박스 열 폭(px) — 고정 열(그립·제목)의 sticky left 오프셋 계산에도 쓴다. */
const SELECT_COL_PX = 36
/** 행 이동 그립 열 폭(px, w-8). */
const GRIP_COL_PX = 32

/** 프로퍼티 타입 → 헤더 아이콘(노션식). 컬럼이 어떤 타입(=어떤 편집)을 갖는지 한눈에 보이게. */
const TYPE_ICON: Record<PropertyType, LucideIcon> = {
  text: Type,
  number: Hash,
  select: List,
  multi_select: Tags,
  date: CalendarDays,
  checkbox: SquareCheck,
  relation: ArrowLeftRight,
  url: Link2,
  email: Mail,
  phone: Phone,
  geo: MapIcon,
  button: MousePointerClick, // 액션 버튼 컬럼(클릭 어포던스)
  person: User,
  multi_person: Users,
  struct: LayoutDashboard, // 구조 속성 — 여러 칸을 한 모양으로
}

/** 표시 대상 컬럼 — view.visibleProps 가 있으면 그 키·순서로, 없으면 스키마 전체. */
function visibleColumns(schema: PropertyDef[], view: ViewConfig): PropertyDef[] {
  if (!view.visibleProps || view.visibleProps.length === 0) return schema
  const byKey = new Map(schema.map((d) => [d.key, d]))
  return view.visibleProps.flatMap((k) => {
    const def = byKey.get(k)
    return def ? [def] : []
  })
}

/** 셀 값을 안전하게 문자열로(텍스트/숫자/url·제목 표시용). null/undefined = 빈 문자열. geo/button/tag 객체는 라벨로("[object Object]" 누수 차단). */
function asText(v: PropertyValue): string {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.join(', ')
  if (isGeoValue(v)) return formatGeoLabel(v)
  if (isButtonValue(v)) return v.label
  if (isTagValue(v)) return v.tag
  return String(v)
}

function asStringArray(v: PropertyValue): string[] {
  if (Array.isArray(v)) return v.map(String)
  if (v === null || v === undefined || v === '') return []
  // asText 로 geo/button 객체를 라벨화("[object Object]" 누수 차단, asText 와 동형).
  return [asText(v)]
}

/**
 * select/multi_select 값의 표시 라벨 — 옵션 정의에 label 이 있으면 그걸, 없으면 값 그대로.
 * 읽기전용 칩이 원값(예: kind 키 'subscription-plan') 대신 사람이 읽는 라벨을 보이게 한다
 * (편집형 SelectCell 이 옵션 label 을 쓰는 것과 정렬 — 표·카드·편집셀 라벨 일관성).
 */
function optionLabelOf(def: PropertyDef, value: string): string {
  const opt = normalizeOptions(def.options).find((o) => o.value === value)
  return opt?.label ?? value
}

// ─── 행 높이 · 셀 줄바꿈 ──────────────────────────────────────────────────────

/**
 * rowHeight → DS Table density 매핑.
 * - S(미설정) → 'compact'  (현행 동작 불변, 회귀 0)
 * - M         → 'default'
 * - L         → 'comfortable'
 * DS density 토큰: compact=py 4px, default=py 12px, comfortable=py 16px.
 */
type TableDensity = 'compact' | 'default' | 'comfortable'
function rowHeightToDensity(rowHeight: 'S' | 'M' | 'L' | undefined): TableDensity {
  if (rowHeight === 'M') return 'default'
  if (rowHeight === 'L') return 'comfortable'
  return 'compact' // S 또는 미설정 = 현행
}

// ─── 셀 렌더 ─────────────────────────────────────────────────────────────────

/**
 * 편집형 select 셀 — multi_select 와 "완전히 동일한 UI/인터랙션"(TagSelect 의 single 모드).
 * 차이는 submit 동작 하나뿐: 옵션 선택 시 교체+닫기(single) vs 토글 추가+유지(multi).
 * 칩·검색/생성 입력·색 옵션·키보드 내비를 모두 공유한다(노션 select↔multi 일관성).
 */
function SelectCell({
  def,
  value,
  onChange,
  onOptionsChange,
}: {
  def: PropertyDef
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  onOptionsChange?: (options: SelectOption[]) => void
}) {
  const c = tableViewCopy(useCollectionLocale())
  const current = typeof value === 'string' ? value : ''
  const opts = normalizeOptions(def.options).map((o) => ({
    value: o.value,
    label: o.label ?? o.value,
    color: o.color,
  }))
  // chevron 과 Tag × 버튼을 셀에서 숨긴다(패널 안 칩에는 영향 없음 — 패널은 combobox 바깥).
  return (
    <div
      className={cn(
        "[&_[role=combobox]>[aria-hidden='true']:last-child]:hidden",
        '[&_[role=combobox]_button]:hidden',
      )}
    >
      <TagSelect
        single
        searchable
        colorize
        // 옵션을 영속할 수 있으면 **셀에서 만들 수 있어야 한다**(노션식). 이게 없으면 갓 만든
        // select 컬럼이 "옵션 없음" 만 띄운 채 영원히 비어 있다 — 첫 옵션을 만들 자리가
        // 아무 데도 없기 때문이다. multi_select 셀은 처음부터 이렇게 동작했다.
        creatable={!!onOptionsChange}
        locked={def.locked}
        chrome="ghost"
        size="sm"
        options={opts}
        value={current ? [current] : []}
        onChange={(vals) => onChange(vals[0] ?? null)}
        onOptionsChange={
          onOptionsChange
            ? (next) =>
                onOptionsChange(
                  next.map((o) => ({ value: o.value, label: o.label, color: o.color })),
                )
            : undefined
        }
        placeholder={c.selectPlaceholder}
        panelPlacement="overlay"
        panelClassName="overflow-hidden"
      />
    </div>
  )
}

/**
 * 편집형 text/url 셀 — 공용 `CellEditor`(노션식 고정너비 패널). 평소엔 표시값만, 누르면 셀 위로
 * 편집 패널. 인라인 테이블과 동일한 셀-편집 인터랙션을 공유한다.
 */
function TextCell({
  value,
  onChange,
  type,
}: {
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  type: 'text' | 'url' | 'phone'
}) {
  const c = tableViewCopy(useCollectionLocale())
  const text = asText(value)
  // phone: 닫힌 표면만 하이픈 서식. 편집 입력·커밋 값은 저장값 그대로(검색·tel: 과 같은 원문).
  const phoneDisplay =
    type === 'phone' && text ? (
      <span className="min-w-0 truncate tabular-nums text-fg">{formatPhoneNumber(text)}</span>
    ) : undefined
  return (
    <CellEditor
      value={text}
      type={type === 'url' ? 'url' : 'text'}
      display={phoneDisplay}
      placeholder={c.inputPlaceholder}
      ariaLabel={c.cellEditAria}
      onCommit={(next) => {
        const t = next.trim()
        onChange(t === '' ? null : t)
      }}
    />
  )
}

/** 편집형 number 셀 — CellEditor 로 진입, 숫자 파싱 커밋. */
function NumberCell({
  value,
  onChange,
  unit,
}: {
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  /** 속성 단위 — 「95만」처럼 붙여 보이고, 「190만」「1,900,000원」 입력을 이 단위로 읽는다. */
  unit?: NumberUnit
}) {
  const c = tableViewCopy(useCollectionLocale())
  const text =
    typeof value === 'number' ? (unit ? formatUnitNumber(value, unit) : String(value)) : ''
  return (
    <CellEditor
      value={text}
      placeholder={c.numberPlaceholder}
      ariaLabel={c.numberCellEditAria}
      onCommit={(next) => {
        const parsed = parseUnitNumberInput(next, unit)
        // 만 원 칸에 원처럼 큰 수 — 그대로 두면 「190만 → 1900000만」 같은 값이 남는다. 바로 묻는다.
        if (parsed.suspect && parsed.value !== null) {
          const asManwon = parsed.value / 10000
          const ok = window.confirm(c.manwonSuspect(formatUnitNumber(asManwon, 'manwon')))
          onChange(ok ? asManwon : parsed.value)
          return
        }
        onChange(parsed.value)
      }}
    />
  )
}

/** 편집형 checkbox 셀 — 클릭 토글. 읽기전용 표시(✓)와 달리 인터랙티브 박스. */
function CheckboxCell({
  value,
  onChange,
}: {
  value: PropertyValue
  onChange: (v: PropertyValue) => void
}) {
  const checked = value === true
  return (
    <button
      type="button"
      role="checkbox"
      data-table-row-stop
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex size-4 items-center justify-center rounded border transition-colors',
        checked
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-background hover:bg-surface',
      )}
    >
      {checked && <Check className="size-3" aria-hidden />}
    </button>
  )
}

/** 읽기전용 셀(projection 또는 onEdit 미제공) — 타입별 표시 전용 렌더. DS 시맨틱 토큰. */
function ReadonlyCell({ def, value }: { def: PropertyDef; value: PropertyValue }) {
  // 커스텀 포맷터 — 스칼라가 아닌 projection 값(예: 가격범위 {min,max})을 문자열로. 빈 문자열 = '—'.
  if (def.format) {
    const text = def.format(value)
    return text ? <span className="text-fg">{text}</span> : <span className="text-fg-muted">—</span>
  }
  switch (def.type) {
    case 'select': {
      const v = asText(value)
      if (!v) return <span className="text-fg-muted">—</span>
      // 노션식 색 칩 — 옵션 명시색(있으면) 또는 값 해시색. 편집형 SelectCell·카드(record-card)와 동일
      // 규칙(resolveOptionColor)이라 한 값이 표·카드·그룹 헤더 어디서나 같은 색을 갖는다.
      // 좁은 컬럼에서는 라벨만 말줄임(…) — 칩이 셀 밖으로 삐져나가 옆 컬럼을 덮지 않게(사람 칩과 같은 규칙).
      return (
        <Tag color={resolveOptionColor(def, v)} size="sm" className="max-w-full">
          <span className="min-w-0 truncate" title={optionLabelOf(def, v)}>
            {optionLabelOf(def, v)}
          </span>
        </Tag>
      )
    }
    case 'multi_select': {
      const items = asStringArray(value)
      if (items.length === 0) return <span className="text-fg-muted">—</span>
      // 읽기전용 멀티셀렉트는 전부 표시(wrap) — 칩이 잘리면 +N 인디케이터 없이 데이터가 조용히 은폐되므로
      // 클리핑하지 않는다(노션식 셀 클리핑은 +N 측정이 가능한 편집형 MultiSelectCell 에만 적용).
      return (
        <div className="flex min-w-0 flex-wrap gap-1">
          {items.map((t) => (
            <Tag key={t} color={resolveOptionColor(def, t)} size="sm" className="max-w-full">
              <span className="min-w-0 truncate" title={optionLabelOf(def, t)}>
                {optionLabelOf(def, t)}
              </span>
            </Tag>
          ))}
        </div>
      )
    }
    case 'person':
    case 'multi_person':
      return <PersonValue def={def} value={value} />
    case 'checkbox':
      return <span className="text-fg">{value === true ? '✓' : '—'}</span>
    case 'number':
      return (
        <span className="tabular-nums text-fg">
          {typeof value === 'number'
            ? def.unit
              ? formatUnitNumber(value, def.unit)
              : value.toLocaleString('ko-KR')
            : '—'}
        </span>
      )
    case 'url': {
      const url = asText(value)
      if (!url) return <span className="text-fg-muted">—</span>
      return (
        <a
          data-table-row-stop
          href={url}
          target="_blank"
          rel="noreferrer"
          className="truncate text-primary underline-offset-2 hover:underline"
        >
          {url}
        </a>
      )
    }
    case 'email': {
      const email = asText(value)
      if (!email) return <span className="text-fg-muted">—</span>
      return (
        <a
          data-table-row-stop
          href={`mailto:${email}`}
          className="truncate text-primary underline-offset-2 hover:underline"
        >
          {email}
        </a>
      )
    }
    case 'phone': {
      const phone = asText(value)
      if (!phone) return <span className="text-fg-muted">—</span>
      // 표시만 하이픈 서식(010-1234-5678). tel: 은 저장값 그대로 — 다이얼러는 숫자만 읽는다.
      return (
        <a
          data-table-row-stop
          href={`tel:${phone}`}
          className="truncate tabular-nums text-fg underline-offset-2 hover:underline"
        >
          {formatPhoneNumber(phone)}
        </a>
      )
    }
    case 'date': {
      const raw = asText(value)
      const label = raw ? formatDateValueDisplay(raw, def.dateFormat) : ''
      // 표시 불가(빈/파싱 실패)면 원문 폴백 후 '—'. 단일/기간/시간 모두 formatDateValueDisplay 가 처리.
      // 날짜는 한 줄 — 칸이 좁아도 「2026. 10.」/「21.」로 꺾여 행이 두 줄이 되지 않게(넘치면 말줄임, 전체는 title).
      return label ? (
        <span className="block truncate whitespace-nowrap text-fg" title={label}>
          {label}
        </span>
      ) : raw ? (
        <span className="text-fg">{raw}</span>
      ) : (
        <span className="text-fg-muted">—</span>
      )
    }
    case 'geo': {
      // 값은 GeoValue 객체 — 도로명주소(없으면 좌표)로 한 줄 라벨. 객체를 직접 찍으면 "[object Object]" 가 새므로 가드.
      if (!isGeoValue(value)) return <span className="text-fg-muted">—</span>
      return <span className="truncate text-fg">{formatGeoLabel(value)}</span>
    }
    case 'text':
    case 'relation':
    default: {
      const text = asText(value)
      return text ? (
        <span className="text-fg">{text}</span>
      ) : (
        <span className="text-fg-muted">—</span>
      )
    }
  }
}

/**
 * 제목(첫 컬럼) 셀 — 노션 DB 처럼.
 *
 * - onRename 이 있으면(편집형·미잠금 문서): 제목 텍스트가 공용 CellEditor 로 인라인 편집(→ 본문 H1 역기록).
 *   이때 이동은 hover "열기" 버튼으로만 한다 — 셀을 누르면 편집이 열려야 하므로 직접 클릭 이동과 충돌한다.
 * - 없으면(읽기전용/잠금): 제목 자체가 링크가 되어 클릭하면 바로 열린다(cursor-pointer). 편집이 없으니
 *   충돌할 것도 없고, "열려면 호버해서 작은 버튼을 찾아 눌러야 한다"는 건 목록 화면에서 숨은 어포던스다.
 *
 * hover 액션은 **absolute 로 띄운다.** 예전엔 in-flow + `opacity-0` 이라 보이지도 않으면서 폭을
 * 영구히 차지했고, 좁은 컬럼(예: 주문번호 110px)에서는 제목이 0px 로 눌려 값이 통째로 사라졌다.
 * 버튼들이 이미 `border + bg-background + shadow` 라 텍스트 위에 떠도 읽힌다.
 */
function TitleCell({
  value,
  onOpen,
  onRename,
  onDelete,
  variant = 'page',
  render,
}: {
  value: PropertyValue
  /** 열기 — 원본 클릭 이벤트를 함께 넘긴다(호스트가 ⌘/Ctrl+클릭을 새 탭으로 해석할 수 있게). */
  onOpen: (event: ReactMouseEvent) => void
  onRename?: (value: string) => void
  /** 지정 시 제목 셀 hover 케밥에 "삭제"(→ 휴지통) 노출. 실행은 호스트(순수 콜백). */
  onDelete?: () => void
  /** 제목 셀의 성격. 자세한 의미는 TableViewProps.titleVariant 참조. */
  variant?: TitleVariant
  /** 커스텀 제목 렌더(= PropertyDef.render). 지정 시 기본 텍스트 대신 이걸 그린다. */
  render?: () => ReactNode
}) {
  const c = tableViewCopy(useCollectionLocale())
  const text = asText(value)
  const isPage = variant === 'page'
  const titleBody = render ? (
    render()
  ) : (
    <span
      className={cn('truncate text-fg', isPage ? 'text-[15px] font-medium' : 'text-sm font-medium')}
    >
      {text || c.untitled}
    </span>
  )
  const editable = !!onRename

  return (
    <div className="relative flex items-center gap-2">
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {isPage && <FileText className="size-4 shrink-0 text-fg-muted" aria-hidden />}
        {editable ? (
          <CellEditor
            value={text}
            onCommit={onRename}
            placeholder={c.untitled}
            ariaLabel={c.titleAria}
            display={titleBody}
            // 편집 진입해도 타이포 동일(노션식): 표시 = 입력 = text-[15px] font-medium.
            inputClassName="text-[15px] font-medium"
          />
        ) : (
          // 읽기전용 제목 = 상세로 가는 링크. data-table-row-stop 은 두지 않는다 —
          // 이 버튼 자체가 여는 동작이라 행 활성화와 충돌하지 않는다.
          // 가운데 클릭(auxclick)도 같은 열기로 — 호스트가 새 탭으로 읽는다(openClickHandlers).
          <button
            type="button"
            {...openClickHandlers(onOpen)}
            className="min-w-0 flex-1 cursor-pointer truncate text-left hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {titleBody}
          </button>
        )}
      </span>
      {/*
        hover 액션: [열기] [⋯ 케밥(삭제)]. absolute 라 폭을 차지하지 않는다.
        숨김 상태에서 pointer-events 를 끄는 이유: 안 그러면 투명한 버튼이 제목 위를 덮어
        제목 클릭(=열기)을 가로챈다.
      */}
      <span className="pointer-events-none absolute top-1/2 right-0 flex -translate-y-1/2 items-center gap-1 focus-within:pointer-events-auto group-hover/row:pointer-events-auto">
        <button
          type="button"
          data-table-row-stop
          onClick={(e) => {
            e.stopPropagation()
            onOpen(e)
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-fg-muted opacity-0 shadow-sm transition-opacity hover:text-fg focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          <PanelRight className="size-3.5" aria-hidden />
          {c.open}
        </button>
        {onDelete && (
          <RowActionMenu onDelete={onDelete} triggerClassName="group-hover/row:opacity-100" />
        )}
      </span>
    </div>
  )
}

/**
 * 편집형 multi_select 셀 — 노션식 자유 입력 멀티셀렉트(DS TagSelect creatable, ghost). 토큰 칩 + 타이핑 생성.
 *
 * 행 높이 overflow 정책(노션식): 닫힘 상태에서 셀 내부 칩 영역을 한 줄(`max-h-8`)로 클리핑.
 * 태그가 많아도 행 높이가 부풀지 않고, 클릭하면 overlay 드롭다운에서 전체 태그를 보고 편집한다(드롭다운은
 * 포털/오버레이라 클리핑 영향 없음).
 * wrapCells=true 이면 클리핑을 해제해 칩이 줄바꿈된다(행 높이가 늘어남).
 */
function MultiSelectCell({
  def,
  value,
  onChange,
  options,
  onOptionsChange,
  wrapCells,
}: {
  def: PropertyDef
  value: PropertyValue
  onChange: (v: PropertyValue) => void
  /** 컬렉션 전체에서 모은 공용 후보값(노션식 — 모든 행이 같은 옵션 풀을 공유). */
  options?: string[]
  onOptionsChange?: (options: SelectOption[]) => void
  /** true 면 칩 줄바꿈 활성(max-h 클리핑 해제). 기본 false(현행 동작 불변). */
  wrapCells?: boolean
}) {
  const c = tableViewCopy(useCollectionLocale())
  const tags = asStringArray(value)
  // 정의된 옵션(색·순서·라벨) + 컬렉션 공용 후보 + 현재 값(정의에 없는 자유 태그). 새 태그는 creatable 로 생성.
  const defined = normalizeOptions(def.options)
  const definedVals = new Set(defined.map((o) => o.value))
  const extra = [...new Set([...(options ?? []), ...tags])]
    .filter((v) => !definedVals.has(v))
    .map((v) => ({ value: v, label: v }))
  const opts = [
    ...defined.map((o) => ({ value: o.value, label: o.label ?? o.value, color: o.color })),
    ...extra,
  ]
  // 셀 내 칩 영역(TagSelect 의 trigger=role=combobox)을 한 줄로 클리핑. 오버레이 패널은 영향 없음.
  // 셀 모드에선 TagSelect 의 내장 chevron(▾)을 숨겨 클리핑된 wrap 라인에 chevron 이 깨져 보이는 문제 차단 —
  // 셀 어디를 눌러도 드롭다운이 열리므로 chevron 없이도 인터랙션 가능. 대신 +N 인디케이터가 우측에 위치.
  // 클리핑으로 숨겨진 태그 수("+N")를 측정해 표시(노션식): 한 줄에 들어가는 칩만 보이고 나머지는 인디케이터.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [hiddenCount, setHiddenCount] = useState(0)
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) {
      setHiddenCount(0)
      return
    }
    // 클리핑이 적용된 표면 — TagSelect 의 trigger 컨테이너(role=combobox).
    const surface = wrapper.querySelector('[role=combobox]')
    if (!surface) {
      setHiddenCount(0)
      return
    }
    // 표면 자식 중 chevron(aria-hidden=true)을 제외한 것 = 칩. bottom 이 clientHeight 를 넘으면 클리핑됨.
    const children = Array.from(surface.children) as HTMLElement[]
    const chips = children.filter((c) => c.getAttribute('aria-hidden') !== 'true')
    if (chips.length === 0) {
      setHiddenCount(0)
      return
    }
    const limit = surface.clientHeight + 1 // 픽셀 fudge — sub-pixel 라운딩 보정
    let visible = 0
    for (const chip of chips) {
      if (chip.offsetTop + chip.offsetHeight <= limit) visible++
      else break
    }
    setHiddenCount(Math.max(0, tags.length - visible))
    // tags.length 변하면 재측정. columns 폭 변경(컬럼 리사이즈 등)은 후속.
  }, [tags.length])

  return (
    <div
      ref={wrapperRef}
      // [role=combobox] = TagSelect 닫힘 표면. > [aria-hidden=true]:last-child = 내장 chevron(▾).
      // 셀 클리핑(max-h-8) 안에서 chevron 이 wrap 라인에 잘리는 시각 깨짐을 차단하려 셀 모드에선 chevron 자체를 숨긴다.
      // button = Tag onRemove 버튼(×) — 패널 안 칩은 combobox 바깥이라 영향 없음.
      // wrapCells=true 이면 max-h 클리핑을 제거해 칩이 줄바꿈되도록 한다.
      className={cn(
        'relative',
        !wrapCells && '[&_[role=combobox]]:max-h-8 [&_[role=combobox]]:overflow-hidden',
        "[&_[role=combobox]>[aria-hidden='true']:last-child]:hidden",
        '[&_[role=combobox]_button]:hidden',
      )}
    >
      <TagSelect
        creatable
        colorize
        locked={def.locked}
        chrome="ghost"
        size="sm"
        options={opts}
        value={tags}
        onChange={(next) => onChange(next.length ? next : null)}
        onOptionsChange={
          onOptionsChange
            ? (next) =>
                onOptionsChange(
                  next.map((o) => ({ value: o.value, label: o.label, color: o.color })),
                )
            : undefined
        }
        placeholder={c.addTagPlaceholder}
        panelPlacement="overlay"
      />
      {!wrapCells && hiddenCount > 0 && (
        <span
          aria-hidden
          // chevron 을 숨겼으니 right-2(엣지 가까이) 로 — 칩 라인 우측에 자연스럽게 위치.
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-surface px-1 text-[11px] font-medium text-fg-muted"
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  )
}

/**
 * 버튼 프로퍼티 셀(type='button') — ButtonValue(라벨·variant·disabled)를 DS Button 으로 렌더.
 * buttonBlock(에디터 substrate 액션 블록)의 컬렉션 셀 형태. 클릭은 onAction(순수 데이터 → 호스트 실행).
 * onAction 미지정 또는 value.disabled 면 비활성. data-table-row-stop 으로 행 열기 전파 차단.
 */
function ButtonCell({
  value,
  onAction,
}: {
  value: PropertyValue
  onAction?: (action: string) => void
}) {
  if (!isButtonValue(value)) return <span className="text-fg-muted">—</span>
  return (
    <Button
      data-table-row-stop
      variant={value.variant ?? 'outline'}
      size="sm"
      disabled={value.disabled === true || !onAction}
      onClick={() => onAction?.(value.action)}
    >
      {value.label}
    </Button>
  )
}

/**
 * 한 셀 — frontmatter 편집형(+onEdit)이면 편집 컨트롤, 아니면 읽기전용. 테이블 셀과 "행 상세 속성 패널"
 * (RowPropertiesPanel)이 같은 컴포넌트를 공유해 두 표면의 셀 렌더·인터랙션이 한 글자도 어긋나지 않게 한다.
 */
export function Cell({
  def,
  value,
  onChange,
  options,
  onOptionsChange,
  relationProvider,
  onOpenRelation,
  onAction,
  wrapCells,
  renderContext,
  emptyMark = false,
}: {
  def: PropertyDef
  value: PropertyValue
  onChange?: (v: PropertyValue) => void
  /**
   * 커스텀 렌더러(`def.render`)에 넘길 행 맥락. 미지정이면 커스텀 렌더러를 타지 않는다
   * (RowPropertiesPanel 처럼 행 맥락 없이 셀만 쓰는 표면에서 안전하게 표준 렌더로 폴백).
   */
  renderContext?: CellRenderContext
  /** multi_select 의 컬렉션 공용 후보값(TableView 가 전체 행에서 합산해 내려줌). */
  options?: string[]
  /** 옵션 정의 변경(순서·색·생성·삭제) — 컬렉션 스키마에 영속(상위). */
  onOptionsChange?: (options: SelectOption[]) => void
  /** relation 컬럼이고 provider 가 등록돼 있으면 자동완성 셀로 렌더, 미등록이면 읽기전용 폴백. */
  relationProvider?: RelationProvider
  /** relation 칩의 연결 대상 열기(id). 지정 시 칩에 "열기" affordance 노출. 미지정 = 편집만(현행 동작). */
  onOpenRelation?: (id: string) => void
  /** 버튼 프로퍼티 클릭(action) — 행 id 는 상위(row 루프)가 바인딩해 내려준다. */
  onAction?: (action: string) => void
  /**
   * true 면 편집형 multi_select·relation 셀의 칩 한 줄 클리핑을 해제해 줄바꿈 허용. 기본 false —
   * 한 줄로 자르고 숨은 개수를 「+N」으로 적는다(행 높이가 칩 수에 따라 출렁이지 않게).
   */
  wrapCells?: boolean
  /**
   * 조건부 서식이 이 칸을 상태 색으로 칠했다 — 편집형 관계 칸이 비었으면 평소의 빈 자리 대신 「—」를 적는다
   * (손댈 때는 「관계 선택」 안내로 바뀐다). 읽기 전용 칸은 원래 「—」라 영향이 없다.
   */
  emptyMark?: boolean
}) {
  // 커스텀 렌더러가 있으면 그것이 전부다 — 타입별 렌더·format·편집 컨트롤보다 앞선다.
  // (코드가 소유한 표현이라 플랫폼이 덧그리거나 대체하지 않는다. 편집이 필요하면 렌더러 안에서 한다.)
  if (def.render && renderContext) return <>{def.render(value, renderContext)}</>
  // 구조 속성 — 자기 값이 없다. 행의 다른 칸에서 읽고, 고치면 그 칸을 고친다(renderContext.edit).
  if (def.type === 'struct')
    return renderContext ? (
      <StructCell
        def={def}
        props={renderContext.props}
        schema={renderContext.schema ?? []}
        {...(renderContext.edit ? { edit: renderContext.edit } : {})}
        renderField={(fieldDef, fieldValue, fieldChange) => (
          <Cell
            def={fieldDef}
            value={fieldValue}
            {...(fieldChange ? { onChange: fieldChange } : {})}
          />
        )}
      />
    ) : (
      <span className="text-fg-muted">—</span>
    )
  // 버튼은 편집형/읽기전용 구분 밖의 액션 셀 — projection 이지만 인터랙티브(클릭=onAction).
  if (def.type === 'button') return <ButtonCell value={value} onAction={onAction} />
  const editable = def.source === 'frontmatter' && !!onChange
  // 읽기 전용 관계 — provider 가 있으면 id 를 라벨 칩으로 푼다(편집형과 같은 칩, ✕·고르기 패널 없음).
  // 없으면 아래 평문 폴백(id 를 그대로 적는다).
  if (!editable && def.type === 'relation' && relationProvider)
    return (
      <RelationCell
        cardinality={def.relation?.cardinality ?? 'one'}
        value={value}
        provider={relationProvider}
        onOpen={onOpenRelation}
        wrap={wrapCells}
      />
    )
  if (!editable)
    return def.readOnlyReason ? (
      // 왜 못 고치나를 칸 위에서 말한다(머리의 자물쇠와 같은 글).
      <div title={def.readOnlyReason}>
        <ReadonlyCell def={def} value={value} />
      </div>
    ) : (
      <ReadonlyCell def={def} value={value} />
    )
  // 옵션 있는 select = 태그+메뉴, 옵션 없는 select = 자유 텍스트, multi_select = 노션식 멀티셀렉트,
  // text/url = 인라인 텍스트, relation = 자동완성(provider 있을 때만), date = 달력, checkbox = 토글.
  // 옵션이 **아직 없어도** 옵션을 만들 수 있으면(onOptionsChange) 선택 셀로 연다.
  // 노션과 같은 흐름이다 — 갓 만든 select 컬럼의 첫 값이 곧 첫 선택지다. 이 분기가 없으면
  // 빈 select 가 자유 텍스트로 열려, 사용자가 적은 값이 선택지가 되지 못한 채 떠돈다.
  if (def.type === 'select' && ((def.options?.length ?? 0) > 0 || onOptionsChange))
    return (
      <SelectCell def={def} value={value} onChange={onChange} onOptionsChange={onOptionsChange} />
    )
  if (def.type === 'multi_select')
    return (
      <MultiSelectCell
        def={def}
        value={value}
        onChange={onChange}
        options={options}
        onOptionsChange={onOptionsChange}
        wrapCells={wrapCells}
      />
    )
  if (def.type === 'person' || def.type === 'multi_person')
    return <PersonCell def={def} value={value} onChange={onChange} />
  if (def.type === 'relation' && relationProvider) {
    return (
      <RelationCell
        cardinality={def.relation?.cardinality ?? 'one'}
        value={value}
        provider={relationProvider}
        onChange={onChange}
        onOpen={onOpenRelation}
        wrap={wrapCells}
        emptyMark={emptyMark}
      />
    )
  }
  if (def.type === 'number')
    return (
      <NumberCell value={value} onChange={onChange} {...(def.unit ? { unit: def.unit } : {})} />
    )
  if (def.type === 'checkbox') return <CheckboxCell value={value} onChange={onChange} />
  if (def.type === 'date')
    return <DateCellEditor value={asText(value)} onCommit={onChange} format={def.dateFormat} />
  if (def.type === 'geo')
    return <GeoCellEditor value={isGeoValue(value) ? value : null} onCommit={onChange} />

  if (
    def.type === 'select' ||
    def.type === 'text' ||
    def.type === 'url' ||
    def.type === 'email' ||
    def.type === 'phone'
  )
    return (
      <TextCell
        value={value}
        onChange={onChange}
        type={def.type === 'url' || def.type === 'phone' ? def.type : 'text'}
      />
    )
  return <ReadonlyCell def={def} value={value} />
}

// ─── 헤더 — 컬럼 메뉴 / 컬럼 추가 ────────────────────────────────────────────────

/**
 * 노션식 메뉴 행 — 아이콘 + 라벨(+ 선택 체크). 포털 패널(AnchorContextSurface) 안에서 버튼으로 렌더한다.
 * 표 안 컬럼 메뉴/타입 피커가 표의 `overflow-x-auto` 박스에 잘리지 않도록(D-8 패널은 포털) 공용으로 쓴다.
 */
function MenuRow({
  icon,
  label,
  description,
  onClick,
  selected,
}: {
  icon?: ReactNode
  label: string
  description?: string
  onClick: () => void
  selected?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-surface"
    >
      {icon ? (
        <span
          className={cn(
            'inline-flex size-4 shrink-0 items-center justify-center',
            selected ? 'text-primary' : 'text-fg-muted',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn('block truncate text-sm', selected ? 'font-medium text-fg' : 'text-fg')}
        >
          {label}
        </span>
        {description ? (
          <span className="block truncate text-xs text-fg-muted">{description}</span>
        ) : null}
      </span>
      {selected ? <Check className="size-3.5 shrink-0 text-primary" aria-hidden /> : null}
    </button>
  )
}

/** 메뉴 섹션 구분선(노션식). */
function MenuDivider() {
  return <div className="my-1 h-px bg-border" aria-hidden />
}

/**
 * 컬럼 헤더(노션 DB식) — 메뉴 없으면 정적 라벨, 있으면 클릭 가능한 메뉴 트리거.
 * 이름 변경, 정렬, 숨기기 외에 base 컬럼은 "유형 변경"·"삭제" 도 지원한다.
 */
function ColumnHeader({
  def,
  sort,
  locked = false,
  inherited = false,
  onSortChange,
  onColumnHide,
  onPickup,
  onRename,
  onChangeType,
  onDelete,
  onToggleInherited,
  onOptionColorChange,
  toggles = [],
  onConfigure,
}: {
  def: PropertyDef
  sort: Sort[]
  /** (플라톤) 프로토타입 상속 컬럼 — 잠금 표시(🔒). 구조변경(타입·삭제)은 호출부가 콜백 미전달로 막는다. */
  locked?: boolean
  /** 현재 상속 컬럼인가 — Form 모드 토글 메뉴 라벨("상속 지정" vs "상속 해제")에 쓴다. */
  inherited?: boolean
  onSortChange?: (sort: Sort[]) => void
  onColumnHide?: (key: string) => void
  onPickup?: (e: ReactPointerEvent) => void
  onRename?: (label: string) => void
  onChangeType?: (type: BasePropertyType) => void
  onDelete?: () => void
  /** (Form 모드) 상속 토글 — 지정 시 메뉴에 "상속(Form) 지정/해제" 항목이 켜진다. */
  onToggleInherited?: () => void
  /** 선택지 색 — 지정 시 메뉴에 "선택지 색" 목록이 켜진다(팀 공통 설정). */
  onOptionColorChange?: (value: string, color: string | undefined) => void
  /** 켜고 끄는 설정 줄(호스트가 정한다) — 있으면 메뉴의 편집 동작 아래에 선다. */
  toggles?: readonly ColumnToggle[]
  /** 타입별 설정(구조 속성의 칸 · 배치, 수의 단위) — 지정 시 메뉴에 그 항목이 켜진다. 창은 호스트가 연다. */
  onConfigure?: () => void
}) {
  const c = tableViewCopy(useCollectionLocale())
  const currentSort = sort.find((s) => s.key === def.key)
  const SortIndicator =
    currentSort?.dir === 'asc' ? ArrowUp : currentSort?.dir === 'desc' ? ArrowDown : null

  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(def.label)
  const [menuOpen, setMenuOpen] = useState(false)
  const [typeMenuOpen, setTypeMenuOpen] = useState(false)

  const commitRename = () => {
    const t = draft.trim()
    if (t && t !== def.label) onRename?.(t)
    setRenaming(false)
  }

  const runAndClose = (fn: () => void) => {
    fn()
    setMenuOpen(false)
  }

  const labelNode = (
    // 머리는 이름만 — 칸마다 붙던 형식 아이콘(T·목록·전화…)은 표를 훑을 때 잡음이었다(시안 대조 R6).
    // 형식은 머리 메뉴의 「속성 형식」에서 본다.
    <span className="inline-flex items-center gap-1.5">
      {def.label}
      {locked ? (
        <Lock className="size-3 shrink-0 text-fg-muted" aria-label={c.inheritedLockedAria} />
      ) : def.readOnlyReason ? (
        <Lock className="size-3 shrink-0 text-fg-muted" aria-label={def.readOnlyReason}>
          <title>{def.readOnlyReason}</title>
        </Lock>
      ) : null}
      {SortIndicator ? (
        <SortIndicator className="size-3 shrink-0 text-fg-muted" aria-hidden />
      ) : null}
    </span>
  )

  const gripNode = onPickup ? (
    <span
      role="button"
      aria-label={c.moveColumnAria}
      onPointerDown={onPickup}
      className="-ml-1 flex h-5 w-3 shrink-0 cursor-grab touch-none items-center justify-center text-fg-muted opacity-0 transition-opacity hover:text-fg group-hover/colhead:opacity-100 active:cursor-grabbing"
    >
      ⠿
    </span>
  ) : null

  if (renaming) {
    return (
      <span className="inline-flex items-center gap-1">
        {gripNode}
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitRename()
            } else if (e.key === 'Escape') {
              setDraft(def.label)
              setRenaming(false)
            }
          }}
          onBlur={commitRename}
          className="w-24 min-w-0 rounded border border-primary/60 bg-background px-1 py-0.5 text-xs text-fg outline-none focus:border-primary"
        />
      </span>
    )
  }

  const hasMenu =
    !!onSortChange ||
    !!onColumnHide ||
    !!onRename ||
    !!onChangeType ||
    !!onDelete ||
    !!onToggleInherited ||
    toggles.length > 0 ||
    !!onOptionColorChange
  if (!hasMenu) {
    if (!gripNode) return labelNode
    return (
      <span className="inline-flex items-center gap-1">
        {gripNode}
        {labelNode}
      </span>
    )
  }

  // 타입 변경 서브패널
  const typeSubmenu = onChangeType ? (
    <AnchorContextSurface
      layout="inline"
      open={typeMenuOpen}
      onOpenChange={setTypeMenuOpen}
      panelRole="menu"
      panelPlacement="right"
      panelAriaLabel={c.changeType}
      panelClassName="w-64 py-1 overflow-hidden"
      surface={
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setTypeMenuOpen((o) => !o)
          }}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-fg transition-colors hover:bg-surface"
        >
          <ChevronRight className="size-3.5 shrink-0 text-fg-muted" aria-hidden />
          <span className="flex-1">{c.changeType}</span>
          <ChevronRight className="size-3 shrink-0 text-fg-muted" aria-hidden />
        </button>
      }
      panel={
        <div>
          <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
            {c.selectType}
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {/* 사람으로 바꾸는 길은 두지 않는다 — 기존 값(이름 문자열)을 계정 id 로 옮길 방법이 없다. */}
            {ADD_PROPERTY_TYPES.filter((t) => t.value !== 'relation' && t.value !== 'person').map(
              (t) => {
                const TIcon = TYPE_ICON[t.value] ?? Type
                const isCurrent = def.type === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onChangeType(t.value)
                      setTypeMenuOpen(false)
                      setMenuOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-surface',
                      isCurrent && 'bg-surface',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex size-5 shrink-0 items-center justify-center rounded',
                        isCurrent ? 'bg-primary/15 text-primary' : 'bg-border/50 text-fg-muted',
                      )}
                    >
                      <TIcon className="size-3.5" aria-hidden />
                    </span>
                    <span className={cn('text-sm', isCurrent ? 'font-medium text-fg' : 'text-fg')}>
                      {c.typeLabel(t.value)}
                    </span>
                    {isCurrent && (
                      <Check className="ml-auto size-3.5 shrink-0 text-primary" aria-hidden />
                    )}
                  </button>
                )
              },
            )}
          </div>
        </div>
      }
    />
  ) : null

  return (
    <span className="inline-flex items-center gap-1">
      {gripNode}
      <AnchorContextSurface
        layout="inline"
        open={menuOpen}
        onOpenChange={(v) => {
          setMenuOpen(v)
          if (!v) setTypeMenuOpen(false)
        }}
        panelRole="menu"
        panelPlacement="below"
        panelAriaLabel={c.columnOptions(def.label)}
        panelClassName="w-52 py-1"
        surface={
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-surface focus-visible:bg-surface"
          >
            {labelNode}
          </button>
        }
        panel={
          <div role="presentation">
            {/* 편집 동작 */}
            {onRename && (
              <MenuRow
                icon={<Pencil className="size-3.5" aria-hidden />}
                label={c.rename}
                onClick={() =>
                  runAndClose(() => {
                    setDraft(def.label)
                    setRenaming(true)
                  })
                }
              />
            )}
            {typeSubmenu}
            {onConfigure && (
              <MenuRow
                icon={<LayoutDashboard className="size-3.5" aria-hidden />}
                label={def.type === 'struct' ? c.configureStruct : c.configureUnit}
                onClick={() => runAndClose(onConfigure)}
              />
            )}
            {/* (Form 모드) 상속(프로토타입 Form) 지정/해제 — 본질 컬럼으로 고정하거나 자유 컬럼으로 되돌린다. */}
            {onToggleInherited && (
              <MenuRow
                icon={<Lock className="size-3.5" aria-hidden />}
                label={inherited ? c.unsetInherited : c.setInherited}
                onClick={() => runAndClose(onToggleInherited)}
              />
            )}
            {toggles.map((t) => (
              <MenuRow
                key={t.id}
                icon={<Lock className="size-3.5" aria-hidden />}
                label={t.label}
                {...(t.description ? { description: t.description } : {})}
                selected={t.checked}
                onClick={() => runAndClose(t.onToggle)}
              />
            ))}
            {/* 정렬 */}
            {onSortChange && (
              <>
                <MenuDivider />
                <MenuRow
                  icon={<ArrowUp className="size-3.5" aria-hidden />}
                  label={c.sortAsc}
                  selected={currentSort?.dir === 'asc'}
                  onClick={() => runAndClose(() => onSortChange([{ key: def.key, dir: 'asc' }]))}
                />
                <MenuRow
                  icon={<ArrowDown className="size-3.5" aria-hidden />}
                  label={c.sortDesc}
                  selected={currentSort?.dir === 'desc'}
                  onClick={() => runAndClose(() => onSortChange([{ key: def.key, dir: 'desc' }]))}
                />
                {currentSort && (
                  <MenuRow
                    label={c.clearSort}
                    onClick={() => runAndClose(() => onSortChange([]))}
                  />
                )}
              </>
            )}
            {/* 선택지 색 — 팀 공통. 칩이 이미 색을 보여 주므로 색 이름을 옆에 다시 적지 않는다. */}
            {onOptionColorChange && (
              <>
                <MenuDivider />
                <div className="px-3 pt-1.5 pb-0.5 text-xs font-medium text-fg-muted">
                  {c.optionColors}
                </div>
                <div className="max-h-64 overflow-y-auto px-1">
                  {normalizeOptions(def.options).map((o) => (
                    <OptionColorRow
                      key={o.value}
                      def={def}
                      option={o}
                      onChange={(color) => onOptionColorChange(o.value, color)}
                    />
                  ))}
                </div>
                <div className="px-3 pt-0.5 pb-1 text-xs text-fg-muted">{c.optionColorsHint}</div>
              </>
            )}
            {/* 보기/숨기기 */}
            {onColumnHide && (
              <>
                <MenuDivider />
                <MenuRow
                  icon={<EyeOff className="size-3.5" aria-hidden />}
                  label={c.hide}
                  onClick={() => runAndClose(() => onColumnHide(def.key))}
                />
              </>
            )}
            {/* 위험 동작: 삭제 */}
            {onDelete && (
              <>
                <MenuDivider />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAndClose(onDelete)}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-error-text transition-colors hover:bg-error-subtle"
                >
                  <Trash2 className="size-3.5 shrink-0" aria-hidden />
                  <span>{c.deleteProperty}</span>
                </button>
              </>
            )}
          </div>
        }
      />
    </span>
  )
}

const OPTION_COLOR_CHOICES = ['gray', 'blue', 'green', 'orange', 'red', 'purple', 'teal'] as const

const OPTION_COLOR_SWATCH: Record<(typeof OPTION_COLOR_CHOICES)[number], string> = {
  gray: 'bg-tag-gray-dot',
  blue: 'bg-tag-blue-dot',
  green: 'bg-tag-green-dot',
  orange: 'bg-tag-orange-dot',
  red: 'bg-tag-red-dot',
  purple: 'bg-tag-purple-dot',
  teal: 'bg-tag-teal-dot',
}

/**
 * 헤더 메뉴의 선택지 한 줄 — 칩 + 호버 시 ⋯ → 색 견본 목록.
 *
 * "기본" 은 팀이 고른 색을 지운다(값 해시색 또는 호스트가 정한 기본색으로 돌아간다).
 * 체크는 지금 보이는 색에 단다 — 기본으로 돌아간 뒤에도 무슨 색인지는 보여야 한다.
 */
function OptionColorRow({
  def,
  option,
  onChange,
}: {
  def: PropertyDef
  option: SelectOption
  onChange: (color: string | undefined) => void
}) {
  const c = tableViewCopy(useCollectionLocale())
  const [open, setOpen] = useState(false)
  const shown = resolveOptionColor(def, option.value)
  const label = option.label ?? option.value
  return (
    <div className="group/optcolor flex min-h-7 items-center gap-2 rounded px-2 hover:bg-surface">
      <Tag size="sm" color={shown}>
        {label}
      </Tag>
      <span className="flex-1" />
      <AnchorContextSurface
        layout="inline"
        open={open}
        onOpenChange={setOpen}
        panelRole="menu"
        panelPlacement="right"
        panelAriaLabel={c.optionColorAria(label)}
        panelClassName="w-40 p-1"
        surface={
          <button
            type="button"
            aria-label={c.optionColorAria(label)}
            onClick={(e) => {
              e.stopPropagation()
              setOpen((o) => !o)
            }}
            className={cn(
              'flex size-5 items-center justify-center rounded text-fg-muted transition-opacity hover:bg-background hover:text-fg',
              open
                ? 'opacity-100'
                : 'opacity-0 group-hover/optcolor:opacity-100 focus-visible:opacity-100',
            )}
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
          </button>
        }
        panel={
          <div role="presentation">
            {[undefined, ...OPTION_COLOR_CHOICES].map((color) => {
              const current = color === shown
              return (
                <button
                  key={color ?? 'default'}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(color)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2.5 rounded px-2 py-1 text-left text-sm text-fg transition-colors hover:bg-surface"
                >
                  <span
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      color ? OPTION_COLOR_SWATCH[color] : 'border border-fg-muted/50',
                    )}
                    aria-hidden
                  />
                  <span className="flex-1">{color ? c.colorName(color) : c.colorDefault}</span>
                  {current && <Check className="size-3.5 shrink-0 text-fg-muted" aria-hidden />}
                </button>
              )
            })}
          </div>
        }
      />
    </div>
  )
}

/**
 * footer 집계 셀(노션식) — 컬럼당 결과 + 클릭 시 종류 선택 메뉴. 기본은 '없음'(공백).
 * 호버 시만 'Calculate' 힌트 노출, 선택 후엔 결과만 표시. onChange 미지정 시 결과만 정적 표시.
 */
function FooterCell({
  values,
  type,
  onChange,
  scope = 'all',
  totalCount,
  tone = null,
}: {
  values: (PropertyValue | undefined)[]
  type: AggregationType
  onChange?: (next: AggregationType) => void
  /** 숫자의 상태 색 — 센 칸들의 조건부 서식 색(aggregationTone). null = 본문 글자색. */
  tone?: ConditionalFormatTone | null
  /** 이 집계가 무엇을 세는가 — 'page' 면 결과에 범위를 붙여 표시한다(headless.ts 참조). */
  scope?: AggregationScope
  /** 전체 행 수(서버가 알려준 경우). 행 수 계열 집계는 이 값이 있으면 그걸 쓴다. */
  totalCount?: number
}) {
  const c = tableViewCopy(useCollectionLocale())
  const [open, setOpen] = useState(false)
  const result = useMemo(() => {
    // count(전체 행 수)만은 서버가 알려준 모수로 답할 수 있다 — 나머지(합계·평균·고유수)는
    // 값이 있어야 계산되므로 한 페이지치로만 낼 수 있고, 그래서 아래에서 범위를 밝힌다.
    if (type === 'count' && totalCount !== undefined) return String(totalCount)
    return computeAggregation(type, values)
  }, [type, values, totalCount])
  const options: AggregationType[] = [
    'none',
    'count',
    'count_not_empty',
    'count_empty',
    'count_unique',
    'sum',
    'avg',
    'min',
    'max',
  ]

  // 라벨 prefix(어떤 집계인지) — 결과와 함께 작게 노출(노션 스타일: "합계 9,900").
  const prefix = type === 'none' ? '' : AGGREGATION_LABEL[type]

  // 한 페이지만 센 결과는 전체인 척하지 않는다 — "이 페이지" 를 붙여 모수를 밝힌다.
  // (count 를 totalCount 로 답한 경우는 진짜 전체이므로 붙이지 않는다.)
  const pageScoped = scope === 'page' && !(type === 'count' && totalCount !== undefined)
  const display =
    type === 'none' ? '' : `${prefix} ${result}${pageScoped ? ` ${c.scopePage}` : ''}`.trim()

  // 라벨(무엇을 셌나)은 흐리게, 값은 본문 글자로 — 「전체 수 41」에서 읽을 것은 숫자다.
  const labelled =
    type === 'none' ? null : (
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-xs text-fg-muted">{prefix}</span>
        <span
          className={cn(
            'text-sm font-semibold tabular-nums',
            tone ? textFormatClassName({ tone }) : 'text-fg',
          )}
        >
          {result}
        </span>
        {pageScoped && <span className="text-xs text-fg-muted">{c.scopePage}</span>}
      </span>
    )

  if (!onChange) {
    return <span title={display || undefined}>{labelled}</span>
  }

  // 포털 패널 — 표 하단 가장자리에서 열려도 overflow 박스에 잘리지 않는다(D-8).
  // above: 푸터 셀은 항상 표 하단에 있으므로 위로 열린다.
  return (
    <AnchorContextSurface
      open={open}
      onOpenChange={setOpen}
      panelRole="menu"
      panelPlacement="above"
      panelAriaLabel={c.aggregationMethod}
      panelClassName="w-44 py-1"
      surface={
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'w-full text-right text-xs transition-colors',
            type === 'none'
              ? 'text-fg-muted opacity-0 hover:opacity-100 group-hover/footer:opacity-100'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {type === 'none' ? c.calculate : labelled}
        </button>
      }
      panel={
        <div role="presentation" className="max-h-60 overflow-y-auto">
          {options.map((t) => (
            <MenuRow
              key={t}
              label={AGGREGATION_LABEL[t]}
              selected={type === t}
              onClick={() => {
                onChange(t)
                setOpen(false)
              }}
            />
          ))}
        </div>
      }
    />
  )
}

/** 수 단위 고르기 — 없음 · 원 · 만 원. */
const UNIT_CHOICES: { value: NumberUnit | undefined; label: string }[] = [
  { value: undefined, label: '단위 없음' },
  { value: 'won', label: '원' },
  { value: 'manwon', label: '만 원' },
]

type PropertyTypeEntry = {
  value: BasePropertyType
  group: 'basic' | 'contact' | 'advanced'
}

// 타입 피커 엔트리 — 그룹별로 구분선과 섹션 헤더 렌더. 라벨·설명은 로캘화되어 messages 에서 해석한다
// (c.typeLabel / c.typeDescription). 여기선 구조(값·그룹)만 유지한다.
const ADD_PROPERTY_TYPES: PropertyTypeEntry[] = [
  { value: 'text', group: 'basic' },
  { value: 'number', group: 'basic' },
  { value: 'select', group: 'basic' },
  { value: 'multi_select', group: 'basic' },
  { value: 'date', group: 'basic' },
  { value: 'checkbox', group: 'basic' },
  { value: 'person', group: 'basic' },
  { value: 'url', group: 'basic' },
  { value: 'email', group: 'contact' },
  { value: 'phone', group: 'contact' },
  { value: 'relation', group: 'advanced' },
  { value: 'geo', group: 'advanced' },
  { value: 'struct', group: 'advanced' },
]

/**
 * 헤더 끝의 "+" 버튼 — 노션 DB식 타입 피커 패널.
 * 이름 입력 + 그룹별 타입 목록(기본/연락처/고급). 타입 클릭으로 선택, Enter/"추가"로 생성.
 * 패널은 포털(AnchorContextSurface)로 표의 overflow-x-auto 박스에 잘리지 않는다.
 */
function AddPropertyHeader({
  onAddProperty,
  relationTargets,
  peopleEnabled,
  structEnabled,
}: {
  onAddProperty: (def: BasePropertyDef) => void
  /** 연결 대상 후보(value=target, label=표시명). value=label 인 경우가 일반(상품), 워크스페이스는 노드 id↔DB 이름. */
  relationTargets: RelationTargetOption[]
  /** 사람 타입을 보일까 — TableView 의 동명 prop. */
  peopleEnabled: boolean
  /** 구조 속성 · 수 단위를 보일까 — TableView 의 동명 prop. */
  structEnabled: boolean
}) {
  const c = tableViewCopy(useCollectionLocale())
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<BasePropertyType>('text')
  const [target, setTarget] = useState<string>(relationTargets[0]?.value ?? '')
  const [cardinality, setCardinality] = useState<'one' | 'many'>('one')
  const [unit, setUnit] = useState<NumberUnit | undefined>(undefined)

  const availableTypes = ADD_PROPERTY_TYPES.filter(
    (t) =>
      (t.value !== 'relation' || relationTargets.length > 0) &&
      (t.value !== 'person' || peopleEnabled) &&
      (t.value !== 'struct' || structEnabled),
  )

  const groups = ['basic', 'contact', 'advanced'] as const

  const reset = () => {
    setLabel('')
    setType('text')
    setUnit(undefined)
  }
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const submit = () => {
    const trimmed = label.trim()
    if (!trimmed) return
    const isRelation = type === 'relation'
    if (isRelation && !target) return
    // 사람은 피커에서 한 칸이고, 한 명/여러 명은 아래 토글이 가른다(relation 카디널리티와 같은 자리).
    const resolvedType: BasePropertyType =
      type === 'person' && cardinality === 'many' ? 'multi_person' : type
    onAddProperty({
      key: slugifyKey(trimmed),
      label: trimmed,
      type: resolvedType,
      ...(isRelation ? { relation: { target, cardinality } } : {}),
      ...(type === 'number' && unit ? { unit } : {}),
    })
    reset()
    setOpen(false)
  }

  return (
    <AnchorContextSurface
      layout="inline"
      open={open}
      onOpenChange={handleOpenChange}
      panelRole="dialog"
      panelPlacement="below"
      panelAriaLabel={c.addPropertyDialog}
      panelClassName="w-72 overflow-hidden p-0"
      surface={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={c.addProperty}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:bg-surface"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      }
      panel={
        <div>
          {/* 헤더: 속성 이름 입력 */}
          <div className="p-3 pb-2">
            <div className="mb-1.5 text-xs font-medium text-fg-muted">{c.propertyName}</div>
            <Input
              value={label}
              onValueChange={setLabel}
              placeholder={c.nameInputPlaceholder}
              size="sm"
              autoFocus
              onEnterKey={submit}
              onEscapeKey={() => handleOpenChange(false)}
            />
          </div>
          <MenuDivider />

          {/* 유형 선택 — 그룹별 구분 */}
          <div className="max-h-72 overflow-y-auto py-1">
            {groups.map((g, gi) => {
              const items = availableTypes.filter((t) => t.group === g)
              if (items.length === 0) return null
              return (
                <div key={g}>
                  {gi > 0 && <MenuDivider />}
                  <div className="px-3 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
                    {c.groupLabel(g)}
                  </div>
                  {items.map((t) => {
                    const TypeIcon = TYPE_ICON[t.value] ?? Type
                    const isSelected = type === t.value
                    return (
                      <button
                        key={t.value}
                        type="button"
                        role="menuitem"
                        onClick={() => setType(t.value)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition-colors hover:bg-surface',
                          isSelected && 'bg-surface',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex size-6 shrink-0 items-center justify-center rounded',
                            isSelected
                              ? 'bg-primary/15 text-primary'
                              : 'bg-border/50 text-fg-muted',
                          )}
                        >
                          <TypeIcon className="size-3.5" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'block truncate text-sm',
                              isSelected ? 'font-medium text-fg' : 'text-fg',
                            )}
                          >
                            {c.typeLabel(t.value)}
                          </span>
                          <span className="block truncate text-xs text-fg-muted">
                            {c.typeDescription(t.value)}
                          </span>
                        </span>
                        {isSelected && (
                          <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* person 확장: 한 명 / 여러 명 */}
          {type === 'person' && (
            <>
              <MenuDivider />
              <div className="flex gap-1 p-3">
                {(['one', 'many'] as const).map((card) => (
                  <button
                    key={card}
                    type="button"
                    onClick={() => setCardinality(card)}
                    className={cn(
                      'flex-1 rounded border px-2 py-1.5 text-xs transition-colors',
                      cardinality === card
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-fg-muted hover:bg-surface',
                    )}
                  >
                    {card === 'one' ? c.singlePerson : c.multiPerson}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* number 확장: 단위 — 금액이 원과 만 원으로 섞이지 않게 정의에 적는다 */}
          {type === 'number' && structEnabled && (
            <>
              <MenuDivider />
              <div className="flex gap-1 p-3">
                {UNIT_CHOICES.map((u) => (
                  <button
                    key={u.label}
                    type="button"
                    onClick={() => setUnit(u.value)}
                    className={cn(
                      'flex-1 rounded border px-2 py-1.5 text-xs transition-colors',
                      unit === u.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-fg-muted hover:bg-surface',
                    )}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* struct 확장: 칸 · 배치는 추가 뒤 호스트의 저작 창에서 고른다 */}
          {type === 'struct' && (
            <>
              <MenuDivider />
              <p className="px-3 py-2 text-xs text-fg-muted">{c.structNextStep}</p>
            </>
          )}

          {/* relation 확장: 대상 컬렉션 + 카디널리티 */}
          {type === 'relation' && (
            <>
              <MenuDivider />
              <div className="flex flex-col gap-2 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-fg-muted">
                  {c.linkTarget}
                </div>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs text-fg outline-none focus:border-primary"
                >
                  {relationTargets.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-1">
                  {(['one', 'many'] as const).map((card) => (
                    <button
                      key={card}
                      type="button"
                      onClick={() => setCardinality(card)}
                      className={cn(
                        'flex-1 rounded border px-2 py-1.5 text-xs transition-colors',
                        cardinality === card
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-fg-muted hover:bg-surface',
                      )}
                    >
                      {card === 'one' ? c.singleRef : c.multiRef}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <MenuDivider />
          {/* 액션 */}
          <div className="flex items-center justify-between gap-1 px-3 py-2">
            <span className="text-xs text-fg-muted">
              <span className="rounded bg-border px-1 py-0.5 font-mono text-[10px]">Enter</span>{' '}
              {c.toAddSuffix}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                {c.cancel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submit}
                disabled={!label.trim() || (type === 'relation' && !target)}
              >
                {c.add}
              </Button>
            </div>
          </div>
        </div>
      }
    />
  )
}

/**
 * 사람이 입력한 라벨을 안정 키로 — 영숫자/한글 유지, 그 외는 _. 빈 결과(라벨이 기호뿐)면 random 폴백.
 * 충돌 회피는 상위가 처리(이미 존재하면 _2 등 — 일단 base 머지의 첫-우선이 가드).
 */
function slugifyKey(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_가-힣]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  if (slug.length > 0) return slug
  return `prop_${Math.random().toString(36).slice(2, 8)}`
}

// ─── 컬럼 폭(노션식 fixed/fit/fill) ──────────────────────────────────────────

/**
 * PropertyType 별 기본 컬럼 폭(노션 DB 디폴트와 유사). 사용자가 PropertyDef.width 를 지정하면 그 값이 우선.
 * - title 후보(text): fill — 남은 공간을 다 먹는 한 컬럼(보통 첫 번째 text/projection).
 * - select / multi_select: 고정 폭. 태그가 셀 내부에서 줄바꿈되어 컬럼을 밀어내지 않게.
 * - 숫자/체크박스: 좁은 고정.
 * - 날짜/url/relation: 중간 고정.
 */
const DEFAULT_WIDTH_BY_TYPE: Record<PropertyType, ColumnWidth> = {
  text: { mode: 'fixed', px: 160 },
  number: { mode: 'fixed', px: 90 },
  select: { mode: 'fixed', px: 130 },
  multi_select: { mode: 'fixed', px: 180 },
  date: { mode: 'fixed', px: 130 },
  checkbox: { mode: 'fixed', px: 70 },
  url: { mode: 'fixed', px: 180 },
  email: { mode: 'fixed', px: 180 },
  phone: { mode: 'fixed', px: 130 },
  relation: { mode: 'fixed', px: 140 },
  geo: { mode: 'fixed', px: 200 }, // 도로명주소가 길어 url 보다 살짝 넓게
  button: { mode: 'fixed', px: 110 }, // 액션 버튼 — 짧은 라벨 기준(복원/설치 등)
  person: { mode: 'fixed', px: 140 }, // 이니셜 + 이름 하나
  multi_person: { mode: 'fixed', px: 200 },
  struct: { mode: 'fixed', px: 220 }, // 「200만 → 205만 (+5만)」 한 줄
}

/**
 * 컬럼별 width 결정 — PropertyDef.width 우선. 미지정 시 type 기본값.
 * 첫 번째 컬럼이 text(=제목 후보)이고 사용자가 명시 안 했으면 fill 로 승격해 노션식 "title 이 남은 공간 차지" 패턴을 구현.
 * 다른 컬럼 기본 폭은 빠듯하게(노션 DB 기본 비슷) — title 이 가능한 한 넓게 보이도록 한다.
 */
function resolveColumnWidths(columns: PropertyDef[]): ColumnWidth[] {
  return columns.map((c, i) => {
    if (c.width) return c.width
    // 첫 컬럼이 text 면 자동으로 fill 로 — title 자리(노션 DB 첫 컬럼의 페이지 이름과 동형). minPx 를 넉넉히 줘서
    // 좁은 뷰포트에서도 상품명이 충분히 보이게.
    if (i === 0 && c.type === 'text') return { mode: 'fill', minPx: 280 }
    return DEFAULT_WIDTH_BY_TYPE[c.type]
  })
}

/** ColumnWidth → CSS width 값. fill 은 `auto`(table-fixed 가 남은 공간을 fill 컬럼들에 분배). */
function widthToCss(w: ColumnWidth): React.CSSProperties {
  if (w.mode === 'fixed') return { width: `${w.px}px` }
  if (w.mode === 'fit') return { width: `${w.px ?? 140}px` }
  // fill: width 미지정 → table-fixed 가 남은 공간을 fill 컬럼들에 균등 분배. minWidth 가드.
  return w.minPx ? { minWidth: `${w.minPx}px` } : {}
}

// ─── 표 ───────────────────────────────────────────────────────────────────────

export function TableView<P>({
  records,
  pack,
  view,
  onOpen,
  onEdit,
  onEditTitle,
  schema,
  onAction,
  onOptionsChange,
  onOptionColorChange,
  onReorder,
  onCreate,
  createLabel,
  onSortChange,
  onColumnHide,
  onAddProperty,
  onColumnResize,
  onColumnResetWidth,
  onColumnReorder,
  onRenameColumn,
  renameScope = 'all',
  relations,
  relationTargetOptions,
  peopleEnabled = false,
  onOpenRelation,
  onAggregationChange,
  onChangePropertyType,
  onDeleteProperty,
  onConfigureProperty,
  structEnabled = false,
  onDeleteRow,
  formMode = false,
  onToggleInherited,
  columnToggles,
  titleVariant = 'page',
  queryMode = 'client',
  totalCount,
  stickyHeader = false,
  status,
  selection,
}: TableViewProps<P>) {
  const copy = tableViewCopy(useCollectionLocale())
  // onCreate 트리거 행 라벨 — 미지정 시 로캘 기본("+ 새 항목"/"+ New item"/"+ 新建项").
  const resolvedCreateLabel = createLabel ?? copy.createDefault
  // 컬럼 정의 = 컬렉션 스키마 오버라이드(있으면) 또는 팩 기본.
  // 뷰가 기억하는 폭(columnWidths)은 스키마 폭 위에 덮는다 — 같은 화면이라도 뷰마다 폭이 다르다.
  const baseSchema = schema ?? pack.propertySchema
  const propertySchema = useMemo(
    () => applyViewColumnWidths(baseSchema, view.columnWidths),
    [baseSchema, view.columnWidths],
  )
  const columns = useMemo(() => visibleColumns(propertySchema, view), [propertySchema, view])

  // 문서 단위 잠금 — locked 문서는 제목 인라인 편집 비활성(D-8 통합 Document 플래그).
  const lockedById = useMemo(() => new Map(records.map((r) => [r.id, !!r.doc.locked])), [records])

  // 레코드 → 속성 추출. props 는 string→PropertyValue 맵으로 다뤄 셀별로 키를 읽는다(P 는 그 형태).
  const rows: Row<Record<string, PropertyValue>>[] = useMemo(
    () =>
      records.map((r) => ({
        id: r.id,
        props: pack.readProperties(r.doc) as unknown as Record<string, PropertyValue>,
      })),
    [records, pack],
  )

  // viewRows(정렬·필터) 후 수동 행 순서(view.rowOrder)를 적용 — 단 활성 sort 가 없을 때만(정렬이 우선).
  // 미등록 행(신규 생성 등)은 끝에(applyRowOrder). sort 가 걸리면 rowOrder 무시 → 정렬 순서 그대로.
  //
  // server 모드에선 이 전체를 건너뛴다 — 행은 이미 서버가 걸러 정렬해 보낸 결과다. 여기서 다시
  // filter/sort 를 돌리면 (a) 한 페이지 안에서 재정렬해 서버 정렬을 뒤엎고 (b) 서버가 이미
  // 적용한 필터를 클라 semantics 로 한 번 더 적용해 행이 사라질 수 있다.
  const sorted = useMemo(() => {
    if (queryMode === 'server') return rows
    const base = viewRows(rows, view)
    return view.sort.length === 0 ? applyRowOrder(base, view.rowOrder) : base
  }, [rows, view, queryMode])

  // 행 수동 재정렬(노션식 드래그-스왑) — onReorder 가 있고 *정렬·필터가 없을 때만*.
  // 정렬/필터가 적용되면 표시 행이 일부거나 순서가 파생값이라, 수동 순서를 기록하면 가려진 행 순서가
  // 깨지고 낙관적 가드(length 비교)도 무효가 된다 → 그 경우 그립 자체를 끈다.
  // server 모드도 같은 이유로 끈다 — 보이는 건 한 페이지뿐이라 "표시 순서대로의 전체 id 배열"을
  // 만들 수 없다(onReorder 계약이 요구하는 것). 반쪽짜리 순서를 영속하면 다른 페이지가 뒤섞인다.
  const reorderable =
    !!onReorder &&
    queryMode === 'client' &&
    view.sort.length === 0 &&
    view.filters.children.length === 0

  // 맨 앞 고정 열들 — [체크박스][그립][제목]. 제목·그립의 sticky left 는 앞에 선 열 폭의 합이다.
  const selectable = !!selection
  const gripLeft = selectable ? SELECT_COL_PX : 0
  const titleLeft = gripLeft + (reorderable ? GRIP_COL_PX : 0)
  const leadCols = (selectable ? 1 : 0) + (reorderable ? 1 : 0)

  // 선택 — 지금 그린 행 기준. Shift+클릭 범위의 기준점은 마지막으로 누른 행 id(인덱스는 정렬이 바뀌면 어긋난다).
  const selectionAnchor = useRef<string | null>(null)
  const visibleIds = useMemo(() => sorted.map((r) => r.id), [sorted])
  const selectedVisible = selection
    ? visibleIds.filter((id) => selection.selected.has(id)).length
    : 0
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible === visibleIds.length
  const toggleAllVisible = (on: boolean) => {
    if (!selection) return
    const next = new Set(selection.selected)
    for (const id of visibleIds) {
      if (on) next.add(id)
      else next.delete(id)
    }
    selectionAnchor.current = null
    selection.onChange(next)
  }
  const toggleRow = (id: string, on: boolean, shiftKey: boolean) => {
    if (!selection) return
    const next = new Set(selection.selected)
    const anchor = selectionAnchor.current
    const from = anchor ? visibleIds.indexOf(anchor) : -1
    const to = visibleIds.indexOf(id)
    if (shiftKey && from >= 0 && to >= 0) {
      const [a, b] = from < to ? [from, to] : [to, from]
      for (const rid of visibleIds.slice(a, b + 1)) {
        if (on) next.add(rid)
        else next.delete(rid)
      }
    } else if (on) next.add(id)
    else next.delete(id)
    selectionAnchor.current = id
    selection.onChange(next)
  }

  // 집계 범위 — 클라 모드는 전량을 들고 있으니 'all'. 서버 모드는 한 페이지만 보므로 'page'
  // (단 count 는 totalCount 가 있으면 전체로 답한다 — FooterCell 이 판단).
  const aggregationScope: AggregationScope = queryMode === 'server' ? 'page' : 'all'
  const rowEls = useRef<(HTMLTableRowElement | null)[]>([])
  const startRowDrag = (i: number) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const list: { dom: HTMLElement }[] = []
    for (let idx = 0; idx < sorted.length; idx++) {
      const el = rowEls.current[idx]
      if (!el) return
      list.push({ dom: el })
    }
    beginListReorder({
      items: list,
      fromIndex: i,
      startY: e.clientY,
      currentY: e.clientY,
      onCommit: (from, to) =>
        onReorder?.(
          reorderArray(
            sorted.map((r) => r.id),
            from,
            to,
          ),
        ),
    })
  }

  // multi_select 컬럼의 공용 후보값(노션식) — 모든 행의 값 + 정의 옵션을 합쳐 컬럼별 풀을 만든다.
  // 그래서 한 행에서 만든 태그를 다른 행에서도 후보로 고를 수 있다.
  const optionsByKey = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const col of columns) {
      if (col.type !== 'multi_select') continue
      const set = new Set<string>(normalizeOptions(col.options).map((o) => o.value))
      for (const r of rows) {
        const v = r.props[col.key]
        if (Array.isArray(v)) for (const x of v) set.add(String(x))
      }
      map[col.key] = [...set]
    }
    return map
  }, [columns, rows])

  // 행 높이(rowHeight) → DS Table density 매핑 + 셀 줄바꿈 플래그.
  // 미설정 = S = compact = 현행 동작(회귀 0 보장).
  const tableDensity = rowHeightToDensity(view.rowHeight)
  const wrapCells = view.wrapCells ?? false

  // 노션 데이터베이스 페이지 — 둥근 panel chrome 대신 flush 로 페이지에 그대로 흐르게.
  // 빈 상태에도 본문 placeholder 행을 N개 렌더해 테이블 셰이프(가로선)가 유지된다 — 노션처럼
  // "데이터베이스가 거기 있다" 는 형태감을 유지(헤더만 떠 있는 줄 처럼 보이지 않게).
  const EMPTY_PLACEHOLDER_ROWS = 3
  // 로딩·오류 — 행 대신 상태 블록(0행이 아니라 아직 모르는 것이라 빈 자리표시·footer 를 그리지 않는다).
  const blockingStatus = isBlockingStatus(status) ? status : null
  // 마지막 컬럼 1개는 숨길 수 없게 가드(노션 동일 — 모든 컬럼이 사라지면 표가 의미 없음).
  const allowHide = !!onColumnHide && columns.length > 1
  const colSpan = columns.length + leadCols + (onAddProperty ? 1 : 0)
  // 컬럼 폭 결정(노션식 fixed/fit/fill) — table-fixed 와 함께 사용해 콘텐츠가 컬럼을 밀어내지 않게 한다.
  // 그리드 그립(좌)과 + 컬럼(우)은 좁은 고정.
  const columnWidths = useMemo(() => resolveColumnWidths(columns), [columns])

  // 컬럼 헤더 DOM refs — 리사이즈 측정·리오더 드래그 양쪽에 쓴다.
  const colHeadEls = useRef<(HTMLTableCellElement | null)[]>([])
  // 본문 td refs (행 × 컬럼) — 컬럼 reorder 시 헤더와 함께 transform 동기화하기 위함.
  // tbody 요소 자체를 참조해서 column-index 별로 td 를 모아 처리(레퍼런스 다발 관리 부담↓).
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null)

  // 리사이즈 진행 중 임시 폭(낙관적 시각 갱신) — 드래그 중인 컬럼의 px override.
  const [resizingWidth, setResizingWidth] = useState<{ key: string; px: number } | null>(null)

  // 우측 엣지 드래그 → 컬럼 폭 변경. 콜백 미지정 시 핸들 자체가 렌더되지 않으므로 가드.
  // 60~800px 클램프(clampColumnWidth — 하한은 엔진 검증값 40 보다 넉넉히, 컬럼이 보이지 않을 만큼 작아지지 않게).
  const startColumnResize = (i: number) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onColumnResize) return
    const th = colHeadEls.current[i]
    if (!th) return
    const startWidth = th.getBoundingClientRect().width
    const startX = e.clientX
    const key = columns[i].key
    const prevCursor = document.body.style.cursor
    document.body.style.cursor = 'col-resize'
    const move = (ev: PointerEvent) => {
      setResizingWidth({ key, px: clampColumnWidth(startWidth + (ev.clientX - startX)) })
    }
    const finish = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      document.body.style.cursor = prevCursor
      setResizingWidth((prev) => {
        if (prev) onColumnResize(prev.key, prev.px)
        return null
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
  }

  // 좌측 ⠿ 그립 드래그 → 컬럼 가로 스왑(노션식). 헤더 + 본문 td 가 함께 transform 동기화돼 이동(extras).
  // 컬럼 도메인 인덱스 = `columns` 의 인덱스. 본문 td 인덱스는 reorderable 그립 컬럼이 있으면 +1 시프트.
  const startColumnReorder = (i: number) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!onColumnReorder) return
    const tbody = tbodyRef.current
    // tbody 의 각 행에서 *데이터 컬럼* 인덱스 idx 에 해당하는 td 를 모은다. 체크박스·grip 열만큼 보정.
    const bodyOffset = leadCols
    const collectColumnTds = (colIdx: number): HTMLElement[] => {
      if (!tbody) return []
      const result: HTMLElement[] = []
      // tbody.rows 는 데이터 행 + 빈 placeholder + create row 까지 포함. 모두 동기 이동(시각 일관).
      for (let r = 0; r < tbody.rows.length; r++) {
        const row = tbody.rows[r]
        // colSpan 으로 통째 셀(빈 행/create 행)은 단일 td → 컬럼 매핑 불가. 스킵.
        if (row.cells.length <= bodyOffset + colIdx) continue
        const cell = row.cells[bodyOffset + colIdx] as HTMLElement | undefined
        if (cell) result.push(cell)
      }
      return result
    }
    const list: { dom: HTMLElement; extras: HTMLElement[] }[] = []
    for (let idx = 0; idx < columns.length; idx++) {
      const el = colHeadEls.current[idx]
      if (!el) return
      list.push({ dom: el, extras: collectColumnTds(idx) })
    }
    beginListReorder({
      items: list,
      fromIndex: i,
      axis: 'x',
      startX: e.clientX,
      currentX: e.clientX,
      onCommit: (from, to) =>
        onColumnReorder(
          reorderArray(
            columns.map((c) => c.key),
            from,
            to,
          ),
        ),
    })
  }

  return (
    <Table chrome="flush" density={tableDensity} stickyHeader={stickyHeader}>
      <TableFrame layout="fixed">
        <colgroup>
          {selectable && <col style={{ width: `${SELECT_COL_PX}px` }} />}
          {reorderable && <col style={{ width: `${GRIP_COL_PX}px` }} />}
          {columnWidths.map((w, i) => {
            const key = columns[i].key
            // 리사이즈 진행 중인 컬럼은 임시 px 오버라이드(실시간 시각 피드백). 종료 시 onColumnResize 가 영속.
            const style =
              resizingWidth?.key === key ? { width: `${resizingWidth.px}px` } : widthToCss(w)
            return <col key={key} style={style} />
          })}
          {onAddProperty && <col style={{ width: '40px' }} />}
        </colgroup>
        {/*
         * stickyHeader: thead 전체를 세로 sticky 로 — z 는 본문 frozen 셀(z-[1..2]) 위.
         * border-collapse 표에서 sticky 셀의 border 는 같이 붙지 않는(브라우저 페인팅 한계) 탓에
         * 하단 1px 은 inset shadow 로 헤더에 직접 얹어 스크롤 중에도 경계선이 유지되게 한다.
         */}
        <TableHeader
          className={
            stickyHeader
              ? 'sticky top-0 z-[3] bg-background shadow-[inset_0_-1px_0_var(--color-border)]'
              : undefined
          }
        >
          {selection && (
            <TableHead
              scope="col"
              // 체크박스 열 sticky-left — 맨 앞. 머리 체크박스 = 지금 보이는 행 전체(부분이면 가운데 줄).
              className="sticky left-0 z-[2] bg-surface px-0 text-center"
              data-table-row-stop
            >
              <span className="flex items-center justify-center">
                <Checkbox
                  size="sm"
                  aria-label={copy.selectAllRowsAria}
                  checked={allVisibleSelected}
                  indeterminate={selectedVisible > 0 && !allVisibleSelected}
                  disabled={visibleIds.length === 0 || !!blockingStatus}
                  onCheckedChange={(on) => toggleAllVisible(on)}
                />
              </span>
            </TableHead>
          )}
          {reorderable && (
            <TableHead
              scope="col"
              // 그립 컬럼 sticky-left — 타이틀 sticky 와 함께 좌측 frozen 프리픽스를 이룬다.
              className="sticky z-[2] w-8 bg-surface"
              style={{ left: gripLeft }}
              aria-label={copy.moveRowAria}
            />
          )}
          {columns.map((c, i) => (
            <TableHead
              key={c.key}
              scope="col"
              ref={(el) => {
                colHeadEls.current[i] = el
              }}
              // 타이틀(첫 컬럼) sticky-left — 가로 스크롤 시 항상 보이게. 체크박스·그립 열이 있으면 그 뒤로 밀어 둠.
              style={i === 0 ? { left: titleLeft } : undefined}
              className={cn(
                'group/colhead relative',
                // 고정 컬럼은 **자기 배경**을 갖는다. thead 배경에만 기대면 stickyHeader 가 꺼진
                // 표에서 뒤 컬럼이 비쳐 보이고, 경계가 없어 어디까지가 고정인지 읽히지 않는다.
                // 배경은 다른 머리 칸과 같은 surface(TableHead 기본) — 첫 칸만 흰 칸이 되지 않게.
                i === 0 && cn('sticky z-[2]', 'bg-surface shadow-[1px_0_0_var(--color-border)]'),
              )}
            >
              <ColumnHeader
                def={c}
                sort={view.sort}
                // 상속 컬럼(프로토타입 Form 선언)은 일반 편집에선 잠금 표시 + 구조변경(타입·삭제) 비활성
                // (이름·정렬·숨김·순서는 자유). Form 편집 모드에선 잠금 해제 — Form 자체를 고치는 것이므로.
                locked={c.inherited === true && !formMode}
                inherited={c.inherited === true}
                onSortChange={isSortableType(c.type) ? onSortChange : undefined}
                onColumnHide={allowHide ? onColumnHide : undefined}
                onPickup={onColumnReorder ? startColumnReorder(i) : undefined}
                onRename={
                  onRenameColumn && (renameScope === 'all' || c.origin === 'base')
                    ? (label) => onRenameColumn(c.key, label)
                    : undefined
                }
                onChangeType={
                  onChangePropertyType && c.origin === 'base' && (!c.inherited || formMode)
                    ? (type) => onChangePropertyType(c.key, type)
                    : undefined
                }
                onDelete={
                  onDeleteProperty && c.origin === 'base' && (!c.inherited || formMode)
                    ? () => onDeleteProperty(c.key)
                    : undefined
                }
                onToggleInherited={
                  onToggleInherited && formMode && c.origin === 'base'
                    ? () => onToggleInherited(c.key)
                    : undefined
                }
                onOptionColorChange={
                  onOptionColorChange && isOptionColorEditable(c)
                    ? (value, color) => onOptionColorChange(c.key, value, color)
                    : undefined
                }
                toggles={columnToggles?.(c)}
                onConfigure={
                  onConfigureProperty &&
                  c.origin === 'base' &&
                  (c.type === 'struct' || c.type === 'number')
                    ? () => onConfigureProperty(c.key)
                    : undefined
                }
              />
              {/* 우측 엣지 드래그 핸들(노션식 col-resize) — hover 시 노출. 클릭 영역은 좁지만 호버 폭은 살짝 넓힘. */}
              {onColumnResize && (
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={copy.resizeColumnAria}
                  onPointerDown={startColumnResize(i)}
                  // 더블클릭 = 기본 폭으로(노션식). 끌지 않은 두 번의 클릭은 폭을 바꾸지 않는다(finish 가 prev 없음).
                  onDoubleClick={
                    onColumnResetWidth
                      ? (e) => {
                          e.stopPropagation()
                          onColumnResetWidth(c.key)
                        }
                      : undefined
                  }
                  className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none opacity-0 transition-opacity hover:bg-primary/40 group-hover/colhead:opacity-100"
                />
              )}
            </TableHead>
          ))}
          {onAddProperty && (
            <TableHead scope="col" className="w-10" aria-label={copy.addProperty}>
              <AddPropertyHeader
                onAddProperty={onAddProperty}
                peopleEnabled={peopleEnabled}
                structEnabled={structEnabled}
                relationTargets={
                  relationTargetOptions ??
                  (relations ? Object.keys(relations).map((k) => ({ value: k, label: k })) : [])
                }
              />
            </TableHead>
          )}
        </TableHeader>
        <TableBody ref={tbodyRef}>
          {blockingStatus && (
            <TableRow key="__status" rowId="__status">
              <TableCell colSpan={colSpan}>
                <CollectionStatusBlock status={blockingStatus} />
              </TableCell>
            </TableRow>
          )}
          {/*
           * 빈 상태에서만 시각적 placeholder 행(아래쪽). 데이터가 있으면 "+ {createLabel}" 행만 마지막에 항상 표시.
           * 노션 데이터베이스 동일 패턴 — 항상 마지막 행에 새 항목 생성 affordance 가 있다.
           */}
          {sorted.length === 0 && !blockingStatus
            ? Array.from({ length: EMPTY_PLACEHOLDER_ROWS - (onCreate ? 1 : 0) }, (_, i) => (
                <TableRow key={`__empty_${i}`} rowId={`__empty_${i}`}>
                  <TableCell colSpan={colSpan} aria-hidden className="h-9" />
                </TableRow>
              ))
            : null}
          {(blockingStatus ? [] : sorted).map((row, ri) => (
            // 직접 행 클릭 이동 제거(onActivate 미지정) — 이동은 제목 셀 호버 "열기" 버튼으로만(노션식).
            // group/row 로 호버 시 "열기" 버튼·그립을 드러낸다.
            <TableRow
              key={row.id}
              rowId={row.id}
              ref={
                reorderable
                  ? (el) => {
                      rowEls.current[ri] = el
                    }
                  : undefined
              }
              selected={selection?.selected.has(row.id)}
              className="group/row transition-colors hover:bg-surface/60 data-[selected]:bg-surface"
            >
              {selection && (
                <TableCell
                  data-table-row-stop
                  // 체크박스 열 sticky-left — 고른 행의 배경(surface)이 고정 열에도 이어지게.
                  className="sticky left-0 z-[1] bg-background px-0 align-middle group-hover/row:bg-surface/60 group-data-[selected]/row:bg-surface"
                >
                  <span className="flex items-center justify-center">
                    <Checkbox
                      size="sm"
                      aria-label={copy.selectRowAria}
                      checked={selection.selected.has(row.id)}
                      onClick={(e) => {
                        // Shift 는 change 이벤트에 실리지 않는다 — 클릭에서 읽어 범위로 처리한다.
                        e.stopPropagation()
                        toggleRow(row.id, e.currentTarget.checked, e.shiftKey)
                      }}
                    />
                  </span>
                </TableCell>
              )}
              {reorderable && (
                <TableCell
                  data-table-row-stop
                  // 그립 컬럼 sticky-left — 헤더와 짝을 이룬다. 호버 시 row 의 bg-surface/60 를 셀에도 적용해
                  // 가로 스크롤된 콘텐츠가 sticky 셀 아래로 비치지 않게(노션 DB 와 동일 효과).
                  className="sticky z-[1] w-8 bg-background align-middle group-hover/row:bg-surface/60 group-data-[selected]/row:bg-surface"
                  style={{ left: gripLeft }}
                >
                  <span
                    role="button"
                    aria-label={copy.moveRowAria}
                    onPointerDown={startRowDrag(ri)}
                    className="flex h-6 w-5 cursor-grab touch-none items-center justify-center rounded text-fg-muted opacity-0 transition-opacity hover:bg-surface hover:text-fg group-hover/row:opacity-100 active:cursor-grabbing"
                  >
                    ⠿
                  </span>
                </TableCell>
              )}
              {columns.map((c, ci) => {
                const editable = !!onEdit && c.source === 'frontmatter'
                // 첫 컬럼 = 제목(노션식): 읽기전용이고 열기 콜백이 있으면 링크형 제목 셀로 연다.
                const isTitle = ci === 0 && !editable && !!onOpen
                // 제목 인라인 편집 — pack.writeTitle 있고 onEditTitle 연결됐고 문서가 잠기지 않았을 때만.
                const titleEditable =
                  isTitle && !!pack.writeTitle && !!onEditTitle && !lockedById.get(row.id)
                // relation 컬럼이면 target(=대상 컬렉션 키/노드 id)을 한 번 좁혀 둔다 — provider 조회와 열기 콜백이 공유.
                const relationTarget =
                  c.type === 'relation' && c.relation ? c.relation.target : undefined
                // 조건부 서식(스프레드시트식) — 규칙은 행 전체에 대해 평가하되 서식은 이 컬럼에만.
                // sticky 첫 컬럼은 자체 bg 가 있어야 가로 스크롤 시 콘텐츠가 비치지 않는다 →
                // 서식 배경이 그 bg 를 이기도록 뒤에 붙인다(cn 병합 순서 = 뒤가 우선).
                const cellStyle = resolveCellFormat(view.conditionalFormats, c.key, row.props)
                const cellFormat = conditionalFormatClassName(cellStyle)
                return (
                  // 편집 셀은 셀 전체를 행 열기에서 제외(셀 어디를 눌러도 편집만, 행 이동 X).
                  // 컨트롤(input/button) 래퍼 여백 클릭이 행 네비게이션으로 새지 않게 td 에 stop 을 둔다.
                  // ci===0(타이틀): sticky-left — 헤더와 짝. 체크박스·그립 열 다음에 위치.
                  <TableCell
                    key={c.key}
                    style={ci === 0 ? { left: titleLeft } : undefined}
                    className={cn(
                      ci === 0 &&
                        cn(
                          'sticky z-[1]',
                          'bg-background group-hover/row:bg-surface/60 group-data-[selected]/row:bg-surface',
                          // 고정 컬럼의 오른쪽 경계 — 여기부터 표가 밀린다는 표시
                          'shadow-[1px_0_0_var(--color-border)]',
                        ),
                      cellFormat,
                    )}
                    {...(editable || titleEditable ? { 'data-table-row-stop': '' } : {})}
                  >
                    {isTitle ? (
                      <TitleCell
                        value={row.props[c.key] ?? null}
                        variant={titleVariant}
                        {...(c.render
                          ? {
                              render: () =>
                                c.render?.(row.props[c.key] ?? null, {
                                  id: row.id,
                                  props: row.props,
                                  def: c,
                                }),
                            }
                          : {})}
                        onOpen={(e) => onOpen(row.id, e)}
                        onRename={titleEditable ? (v) => onEditTitle(row.id, v) : undefined}
                        onDelete={onDeleteRow ? () => onDeleteRow(row.id) : undefined}
                      />
                    ) : (
                      <Cell
                        def={c}
                        value={row.props[c.key] ?? null}
                        renderContext={{
                          id: row.id,
                          props: row.props,
                          def: c,
                          schema: baseSchema,
                          ...(onEdit ? { edit: (k, v) => onEdit(row.id, k, v) } : {}),
                        }}
                        onChange={editable ? (v) => onEdit(row.id, c.key, v) : undefined}
                        options={optionsByKey[c.key]}
                        onOptionsChange={
                          onOptionsChange ? (opts) => onOptionsChange(c.key, opts) : undefined
                        }
                        relationProvider={
                          relationTarget !== undefined ? relations?.[relationTarget] : undefined
                        }
                        onOpenRelation={
                          onOpenRelation && relationTarget !== undefined
                            ? (id) => onOpenRelation(relationTarget, id)
                            : undefined
                        }
                        onAction={onAction ? (action) => onAction(row.id, action) : undefined}
                        wrapCells={wrapCells}
                        // 상태 색으로 칠한 칸이 비었으면 「—」 — 색만 있고 글자가 없으면 무엇이 빠졌는지 읽히지 않는다.
                        emptyMark={!!cellStyle?.tone && cellStyle.tone !== 'muted'}
                      />
                    )}
                  </TableCell>
                )
              })}
              {onAddProperty && <TableCell aria-hidden className="w-10" />}
            </TableRow>
          ))}
          {/*
           * "+ {createLabel}" — 항상 마지막 행(노션 DB 동일). 빈 상태/데이터 유무 무관. 클릭/Enter/Space 로 생성.
           * 컬럼 전체를 가로지르는 단일 셀(colSpan).
           */}
          {onCreate && !blockingStatus && (
            <TableRow key="__create" rowId="__create">
              <TableCell
                colSpan={colSpan}
                role="button"
                tabIndex={0}
                onClick={() => void onCreate()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    void onCreate()
                  }
                }}
                className="h-9 cursor-pointer text-fg-muted transition-colors hover:bg-surface/60 hover:text-fg"
              >
                {resolvedCreateLabel}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {/*
         * 컬럼 footer 집계(노션식) — view.aggregations[key] 가 있는 컬럼에 결과 표시.
         * onAggregationChange 가 있으면 셀이 메뉴 트리거가 되어 종류를 바꿀 수 있다(호버 시 '계산' 힌트).
         * 빈 상태에도 footer 가 보이게 항상 렌더 — 결과는 0 또는 빈 값.
         */}
        {!blockingStatus && (
          <tfoot>
            {/* 높이 40 · 칸 구분선 없음(시안 10-22) — 집계는 몇 칸에만 있어 세로선은 빈 칸을 나눌 뿐이다. */}
            <tr className="group/footer h-10 border-t border-border bg-surface/40">
              {selection && (
                <td aria-hidden className="sticky left-0 z-[1] bg-surface/40 px-0 py-0" />
              )}
              {reorderable && (
                <td
                  aria-hidden
                  className="sticky z-[1] w-8 bg-surface/40 px-2 py-0"
                  style={{ left: gripLeft }}
                />
              )}
              {columns.map((c, i) => {
                const aggType = view.aggregations?.[c.key] ?? 'none'
                const vals = sorted.map((r) => r.props[c.key])
                return (
                  <td
                    key={c.key}
                    style={i === 0 ? { left: titleLeft } : undefined}
                    className={cn(
                      'px-2 py-0 align-middle',
                      i === 0 && 'sticky z-[1] bg-surface/40',
                    )}
                  >
                    {/* 구조 속성은 자기 값이 없어 셀 것이 없다 — 칸의 밑 속성 컬럼에서 센다. */}
                    {c.type !== 'struct' && (
                      <FooterCell
                        values={vals}
                        type={aggType}
                        // 센 칸이 조건부 서식으로 칠해졌으면 숫자도 그 색(「빈 값 10」 = 주황 칸 열 개).
                        tone={aggregationTone(aggType, c.key, sorted, view.conditionalFormats)}
                        scope={aggregationScope}
                        totalCount={totalCount}
                        onChange={
                          onAggregationChange
                            ? (next) => onAggregationChange(c.key, next)
                            : undefined
                        }
                      />
                    )}
                  </td>
                )
              })}
              {onAddProperty && <td aria-hidden className="w-10" />}
            </tr>
          </tfoot>
        )}
      </TableFrame>
    </Table>
  )
}
