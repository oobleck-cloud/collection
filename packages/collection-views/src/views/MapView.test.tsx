// @vitest-environment jsdom
//
// @oobleck/collection — MapView 렌더 테스트(#36).
//
// 목적: 지도 뷰의 "정직한 상태"(죽은 컨트롤 금지) 회귀 핀.
//   - geo 속성 없음 → "위치(geo) 속성 추가" 안내(지도 미렌더).
//   - 토큰 미설정 → "토큰 설정 필요" 안내(깨진 빈 지도 금지).
//   - geo 속성 + 토큰 있으나 좌표 0건 → "데이터 없음" 안내.
//   - geo 데이터 + 토큰 → MapboxMap 에 마커 전달, 마커 클릭 = onOpen.
//
// 전략: @oobleck/systheme 배럴(Mapbox GL 등 무거운 의존)과 토큰 모듈을 경량 스텁으로 대체.
//   MapboxMap 스텁은 markers 를 라벨 버튼으로 렌더해 개수·라벨·onMarkerClick 을 검증한다.

import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 토큰 해석을 모킹 — 테스트가 토큰 유/무를 결정한다(환경변수 비의존, 결정적).
const mockToken = vi.fn<() => string>(() => '')
vi.mock('./mapbox-token', () => ({
  MAPBOX_TOKEN_ENV: 'NEXT_PUBLIC_MAPBOX_TOKEN',
  resolveMapboxToken: () => mockToken(),
}))

// @oobleck/systheme 스텁 — MapView 는 MapboxMap·MapProvider 만 소비.
//   MapProvider: accessToken 을 받아 children 을 그대로 렌더(주입 경로 통과 확인용).
//   MapboxMap: markers 를 label 버튼으로 렌더 → 개수·라벨·onMarkerClick 검증.
vi.mock('@oobleck/systheme', () => {
  type Marker = { id: string; label?: string; caption?: string }
  const MapProvider = ({
    accessToken,
    children,
  }: {
    accessToken: string
    children: React.ReactNode
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'map-provider', 'data-token': accessToken },
      children,
    )

  const MapboxMap = ({
    markers = [],
    onMarkerClick,
  }: {
    markers?: Marker[]
    onMarkerClick?: (m: Marker) => void
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'mapbox-map' },
      markers.map((m) =>
        React.createElement(
          'button',
          {
            key: m.id,
            'data-testid': 'map-marker',
            onClick: () => onMarkerClick?.(m),
          },
          m.label ?? m.id,
        ),
      ),
    )

  return { MapProvider, MapboxMap }
})

import type {
  BlockDocument,
  BlockPack,
  GeoValue,
  PropertyDef,
  PropertyValue,
  TableRecord,
  ViewConfig,
} from '@oobleck/collection'

type MockProps = Record<string, PropertyValue>

function makePack(schema: PropertyDef[]): BlockPack<MockProps> {
  return {
    propertySchema: schema,
    readProperties: (doc: BlockDocument): MockProps => doc.properties ?? {},
    writeProperty: (doc: BlockDocument, key: string, value: PropertyValue): BlockDocument => ({
      ...doc,
      properties: { ...(doc.properties ?? {}), [key]: value },
    }),
  }
}

function makeView(partial: Partial<ViewConfig>): ViewConfig {
  return { type: 'map', filters: { op: 'and', children: [] }, sort: [], ...partial }
}

function makeRecord(id: string, props: Record<string, PropertyValue>): TableRecord {
  return { id, doc: { properties: props } }
}

// vi.mock 등록 후 실제 컴포넌트 로드.
import { MapView } from './MapView'

const seoul: GeoValue = {
  coordinate: { x: 126.978, y: 37.5665, type: 'WGS84' },
  roadAddress: '서울특별시 중구 세종대로 110',
}
const busan: GeoValue = {
  coordinate: { x: 129.0756, y: 35.1796, type: 'WGS84' },
  roadAddress: '부산광역시 연제구 중앙대로 1001',
}

