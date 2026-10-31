/**
 * Collections — RelationTable (카드 · 문서 안 관계 표)
 *
 * 모양 두 가지 + 접어 두기:
 *  - Table(기본): 회색 머리 줄 · 줄 사이 선 · 바깥 테두리.
 *  - List: 선 없는 목록 줄(32px · 10px 간격), 첫 줄 동작은 채운 버튼, 「+ N곳 더」는 글자 링크.
 *  - Collapsed: 「견적 5곳 보기」 한 줄 — 누르면 그 자리에서 편다.
 * 카드 안에 놓이는 블록이라 흰 카드 면(그림자) 위에 그린다.
 */
import { RelationTable } from './RelationTable'

import type { PropertyDef, RelatedRecordRow } from '@oobleck/collection'
import type { Meta, StoryObj } from '@storybook/react'

const COLUMNS: PropertyDef[] = [
  { key: 'partner', label: '파트너', type: 'text', source: 'projection', origin: 'preset' },
  {
    key: 'price',
    label: '견적',
    type: 'number',
    source: 'projection',
    origin: 'preset',
    format: (v) => (typeof v === 'number' ? `${v.toLocaleString('ko-KR')}만` : ''),
  },
  { key: 'state', label: '조율', type: 'text', source: 'projection', origin: 'preset' },
]

const ROWS: RelatedRecordRow[] = [
  { id: 'q1', props: { partner: '한빛이사', price: 128, state: '대기' } },
  { id: 'q2', props: { partner: '바른익스프레스', price: 135, state: '부재' } },
  { id: 'q3', props: { partner: '이삿날', price: 142, state: '대기' } },
  { id: 'q4', props: { partner: '든든이사', price: 150, state: '대기' } },
  { id: 'q5', props: { partner: '오늘이사', price: 1155, state: '합의' } },
]

const meta: Meta<typeof RelationTable> = {
  title: 'Collections/RelationTable',
  component: RelationTable,
  decorators: [
    (Story) => (
      <div className="w-100 rounded-md bg-background p-4 shadow-float">
        <Story />
      </div>
    ),
  ],
  args: {
    recordId: 'order-1',
    rows: ROWS,
    columns: COLUMNS,
    maxRows: 3,
    countUnit: '곳',
    label: '견적',
    actions: [{ id: 'call', label: '네고 콜', run: () => {} }],
  },
}

export default meta
type Story = StoryObj<typeof RelationTable>

export const Table: Story = {}

export const List: Story = {
  args: { variant: 'list' },
}

export const Collapsed: Story = {
  args: { variant: 'list', collapsed: true },
}
