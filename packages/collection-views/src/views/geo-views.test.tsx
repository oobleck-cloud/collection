// @vitest-environment jsdom
//
// @oobleck/collection — geo PropertyType 렌더·게이팅 회귀 핀(#45).
//
// 목적:
//   - GeoCellEditor: geo 값 → 도로명주소·경도(x)·위도(y) 입력이 패널에 렌더되는지.
//   - PropertyChip(record-card): geo 값 → 라벨 텍스트가 보이고 "[object Object]" 가 새지 않는지.
//   - 게이팅(opsFor/isSortableType): geo 는 is_empty/is_not_empty 만, 정렬 후보에서 제외.
//
// 전략: @oobleck/systheme 배럴을 경량 스텁으로 대체(AnchorContextSurface 는 surface+panel 둘 다 렌더해 패널 내용까지 검증).

import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ViewToolbar(opsFor/isSortableType 보유) 가 view-layout-panel → CollectionView 의 전 뷰 레지스트리를
// 끌어오므로 stub 한다(viewtoolbar.test.tsx 와 동형) — 우린 순수 게이팅 함수만 import 한다.
vi.mock('./CollectionView', () => ({
  VIEW_SURFACES: {},
  PLANNED_VIEW_SURFACES: {},
}))

vi.mock('@oobleck/systheme', () => {
  const makeIcon =
    (id: string) =>
    ({ className }: { className?: string; 'aria-hidden'?: boolean }) =>
      React.createElement('svg', { 'data-testid': `icon-${id}`, className })

  // AnchorContextSurface — surface(트리거)와 panel(편집 폼)을 모두 렌더(테스트가 패널 입력까지 본다).
  const AnchorContextSurface = ({
    surface,
    panel,
  }: {
    surface?: React.ReactNode
    panel?: React.ReactNode
  }) => React.createElement('div', null, surface, panel)

  const Input = ({
    value,
    onValueChange,
    placeholder,
    'aria-label': ariaLabel,
  }: {
    value?: string
    onValueChange?: (v: string) => void
    placeholder?: string
    'aria-label'?: string
  }) =>
    React.createElement('input', {
      value: value ?? '',
      placeholder,
      'aria-label': ariaLabel,
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

  const Badge = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children)

  const Tag = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children)

  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')

  return {
    AnchorContextSurface,
    Input,
    Select,
    Badge,
    Tag,
    cn,
    // record-card.tsx 가 쓰는 아이콘 세트(+ Map alias).
    ArrowLeftRight: makeIcon('arrow-lr'),
    CalendarDays: makeIcon('calendar'),
    Hash: makeIcon('hash'),
    LayoutDashboard: makeIcon('layout-dashboard'),
    Link2: makeIcon('link2'),
    List: makeIcon('list'),
    Mail: makeIcon('mail'),
    Map: makeIcon('map'),
    Phone: makeIcon('phone'),
    SquareCheck: makeIcon('square-check'),
    Tags: makeIcon('tags'),
    Type: makeIcon('type'),
    User: makeIcon('user'),
    Users: makeIcon('users'),
    // GeoCellEditor(헤더/확정카드) · AddressAutocomplete(검색 아이콘) 가 쓰는 아이콘.
    MapPin: makeIcon('map-pin'),
    Check: makeIcon('check'),
    Search: makeIcon('search'),
  }
})

import { GeoCellEditor, applyGeoResult } from './CellEditor'
import { PropertyChip } from './record-card'
import { opsFor, isSortableType } from './ViewToolbar'
import type { GeoValue, PropertyDef } from '@oobleck/collection'
import type { GeoSearchResult } from '@oobleck/collection'

afterEach(cleanup)

const seoul: GeoValue = {
  coordinate: { x: 126.978, y: 37.5665, type: 'WGS84' },
  roadAddress: '서울특별시 중구 세종대로 110',
}

// ── GeoCellEditor ───────────────────────────────────────────────────────────

