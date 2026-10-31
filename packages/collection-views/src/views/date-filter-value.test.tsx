// @vitest-environment jsdom
//
// 날짜 조건의 값 — 고정·상대 날짜에 **시각**을 붙일 수 있다(`방문 일시 < 오늘 12:00`).
//  - 상대값은 일 단위에만 시각 칸이 서고, 고른 시각은 `{…, time}` 으로 저장된다(질의 경계에서 그 분으로 풀린다).
//  - 고정 날짜는 `YYYY-MM-DDTHH:mm`, 시각을 지우면 날짜만 남는다.
//  - 「직접」 — N일 전/후 · N시간 전/후를 숫자로 센다. 저장 형태는 프리셋과 같다(`{unit, offset:±N}`).

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@oobleck/systheme', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  Input: ({ onValueChange, size: _size, ...rest }: Record<string, unknown>) => (
    <input
      onChange={(e) => (onValueChange as (v: string) => void)?.(e.target.value)}
      {...(rest as object)}
    />
  ),
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
  NumberInput: ({ onChange, value, size: _size, ...rest }: Record<string, unknown>) => (
    <input
      type="number"
      value={value as number}
      onChange={(e) => (onChange as (v: number) => void)?.(e.target.valueAsNumber)}
      {...(rest as object)}
    />
  ),
  RadioGroup: ({ options, value, onChange, 'aria-label': label }: Record<string, unknown>) => (
    <fieldset aria-label={label as string}>
      {(options as { value: string; label: string }[]).map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            checked={value === o.value}
            onChange={() => (onChange as (v: string) => void)?.(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  ),
  MultiSelect: () => null,
  X: () => <span />,
}))

const { FilterConditionRow } = await import('./filter-builder')

import type { FilterCondition, PropertyDef } from '@oobleck/collection'

afterEach(cleanup)

const VISIT: PropertyDef = {
  key: 'visitAt',
  label: '방문 일시',
  type: 'date',
  source: 'projection',
  origin: 'preset',
}

const MOVE: PropertyDef = {
  key: 'moveDate',
  label: '이사 예정일',
  type: 'date',
  dateOnly: true,
  source: 'projection',
  origin: 'preset',
}

function renderRow(condition: FilterCondition) {
  const onChange = vi.fn()
  render(
    <FilterConditionRow
      schema={[VISIT, MOVE]}
      condition={condition}
      onChange={onChange}
      onRemove={vi.fn()}
    />,
  )
  return onChange
}

describe('날짜 조건 — 시각', () => {
  it('상대값(일)에 시각을 붙이면 `{…, time}` 으로 저장된다', () => {
    const onChange = renderRow({
      key: 'visitAt',
      op: 'lt',
      value: { rel: 'date', unit: 'day', offset: 0 },
    })
    fireEvent.change(screen.getByLabelText('시각'), { target: { value: '12:00' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: { rel: 'date', unit: 'day', offset: 0, time: '12:00' } }),
    )
  })

  it('주·달 상대값에는 시각 칸이 서지 않는다', () => {
    renderRow({ key: 'visitAt', op: 'eq', value: { rel: 'date', unit: 'week', offset: 0 } })
    expect(screen.queryByLabelText('시각')).toBeNull()
  })

  it('고정 날짜 + 시각 = `YYYY-MM-DDTHH:mm`, 시각을 지우면 날짜만', () => {
    const onChange = renderRow({ key: 'visitAt', op: 'lt', value: '2026-10-17T09:30' })
    const time = screen.getByLabelText('시각') as HTMLInputElement
    expect(time.value).toBe('09:30')
    fireEvent.change(time, { target: { value: '12:00' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: '2026-10-17T12:00' }),
    )
    fireEvent.change(time, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ value: '2026-10-17' }))
  })
})

