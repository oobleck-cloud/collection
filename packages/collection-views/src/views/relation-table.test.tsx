// @vitest-environment jsdom
//
// @oobleck/collection — 관계 표(카드 블록) 핀.
//
// 보드 카드 아래에 관계 속성이 가리키는 대상 레코드를 작은 표로 — 열은 대상 스키마, 줄은 관계 값 순서, 넘치면
// 「+ N개 더」 한 줄, 줄 동작 버튼은 호스트가 단다. 카드 클릭(열기)과 줄 동작이 섞이지 않아야 한다.

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// design-system 배럴 경량 스텁(views.test 와 같은 전략) — 대상 컴포넌트의 자체 로직이 핵심.
// 레이아웃 패널이 뷰 레지스트리(CollectionView → 모든 뷰)를 끌어오므로, 여기 없는 이름은 빈 컴포넌트로 답한다.
vi.mock('@oobleck/systheme', () => {
  const stub = () => null
  const named = buildStubs()
  return new Proxy(named, {
    get: (target, key) =>
      key in target ? target[key as keyof typeof target] : key === 'then' ? undefined : stub,
    has: () => true,
  })
})

function buildStubs() {
  const icon =
    (id: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${id}`, className })
  return {
    ...Object.fromEntries(
      [
        'ArrowLeftRight',
        'CalendarDays',
        'Hash',
        'Link2',
        'List',
        'Mail',
        'Phone',
        'Plus',
        'SquareCheck',
        'Tags',
        'Type',
        'User',
        'Users',
      ].map((n) => [n, icon(n.toLowerCase())]),
    ),
    Map: icon('map'),
    Tag: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', { 'data-testid': 'tag' }, children),
    Button: ({
      children,
      onClick,
      onKeyDown,
      variant,
    }: {
      children?: React.ReactNode
      onClick?: (e: React.MouseEvent) => void
      onKeyDown?: (e: React.KeyboardEvent) => void
      variant?: string
    }) =>
      React.createElement(
        'button',
        { type: 'button', onClick, onKeyDown, 'data-variant': variant },
        children,
      ),
    Switch: ({
      checked,
      onCheckedChange,
      'aria-label': label,
    }: {
      checked: boolean
      onCheckedChange: (v: boolean) => void
      'aria-label'?: string
    }) =>
      React.createElement('button', {
        role: 'switch',
        'aria-checked': checked,
        'aria-label': label,
        onClick: () => onCheckedChange(!checked),
      }),
    Select: ({
      value,
      onChange,
      options,
      'aria-label': label,
    }: {
      value?: string
      onChange?: (v: string) => void
      options: { value: string; label: string }[]
      'aria-label'?: string
    }) =>
      React.createElement(
        'select',
        {
          value,
          'aria-label': label,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value),
        },
        options.map((o) =>
          React.createElement('option', { key: o.value, value: o.value }, o.label),
        ),
      ),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    formatPhoneNumber: (v: string) => v,
  }
}
vi.mock('./row-action-menu', () => ({ RowActionMenu: () => null }))
vi.mock('./PersonCell', () => ({ PersonValue: () => null }))
vi.mock('./group-panel', () => ({ GroupPanel: () => null }))

import { BoardView } from './BoardView'
import { RelationTable } from './RelationTable'
import { LayoutPanel } from './view-layout-panel'

import type {
  BlockDocument,
  BlockPack,
  PropertyDef,
  PropertyValue,
  RelatedRecordRow,
  RelatedRecordSource,
  RelationProvider,
  ViewConfig,
} from '@oobleck/collection'

afterEach(cleanup)

const def = (
  d: Partial<PropertyDef> & Pick<PropertyDef, 'key' | 'label' | 'type'>,
): PropertyDef => ({ source: 'projection', origin: 'preset', ...d })

const TARGET_SCHEMA: PropertyDef[] = [
  def({ key: 'name', label: '이름', type: 'text' }),
  def({ key: 'amount', label: '금액', type: 'number', format: (v) => `${String(v)}만` }),
  def({
    key: 'state',
    label: '상태',
    type: 'text',
    render: (v) => React.createElement('em', { 'data-testid': 'state' }, String(v)),
  }),
]

const ROWS: RelatedRecordRow[] = [
  { id: 'r1', props: { name: '가', amount: 120, state: '대기' } },
  { id: 'r2', props: { name: '나', amount: 130, state: '합의' } },
  { id: 'r3', props: { name: '다', amount: 140, state: '부재' } },
  { id: 'r4', props: { name: '라', amount: 150, state: '대기' } },
  { id: 'r5', props: { name: '마', amount: 160, state: '대기' } },
]

describe('RelationTable', () => {
  it('열 머리 = 대상 속성 라벨, 셀은 render → format 순으로 그린다', () => {
    render(<RelationTable recordId="p" rows={ROWS.slice(0, 1)} columns={TARGET_SCHEMA} />)
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent)
    expect(heads).toEqual(['이름', '금액', '상태'])
    const row = screen.getAllByRole('row')[1]!
    expect(within(row).getByText('가')).toBeTruthy()
    expect(within(row).getByText('120만')).toBeTruthy()
    expect(within(row).getByTestId('state').textContent).toBe('대기')
  })

  it('maxRows 까지만 그리고 나머지는 「+ N곳 더 · 다음 줄 요약」 한 줄로 접는다', () => {
    render(
      <RelationTable recordId="p" rows={ROWS} columns={TARGET_SCHEMA} maxRows={3} countUnit="곳" />,
    )
    // 머리 1 + 줄 3
    expect(screen.getAllByRole('row')).toHaveLength(4)
    expect(screen.getByText('+ 2곳 더 · 라 150만')).toBeTruthy()
  })

  it('줄이 maxRows 이하면 접는 줄이 없다', () => {
    render(<RelationTable recordId="p" rows={ROWS.slice(0, 2)} columns={TARGET_SCHEMA} />)
    expect(screen.queryByText(/더/)).toBeNull()
  })

  it('셈 단위가 없으면 로캘 기본(「개」)', () => {
    render(<RelationTable recordId="p" rows={ROWS} columns={TARGET_SCHEMA} maxRows={4} />)
    expect(screen.getByText('+ 1개 더 · 마 160만')).toBeTruthy()
  })

  it('줄 동작 — 보일 줄에만, 실행은 (부모 id, 줄 id), 카드 클릭으로 새지 않는다', () => {
    const run = vi.fn()
    const onCardClick = vi.fn()
    render(
      // 카드처럼 클릭 = 열기인 바깥 — 줄 동작이 여기로 새면 안 된다.
      <div role="button" tabIndex={0} onClick={onCardClick} onKeyDown={onCardClick}>
        <RelationTable
          recordId="parent-1"
          rows={ROWS.slice(0, 3)}
          columns={TARGET_SCHEMA}
          actions={[{ id: 'call', label: '전화', run, visible: (r) => r.props.state !== '합의' }]}
        />
      </div>,
    )
    const buttons = screen.getAllByRole('button', { name: '전화' })
    expect(buttons).toHaveLength(2)
    fireEvent.click(buttons[1]!)
    expect(run).toHaveBeenCalledWith({ recordId: 'parent-1', relatedId: 'r3' })
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('줄이 없으면 그리지 않는다 — emptyLabel 을 주면 그 한 줄', () => {
    const { container, rerender } = render(
      <RelationTable recordId="p" rows={[]} columns={TARGET_SCHEMA} />,
    )
    expect(container.innerHTML).toBe('')
    rerender(<RelationTable recordId="p" rows={[]} columns={TARGET_SCHEMA} emptyLabel="없음" />)
    expect(screen.getByText('없음')).toBeTruthy()
  })
})

describe('RelationTable — 목록 모양(variant list) · 접어 두기(collapsed)', () => {
  it('목록은 머리 줄 · 테두리 · 줄 사이 선이 없고, 수는 오른쪽 맞춤 고정폭', () => {
    const { container } = render(
      <RelationTable recordId="p" rows={ROWS.slice(0, 2)} columns={TARGET_SCHEMA} variant="list" />,
    )
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
    expect(screen.getAllByRole('row')).toHaveLength(2)
    const root = container.querySelector('[data-relation-table]')!
    expect(root.getAttribute('data-variant')).toBe('list')
    expect(container.innerHTML).not.toMatch(/\bborder-t\b|\bborder-border\b/)
    const amount = screen.getByText('120만')
    expect(amount.className).toContain('text-right')
    expect(amount.className).toContain('tabular-nums')
  })

  it('목록의 줄 동작 — 첫 줄은 채운 버튼(primary), 나머지는 회색(secondary). 표 모양은 그대로 ghost', () => {
    const actions = [{ id: 'call', label: '전화', run: vi.fn() }]
    const { rerender } = render(
      <RelationTable
        recordId="p"
        rows={ROWS.slice(0, 3)}
        columns={TARGET_SCHEMA}
        actions={actions}
        variant="list"
      />,
    )
    expect(
      screen.getAllByRole('button', { name: '전화' }).map((b) => b.getAttribute('data-variant')),
    ).toEqual(['primary', 'secondary', 'secondary'])
    rerender(
      <RelationTable
        recordId="p"
        rows={ROWS.slice(0, 3)}
        columns={TARGET_SCHEMA}
        actions={actions}
      />,
    )
    expect(
      screen.getAllByRole('button', { name: '전화' }).map((b) => b.getAttribute('data-variant')),
    ).toEqual(['ghost', 'ghost', 'ghost'])
  })

  it('목록의 「+ N곳 더」는 글자 링크 — 누르면 그 자리에서 나머지 줄을 펴고, 카드는 열리지 않는다', () => {
    const onCardClick = vi.fn()
    render(
      <div role="button" tabIndex={0} onClick={onCardClick} onKeyDown={onCardClick}>
        <RelationTable
          recordId="p"
          rows={ROWS}
          columns={TARGET_SCHEMA}
          maxRows={3}
          countUnit="곳"
          variant="list"
        />
      </div>,
    )
    expect(screen.getAllByRole('row')).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: '+ 2곳 더 · 라 150만' }))
    expect(screen.getAllByRole('row')).toHaveLength(5)
    expect(screen.queryByText(/더/)).toBeNull()
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('접어 두면 「견적 5곳 보기」 한 줄 — 누르면 그 자리에서 펴고 카드 클릭으로 새지 않는다', () => {
    const onCardClick = vi.fn()
    render(
      <div role="button" tabIndex={0} onClick={onCardClick} onKeyDown={onCardClick}>
        <RelationTable
          recordId="p"
          rows={ROWS}
          columns={TARGET_SCHEMA}
          countUnit="곳"
          label="견적"
          collapsed
          variant="list"
        />
      </div>,
    )
    expect(screen.queryByRole('table')).toBeNull()
    const toggle = screen.getByText('견적 5곳 보기')
    fireEvent.keyDown(toggle, { key: 'Enter' })
    expect(onCardClick).not.toHaveBeenCalled()
    fireEvent.click(toggle)
    expect(onCardClick).not.toHaveBeenCalled()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(3)
  })

  it('접힌 줄에 이름이 없으면 수만 — 셈 단위도 없으면 로캘 기본', () => {
    render(<RelationTable recordId="p" rows={ROWS.slice(0, 2)} columns={TARGET_SCHEMA} collapsed />)
    expect(screen.getByRole('button', { name: '2개 보기' })).toBeTruthy()
  })
})

// ── 보드 카드 · 레이아웃 패널 배선 ───────────────────────────────────────────────

type P = Record<string, PropertyValue>

const SCHEMA: PropertyDef[] = [
  def({ key: 'title', label: '제목', type: 'text' }),
  def({
    key: 'stage',
    label: '단계',
    type: 'select',
    options: [{ value: 'new' }, { value: 'doing' }],
  }),
  def({ key: 'items', label: '항목', type: 'relation', relation: { target: 'items' } }),
  def({ key: 'memo', label: '메모', type: 'text' }),
]

const PACK: BlockPack<P> = {
  propertySchema: SCHEMA,
  readProperties: (doc: BlockDocument) => doc.properties ?? {},
  writeProperty: (doc) => doc,
}

const records = [
  {
    id: 'o1',
    doc: { properties: { title: '카드1', stage: 'new', items: ['r2', 'r1'], memo: 'm' } },
  },
  { id: 'o2', doc: { properties: { title: '카드2', stage: 'doing', items: null, memo: 'n' } } },
]

const byId = new Map(ROWS.map((r) => [r.id, r]))
const itemsSource = (extra: Partial<RelatedRecordSource> = {}): RelatedRecordSource => ({
  schema: TARGET_SCHEMA,
  read: (ids) => ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
  ...extra,
})
const relations = (source: RelatedRecordSource): Record<string, RelationProvider> => ({
  items: { search: () => [], resolve: () => [], records: source },
})

const view = (partial: Partial<ViewConfig> = {}): ViewConfig => ({
  type: 'board',
  filters: { op: 'and', children: [] },
  sort: [],
  groupBy: 'stage',
  ...partial,
})

describe('BoardView 관계 표', () => {
  it('카드 아래에 관계 값 순서대로 표를 그리고, 관계 속성은 카드 속성 줄에서 뺀다', () => {
    const open = vi.fn()
    const run = vi.fn()
    render(
      <BoardView
        records={records}
        pack={PACK}
        view={view({ relationTable: { key: 'items', columns: ['name', 'amount'] } })}
        relations={relations(itemsSource({ rowActions: [{ id: 'go', label: '실행', run }] }))}
        onOpen={open}
      />,
    )
    const tables = screen.getAllByRole('table')
    // 관계 값이 빈 카드(카드2)는 표가 없다.
    expect(tables).toHaveLength(1)
    const bodyRows = within(tables[0]!).getAllByRole('row').slice(1)
    expect(bodyRows.map((r) => r.textContent)).toEqual(['나130만실행', '가120만실행'])
    // 관계 id 가 칩 글자로 새지 않는다.
    expect(screen.queryByText(/r2/)).toBeNull()
    fireEvent.click(within(bodyRows[0]!).getByRole('button', { name: '실행' }))
    expect(run).toHaveBeenCalledWith({ recordId: 'o1', relatedId: 'r2' })
    expect(open).not.toHaveBeenCalled()
  })

  it('provider 에 records 가 없으면 표 없이 현행 카드', () => {
    render(
      <BoardView
        records={records}
        pack={PACK}
        view={view({ relationTable: { key: 'items' } })}
        relations={{ items: { search: () => [], resolve: () => [] } }}
      />,
    )
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('카드 크기가 열 폭이 된다 — 기본 M(w-72), L 은 넓은 카드(w-100)', () => {
    const { container, rerender } = render(
      <BoardView records={records} pack={PACK} view={view()} />,
    )
    expect(container.querySelector('.w-72')).not.toBeNull()
    rerender(<BoardView records={records} pack={PACK} view={view({ cardSize: 'L' })} />)
    expect(container.querySelector('.w-100')).not.toBeNull()
    expect(container.querySelector('.w-72')).toBeNull()
  })

  it('서버 모드면 받은 카드를 다시 거르지 않는다 — 상대 날짜 · 서버 계산 열 조건에서도 카드가 남는다', () => {
    // 서버만 아는 열(마감)에 「지금」 조건 — 화면이 다시 돌리면 값이 없어 전부 빠진다(10-26 「조율 필요」 빈 보드).
    const filtered = view({
      filters: {
        op: 'and',
        children: [{ key: 'closeAt', op: 'lt', value: { rel: 'date', unit: 'hour', offset: 0 } }],
      },
    })
    const { rerender } = render(<BoardView records={records} pack={PACK} view={filtered} />)
    expect(screen.queryByText('카드1')).toBeNull()
    rerender(<BoardView records={records} pack={PACK} view={filtered} queryMode="server" />)
    expect(screen.getByText('카드1')).toBeTruthy()
    expect(screen.getByText('카드2')).toBeTruthy()
  })
})

describe('BoardView 표면 · 빈 열 접기', () => {
  it('열 머리는 색 칩 대신 이름 + 수, 열과 카드에 테두리가 없다(눌린 면 위에 그림자로 뜬 카드)', () => {
    const { container } = render(<BoardView records={records} pack={PACK} view={view()} />)
    const col = container.querySelector('[data-board-column="new"]') as HTMLElement
    expect(col.className).toContain('bg-canvas')
    expect(col.className).not.toMatch(/\bborder\b/)
    expect(screen.queryAllByTestId('tag')).toHaveLength(0)
    expect(col.textContent).toContain('new1')
    const card = screen.getByText('카드1').closest('[draggable]') as HTMLElement
    expect(card.className).toContain('shadow-float')
    expect(card.className).not.toMatch(/\bborder\b/)
  })

  it('collapseEmptyGroups — 카드 없는 열은 띠 안의 가로 줄(이름 + 0), 끄는 동안엔 제 폭으로 펴진다', () => {
    const one = [records[0]!]
    const { container } = render(
      <BoardView
        records={one}
        pack={PACK}
        view={view({ collapseEmptyGroups: true })}
        onEdit={vi.fn()}
      />,
    )
    const empty = () => container.querySelector('[data-board-column="doing"]') as HTMLElement
    expect(empty().hasAttribute('data-collapsed')).toBe(true)
    // 글자를 세로로 세우지 않는다 — 「진행 중」이 한 자씩 끊겨 읽혔다(2026-10-26).
    expect(empty().querySelector('[style*="writing-mode"]')).toBeNull()
    expect(empty().closest('[data-board-rail]')!.className).toContain('w-28')
    expect(empty().textContent).toBe('doing0')
    // 카드가 있는 열은 그대로.
    expect(
      container.querySelector('[data-board-column="new"]')!.hasAttribute('data-collapsed'),
    ).toBe(false)

    const card = screen.getByText('카드1').closest('[draggable]') as HTMLElement
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    expect(empty().hasAttribute('data-collapsed')).toBe(false)
    expect(empty().className).toContain('w-72')
    fireEvent.dragEnd(card)
    expect(empty().hasAttribute('data-collapsed')).toBe(true)
  })

  it('collapseEmptyGroups — 이웃한 빈 열은 띠 하나에 순서대로 쌓인다', () => {
    const { container } = render(
      <BoardView
        records={[]}
        pack={PACK}
        view={view({ collapseEmptyGroups: true })}
        onEdit={vi.fn()}
      />,
    )
    const rails = container.querySelectorAll('[data-board-rail]')
    expect(rails).toHaveLength(1)
    expect(
      [...rails[0]!.querySelectorAll('[data-board-column]')].map((el) =>
        el.getAttribute('data-board-column'),
      ),
    ).toEqual(['new', 'doing'])
  })

  it('끈 카드를 띠가 펴진 빈 열에 놓으면 그 열 값으로 옮긴다', () => {
    const onEdit = vi.fn()
    const { container } = render(
      <BoardView
        records={[records[0]!]}
        pack={PACK}
        view={view({ collapseEmptyGroups: true })}
        onEdit={onEdit}
      />,
    )
    const card = screen.getByText('카드1').closest('[draggable]') as HTMLElement
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    const target = container.querySelector('[data-board-column="doing"]') as HTMLElement
    fireEvent.dragOver(target, { dataTransfer: { dropEffect: '' } })
    expect(target.className).toContain('bg-brand-50')
    fireEvent.drop(target)
    expect(onEdit).toHaveBeenCalledWith('o1', 'stage', 'doing')
  })

  it('묶은 속성이 읽기 전용(콜 기록으로만 고치는 속성)이면 카드를 다른 열로 옮기지 않고, 열 머리에 까닭을 단다', () => {
    const onEdit = vi.fn()
    const locked = SCHEMA.map((d) =>
      d.key === 'stage'
        ? { ...d, source: 'projection' as const, locked: true, readOnlyReason: '콜 기록으로 수정' }
        : d,
    )
    const { container } = render(
      <BoardView
        records={records}
        pack={PACK}
        schema={locked}
        view={view()}
        onEdit={onEdit}
        onCardOrderChange={vi.fn()}
      />,
    )
    expect(container.querySelectorAll('[title="콜 기록으로 수정"]').length).toBeGreaterThan(0)
    const card = screen.getByText('카드1').closest('[draggable]') as HTMLElement
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    const target = container.querySelector('[data-board-column="doing"]') as HTMLElement
    fireEvent.dragOver(target, { dataTransfer: { dropEffect: '' } })
    expect(target.className).not.toContain('bg-brand-50')
    fireEvent.drop(target)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('빈 열 접기를 꺼 두면(기본) 빈 열도 제 폭 · hideEmptyGroups 면 빈 열 자체가 없다', () => {
    const { container, rerender } = render(
      <BoardView records={[records[0]!]} pack={PACK} view={view()} />,
    )
    expect(container.querySelector('[data-collapsed]')).toBeNull()
    expect(container.querySelector('[data-board-column="doing"]')).not.toBeNull()
    rerender(
      <BoardView
        records={[records[0]!]}
        pack={PACK}
        view={view({ collapseEmptyGroups: true, hideEmptyGroups: true })}
      />,
    )
    expect(container.querySelector('[data-board-column="doing"]')).toBeNull()
  })

  it('관계 표 설정의 variant · collapsed 가 카드의 표로 전해진다', () => {
    render(
      <BoardView
        records={records}
        pack={PACK}
        view={view({
          relationTable: {
            key: 'items',
            columns: ['name', 'amount'],
            variant: 'list',
            collapsed: true,
          },
        })}
        relations={relations(itemsSource({ countUnit: '곳' }))}
      />,
    )
    // 관계 속성 라벨(「항목」)이 접힌 줄의 이름이 된다.
    fireEvent.click(screen.getByRole('button', { name: '항목 2곳 보기' }))
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
    expect(screen.getAllByRole('row').map((r) => r.textContent)).toEqual(['나130만', '가120만'])
  })
})

describe('BoardView 카드 열기 — ⌘/Ctrl · 가운데 클릭 = 새 탭', () => {
  const renderBoard = () => {
    const open = vi.fn()
    const run = vi.fn()
    render(
      <BoardView
        records={records}
        pack={PACK}
        view={view({ relationTable: { key: 'items', columns: ['name'] } })}
        relations={relations(itemsSource({ rowActions: [{ id: 'call', label: '네고 콜', run }] }))}
        onOpen={open}
      />,
    )
    const card = screen.getByText('카드1').closest('[draggable]') as HTMLElement
    return { open, run, card }
  }

  it('카드 클릭은 원본 이벤트를 넘긴다 — 호스트가 ⌘/Ctrl+클릭을 새 탭으로 읽는다(표 제목과 같다)', () => {
    const { open, card } = renderBoard()
    fireEvent.click(card, { metaKey: true })
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0]![0]).toBe('o1')
    expect(open.mock.calls[0]![1]).toMatchObject({ metaKey: true })
  })

  it('가운데 클릭(auxclick button 1)도 그 카드를 연다 — 오른쪽 클릭(button 2)은 아니다', () => {
    const { open, card } = renderBoard()
    fireEvent(card, new MouseEvent('auxclick', { bubbles: true, button: 2 }))
    expect(open).not.toHaveBeenCalled()
    fireEvent(card, new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(open.mock.calls[0]![0]).toBe('o1')
    expect(open.mock.calls[0]![1]).toMatchObject({ button: 1 })
  })

  it('관계 표의 「네고 콜」은 클릭 · 가운데 클릭 모두 카드를 열지 않는다', () => {
    const { open, run } = renderBoard()
    const callButton = screen.getAllByRole('button', { name: '네고 콜' })[0]!
    fireEvent(callButton, new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(callButton, { metaKey: true })
    expect(run).toHaveBeenCalledWith({ recordId: 'o1', relatedId: 'r2' })
    expect(open).not.toHaveBeenCalled()
  })
})

describe('LayoutPanel 관계 표', () => {
  it('보드에서 관계 속성 · 줄 수 · 열을 고른다', () => {
    const onViewChange = vi.fn()
    const { rerender } = render(
      <LayoutPanel
        view={view()}
        schema={SCHEMA}
        onViewChange={onViewChange}
        relations={relations(itemsSource())}
      />,
    )
    fireEvent.change(screen.getByLabelText('관계 표'), { target: { value: 'items' } })
    expect(onViewChange).toHaveBeenLastCalledWith({ relationTable: { key: 'items' } })

    rerender(
      <LayoutPanel
        view={view({ relationTable: { key: 'items' } })}
        schema={SCHEMA}
        onViewChange={onViewChange}
        relations={relations(itemsSource({ defaultColumns: ['name', 'amount'] }))}
      />,
    )
    fireEvent.change(screen.getByLabelText('표 행 수'), { target: { value: '2' } })
    expect(onViewChange).toHaveBeenLastCalledWith({ relationTable: { key: 'items', maxRows: 2 } })
    // 기본 열(이름·금액)에서 상태를 켜면 대상 스키마 순서대로 세 열.
    const stateSwitch = screen.getByRole('switch', { name: '상태' })
    expect(stateSwitch.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(stateSwitch)
    expect(onViewChange).toHaveBeenLastCalledWith({
      relationTable: { key: 'items', columns: ['name', 'amount', 'state'] },
    })
  })

  it('관계 표의 모양(표/목록) · 접어서 보기를 고른다', () => {
    const onViewChange = vi.fn()
    render(
      <LayoutPanel
        view={view({ relationTable: { key: 'items', maxRows: 2 } })}
        schema={SCHEMA}
        onViewChange={onViewChange}
        relations={relations(itemsSource())}
      />,
    )
    const variant = screen.getByLabelText('표 모양') as HTMLSelectElement
    expect(variant.value).toBe('table')
    fireEvent.change(variant, { target: { value: 'list' } })
    expect(onViewChange).toHaveBeenLastCalledWith({
      relationTable: { key: 'items', maxRows: 2, variant: 'list' },
    })
    fireEvent.click(screen.getByRole('switch', { name: '접어서 보기' }))
    expect(onViewChange).toHaveBeenLastCalledWith({
      relationTable: { key: 'items', maxRows: 2, collapsed: true },
    })
  })

  it('보드에 「빈 열 접기」 — 그룹이 있고 빈 그룹을 숨기지 않을 때만', () => {
    const onViewChange = vi.fn()
    const { rerender } = render(
      <LayoutPanel view={view()} schema={SCHEMA} onViewChange={onViewChange} />,
    )
    fireEvent.click(screen.getByRole('switch', { name: '빈 열 접기' }))
    expect(onViewChange).toHaveBeenLastCalledWith({ collapseEmptyGroups: true })
    rerender(
      <LayoutPanel
        view={view({ hideEmptyGroups: true })}
        schema={SCHEMA}
        onViewChange={onViewChange}
      />,
    )
    expect(screen.queryByRole('switch', { name: '빈 열 접기' })).toBeNull()
    rerender(
      <LayoutPanel view={view({ type: 'gallery' })} schema={SCHEMA} onViewChange={onViewChange} />,
    )
    expect(screen.queryByRole('switch', { name: '빈 열 접기' })).toBeNull()
  })

  it('표가 아닌 레이아웃에는 관계 표 설정이 없다', () => {
    render(
      <LayoutPanel
        view={view({ type: 'table' })}
        schema={SCHEMA}
        onViewChange={vi.fn()}
        relations={relations(itemsSource())}
      />,
    )
    expect(screen.queryByLabelText('관계 표')).toBeNull()
  })
})

describe('RelationTable — 상자 안 줄(variant rows): 버튼 없이 줄 전체가 첫 동작', () => {
  it('줄을 누르면 첫 동작을 그 줄 id 로 부르고, 버튼은 그리지 않는다', () => {
    const run = vi.fn()
    const { container } = render(
      <RelationTable
        recordId="order-1"
        rows={ROWS.slice(0, 2)}
        columns={TARGET_SCHEMA}
        actions={[{ id: 'call', label: '네고 콜', run }]}
        variant="rows"
      />,
    )
    expect(container.querySelector('[data-relation-table]')!.getAttribute('data-variant')).toBe(
      'rows',
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
    // 상자 · 구분선 없이 머리말이 누를 수 있다고 말한다.
    expect(screen.getByText('2개 · 눌러서 네고 콜')).toBeTruthy()
    const rows = screen.getAllByRole('button')
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual(['가 네고 콜', '나 네고 콜'])
    fireEvent.click(rows[1]!)
    expect(run).toHaveBeenCalledWith({ recordId: 'order-1', relatedId: 'r2' })
    fireEvent.keyDown(rows[0]!, { key: 'Enter' })
    expect(run).toHaveBeenLastCalledWith({ recordId: 'order-1', relatedId: 'r1' })
  })

  it('줄 클릭은 카드(부모) 열기로 새지 않는다', () => {
    const onCard = vi.fn()
    render(
      // 카드처럼 누를 수 있는 부모 — 카드(RecordCard)도 role=button 에 클릭 · 키를 단다.
      <div role="button" tabIndex={0} onClick={onCard} onKeyDown={onCard}>
        <RelationTable
          recordId="p"
          rows={ROWS.slice(0, 1)}
          columns={TARGET_SCHEMA}
          actions={[{ id: 'call', label: '콜', run: vi.fn() }]}
          variant="rows"
        />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: '가 콜' }))
    expect(onCard).not.toHaveBeenCalled()
  })

  it('동작이 안 보이는 줄은 누를 수 없다 · 넘치는 줄은 바닥 한 줄로 접고 누르면 편다', () => {
    render(
      <RelationTable
        recordId="p"
        rows={ROWS}
        columns={TARGET_SCHEMA}
        maxRows={3}
        actions={[{ id: 'call', label: '콜', run: vi.fn(), visible: (r) => r.id !== 'r1' }]}
        variant="rows"
        countUnit="곳"
      />,
    )
    expect(screen.getAllByRole('button', { name: /콜$/ })).toHaveLength(2)
    const more = screen.getByRole('button', { name: /2곳 더/ })
    expect(more.textContent).toBe('+ 2곳 더 · 라 150만')
    fireEvent.click(more)
    expect(screen.getAllByRole('button', { name: /콜$/ })).toHaveLength(4)
  })
})
