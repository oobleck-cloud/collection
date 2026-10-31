// @vitest-environment jsdom
//
// @oobleck/collection — MVOS 확장 3종의 TableView 통합 핀.
//
//  1. queryMode='server' — 서버가 이미 해소한 행을 뷰가 다시 거르거나 정렬하지 않는다.
//  2. PropertyDef.render — 커스텀 셀 이스케이프 해치가 타입별 렌더·format 보다 앞선다.
//  3. view.conditionalFormats — 조건부 서식이 셀 className 으로 나간다.
//
// 왜 이 셋을 특히 핀하나: 전부 "조용히 틀릴 수 있는" 축이다. 서버 모드에서 재필터가 새면
// 행이 사라지는데 화면은 멀쩡해 보이고, 조건부 서식이 안 걸리면 그냥 색이 없는 표로 보인다.

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@oobleck/systheme', () => {
  const makeIcon =
    (id: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${id}`, className })

  const icons = Object.fromEntries(
    [
      'ArrowDown',
      'ArrowLeftRight',
      'ArrowUp',
      'CalendarDays',
      'Check',
      'ChevronRight',
      'EyeOff',
      'FileText',
      'Hash',
      'Link2',
      'List',
      'Lock',
      'Mail',
      'MousePointerClick',
      'PanelRight',
      'Pencil',
      'Phone',
      'Plus',
      'SquareCheck',
      'Tags',
      'Trash2',
      'Type',
    ].map((n) => [n, makeIcon(n.toLowerCase())]),
  )

  const passthrough =
    (tag: string) =>
    ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => {
      void rest
      return React.createElement(tag, null, children)
    }

  const TableBody = React.forwardRef<HTMLElement, { children?: React.ReactNode }>(
    ({ children }, ref) => React.createElement('div', { ref }, children),
  )
  TableBody.displayName = 'TableBody'

  // TableCell 은 className 을 노출한다 — 조건부 서식 검증 대상.
  const TableCell = ({ children, className }: { children?: React.ReactNode; className?: string }) =>
    React.createElement('div', { 'data-testid': 'cell', className }, children)

  return {
    ...icons,
    Map: makeIcon('map'),
    Table: passthrough('div'),
    TableFrame: passthrough('div'),
    TableHeader: passthrough('div'),
    TableHead: passthrough('div'),
    TableBody,
    TableRow: passthrough('div'),
    TableCell,
    Tag: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    Button: passthrough('button'),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
      React.createElement('input', props),
    TagSelect: () => React.createElement('div'),
    AnchorContextSurface: ({ surface }: { surface?: React.ReactNode }) =>
      React.createElement('div', null, surface),
    beginListReorder: () => () => {},
    reorderArray: <T,>(arr: T[]) => arr,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  }
})

import { TableView } from './TableView'

import type {
  BlockDocument,
  BlockPack,
  PropertyDef,
  PropertyValue,
  TableRecord,
  ViewConfig,
} from '@oobleck/collection'

afterEach(cleanup)

function makePack(schema: PropertyDef[]): BlockPack<Record<string, PropertyValue>> {
  return {
    propertySchema: schema,
    readProperties: (doc: BlockDocument) => doc.properties ?? {},
    writeProperty: (doc: BlockDocument) => doc,
  }
}

function rec(id: string, props: Record<string, PropertyValue>): TableRecord {
  return { id, doc: { properties: props, locked: true } }
}

const SCHEMA: PropertyDef[] = [
  { key: 'name', label: '이름', type: 'text', source: 'projection', origin: 'preset' },
  { key: 'status', label: '상태', type: 'text', source: 'projection', origin: 'preset' },
]

const baseView: ViewConfig = { type: 'table', filters: { op: 'and', children: [] }, sort: [] }

describe("queryMode='server' — 뷰가 서버 결과를 다시 만지지 않는다", () => {
  const records = [
    rec('r1', { name: '가', status: 'active' }),
    rec('r2', { name: '나', status: 'cancelled' }),
    rec('r3', { name: '다', status: 'active' }),
  ]

  it('서버 모드에선 view.filters 를 다시 적용하지 않는다(행이 사라지지 않음)', () => {
    // 서버가 이미 필터를 적용해 3건을 보냈다고 가정. 같은 필터를 클라가 또 돌리면 1건이 지워진다.
    const view: ViewConfig = {
      ...baseView,
      filters: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'active' }] },
    }
    render(<TableView records={records} pack={makePack(SCHEMA)} view={view} queryMode="server" />)
    expect(screen.getByText('가')).toBeInTheDocument()
    expect(screen.getByText('나')).toBeInTheDocument() // 재필터됐다면 사라졌을 행
    expect(screen.getByText('다')).toBeInTheDocument()
  })

  it('기본(client)에선 종전대로 필터가 적용된다 — 회귀 0', () => {
    const view: ViewConfig = {
      ...baseView,
      filters: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'active' }] },
    }
    render(<TableView records={records} pack={makePack(SCHEMA)} view={view} />)
    expect(screen.getByText('가')).toBeInTheDocument()
    expect(screen.queryByText('나')).toBeNull()
    expect(screen.getByText('다')).toBeInTheDocument()
  })

  it('서버 모드에선 정렬도 다시 적용하지 않는다(서버가 준 순서 유지)', () => {
    const view: ViewConfig = { ...baseView, sort: [{ key: 'name', dir: 'desc' }] }
    render(<TableView records={records} pack={makePack(SCHEMA)} view={view} queryMode="server" />)
    const names = screen
      .getAllByTestId('cell')
      .map((c) => c.textContent)
      .filter((t) => t === '가' || t === '나' || t === '다')
    expect(names).toEqual(['가', '나', '다']) // 서버 순서 그대로(desc 재정렬 아님)
  })

  it('클라 모드에선 정렬이 적용된다 — 회귀 0', () => {
    const view: ViewConfig = { ...baseView, sort: [{ key: 'name', dir: 'desc' }] }
    render(<TableView records={records} pack={makePack(SCHEMA)} view={view} />)
    const names = screen
      .getAllByTestId('cell')
      .map((c) => c.textContent)
      .filter((t) => t === '가' || t === '나' || t === '다')
    expect(names).toEqual(['다', '나', '가'])
  })

  it('서버 모드 + totalCount 없으면 count 집계가 "이 페이지" 범위를 밝힌다', () => {
    const view: ViewConfig = { ...baseView, aggregations: { name: 'count' } }
    render(<TableView records={records} pack={makePack(SCHEMA)} view={view} queryMode="server" />)
    expect(screen.getByText(/전체 수 3 \(이 페이지\)/)).toBeInTheDocument()
  })

  it('서버 모드 + totalCount 가 있으면 count 는 전체로 답한다(범위 표기 없음)', () => {
    const view: ViewConfig = { ...baseView, aggregations: { name: 'count' } }
    render(
      <TableView
        records={records}
        pack={makePack(SCHEMA)}
        view={view}
        queryMode="server"
        totalCount={900}
      />,
    )
    expect(screen.getByText('전체 수 900')).toBeInTheDocument()
    expect(screen.queryByText(/이 페이지/)).toBeNull()
  })

  it('클라 모드 집계엔 범위 표기가 붙지 않는다 — 회귀 0', () => {
    const view: ViewConfig = { ...baseView, aggregations: { name: 'count' } }
    render(<TableView records={records} pack={makePack(SCHEMA)} view={view} />)
    expect(screen.getByText('전체 수 3')).toBeInTheDocument()
    expect(screen.queryByText(/이 페이지/)).toBeNull()
  })
})

describe('PropertyDef.render — 커스텀 셀 이스케이프 해치', () => {
  it('타입별 렌더 대신 커스텀 노드를 그린다', () => {
    const schema: PropertyDef[] = [
      SCHEMA[0]!,
      {
        ...SCHEMA[1]!,
        render: (value) => <span data-testid="custom">[{String(value)}]</span>,
      },
    ]
    render(
      <TableView
        records={[rec('r1', { name: '가', status: 'active' })]}
        pack={makePack(schema)}
        view={baseView}
      />,
    )
    expect(screen.getByTestId('custom')).toHaveTextContent('[active]')
  })

  it('행 맥락(id·다른 컬럼 값)을 받아 여러 필드를 합쳐 그릴 수 있다', () => {
    const schema: PropertyDef[] = [
      SCHEMA[0]!,
      {
        ...SCHEMA[1]!,
        render: (value, ctx) => (
          <span data-testid="custom">
            {ctx.id}/{String(ctx.props.name)}/{String(value)}
          </span>
        ),
      },
    ]
    render(
      <TableView
        records={[rec('r1', { name: '가', status: 'active' })]}
        pack={makePack(schema)}
        view={baseView}
      />,
    )
    expect(screen.getByTestId('custom')).toHaveTextContent('r1/가/active')
  })

  it('format 보다 render 가 우선한다', () => {
    const schema: PropertyDef[] = [
      SCHEMA[0]!,
      {
        ...SCHEMA[1]!,
        format: () => 'FORMAT',
        render: () => <span data-testid="custom">RENDER</span>,
      },
    ]
    render(
      <TableView
        records={[rec('r1', { name: '가', status: 'active' })]}
        pack={makePack(schema)}
        view={baseView}
      />,
    )
    expect(screen.getByTestId('custom')).toHaveTextContent('RENDER')
    expect(screen.queryByText('FORMAT')).toBeNull()
  })
})

describe('조건부 서식 — 셀 className', () => {
  it('조건을 만족한 셀에만 서식 클래스가 붙는다', () => {
    const view: ViewConfig = {
      ...baseView,
      conditionalFormats: [
        {
          id: 'cancelled',
          target: 'status',
          when: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'cancelled' }] },
          style: { tone: 'danger', bold: true },
        },
      ],
    }
    render(
      <TableView
        records={[rec('r1', { name: '가', status: 'cancelled' })]}
        pack={makePack(SCHEMA)}
        view={view}
      />,
    )
    const cells = screen.getAllByTestId('cell')
    const statusCell = cells.find((c) => c.textContent === 'cancelled')
    const nameCell = cells.find((c) => c.textContent === '가')
    expect(statusCell?.className).toContain('bg-error-subtle/80')
    expect(statusCell?.className).toContain('font-semibold')
    expect(nameCell?.className ?? '').not.toContain('bg-error-subtle/80')
  })

  it('다른 컬럼을 근거로 이 컬럼을 칠할 수 있다', () => {
    const view: ViewConfig = {
      ...baseView,
      conditionalFormats: [
        {
          id: 'dim-name',
          target: 'name',
          when: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'cancelled' }] },
          style: { tone: 'muted', strikethrough: true },
        },
      ],
    }
    render(
      <TableView
        records={[rec('r1', { name: '가', status: 'cancelled' })]}
        pack={makePack(SCHEMA)}
        view={view}
      />,
    )
    const nameCell = screen.getAllByTestId('cell').find((c) => c.textContent === '가')
    expect(nameCell?.className).toContain('text-fg-muted')
    expect(nameCell?.className).toContain('line-through')
  })

  it('규칙이 없으면 서식 클래스가 붙지 않는다 — 회귀 0', () => {
    render(
      <TableView
        records={[rec('r1', { name: '가', status: 'cancelled' })]}
        pack={makePack(SCHEMA)}
        view={baseView}
      />,
    )
    for (const cell of screen.getAllByTestId('cell')) {
      expect(cell.className).not.toContain('bg-error-subtle')
      expect(cell.className).not.toContain('line-through')
    }
  })
})
