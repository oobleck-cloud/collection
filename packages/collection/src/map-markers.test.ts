// @mvos/collections — map-markers 순수 변환 테스트(#36).
//
// 목적: 행 → 마커 변환의 경계·게이팅 회귀 핀.
//   - firstGeoKey: 스키마에서 첫 geo 키, 없으면 undefined.
//   - toGeoMarkers: geoKey 없음/깨진 값/(0,0) sentinel 제외, 좌표·라벨 추출, 입력 순서 보존.
//
// 순수 모듈(React·DOM 비의존)이라 node 환경 — geo.ts 헬퍼 경유 검증(직접 .x/.y 접근 금지 회귀 차단).

import { describe, expect, it } from 'vitest'
import type { GeoValue, PropertyDef, PropertyValue } from './types'
import type { Row } from './view'
import { firstGeoKey, toGeoMarkers } from './map-markers'

const seoul: GeoValue = {
  coordinate: { x: 126.978, y: 37.5665, type: 'WGS84' },
  roadAddress: '서울특별시 중구 세종대로 110',
}

const busan: GeoValue = {
  coordinate: { x: 129.0756, y: 35.1796, type: 'WGS84' },
  roadAddress: '부산광역시 연제구 중앙대로 1001',
}

/** 좌표 미설정 sentinel — 도로명주소만 입력된 값(좌표 (0,0)). 가짜 핀 회귀(#36) 방지 대상. */
const addressOnly: GeoValue = {
  coordinate: { x: 0, y: 0, type: 'WGS84' },
  roadAddress: '경기도 성남시 분당구 어딘가',
}

function makeRow(
  id: string,
  props: Record<string, PropertyValue>,
): Row<Record<string, PropertyValue>> {
  return { id, props }
}

describe('firstGeoKey', () => {
  it('스키마에서 첫 geo 타입 키를 반환', () => {
    const schema: PropertyDef[] = [
      { key: 'name', label: '이름', type: 'text', source: 'frontmatter', origin: 'preset' },
      { key: 'loc', label: '위치', type: 'geo', source: 'frontmatter', origin: 'base' },
      { key: 'loc2', label: '위치2', type: 'geo', source: 'frontmatter', origin: 'base' },
    ]
    expect(firstGeoKey(schema)).toBe('loc')
  })

  it('geo 속성이 없으면 undefined', () => {
    const schema: PropertyDef[] = [
      { key: 'name', label: '이름', type: 'text', source: 'frontmatter', origin: 'preset' },
    ]
    expect(firstGeoKey(schema)).toBeUndefined()
  })
})

describe('toGeoMarkers', () => {
  it('geoKey 가 undefined 면 빈 배열', () => {
    const rows = [makeRow('r1', { loc: seoul })]
    expect(toGeoMarkers(rows, undefined)).toEqual([])
  })

  it('좌표가 있는 행 → 마커(lng/lat·라벨), 입력 순서 보존', () => {
    const rows = [makeRow('r1', { loc: seoul }), makeRow('r2', { loc: busan })]
    const markers = toGeoMarkers(rows, 'loc')
    expect(markers).toEqual([
      { id: 'r1', position: { lng: 126.978, lat: 37.5665 }, label: seoul.roadAddress },
      { id: 'r2', position: { lng: 129.0756, lat: 35.1796 }, label: busan.roadAddress },
    ])
  })

  it('값이 GeoValue 가 아니거나 null 인 행은 제외', () => {
    const rows = [
      makeRow('r1', { loc: seoul }),
      makeRow('r2', { loc: null }),
      makeRow('r3', { loc: '문자열은 좌표가 아님' }),
      makeRow('r4', { loc: 42 }),
    ]
    const markers = toGeoMarkers(rows, 'loc')
    expect(markers.map((m) => m.id)).toEqual(['r1'])
  })

  it('(0,0) sentinel(도로명주소만 입력) 은 제외 — 가짜 핀 회귀(#36) 차단', () => {
    const rows = [makeRow('r1', { loc: addressOnly }), makeRow('r2', { loc: seoul })]
    const markers = toGeoMarkers(rows, 'loc')
    expect(markers.map((m) => m.id)).toEqual(['r2'])
  })

  it('좌표 있는 행이 0건이면 빈 배열', () => {
    const rows = [makeRow('r1', { loc: addressOnly }), makeRow('r2', { loc: null })]
    expect(toGeoMarkers(rows, 'loc')).toEqual([])
  })

  it('roadAddress 가 비면 좌표를 라벨로 폴백(위도, 경도)', () => {
    const noAddr: GeoValue = { coordinate: { x: 127.1, y: 37.4, type: 'WGS84' }, roadAddress: '' }
    const markers = toGeoMarkers([makeRow('r1', { loc: noAddr })], 'loc')
    expect(markers[0].label).toBe('37.4, 127.1')
  })
})
