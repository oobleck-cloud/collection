// @mvos/collections — 지도 마커 모델 순수 변환(#36).
//
// MapView 에서 분리한 순수 로직(React·DOM·@mvos/design-system 비의존) — 단위 테스트 용이.
// "스키마에서 geo 속성 키를 고르고, 행 → 마커 모델로 변환"만 책임진다. 렌더·토큰·SDK 는 MapView.
//
// 좌표 추출은 geo.ts 헬퍼만 거친다(직접 .x/.y 접근 금지 — [object Object]/뒤집힌 축 누수 방지):
//   - isGeoValue: 부분/깨진 객체 거부.
//   - hasGeoCoordinate: (0,0) sentinel(좌표 미설정) 제외 — 기니만 앞바다 가짜 핀 회귀(#36) 차단.
//   - geoToLngLat: (lng, lat) 어휘로 추출(SDK 순서).
//   - formatGeoLabel: 도로명주소 우선 한 줄 라벨.

import type { PropertyDef, PropertyValue } from './types'
import type { Row } from './view'
import { formatGeoLabel, geoToLngLat, hasGeoCoordinate, isGeoValue } from './geo'

type Props = Record<string, PropertyValue>

/** MapView 가 소비하는 한 마커의 표시 모델(@mvos/design-system MapMarker 의 부분집합 — id·position·label). */
export type GeoMarker = {
  /** 레코드 id — React key·마커 식별·onOpen 매핑용. */
  id: string
  /** 경위도 좌표(geoToLngLat 로 추출 — 축 규칙 단일화). */
  position: { lng: number; lat: number }
  /** 도로명주소 우선 한 줄 라벨(formatGeoLabel). 빈 문자열일 수 있다(좌표 폴백). */
  label: string
}

/**
 * 지도에 쓸 geo 속성 키 — 스키마에서 *첫* geo 타입 컬럼. 없으면 undefined.
 * (어느 컬럼으로 핀을 찍을지의 단일 규칙. 사용자 축 설정이 없으므로 스키마 선언 순서의 첫 geo 를 관례로 채택 —
 *  피드가 첫 date 를, 타임라인이 startKey 를 정하는 것과 같은 결.)
 */
export function firstGeoKey(schema: PropertyDef[]): string | undefined {
  return schema.find((d) => d.type === 'geo')?.key
}

/**
 * 행 목록 → 지도 마커 모델 목록(순수). 입력 순서를 보존한다(호출자가 viewRows 로 이미 필터·정렬).
 *  - geoKey 가 없으면 빈 배열(호출자가 "geo 속성 없음" 안내로 분기).
 *  - 값이 GeoValue 가 아니거나(isGeoValue=false) 좌표 미설정((0,0) sentinel)인 행은 제외 —
 *    가짜 핀이 찍히지 않게(#36). 결과가 빈 배열이면 호출자가 "geo 데이터 0건" 안내로 분기.
 *
 * @param rows  추출된 props 를 가진 행 목록(읽기전용, 불변 — 새 배열 반환).
 * @param geoKey  마커 좌표로 쓸 geo 속성 키. undefined 면 빈 배열.
 */
export function toGeoMarkers<P extends Props>(
  rows: Row<P>[],
  geoKey: string | undefined,
): GeoMarker[] {
  if (!geoKey) return []
  const markers: GeoMarker[] = []
  for (const row of rows) {
    const value = row.props[geoKey] ?? null
    if (!isGeoValue(value)) continue
    if (!hasGeoCoordinate(value)) continue
    markers.push({
      id: row.id,
      position: geoToLngLat(value),
      label: formatGeoLabel(value),
    })
  }
  return markers
}
