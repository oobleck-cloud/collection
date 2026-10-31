// @vitest-environment jsdom
// ViewToolbar 렌더 증명 — 노션식 "아이콘 행 + ⋯ 허브"가 실제로 DOM에 그려지는지 검증한다.
// (W1/레인B 의 IA 허브가 코드뿐 아니라 렌더까지 됨을 자동으로 고정.)
//
// surface 스위처가 ./CollectionView 의 레지스트리(전 뷰 트리 import)를 끌어오므로 그걸 stub 하고,
// @oobleck/systheme 는 경량 mock(Popover/Menu 는 trigger+children 를 그대로 렌더)으로 대체한다.
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// 레지스트리 stub — LayoutPanel 그리드가 읽는 메타만(전 뷰 렌더러 import 회피).
// 실제 레지스트리와 동일 정렬: gallery/list/timeline 은 활성(VIEW_SURFACES)이다.
vi.mock('./CollectionView', () => ({
  VIEW_SURFACES: {
    table: { kind: 'table', label: '표', icon: () => null, supports: {} },
    board: {
      kind: 'board',
      label: '보드',
      icon: () => null,
      supports: { group: true, cover: true },
    },
    gallery: {
      kind: 'gallery',
      label: '갤러리',
      icon: () => null,
      supports: { group: true, cover: true, cardSize: true },
    },
  },
  PLANNED_VIEW_SURFACES: {},
}))

