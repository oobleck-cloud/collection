'use client'

import { type FC, useMemo } from 'react'
import { MapboxMap, MapProvider, type MapMarker } from '../kit'
import type { PropertyValue } from '@oobleck/collection'
import { resolveTitleKey, viewRows, type Row } from '@oobleck/collection'
import { formatTitleText } from '@oobleck/collection'
import { firstGeoKey, toGeoMarkers } from '@oobleck/collection'
import { resolveMapboxToken } from './mapbox-token'
import { useCollectionLocale } from '../i18n'
import { mapViewCopy } from './MapView.messages'
import type { ViewSurfaceProps } from './ViewSurface'

// @oobleck/collection — 지도 뷰 렌더러(ViewConfig.type='map', #36/#45).
//
// geo 타입 속성(스키마 첫 geo)의 좌표로 마커를 찍는다. 도메인 무관 — 어떤 블록팩 문서든 위치값을 지도에 올린다.
// 좌표 추출·라벨은 geo.ts 헬퍼 경유(직접 .x/.y 금지) → map-markers.ts 순수 모듈이 행 → 마커 변환을 담당.
// 렌더는 @oobleck/systheme MapboxMap(Mapbox GL). 토큰은 NEXT_PUBLIC_MAPBOX_TOKEN(런타임) — MapProvider 로 주입.
//
// 죽은 컨트롤 금지(정직한 상태): geo 속성 없음 / geo 데이터 0건 / 토큰 미설정 을 각각 명시 안내하고,
//   토큰 없이 깨진 빈 지도를 그리지 않는다. supports:{} (groupBy/cover/cardSize 어포던스 없음).

// ─── 빈 상태 ───────────────────────────────────────────────────────────────────

/** 지도 뷰 안내 상태 — 점선 박스(다른 뷰의 빈 상태와 동형). */
function MapNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-fg-muted">
      {children}
    </div>
  )
}

// ─── MapView ────────────────────────────────────────────────────────────────────

/**
 * MapView — geo 속성 기준 지도 핀 뷰(ViewConfig.type='map').
 *
 * - geo 키 = 스키마 첫 geo 속성(firstGeoKey). 없으면 "geo 속성 추가" 안내.
 * - 마커 = viewRows(필터·정렬) 적용 후 toGeoMarkers((0,0) sentinel 제외). 0건이면 "데이터 없음" 안내.
 * - 토큰(NEXT_PUBLIC_MAPBOX_TOKEN) 미설정이면 깨진 지도 대신 "토큰 설정 필요" 안내(honest state).
 * - 마커 클릭 = onOpen(레코드 열기). 라벨 = formatGeoLabel(도로명주소 우선).
 */
export const MapView: FC<ViewSurfaceProps> = ({ records, pack, view, schema, onOpen }) => {
  const c = mapViewCopy(useCollectionLocale())
  const propertySchema = schema ?? pack.propertySchema
  const geoKey = firstGeoKey(propertySchema)
  const titleKey = resolveTitleKey(propertySchema, view)
  const token = resolveMapboxToken()

  // 행 → 마커: 코어 viewRows(필터·정렬) 적용 후 순수 toGeoMarkers 로 변환((0,0)/깨진 값 제외).
  // 마커 라벨은 geo 라벨(좌표 폴백 포함), caption 은 레코드 제목(있으면) — 핀 식별 보조.
  const markers = useMemo<MapMarker[]>(() => {
    if (!geoKey) return []
    const all: Row<Record<string, PropertyValue>>[] = records.map((r) => ({
      id: r.id,
      props: pack.readProperties(r.doc) as Record<string, PropertyValue>,
    }))
    const ordered = viewRows(all, view)
    // id → props 1회 인덱싱(마커당 .find 재탐색 O(n²) 방지) — caption 용 제목값 조회.
    const propsById = new Map(ordered.map((r) => [r.id, r.props]))
    return toGeoMarkers(ordered, geoKey).map((m) => {
      const titleValue = titleKey ? (propsById.get(m.id)?.[titleKey] ?? null) : null
      const caption = titleValue !== null ? formatTitleText(titleValue) : ''
      return {
        id: m.id,
        position: m.position,
        label: m.label,
        ...(caption ? { caption } : {}),
      }
    })
  }, [records, pack, view, geoKey, titleKey])

  // 1) geo 속성 자체가 스키마에 없음 → 추가 안내(지도를 그릴 근거가 없음).
  if (!geoKey) {
    return <MapNotice>{c.addGeo}</MapNotice>
  }

  // 2) 토큰 미설정 → 깨진 빈 지도 대신 명시 안내(NEXT_PUBLIC_… 설정 필요).
  if (!token) {
    return <MapNotice>{c.needToken}</MapNotice>
  }

  // 3) geo 속성은 있으나 좌표가 있는 레코드가 0건 → 데이터 안내.
  if (markers.length === 0) {
    return <MapNotice>{c.noData}</MapNotice>
  }

  // 4) 정상 — 토큰 주입 후 마커 렌더(autoFit 기본 — 마커 범위에 맞춰 카메라).
  return (
    <MapProvider accessToken={token}>
      <MapboxMap
        height={480}
        markers={markers}
        onMarkerClick={onOpen ? (marker) => onOpen(marker.id) : undefined}
        aria-label={c.mapAria}
      />
    </MapProvider>
  )
}
