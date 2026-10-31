// @vitest-environment jsdom
//
// 관계 집계(롤업) 조건 — 「이 파트너가 낸 견적 중 (주문 = A · 상태 ≠ 미선택) 의 개수 ≥ 1」.
// 지킬 것: 원천이 조건 추가 목록에 뜨고, 셈·대상 조건(AND)·참조값을 편집기에서 고를 수 있으며, 칩이 그 뜻을 말한다.

import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@oobleck/systheme', () => {
  const Select = ({ options, value, onChange, 'aria-label': aria }: Record<string, unknown>) => (
    <select
      aria-label={aria as string}
      value={(value as string) ?? ''}
      onChange={(e) => (onChange as (v: string) => void)?.(e.target.value)}
    >
      <option value="" />
      {(options as { value: string; label: string }[]).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
  return {
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Select,
    MultiSelect: () => <div />,
    NumberInput: () => <div />,
    RadioGroup: () => <div />,
    // 칩 레일의 칩은 Popover 의 트리거다 — 트리거만 그리고 편집 팝오버는 열지 않는다(칩 말만 본다).
    Popover: ({ trigger }: Record<string, unknown>) => (
      <>{typeof trigger === 'function' ? (trigger as (p: object) => React.ReactNode)({}) : null}</>
    ),
    Plus: () => <span />,
    X: () => <span />,
    Input: ({ onValueChange, ...rest }: Record<string, unknown>) => (
      <input
        onChange={(e) => (onValueChange as (v: string) => void)?.(e.target.value)}
        {...(rest as object)}
      />
    ),
    Tag: ({ children, onRemove }: { children: React.ReactNode; onRemove?: () => void }) => (
      <span data-testid="tag">
        {children}
        <button type="button" aria-label="참조 제거" onClick={onRemove} />
      </span>
    ),
    SearchFieldAutocomplete: ({
      value,
      onValueChange,
      options,
      onOptionSelect,
      placeholder,
    }: Record<string, unknown>) => (
      <div>
        <input
          placeholder={placeholder as string}
          value={value as string}
          onChange={(e) => (onValueChange as (v: string) => void)(e.target.value)}
        />
        {(options as { id: string; label: string }[]).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => (onOptionSelect as (o: unknown) => void)(o)}
          >
            {o.label}
          </button>
        ))}
      </div>
    ),
  }
})

import { resolveRelativeFilters } from '@oobleck/collection'

import { FilterGroupEditor } from './filter-builder'
import { FilterRollupProvider, withRollupMeasure } from './filter-rollup'
import { FilterChipRail } from './FilterChipRail'

import type { FilterGroup, PropertyDef, RelationProvider, RollupSource } from '@oobleck/collection'

function def(over: Partial<PropertyDef> & Pick<PropertyDef, 'key' | 'type'>): PropertyDef {
  return { label: over.key, source: 'projection', origin: 'preset', ...over }
}

const orders: RelationProvider = {
  search: vi.fn(async (q: string) => (q === '10' ? [{ id: '1002', label: '#1002 · 강남구' }] : [])),
  resolve: vi.fn(async (ids: string[]) => ids.map((id) => ({ id, label: `#${id} · 해상` }))),
}

const QUOTES: RollupSource = {
  key: 'rel:quotes',
  label: '견적',
  schema: [
    def({ key: 'misoOrderId', label: '주문', type: 'relation', relation: { target: 'orders' } }),
    def({
      key: 'status',
      label: '상태',
      type: 'select',
      options: [{ value: 'lost', label: '미선택' }],
    }),
    def({ key: 'price', label: '견적가', type: 'number' }),
    def({ key: 'submittedAt', label: '제출 시각', type: 'date' }),
  ],
  relations: { orders },
}

const SCHEMA = [def({ key: 'name', label: '업체명', type: 'text' })]

function Harness({ initial }: { initial: FilterGroup }) {
  const [group, setGroup] = React.useState(initial)
  return (
    <FilterRollupProvider sources={[QUOTES]}>
      <FilterGroupEditor schema={SCHEMA} group={group} depth={0} onChange={setGroup} />
      <pre data-testid="state">{JSON.stringify(group)}</pre>
    </FilterRollupProvider>
  )
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}') as FilterGroup

