'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnchorContextSurface, Input, PanelRight, Tag, cn } from '@oobleck/systheme'
import type { PropertyValue, RelationCardinality, RelationOption, RelationProvider } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { relationCellCopy } from './RelationCell.messages'

// Relation 셀(노션식) — 검색·자동완성 + 단일/다중 카디널리티.
// 닫힘 상태: 현재 선택된 관계의 칩(라벨은 provider.resolve 로 캐시). 빈 상태는 placeholder.
// 열림 상태: 검색 인풋 + 결과 목록(provider.search). overlay 패널로 셀 클리핑과 무관.
//
// 영속 값(PropertyValue):
//  - cardinality='one': string(id) | null
//  - cardinality='many': string[] | null

export type RelationCellProps = {
  cardinality: RelationCardinality
  value: PropertyValue
  provider: RelationProvider
  onChange: (value: PropertyValue) => void
  placeholder?: string
  /**
   * 연결 대상 열기(id) — 지정 시 각 칩 옆에 "열기" 버튼이 켜진다(노션식 링크: 연결된 레코드 페이지로).
   * 미지정 시(상품 등) 칩 클릭은 편집 패널만 연다(현행 동작 불변). stopPropagation 으로 편집 패널 개방과 분리.
   */
  onOpen?: (id: string) => void
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
}: RelationCellProps) {
  const c = relationCellCopy(useCollectionLocale())
  const placeholder = placeholderProp ?? c.selectRelation
  const ids = useMemo(() => valueToIds(value), [value])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<RelationOption[]>([])
  // ids 의 라벨 캐시(provider.resolve 결과) — 셀에 보여줄 라벨이 필요해서 분리 관리.
  const [labels, setLabels] = useState<Record<string, RelationOption>>({})

  // 값 변경(부모) → 라벨 캐시 동기화. 동일 id 묶음이면 캐시 재사용(부분 일치도 OK — 누락 id 만 다시 조회).
  useEffect(() => {
    if (ids.length === 0) {
      setLabels({})
      return
    }
    let cancelled = false
    const missing = ids.filter((id) => !labels[id])
    if (missing.length === 0) return
    void Promise.resolve(provider.resolve(missing)).then((opts) => {
      if (cancelled) return
      setLabels((prev) => {
        const next = { ...prev }
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

  const handlePick = (opt: RelationOption) => {
    // 라벨 캐시 즉시 갱신 — 부모 onChange 후 다음 렌더에서 라벨이 늦게 들어오는 것 방지.
    setLabels((prev) => ({ ...prev, [opt.id]: opt }))
    if (cardinality === 'one') {
      onChange(ids[0] === opt.id ? null : opt.id)
      setOpen(false)
    } else {
      const set = new Set(ids)
      if (set.has(opt.id)) set.delete(opt.id)
      else set.add(opt.id)
      onChange(set.size === 0 ? null : [...set])
    }
  }

  const handleRemove = (id: string) => {
    if (cardinality === 'one') {
      onChange(null)
    } else {
      const next = ids.filter((x) => x !== id)
      onChange(next.length === 0 ? null : next)
    }
  }

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
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          className="flex min-h-7 w-full cursor-pointer flex-wrap items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-sm hover:bg-surface"
        >
          {ids.length === 0 ? (
            <span className="text-fg-muted">{placeholder}</span>
          ) : onOpen ? (
            // 열기 affordance 있음 — 칩 + "열기" 버튼을 한 그룹으로(노션식 링크). stopPropagation 으로 편집 패널 개방과 분리.
            ids.map((id) => (
              <span key={id} className="inline-flex items-center gap-0.5">
                <Tag size="sm" onRemove={() => handleRemove(id)}>
                  {labels[id]?.label ?? id}
                </Tag>
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
          ) : (
            ids.map((id) => (
              <Tag key={id} size="sm" onRemove={() => handleRemove(id)}>
                {labels[id]?.label ?? id}
              </Tag>
            ))
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
