'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { asyncSuggesters, rankSuggestions, syncSuggestions } from '@oobleck/collection'

import type { SearchSuggestion } from '@oobleck/collection'
import type { PropertyDef } from '@oobleck/collection'

// @oobleck/collection — 제안 엔진의 **실행** 층(순수 규칙은 search-suggest.ts).
//
// 여기서 다루는 건 규칙이 아니라 시간이다. 판정이 비동기가 되는 순간 네 가지가 따라온다:
//
// 1. **즉답을 기다리지 않는다.** 타입 규칙(날짜·번호·전화·select)은 계산이 끝나 있으므로
//    바로 그린다. 구역 조회 한 건 때문에 드롭다운 전체가 멈추면, 있는 답도 없는 것처럼 보인다.
// 2. **낡은 응답을 버린다.** "성북"→"성북구" 를 빠르게 치면 앞 요청이 늦게 도착해 최신 입력의
//    결과를 덮어쓴다. 자동완성에서 가장 흔하고 가장 안 보이는 버그다 — 화면엔 그럴듯한 목록이
//    떠 있고 그게 한 글자 전의 답이라는 건 아무 데도 안 적혀 있다. 그래서 요청마다 세대(seq)를
//    물리고, 도착 시점에 세대가 다르면 결과를 통째로 버린다.
// 3. **하나가 죽어도 목록은 산다.** 판정기가 던지거나 늦으면 그 컬럼만 빠지고 나머지는 그대로.
// 4. **지우고 다시 치는 건 재조회가 아니다.** term+key 캐시로 같은 질문을 두 번 보내지 않는다.

/** 조사형 판정기 하나에 허용하는 시간. 넘으면 그 컬럼만 조용히 빠진다. */
const PROBE_TIMEOUT_MS = 2500
/** API 콜이 붙는 판정기의 디바운스. 동기 규칙은 이 지연을 타지 않는다. */
const PROBE_DEBOUNCE_MS = 200

export type UseSearchSuggestResult = {
  /** 동기 + (도착한) 비동기 제안. strong 먼저. */
  suggestions: SearchSuggestion[]
  /** 조사형 판정기가 아직 응답 중인가 — 목록 하단 "찾는 중" 표시용. */
  probing: boolean
}

/** `Promise.race` 로 개별 타임아웃. 타임아웃도 실패와 같게 취급한다(빈 결과). */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

/**
 * 검색어 → 제안 목록. 동기 결과는 즉시, 조사형은 디바운스 후 도착하는 대로 합류한다.
 *
 * `schema` 는 호출부가 `useMemo` 로 안정화해 넘기는 것을 전제한다(매 렌더 새 배열이면
 * 조사 effect 가 매번 다시 돈다).
 */
export function useSearchSuggest(term: string, schema: PropertyDef[]): UseSearchSuggestResult {
  const trimmed = term.trim()

  // 동기 결과 — 렌더 중에 계산한다. 상태로 들고 있을 이유가 없다(입력에서 곧바로 파생).
  const sync = useMemo(() => syncSuggestions(trimmed, schema), [trimmed, schema])

  const probes = useMemo(() => asyncSuggesters(schema), [schema])
  const [async_, setAsync] = useState<SearchSuggestion[]>([])
  const [probing, setProbing] = useState(false)

  // term+key → 결과. 지우고 다시 치는 흔한 동작에 재조회가 안 나가게 한다.
  // 키 구분자는 NUL(\u0000). 검색어에 섞일 일이 없는 제어문자라 term 과 key 의 경계가
  // 뭉개지지 않는다. 소스에는 반드시 이스케이프로 적는다 — 날 NUL 을 넣으면 파일이
  // 바이너리로 취급돼 grep 에서 통째로 사라진다.
  const cache = useRef(new Map<string, SearchSuggestion[]>())
  // 세대 카운터 — 낡은 응답 판별의 유일한 기준.
  const seqRef = useRef(0)

  useEffect(() => {
    const seq = ++seqRef.current

    if (trimmed === '' || probes.length === 0) {
      setAsync([])
      setProbing(false)
      return
    }

    const cached = probes
      .map((def) => cache.current.get(`${trimmed}\u0000${def.key}`))
      .filter((v): v is SearchSuggestion[] => v !== undefined)

    // 전부 캐시에 있으면 디바운스도 네트워크도 없다.
    if (cached.length === probes.length) {
      setAsync(cached.flat())
      setProbing(false)
      return
    }

    setProbing(true)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void Promise.all(
        probes.map(async (def) => {
          const cacheKey = `${trimmed}\u0000${def.key}`
          const hit = cache.current.get(cacheKey)
          if (hit) return hit

          const run = Promise.resolve(
            def.suggest?.(trimmed, { def, signal: controller.signal }) ?? [],
          )
          const out = await withTimeout(run, PROBE_TIMEOUT_MS, [] as SearchSuggestion[])
          // 낡은 세대의 응답은 캐시에도 넣지 않는다 — 취소된 요청의 부분 결과일 수 있다.
          if (seqRef.current === seq) cache.current.set(cacheKey, out)
          return out
        }),
      ).then((results) => {
        // 도착 시점에 세대가 바뀌었으면 통째로 버린다.
        if (seqRef.current !== seq) return
        setAsync(results.flat())
        setProbing(false)
      })
    }, PROBE_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [trimmed, probes])

  const suggestions = useMemo(() => rankSuggestions([...sync, ...async_]), [sync, async_])

  return { suggestions, probing }
}
