'use client'

import { AnchorContextSurface, Input, PanelRight, Tag, cn } from '../kit'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useCollectionLocale } from '../i18n'

import { relationCellCopy } from './RelationCell.messages'

import type {
  PropertyValue,
  RelationCardinality,
  RelationOption,
  RelationProvider,
} from '@oobleck/collection'

// Relation 셀(노션식) — 검색·자동완성 + 단일/다중 카디널리티.
// 닫힘 상태: 현재 선택된 관계의 칩(라벨은 provider.resolve 로 캐시). 빈 상태는 placeholder.
//
// 편집 장치는 손댈 때만 보인다 — 칩의 지우기(✕)와 빈 칸의 「관계 선택」은 행 hover(group/row)·칸 hover·
// focus-within·패널 열림일 때만 그린다. 읽는 화면에서 ✕ 수십 개와 회색 안내가 표를 덮지 않게(평소엔 칩만, 빈 칸은 비움).
//
// 행 높이 정책(편집형 multi_select 와 같다): wrap=false(기본)면 칩을 한 줄로 자르고 숨은 개수를 「+N」으로 적는다 —
// 칩이 많아도 행이 두 줄로 늘지 않는다. 전체 목록은 title(툴팁)과 고르기 패널에서 본다. wrap=true 면 줄바꿈.
// 열림 상태: 검색 인풋 + 결과 목록(provider.search). overlay 패널로 셀 클리핑과 무관.
//
// 칩 모양은 옵션이 정한다 — `parts`(앞말·본말)가 있는 옵션은 회색 면 계층 칩(DS Tag subtle·cell, 앞말 흐리게·본말 굵게),
// 없는 옵션은 기본 칩. 컬렉션은 대상이 무엇인지(구역인지) 모른다 — provider 가 옵션에 실어 보낸다.
// 덮임(`coveredBy`): 같은 칸에 덮는 레코드가 함께 있으면 덮인 칩은 숨긴다(「고양 전체」가 「고양 덕양구」를 덮는다).
//
// 읽기 전용(onChange 없음): 같은 칩·「+N」을 그리되 ✕·고르기 패널이 없고, 빈 칸은 「—」.
//
// 영속 값(PropertyValue):
//  - cardinality='one': string(id) | null
//  - cardinality='many': string[] | null

export type RelationCellProps = {
  cardinality: RelationCardinality
  value: PropertyValue
  provider: RelationProvider
  /** 없으면 읽기 전용 — 칩만 그리고 고르기 패널·✕ 를 두지 않는다(코드 소유 projection 칸). */
  onChange?: (value: PropertyValue) => void
  placeholder?: string
  /**
   * 연결 대상 열기(id) — 지정 시 각 칩 옆에 "열기" 버튼이 켜진다(노션식 링크: 연결된 레코드 페이지로).
   * 미지정 시(상품 등) 칩 클릭은 편집 패널만 연다(현행 동작 불변). stopPropagation 으로 편집 패널 개방과 분리.
   */
  onOpen?: (id: string) => void
  /**
   * 빈 칸에 「—」를 적는다(편집형). 평소 편집형 빈 칸은 비워 두지만, 조건부 서식이 칸을 칠했으면 색만으로는
   * 비어 있다는 게 읽히지 않는다 — 글자색은 칸(서식)을 따른다. 손댈 때는 「관계 선택」 안내로 바뀐다.
   */
  emptyMark?: boolean
  /** true 면 칩을 줄바꿈해 모두 보인다(행 높이가 늘어남). 기본 false — 한 줄 + 「+N」(뷰의 wrapCells). */
  wrap?: boolean
}

/** PropertyValue → id 배열 정규화. null/빈문자열 = []. 단일 string → [string]. 배열은 string 강제. */
function valueToIds(value: PropertyValue): string[] {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value.map(String)
  // relation 값은 id(원시값). 객체값(GeoValue·ButtonValue)은 relation id 가 아니므로 무시([]).
  if (typeof value === 'object') return []
  return [String(value)]
}

