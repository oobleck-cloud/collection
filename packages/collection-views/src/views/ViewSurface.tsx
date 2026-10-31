'use client'

import type { FC } from 'react'
import type { LucideIcon } from '@oobleck/systheme'
import type { QueryMode } from '@oobleck/collection'
import type { TitleVariant } from './TableView'
import type {
  AggregationType,
  BasePropertyDef,
  BasePropertyType,
  BlockPack,
  PropertyDef,
  PropertyValue,
  RelationProvider,
  RelationTargetOption,
  SelectOption,
  Sort,
  TableRecord,
  ViewConfig,
  ViewType,
} from '@oobleck/collection'
import type { CollectionLocale } from '../i18n'

// @oobleck/collection — 뷰 surface 공유 계약 + facade(D-8, WAVE0/F4).
//
// 목적: table/board/gallery/list/timeline 등 모든 뷰를 *같은 props 계약*(ViewSurfaceProps)을 구현하는
// 형제 컴포넌트로 만들고, facade(CollectionView)가 view.type 으로 레지스트리에서 렌더러를 디스패치한다.
// 이후 새 뷰는 "파일 하나 + 레지스트리 엔트리 1개"만 추가하면 붙는다(엔진/소비처 변경 없음).
//
// 이번 단계는 *계약과 골격*만 만든다 — 기존 TableView/BoardView 내부는 재작성하지 않고 thin adapter 로 감싼다.

/**
 * 모든 뷰 surface 가 받는 공통 props 계약(상위집합). 현존 TableView/BoardView 가 실제 받는 props 의
 * 최소 합집합 + 신규 뷰용 예약 채널(onViewChange) — 과설계 금지(여기 없는 prop 이 필요하면 그 뷰만의
 * 확장이 아니라 이 계약에 추가).
 * 대부분 optional: 뷰는 자신이 지원하는 affordance(supports)에 해당하는 콜백만 소비한다.
 *
 * 타입 파라미터 P = 블록팩이 정의하는 속성 형태(BlockPack<P>). 셀 값은 PropertyValue 로 다룬다.
 */