describe('날짜 조건 — 직접(N일 전/후 · N시간 전/후)', () => {
  const mode = () => screen.getAllByTestId('select')[1] as HTMLSelectElement // [0] 은 연산자

  it('프리셋에 없는 오프셋(3일 전)은 「직접」으로 열리고 3 · 「전」 · (4일 차)가 채워진다', () => {
    renderRow({ key: 'visitAt', op: 'eq', value: { rel: 'date', unit: 'day', offset: -3 } })
    expect(mode().value).toBe('custom:day')
    expect((screen.getByLabelText('일 수') as HTMLInputElement).value).toBe('3')
    expect((screen.getByLabelText('전') as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText('(4일 차)')).toBeTruthy()
    // 일 단위라 시각 칸도 선다.
    expect(screen.getByLabelText('시각')).toBeTruthy()
  })

  it('숫자를 바꾸면 방향을 지킨 채 offset 이 바뀐다 — 넘친 값은 상한, 소수는 버린다', () => {
    const onChange = renderRow({
      key: 'visitAt',
      op: 'eq',
      value: { rel: 'date', unit: 'day', offset: -3, time: '09:00' },
    })
    const days = screen.getByLabelText('일 수')
    fireEvent.change(days, { target: { value: '5' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: { rel: 'date', unit: 'day', offset: -5, time: '09:00' } }),
    )
    fireEvent.change(days, { target: { value: '99999' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        value: { rel: 'date', unit: 'day', offset: -3650, time: '09:00' },
      }),
    )
    fireEvent.change(days, { target: { value: '2.7' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: { rel: 'date', unit: 'day', offset: -2, time: '09:00' } }),
    )
  })

  it('방향 「후」 → 양수 offset', () => {
    const onChange = renderRow({
      key: 'visitAt',
      op: 'eq',
      value: { rel: 'date', unit: 'day', offset: -3 },
    })
    fireEvent.click(screen.getByLabelText('후'))
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: { rel: 'date', unit: 'day', offset: 3 } }),
    )
  })

  it('미래 오프셋은 「후」로 열리고 일 차 표기가 없다', () => {
    renderRow({ key: 'visitAt', op: 'eq', value: { rel: 'date', unit: 'day', offset: 3 } })
    expect((screen.getByLabelText('후') as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByText(/일 차/)).toBeNull()
  })

  it('「N일 전/후 (직접)」을 고르면 지금의 날(어제)을 그대로 센다 — 시각도 남는다', () => {
    const onChange = renderRow({
      key: 'visitAt',
      op: 'lt',
      value: { rel: 'date', unit: 'day', offset: -1, time: '12:00' },
    })
    expect(mode().value).toBe('day:-1')
    fireEvent.change(mode(), { target: { value: 'custom:day' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: { rel: 'date', unit: 'day', offset: -1, time: '12:00' } }),
    )
    // 값(어제)이 프리셋과 같아도 직접 칸을 지킨다 — 입력하던 칸이 프리셋으로 튀지 않게.
    expect(mode().value).toBe('custom:day')
    expect((screen.getByLabelText('일 수') as HTMLInputElement).value).toBe('1')
    expect(screen.getByText('(2일 차)')).toBeTruthy()
  })

  it('「N시간 전/후 (직접)」 — 지금(0)에서 시작하고, 시각 칸은 서지 않는다', () => {
    const onChange = renderRow({
      key: 'visitAt',
      op: 'lt',
      value: { rel: 'date', unit: 'day', offset: 0, time: '12:00' },
    })
    fireEvent.change(mode(), { target: { value: 'custom:hour' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: { rel: 'date', unit: 'hour', offset: 0 } }),
    )
  })

  it('시간 상대값은 「직접」으로 열리고, 숫자 · 방향이 offset 이 된다(상한 720)', () => {
    const onChange = renderRow({
      key: 'visitAt',
      op: 'gte',
      value: { rel: 'date', unit: 'hour', offset: 0 },
    })
    expect(mode().value).toBe('custom:hour')
    expect(screen.getByText('(지금)')).toBeTruthy()
    expect(screen.queryByLabelText('시각')).toBeNull()
    fireEvent.click(screen.getByLabelText('후'))
    // 0 에는 방향이 없다 — 값은 그대로 0 이다(-0 도 아니다).
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: { rel: 'date', unit: 'hour', offset: 0 } }),
    )
    // 0 에서 고른 방향(후)을 기억했다가 숫자를 올리면 그쪽으로 센다 — 2시간 후.
    fireEvent.change(screen.getByLabelText('시간 수'), { target: { value: '2' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: { rel: 'date', unit: 'hour', offset: 2 } }),
    )
    fireEvent.change(screen.getByLabelText('시간 수'), { target: { value: '1000' } })
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ value: { rel: 'date', unit: 'hour', offset: 720 } }),
    )
  })

  it('시간 상대값 2시간 전 — 숫자 2 · 「전」, 보조 표기 없음', () => {
    renderRow({ key: 'visitAt', op: 'lt', value: { rel: 'date', unit: 'hour', offset: -2 } })
    expect((screen.getByLabelText('시간 수') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('전') as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByText('(지금)')).toBeNull()
  })

  it('프리셋에도 직접에도 없는 주·달(3주 전)은 그 뜻 그대로 한 자리로 보인다', () => {
    renderRow({ key: 'visitAt', op: 'eq', value: { rel: 'date', unit: 'week', offset: -3 } })
    expect(mode().value).toBe('week:-3')
    expect(mode().selectedOptions[0]?.textContent).toBe('3주 전')
  })
})

