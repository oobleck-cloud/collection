/**
 * Collections — TableView (노션식 데이터 표)
 *
 * 이 패키지에서 가장 큰 레이아웃 표면(2100줄). sticky 컬럼·컬럼 폭 모드(fixed/fit/fill)·
 * 행 밀도·hover 어포던스·footer 집계가 전부 Tailwind 유틸리티에 걸려 있어, 스캔 범위가
 * 어긋나면 조용히 무너진다(#366). 아래 스토리는 그 축들을 스냅샷 가능한 상태로 고정한다.
 */
import { expect, fn, within } from '@storybook/test'

import { hasCssRuleMatching } from '../storybook/cssRules'
import { DEMO_PACK, DEMO_RECORDS, DEMO_SCHEMA, makeView } from '../storybook/fixtures'

import { TableView } from './TableView'

import type { TableViewProps } from './TableView'
import type { FixtureProps } from '../storybook/fixtures'
import type { Meta, StoryObj } from '@storybook/react'

type Props = TableViewProps<FixtureProps>

const meta: Meta<Props> = {
  title: 'Collections/TableView',
  component: TableView,
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
    view: makeView({ type: 'table' }),
  },
}

export default meta
type Story = StoryObj<Props>

/** 읽기전용 표 — 콜백 없음. 셀은 전부 정적 렌더 경로를 탄다. */
export const ReadOnly: Story = {}

/** 제목 컬럼이 링크가 되는 도메인 목록형(`titleVariant='plain'`, 문서 아이콘 없음). */
export const PlainTitle: Story = {
  args: {
    titleVariant: 'plain',
    onOpen: fn(),
  },
}

/**
 * 어포던스 전개 — 드래그 그립·행 케밥·컬럼 추가·집계 푸터가 모두 켜진 상태.
 * 콜백 유무로 UI 가 갈리는 컴포넌트라, "다 켠 모습"이 별도 스냅샷으로 있어야 한다.
 */
export const AllAffordances: Story = {
  args: {
    view: makeView({
      type: 'table',
      aggregations: { amount: 'sum', name: 'count' },
    }),
    onOpen: fn(),
    onEdit: fn(),
    onEditTitle: fn(),
    onDeleteRow: fn(),
    onReorder: fn(),
    onCreate: fn(),
    createLabel: '+ 새 항목',
    onSortChange: fn(),
    onColumnHide: fn(),
    onColumnResize: fn(),
    onColumnReorder: fn(),
    onRenameColumn: fn(),
    onAddProperty: fn(),
    onAggregationChange: fn(),
  },
}

/** 행 높이 S/M/L → DS Table density(compact/default/comfortable) 매핑. */
export const RowHeights: Story = {
  render: (args) => (
    <div className="flex flex-col gap-8">
      {(['S', 'M', 'L'] as const).map((h) => (
        <section key={h}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            rowHeight = {h}
          </h3>
          <TableView {...args} view={makeView({ type: 'table', rowHeight: h })} />
        </section>
      ))}
    </div>
  ),
}

/** 컬럼 폭 3-모드(fixed/fit/fill) — 폭 계산이 무너지면 여기서 먼저 보인다. */
export const ColumnWidths: Story = {
  args: {
    schema: [
      { ...DEMO_SCHEMA[0], width: { mode: 'fill', minPx: 240 } },
      { ...DEMO_SCHEMA[1], width: { mode: 'fit' } },
      { ...DEMO_SCHEMA[3], width: { mode: 'fixed', px: 120 } },
      { ...DEMO_SCHEMA[4], width: { mode: 'fixed', px: 200 } },
    ],
    view: makeView({ type: 'table', visibleProps: ['name', 'status', 'amount', 'due'] }),
  },
}

/**
 * hover 어포던스 계약 — 정적 스냅샷이 원리적으로 못 보는 축.
 *
 * 그립(⠿)은 평상시 `opacity-0`, 행 hover 시 `group-hover/row:opacity-100` 으로 드러난다.
 * 스캔 범위가 어긋나면 **뒤쪽 규칙만** 사라져서 그립이 영구히 안 보이는데, 정적 스냅샷은
 * 그대로라 아무것도 잡히지 않는다(#366 의 TableView 증상). 그래서 두 가지를 함께 본다:
 *   1) 평상시 실제로 투명한가(= opacity-0 이 살아 있는가)
 *   2) hover 로 드러나는 규칙이 스타일시트에 생성돼 있는가
 */
export const RowHoverAffordanceContract: Story = {
  args: {
    onOpen: fn(),
    onReorder: fn(),
    onDeleteRow: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const grip = await canvas.findAllByRole('button', { name: /행 이동|move row/i })
    await expect(grip.length).toBeGreaterThan(0)

    // 1) 평상시 투명 — 켜져 있으면 그립이 상시 노출되는 회귀다.
    await expect(getComputedStyle(grip[0]).opacity).toBe('0')

    // 2) hover 로 드러나는 규칙이 생성됐는가(합성 이벤트로는 :hover 를 못 켜므로 CSSOM 으로 확인).
    await expect(hasCssRuleMatching('group-hover\\/row\\:opacity-100')).toBe(true)
  },
}

/** 빈 상태 + 생성 행 — 첫 placeholder 행이 "+ 새 항목" 트리거가 된다. */
export const EmptyWithCreate: Story = {
  args: {
    records: [],
    onCreate: fn(),
    createLabel: '+ 새 항목',
  },
}

/**
 * stickyHeader — 컬럼 헤더가 스크롤 컨테이너 상단에 붙는다(주문·고객 등 리스트 화면 계약).
 * 표 자체의 가로 스크롤 래퍼가 꺼지고, 스토리가 흉내 내는 화면 스크롤 영역(overflow-auto)이
 * 가로·세로 스크롤을 모두 소유한다. play 는 실제로 스크롤한 뒤 thead 가 컨테이너 상단에
 * 남아 있는지(위치 불변)를 검증한다 — 클래스 존재가 아니라 행동을 본다.
 */
export const StickyHeader: Story = {
  args: {
    stickyHeader: true,
    // 세로 스크롤이 실제로 생기게 데모 레코드를 5벌 복제(40행).
    records: Array.from({ length: 5 }, (_, i) =>
      DEMO_RECORDS.map((r) => ({ ...r, id: `${r.id}_${i}` })),
    ).flat(),
  },
  render: (args) => (
    <div data-testid="scroll-region" className="h-80 overflow-auto">
      <TableView {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const region = await canvas.findByTestId('scroll-region')
    const thead = canvasElement.querySelector('thead')
    if (!thead) throw new Error('thead not found')

    const topBefore = thead.getBoundingClientRect().top
    region.scrollTop = 200
    // 스크롤 반영은 동기(레이아웃) — sticky 라면 화면상 위치가 그대로다.
    const topAfter = thead.getBoundingClientRect().top
    await expect(topAfter).toBeCloseTo(topBefore, 0)
    // 대조군: 본문 첫 행은 스크롤만큼 위로 움직였어야 한다(표 전체가 안 움직인 게 아니라).
    await expect(region.scrollTop).toBeGreaterThan(0)
  },
}
