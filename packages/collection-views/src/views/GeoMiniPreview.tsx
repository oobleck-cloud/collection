'use client'

import { MapProvider, MapboxMap } from '@oobleck/systheme'
import { resolveMapboxToken } from './mapbox-token'

// geo 셀 편집기의 위치 미리보기(#36) — 입력된 좌표에 핀 하나를 찍은 작은 지도.
//
// 별도 모듈 + default export 로 두는 이유: CellEditor 에서 React.lazy 로 지연 로드해
// mapbox-gl(무거움)을 geo 셀을 실제로 열 때만 번들에서 가져온다(모든 표 셀에 딸려오지 않게).
//
// 정직한 상태: Mapbox 토큰이 없으면 깨진 지도 대신 조용히 null(미리보기는 부가 — 좌표 입력은 계속 가능).
// preserve=true 로 고정 카메라(center/zoom) — 단일 핀이라 autoFit 대신 입력 좌표를 그대로 비춘다.
//
// 핀은 의도적으로 단순하게: label(이름표 말풍선)을 넘기지 않고 badge 도 공백 한 칸으로 고정한다.
// MapMarker.badge 를 비워두면 markerLayers 가 1-based 인덱스("1")로 자동 채우므로(다중 핀 지도의
// 기본 동작), 미리보기처럼 핀이 하나뿐인 곳에선 그 번호가 의미 없이 붙는다 — 공백으로 그 폴백을 막는다.

export type GeoMiniPreviewProps = {
  /** 경도(lng). */
  x: number
  /** 위도(lat). */
  y: number
}

export default function GeoMiniPreview({ x, y }: GeoMiniPreviewProps) {
  const token = resolveMapboxToken()
  if (!token) return null

  return (
    <div className="overflow-hidden rounded-md border border-border">
      <MapProvider accessToken={token}>
        <MapboxMap
          height={132}
          camera={{ center: { lng: x, lat: y }, zoom: 15, preserve: true }}
          markers={[{ id: 'geo-preview', position: { lng: x, lat: y }, badge: ' ' }]}
          aria-label="위치 미리보기"
        />
      </MapProvider>
    </div>
  )
}