describe('GeoCellEditor', () => {
  it('기존 주소값 → 확정 카드로 열리고(검색창 X), 상세주소·"변경" 노출', () => {
    render(<GeoCellEditor value={seoul} onCommit={() => {}} />)
    // 확정 단계로 열리므로 주소 검색창은 없다.
    expect(screen.queryByLabelText('주소 검색')).toBeNull()
    // 확정 카드에 도로명주소가 텍스트로 보인다(트리거 라벨 + 카드 = 2곳 이상).
    expect(screen.getAllByText(seoul.roadAddress).length).toBeGreaterThanOrEqual(2)
    // "변경"으로 다시 검색으로 되돌릴 수 있다.
    expect(screen.getByText('변경')).toBeDefined()
    // 상세주소 입력란은 확정 후 노출.
    expect(screen.getByLabelText('상세주소')).toBeDefined()
    // 좌표 섹션은 기본 접힘 — 좌표가 이미 있어도 경도/위도 입력이 바로 보이지 않는다.
    expect(screen.queryByLabelText('경도')).toBeNull()
    expect(screen.queryByLabelText('위도')).toBeNull()
    // 좌표가 있으면 토글 라벨은 "좌표 수정".
    fireEvent.click(screen.getByText('좌표 수정'))
    expect(screen.getByLabelText<HTMLInputElement>('경도').value).toBe('126.978')
    expect(screen.getByLabelText<HTMLInputElement>('위도').value).toBe('37.5665')
  })

  it('"변경" 클릭 → 검색 단계로 돌아가 주소 검색창 노출', () => {
    render(<GeoCellEditor value={seoul} onCommit={() => {}} />)
    fireEvent.click(screen.getByText('변경'))
    // 검색 단계 — 검색창이 뜨고 도로명주소가 시드된다.
    expect(screen.getByLabelText<HTMLInputElement>('주소 검색').value).toBe(seoul.roadAddress)
    // 검색 단계에서는 상세주소 입력란이 숨는다(검색→선택→상세주소 순).
    expect(screen.queryByLabelText('상세주소')).toBeNull()
  })

  it('미설정(null) → "위치 없음" 트리거, 검색 단계, 상세주소 숨김, 좌표 토글 노출', () => {
    render(<GeoCellEditor value={null} onCommit={() => {}} />)
    expect(screen.getByText('위치 없음')).toBeDefined()
    // 검색 단계 — 빈 검색창.
    expect(screen.getByLabelText<HTMLInputElement>('주소 검색').value).toBe('')
    // 주소가 없으면 상세주소 입력란 자체가 없다(단계적 노출).
    expect(screen.queryByLabelText('상세주소')).toBeNull()
    // 좌표 미설정이면 토글 라벨은 "좌표 직접 입력 (고급)".
    expect(screen.getByText('좌표 직접 입력 (고급)')).toBeDefined()
  })

  // 회귀 핀(#45 리뷰): 경도·위도 중 하나만 입력(반쪽 좌표) → 인라인 힌트 노출.
  // 절반만 0 으로 영속돼 기니만 앞바다(0,0)에 가짜 핀이 찍히는 #36 회귀를 막는다.
  it('경도만 입력(반쪽 좌표) → "경도·위도를 함께 입력하세요" 힌트 노출', () => {
    render(<GeoCellEditor value={null} onCommit={() => {}} />)
    // 좌표 섹션을 펼친다(기본 접힘).
    fireEvent.click(screen.getByText('좌표 직접 입력 (고급)'))
    // 처음엔 힌트가 없다(둘 다 빈 상태).
    expect(screen.queryByText('경도·위도를 함께 입력하세요')).toBeNull()
    // 경도만 채운다 → 반쪽 좌표.
    fireEvent.change(screen.getByLabelText('경도'), { target: { value: '126.978' } })
    expect(screen.getByText('경도·위도를 함께 입력하세요')).toBeDefined()
    // 위도까지 채우면 힌트가 사라진다(둘 다 채워짐).
    fireEvent.change(screen.getByLabelText('위도'), { target: { value: '37.5665' } })
    expect(screen.queryByText('경도·위도를 함께 입력하세요')).toBeNull()
  })
})

