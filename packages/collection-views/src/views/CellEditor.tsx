'use client'

import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AnchorContextSurface,
  Check,
  DateEditPanel,
  Input,
  MapPin,
  Select,
  cn,
  type DateEditValue,
} from '../kit'
import type { CoordinateSystem, DateDisplayFormat, GeoValue } from '@oobleck/collection'
import type { GeoSearchResult } from '@oobleck/collection'
import { formatGeoLabel, isGeoValue } from '@oobleck/collection'
import { AddressAutocomplete } from './AddressAutocomplete'
import { buildDateValue, formatDateValueDisplay, parseDateValueParts } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { cellEditorCopy } from './CellEditor.messages'

// 위치 미리보기(작은 Mapbox 지도)는 지연 로드 — mapbox-gl(무거움)을 geo 셀을 실제로 열 때만
// 번들에서 가져온다(모든 표 셀에 딸려오지 않게). 좌표가 있을 때만 렌더한다(fallback = 자리 유지 박스).
const GeoMiniPreview = lazy(() => import('./GeoMiniPreview'))

// 공용 셀 편집기 — 노션식. 평소엔 셀 안에 표시값(트리거)만 보이고, 누르면 셀 위로 "고정너비 패널"이
// 떠서 그 안에서 편집한다. 일반 테이블(TableView)·인라인 테이블(기능/플랜 블록) 모두 같은 컴포넌트를
// 써서 "셀 편집"이라는 인터랙션이 어디서나 동일하다(패널 크롬·폭·커밋 규칙 통일).
//
// 커밋 규칙: Enter·바깥 클릭 = 커밋, Escape = 취소. 제어/비제어 모두 지원
//   (TableView = 비제어 클릭 토글, 인라인표 = open/onOpenChange 제어로 Enter→다음 행 이동).

/** 패널 고정 폭 — 셀보다 살짝 큰 편집 표면. 좁은 셀에서도 일관된 편집 너비를 보장. */
const CELL_PANEL_WIDTH = 'w-64'

/**
 * 셀 포커스 링 — 셀 트리거(버튼)에 키보드 포커스(Tab)가 올 때만 패딩 포함한 한 겹 링.
 * 버튼은 클릭(마우스)으로 포커스돼도 `:focus-visible` 이 아니므로, 클릭으로 편집에 진입할 땐
 * 애초에 링 조건이 성립하지 않는다(= 링 없음). 키보드 Tab 으로 셀에 올 때만 링이 뜬다.
 * (편집 패널 안 input 은 텍스트라 늘 focus-visible 이라 패널엔 링을 두지 않는다 — 클릭 진입에도 떠버림.)
 * 텍스트·select 셀 트리거가 같은 링을 공유.
 */
export const CELL_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type CellEditorProps = {
  value: string
  /** 커밋(값 변경 시에만 호출). */
  onCommit: (value: string) => void
  placeholder?: string
  /** 키·식별자 등 모노스페이스 표시/입력. */
  mono?: boolean
  type?: 'text' | 'url'
  /** 셀에 보일 표시(미지정 시 value 또는 placeholder). */
  display?: ReactNode
  ariaLabel?: string
  /** Enter 커밋 직후 호출 — 인라인표에서 "다음 행으로 이동" 등. */
  onEnter?: () => void
  /** 제어 모드(열림 상태를 부모가 관리). 미지정 시 자체 토글. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * 입력창 타이포그래피 클래스(셀 표시와 일치시키기 위함). 미지정 시 `text-sm`(셀 표준 14px) —
   * Input size='sm' 의 기본 text-xs(12px) 를 셀 디스플레이와 동등하게 끌어올린다(노션식: 편집 진입 시 타이포 미변).
   * 타이틀처럼 더 큰 폰트(text-[15px] font-medium)가 필요하면 호출자가 직접 지정한다.
   */
  inputClassName?: string
}

