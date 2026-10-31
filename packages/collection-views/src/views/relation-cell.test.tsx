// @vitest-environment jsdom
//
// @oobleck/collection — 편집형 관계 칸(RelationCell)의 읽기 모양 핀.
//
// 편집 장치(칩 ✕ · 빈 칸 「관계 선택」)는 손댈 때만 보인다 — 평소엔 CSS 로 숨긴다(행 hover·칸 hover·포커스·
// 패널 열림에서 드러남). jsdom 은 :hover 를 그리지 않으므로 숨김 규칙이 **걸려 있는지**(클래스)를 본다.
// 「+N」 개수는 레이아웃 측정이라 jsdom 에선 0 — 실제 폭은 브라우저 스크린샷으로 확인한다.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@oobleck/systheme', () => ({
  AnchorContextSurface: ({
    surface,
    panel,
    open,
  }: {
    surface?: React.ReactNode
    panel?: React.ReactNode
    open?: boolean
  }) => React.createElement('div', null, surface, open ? panel : null),
  Input: (props: Record<string, unknown>) =>
    React.createElement('input', { 'aria-label': 'q', ...props }),
  PanelRight: () => React.createElement('svg'),
  Tag: ({
    children,
    onRemove,
    size: _size,
    shape: _shape,
    variant,
    qualifier,
    ...rest
  }: {
    children?: React.ReactNode
    onRemove?: () => void
    size?: string
    shape?: string
    variant?: string
    qualifier?: React.ReactNode
  } & Record<string, unknown>) =>
    React.createElement(
      'span',
      { ...rest, 'data-variant': variant ?? 'default' },
      qualifier ? React.createElement('i', null, qualifier) : null,
      children,
      onRemove
        ? React.createElement('button', {
            type: 'button',
            'aria-label': 'Remove',
            onClick: onRemove,
          })
        : null,
    ),
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { RelationCell } from './RelationCell'

import type { RelationOption, RelationProvider } from '@oobleck/collection'

afterEach(cleanup)

const REGIONS: RelationOption[] = [
  { id: 'r1', label: '서울 금천구' },
  { id: 'r2', label: '서울 관악구' },
  { id: 'r3', label: '서울 구로구' },
]

const provider: RelationProvider = {
  search: () => REGIONS,
  resolve: (ids) => REGIONS.filter((r) => ids.includes(r.id)),
}

async function renderCell(
  value: string[] | null,
  extra: { wrap?: boolean; emptyMark?: boolean } = {},
) {
  const onChange = vi.fn()
  await act(async () => {
    render(
      <RelationCell
        cardinality="many"
        value={value}
        provider={provider}
        onChange={onChange}
        {...extra}
      />,
    )
  })
  return { onChange, surface: screen.getAllByRole('button')[0]! }
}

describe('RelationCell — 편집 장치는 손댈 때만', () => {
  it('칩의 ✕ 는 평소 숨김 규칙이 걸리고, 행 hover·칸 hover·포커스에서 드러난다', async () => {
    const { surface } = await renderCell(['r1', 'r2'])
    expect(screen.getByText('서울 금천구')).toBeInTheDocument()
    const cls = surface.className
    expect(cls).toContain('[&_[data-rel-chip]>button]:hidden')
    expect(cls).toContain('group-hover/row:[&_[data-rel-chip]>button]:flex')
    expect(cls).toContain('focus-within:[&_[data-rel-chip]>button]:flex')
  })

  it('빈 칸의 「관계 선택」은 자리를 지키되 평소엔 보이지 않는다', async () => {
    await renderCell(null)
    const hint = screen.getByText('관계 선택')
    expect(hint.className).toContain('invisible')
    expect(hint.className).toContain('group-hover/row:visible')
  })

  it('평소 빈 칸에는 「—」가 없다(비워 둔다)', async () => {
    await renderCell(null)
    expect(screen.queryByText('—')).toBeNull()
  })

  it('emptyMark(조건부 서식이 칠한 칸)면 빈 칸에 「—」 — 손대면 안내에 자리를 비켜 준다', async () => {
    await renderCell(null, { emptyMark: true })
    const dash = screen.getByText('—')
    // 글자색은 칸(서식)을 따른다 — 자기 색을 갖지 않는다.
    expect(dash.className).not.toMatch(/text-fg/)
    expect(dash.className).toContain('group-hover/row:hidden')
    expect(screen.getByText('관계 선택').className).toContain('invisible')
  })

  it('emptyMark 여도 값이 있으면 칩만 그린다', async () => {
    await renderCell(['r1'], { emptyMark: true })
    expect(screen.queryByText('—')).toBeNull()
  })

  it('패널을 열면(편집 중) 숨김 규칙이 빠진다', async () => {
    const { surface } = await renderCell(['r1'])
    await act(async () => {
      fireEvent.click(surface)
    })
    expect(surface.className).not.toContain('[&_[data-rel-chip]>button]:hidden')
    expect(surface.className).toContain('[&_[data-rel-chip]>button]:flex')
  })

  it('✕ 로 칩 하나를 지운다 — 동작은 그대로', async () => {
    const { onChange } = await renderCell(['r1', 'r2'])
    fireEvent.click(screen.getAllByLabelText('Remove')[0]!)
    expect(onChange).toHaveBeenCalledWith(['r2'])
  })
})

