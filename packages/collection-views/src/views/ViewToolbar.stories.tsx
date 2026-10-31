/**
 * Collections — ViewToolbar (노션식 아이콘 행 + ⋯ 허브)
 *
 * `[🔍][↑↓][⛁] … [⚙][＋]` 한 줄. 아이콘 크기·배지·활성 토널이 전부 유틸리티라서, 스캔 범위가
 * 어긋나면 아이콘이 0×0 으로 접혀 **버튼은 남고 그림만 사라진다**(ViewToolbar.tsx 의 FilterIcon
 * 주석이 그 사고를 명시적으로 방어하고 있다). 툴바 줄의 기준선·높이가 스냅샷으로 고정된다.
 */
import { fn } from '@storybook/test'
import { useState } from 'react'

import { DEMO_SCHEMA, makeView } from '../storybook/fixtures'

import { ViewToolbar } from './ViewToolbar'

import type { ViewConfig } from '@oobleck/collection'
import type { ViewToolbarProps } from './ViewToolbar'
import type { Meta, StoryObj } from '@storybook/react'

/** 뷰 상태를 실제로 들고 있는 래퍼 — 툴바가 스스로 갱신하는 컨트롤(정렬·필터)을 만져볼 수 있게. */
function StatefulToolbar({ view: initial, ...rest }: ViewToolbarProps) {
  const [view, setView] = useState<ViewConfig>(initial)
  return (
    <ViewToolbar
      {...rest}
      view={view}
      onViewChange={(next) => {
        rest.onViewChange?.(next)
        setView((prev) => ({ ...prev, ...next }))
      }}
    />
  )
}

const meta: Meta<typeof ViewToolbar> = {
  title: 'Collections/ViewToolbar',
  component: ViewToolbar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="bg-background p-4">
        <Story />
      </div>
    ),
  ],
  render: (args) => <StatefulToolbar {...args} />,
  args: {
    schema: DEMO_SCHEMA,
    view: makeView({ type: 'table' }),
    onViewChange: fn(),
  },
}

export default meta
type Story = StoryObj<typeof ViewToolbar>

/** 기본 — 정렬·필터 미적용(배지 없음), 검색·생성 버튼 없음. */
export const Default: Story = {}

/** 검색·생성까지 전개된 전체 아이콘 행. */
export const FullControls: Story = {
  args: {
    onSearchChange: fn(),
    onCreate: fn(),
    createLabel: '새 항목',
  },
}

/** 정렬·필터가 적용된 활성 상태 — 아이콘이 primary 토널이 되고 개수 배지가 붙는다. */
export const ActiveSortAndFilter: Story = {
  args: {
    view: makeView({
      type: 'table',
      sort: [{ key: 'due', dir: 'asc' }],
      filters: {
        op: 'and',
        children: [
          { key: 'status', op: 'eq', value: 'active' },
          { key: 'amount', op: 'gte', value: 100000 },
        ],
      },
    }),
    onSearchChange: fn(),
    onCreate: fn(),
  },
}

/**
 * 서버가 행을 고르는 화면 — "어떤 행을 보일까"(검색·정렬·필터)를 끄고
 * "어떻게 보일까"(레이아웃·프로퍼티) 컨트롤만 남긴 축약 툴바.
 */
export const WithoutRowQueryControls: Story = {
  args: {
    rowQueryControls: false,
    onCreate: fn(),
  },
}

/** 생성 방법이 여럿일 때 — ＋ 가 즉시 실행 대신 드롭다운을 편다. */
export const CreateMenu: Story = {
  args: {
    createMenu: [
      { id: 'blank', label: '빈 항목으로 시작' },
      { id: 'ai', label: 'AI와 함께 만들기' },
    ],
    onCreateMenuSelect: fn(),
  },
}

/** inline 모드 — 외부 여백 없이 ViewTabs 옆에 합성되는 아이콘 행. */
export const Inline: Story = {
  args: {
    inline: true,
    onSearchChange: fn(),
    onCreate: fn(),
  },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2 border-b border-border bg-background px-2">
        <span className="text-sm font-medium text-fg">주문</span>
        <Story />
      </div>
    ),
  ],
}