export function CellEditor({
  value,
  onCommit,
  placeholder: placeholderProp,
  mono,
  type = 'text',
  display,
  ariaLabel,
  onEnter,
  open: controlledOpen,
  onOpenChange,
  inputClassName,
}: CellEditorProps) {
  const c = cellEditorCopy(useCollectionLocale())
  const placeholder = placeholderProp ?? c.empty
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const [draft, setDraft] = useState(value)
  const skipCommitRef = useRef(false)

  const setOpenState = (next: boolean) => {
    if (isControlled) onOpenChange?.(next)
    else setUncontrolledOpen(next)
  }

  // 열릴 때 draft 를 현재 값으로 동기화(편집 도중 부모 리렌더로 덮어쓰지 않게 value 는 deps 제외).
  useEffect(() => {
    if (open) {
      setDraft(value)
      skipCommitRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commitAndClose = () => {
    if (draft !== value) onCommit(draft)
    skipCommitRef.current = true // 뒤따르는 onOpenChange(false) 의 중복 커밋 방지
    setOpenState(false)
  }

  // AnchorContextSurface 가 바깥 클릭/Escape 로 닫을 때. 바깥 클릭=커밋, (Escape 는 아래 키핸들러가 skip 설정).
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setOpenState(true)
      return
    }
    if (!skipCommitRef.current && draft !== value) onCommit(draft)
    skipCommitRef.current = false
    setOpenState(false)
  }

  const text = value.trim()

  return (
    <AnchorContextSurface
      open={open}
      onOpenChange={handleOpenChange}
      panelRole="dialog"
      panelPlacement="overlay"
      panelAriaLabel={ariaLabel}
      panelClassName={CELL_PANEL_WIDTH}
      surface={
        <button
          type="button"
          data-table-row-stop
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => handleOpenChange(!open)}
          className={cn(
            'flex min-h-7 w-full items-center rounded-md px-1.5 text-left text-sm transition-colors hover:bg-surface',
            CELL_FOCUS_RING,
          )}
        >
          {display ??
            (text ? (
              <span
                className={cn('min-w-0 truncate', mono ? 'font-mono text-fg-muted' : 'text-fg')}
              >
                {text}
              </span>
            ) : (
              <span className="truncate text-fg-muted">{placeholder}</span>
            ))}
        </button>
      }
      panel={
        <div className="p-1">
          <Input
            autoFocus
            chrome="ghost"
            size="sm"
            type={type === 'url' ? 'url' : 'text'}
            value={draft}
            onValueChange={setDraft}
            placeholder={placeholder}
            // 안쪽 입력 포커스 링 제거 — 활성 표시는 바깥 패널 박스 링(CELL_PANEL_RING)이 담당.
            // 타이포: 기본 `text-sm`(셀 디스플레이와 동등) — size='sm' 의 text-xs 를 덮어쓴다. 호출자가 inputClassName 으로 추가 오버라이드 가능.
            className={cn(
              'text-sm focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0',
              mono && 'font-mono',
              inputClassName,
            )}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitAndClose()
                onEnter?.()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                skipCommitRef.current = true
                setOpenState(false)
              }
            }}
          />
        </div>
      }
    />
  )
}

// ─── 위치(geo) 셀 편집기 ─────────────────────────────────────────────────────
//
// GeoValue(경위도 + 도로명주소)를 셀 위 패널에서 입력한다(#45·#36). 도로명·건물명은
// AddressAutocomplete(카카오 지오코딩 프록시)로 검색해 고르면 경위도(x/y)·좌표계까지 한 번에 채운다.
// 좌표·상세주소는 여전히 손으로 보정 가능하고, 좌표가 채워지면 아래에 Mapbox 미리보기(핀)를 보여준다.
// 프로바이더 교체(카카오→구글)는 서버 lib/infra/geocode 한 곳 — 이 컴포넌트는 결과(GeoSearchResult)만 안다.
// 커밋 규칙: 패널 바깥 클릭/Escape 로 닫으면 현재 입력을 커밋(roadAddress·좌표가 모두 비면 null).

/** geo 좌표계 선택지 — CoordinateSystem 미러(기본 WGS84). 라벨은 사용자에게 익숙한 통칭을 곁들인다. */
const COORDINATE_SYSTEM_OPTIONS: { value: CoordinateSystem; label: string }[] = [
  { value: 'WGS84', label: 'WGS84 (GPS)' },
  { value: 'WCONGNAMUL', label: 'WCONGNAMUL' },
  { value: 'CONGNAMUL', label: 'CONGNAMUL' },
  { value: 'WTM', label: 'WTM' },
  { value: 'TM', label: 'TM' },
]

/**
 * geo 입력 드래프트. `jibunAddress` 는 확정 카드의 보조 라벨(지번) 표시용 세션 상태로,
 * GeoValue 로 영속하지 않는다(스키마엔 roadAddress·detailAddress·coordinate 만 있음 §types).
 * 따라서 기존 값을 다시 열면 지번은 비어 있고(카드 보조라인 생략), 새로 검색해 고를 때만 채워진다.
 */
