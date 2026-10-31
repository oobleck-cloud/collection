// @vitest-environment jsdom
//
// @oobleck/collection — 버튼 프로퍼티(type='button') 렌더·액션 핀.
//
// 버튼 substrate 일반화(에디터 buttonBlock → 컬렉션 버튼 프로퍼티)의 계약 검증:
//   - isButtonValue: ButtonValue 판별(GeoValue·배열·스칼라와 구분).
//   - TableView: 버튼 셀 렌더(라벨), 클릭 → onAction(rowId, action), onAction 미지정/disabled → 비활성.
//   - ListView: 행 우측 액션 버튼 렌더, 클릭이 onOpen(행 열기)으로 전파되지 않음(stopPropagation).
//   - PropertyChip(카드 표면): button 타입은 렌더하지 않는다(null).
//
// 전략: @oobleck/systheme 배럴을 경량 스텁으로 대체(views.test.tsx 동형) — 뷰 자체 로직 실행이 핵심.

import React from 'react'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@oobleck/systheme', () => {
  const makeIcon =
    (id: string) =>
    ({ className }: { className?: string; 'aria-hidden'?: boolean }) =>
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

  const Button = ({
    children,
    onClick,
    disabled,
    variant,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) =>
    React.createElement(
      'button',
      { type: 'button', onClick, disabled, 'data-variant': variant, ...rest },
      children,
    )

  const passthrough =
    (tag: string) =>
    ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => {
      // DOM 경고 소음 방지 — 스텁은 자식 렌더가 목적이라 커스텀 prop 은 흘리지 않는다.
      void rest
      return React.createElement(tag, null, children)
    }

  // DS Table 계열은 전부 중립 div 스텁 — 실제 table 시맨틱을 흉내내면 스텁 중첩이 DOM nesting 경고
  // 소음을 낸다(버튼 셀 검증에 table 시맨틱은 불필요).
  const TableBody = React.forwardRef<HTMLElement, { children?: React.ReactNode }>(
    ({ children }, ref) => React.createElement('div', { ref }, children),
  )
  TableBody.displayName = 'TableBody'

  const Badge = passthrough('span')
  const Tag = passthrough('span')
  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement('input', props)
  const TagSelect = () => React.createElement('div')
  const AnchorContextSurface = ({
    surface,
    panel,
  }: {
    surface?: React.ReactNode
    panel?: React.ReactNode
  }) => React.createElement('div', null, surface, panel)

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
    Badge,
    Tag,
    Button,
    Input,
    TagSelect,
    AnchorContextSurface,
    beginListReorder: () => () => {},
    reorderArray: <T,>(arr: T[]) => arr,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
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
import { isButtonValue } from '@oobleck/collection'
import { TableView } from './TableView'
import { ListView } from './ListView'
import { PropertyChip } from './record-card'

afterEach(cleanup)

function makePack(schema: PropertyDef[]): BlockPack<Record<string, PropertyValue>> {
  return {
    propertySchema: schema,
    readProperties: (doc: BlockDocument) => doc.properties ?? {},
    writeProperty: (doc: BlockDocument) => doc,
  }
}

function makeView(partial: Partial<ViewConfig> = {}): ViewConfig {
  return { type: 'table', filters: { op: 'and', children: [] }, sort: [], ...partial }
}

const schema: PropertyDef[] = [
  { key: 'title', label: '제목', type: 'text', source: 'projection', origin: 'preset' },
  { key: 'restore', label: '복원', type: 'button', source: 'projection', origin: 'preset' },
]

function makeRecord(id: string, props: Record<string, PropertyValue>): TableRecord {
  return { id, doc: { properties: props, locked: true } }
}

describe('isButtonValue', () => {
  it('action·label 문자열을 가진 객체만 참', () => {
    expect(isButtonValue({ action: 'restore', label: '복원' })).toBe(true)
    expect(isButtonValue({ action: 'x', label: 'y', variant: 'outline', disabled: true })).toBe(
      true,
    )
  })

  it('스칼라·배열·GeoValue 형태는 거짓', () => {
    expect(isButtonValue(null)).toBe(false)
    expect(isButtonValue('restore')).toBe(false)
    expect(isButtonValue(['restore'])).toBe(false)
    expect(isButtonValue({ coordinate: { x: 1, y: 2, type: 'WGS84' }, roadAddress: '서울' })).toBe(
      false,
    )
    expect(isButtonValue({ action: 'restore' })).toBe(false) // label 누락
  })
})

describe('TableView 버튼 프로퍼티', () => {
  const pack = makePack(schema)
  const records = [
    makeRecord('r1', { title: '문서 A', restore: { action: 'restore', label: '복원' } }),
  ]

  it('버튼 셀 렌더 + 클릭 → onAction(rowId, action)', () => {
    const onAction = vi.fn()
    render(<TableView records={records} pack={pack} view={makeView()} onAction={onAction} />)

    const btn = screen.getByRole('button', { name: '복원' })
    fireEvent.click(btn)
    expect(onAction).toHaveBeenCalledWith('r1', 'restore')
  })

  it('onAction 미지정 → 버튼 비활성(disabled)', () => {
    render(<TableView records={records} pack={pack} view={makeView()} />)
    expect(screen.getByRole('button', { name: '복원' })).toHaveProperty('disabled', true)
  })

  it('value.disabled=true → 비활성(진행 중 이중클릭 방지)', () => {
    const busyRecords = [
      makeRecord('r1', {
        title: '문서 A',
        restore: { action: 'restore', label: '복원', disabled: true },
      }),
    ]
    const onAction = vi.fn()
    render(<TableView records={busyRecords} pack={pack} view={makeView()} onAction={onAction} />)
    const btn = screen.getByRole('button', { name: '복원' })
    expect(btn).toHaveProperty('disabled', true)
    fireEvent.click(btn)
    expect(onAction).not.toHaveBeenCalled()
  })

  it('버튼 값이 ButtonValue 가 아니면 — 표시(—) 폴백, 크래시 없음', () => {
    const badRecords = [makeRecord('r1', { title: '문서 A', restore: 'oops' })]
    render(<TableView records={badRecords} pack={pack} view={makeView()} />)
    expect(screen.queryByRole('button', { name: 'oops' })).toBeNull()
  })
})

describe('ListView 버튼 프로퍼티', () => {
  const pack = makePack(schema)
  const records = [
    makeRecord('r1', { title: '문서 A', restore: { action: 'restore', label: '복원' } }),
  ]

  it('행 우측 액션 버튼 렌더 + 클릭 → onAction, 행 열기(onOpen)로 전파되지 않음', () => {
    const onAction = vi.fn()
    const onOpen = vi.fn()
    render(
      <ListView
        records={records}
        pack={pack}
        view={makeView({ type: 'list' })}
        onAction={onAction}
        onOpen={onOpen}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '복원' }))
    expect(onAction).toHaveBeenCalledWith('r1', 'restore')
    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe('PropertyChip(카드 표면)', () => {
  it('button 타입은 칩으로 렌더하지 않는다(null)', () => {
    const { container } = render(
      <PropertyChip def={schema[1]} value={{ action: 'restore', label: '복원' }} />,
    )
    expect(container.innerHTML).toBe('')
  })
})
