/**
 * Collections — FilterChipRail (적용된 필터의 칩 레일)
 *
 * #365 로 갓 들어온 표면이라 시각 커버리지가 0이었다. 칩은 `rounded-full` + `bg-primary/8` +
 * `border-primary/25` 로 만들어지는데, `/8` 같은 임의 불투명도는 **이 패키지에서만** 쓰여서
 * Tailwind 스캔 범위가 어긋나면 칩 배경이 통째로 사라진다(#366 과 같은 실패 모드). 칩이 줄바꿈될
 * 때의 레일 높이·"모두 지우기" 등장 임계(2개 이상)도 여기서 고정한다.
 *
 * `＋ 필터` 팝오버는 filter-builder.tsx 의 `FilterGroupEditor` 를 연다 — #365 에서 ViewToolbar 밖으로
 * 분리돼 나온 그 편집기의 유일한 시각 커버리지 지점이다(FilterEditorOpen 스토리).
 */
import { expect, fn, screen, userEvent } from '@storybook/test'
import { useState } from 'react'

import { DEMO_SCHEMA, makeView } from '../storybook/fixtures'

import { FilterChipRail } from './FilterChipRail'

import type { FilterChipRailProps } from './FilterChipRail'
import type { ViewConfig } from '@oobleck/collection'
import type { Meta, StoryObj } from '@storybook/react'

/** 칩 제거·편집기 변경이 실제로 반영되게 뷰 상태를 들고 있는 래퍼. */
function StatefulRail({ view: initial, ...rest }: FilterChipRailProps) {
  const [view, setView] = useState<ViewConfig>(initial)
  return (
    <FilterChipRail
      {...rest}
      view={view}
      onViewChange={(next) => {
        rest.onViewChange?.(next)
        setView((prev) => ({ ...prev, ...next }))
      }}
    />
  )
}

const meta: Meta<typeof FilterChipRail> = {
  title: 'Collections/FilterChipRail',
  component: FilterChipRail,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="bg-background p-4">
        <Story />
      </div>
    ),
  ],
  render: (args) => <StatefulRail {...args} />,
  args: {
    schema: DEMO_SCHEMA,
    view: makeView({ type: 'table' }),
    onViewChange: fn(),
  },
}

export default meta
type Story = StoryObj<typeof FilterChipRail>

/** 조건 없음 — `＋ 필터` 점선 칩만 남는다. "모두 지우기"는 아직 안 나온다. */
export const Empty: Story = {}

/** 조건 1개 — 임계(2개) 미만이라 "모두 지우기" 없음. */
export const SingleCondition: Story = {
  args: {
    view: makeView({
      type: 'table',
      filters: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'active' }] },
    }),
  },
}

/**
 * 여러 조건 — 연산자 기호(=, ≥), select 옵션 라벨 해석, 값 미입력(…), 중첩 그룹 요약 칩,
 * "모두 지우기"까지 칩 문법 전종을 한 장에 담는다.
 */
export const MixedConditions: Story = {
  args: {
    view: makeView({
      type: 'table',
      filters: {
        op: 'and',
        children: [
          { key: 'status', op: 'eq', value: 'active' },
          { key: 'amount', op: 'gte', value: 100000 },
          { key: 'tags', op: 'has', value: 'urgent' },
          { key: 'shipped', op: 'eq', value: true },
          { key: 'link', op: 'is_not_empty' },
          { key: 'name', op: 'contains', value: null },
          {
            op: 'or',
            children: [
              { key: 'due', op: 'gte', value: '2026-03-01' },
              { key: 'due', op: 'lte', value: '2026-03-31' },
            ],
          },
        ],
      },
    }),
  },
}

/** 칩이 한 줄을 넘길 때 — `flex-wrap` 으로 레일 높이가 늘어나야 한다(가로 스크롤 아님). */
export const WrappingRail: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-md bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: MixedConditions.args,
}

/**
 * filter-builder 의 `FilterGroupEditor` — `＋ 필터` 팝오버(w-96) 안의 편집기.
 * 조건 행(컬럼·연산자·값 3열)이 좁은 팝오버 안에서 어긋나지 않는지가 핵심이고,
 * 정적 스냅샷으로는 팝오버를 열어야만 볼 수 있다.
 */
export const FilterEditorOpen: Story = {
  args: SingleCondition.args,
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector<HTMLElement>('[aria-label="필터 추가"]')
    await expect(trigger).not.toBeNull()
    await userEvent.click(trigger as HTMLElement)
    // 팝오버는 포털로 뜬다 — canvas 밖(document.body)에서 찾는다.
    await expect(await screen.findByText('+ 필터 그룹 추가')).toBeInTheDocument()
  },
}
