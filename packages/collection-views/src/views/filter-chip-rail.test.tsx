// @vitest-environment jsdom
//
// FilterChipRail — "적용된 필터가 화면에 보이는가"를 고정한다.
//
// 이 컴포넌트가 존재하는 이유 자체가 **비가시성**이다: 툴바 팝오버는 닫으면 뱃지 숫자만
// 남아서 "3" 이 무엇인지 열어봐야 안다. 그러니 여기서 지킬 계약은 두 가지 —
// 조건이 사람이 읽는 말로 나오는가, 그리고 칩의 ✕ 가 **그 조건 하나만** 지우는가.
// (다른 조건까지 같이 사라지면 화면은 멀쩡한데 결과가 조용히 넓어진다.)

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// Popover 는 기본 **닫힌 상태**로 스텁한다(트리거만 렌더). 내용까지 같이 그리면 편집기의 컬럼
// 라벨이 칩의 라벨과 겹쳐서, "칩에 보이는가"를 묻는 단언이 편집기 쪽 텍스트로도 통과해 버린다.
// 단 open=true(칩 클릭으로 연 상태)면 children 을 그린다 — 칩 클릭 편집 계약을 검증하기 위해.
// 트리거 onClick 은 컴포넌트의 onOpenChange 로 연결한다(실물 Popover 의 토글과 같은 방향).
vi.mock('@oobleck/systheme', () => {
  const triggerOnly =
    (testId: string) =>
    ({ trigger, open, onOpenChange, children }: Record<string, unknown>) => (
      <div data-testid={testId}>
        {typeof trigger === 'function'
          ? (trigger as (p: Record<string, unknown>) => React.ReactNode)({
              onClick: () => (onOpenChange as ((o: boolean) => void) | undefined)?.(open !== true),
              'aria-expanded': open === true,
            })
          : null}
        {open === true ? (
          <div data-testid={`${testId}-panel`}>{children as React.ReactNode}</div>
        ) : null}
      </div>
    )
  return {
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    Menu: triggerOnly('menu'),
    Popover: triggerOnly('popover'),
    Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Select: ({ options, value, onChange }: Record<string, unknown>) => (
      <select
        data-testid="select"
        value={(value as string) ?? ''}
        onChange={(e) => (onChange as (v: string) => void)?.(e.target.value)}
      >
        {(options as { value: string; label: string }[]).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ),
    Input: ({ onValueChange, ...rest }: Record<string, unknown>) => (
      <input
        onChange={(e) => (onValueChange as (v: string) => void)?.(e.target.value)}
        {...(rest as object)}
      />
    ),
    Plus: () => <span />,
    X: () => <span />,
    Search: () => <span />,
    ArrowUp: () => <span />,
    ArrowDown: () => <span />,
    ChevronsLeft: () => <span />,
    ChevronsRight: () => <span />,
  }
})

const { FilterChipRail } = await import('./FilterChipRail')

import type { PropertyDef, ViewConfig } from '@oobleck/collection'

const SCHEMA: PropertyDef[] = [
  {
    key: 'status',
    label: '상태',
    type: 'select',
    source: 'projection',
    origin: 'preset',
    options: [
      { value: 'synced', label: '접수됨' },
      { value: 'closed_lost', label: '취소됨' },
    ],
  },
  { key: 'moveDate', label: '이사 예정일', type: 'date', source: 'projection', origin: 'preset' },
  { key: 'departure', label: '출발지', type: 'text', source: 'projection', origin: 'preset' },
]

function view(children: ViewConfig['filters']['children']): ViewConfig {
  return { type: 'table', filters: { op: 'and', children }, sort: [] }
}

describe('FilterChipRail', () => {
  it('조건을 컬럼 라벨 + 기호 + 값으로 그린다', () => {
    render(
      <FilterChipRail
        schema={SCHEMA}
        view={view([{ key: 'moveDate', op: 'lte', value: '2026-09-30' }])}
        onViewChange={vi.fn()}
      />,
    )
    expect(screen.getByText('이사 예정일')).toBeTruthy()
    expect(screen.getByText('≤')).toBeTruthy()
    expect(screen.getByText('2026-09-30')).toBeTruthy()
  })

  it('select 값은 옵션 라벨로 — 칩은 사용자가 고른 말로 말한다', () => {
    render(
      <FilterChipRail
        schema={SCHEMA}
        view={view([{ key: 'status', op: 'eq', value: 'synced' }])}
        onViewChange={vi.fn()}
      />,
    )
    expect(screen.getByText('접수됨')).toBeTruthy()
    expect(screen.queryByText('synced')).toBeNull()
  })

  it('✕ 는 그 조건 하나만 지운다 — 나머지는 그대로 남는다', () => {
    const onViewChange = vi.fn()
    render(
      <FilterChipRail
        schema={SCHEMA}
        view={view([
          { key: 'status', op: 'eq', value: 'synced' },
          { key: 'departure', op: 'contains', value: '강남' },
        ])}
        onViewChange={onViewChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('상태 필터 제거'))
    expect(onViewChange).toHaveBeenCalledWith({
      filters: { op: 'and', children: [{ key: 'departure', op: 'contains', value: '강남' }] },
    })
  })

  it('값 없는 연산자는 값 자리를 비운다(비어있음 = 3 처럼 읽히지 않게)', () => {
    render(
      <FilterChipRail
        schema={SCHEMA}
        view={view([{ key: 'moveDate', op: 'is_empty' }])}
        onViewChange={vi.fn()}
      />,
    )
    expect(screen.getByText('이사 예정일')).toBeTruthy()
    // 기호가 없는 연산자는 opLabel 문구를 그대로 쓴다(툴바 편집기와 같은 어휘).
    expect(screen.getByText('비어있음')).toBeTruthy()
  })

  it('중첩 그룹은 조건 수 요약 칩으로 접는다(레일이 두 번째 편집기가 되지 않게)', () => {
    render(
      <FilterChipRail
        schema={SCHEMA}
        view={view([
          {
            op: 'or',
            children: [
              { key: 'status', op: 'eq', value: 'synced' },
              { key: 'status', op: 'eq', value: 'closed_lost' },
            ],
          },
        ])}
        onViewChange={vi.fn()}
      />,
    )
    expect(screen.getByText('그룹 · 2')).toBeTruthy()
  })

  it('조건이 1개면 "모두 지우기"를 띄우지 않는다(칩 ✕ 하나면 충분)', () => {
    const { rerender } = render(
      <FilterChipRail
        schema={SCHEMA}
        view={view([{ key: 'status', op: 'eq', value: 'synced' }])}
        onViewChange={vi.fn()}
      />,
    )
    expect(screen.queryByText('모두 지우기')).toBeNull()

    rerender(
      <FilterChipRail
        schema={SCHEMA}
        view={view([
          { key: 'status', op: 'eq', value: 'synced' },
          { key: 'departure', op: 'contains', value: '강남' },
        ])}
        onViewChange={vi.fn()}
      />,
    )
    expect(screen.getByText('모두 지우기')).toBeTruthy()
  })

  it('필터가 없으면 칩은 없고 "＋ 필터" 입구만 남는다', () => {
    render(<FilterChipRail schema={SCHEMA} view={view([])} onViewChange={vi.fn()} />)
    expect(screen.getByLabelText('필터 추가')).toBeTruthy()
    expect(screen.queryByText('모두 지우기')).toBeNull()
  })

  // ─── 칩 클릭 편집 — 칩 본문이 그 조건 하나로 스코프된 편집기를 연다 ───────────

  it('조건 칩 클릭 → 그 조건의 편집기가 열리고, 연산자 변경이 그 조건만 바꾼다', () => {
    const onViewChange = vi.fn()
    render(
      <FilterChipRail
        schema={SCHEMA}
        view={view([
          { key: 'status', op: 'eq', value: 'synced' },
          { key: 'departure', op: 'contains', value: '강남' },
        ])}
        onViewChange={onViewChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('상태 필터 편집'))
    // 편집기는 연산자 Select 를 그린다 — eq 가 선택된 채로.
    const opSelect = screen.getAllByTestId('select')[0]
    fireEvent.change(opSelect, { target: { value: 'neq' } })

    expect(onViewChange).toHaveBeenCalledWith({
      filters: {
        op: 'and',
        children: [
          { key: 'status', op: 'neq', value: 'synced' },
          { key: 'departure', op: 'contains', value: '강남' },
        ],
      },
    })
  })

  it('그룹 칩 클릭 → 그 그룹만 스코프된 그룹 편집기가 열린다', () => {
    const onViewChange = vi.fn()
    render(
      <FilterChipRail
        schema={SCHEMA}
        view={view([
          {
            op: 'or',
            children: [
              { key: 'status', op: 'eq', value: 'synced' },
              { key: 'status', op: 'eq', value: 'closed_lost' },
            ],
          },
          { key: 'departure', op: 'contains', value: '강남' },
        ])}
        onViewChange={onViewChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('그룹 · 2 필터 편집'))
    // 그룹 편집기(depth 0)가 그룹의 조건 행들을 그린다 — 행 제거는 그룹 안만 바꾼다.
    const removeButtons = screen.getAllByLabelText('제거')
    fireEvent.click(removeButtons[0])

    expect(onViewChange).toHaveBeenCalledWith({
      filters: {
        op: 'and',
        children: [
          { op: 'or', children: [{ key: 'status', op: 'eq', value: 'closed_lost' }] },
          { key: 'departure', op: 'contains', value: '강남' },
        ],
      },
    })
  })

  it('편집기 안 제거(✕)는 조건을 지우고 편집기를 닫는다', () => {
    const onViewChange = vi.fn()
    render(
      <FilterChipRail
        schema={SCHEMA}
        view={view([{ key: 'status', op: 'eq', value: 'synced' }])}
        onViewChange={onViewChange}
      />,
    )

    fireEvent.click(screen.getByLabelText('상태 필터 편집'))
    fireEvent.click(screen.getByLabelText('제거'))

    expect(onViewChange).toHaveBeenCalledWith({ filters: { op: 'and', children: [] } })
    expect(screen.queryByTestId('popover-panel')).toBeNull()
  })
})
