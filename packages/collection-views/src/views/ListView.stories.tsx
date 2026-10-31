/**
 * Collections — ListView (한 줄 = 한 레코드)
 *
 * 제목 + 보조 프로퍼티 칩(최대 4개 + 오버플로) 한 줄짜리 뷰. 칩이 줄을 넘기거나 오버플로
 * 계산이 어긋나면 목록 전체의 리듬이 무너지는데, 단위 테스트로는 그게 보이지 않는다.
 */
import { fn } from '@storybook/test'

import { DEMO_PACK, DEMO_RECORDS, DEMO_SCHEMA, makeView } from '../storybook/fixtures'

import { ListView } from './ListView'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof ListView> = {
  title: 'Collections/ListView',
  component: ListView,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    records: DEMO_RECORDS,
    pack: DEMO_PACK,
    schema: DEMO_SCHEMA,
    view: makeView({ type: 'list' }),
  },
}

export default meta
type Story = StoryObj<typeof ListView>

/** 기본 — 그룹 없음, 행마다 제목 + 보조 칩. */
export const Default: Story = {}

/** 그룹 헤더(색 스와치 + 라벨 + 개수) — 섹션 구분 레이아웃. */
export const GroupedByStatus: Story = {
  args: { view: makeView({ type: 'list', groupBy: 'status' }) },
}

/** 빈 그룹 숨김 — 값이 없는 섹션이 사라지는지. */
export const GroupedHidingEmpty: Story = {
  args: {
    records: DEMO_RECORDS.filter((r) => r.doc.properties?.status !== 'done'),
    view: makeView({ type: 'list', groupBy: 'status', hideEmptyGroups: true }),
  },
}

/** 열기·삭제·생성 어포던스가 모두 켜진 상태. */
export const WithAffordances: Story = {
  args: {
    onOpen: fn(),
    onDeleteRow: fn(),
    onCreate: fn(),
    createLabel: '+ 새 항목',
  },
}

/** 빈 상태. */
export const Empty: Story = {
  args: { records: [] },
}
