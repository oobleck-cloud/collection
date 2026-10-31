'use client'

import { AnchorContextSurface, Avatar, Input, X, cn } from '@oobleck/systheme'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'

import { useCollectionLocale } from '../i18n'
import { normalizeOptions } from '@oobleck/collection'
import { personIdsOf, searchPeople, togglePerson } from '@oobleck/collection'
import { ME_LABEL } from '@oobleck/collection'

import { personCellCopy } from './PersonCell.messages'

import type { PropertyDef, PropertyValue, SelectOption } from '@oobleck/collection'

// 사람 셀(person / multi_person) — 계정 명단에서 고르고, 이름 칩(이니셜 아바타)으로 보인다.
//
// 명단은 호스트가 `def.options` 로 채운다(value = 계정 id, label = 이름, hint = 이메일·역할,
// inactive = 비활성). 셀은 **id 만 쓰고** 이름은 그때그때 명단에서 푼다 — 개명이 바로 따라간다.
// 명단에서 못 찾는 id 는 id 그대로 보인다(빈 칩으로 숨기면 "지정된 사람이 없다"로 읽힌다).
//
// 영속 값(PropertyValue):
//  - person:       string(id) | null
//  - multi_person: string[] | null

/** 명단 → id 로 찾는 표. */
function directoryOf(def: PropertyDef): Map<string, SelectOption> {
  return new Map(normalizeOptions(def.options).map((o) => [o.value, o]))
}

/**
 * 이름 칩 — 이니셜 아바타 + 이름. 표 셀·카드·필터 밖 어디서나 같은 모양.
 *
 * 좁은 컬럼에서도 깨져 보이지 않게: 칩은 `min-w-0` 으로 줄어들 수 있고, 이름만 말줄임(…)으로
 * 잘린다(아바타·× 는 shrink-0). 잘린 이름은 title 로 전체를 보인다.
 * × 는 `onRemove` 를 줄 때만 — 표 셀(닫힌 표면)에는 주지 않고 피커 안에서만 준다
 * (select/multi_select 셀이 셀에서는 × 를 숨기고 패널에서만 빼게 하는 것과 같은 규칙).
 */
export function PersonChip({
  name,
  inactive,
  onRemove,
  removeLabel,
}: {
  name: string
  inactive?: boolean
  onRemove?: () => void
  removeLabel?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1 rounded-full py-0.5 pr-1.5 pl-0.5 text-sm text-fg',
        inactive && 'text-fg-muted',
      )}
    >
      <Avatar size="xs" name={name} className="size-5 shrink-0" />
      <span className="min-w-0 truncate" title={name}>
        {name}
      </span>
      {onRemove && (
        <button
          type="button"
          data-table-row-stop
          aria-label={removeLabel}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          // 포커스 표시는 링 대신 배경 — 피커를 닫은 뒤 파란 링이 남아 보이지 않게(RelationCell 과 같은 규칙).
          className="inline-flex size-4 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-surface hover:text-fg focus-visible:bg-surface focus-visible:outline-none"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </span>
  )
}

/**
 * 읽기전용 사람 표시 — 칩을 전부 보인다(잘라서 숨기지 않는다). 넘치면 줄바꿈하고, 칩 하나가
 * 컬럼보다 길면 이름이 말줄임된다(읽기전용 multi_select 셀과 같은 규칙).
 */
export function PersonValue({ def, value }: { def: PropertyDef; value: PropertyValue }) {
  const ids = personIdsOf(value)
  const directory = useMemo(() => directoryOf(def), [def])
  if (ids.length === 0) return <span className="text-fg-muted">—</span>
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {ids.map((id) => {
        const person = directory.get(id)
        return <PersonChip key={id} name={person?.label ?? id} inactive={person?.inactive} />
      })}
    </div>
  )
}

export type PersonCellProps = {
  def: PropertyDef
  value: PropertyValue
  onChange: (value: PropertyValue) => void
}