describe('롤업 조건 편집', () => {
  it('원천이 「관계」로 조건 추가 목록에 뜨고, 고르면 개수 조건이 비어 있는 값으로 생긴다', () => {
    render(<Harness initial={{ op: 'and', children: [] }} />)
    fireEvent.change(screen.getByLabelText('+ 필터 추가'), { target: { value: 'rel:quotes' } })
    expect(state().children).toEqual([
      { key: 'rel:quotes', op: 'gte', value: null, rollup: { agg: 'count', where: [] } },
    ])
    expect(screen.getByText('조건 없음 — 이어진 견적 전부')).toBeTruthy()
  })

  it('대상 조건을 더하고, 참조값(주문)을 검색해서 고른다', async () => {
    render(
      <Harness
        initial={{
          op: 'and',
          children: [
            { key: 'rel:quotes', op: 'gte', value: 1, rollup: { agg: 'count', where: [] } },
          ],
        }}
      />,
    )
    fireEvent.change(screen.getByLabelText('+ 견적 조건'), { target: { value: 'misoOrderId' } })
    expect(screen.getByText('이어진 견적 중')).toBeTruthy()

    await act(async () => {
      fireEvent.change(screen.getByPlaceholderText('검색해서 고르기'), { target: { value: '10' } })
    })
    fireEvent.click(await screen.findByText('#1002 · 강남구'))

    const cond = state().children[0] as { rollup: { where: unknown[] } }
    expect(cond.rollup.where).toEqual([{ key: 'misoOrderId', op: 'eq', value: '1002' }])
    expect(screen.getByTestId('tag').textContent).toContain('#1002 · 강남구')
  })

  it('저장된 참조값은 provider 로 라벨을 해상해 칩으로 보인다', async () => {
    render(
      <Harness
        initial={{
          op: 'and',
          children: [
            {
              key: 'rel:quotes',
              op: 'gte',
              value: 1,
              rollup: { agg: 'count', where: [{ key: 'misoOrderId', op: 'eq', value: '1003' }] },
            },
          ],
        }}
      />,
    )
    expect((await screen.findByTestId('tag')).textContent).toContain('#1003 · 해상')
  })

  it('셈을 바꾸면 새 셈에 없는 연산자는 ≥ 로 — 최소는 비어 있음을 받지만 개수는 받지 않는다', () => {
    const minEmpty = {
      key: 'rel:quotes',
      op: 'is_empty' as const,
      value: null,
      rollup: { agg: 'min' as const, field: 'price', where: [] },
    }
    expect(withRollupMeasure(minEmpty, 'count')).toMatchObject({
      op: 'gte',
      rollup: { agg: 'count', field: undefined },
    })
    expect(withRollupMeasure({ ...minEmpty, op: 'lt', value: 5 }, 'max:price')).toMatchObject({
      op: 'lt',
      value: 5,
      rollup: { agg: 'max', field: 'price' },
    })
  })
})

describe('롤업 칩과 상대값', () => {
  it('칩은 원천 · 셈 · 대상 조건을 한 줄로 말한다', () => {
    render(
      <FilterRollupProvider sources={[QUOTES]}>
        <FilterChipRail
          schema={SCHEMA}
          view={{
            type: 'table',
            sort: [],
            filters: {
              op: 'and',
              children: [
                {
                  key: 'rel:quotes',
                  op: 'gte',
                  value: 2,
                  rollup: { agg: 'count', where: [{ key: 'status', op: 'neq', value: 'lost' }] },
                },
              ],
            },
          }}
          onViewChange={vi.fn()}
        />
      </FilterRollupProvider>,
    )
    expect(screen.getByText('견적 개수 · 상태 ≠ 미선택')).toBeTruthy()
    expect(screen.getByText('≥')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('대상 조건의 상대 날짜도 질의 경계에서 푼다', () => {
    const resolved = resolveRelativeFilters(
      {
        op: 'and',
        children: [
          {
            key: 'rel:quotes',
            op: 'gte',
            value: 1,
            rollup: {
              agg: 'count',
              where: [
                { key: 'submittedAt', op: 'gte', value: { rel: 'date', unit: 'day', offset: -30 } },
              ],
            },
          },
        ],
      },
      { now: new Date('2026-10-26T03:00:00Z'), me: null },
    )
    expect(resolved.children[0]).toMatchObject({
      rollup: { where: [{ key: 'submittedAt', op: 'gte', value: '2026-09-26' }] },
    })
  })
})
