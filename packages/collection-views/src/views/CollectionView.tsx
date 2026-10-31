'use client'

import type { FC } from 'react'
import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  List,
  Map,
  MapPin,
  MessageSquare,
  Monitor,
  SlidersHorizontal,
} from '@oobleck/systheme'
import type { ViewType } from '@oobleck/collection'
import { normalizeViewType } from '@oobleck/collection'
import { BoardView } from './BoardView'
import { CalendarView } from './CalendarView'
import { ChartView } from './ChartView'
import { DashboardView } from './DashboardView'
import { FeedView } from './FeedView'
import { GalleryView } from './GalleryView'
import { ListView } from './ListView'
import { MapView } from './MapView'
import { TableView } from './TableView'
import { TimelineView } from './TimelineView'
import type { ViewSurfaceDef, ViewSurfaceProps } from './ViewSurface'
import { CollectionLocaleProvider, resolveCollectionLocale, viewTypeLabel } from '../i18n'
import { collectionViewCopy } from './CollectionView.messages'
import { CollectionStatusBlock, isBlockingStatus } from './CollectionStatus'

export type { CollectionViewStatus } from './CollectionStatus'

// @oobleck/collection — 뷰 facade + 레지스트리(D-8, WAVE0/F4).
//
// CollectionView 는 view.type 으로 VIEW_SURFACES 레지스트리에서 Renderer 를 골라 렌더한다.
// 기존 TableView/BoardView 는 ViewSurfaceProps 계약에 맞춘 thin adapter 로 감싸 등록한다(내부 재작성 없음).
// gallery/list/timeline 은 자리만 잡고(미등록) facade 가 placeholder 로 폴백 — W1 가 파일+엔트리로 채운다.

// ─── thin adapters: ViewSurfaceProps → 기존 컴포넌트 props ──────────────────────

/** TableView adapter — ViewSurfaceProps 의 onEditCell → TableView.onEdit 등 1:1 매핑. */
const TableSurface: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  onOpen,
  onAction,
  onEditCell,
  onEditTitle,
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
  renameScope,
  onOptionsChange,
  onOptionColorChange,
  onAggregationChange,
  relations,
  relationTargetOptions,
  peopleEnabled,
  onOpenRelation,
  onChangePropertyType,
  onDeleteProperty,
  onConfigureProperty,
  structEnabled,
  onDeleteRow,
  formMode,
  onToggleInherited,
  columnToggles,
  titleVariant,
  queryMode,
  totalCount,
  stickyHeader,
  status,
  selection,
}) => (
  <TableView
    records={records}
    pack={pack}
    view={view}
    schema={schema}
    onOpen={onOpen}
    onAction={onAction}
    onEdit={onEditCell}
    onEditTitle={onEditTitle}
    onReorder={onReorder}
    onCreate={onCreate}
    {...(createLabel !== undefined ? { createLabel } : {})}
    onSortChange={onSortChange}
    onColumnHide={onColumnHide}
    onAddProperty={onAddProperty}
    onColumnResize={onColumnResize}
    onColumnResetWidth={onColumnResetWidth}
    onColumnReorder={onColumnReorder}
    onRenameColumn={onRenameColumn}
    renameScope={renameScope}
    onOptionsChange={onOptionsChange}
    onOptionColorChange={onOptionColorChange}
    onAggregationChange={onAggregationChange}
    relations={relations}
    relationTargetOptions={relationTargetOptions}
    peopleEnabled={peopleEnabled}
    onOpenRelation={onOpenRelation}
    onChangePropertyType={onChangePropertyType}
    onDeleteProperty={onDeleteProperty}
    onConfigureProperty={onConfigureProperty}
    structEnabled={structEnabled}
    onDeleteRow={onDeleteRow}
    formMode={formMode}
    onToggleInherited={onToggleInherited}
    columnToggles={columnToggles}
    titleVariant={titleVariant}
    queryMode={queryMode}
    totalCount={totalCount}
    stickyHeader={stickyHeader}
    status={status}
    selection={selection}
  />
)

/** BoardView adapter — onEditCell → BoardView.onEdit. group/cover/cardOrder/cardSize/관계 표(relations)를 소비. */
const BoardSurface: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  onOpen,
  onDeleteRow,
  onEditCell,
  onCreate,
  onCardOrderChange,
  relations,
  queryMode,
}) => (
  <BoardView
    records={records}
    pack={pack}
    view={view}
    schema={schema}
    onOpen={onOpen}
    onDeleteRow={onDeleteRow}
    onEdit={onEditCell}
    onCreate={onCreate}
    onCardOrderChange={onCardOrderChange}
    relations={relations}
    queryMode={queryMode}
  />
)

