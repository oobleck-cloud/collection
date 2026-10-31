'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Input, Search, cn } from '@oobleck/systheme'
import type { GeoSearchResult } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { addressAutocompleteCopy } from './AddressAutocomplete.messages'

// geo 셀 주소 검색 자동완성(#36) — 도로명·건물명 입력 → /api/geocode/search 프록시로 후보를 받아
// 목록에서 고르면 좌표(경위도)까지 한 번에 채운다. 프로바이더(Kakao/Google)는 서버 뒤에 숨는다.
//
// 결과 목록은 *패널 안 인라인*으로 렌더한다(별도 포털 X): geo 편집기 자체가 AnchorContextSurface
// 패널이라, 중첩 포털을 쓰면 결과 클릭이 "패널 바깥"으로 오인돼 커밋·닫힘이 튀는 걸 피한다.
//
// 재사용 가능(geo 셀 외 표준 주소 폼에서도) — 입력값·onSelect 만 주입한다.

const SEARCH_DEBOUNCE_MS = 300
const SEARCH_ENDPOINT = '/api/geocode/search'
/** 1글자 질의는 노이즈 — 2글자 이상부터 검색한다. */
const MIN_QUERY_LEN = 2

/** 검색 상태 — 정직한 상태 표현(로딩·결과·미설정·오류를 각각 명시). */
type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; results: GeoSearchResult[] }
  | { status: 'unconfigured' } // KAKAO_REST_API_KEY 미설정 — 안내만
  | { status: 'error' }

export type AddressAutocompleteProps = {
  /** 입력값(도로명주소 텍스트) — 제어 컴포넌트. */
  value: string
  /** 타이핑 반영. */
  onValueChange: (value: string) => void
  /** 후보 선택 — 좌표까지 채우도록 결과 전체를 넘긴다. */
  onSelect: (result: GeoSearchResult) => void
  placeholder?: string
  autoFocus?: boolean
  ariaLabel?: string
}

/** 결과 후보의 표시 제목(장소명 우선 → 도로명 → 지번). 빈 결과는 렌더 단계에서 제외되므로 항상 비지 않는다. */
function resultTitle(r: GeoSearchResult): string {
  return r.placeName || r.roadAddress || r.jibunAddress
}

/** 결과 후보의 보조 라인(도로명 우선, 제목과 겹치면 지번). 없으면 ''. */
function resultSubtitle(r: GeoSearchResult): string {
  const title = resultTitle(r)
  const road = r.roadAddress && r.roadAddress !== title ? r.roadAddress : ''
  if (road) return road
  return r.jibunAddress && r.jibunAddress !== title ? r.jibunAddress : ''
}

export function AddressAutocomplete({
  value,
  onValueChange,
  onSelect,
  placeholder,
  autoFocus,
  ariaLabel,
}: AddressAutocompleteProps) {
  const c = addressAutocompleteCopy(useCollectionLocale())
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<SearchState>({ status: 'idle' })
  const [activeIndex, setActiveIndex] = useState(-1)
  // 진행 중 요청 식별 — 늦게 도착한 stale 응답이 최신 상태를 덮지 않도록(race 가드).
  const seqRef = useRef(0)
  const listboxId = useId()

  // 디바운스 검색 — open 이고 질의가 충분히 길 때만. 선택 후엔 open=false 라 재검색하지 않는다.
  useEffect(() => {
    if (!open) return
    const q = value.trim()
    if (q.length < MIN_QUERY_LEN) {
      setState({ status: 'idle' })
      return
    }
    const seq = ++seqRef.current
    setState({ status: 'loading' })
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`)
          const body = (await res.json().catch(() => ({}))) as {
            results?: GeoSearchResult[]
            configured?: boolean
          }
          if (seq !== seqRef.current) return // stale — 최신 질의가 아니면 버린다
          if (body?.configured === false) return setState({ status: 'unconfigured' })
          if (!res.ok) return setState({ status: 'error' })
          setState({ status: 'ready', results: Array.isArray(body.results) ? body.results : [] })
          setActiveIndex(-1)
        } catch {
          if (seq === seqRef.current) setState({ status: 'error' })
        }
      })()
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [value, open])

  const results = state.status === 'ready' ? state.results : []

  const handleSelect = (r: GeoSearchResult) => {
    seqRef.current++ // 진행 중 검색 무효화(선택 직후 stale 응답 차단)
    setOpen(false)
    setState({ status: 'idle' })
    setActiveIndex(-1)
    onSelect(r)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      handleSelect(results[activeIndex])
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Input
        autoFocus={autoFocus}
        size="sm"
        prefix={<Search className="size-3.5" aria-hidden />}
        value={value}
        onValueChange={(v) => {
          onValueChange(v)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? c.searchPlaceholder}
        aria-label={ariaLabel ?? c.searchAria}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
      />
      {open && (
        <AddressResults
          id={listboxId}
          state={state}
          activeIndex={activeIndex}
          onSelect={handleSelect}
        />
      )}
    </div>
  )
}

/** 결과 목록 — 상태별 렌더. 패널 안 인라인(스크롤 상한). 클릭 시 포커스 뺏김/blur 닫힘을 막으려 mousedown 억제. */
function AddressResults({
  id,
  state,
  activeIndex,
  onSelect,
}: {
  id: string
  state: SearchState
  activeIndex: number
  onSelect: (r: GeoSearchResult) => void
}) {
  const c = addressAutocompleteCopy(useCollectionLocale())
  if (state.status === 'idle') return null

  // 상태 메시지·결과 목록을 공통 드롭다운 박스(테두리+배경) 안에 렌더 — "검색 결과 영역"으로 읽히게.
  const box = 'overflow-hidden rounded-md border border-border bg-background'

  if (state.status === 'loading') {
    return (
      <div className={box}>
        <p className="px-2 py-1.5 text-xs text-fg-muted">{c.loading}</p>
      </div>
    )
  }
  if (state.status === 'unconfigured') {
    return (
      <div className={box}>
        <p className="px-2 py-1.5 text-xs text-fg-muted">{c.unconfigured}</p>
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className={box}>
        <p className="px-2 py-1.5 text-xs text-error-text">{c.searchFailed}</p>
      </div>
    )
  }
  if (state.results.length === 0) {
    return (
      <div className={box}>
        <p className="px-2 py-1.5 text-xs text-fg-muted">{c.noResults}</p>
      </div>
    )
  }

  return (
    <div className={box}>
      <ul
        id={id}
        role="listbox"
        aria-label={c.candidatesAria}
        className="max-h-52 overflow-y-auto p-1"
      >
        {state.results.map((r, i) => {
          const subtitle = resultSubtitle(r)
          return (
            <li key={r.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                data-table-row-stop
                onMouseDown={(e) => e.preventDefault()} // 결과 클릭이 input blur/패널 닫힘을 유발하지 않게
                onClick={() => onSelect(r)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface',
                  i === activeIndex && 'bg-surface',
                )}
              >
                <span className="min-w-0 truncate text-sm text-fg">{resultTitle(r)}</span>
                {subtitle && (
                  <span className="min-w-0 truncate text-xs text-fg-muted">{subtitle}</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