type GeoDraft = {
  roadAddress: string
  detailAddress: string
  jibunAddress: string
  x: string
  y: string
  type: CoordinateSystem
}

/** 빈 geo 드래프트 — 미설정(null) 셀을 열었을 때의 초기 입력값. */
const EMPTY_GEO_DRAFT: GeoDraft = {
  roadAddress: '',
  detailAddress: '',
  jibunAddress: '',
  x: '',
  y: '',
  type: 'WGS84',
}

/** PropertyValue(GeoValue | null) → 입력용 문자열 드래프트. 좌표 숫자는 문자열로(빈칸 허용). */
function toGeoDraft(value: GeoValue | null): GeoDraft {
  if (!value) return EMPTY_GEO_DRAFT
  return {
    roadAddress: value.roadAddress,
    detailAddress: value.detailAddress ?? '',
    jibunAddress: '', // 영속되지 않음 — 재오픈 시 미상(카드 보조라인 생략).
    x: String(value.coordinate.x),
    y: String(value.coordinate.y),
    type: value.coordinate.type,
  }
}

/**
 * 검색 결과 선택 → 드래프트 갱신(순수). 도로명 우선(없으면 지번, 그것도 없으면 장소명)으로 주소를 채우고,
 * 좌표(x/y/좌표계)를 함께 반영한다.
 *
 * POI 자동주입: 가게·지하철역 등 **장소(placeName)** 를 고르면, 그 장소명이 곧 상세주소 역할을 하므로
 * 상세주소가 아직 비어 있을 때 장소명을 상세주소로 자동으로 넣는다. 단 순수 주소 결과(placeName 이
 * 주소와 같거나 없음)에는 넣지 않는다(도로명주소가 그대로 상세주소로 새는 것을 방지).
 */
export function applyGeoResult(prev: GeoDraft, r: GeoSearchResult): GeoDraft {
  const address = r.roadAddress || r.jibunAddress // 실제 주소(도로명 우선)
  const label = address || r.placeName // 주소가 전혀 없으면 장소명으로 폴백
  const isPoi = r.placeName !== '' && address !== '' && r.placeName !== address
  const detailAddress = prev.detailAddress.trim() === '' && isPoi ? r.placeName : prev.detailAddress
  return {
    ...prev,
    roadAddress: label,
    // 지번이 도로명(=label)과 다를 때만 보조라인으로 보관.
    jibunAddress: r.jibunAddress && r.jibunAddress !== label ? r.jibunAddress : '',
    detailAddress,
    x: String(r.x),
    y: String(r.y),
    type: r.coordinateSystem,
  }
}

/**
 * 좌표 입력 상태 판정 — 데이터 무결성의 핵심.
 *  - 'both': 경도·위도 둘 다 유효 숫자 → 실제 좌표.
 *  - 'none': 둘 다 비었음 → 좌표 미설정(도로명만 있을 수 있음).
 *  - 'partial': 정확히 하나만 채워짐 → 반쪽 좌표. 커밋하지 않고 사용자에게 보완을 요청한다.
 * (한쪽만 채운 입력을 0 으로 폴백 영속하면 기니만 앞바다(0,0)에 가짜 핀이 찍힌다 — #36 회귀.)
 */
function coordState(d: GeoDraft): 'both' | 'none' | 'partial' {
  const xFilled = d.x.trim() !== '' && Number.isFinite(Number(d.x))
  const yFilled = d.y.trim() !== '' && Number.isFinite(Number(d.y))
  if (xFilled && yFilled) return 'both'
  if (!xFilled && !yFilled) return 'none'
  return 'partial'
}

/**
 * 입력 드래프트 → 커밋할 GeoValue(또는 null). 도로명주소·좌표가 모두 비면 null(미설정).
 *
 * 좌표 표현 모델(중요): GeoValue.coordinate 는 필수 필드라 도로명주소만 입력해도 좌표 자리를
 * 채워야 한다. 그 sentinel 로 (0,0) 을 쓴다 → "좌표 미설정". 지도 핀(#36)은 isGeoValue 가
 * 아니라 geo.hasGeoCoordinate(0,0 제외)로 게이트해 가짜 핀을 막는다.
 *
 * 반쪽 좌표('partial')는 여기서 커밋하지 않는다(호출자가 coordState 로 가드) — 0 폴백으로
 * 절반만 영속해 가짜 좌표가 새는 것을 차단한다.
 */
