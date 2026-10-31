// @vitest-environment jsdom
//
// @oobleck/collection — 손으로 고칠 수 없는 칸의 까닭(readOnlyReason)과 머리 메뉴의 켜고 끄는 설정(columnToggles).
//
// 콜 기록으로만 고치는 커스텀 속성이 이 둘을 쓴다: 머리에 자물쇠, 읽기 전용 칸 위에 까닭, 관리자 메뉴에 「콜 기록으로만 수정」.
// 표면 스텁은 table-extensions.test 와 같고, 메뉴 패널을 늘 펼쳐 둔다(열린 메뉴의 줄을 본다).

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
    AnchorContextSurface: ({
      surface,
      panel,
    }: {
      surface?: React.ReactNode
      panel?: React.ReactNode
    }) => React.createElement('div', null, surface, panel),
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
  {
    key: 'x:반응',
    label: '고객 반응',
    type: 'text',
    source: 'projection',
    origin: 'base',
    locked: true,
    readOnlyReason: '콜 기록으로 수정',
  },
  { key: 'x:메모', label: '메모', type: 'text', source: 'frontmatter', origin: 'base' },
]

const view: ViewConfig = {
  type: 'table',
  filters: { op: 'and', children: [] },
  sort: [],
  visibleProps: ['name', 'x:반응', 'x:메모'],
}

describe('readOnlyReason — 손으로 고칠 수 없는 까닭', () => {
  it('머리에 자물쇠, 칸 위에 까닭 — 편집 콜백이 있어도 읽기 전용', () => {
    const onEdit = vi.fn()
    const { container } = render(
      <TableView
        records={[rec('o1', { name: '가', 'x:반응': '고민 중', 'x:메모': 'm' })]}
        pack={makePack(SCHEMA)}
        view={view}
        onEdit={onEdit}
      />,
    )
    // 자물쇠는 까닭이 있는 컬럼 하나만.
    expect(screen.getAllByTestId('icon-lock')).toHaveLength(1)
    const reason = container.querySelector('[title="콜 기록으로 수정"]')
    expect(reason?.textContent).toContain('고민 중')
    expect(reason?.querySelector('input')).toBeNull()
  })
})

describe('columnToggles — 머리 메뉴의 켜고 끄는 설정', () => {
  it('호스트가 정한 컬럼에만 줄이 서고, 켜진 것은 체크 · 누르면 onToggle', () => {
    const onToggle = vi.fn()
    render(
      <TableView
        records={[rec('o1', { name: '가', 'x:반응': '고민 중', 'x:메모': 'm' })]}
        pack={makePack(SCHEMA)}
        view={view}
        columnToggles={(def) =>
          def.origin === 'base'
            ? [
                {
                  id: 'call-managed',
                  label: `콜 기록으로만 수정:${def.key}`,
                  checked: def.readOnlyReason !== undefined,
                  onToggle: () => onToggle(def.key),
                },
              ]
            : []
        }
      />,
    )
    const rows = screen.getAllByRole('menuitem').filter((el) => el.textContent?.includes('콜 기록'))
    expect(rows.map((r) => r.textContent)).toEqual([
      '콜 기록으로만 수정:x:반응',
      '콜 기록으로만 수정:x:메모',
    ])
    // 켜진 줄만 체크.
    expect(rows[0]!.querySelector('[data-testid="icon-check"]')).not.toBeNull()
    expect(rows[1]!.querySelector('[data-testid="icon-check"]')).toBeNull()
    fireEvent.click(rows[1]!)
    expect(onToggle).toHaveBeenCalledWith('x:메모')
  })

  it('미지정이면 설정 줄이 없다 — 회귀 0', () => {
    render(
      <TableView
        records={[rec('o1', { name: '가', 'x:반응': '고민 중', 'x:메모': 'm' })]}
        pack={makePack(SCHEMA)}
        view={view}
      />,
    )
    expect(screen.queryByText(/콜 기록으로만 수정/)).toBeNull()
  })
})
