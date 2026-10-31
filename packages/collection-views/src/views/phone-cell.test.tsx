// @vitest-environment jsdom
//
// @oobleck/collection — phone 타입 셀의 **표시 서식** 핀.
//
// 배경: 저장값이 하이픈 없는 digits(01068780239)라 표·카드에 그대로 찍혀 읽기 어려웠다.
// 표시만 formatPhoneNumber 로 하이픈(010-6878-0239)을 붙이고, tel: 링크는 저장값 그대로 둔다.
//
// 전략: readonly-color-cell.test 와 같은 design-system 배럴 경량 스텁 — 서식 함수만 실물을 쓴다.

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@oobleck/systheme', async () => {
  const { formatPhoneNumber } = await vi.importActual<{
    formatPhoneNumber: (v: string | null | undefined) => string
  }>('../../node_modules/@oobleck/systheme/src/utils/koreanPhoneNumber')

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
      'Tag',
      'Tags',
      'Trash2',
      'Type',
      'User',
      'Users',
    ].map((n) => [n, makeIcon(n.toLowerCase())]),
  )

  const passthrough =
    (tag: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(tag, null, children)

  const TableBody = React.forwardRef<HTMLElement, { children?: React.ReactNode }>(
    ({ children }, ref) => React.createElement('div', { ref }, children),
  )
  TableBody.displayName = 'TableBody'

  return {
    ...icons,
    Map: makeIcon('map'),
    Table: passthrough('div'),
    TableFrame: passthrough('div'),
    TableHeader: passthrough('div'),
    TableHead: passthrough('div'),
    TableBody,
    TableRow: passthrough('div'),
    TableCell: passthrough('div'),
    Button: passthrough('button'),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
      React.createElement('input', props),
    TagSelect: () => React.createElement('div'),
    AnchorContextSurface: ({ surface }: { surface?: React.ReactNode }) =>
      React.createElement('div', null, surface),
    beginListReorder: () => () => {},
    reorderArray: <T,>(arr: T[]) => arr,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    formatPhoneNumber,
  }
})

import type {
  BlockDocument,
  BlockPack,
  PropertyDef,
  PropertyValue,
  TableRecord,
  ViewConfig,
} from '@oobleck/collection'
import { PropertyChip } from './record-card'
import { TableView } from './TableView'

afterEach(cleanup)

const schema: PropertyDef[] = [
  { key: 'title', label: '제목', type: 'text', source: 'projection', origin: 'preset' },
  { key: 'phone', label: '연락처', type: 'phone', source: 'projection', origin: 'preset' },
]

const pack: BlockPack<Record<string, PropertyValue>> = {
  propertySchema: schema,
  readProperties: (doc: BlockDocument) => doc.properties ?? {},
  writeProperty: (doc: BlockDocument) => doc,
}

const view: ViewConfig = { type: 'table', filters: { op: 'and', children: [] }, sort: [] }

function readonlyRecord(phone: PropertyValue): TableRecord {
  // locked=true → 읽기전용 셀 경로(ReadonlyCell)로 렌더.
  return { id: 'r1', doc: { properties: { title: '행1', phone }, locked: true } }
}

describe('ReadonlyCell — phone', () => {
  it('digits 저장값을 하이픈 서식으로 보이고, tel: 은 저장값 그대로', () => {
    render(<TableView records={[readonlyRecord('01068780239')]} pack={pack} view={view} />)
    const link = screen.getByText('010-6878-0239')
    expect(link.closest('a')?.getAttribute('href')).toBe('tel:01068780239')
  })

  it('모르는 형식은 원문 그대로', () => {
    render(<TableView records={[readonlyRecord('+1 415 555 0100')]} pack={pack} view={view} />)
    expect(screen.getByText('+1 415 555 0100')).toBeTruthy()
  })
})

describe('편집형 phone 셀', () => {
  it('닫힌 표면에 하이픈 서식을 보인다', () => {
    const editableSchema: PropertyDef[] = [
      schema[0]!,
      { key: 'phone', label: '연락처', type: 'phone', source: 'frontmatter', origin: 'preset' },
    ]
    render(
      <TableView
        records={[{ id: 'r1', doc: { properties: { title: '행1', phone: '0212345678' } } }]}
        pack={{ ...pack, propertySchema: editableSchema }}
        view={view}
        onEdit={() => {}}
      />,
    )
    expect(screen.getByText('02-1234-5678')).toBeTruthy()
  })
})

describe('PropertyChip — phone', () => {
  it('카드 칩도 하이픈 서식', () => {
    render(<PropertyChip def={schema[1]!} value="01068780239" />)
    expect(screen.getByText('010-6878-0239')).toBeTruthy()
  })
})