/** GalleryView adapter — 카드 그리드. group/cover/cardSize 를 view 에서 소비. */
const GallerySurface: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  onOpen,
  onDeleteRow,
  onCreate,
  createLabel,
}) => (
  <GalleryView
    records={records}
    pack={pack}
    view={view}
    schema={schema}
    onOpen={onOpen}
    onDeleteRow={onDeleteRow}
    onCreate={onCreate}
    createLabel={createLabel}
  />
)

/** ListView adapter — 미니멀 행 목록(컬럼 헤더 없음). group·onAction(버튼 프로퍼티)을 소비. */
const ListSurface: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  onOpen,
  onAction,
  onDeleteRow,
  onCreate,
  createLabel,
}) => (
  <ListView
    records={records}
    pack={pack}
    view={view}
    schema={schema}
    onOpen={onOpen}
    onAction={onAction}
    onDeleteRow={onDeleteRow}
    onCreate={onCreate}
    createLabel={createLabel}
  />
)

/** TimelineView adapter — 날짜 속성 기반 가로 막대 타임라인(도메인 무관). dateAxis 소비. */
const TimelineSurface: FC<ViewSurfaceProps> = ({ records, pack, view, schema, onOpen }) => (
  <TimelineView records={records} pack={pack} view={view} schema={schema} onOpen={onOpen} />
)

/** CalendarView adapter — 날짜 속성(자동 선택) 기준 월 그리드. viewRows(필터·정렬)만 소비. */
const CalendarSurface: FC<ViewSurfaceProps> = ({ records, pack, view, schema, onOpen }) => (
  <CalendarView records={records} pack={pack} view={view} schema={schema} onOpen={onOpen} />
)

/** FeedView adapter — 단일 열 시간순 카드 스트림(평탄). group 미소비(피드는 그룹 없음). */
const FeedSurface: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  onOpen,
  onCreate,
  createLabel,
}) => (
  <FeedView
    records={records}
    pack={pack}
    view={view}
    schema={schema}
    onOpen={onOpen}
    onCreate={onCreate}
    createLabel={createLabel}
  />
)

/** ChartView adapter — groupBy 기준 분포 막대. group 을 view 에서 소비(읽기 전용 집계). */
const ChartSurface: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  queryMode,
  totalCount,
}) => (
  <ChartView
    records={records}
    pack={pack}
    view={view}
    schema={schema}
    queryMode={queryMode}
    totalCount={totalCount}
  />
)

/**
 * DashboardView adapter — 스키마 파생 자동 지표 요약(읽기 전용). 설정 없음(supports:{}).
 * queryMode·totalCount 를 넘긴다 — 서버가 페이지를 잘라 보내는 목록에서 분포가 전체인 척하지 않게.
 */
const DashboardSurface: FC<ViewSurfaceProps> = ({
  records,
  pack,
  view,
  schema,
  queryMode,
  totalCount,
}) => (
  <DashboardView
    records={records}
    pack={pack}
    view={view}
    schema={schema}
    queryMode={queryMode}
    totalCount={totalCount}
  />
)

/** MapView adapter — geo 속성 기준 지도 핀. 설정 없음(supports:{}) — viewRows·스키마·onOpen 만 소비. */
const MapSurface: FC<ViewSurfaceProps> = ({ records, pack, view, schema, onOpen }) => (
  <MapView records={records} pack={pack} view={view} schema={schema} onOpen={onOpen} />
)

// ─── 레지스트리 ──────────────────────────────────────────────────────────────────

/**
 * 뷰 surface 레지스트리 — view.type → 정의. table/board/gallery/list 등록.
 * timeline 은 미등록(자리 예약) — facade 가 placeholder 로 폴백한다.
 * 새 뷰 추가: 여기에 엔트리 1개를 더하면 끝(facade·소비처 변경 불필요).
 */