export type ViewSurfaceProps<P = unknown> = {
  /** 표시 로캘(앱 크롬 로캘 주입). 미지정 시 CollectionView 가 ko 로 폴백. 뷰는 useCollectionLocale() 로 읽는다. */
  locale?: CollectionLocale
  /** 정본 레코드(id + BlockDocument). 뷰가 pack.readProperties 로 속성 행을 만든다. */
  records: TableRecord[]
  /** 도메인 무관 projection 계약. 뷰는 이것만 알면 어떤 블록팩 문서든 렌더한다. */
  pack: BlockPack<P>
  /** 현재 뷰 설정(정규화된 filters: FilterGroup, sort, groupBy, type 등). */
  view: ViewConfig
  /** 컬럼 정의 오버라이드(옵션·라벨·잠금·폭). 미지정 시 pack.propertySchema. */
  schema?: PropertyDef[]
  /**
   * 행/카드 열기(상세 이동).
   *
   * 두 번째 인자는 원본 클릭 이벤트다 — 호스트가 ⌘/Ctrl/Shift+클릭을 "새 탭에서 열기"로
   * 해석할 수 있게 넘긴다(MVOS 워크스페이스 탭). 표 뷰만 전달하고, 그 외 서피스는 아직
   * 미전달이라 optional 이다.
   */
  onOpen?: (id: string, event?: import('react').MouseEvent) => void
  /**
   * 행(=노션 페이지) 삭제 — (id). 지정 시 표 뷰가 제목 셀 hover 케밥에 "삭제"(→ 휴지통)를 노출한다.
   * 소프트 삭제이며 실제 fetch·확인·토스트·복원은 호스트(useWorkspaceRecords)가 소유(순수 콜백). 미지정 시 미노출.
   */
  onDeleteRow?: (id: string) => void
  /**
   * 버튼 프로퍼티(type='button') 클릭 — (rowId, action). 값(ButtonValue)은 라벨·variant 만 담는
   * 순수 데이터고, 실행은 호스트가 이 콜백으로 수행한다(휴지통 복원, 팩 설치/해제 등). 미지정 시 버튼 비활성.
   */
  onAction?: (id: string, action: string) => void
  /**
   * 뷰 설정 부분 갱신 — surface 가 자체적으로 sort/filter/groupBy 등을 바꿀 때(상위가 영속).
   * 현 TableView/BoardView 는 아래 granular 콜백을 쓰지만, 신규 뷰는 이 통합 채널을 쓸 수 있다.
   */
  onViewChange?: (next: Partial<ViewConfig>) => void
  /** frontmatter 셀/그룹값 편집 — (id, key, value). 상위가 pack.writeProperty 로 역기록. */
  onEditCell?: (id: string, key: string, value: PropertyValue) => void
  /** 제목(첫 컬럼) 인라인 편집 — (id, value). pack.writeTitle 로 역기록. */
  onEditTitle?: (id: string, value: string) => void
  /** 레코드 수동 재정렬(표/리스트 드래그) — 표시 순서대로의 id 배열. */
  onReorder?: (orderedIds: string[]) => void
  /** 카드 수동 정렬 영속(board/gallery) — (groupKey, orderedIds). */
  onCardOrderChange?: (groupKey: string, orderedIds: string[]) => void
  /** 신규 항목 생성(빈 상태/컬럼 푸터). */
  onCreate?: () => void | Promise<void>
  /** onCreate 트리거 라벨(도메인별 "+ 새 상품" 등). */
  createLabel?: string
  /** 정렬 변경(헤더 메뉴) — 적용할 정렬 배열 전체. */
  onSortChange?: (sort: Sort[]) => void
  /** 컬럼 숨김 — view.visibleProps 에서 제거. */
  onColumnHide?: (key: string) => void
  /** 동적 베이스 컬럼 추가. */
  onAddProperty?: (def: BasePropertyDef) => void
  /** 컬럼 폭 변경(드래그 리사이즈) — (key, px). */
  onColumnResize?: (key: string, px: number) => void
  /** 컬럼 순서 변경 — 표시 순서대로의 키 배열. */
  onColumnReorder?: (orderedKeys: string[]) => void
  /** 컬럼 이름 변경 — (key, label). */
  onRenameColumn?: (key: string, label: string) => void
  /** select/multi 옵션 정의 변경 — (key, options). */
  onOptionsChange?: (key: string, options: SelectOption[]) => void
  /** 선택지 색 변경(헤더 메뉴) — (key, value, color). `colorEditable` 컬럼에만 열린다. 색 undefined = 기본. */
  onOptionColorChange?: (key: string, value: string, color: string | undefined) => void
  /** 이름 변경 허용 범위 — 자세한 계약은 TableView 의 동명 prop. 미지정 = 'all'(현행). */
  renameScope?: 'all' | 'base'
  /** 컬럼 footer 집계 변경 — (key, type). */
  onAggregationChange?: (key: string, type: AggregationType) => void
  /** 관계 자동완성 공급자 레지스트리(컬렉션 키 → provider). */
  relations?: Record<string, RelationProvider>
  /**
   * relation 컬럼 추가 시 "연결 대상" 후보(value=target, label=표시명). 미지정 시 relations 키를 value=label 로 폴백.
   * 워크스페이스처럼 target(노드 id)과 표시명(DB 이름)이 다를 때 라벨을 분리 제공하는 가산 채널(상품은 미전달 → 현행 동작).
   */
  relationTargetOptions?: RelationTargetOption[]
  /**
   * relation 셀의 연결 대상 열기 — (target, id). 지정 시 셀 칩에 "열기" affordance 가 켜진다(노션식 링크).
   * 미지정 시(상품 등) 칩은 편집만(현행 동작 불변). 워크스페이스는 연결된 인스턴스 행 페이지로 이동한다.
   */
  onOpenRelation?: (target: string, id: string) => void
  /** base 컬럼 타입 변경 — (key, newType). */
  onChangePropertyType?: (key: string, type: BasePropertyType) => void
  /** base 컬럼 삭제 — (key). */
  onDeleteProperty?: (key: string) => void
  /**
   * (플라톤) 프로토타입(Form) 편집 모드 — true 면 상속 컬럼이 잠금 표시 대신 *편집 가능*이 되고, 컬럼
   * 메뉴에 "상속(Form) 지정/해제"가 노출된다. 미지정/false=일반 편집(상속 컬럼은 🔒·구조변경 차단).
   */
  formMode?: boolean
  /** base 컬럼의 상속(inherited) 플래그 토글 — Form 모드에서만 노출. (key). */
  onToggleInherited?: (key: string) => void
  /**
   * 쿼리 실행 주체(headless.ts). 미지정='client' — 뷰가 records 전량에 filter/sort 를 적용(현행).
   * 'server' 면 이미 해소된 행이 온 것으로 보고 재적용하지 않는다(서버 페이지네이션 목록).
   * table·chart·dashboard surface 가 해석한다 — 나머지는 무시(전량 전제).
   */
  /**
   * 제목(첫) 컬럼의 성격 — 'page'(노션 문서 행) | 'plain'(도메인 목록: 아이콘 없음, 제목이 링크).
   * 미지정 = 'page'. 현재 table surface 만 해석한다.
   */
  titleVariant?: TitleVariant
  queryMode?: QueryMode
  /**
   * 필터 적용 후·페이지 적용 전 전체 행 수. 'server' 모드의 집계가 전체 기준으로 답할 수 있게 한다.
   * 개수는 이 값으로 참이 되지만 **분포는 아니다** — 한 페이지의 값만 들고 있으므로
   * chart·dashboard 는 분포에 모수를 밝힌다.
   */
  totalCount?: number
  /**
   * 컬럼 헤더를 세로 sticky 로 — 스크롤해도 헤더 행이 상단에 남는다. 현재 table surface 만 해석.
   * 전제: 가로·세로 스크롤을 모두 소유하는 overflow-auto 조상 안에서 렌더될 것(TableView 참조).
   */
  stickyHeader?: boolean
}

/**
 * 뷰가 지원하는 affordance 플래그 — 툴바/facade 가 어떤 컨트롤을 노출할지 결정(선언적).
 *  - group: groupBy 지원(board/gallery). - cover: 카드 커버 이미지. - cardSize: 카드 크기 옵션.
 *  - dateAxis: 날짜 축(timeline). 미지정 = 미지원.
 */
export type ViewSurfaceSupports = {
  group?: boolean
  cover?: boolean
  cardSize?: boolean
  dateAxis?: boolean
}

/**
 * 레지스트리 엔트리(확장 지점) — 한 뷰 surface 의 메타 + 렌더러.
 * 새 뷰 추가 절차(3줄):
 *   1) GalleryView.tsx 등에서 `const GalleryView: FC<ViewSurfaceProps> = (props) => {...}` 작성.
 *   2) 이 파일의 VIEW_SURFACES 에 `gallery: { kind:'gallery', label:'갤러리', icon, supports, Renderer: GalleryView }` 추가.
 *   3) 끝 — CollectionView facade 가 view.type='gallery' 를 자동 디스패치.
 */
export type ViewSurfaceDef = {
  kind: ViewType
  label: string
  icon: LucideIcon
  supports: ViewSurfaceSupports
  Renderer: FC<ViewSurfaceProps>
}