/** 편집형 사람 셀 — 누르면 검색 가능한 명단이 열린다. 맨 위에 「나」 지름길. */
export function PersonCell({ def, value, onChange }: PersonCellProps) {
  const c = personCellCopy(useCollectionLocale())
  const multiple = def.type === 'multi_person'
  const ids = useMemo(() => personIdsOf(value), [value])
  const directory = useMemo(() => directoryOf(def), [def])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const results = useMemo(() => searchPeople([...directory.values()], query), [directory, query])
  // 「나」 — 보는 사람이 명단에 있고 활성일 때만. 검색 중에는 결과 목록이 답이므로 숨긴다.
  const self = def.selfPersonId ? directory.get(def.selfPersonId) : undefined
  const showSelf = !!self && !self.inactive && query.trim() === ''

  const pick = (id: string) => {
    onChange(togglePerson(multiple, ids, id))
    if (!multiple) setOpen(false)
  }

  const remove = (id: string) => onChange(togglePerson(true, ids, id))

  return (
    <AnchorContextSurface
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
      }}
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
          // 포커스는 링 대신 배경으로 — 피커를 닫으면 포커스가 표면으로 돌아오는데, 링이면 파랗게 남는다.
          className="flex min-h-7 w-full min-w-0 cursor-pointer items-center rounded-md px-1.5 py-0.5 text-left text-sm outline-none hover:bg-surface focus-visible:bg-surface"
        >
          {ids.length === 0 ? (
            <span className="truncate text-fg-muted">{c.placeholder}</span>
          ) : (
            <PersonChipLine
              people={ids.map((id) => {
                const person = directory.get(id)
                return { id, name: person?.label ?? id, inactive: person?.inactive }
              })}
            />
          )}
        </div>
      }
      panel={
        <div className="flex flex-col gap-1 p-1">
          {/* 고른 사람 — 빼기(×)는 여기서만 한다. 셀 표면에 × 를 두면 좁은 컬럼에서 이름을 밀어낸다. */}
          {ids.length > 0 && (
            <div className="flex flex-wrap gap-1 border-b border-border px-1 pb-1">
              {ids.map((id) => {
                const person = directory.get(id)
                return (
                  <PersonChip
                    key={id}
                    name={person?.label ?? id}
                    inactive={person?.inactive}
                    onRemove={() => remove(id)}
                    removeLabel={c.remove}
                  />
                )
              })}
            </div>
          )}
          <Input
            autoFocus
            size="sm"
            chrome="ghost"
            value={query}
            onValueChange={setQuery}
            placeholder={c.search}
            className="focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <ul role="listbox" aria-multiselectable={multiple} className="max-h-64 overflow-y-auto">
            {showSelf && self && (
              <PersonOptionRow
                option={self}
                label={`${ME_LABEL} · ${self.label ?? self.value}`}
                selected={ids.includes(self.value)}
                onPick={pick}
              />
            )}
            {results.length === 0 ? (
              <li className="px-2 py-1 text-xs text-fg-muted">{c.noResults}</li>
            ) : (
              results.map((o) => (
                <PersonOptionRow
                  key={o.value}
                  option={o}
                  label={o.label ?? o.value}
                  selected={ids.includes(o.value)}
                  onPick={pick}
                />
              ))
            )}
          </ul>
        </div>
      }
    />
  )
}

/**
 * 닫힌 셀의 칩 줄 — **한 줄**만 보이고, 넘친 사람은 오른쪽 「+N」으로 센다(편집형 multi_select 셀과
 * 같은 노션식 규칙). 행 높이가 사람 수만큼 부풀지 않는다. 전체는 누르면 열리는 피커에서 본다.
 *
 * 칩들은 flex-wrap 으로 놓고 한 줄 높이로 자른다 — 첫 줄 아래로 밀려난 칩 수가 곧 N 이다.
 * 컬럼 폭이 바뀌면(리사이즈) 다시 잰다. 「+N」은 칩 줄의 형제라, 나타나면 칩 줄이 좁아지기만 해서
 * 재측정이 한 방향으로 수렴한다(나타났다 사라졌다 깜빡이지 않는다).
 */
function PersonChipLine({
  people,
}: {
  people: { id: string; name: string; inactive?: boolean }[]
}) {
  const lineRef = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(0)
  // 사람 수가 같아도 이름이 바뀌면(개명·교체) 폭이 달라진다 — 이름 묶음을 재측정 기준으로 쓴다.
  const namesKey = people.map((p) => p.name).join('\n')

  useLayoutEffect(() => {
    const line = lineRef.current
    if (!line) return
    const measure = () => {
      const chips = Array.from(line.children) as HTMLElement[]
      const firstTop = chips[0]?.offsetTop ?? 0
      // 첫 칩보다 아래 줄에 놓인 칩 = 잘려서 안 보이는 칩.
      setHidden(chips.filter((el) => el.offsetTop > firstTop).length)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(line)
    return () => ro.disconnect()
  }, [namesKey])

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <div ref={lineRef} className="flex max-h-6 min-w-0 flex-1 flex-wrap gap-1 overflow-hidden">
        {people.map((p) => (
          <PersonChip key={p.id} name={p.name} inactive={p.inactive} />
        ))}
      </div>
      {hidden > 0 && (
        <span
          title={people
            .slice(people.length - hidden)
            .map((p) => p.name)
            .join(', ')}
          className="shrink-0 rounded bg-surface px-1 text-[11px] font-medium text-fg-muted"
        >
          +{hidden}
        </span>
      )}
    </div>
  )
}

function PersonOptionRow({
  option,
  label,
  selected,
  onPick,
}: {
  option: SelectOption
  label: string
  selected: boolean
  onPick: (id: string) => void
}) {
  return (
    <li
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={() => onPick(option.value)}
      // 포인터 전용이 되지 않게 — Enter/Space 로도 고른다(RelationCell 과 같은 규칙).
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onPick(option.value)
      }}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface',
        selected && 'bg-surface',
      )}
    >
      <Avatar size="xs" name={option.label ?? option.value} className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-fg">{label}</span>
        {option.hint && <span className="block truncate text-xs text-fg-muted">{option.hint}</span>}
      </span>
      {selected && <span className="shrink-0 text-fg-muted">✓</span>}
    </li>
  )
}
