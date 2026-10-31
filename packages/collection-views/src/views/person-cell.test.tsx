// @vitest-environment jsdom
//
// @oobleck/collection — 사람 셀(person / multi_person)과 사람 필터의 게이팅 핀.
//  - 셀은 이름 칩(이니셜)으로 보이고, 명단에서 못 찾는 id 는 id 그대로 보인다.
//  - 피커는 「나」 지름길 + 이름·이메일, 비활성 계정은 목록에서 빠진다. 고르면 **계정 id** 가 나간다.
//  - 필터 연산자: 한 명 = is / is not / 비어 있음, 여러 명 = 포함 / 미포함 / 비어 있음.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// DS 배럴은 실물이 vitest 에서 풀리지 않는다(별칭 경로) — 이 셀이 쓰는 것만 스텁한다.
// AnchorContextSurface 는 surface 를 늘 그리고, 열렸을 때만 panel 을 그린다(실물과 같은 방향).
vi.mock('@oobleck/systheme', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  AnchorContextSurface: ({ open, surface, panel }: Record<string, unknown>) => (
    <div>
      {surface as React.ReactNode}
      {open === true ? <div data-testid="panel">{panel as React.ReactNode}</div> : null}
    </div>
  ),
  Avatar: ({ name }: { name?: string }) => <span data-testid="avatar">{name?.[0]}</span>,
  Input: ({ onValueChange, ...rest }: Record<string, unknown>) => (
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
  X: () => <span />,
}))

const { FilterConditionRow, opsFor } = await import('./filter-builder')
const { PersonCell, PersonValue } = await import('./PersonCell')

import type { PropertyDef } from '@oobleck/collection'

afterEach(cleanup)

const OWNER: PropertyDef = {
  key: 'x:담당',
  label: '담당',
  type: 'person',
  source: 'frontmatter',
  origin: 'base',
  selfPersonId: 'acc-kim',
  options: [
    { value: 'acc-kim', label: '김미소', hint: 'kim@miso.kr' },
    { value: 'acc-park', label: '박운영', hint: 'OPERATOR' },
    { value: 'acc-gone', label: '최퇴사', inactive: true },
  ],
}

describe('사람 필터 연산자', () => {
  it('한 명은 is / is not, 여러 명은 포함 / 미포함 — 둘 다 「다음 중 하나·아님」 과 비어 있음', () => {
    expect(opsFor('person')).toEqual(['eq', 'neq', 'in', 'not_in', 'is_empty', 'is_not_empty'])
    expect(opsFor('multi_person')).toEqual([
      'has',
      'not_has',
      'in',
      'not_in',
      'is_empty',
      'is_not_empty',
    ])
  })
})

describe('사람 필터 값', () => {
  it('「나」는 계정 id 가 아니라 상대값으로 저장된다 — 보기를 연 사람마다 자기 것이 보이게', () => {
    const onChange = vi.fn()
    render(
      <FilterConditionRow
        schema={[OWNER]}
        condition={{ key: 'x:담당', op: 'eq', value: null }}
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    )
    const valueSelect = screen
      .getAllByTestId('select')
      .find((el) => within(el).queryByText('나') !== null)!
    expect(within(valueSelect).getByText('박운영')).toBeTruthy()

    fireEvent.change(valueSelect, { target: { value: '@me' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ value: { rel: 'me' } }))

    fireEvent.change(valueSelect, { target: { value: 'acc-park' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ value: 'acc-park' }))
  })
})

describe('사람 표시', () => {
  it('이름 칩으로 보이고, 못 찾는 id 는 id 그대로 보인다', () => {
    render(<PersonValue def={{ ...OWNER, type: 'multi_person' }} value={['acc-park', 'acc-x']} />)
    expect(screen.getByText('박운영')).toBeTruthy()
    expect(screen.getByText('acc-x')).toBeTruthy()
  })
})

describe('사람 피커', () => {
  it('「나」와 활성 계정만 보이고, 이메일·역할이 함께 보인다', () => {
    render(<PersonCell def={OWNER} value={null} onChange={vi.fn()} />)
    fireEvent.click(screen.getByText('사람 선택'))

    expect(screen.getByText('나 · 김미소')).toBeTruthy()
    // 「나」 줄과 명단 줄 두 군데에 이메일이 보인다.
    expect(screen.getAllByText('kim@miso.kr')).toHaveLength(2)
    expect(screen.getByText('OPERATOR')).toBeTruthy()
    expect(screen.queryByText('최퇴사')).toBeNull()
  })

  it('고르면 이름이 아니라 계정 id 가 나간다', () => {
    const onChange = vi.fn()
    render(<PersonCell def={OWNER} value={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('사람 선택'))
    fireEvent.click(screen.getByText('박운영'))
    expect(onChange).toHaveBeenCalledWith('acc-park')
  })

  it('「나」 지름길은 보는 사람의 id 를 고른다', () => {
    const onChange = vi.fn()
    render(<PersonCell def={OWNER} value={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('사람 선택'))
    fireEvent.click(screen.getByText('나 · 김미소'))
    expect(onChange).toHaveBeenCalledWith('acc-kim')
  })

  it('여러 명 칸은 더해 간다', () => {
    const onChange = vi.fn()
    render(
      <PersonCell
        def={{ ...OWNER, type: 'multi_person' }}
        value={['acc-kim']}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getAllByText('김미소')[0]!)
    fireEvent.click(screen.getByText('박운영'))
    expect(onChange).toHaveBeenCalledWith(['acc-kim', 'acc-park'])
  })
})

describe('사람 셀 — 좁은 컬럼에서 깨져 보이지 않게', () => {
  it('닫힌 셀에는 빼기(×)가 없다 — 빼기는 피커 안에서만(select 셀과 같은 규칙)', () => {
    const onChange = vi.fn()
    render(<PersonCell def={OWNER} value="acc-park" onChange={onChange} />)
    expect(screen.queryByRole('button', { name: '빼기' })).toBeNull()

    fireEvent.click(screen.getByText('박운영'))
    const panel = screen.getByTestId('panel')
    fireEvent.click(within(panel).getByRole('button', { name: '빼기' }))
    // 한 명 칸에서 빼면 비운다.
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('여러 명 칸의 피커에서 한 사람만 뺀다', () => {
    const onChange = vi.fn()
    render(
      <PersonCell
        def={{ ...OWNER, type: 'multi_person' }}
        value={['acc-kim', 'acc-park']}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getAllByText('박운영')[0]!)
    const panel = screen.getByTestId('panel')
    const removes = within(panel).getAllByRole('button', { name: '빼기' })
    expect(removes).toHaveLength(2)
    fireEvent.click(removes[1]!)
    expect(onChange).toHaveBeenCalledWith(['acc-kim'])
  })

  it('이름은 말줄임 대상이고 전체 이름은 title 로 남는다', () => {
    render(<PersonCell def={OWNER} value="acc-park" onChange={vi.fn()} />)
    const name = screen.getByText('박운영')
    expect(name.className).toContain('truncate')
    expect(name.className).toContain('min-w-0')
    expect(name.getAttribute('title')).toBe('박운영')
  })
})
