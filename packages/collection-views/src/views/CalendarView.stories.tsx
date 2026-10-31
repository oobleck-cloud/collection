/**
 * Collections — CalendarView (월 격자)
 *
 * 이 뷰는 좌표 계산이 전부다: 7열 배경 격자 위에 기간 막대를 `gridColumn` 으로 얹고,
 * lane 이 넘치면 열별 "+k" 로 접는다. 격자 셀 높이(`min-h-[104px]`)와 오버레이 오프셋
 * (`top-6`)이 어긋나면 막대가 일자 번호를 덮거나 주 경계를 넘는데, 단위 테스트는 좌표를
 * 계산할 뿐 **겹침을 보지 못한다**. 시각회귀가 실제로 값을 하는 지점.
 *
 * 시계는 고정한다(withFixedNow) — 표시 월 초기값이 `new Date()` 라 고정하지 않으면
 * 매달 베이스라인이 저절로 깨진다.
 */
import { fn } from '@storybook/test'

import { withFixedNow } from '../storybook/fixedClock'
import { DEMO_PACK, DEMO_RECORDS, DEMO_SCHEMA, makeRecord, makeView } from '../storybook/fixtures'

import { CalendarView } from './CalendarView'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof CalendarView> = {
  title: 'Collections/CalendarView',
  component: CalendarView,
  parameters: { layout: 'fullscreen' },
  beforeEach: withFixedNow,
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
    view: makeView({ type: 'calendar' }),
    onOpen: fn(),
  },
}

export default meta
type Story = StoryObj<typeof CalendarView>

/** 2026-03 — 단일 일자 막대와 기간 막대(주 경계를 넘는 것 포함)가 섞여 있다. */
export const Default: Story = {}

/**
 * lane 오버플로 — 같은 날에 4건 이상을 몰아 MAX_LANES(3) 를 넘긴다.
 * 열별 "+k" 접힘 표시가 격자 밖으로 새지 않아야 한다.
 */
export const LaneOverflow: Story = {
  args: {
    records: [
      makeRecord('o1', { name: '동시 일정 A', due: '2026-03-11' }),
      makeRecord('o2', { name: '동시 일정 B', due: '2026-03-11' }),
      makeRecord('o3', { name: '동시 일정 C', due: '2026-03-11' }),
      makeRecord('o4', { name: '동시 일정 D', due: '2026-03-11' }),
      makeRecord('o5', { name: '동시 일정 E', due: '2026-03-11' }),
      makeRecord('o6', { name: '긴 기간 일정', due: '2026-03-09/2026-03-20' }),
    ],
  },
}

/** 날짜 속성이 아예 없는 스키마 → 안내 상태(점선 박스 + 아이콘). */
export const NoDateProperty: Story = {
  args: {
    schema: DEMO_SCHEMA.filter((d) => d.type !== 'date'),
    records: [],
  },
}

/** 날짜 속성은 있지만 값 있는 레코드가 없음 → 빈 격자. */
export const EmptyMonth: Story = {
  args: { records: [] },
}
