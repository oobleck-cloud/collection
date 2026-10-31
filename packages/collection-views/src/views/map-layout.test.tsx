// @vitest-environment jsdom
//
// @oobleck/collection — 'map' 레이아웃 활성화 회귀 핀(#36).
//
// 목적: 지도 뷰가 placeholder('준비 중')에서 활성 레이아웃으로 승격됐는지 구조 검증.
//   - VIEW_SURFACES.map 이 등록되고(kind/label/Renderer), PLANNED 에는 없다.
//   - view-layout-panel 의 PLACEHOLDER_LAYOUTS 에 'map' 이 더는 없다(준비중 카드 제거).
//   - CollectionView facade 가 view.type='map' 을 placeholder 폴백이 아니라 Renderer 로 디스패치.
//
// 전략: 무거운 형제 뷰 모듈을 전부 스텁해 레지스트리 메타만 노출 — CollectionView 의 import 트리(tiptap 등)를 끊는다.
//   @oobleck/systheme 는 아이콘 배럴만 필요(레지스트리 icon 필드) → 모든 접근을 더미 아이콘으로 응답하는 Proxy 스텁.

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// @oobleck/systheme — 레지스트리 아이콘(CollectionView) + 패널 컨트롤(view-layout-panel/group-panel) 명시 스텁.
vi.mock('@oobleck/systheme', () => {
  const makeIcon =
    (id: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${id}`, className })
  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')
  const Switch = () => React.createElement('button', { role: 'switch' })
  const Select = () => React.createElement('select')
  return {
    cn,
    Switch,
    Select,
    // CollectionView 레지스트리 아이콘.
    CalendarDays: makeIcon('calendar'),
    ClipboardList: makeIcon('clipboard'),
    LayoutDashboard: makeIcon('layout'),
    List: makeIcon('list'),
    Map: makeIcon('map'),
    MapPin: makeIcon('map-pin'),
    MessageSquare: makeIcon('message'),
    Monitor: makeIcon('monitor'),
    SlidersHorizontal: makeIcon('sliders'),
  }
})

// 형제 뷰 모듈 스텁 — 렌더러 본체는 무관(레지스트리 메타만 검증). 각 뷰가 끌어오는 무거운 의존을 끊는다.
// vi.mock 팩토리는 파일 최상단으로 호이스팅되므로 외부 헬퍼 참조 금지(인라인 작성).
vi.mock('./BoardView', () => ({ BoardView: () => React.createElement('div', null, 'BoardView') }))
vi.mock('./CalendarView', () => ({
  CalendarView: () => React.createElement('div', null, 'CalendarView'),
}))
vi.mock('./ChartView', () => ({ ChartView: () => React.createElement('div', null, 'ChartView') }))
vi.mock('./DashboardView', () => ({
  DashboardView: () => React.createElement('div', null, 'DashboardView'),
}))
vi.mock('./FeedView', () => ({ FeedView: () => React.createElement('div', null, 'FeedView') }))
vi.mock('./GalleryView', () => ({
  GalleryView: () => React.createElement('div', null, 'GalleryView'),
}))
vi.mock('./ListView', () => ({ ListView: () => React.createElement('div', null, 'ListView') }))
vi.mock('./TableView', () => ({ TableView: () => React.createElement('div', null, 'TableView') }))
vi.mock('./TimelineView', () => ({
  TimelineView: () => React.createElement('div', null, 'TimelineView'),
}))
vi.mock('./MapView', () => ({
  MapView: () => React.createElement('div', { 'data-testid': 'map-view-stub' }, 'MapView'),
}))

import type { ViewConfig } from '@oobleck/collection'
import { CollectionView, VIEW_SURFACES, PLANNED_VIEW_SURFACES } from './CollectionView'
import { LayoutPanel } from './view-layout-panel'

function makeView(partial: Partial<ViewConfig>): ViewConfig {
  return { type: 'map', filters: { op: 'and', children: [] }, sort: [], ...partial }
}

afterEach(cleanup)

describe("'map' 레이아웃 활성화", () => {
  it('VIEW_SURFACES.map 이 활성 등록(kind/label/Renderer), PLANNED 에는 없음', () => {
    expect(VIEW_SURFACES.map).toBeDefined()
    expect(VIEW_SURFACES.map?.kind).toBe('map')
    expect(VIEW_SURFACES.map?.label).toBe('지도')
    expect(VIEW_SURFACES.map?.Renderer).toBeDefined()
    expect(PLANNED_VIEW_SURFACES.map).toBeUndefined()
  })

  it("CollectionView facade 가 view.type='map' 을 MapView 로 디스패치(placeholder 폴백 아님)", () => {
    const pack = {
      propertySchema: [],
      readProperties: () => ({}),
      writeProperty: (d: unknown) => d,
    }
    // @ts-expect-error — 최소 pack 스텁(테스트용).
    render(<CollectionView records={[]} pack={pack} view={makeView({})} />)
    expect(screen.getByTestId('map-view-stub')).toBeDefined()
    expect(screen.queryByText(/준비 중/)).toBeNull()
  })

  it('LayoutPanel 그리드에 활성 "지도" 카드가 있고, "준비 중" 비활성 표기가 아니다', () => {
    render(<LayoutPanel view={makeView({})} schema={[]} onViewChange={() => {}} />)
    const card = screen.getByRole('button', { name: '지도' })
    // 활성 카드는 aria-disabled 없이 선택 가능(준비중 카드는 aria-label 에 "(준비 중)" 이 붙는다).
    expect(card.getAttribute('aria-label')).toBe('지도')
    expect(card.hasAttribute('disabled')).toBe(false)
  })
})