describe('RelationCell — 한 줄 + 「+N」', () => {
  it('기본은 칩 줄을 한 줄 높이로 자르고, 전체 목록은 title 에 둔다', async () => {
    const { surface } = await renderCell(['r1', 'r2', 'r3'])
    expect(surface).toHaveAttribute('title', '서울 금천구, 서울 관악구, 서울 구로구')
    expect(surface.className).toContain('h-6')
    const chips = screen.getByText('서울 금천구').closest('[data-rel-chip]')!.parentElement!
      .parentElement!
    expect(chips.className).toContain('max-h-5.5 overflow-hidden')
  })

  it('wrap=true(뷰 wrapCells)면 자르지 않는다', async () => {
    const { surface } = await renderCell(['r1', 'r2', 'r3'], { wrap: true })
    expect(surface.className).toContain('min-h-7')
    const chips = screen.getByText('서울 금천구').closest('[data-rel-chip]')!.parentElement!
      .parentElement!
    expect(chips.className).not.toContain('overflow-hidden')
  })
})

const GOYANG: RelationOption[] = [
  { id: 'c1', label: '고양 전체', parts: { qualifier: '고양', name: '전체' } },
  { id: 'd1', label: '고양 덕양구', parts: { qualifier: '고양', name: '덕양구' }, coveredBy: 'c1' },
  {
    id: 'd2',
    label: '고양 일산동구',
    parts: { qualifier: '고양', name: '일산동구' },
    coveredBy: 'c1',
  },
  { id: 'd3', label: '서울 구로구', parts: { qualifier: '서울', name: '구로구' } },
]

const goyangProvider: RelationProvider = {
  search: () => GOYANG,
  resolve: (ids) => GOYANG.filter((r) => ids.includes(r.id)),
}

async function renderGoyang(value: string[] | null, readOnly = false) {
  const onChange = vi.fn()
  await act(async () => {
    render(
      <RelationCell
        cardinality="many"
        value={value}
        provider={goyangProvider}
        onChange={readOnly ? undefined : onChange}
      />,
    )
  })
  return { onChange }
}

describe('RelationCell — 계층 칩과 덮임', () => {
  it('parts 가 있는 옵션은 회색 면 칩(앞말 + 본말), 없는 옵션은 기본 칩', async () => {
    await renderGoyang(['d3'])
    const chip = screen.getByText('구로구').closest('[data-rel-chip]')!
    expect(chip).toHaveAttribute('data-variant', 'subtle')
    expect(chip.textContent).toContain('서울')
    cleanup()
    await renderCell(['r1'])
    expect(screen.getByText('서울 금천구').closest('[data-rel-chip]')).toHaveAttribute(
      'data-variant',
      'default',
    )
  })

  it('같은 칸에 「고양 전체」가 있으면 고양의 구 칩은 숨고, 툴팁도 전체 하나만', async () => {
    await renderGoyang(['d1', 'c1', 'd3'])
    expect(screen.queryByText('덕양구')).not.toBeInTheDocument()
    expect(screen.getByText('전체')).toBeInTheDocument()
    expect(screen.getAllByRole('button')[0]).toHaveAttribute('title', '고양 전체, 서울 구로구')
  })

  it('「고양 전체」를 지우면 그 아래 숨어 있던 구도 함께 지운다', async () => {
    const { onChange } = await renderGoyang(['d1', 'c1', 'd3'])
    fireEvent.click(screen.getByText('전체').closest('[data-rel-chip]')!.querySelector('button')!)
    expect(onChange).toHaveBeenCalledWith(['d3'])
  })

  it('onChange 가 없으면 읽기 전용 — 칩은 그리되 ✕ 와 고르기 입구가 없고, 빈 칸은 「—」', async () => {
    await renderGoyang(['d3'], true)
    expect(screen.getByText('구로구')).toBeInTheDocument()
    expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    cleanup()
    await renderGoyang(null, true)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('RelationCell — 모르는 레코드와 늦게 오는 대상 목록', () => {
  it('missing 옵션은 흐린 칩(편집형) · 흐린 글자(읽기 전용), title 에 id', async () => {
    const p: RelationProvider = {
      search: () => [],
      resolve: (ids) => ids.map((id) => ({ id, label: '알 수 없는 구역', missing: true })),
    }
    await act(async () => {
      render(<RelationCell cardinality="many" value={['x1']} provider={p} onChange={vi.fn()} />)
    })
    const chip = screen.getByText('알 수 없는 구역').closest('[data-rel-chip]')!
    expect(chip.className).toContain('text-fg-muted')
    expect(chip).toHaveAttribute('title', '알 수 없는 구역 · x1')
    expect(chip.querySelector('button')).not.toBeNull()
    cleanup()
    await act(async () => {
      render(<RelationCell cardinality="one" value="x1" provider={p} />)
    })
    const text = screen.getByText('알 수 없는 구역')
    expect(text.tagName).toBe('SPAN')
    expect(text).toHaveAttribute('title', '알 수 없는 구역 · x1')
  })

  it('답을 받기 전에는 id 를 그리지 않고, provider 가 바뀌면 다시 물어 라벨을 바꾼다', async () => {
    const waiting: RelationProvider = { search: () => [], resolve: () => new Promise(() => {}) }
    let rerender!: (ui: React.ReactElement) => void
    await act(async () => {
      ;({ rerender } = render(
        <RelationCell cardinality="many" value={['d3']} provider={waiting} />,
      ))
    })
    expect(screen.queryByText('d3')).not.toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    await act(async () => {
      rerender(<RelationCell cardinality="many" value={['d3']} provider={goyangProvider} />)
    })
    expect(screen.getByText('구로구')).toBeInTheDocument()
  })
})