vi.mock('@oobleck/systheme', () => {
  const icon =
    (id: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${id}`, className })
  // Popover/Menu: 렌더-프롭 트리거 + children 을 그대로 노출(테스트가 패널 내용까지 본다).
  const Popover = ({
    trigger,
    children,
  }: {
    trigger?: (p: { onClick: () => void; 'aria-expanded': boolean }) => React.ReactNode
    children?: React.ReactNode
  }) =>
    React.createElement(
      'div',
      null,
      trigger ? trigger({ onClick: () => {}, 'aria-expanded': false }) : null,
      children,
    )
  // Menu: 트리거 + **항목까지** 렌더(항목을 버튼으로 펴고 onSelect 배선) — 생성 드롭다운(createMenu)의
  // 선택 동작을 검증하려면 목이 items 를 그려야 한다. items 미지정이면 기존과 동일(트리거만).
  const Menu = ({
    trigger,
    items,
    onSelect,
  }: {
    trigger?: (p: { onClick: () => void; 'aria-expanded': boolean }) => React.ReactNode
    items?: { id: string; label: string; disabled?: boolean }[]
    onSelect?: (id: string) => void
  }) =>
    React.createElement(
      'div',
      null,
      trigger ? trigger({ onClick: () => {}, 'aria-expanded': false }) : null,
      (items ?? []).map((it) =>
        React.createElement(
          'button',
          { key: it.id, type: 'button', disabled: it.disabled, onClick: () => onSelect?.(it.id) },
          it.label,
        ),
      ),
    )
  const Input = ({
    value,
    onValueChange,
    placeholder,
  }: {
    value?: string
    onValueChange?: (v: string) => void
    placeholder?: string
  }) =>
    React.createElement('input', {
      value: value ?? '',
      placeholder,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => onValueChange?.(e.target.value),
    })
  const Select = ({
    value,
    onChange,
    options,
  }: {
    value?: string
    onChange?: (v: string) => void
    options: { value: string; label: string }[]
  }) =>
    React.createElement(
      'select',
      { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value) },
      (options ?? []).map((o) =>
        React.createElement('option', { key: o.value, value: o.value }, o.label),
      ),
    )
  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')
  // Tooltip: children 그대로 렌더(툴팁 패널은 테스트에서 검증 불필요)
  const Tooltip = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  const Switch = ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean
    onCheckedChange?: (v: boolean) => void
  }) =>
    React.createElement('button', {
      role: 'switch',
      'aria-checked': !!checked,
      onClick: () => onCheckedChange?.(!checked),
    })
  return {
    Popover,
    Menu,
    Input,
    Select,
    Switch,
    Tooltip,
    cn,
    ArrowDown: icon('arrow-down'),
    ArrowUp: icon('arrow-up'),
    Plus: icon('plus'),
    Search: icon('search'),
    SlidersHorizontal: icon('sliders'),
    X: icon('x'),
    MoreHorizontal: icon('more'),
  }
})

import { ViewToolbar } from './ViewToolbar'
import type { PropertyDef, ViewConfig } from '@oobleck/collection'

const schema: PropertyDef[] = [
  { key: 'name', label: '이름', type: 'text', source: 'projection', origin: 'preset' },
  {
    key: 'status',
    label: '상태',
    type: 'select',
    source: 'frontmatter',
    origin: 'preset',
    options: ['draft'],
  },
]

const view: ViewConfig = { type: 'table', filters: { op: 'and', children: [] }, sort: [] }

function renderToolbar(extra?: Partial<React.ComponentProps<typeof ViewToolbar>>) {
  return render(
    React.createElement(ViewToolbar, {
      schema,
      view,
      onViewChange: () => {},
      onSearchChange: () => {},
      onCreate: () => {},
      createLabel: '새로 만들기',
      hubSlots: [{ id: 'props', label: '프로퍼티', icon: (() => null) as never }],
      ...extra,
    }),
  )
}

describe('ViewToolbar — 노션식 아이콘 행 + ⋯ 허브 렌더', () => {
  it('레이아웃은 툴바 단독 아이콘 버튼으로 직접 접근 — 라벨텍스트 없이 aria-label 만(레이블 없음)', () => {
    renderToolbar()
    // 레이아웃 버튼이 툴바에 직접 노출(아이콘만, 텍스트 라벨 없음)
    expect(screen.getByLabelText('레이아웃')).toBeDefined()
    expect(screen.queryByText('레이아웃')).toBeNull() // 텍스트 라벨은 없어야 함
    // Popover 콘텐츠가 DOM 에 있으면 레이아웃 카드(표/보드/갤러리)도 접근 가능
    expect(screen.getByLabelText('표')).toBeDefined()
    expect(screen.getByLabelText('보드')).toBeDefined()
    expect(screen.getByLabelText('갤러리')).toBeDefined()
    // 차트는 placeholder 에서 활성 레이아웃(VIEW_SURFACES)으로 승격됨 — 이 stub 레지스트리엔 미포함이라
    // 더는 '준비 중' placeholder 로 그려지지 않는다(실 레지스트리 검증은 CollectionView/ChartView 테스트가 담당).
    expect(screen.queryByLabelText('차트 (준비 중)')).toBeNull()
  })

  it('좌측 지름길 아이콘: 검색·정렬·필터가 렌더', () => {
    renderToolbar()
    expect(screen.getByLabelText('검색')).toBeDefined()
    expect(screen.getByLabelText('정렬')).toBeDefined()
    expect(screen.getByLabelText('필터')).toBeDefined()
  })

  it('우측: ⋯ 뷰 옵션 허브 + ＋ 생성 버튼 렌더, 허브에 주입된 슬롯(프로퍼티) 노출', () => {
    renderToolbar()
    expect(screen.getByLabelText('뷰 옵션')).toBeDefined() // ⋯ 허브
    expect(screen.getByText('새로 만들기')).toBeDefined() // ＋ 생성
    expect(screen.getByText('프로퍼티')).toBeDefined() // 허브 슬롯
  })

  it('onSearchChange 미지정 시 검색 아이콘 미표시(조건부 렌더 확인)', () => {
    renderToolbar({ onSearchChange: undefined })
    expect(screen.queryByLabelText('검색')).toBeNull()
  })

  it('검색 아이콘 클릭 → 입력 필드 열리고 타이핑이 onSearchChange 로 전달', () => {
    const onSearchChange = vi.fn()
    renderToolbar({ onSearchChange })
    fireEvent.click(screen.getByLabelText('검색'))
    const input = screen.getByPlaceholderText('검색...')
    fireEvent.change(input, { target: { value: '프로' } })
    expect(onSearchChange).toHaveBeenCalledWith('프로')
  })
})

// ─── 생성 방법 슬롯(createMenu) — 도메인 무지성 계약 ──────────────────────────────────────
// 툴바는 "선택지가 있으면 편다"만 안다. 라벨·동작은 전부 표면이 소유한다(hubSlots 동형).
describe('ViewToolbar — 생성 드롭다운 슬롯(createMenu)', () => {
  it('createMenu 미지정이면 ＋ 가 즉시 onCreate — 기존 동작 회귀 0', () => {
    const onCreate = vi.fn()
    renderToolbar({ onCreate })
    fireEvent.click(screen.getByText('새로 만들기'))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('createMenu 를 주면 ＋ 가 즉시 만들지 않고 표면이 준 선택지를 편다', () => {
    const onCreate = vi.fn()
    const onCreateMenuSelect = vi.fn()
    renderToolbar({
      onCreate,
      onCreateMenuSelect,
      createMenu: [
        { id: 'blank', label: '빈 상품 추가' },
        { id: 'onboarding', label: 'AI와 함께 만들기' },
      ],
    })
    // 트리거는 그대로 라벨을 달고 있고(발견성 유지), 항목이 펴진다.
    expect(screen.getByText('새로 만들기')).toBeDefined()
    expect(screen.getByText('빈 상품 추가')).toBeDefined()
    expect(screen.getByText('AI와 함께 만들기')).toBeDefined()
    // 트리거 자체는 생성하지 않는다 — 방법을 고르기 전에 행이 생기면 안 된다.
    fireEvent.click(screen.getByText('새로 만들기'))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('항목 선택은 id 로 표면에 위임한다(툴바는 무엇을 뜻하는지 모른다)', () => {
    const onCreateMenuSelect = vi.fn()
    renderToolbar({
      onCreateMenuSelect,
      createMenu: [
        { id: 'blank', label: '빈 상품 추가' },
        { id: 'onboarding', label: 'AI와 함께 만들기' },
      ],
    })
    fireEvent.click(screen.getByText('AI와 함께 만들기'))
    expect(onCreateMenuSelect).toHaveBeenCalledWith('onboarding')
    fireEvent.click(screen.getByText('빈 상품 추가'))
    expect(onCreateMenuSelect).toHaveBeenCalledWith('blank')
  })

  it('빈 배열은 슬롯 미지정과 같다 — 빈 드롭다운을 열지 않는다', () => {
    const onCreate = vi.fn()
    renderToolbar({ onCreate, createMenu: [] })
    fireEvent.click(screen.getByText('새로 만들기'))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  it('disabled 항목은 선택되지 않는다(진행 중 재클릭 방지)', () => {
    const onCreateMenuSelect = vi.fn()
    renderToolbar({
      onCreateMenuSelect,
      createMenu: [{ id: 'onboarding', label: 'AI와 함께 만들기', disabled: true }],
    })
    fireEvent.click(screen.getByText('AI와 함께 만들기'))
    expect(onCreateMenuSelect).not.toHaveBeenCalled()
  })
})