function fromGeoDraft(d: GeoDraft): GeoValue | null {
  const road = d.roadAddress.trim()
  const hasCoord = coordState(d) === 'both'
  if (road === '' && !hasCoord) return null
  const detail = d.detailAddress.trim()
  return {
    coordinate: {
      x: hasCoord ? Number(d.x) : 0,
      y: hasCoord ? Number(d.y) : 0,
      type: d.type,
    },
    roadAddress: road,
    ...(detail ? { detailAddress: detail } : {}),
  }
}

export type GeoCellEditorProps = {
  /** 현재 값(GeoValue | null). 객체가 아니면 미설정으로 취급. */
  value: GeoValue | null
  /** 커밋 — 값이 바뀐 경우에만 호출. null = 미설정. */
  onCommit: (value: GeoValue | null) => void
}

/**
 * 위치(geo) 셀 편집기 — CellEditor 와 동일한 패널 인터랙션(셀 위 고정폭 패널)으로 GeoValue 를 입력한다.
 * 셀 트리거엔 도로명주소(없으면 좌표) 라벨을, 패널엔 도로명주소 검색을 먼저 두고 나머지는 단계적으로 드러낸다:
 *  - 상세주소는 도로명주소가 채워진 뒤에만 보인다(빈 폼에 필드가 다 늘어서 있지 않게).
 *  - 경도/위도/좌표계는 평소엔 접혀 있고(자동완성이 이미 채워주므로), 토글로만 펼친다.
 *  - Mapbox 미리보기(단순 핀)는 좌표가 채워지면 항상 맨 아래.
 * 바깥 클릭/Escape 닫힘 시 현재 입력을 커밋한다(Escape 도 커밋 — 다필드 폼이라 부분입력 유실 방지).
 */