export const VIEW_SURFACES: Partial<Record<ViewType, ViewSurfaceDef>> = {
  table: {
    kind: 'table',
    label: '표',
    icon: ClipboardList,
    supports: {},
    Renderer: TableSurface,
  },
  board: {
    kind: 'board',
    label: '보드',
    icon: LayoutDashboard,
    // cardSize — 보드는 열 폭이 카드 폭(S/M/L). relationTable — 카드 아래 관계 표(레이아웃 패널에서 고른다).
    // collapseEmptyGroups — 카드 없는 열을 좁은 띠로.
    supports: {
      group: true,
      cover: true,
      cardSize: true,
      relationTable: true,
      collapseEmptyGroups: true,
    },
    Renderer: BoardSurface,
  },
  gallery: {
    kind: 'gallery',
    label: '갤러리',
    icon: Map,
    supports: { group: true, cover: true, cardSize: true },
    Renderer: GallerySurface,
  },
  list: {
    kind: 'list',
    label: '리스트',
    icon: List,
    supports: { group: true },
    Renderer: ListSurface,
  },
  timeline: {
    kind: 'timeline',
    label: '타임라인',
    icon: CalendarDays,
    // dateAxis 만 지원 — TimelineView 는 viewRows(필터·정렬)만 소비하고 그룹 스윔레인은 미구현.
    // group 슬롯을 노출하면 무동작(죽은 컨트롤)이므로 선언하지 않는다(S1).
    supports: { dateAxis: true },
    Renderer: TimelineSurface,
  },
  calendar: {
    kind: 'calendar',
    label: '캘린더',
    icon: CalendarDays,
    // 날짜 키를 스키마에서 자동 선택하므로 dateAxis 컨트롤 불필요. group/cover/cardSize 도 미사용 →
    // supports 비움(죽은 컨트롤 노출 방지, S1).
    supports: {},
    Renderer: CalendarSurface,
  },
  feed: {
    kind: 'feed',
    label: '피드',
    icon: MessageSquare,
    // 평탄 스트림 — groupBy/cover/cardSize 컨트롤을 노출하지 않는다(피드는 단일 열 시간순). 죽은 컨트롤 방지(S1).
    supports: {},
    Renderer: FeedSurface,
  },
  chart: {
    kind: 'chart',
    label: '차트',
    // 가로 막대 = horizontal sliders 글리프(@oobleck/systheme 제공 lucide). 신규 의존 없음.
    icon: SlidersHorizontal,
    // group 만 지원 — ChartView 는 view.groupBy 기준으로 분포를 집계한다(레이아웃 패널에 GroupPanel 노출).
    supports: { group: true },
    Renderer: ChartSurface,
  },
  dashboard: {
    kind: 'dashboard',
    label: '대시보드',
    // 지표 모니터 글리프(@oobleck/systheme 제공 lucide Monitor — 활성 뷰가 쓰지 않는 아이콘). 신규 의존 없음.
    icon: Monitor,
    // 스키마에서 분포 축을 자동 도출하는 읽기 전용 요약 — groupBy/cover/cardSize 등 설정 컨트롤이 없다.
    // supports 비움(죽은 컨트롤 노출 방지, S1). 설정 가능한 위젯 캔버스는 v1 범위 밖.
    supports: {},
    Renderer: DashboardSurface,
  },
  map: {
    kind: 'map',
    label: '지도',
    // 위치 핀 글리프(@oobleck/systheme 제공 lucide MapPin — 활성 뷰가 쓰지 않는 아이콘). gallery 의 Map(지도틀)과 구분.
    icon: MapPin,
    // geo 속성(스키마 첫 geo)을 자동 선택하므로 축 설정 컨트롤이 없다. groupBy/cover/cardSize 도 미사용 →
    // supports 비움(죽은 컨트롤 노출 방지, S1).
    supports: {},
    Renderer: MapSurface,
  },
}

/** 아직 렌더러가 없는(예약된) 뷰 종류의 메타 — 툴바가 "준비 중"으로 노출할 수 있게. */
export const PLANNED_VIEW_SURFACES: Partial<Record<ViewType, Omit<ViewSurfaceDef, 'Renderer'>>> = {
  // timeline 이 VIEW_SURFACES 로 승격됨(WAVE3/레인2). 이 목록에서 제거.
}

// ─── facade ──────────────────────────────────────────────────────────────────────

/**
 * 컬렉션 뷰 facade — view.type(레거시 'grid' 는 정규화)으로 레지스트리에서 Renderer 를 골라 렌더한다.
 * 미등록 뷰 종류면 명확한 "준비 중" placeholder 로 폴백(앱이 깨지지 않게).
 */
export function CollectionView<P>(props: ViewSurfaceProps<P>) {
  const locale = resolveCollectionLocale(props.locale)
  const c = collectionViewCopy(locale)
  const kind = normalizeViewType(props.view.type)
  const def = VIEW_SURFACES[kind]
  // 로딩·오류 — 표는 컬럼 머리를 남기고 행 자리에 그린다(TableView.status). 다른 뷰는 본문 대신 상태 블록.
  const blocking = isBlockingStatus(props.status) && kind !== 'table' ? props.status : null
  // 하위 뷰가 useCollectionLocale() 로 로캘을 읽도록 프로바이더로 감싼다(prop drilling 없이 로캘만 흘림).
  return (
    <CollectionLocaleProvider locale={locale}>
      {blocking ? (
        <CollectionStatusBlock status={blocking} />
      ) : def ? (
        // Renderer 는 ViewSurfaceProps(비제네릭) — P 는 BlockPack<P> 로 좁혀 들어가므로 호출부 호환.
        <def.Renderer {...props} />
      ) : (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
          {PLANNED_VIEW_SURFACES[kind]
            ? c.viewPreparing(viewTypeLabel(kind, locale))
            : c.unknownView(String(kind))}
        </div>
      )}
    </CollectionLocaleProvider>
  )
}