const geoSchema: PropertyDef[] = [
  { key: 'name', label: '이름', type: 'text', source: 'frontmatter', origin: 'preset' },
  { key: 'loc', label: '위치', type: 'geo', source: 'frontmatter', origin: 'base' },
]
const noGeoSchema: PropertyDef[] = [
  { key: 'name', label: '이름', type: 'text', source: 'frontmatter', origin: 'preset' },
]

afterEach(cleanup)
beforeEach(() => mockToken.mockReturnValue(''))

describe('MapView — 정직한 상태', () => {
  it('geo 속성 없음 → "위치(geo) 속성 추가" 안내, 지도 미렌더', () => {
    mockToken.mockReturnValue('pk.test') // 토큰 있어도 geo 없으면 지도 안 그림
    const pack = makePack(noGeoSchema)
    render(
      <MapView records={[makeRecord('r1', { name: '알파' })]} pack={pack} view={makeView({})} />,
    )

    expect(screen.getByText('위치(geo) 속성을 추가하면 지도에 표시됩니다.')).toBeDefined()
    expect(screen.queryByTestId('mapbox-map')).toBeNull()
  })

  it('토큰 미설정 → "토큰 설정 필요" 안내, 깨진 빈 지도 금지', () => {
    mockToken.mockReturnValue('') // 토큰 없음
    const pack = makePack(geoSchema)
    render(<MapView records={[makeRecord('r1', { loc: seoul })]} pack={pack} view={makeView({})} />)

    expect(
      screen.getByText(
        '지도를 표시하려면 Mapbox 토큰(NEXT_PUBLIC_MAPBOX_TOKEN) 설정이 필요합니다.',
      ),
    ).toBeDefined()
    expect(screen.queryByTestId('mapbox-map')).toBeNull()
  })

  it('geo 속성 + 토큰 있으나 좌표 0건 → "데이터 없음" 안내', () => {
    mockToken.mockReturnValue('pk.test')
    const pack = makePack(geoSchema)
    // 좌표 미설정((0,0)) — 가짜 핀 금지 게이트로 마커 0건.
    const addressOnly: GeoValue = {
      coordinate: { x: 0, y: 0, type: 'WGS84' },
      roadAddress: '주소만',
    }
    render(
      <MapView
        records={[makeRecord('r1', { loc: addressOnly })]}
        pack={pack}
        view={makeView({})}
      />,
    )

    expect(
      screen.getByText('표시할 위치 데이터가 없습니다. 레코드에 좌표를 입력하세요.'),
    ).toBeDefined()
    expect(screen.queryByTestId('mapbox-map')).toBeNull()
  })
})

describe('MapView — 지도 렌더', () => {
  it('geo 데이터 + 토큰 → MapboxMap 에 마커 전달(토큰 주입), 라벨 표시', () => {
    mockToken.mockReturnValue('pk.test')
    const pack = makePack(geoSchema)
    render(
      <MapView
        records={[makeRecord('r1', { loc: seoul }), makeRecord('r2', { loc: busan })]}
        pack={pack}
        view={makeView({})}
      />,
    )

    expect(screen.getByTestId('mapbox-map')).toBeDefined()
    // 토큰이 MapProvider 로 주입됐는지.
    expect(screen.getByTestId('map-provider').getAttribute('data-token')).toBe('pk.test')
    // 마커 2개 + 라벨(도로명주소).
    expect(screen.getAllByTestId('map-marker')).toHaveLength(2)
    expect(screen.getByText(seoul.roadAddress)).toBeDefined()
    expect(screen.getByText(busan.roadAddress)).toBeDefined()
  })

  it('마커 클릭 → onOpen(레코드 id)', () => {
    mockToken.mockReturnValue('pk.test')
    const pack = makePack(geoSchema)
    const onOpen = vi.fn()
    render(
      <MapView
        records={[makeRecord('r1', { loc: seoul })]}
        pack={pack}
        view={makeView({})}
        onOpen={onOpen}
      />,
    )

    fireEvent.click(screen.getByText(seoul.roadAddress))
    expect(onOpen).toHaveBeenCalledWith('r1')
  })
})