export function GeoCellEditor({ value, onCommit }: GeoCellEditorProps) {
  const c = cellEditorCopy(useCollectionLocale())
  const current = isGeoValue(value) ? value : null
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<GeoDraft>(() => toGeoDraft(current))
  // 좌표(x/y/좌표계) 수동 입력 섹션 노출 여부 — 기본 접힘(자동완성이 보통 채워줌).
  const [coordsExpanded, setCoordsExpanded] = useState(false)
  // 검색 단계 여부 — true 면 주소 검색, false 면 확정(상세주소 입력). 기존 주소가 있으면 확정으로 연다.
  const [searching, setSearching] = useState(() => !current || current.roadAddress.trim() === '')

  // 열릴 때 현재 값으로 드래프트 동기화(편집 도중 부모 리렌더로 덮지 않게 value 는 deps 제외).
  useEffect(() => {
    if (open) {
      setDraft(toGeoDraft(current))
      setCoordsExpanded(false)
      setSearching(!current || current.roadAddress.trim() === '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // 반쪽 좌표(경도·위도 중 하나만 입력) — 커밋을 막고 인라인 힌트로 보완을 요청한다.
  const isPartialCoord = coordState(draft) === 'partial'
  const hasCoords = coordState(draft) === 'both'
  // 반쪽 좌표(직접 입력 도중)면 경고를 보려면 섹션이 펼쳐져 있어야 한다.
  const showCoordsSection = coordsExpanded || isPartialCoord

  const commit = () => {
    // 반쪽 좌표면 절반만 0 으로 영속(가짜 핀 #36)되지 않도록 커밋 자체를 생략한다.
    if (isPartialCoord) return
    const next = fromGeoDraft(draft)
    // 동등 비교는 라벨·좌표·좌표계 단위로 — 변화 없으면 커밋하지 않는다(불필요 저장 방지).
    if (!geoEquals(next, current)) onCommit(next)
  }

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setOpen(true)
      return
    }
    commit()
    setOpen(false)
  }

  const label = current ? formatGeoLabel(current) : ''

  // 확정 단계 = 검색 중이 아니고 도로명주소가 있을 때. 이때만 상세주소를 노출한다(검색→선택→상세주소 순).
  const confirmed = !searching && draft.roadAddress.trim() !== ''

  // 검색 결과 선택 → 드래프트 채우고(POI 는 상세주소 자동주입) 확정 단계로 넘어간다.
  const handleSelectResult = (r: GeoSearchResult) => {
    setDraft((d) => applyGeoResult(d, r))
    setSearching(false)
  }

  return (
    <AnchorContextSurface
      open={open}
      onOpenChange={handleOpenChange}
      panelRole="dialog"
      panelPlacement="overlay"
      panelAriaLabel={c.locationEdit}
      panelClassName={CELL_PANEL_WIDTH}
      surface={
        <button
          type="button"
          data-table-row-stop
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => handleOpenChange(!open)}
          className={cn(
            'flex min-h-7 w-full items-center rounded-md px-1.5 text-left text-sm transition-colors hover:bg-surface',
            CELL_FOCUS_RING,
          )}
        >
          {label ? (
            <span className="min-w-0 truncate text-fg">{label}</span>
          ) : (
            <span className="truncate text-fg-muted">{c.noLocation}</span>
          )}
        </button>
      }
      panel={
        <div className="flex flex-col gap-2 p-2">
          {/* 헤더 — 무엇을 입력하는 패널인지 명시(핀 아이콘 + 라벨). */}
          <div className="flex items-center gap-1.5 px-0.5 text-xs font-medium text-fg-muted">
            <MapPin className="size-3.5" aria-hidden />
            <span>{searching ? c.addressSearchHeader : c.addressHeader}</span>
          </div>

          {confirmed ? (
            <>
              {/* 확정 카드 — 선택한 주소를 명확히 보여주고 "변경"으로 되돌린다. */}
              <div className="flex items-start gap-2 rounded-md border border-border bg-surface px-2 py-1.5">
                <Check className="mt-0.5 size-3.5 shrink-0 text-fg" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="min-w-0 truncate text-sm text-fg">{draft.roadAddress}</span>
                  {draft.jibunAddress && (
                    <span className="min-w-0 truncate text-[11px] text-fg-muted">
                      {c.jibunPrefix} · {draft.jibunAddress}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  data-table-row-stop
                  onClick={() => setSearching(true)}
                  className="shrink-0 text-[11px] text-fg-muted underline-offset-2 transition-colors hover:text-fg hover:underline"
                >
                  {c.changeAddress}
                </button>
              </div>
              {/* 상세주소 — 주소 확정 뒤에만 등장(자동 포커스). */}
              <Input
                autoFocus
                size="sm"
                value={draft.detailAddress}
                onValueChange={(v) => setDraft((d) => ({ ...d, detailAddress: v }))}
                placeholder={c.detailAddressPlaceholder}
                aria-label={c.detailAddressLabel}
              />
            </>
          ) : (
            <>
              <AddressAutocomplete
                autoFocus
                value={draft.roadAddress}
                onValueChange={(v) => setDraft((d) => ({ ...d, roadAddress: v }))}
                onSelect={handleSelectResult}
                placeholder={c.roadAddressSearch}
                ariaLabel={c.addressSearchHeader}
              />
              {/* 지오코딩 미설정·무결과 대비 탈출구 — 입력한 텍스트를 그대로 주소로 확정. */}
              {draft.roadAddress.trim() !== '' && (
                <button
                  type="button"
                  data-table-row-stop
                  onClick={() => setSearching(false)}
                  className="self-start text-left text-[11px] text-fg-muted transition-colors hover:text-fg"
                >
                  {c.useTypedAddress}
                </button>
              )}
            </>
          )}
          <button
            type="button"
            data-table-row-stop
            onClick={() => setCoordsExpanded((s) => !s)}
            className="self-start text-left text-[11px] text-fg-muted transition-colors hover:text-fg"
          >
            {hasCoords ? c.editCoordinates : c.enterCoordinates}
          </button>
          {showCoordsSection && (
            <>
              <div className="flex gap-1.5">
                <Input
                  size="sm"
                  type="number"
                  value={draft.x}
                  onValueChange={(v) => setDraft((d) => ({ ...d, x: v }))}
                  placeholder={c.longitudePlaceholder}
                  aria-label={c.longitudeLabel}
                />
                <Input
                  size="sm"
                  type="number"
                  value={draft.y}
                  onValueChange={(v) => setDraft((d) => ({ ...d, y: v }))}
                  placeholder={c.latitudePlaceholder}
                  aria-label={c.latitudeLabel}
                />
              </div>
              {isPartialCoord && (
                <p role="alert" className="text-[11px] text-error-text">
                  {c.coordHint}
                </p>
              )}
              <Select
                size="sm"
                options={COORDINATE_SYSTEM_OPTIONS}
                value={draft.type}
                onChange={(v) => setDraft((d) => ({ ...d, type: v as CoordinateSystem }))}
                placeholder={c.coordSystem}
              />
            </>
          )}
          {hasCoords && (
            <Suspense fallback={<div className="h-[132px] rounded-md bg-surface" />}>
              <GeoMiniPreview x={Number(draft.x)} y={Number(draft.y)} />
            </Suspense>
          )}
        </div>
      }
    />
  )
}

/** 두 GeoValue(또는 null)의 의미 동등 비교 — 커밋 가드용. 좌표·라벨·좌표계·상세주소를 모두 본다. */
function geoEquals(a: GeoValue | null, b: GeoValue | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.coordinate.x === b.coordinate.x &&
    a.coordinate.y === b.coordinate.y &&
    a.coordinate.type === b.coordinate.type &&
    a.roadAddress === b.roadAddress &&
    (a.detailAddress ?? '') === (b.detailAddress ?? '')
  )
}

// ─── 날짜(date) 셀 편집기 ────────────────────────────────────────────────────
//
// date 프로퍼티를 셀 위 패널의 공용 DS `DateEditPanel`(노션식: 입력 + 달력 + 종료일/시간 토글 + 오늘/삭제)에서
// 편집한다. DatePicker 와 같은 패널 본문을 공유해 "날짜 편집"이 앱 전역에서 동일하다.
//
// 값 표현은 date-value 규약을 따른다: 'YYYY-MM-DD' | 'YYYY-MM-DDTHH:mm'(시간) | '<start>/<end>'(기간).
// 문자열 ↔ {start,end,hasTime}(Date) 변환은 date-value 헬퍼가 담당(로컬 자정 앵커, TZ 밀림 방지).
// 기간/시간을 끝까지 편집할 수 있도록 값 변경마다 라이브 커밋하되 패널은 닫지 않는다(바깥 클릭 시 닫힘).

export type DateCellEditorProps = {
  /** 현재 값 — date-value 문자열('YYYY-MM-DD'·datetime·기간). 빈/비문자열이면 미설정. */
  value: string
  /** 커밋 — 값이 바뀔 때 호출(라이브). null = 미설정(지움). */
  onCommit: (value: string | null) => void
  /** 트리거 글자 모양 — 컬럼의 PropertyDef.dateFormat(기본 'ko'). 표 칸과 같은 글자를 쓴다. */
  format?: DateDisplayFormat
}

/**
 * 날짜(date) 셀 편집기 — 공용 DateEditPanel 로 단일/기간/시간 날짜를 편집한다. 트리거엔 표시용 라벨
 * (단일·"start ~ end"·시간 포함), 없으면 "날짜 없음".
 */
export function DateCellEditor({ value, onCommit, format }: DateCellEditorProps) {
  const c = cellEditorCopy(useCollectionLocale())
  const [open, setOpen] = useState(false)
  const parts = parseDateValueParts(value)
  const panelValue: DateEditValue = parts.start
    ? { start: parts.start, end: parts.end, hasTime: parts.hasTime }
    : null
  const label = formatDateValueDisplay(value, format)

  // 라이브 커밋 — 기간/시간 편집 중에도 즉시 반영. 닫기는 바깥 클릭(AnchorContextSurface)이 담당.
  const handleChange = (v: DateEditValue) => {
    onCommit(v ? buildDateValue({ start: v.start, end: v.end, hasTime: v.hasTime }) : null)
  }

  return (
    <AnchorContextSurface
      open={open}
      onOpenChange={setOpen}
      panelRole="dialog"
      panelPlacement="overlay"
      panelAriaLabel={c.dateEdit}
      panelClassName={CELL_PANEL_WIDTH}
      surface={
        <button
          type="button"
          data-table-row-stop
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'flex min-h-7 w-full items-center rounded-md px-1.5 text-left text-sm transition-colors hover:bg-surface',
            CELL_FOCUS_RING,
          )}
        >
          {label ? (
            <span className="min-w-0 truncate text-fg">{label}</span>
          ) : (
            <span className="truncate text-fg-muted">{c.noDate}</span>
          )}
        </button>
      }
      panel={
        <div className="p-2">
          <DateEditPanel value={panelValue} onChange={handleChange} density="compact" />
        </div>
      }
    />
  )
}
