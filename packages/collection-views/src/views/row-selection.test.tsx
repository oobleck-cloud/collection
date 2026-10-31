// @vitest-environment jsdom
//
// @oobleck/collection — TableView 행 선택(체크박스 열) 핀.
//
// 선택은 호스트가 소유하고 표는 **지금 그린 행만** 더하고 뺀다 — 서버 페이지 목록에서 다른 쪽에서 고른 행이
// 머리 체크박스로 풀려 버리면 사람이 모르는 사이 대상이 줄어든다. Shift+클릭 범위도 여기서 핀한다.
//
// 전략: @oobleck/systheme 배럴을 경량 스텁으로 대체(table-extensions.test.tsx 동형).

import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
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
      'LayoutDashboard',
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
      'User',
      'Users',
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
    Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
      React.createElement('button', { type: 'button', onClick }, children),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
      React.createElement('input', props),
    TagSelect: () => React.createElement('div'),
    // 체크박스 — 진짜 input 으로(클릭·Shift·checked 를 그대로 본다). indeterminate 는 data 속성으로 드러낸다.
    Checkbox: ({
      checked,
      indeterminate,
      disabled,
      onCheckedChange,
      onClick,
      'aria-label': ariaLabel,
    }: {
      checked?: boolean
      indeterminate?: boolean
      disabled?: boolean
      onCheckedChange?: (on: boolean) => void
      onClick?: React.MouseEventHandler<HTMLInputElement>
      'aria-label'?: string
    }) =>
      React.createElement('input', {
        type: 'checkbox',
        'aria-label': ariaLabel,
        checked: !!checked,
        disabled,
        'data-indeterminate': indeterminate ? 'true' : undefined,
        onClick,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCheckedChange?.(e.target.checked),
      }),
    // 본문 상태(CollectionStatus) — 제목·문구·동작만 그대로 꺼내 본다.
    EmptyState: ({
      title,
      message,
      primaryAction,
    }: {
      title?: React.ReactNode
      message?: React.ReactNode
      primaryAction?: React.ReactNode
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement('p', null, title),
        React.createElement('p', null, message),
        primaryAction,
      ),
    Spinner: () => React.createElement('span', { 'data-testid': 'spinner' }),
    TriangleAlert: makeIcon('triangle-alert'),
    AnchorContextSurface: ({ surface }: { surface?: React.ReactNode }) =>
      React.createElement('div', null, surface),
    beginListReorder: () => () => {},
    reorderArray: <T,>(arr: T[]) => arr,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  }
})

import { TableView, type RowSelection } from './TableView'

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

const SCHEMA: PropertyDef[] = [
  { key: 'name', label: '이름', type: 'text', source: 'projection', origin: 'preset' },
]
const VIEW: ViewConfig = { type: 'table', filters: { op: 'and', children: [] }, sort: [] }
const RECORDS: TableRecord[] = ['r1', 'r2', 'r3', 'r4'].map((id) => ({
  id,
  doc: { properties: { name: id }, locked: true },
}))

/** 호스트처럼 선택을 들고 있는 껍데기 — 바뀐 집합을 기록한다. */
function Host({
  initial = [],
  records = RECORDS,
  onChange,
}: {
  initial?: string[]
  records?: TableRecord[]
  onChange?: (ids: string[]) => void
}) {
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set(initial))
  const selection: RowSelection = {
    selected,
    onChange: (next) => {
      setSelected(next)
      onChange?.([...next].sort())
    },
  }
  return (
    <TableView
      records={records}
      pack={makePack(SCHEMA)}
      view={VIEW}
      queryMode="server"
      selection={selection}
    />
  )
}

const rowBoxes = () => screen.getAllByRole('checkbox', { name: '행 선택' })
const headBox = () => screen.getByRole('checkbox', { name: '보이는 행 모두 선택' })

describe('TableView 행 선택(체크박스 열)', () => {
  it('selection 이 없으면 체크박스 열이 서지 않는다 — 회귀 0', () => {
    render(<TableView records={RECORDS} pack={makePack(SCHEMA)} view={VIEW} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('행 체크박스로 하나씩 고르고 푼다', () => {
    const onChange = vi.fn()
    render(<Host onChange={onChange} />)
    expect(rowBoxes()).toHaveLength(4)
    fireEvent.click(rowBoxes()[1]!)
    expect(onChange).toHaveBeenLastCalledWith(['r2'])
    fireEvent.click(rowBoxes()[1]!)
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('Shift+클릭은 마지막으로 누른 행부터 범위를 고른다', () => {
    const onChange = vi.fn()
    render(<Host onChange={onChange} />)
    fireEvent.click(rowBoxes()[0]!)
    fireEvent.click(rowBoxes()[2]!, { shiftKey: true })
    expect(onChange).toHaveBeenLastCalledWith(['r1', 'r2', 'r3'])
  })

  it('머리 체크박스 — 보이는 행 전체를 고르고, 일부만 골랐으면 가운데 줄로 보인다', () => {
    const onChange = vi.fn()
    render(<Host initial={['r1']} onChange={onChange} />)
    expect(headBox()).toHaveAttribute('data-indeterminate', 'true')
    fireEvent.click(headBox())
    expect(onChange).toHaveBeenLastCalledWith(['r1', 'r2', 'r3', 'r4'])
    expect(headBox()).toBeChecked()
    fireEvent.click(headBox())
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('다른 페이지에서 고른 행은 머리 체크박스가 건드리지 않는다', () => {
    const onChange = vi.fn()
    // 'other' 는 지금 페이지에 없는 행(앞 페이지에서 고름)
    render(<Host initial={['other']} onChange={onChange} />)
    expect(headBox()).not.toBeChecked()
    fireEvent.click(headBox())
    expect(onChange).toHaveBeenLastCalledWith(['other', 'r1', 'r2', 'r3', 'r4'])
    fireEvent.click(headBox())
    expect(onChange).toHaveBeenLastCalledWith(['other'])
  })
})
