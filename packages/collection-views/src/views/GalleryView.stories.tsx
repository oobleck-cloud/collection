/**
 * Collections — GalleryView (카드 격자)
 *
 * 시각회귀에서 가장 값싼 회귀 감지 지점. 타일 폭은 임의값 유틸리티
 * `grid-cols-[repeat(auto-fill,minmax(240px,1fr))]` 하나에 걸려 있어서, 그 규칙이 생성되지
 * 않으면 격자가 통째로 **1열로 붕괴**한다(#366 이 정확히 그 사고였다 — Tailwind `@source` 에
 * packages/collections/src 가 빠져 유틸리티 85개가 생성되지 않았고, Chromatic 은 collections 를
 * 보지 못해 green 이었다). CardSizes 스토리는 S/M/L 세 격자를 한 장에 담아 그 붕괴를 잡는다.
 */
import { expect, within } from '@storybook/test'

import { DEMO_PACK, DEMO_RECORDS, DEMO_SCHEMA, makeView } from '../storybook/fixtures'

import { GalleryView } from './GalleryView'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof GalleryView> = {
  title: 'Collections/GalleryView',
  component: GalleryView,
  parameters: {
    layout: 'fullscreen',
  },
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
    view: makeView({ type: 'gallery' }),
  },
}

export default meta
type Story = StoryObj<typeof GalleryView>

/** 기본 격자(cardSize 미지정 = M, 240px 타일). 뷰포트 폭만큼 열이 채워져야 한다. */
export const Default: Story = {}

/**
 * S/M/L 세 격자를 세로로 쌓아 타일 폭 규칙 3개를 한 스냅샷에 담는다.
 * 열 수가 위→아래로 줄어들지 않으면(= 전부 같은 폭이거나 전부 1열이면) 유틸리티가 죽은 것이다.
 */
export const CardSizes: Story = {
  render: (args) => (
    <div className="flex flex-col gap-8">
      {(['S', 'M', 'L'] as const).map((size) => (
        <section key={size}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            cardSize = {size}
          </h3>
          <GalleryView {...args} view={makeView({ type: 'gallery', cardSize: size })} />
        </section>
      ))}
    </div>
  ),
}

/**
 * 타일 폭 계약 — 격자가 실제로 다열인지 *계산된 스타일*로 확인한다.
 *
 * 스냅샷 diff 는 "달라졌다"만 말해주고 베이스라인이 이미 틀렸으면 아무 말도 못 한다.
 * 이 검사는 임의값 유틸리티의 생성 자체를 직접 확인하므로 #366 형태의 사고(규칙 미생성)를
 * 베이스라인 없이도 잡는다.
 */
export const GridTemplateContract: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 카드 제목이 그려졌다 = 뷰가 빈 상태로 빠지지 않았다.
    await expect(canvas.getByText('방문상담 배정 개선')).toBeInTheDocument()

    const grid = canvasElement.querySelector<HTMLElement>('[class*="grid-cols-"]')
    await expect(grid).not.toBeNull()

    const cols = getComputedStyle(grid as HTMLElement).gridTemplateColumns
    // `repeat(auto-fill,minmax(240px,1fr))` 가 생성됐다면 브라우저가 폭을 픽셀로 풀어준다.
    // 규칙이 없으면 `none`(= 단일 열로 붕괴)이 나온다.
    await expect(cols).not.toBe('none')
    await expect(cols.trim().split(/\s+/).length).toBeGreaterThan(1)
  },
}

/** select 그룹핑 — 섹션 헤더 + 색 스와치. 그룹 헤더 레이아웃 회귀용. */
export const GroupedByStatus: Story = {
  args: {
    view: makeView({ type: 'gallery', groupBy: 'status' }),
  },
}

/** multi_select 그룹핑 — 한 레코드가 여러 섹션에 중복 등장한다(멀티 그룹 계약). */
export const GroupedByTags: Story = {
  args: {
    view: makeView({ type: 'gallery', groupBy: 'tags' }),
  },
}

/** 빈 상태 — 점선 테두리 안내. */
export const Empty: Story = {
  args: { records: [] },
}