export function RelationCell({
  cardinality,
  value,
  provider,
  onChange,
  placeholder: placeholderProp,
  onOpen,
  wrap = false,
  emptyMark = false,
}: RelationCellProps) {
  const c = relationCellCopy(useCollectionLocale())
  const placeholder = placeholderProp ?? c.selectRelation
  const ids = useMemo(() => valueToIds(value), [value])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RelationOption[]>([])
  // ids 의 라벨 캐시(provider.resolve 결과) — 셀에 보여줄 라벨이 필요해서 분리 관리.
  // null = 물었는데 provider 가 모른다고 답했다(→ id 그대로). 키가 없으면 아직 답을 못 받았다(→ 칩을 그리지 않는다 —
  // 대상 목록을 읽는 동안 UUID 가 칸에 번쩍이지 않게).
  const [labels, setLabels] = useState<Record<string, RelationOption | null>>({})
  // 라벨을 받은 provider — provider 가 바뀌면(대상 목록이 늦게 도착) 캐시를 믿지 않고 전부 다시 묻는다.
  const resolvedWith = useRef<RelationProvider | null>(null)

  // 값 변경(부모) → 라벨 캐시 동기화. 동일 id 묶음이면 캐시 재사용(부분 일치도 OK — 누락 id 만 다시 조회).
  useEffect(() => {
    if (ids.length === 0) {
      setLabels({})
      return
    }
    let cancelled = false
    const stale = resolvedWith.current !== provider
    const missing = stale ? ids : ids.filter((id) => !(id in labels))
    if (missing.length === 0) return
    void Promise.resolve(provider.resolve(missing)).then((opts) => {
      if (cancelled) return
      resolvedWith.current = provider
      setLabels((prev) => {
        const next = { ...prev }
        for (const id of missing) next[id] = null
        for (const o of opts) next[o.id] = o
        return next
      })
    })
    return () => {
      cancelled = true
    }
    // labels 는 의도적 deps 제외 — labels 변경에 의해 재실행되면 무한 루프.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, provider])

  // 검색 — 열려있을 때만, query 변화에 200ms 디바운스. 빈 query 는 provider 가 "최근/대표"를 반환할 책임.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const handle = setTimeout(() => {
      void Promise.resolve(provider.search(query)).then((opts) => {
        if (cancelled) return
        setResults(opts)
      })
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [open, query, provider])

  const readOnly = !onChange
  const commit = (next: PropertyValue) => onChange?.(next)

  const handlePick = (opt: RelationOption) => {
    // 라벨 캐시 즉시 갱신 — 부모 onChange 후 다음 렌더에서 라벨이 늦게 들어오는 것 방지.
    setLabels((prev) => ({ ...prev, [opt.id]: opt }))
    if (cardinality === 'one') {
      commit(ids[0] === opt.id ? null : opt.id)
      setOpen(false)
    } else {
      const set = new Set(ids)
      if (set.has(opt.id)) set.delete(opt.id)
      else set.add(opt.id)
      commit(set.size === 0 ? null : [...set])
    }
  }

  const handleRemove = (id: string) => {
    if (cardinality === 'one') {
      commit(null)
    } else {
      // 덮는 칩을 지우면 그 아래 숨어 있던 칩도 함께 — 「고양 전체」를 지웠는데 「고양 덕양구」가 되살아나지 않게.
      const next = ids.filter((x) => x !== id && labels[x]?.coveredBy !== id)
      commit(next.length === 0 ? null : next)
    }
  }

  // 덮인 칩은 그리지 않는다 — 덮는 레코드가 같은 칸에 있으면 그것 하나로 읽힌다.
  const shownIds = useMemo(
    () =>
      ids.filter((id) => {
        if (!(id in labels)) return false
        const by = labels[id]?.coveredBy
        return !(by && by !== id && ids.includes(by))
      }),
    [ids, labels],
  )

  // 한 줄에 못 들어가 잘린 칩 수(「+N」)와 그 표시 자리. 칩 줄은 flex-wrap + 한 줄 높이로 잘라 두고, 첫 줄보다
  // 아래로 밀린 칩을 센다. 「+N」은 첫 줄 마지막 칩 바로 뒤에 둔다(칸 오른쪽 끝이 아니라) — 칩 줄 오른쪽에 그만큼 자리를
  // 비워 두므로 겹치지 않는다. 칩 폭은 hover 때 ✕ 가 붙어 달라지므로 칸뿐 아니라 칩마다 크기 변화를 지켜본다.
  const chipsRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState<{ hidden: number; left: number }>({ hidden: 0, left: 0 })
  useLayoutEffect(() => {
    const el = chipsRef.current
    if (wrap || !el) {
      setOverflow({ hidden: 0, left: 0 })
      return
    }
    const measure = () => {
      const chips = (Array.from(el.children) as HTMLElement[]).filter(
        (c) => !c.hasAttribute('data-rel-more'),
      )
      const first = chips[0]
      if (!first) {
        setOverflow({ hidden: 0, left: 0 })
        return
      }
      // 서브픽셀 라운딩 보정 1px
      const shown = chips.filter((chip) => chip.offsetTop <= first.offsetTop + 1)
      const last = shown[shown.length - 1]!
      const next = {
        hidden: chips.length - shown.length,
        left: last.offsetLeft + last.offsetWidth,
      }
      setOverflow((prev) => (prev.hidden === next.hidden && prev.left === next.left ? prev : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    for (const chip of Array.from(el.children)) observer.observe(chip)
    return () => observer.disconnect()
  }, [shownIds, labels, wrap])
  const hiddenCount = overflow.hidden

  const labelOf = (id: string) => labels[id]?.label ?? id
  // 잘린 칩까지 전부 — 칸 툴팁(전체는 고르기 패널에서도 보인다).
  const fullText = shownIds.map(labelOf).join(', ')
  // 편집 장치(칩 ✕ · 빈 칸 안내)를 드러내는 조건 — 행 hover · 칸 hover · 포커스 · 패널 열림.
  const revealRemove = open
    ? '[&_[data-rel-chip]>button]:flex'
    : cn(
        '[&_[data-rel-chip]>button]:hidden',
        'group-hover/row:[&_[data-rel-chip]>button]:flex',
        'hover:[&_[data-rel-chip]>button]:flex',
        'focus-within:[&_[data-rel-chip]>button]:flex',
      )
  const revealPlaceholder = open
    ? 'visible'
    : 'invisible group-hover/row:visible group-hover/relcell:visible group-focus-within/relcell:visible'
  // 「—」(emptyMark)는 안내가 드러나는 순간 비켜선다 — 둘이 같은 자리를 말한다.
  const hideOnReveal = open
    ? 'hidden'
    : 'group-hover/row:hidden group-hover/relcell:hidden group-focus-within/relcell:hidden'

  const chip = (id: string) => {
    const parts = labels[id]?.parts
    const onRemove = readOnly ? undefined : () => handleRemove(id)
    // 대상에 없는 레코드(provider 가 missing 으로 답함) — 읽기 전용은 흐린 글자, 편집형은 흐린 회색 칩(지울 수 있게).
    // 무엇을 가리키는지는 title 에 id 로 남긴다.
    if (labels[id]?.missing) {
      const title = `${labelOf(id)} · ${id}`
      if (readOnly)
        return (
          <span data-rel-chip="" title={title} className="min-w-0 truncate text-fg-muted">
            {labelOf(id)}
          </span>
        )
      return (
        <Tag
          data-rel-chip=""
          variant="subtle"
          size="cell"
          shape="square"
          title={title}
          className="max-w-full min-w-0 text-fg-muted"
          onRemove={onRemove}
        >
          <span className="min-w-0 truncate">{labelOf(id)}</span>
        </Tag>
      )
    }
    // 계층 칩 — 회색 면 · 앞말 흐리게 · 본말 굵게(DS Tag qualifier). 이름은 본말만 말줄임한다.
    if (parts)
      return (
        <Tag
          data-rel-chip=""
          variant="subtle"
          size="cell"
          shape="square"
          qualifier={parts.qualifier}
          className="max-w-full min-w-0"
          onRemove={onRemove}
        >
          {parts.qualifier ? (
            parts.name
          ) : (
            // 앞말 없는 평면 값(「강남구」) — 같은 굵기로 맞춘다.
            <span className="min-w-0 truncate font-semibold">{parts.name}</span>
          )}
        </Tag>
      )
    return (
      <Tag data-rel-chip="" size="sm" className="max-w-full min-w-0" onRemove={onRemove}>
        <span className="min-w-0 truncate">{labelOf(id)}</span>
      </Tag>
    )
  }

  // 칩 줄 — 편집형·읽기 전용이 같이 쓴다.
  const chipRow = (
    <div
      ref={chipsRef}
      className={cn(
        'relative flex min-w-0 flex-1 flex-wrap items-center gap-1',
        // 칩 한 줄(계층 칩 22px · 기본 칩 20px)만 남기고 자른다 — 넘친 칩은 아래 줄로 밀려 숨는다.
        !wrap && 'max-h-5.5 overflow-hidden',
        // 「+N」 자리 — 칩이 이만큼 앞에서 꺾인다.
        !wrap && hiddenCount > 0 && 'pr-9',
      )}
    >
      {onOpen
        ? // 열기 affordance 있음 — 칩 + "열기" 버튼을 한 그룹으로(노션식 링크). stopPropagation 으로 편집 패널 개방과 분리.
          shownIds.map((id) => (
            <span key={id} className="inline-flex min-w-0 items-center gap-0.5">
              {chip(id)}
              <button
                type="button"
                data-table-row-stop
                aria-label={c.openLinked}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen(id)
                }}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:bg-surface hover:text-fg focus-visible:bg-surface focus-visible:outline-none"
              >
                <PanelRight className="size-3.5" aria-hidden />
              </button>
            </span>
          ))
        : shownIds.map((id) => (
            <span key={id} className="inline-flex min-w-0">
              {chip(id)}
            </span>
          ))}
      {!wrap && hiddenCount > 0 && (
        <span
          aria-hidden
          data-rel-more=""
          style={{ left: overflow.left + 4 }}
          // 바탕 없는 흐린 글자(시안) — 마지막 칩 뒤 4px, 칩 줄 오른쪽에 비워 둔 자리라 겹치지 않는다.
          className="absolute top-0 text-xs leading-5.5 font-medium text-fg-muted"
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  )

  if (readOnly)
    return (
      <div
        title={fullText || undefined}
        className={cn('flex w-full min-w-0 items-center text-sm', wrap ? 'min-h-7 py-0.5' : 'h-6')}
      >
        {shownIds.length === 0 ? <span className="text-fg-muted">—</span> : chipRow}
      </div>
    )

  return (
    <AnchorContextSurface
      open={open}
      onOpenChange={setOpen}
      panelRole="dialog"
      panelPlacement="overlay"
      panelMatchSurfaceWidth
      panelClassName="w-64"
      surface={
        <div
          role="button"
          tabIndex={0}
          data-table-row-stop
          title={fullText || undefined}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          className={cn(
            'group/relcell flex w-full min-w-0 cursor-pointer items-center gap-1 rounded-md px-1.5 text-left text-sm hover:bg-surface',
            // 한 줄 모드는 칩(최대 22px) + 위아래 1px — 표 M 행(48px)을 넘기지 않는다.
            wrap ? 'min-h-7 py-0.5' : 'h-6',
            revealRemove,
          )}
        >
          {shownIds.length === 0 ? (
            <>
              {emptyMark && <span className={cn('shrink-0', hideOnReveal)}>—</span>}
              <span className={cn('truncate text-fg-muted', revealPlaceholder)}>{placeholder}</span>
            </>
          ) : (
            chipRow
          )}
        </div>
      }
      panel={
        <div className="flex flex-col gap-1 p-1">
          <Input
            autoFocus
            size="sm"
            chrome="ghost"
            value={query}
            onValueChange={setQuery}
            placeholder={c.search}
            className="focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <li className="px-2 py-1 text-xs text-fg-muted">{c.noResults}</li>
            ) : (
              results.map((opt) => {
                const selected = ids.includes(opt.id)
                return (
                  <li
                    key={opt.id}
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    onClick={() => handlePick(opt)}
                    // 포인터 전용이 되지 않게 — Enter/Space 로도 선택된다(검색 입력에서 화살표로
                    // 내려온 뒤 확정하는 경로). 스페이스는 패널 스크롤로 새지 않도록 기본동작 차단.
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      e.preventDefault()
                      handlePick(opt)
                    }}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface',
                      selected && 'bg-surface',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-fg">{opt.label}</span>
                    {opt.hint && <span className="shrink-0 text-xs text-fg-muted">{opt.hint}</span>}
                    {selected && <span className="shrink-0 text-fg-muted">✓</span>}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      }
    />
  )
}
