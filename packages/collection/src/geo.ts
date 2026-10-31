// @mvos/collections — 위치(geo) 프로퍼티 순수 헬퍼(#45).
//
// GeoValue(경위도 + 도로명주소)의 좌표 추출·표시 라벨·타입가드를 한곳에 모은다(도메인 무관, 순수).
// 셀/카드 렌더가 객체를 직접 String() 으로 찍어 "[object Object]" 가 새지 않도록 이 헬퍼를 거친다.
// 지도 렌더·주소 검색은 별도 작업(#36) — 여기선 데이터 표현만 다룬다.

import type { CoordinateSystem, GeoValue, PropertyValue } from './types'

/**
 * GeoValue → { lng, lat } 경위도 추출. x=경도(lng), y=위도(lat) — 외부 Address 미러의 축 규칙.
 * 지도 SDK(#36)가 보통 (lng, lat) 순서를 받으므로 그 어휘로 노출한다.
 */
export function geoToLngLat(v: GeoValue): { lng: number; lat: number } {
  return { lng: v.coordinate.x, lat: v.coordinate.y }
}

/** 좌표 폴백 표시용 반올림 — WGS84 6자리면 ~0.1m 정밀도. 끝자리 0/소수점은 다듬어(예: 37.5 그대로). */
function trimCoord(n: number): string {
  return String(Number(n.toFixed(6)))
}

/**
 * GeoValue → 셀/카드에 보일 한 줄 라벨.
 *  - roadAddress 가 있으면 그것을 1순위로, detailAddress 가 있으면 공백으로 이어 붙인다.
 *  - roadAddress 가 비었으면 좌표를 "위도, 경도"(y, x) 순서로 폴백 표시(한국식 좌표 표기 관습, 6자리 반올림).
 */
export function formatGeoLabel(v: GeoValue): string {
  const base = v.roadAddress.trim() || `${trimCoord(v.coordinate.y)}, ${trimCoord(v.coordinate.x)}`
  const detail = v.detailAddress?.trim()
  return detail ? `${base} ${detail}` : base
}

/** 좌표계 화이트리스트 — CoordinateSystem 미러. isGeoValue 의 coordinate.type 검증용. */
const COORDINATE_SYSTEMS: readonly CoordinateSystem[] = [
  'WGS84',
  'WCONGNAMUL',
  'CONGNAMUL',
  'WTM',
  'TM',
]

/**
 * GeoValue 타입가드 — 렌더 경로에서 PropertyValue(유니온)가 위치값인지 안전 판별.
 * coordinate.{x,y} 가 유한 숫자, coordinate.type 이 유효 좌표계, roadAddress 가 문자열이어야
 * 참(부분/깨진 객체는 거부).
 */
export function isGeoValue(v: unknown): v is GeoValue {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (typeof o.roadAddress !== 'string') return false
  const c = o.coordinate
  if (typeof c !== 'object' || c === null) return false
  const coord = c as Record<string, unknown>
  if (!Number.isFinite(coord.x) || !Number.isFinite(coord.y)) return false
  return COORDINATE_SYSTEMS.includes(coord.type as CoordinateSystem)
}

/**
 * "실제 좌표가 있는가" 판정 — 지도 핀(#36) 렌더용.
 *
 * GeoValue.coordinate 는 필수 필드라 도로명주소만 입력한 값도 좌표 자리를 채워야 한다.
 * 그 sentinel 로 (0,0) 을 쓰므로(CellEditor.fromGeoDraft 참조), (0,0) = "좌표 미설정" 으로 본다.
 * 기니만 앞바다(0,0)에 가짜 핀이 찍히는 #36 회귀를 막기 위해, 지도/핀 렌더는 isGeoValue 가 아니라
 * 이 헬퍼로 게이트해야 한다. (정확히 0,0 인 실제 지점은 바다 한가운데라 표현 손실은 무시 가능.)
 */
export function hasGeoCoordinate(v: GeoValue): boolean {
  return v.coordinate.x !== 0 || v.coordinate.y !== 0
}

/**
 * PropertyValue → 카드/행 제목으로 쓸 텍스트(빈값은 ''). 객체값(geo)도 라벨로 풀어 "[object Object]" 누수를 막는다.
 * 카드형 뷰(gallery/list/board/feed/calendar/timeline)의 중복 제목 변환을 한곳으로 모은 안전 헬퍼다.
 * 빈값일 때의 폴백 문구('제목 없음' 등)는 호출자가 정한다(이 함수는 '' 만 반환).
 */
export function formatTitleText(value: PropertyValue): string {
  if (value === null || value === undefined) return ''
  if (isGeoValue(value)) return formatGeoLabel(value)
  if (Array.isArray(value)) return value.join(', ')
  // 남은 객체값(ButtonValue·TagValue 등)은 라벨로 풀어 "[object Object]" 누수를 막는다.
  // TagValue 는 tag(색 힌트 실은 값)를, 그 외(ButtonValue 등)는 label 을, 둘 다 없으면 ''.
  // (isTagValue 를 import 하지 않고 구조 검사로 판별 — geo.ts 를 view.ts 에 결합하지 않는다.)
  if (typeof value === 'object') {
    const tag = (value as { tag?: unknown }).tag
    if (typeof tag === 'string') return tag
    const label = (value as { label?: unknown }).label
    return typeof label === 'string' ? label : ''
  }
  return String(value)
}