// ── applyGeoResult (POI 상세주소 자동주입 규칙) ───────────────────────────────

describe('applyGeoResult', () => {
  const emptyDraft = {
    roadAddress: '',
    detailAddress: '',
    jibunAddress: '',
    x: '',
    y: '',
    type: 'WGS84' as const,
  }
  const poi: GeoSearchResult = {
    id: '1',
    placeName: '스타벅스 광화문점',
    roadAddress: '서울 종로구 세종대로 172',
    jibunAddress: '서울 종로구 세종로 1-68',
    x: 126.9769,
    y: 37.5716,
    coordinateSystem: 'WGS84',
  }

  it('POI(장소명 有) → 도로명주소는 주소로, 장소명은 상세주소로 자동주입', () => {
    const next = applyGeoResult(emptyDraft, poi)
    expect(next.roadAddress).toBe('서울 종로구 세종대로 172')
    expect(next.detailAddress).toBe('스타벅스 광화문점')
    expect(next.jibunAddress).toBe('서울 종로구 세종로 1-68')
    expect(next.x).toBe('126.9769')
    expect(next.y).toBe('37.5716')
  })

  it('순수 주소(장소명 없음) → 상세주소 자동주입 안 함', () => {
    const addressOnly: GeoSearchResult = { ...poi, placeName: '' }
    const next = applyGeoResult(emptyDraft, addressOnly)
    expect(next.roadAddress).toBe('서울 종로구 세종대로 172')
    expect(next.detailAddress).toBe('')
  })

  it('이미 입력된 상세주소는 자동주입으로 덮어쓰지 않는다', () => {
    const next = applyGeoResult({ ...emptyDraft, detailAddress: '3층' }, poi)
    expect(next.detailAddress).toBe('3층')
  })

  it('도로명 없고 지번만 있으면 지번을 주소로(지번 보조라인은 생략)', () => {
    const jibunOnly: GeoSearchResult = { ...poi, placeName: '', roadAddress: '' }
    const next = applyGeoResult(emptyDraft, jibunOnly)
    expect(next.roadAddress).toBe('서울 종로구 세종로 1-68')
    expect(next.jibunAddress).toBe('') // 주소 라벨(=지번)과 동일하므로 보조라인 생략
  })
})

// ── PropertyChip(geo) ──────────────────────────────────────────────────────

describe('PropertyChip — geo', () => {
  const geoDef: PropertyDef = {
    key: 'loc',
    label: '위치',
    type: 'geo',
    source: 'frontmatter',
    origin: 'base',
  }

  it('geo 값 → 라벨 텍스트, "[object Object]" 누수 없음', () => {
    const { container } = render(<PropertyChip def={geoDef} value={seoul} />)
    expect(screen.getByText(seoul.roadAddress)).toBeDefined()
    expect(container.textContent).not.toContain('[object Object]')
  })

  it('geo 값이 깨졌으면(null) 렌더 안 함', () => {
    const { container } = render(<PropertyChip def={geoDef} value={null} />)
    expect(container.textContent).not.toContain('[object Object]')
    expect(container.textContent?.trim()).toBe('')
  })
})

// ── 게이팅(필터 op / 정렬) ──────────────────────────────────────────────────

describe('geo 게이팅', () => {
  it('opsFor(geo) → is_empty/is_not_empty 만', () => {
    expect(opsFor('geo')).toEqual(['is_empty', 'is_not_empty'])
  })

  it('opsFor(geo) 는 eq/contains/gt 등 숫자·텍스트 op 를 제공하지 않는다', () => {
    const ops = opsFor('geo')
    for (const forbidden of ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'has'] as const) {
      expect(ops).not.toContain(forbidden)
    }
  })

  it('isSortableType(geo) === false, 그 외 타입은 정렬 가능', () => {
    expect(isSortableType('geo')).toBe(false)
    expect(isSortableType('text')).toBe(true)
    expect(isSortableType('number')).toBe(true)
    expect(isSortableType('date')).toBe(true)
  })
})
