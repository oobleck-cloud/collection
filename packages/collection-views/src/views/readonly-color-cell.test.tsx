// @vitest-environment jsdom
//
// @oobleck/collection — TableView 읽기전용 select/multi_select 셀의 **색 칩** 렌더 핀.
//
// 회귀 배경: ReadonlyCell 이 과거 <Badge variant="default">(항상 회색)로 렌더해, 카드(record-card)는
// 옵션 색을 보이는데 표 읽기전용 셀만 색을 잃던 불일치가 있었다. 이제 <Tag color={resolveOptionColor}>
// 로 통일 — 옵션 명시색(있으면)·값 해시색(없으면)이 표·카드·그룹 헤더 어디서나 같게 나온다.
//
// 전략: @oobleck/systheme 배럴 경량 스텁(button-cell.test 동형) — 단, Tag 는 color prop 을 data-color 로
// 노출해 어떤 색이 결정됐는지 검증 가능하게 한다. label prop(옵션 label) 표시도 함께 핀.

import React from 'react'
import { render, screen, cleanup, within } from '@testing-library/react'
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

  // Tag 만 color 를 노출(검증 대상) — 나머지는 중립 스텁.
  const Tag = ({ children, color }: { children?: React.ReactNode; color?: string }) =>
    React.createElement('span', { 'data-testid': 'tag', 'data-color': color }, children)

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
    Tag,
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

import type {
  BlockDocument,
  BlockPack,
  PropertyDef,
  PropertyValue,
  TableRecord,
  ViewConfig,
} from '@oobleck/collection'
import { TableView } from './TableView'

afterEach(cleanup)

/** 라벨은 Tag 안의 말줄임 span 에 있다 — 색은 그 라벨을 감싼 Tag(data-color)에서 읽는다. */
function chipOf(label: string): HTMLElement {
  return screen.getByText(label).closest('[data-color]') as HTMLElement
}

function makePack(schema: PropertyDef[]): BlockPack<Record<string, PropertyValue>> {
  return {
    propertySchema: schema,
    readProperties: (doc: BlockDocument) => doc.properties ?? {},
    writeProperty: (doc: BlockDocument) => doc,
  }
}

const view: ViewConfig = { type: 'table', filters: { op: 'and', children: [] }, sort: [] }

function makeRecord(id: string, props: Record<string, PropertyValue>): TableRecord {
  // locked=true → 읽기전용 셀 경로(ReadonlyCell)로 렌더.
  return { id, doc: { properties: props, locked: true } }
}

/** 읽기전용 셀만 렌더되도록 편집 콜백 없이(=readonly) TableView 를 그린다. */
function renderReadonly(schema: PropertyDef[], props: Record<string, PropertyValue>) {
  return render(
    <TableView records={[makeRecord('r1', props)]} pack={makePack(schema)} view={view} />,
  )
}

describe('ReadonlyCell — select 색 칩', () => {
  it('옵션 명시색을 Tag color 로 렌더 + 옵션 label 표시', () => {
    const schema: PropertyDef[] = [
      { key: 'title', label: '제목', type: 'text', source: 'projection', origin: 'preset' },
      {
        key: 'kind',
        label: '종류',
        type: 'select',
        source: 'projection',
        origin: 'preset',
        options: [{ value: 'subscription-plan', label: '구독 플랜', color: 'blue' }],
      },
    ]
    renderReadonly(schema, { title: '행1', kind: 'subscription-plan' })
    const chip = chipOf('구독 플랜') // 값(kind 키)이 아니라 옵션 label
    expect(chip.getAttribute('data-color')).toBe('blue')
  })

  it('옵션 색이 없으면 값 해시색으로 폴백(회색 고정 아님)', () => {
    const schema: PropertyDef[] = [
      { key: 'title', label: '제목', type: 'text', source: 'projection', origin: 'preset' },
      { key: 'k', label: 'K', type: 'select', source: 'projection', origin: 'preset' },
    ]
    renderReadonly(schema, { title: '행1', k: 'anything' })
    const chip = chipOf('anything')
    // 해시색은 팔레트 7색 중 하나 — 존재하고 비어있지 않다(과거처럼 무조건 default 회색이 아님).
    const color = chip.getAttribute('data-color')
    expect(['gray', 'blue', 'green', 'orange', 'red', 'purple', 'teal']).toContain(color)
  })

  it('빈 값 → 색 칩 없이 — 표시(Tag 미렌더)', () => {
    const schema: PropertyDef[] = [
      { key: 'title', label: '제목', type: 'text', source: 'projection', origin: 'preset' },
      { key: 'k', label: 'K', type: 'select', source: 'projection', origin: 'preset' },
    ]
    const { container } = renderReadonly(schema, { title: '행1', k: null })
    // title 셀엔 Tag 가 없고, k 셀도 값 없어 Tag 미렌더 → 문서 전체 Tag 0.
    expect(within(container).queryByTestId('tag')).toBeNull()
  })
})

describe('ReadonlyCell — multi_select 색 칩', () => {
  it('각 멤버를 옵션색/해시색 Tag 로 전부 렌더', () => {
    const schema: PropertyDef[] = [
      { key: 'title', label: '제목', type: 'text', source: 'projection', origin: 'preset' },
      {
        key: 'tags',
        label: '태그',
        type: 'multi_select',
        source: 'projection',
        origin: 'preset',
        options: [
          { value: 'a', label: 'A', color: 'red' },
          { value: 'b', label: 'B', color: 'teal' },
        ],
      },
    ]
    renderReadonly(schema, { title: '행1', tags: ['a', 'b'] })
    expect(chipOf('A').getAttribute('data-color')).toBe('red')
    expect(chipOf('B').getAttribute('data-color')).toBe('teal')
  })
})