/**
 * 값이 다시 props 로 흘러드는 하네스 — 실제 편집기처럼 onChange 가 조건을 바꾸고 다시 그린다.
 * 고정 condition + vi.fn() 으로는 「다음 렌더에서 칸이 사라지는가」를 볼 수 없다(내보낸 값만 본다).
 */
function renderControlled(initial: FilterCondition) {
  const log: FilterCondition[] = []
  function Harness() {
    const [cond, setCond] = React.useState(initial)
    return (
      <FilterConditionRow
        schema={[VISIT, MOVE]}
        condition={cond}
        onChange={(next) => {
          log.push(next)
          setCond(next)
        }}
        onRemove={() => {}}
      />
    )
  }
  render(<Harness />)
  return log
}

describe('날짜 조건 — 직접, 값이 되돌아 흐를 때', () => {
  const mode = () => screen.getAllByTestId('select')[1] as HTMLSelectElement
  const op = () => screen.getAllByTestId('select')[0] as HTMLSelectElement
  const lastValue = (log: FilterCondition[]) => log[log.length - 1]?.value

  it('프리셋에 없는 값(3일 전)으로 열고 1·7·0 을 넣어도 「직접」과 숫자 칸이 남는다', () => {
    const log = renderControlled({
      key: 'visitAt',
      op: 'eq',
      value: { rel: 'date', unit: 'day', offset: -3 },
    })
    for (const [typed, offset] of [
      ['1', -1],
      ['7', -7],
      ['0', 0],
      ['10', -10],
    ] as const) {
      fireEvent.change(screen.getByLabelText('일 수'), { target: { value: typed } })
      expect(lastValue(log)).toEqual({ rel: 'date', unit: 'day', offset })
      expect(mode().value).toBe('custom:day')
      expect(screen.getByLabelText('일 수')).toBeTruthy()
    }
  })

  it('미래 값에서 0 을 지나도 방향을 지킨다 — 3시간 전 → 「후」 → 0 → 2 = 2시간 후', () => {
    const log = renderControlled({
      key: 'visitAt',
      op: 'gte',
      value: { rel: 'date', unit: 'hour', offset: -3 },
    })
    const hours = () => screen.getByLabelText('시간 수')
    fireEvent.click(screen.getByLabelText('후'))
    expect(lastValue(log)).toEqual({ rel: 'date', unit: 'hour', offset: 3 })
    fireEvent.change(hours(), { target: { value: '0' } })
    expect(lastValue(log)).toEqual({ rel: 'date', unit: 'hour', offset: 0 })
    expect((screen.getByLabelText('후') as HTMLInputElement).checked).toBe(true)
    fireEvent.change(hours(), { target: { value: '2' } })
    expect(lastValue(log)).toEqual({ rel: 'date', unit: 'hour', offset: 2 })
    expect((screen.getByLabelText('후') as HTMLInputElement).checked).toBe(true)
  })

  it('일 단위도 같다 — 3일 후 → 0 → 5 = 5일 후', () => {
    const log = renderControlled({
      key: 'visitAt',
      op: 'eq',
      value: { rel: 'date', unit: 'day', offset: 3 },
    })
    fireEvent.change(screen.getByLabelText('일 수'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('일 수'), { target: { value: '5' } })
    expect(lastValue(log)).toEqual({ rel: 'date', unit: 'day', offset: 5 })
  })

  it('숫자 칸 옆에 단위가 보이고, 일 차 표기가 숫자 칸의 설명으로 이어진다', () => {
    renderControlled({ key: 'visitAt', op: 'eq', value: { rel: 'date', unit: 'day', offset: -3 } })
    const days = screen.getByLabelText('일 수')
    expect(screen.getByText('일')).toBeTruthy()
    const describedBy = days.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy as string)?.textContent).toBe('(4일 차)')
  })

  it('같다·같지 않다에는 「N시간 전/후」를 내지 않고, 시간 값을 걸어 둔 채 같다로 바꾸면 값이 비워진다', () => {
    const log = renderControlled({
      key: 'visitAt',
      op: 'gte',
      value: { rel: 'date', unit: 'hour', offset: -2 },
    })
    fireEvent.change(op(), { target: { value: 'eq' } })
    expect(log[log.length - 1]).toEqual({ key: 'visitAt', op: 'eq', value: null })
    const values = Array.from(mode().options).map((o) => o.value)
    expect(values).toContain('custom:day')
    expect(values).not.toContain('custom:hour')
  })

  it('날짜만 든 컬럼(이사 예정일)에는 「N시간 전/후」도 시각 칸도 내지 않는다', () => {
    renderControlled({ key: 'moveDate', op: 'gte', value: { rel: 'date', unit: 'day', offset: 0 } })
    const values = Array.from(mode().options).map((o) => o.value)
    expect(values).not.toContain('custom:hour')
    expect(screen.queryByLabelText('시각')).toBeNull()
  })
})
