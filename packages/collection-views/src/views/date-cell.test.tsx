// @vitest-environment jsdom
//
// @oobleck/collection — date PropertyType 편집기 회귀 핀(date-picker-ui-missing).
//
// DateCellEditor 는 공용 DS `DateEditPanel`(노션식: 입력 + 달력 + 종료일/시간 토글 + 오늘/삭제)을 셀 위 패널로
// 띄우고, date-value 문자열 ↔ { start, end, hasTime }(Date) 변환만 담당한다. 이 테스트는 그 변환·커밋·표시 검증:
//   - 미설정(빈값) → "날짜 없음" 트리거, 패널 value=null.
//   - 'YYYY-MM-DD' 값 → 패널 value.start 가 *로컬 자정*(전날 밀림 없음).
//   - 단일 onChange → onCommit('YYYY-MM-DD').
//   - 기간 onChange → onCommit('start/end').
//   - 시간 onChange → onCommit('YYYY-MM-DDTHH:mm').
//   - onChange(null) → onCommit(null).
//
// 전략: @oobleck/systheme 배럴을 경량 스텁으로 대체. DateEditPanel 스텁은 받은 value 를 노출하고, 여러 버튼으로
//   다양한 DateEditValue 를 onChange 로 발화한다.

import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

function localKey(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${day}`
}

vi.mock('@oobleck/systheme', () => {
  const AnchorContextSurface = ({
    surface,
    panel,
  }: {
    surface?: React.ReactNode
    panel?: React.ReactNode
  }) => React.createElement('div', null, surface, panel)

  type DV = { start: Date; end: Date | null; hasTime: boolean } | null
  const DateEditPanel = ({ value, onChange }: { value?: DV; onChange?: (v: DV) => void }) =>
    React.createElement(
      'div',
      null,
      React.createElement(
        'span',
        { 'data-testid': 'panel-value' },
        value ? localKey(value.start) : 'none',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'pick-single',
          onClick: () => onChange?.({ start: new Date(2026, 6, 15), end: null, hasTime: false }),
        },
        '단일',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'pick-range',
          onClick: () =>
            onChange?.({
              start: new Date(2026, 6, 15),
              end: new Date(2026, 6, 20),
              hasTime: false,
            }),
        },
        '기간',
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          'data-testid': 'pick-time',
          onClick: () =>
            onChange?.({ start: new Date(2026, 6, 15, 14, 30), end: null, hasTime: true }),
        },
        '시간',
      ),
      React.createElement(
        'button',
        { type: 'button', 'data-testid': 'clear', onClick: () => onChange?.(null) },
        '삭제',
      ),
    )

  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')
  const Input = () => React.createElement('input')
  const Select = () => React.createElement('select')

  return { AnchorContextSurface, DateEditPanel, Input, Select, cn }
})

import { DateCellEditor } from './CellEditor'

afterEach(cleanup)

describe('DateCellEditor', () => {
  it('미설정(빈값) → "날짜 없음" 트리거, 패널 value=null', () => {
    render(<DateCellEditor value="" onCommit={() => {}} />)
    expect(screen.getByText('날짜 없음')).toBeDefined()
    expect(screen.getByTestId('panel-value').textContent).toBe('none')
  })

  it("format='iso' 면 트리거 글자가 「2026-07-01」(표 칸과 같은 모양)", () => {
    render(<DateCellEditor value="2026-07-01" onCommit={() => {}} format="iso" />)
    const shown = screen
      .getAllByText('2026-07-01')
      .filter((el) => el.dataset.testid !== 'panel-value')
    expect(shown).toHaveLength(1)
  })

  it("'YYYY-MM-DD' 값 → 패널 value.start 가 로컬 자정(전날 밀림 없음)", () => {
    render(<DateCellEditor value="2026-07-01" onCommit={() => {}} />)
    expect(screen.getByTestId('panel-value').textContent).toBe('2026-07-01')
  })

  it('단일 선택 → onCommit("YYYY-MM-DD")', () => {
    const onCommit = vi.fn()
    render(<DateCellEditor value="" onCommit={onCommit} />)
    fireEvent.click(screen.getByTestId('pick-single'))
    expect(onCommit).toHaveBeenCalledWith('2026-07-15')
  })

  it('기간 선택 → onCommit("start/end")', () => {
    const onCommit = vi.fn()
    render(<DateCellEditor value="" onCommit={onCommit} />)
    fireEvent.click(screen.getByTestId('pick-range'))
    expect(onCommit).toHaveBeenCalledWith('2026-07-15/2026-07-20')
  })

  it('시간 포함 선택 → onCommit("YYYY-MM-DDTHH:mm")', () => {
    const onCommit = vi.fn()
    render(<DateCellEditor value="" onCommit={onCommit} />)
    fireEvent.click(screen.getByTestId('pick-time'))
    expect(onCommit).toHaveBeenCalledWith('2026-07-15T14:30')
  })

  it('onChange(null) → onCommit(null)', () => {
    const onCommit = vi.fn()
    render(<DateCellEditor value="2026-07-01" onCommit={onCommit} />)
    fireEvent.click(screen.getByTestId('clear'))
    expect(onCommit).toHaveBeenCalledWith(null)
  })
})
