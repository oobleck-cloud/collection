/**
 * Collections — InlineTable (TipTap 블록 안에 들어가는 인라인 표 셸)
 *
 * 이 컴포넌트는 레이아웃을 **호출자에게서 문자열로 받는다**(`gridClassName`). 그래서
 * 스캔 범위가 어긋나면 소비처의 `grid-cols-[...]` 리터럴이 통째로 죽고 모든 셀이 한 줄로
 * 쌓인다 — 컴포넌트 코드에는 아무 잘못이 없어 어떤 단위 테스트도 이걸 잡지 못한다.
 * 아래 스토리의 gridClassName 은 **정적 리터럴**이어야 한다(런타임 조립 금지, 파일 상단 주석 참조).
 */
import { useState } from 'react'

import { InlineTable, InlineTableRow, useInlineRowDrag } from './InlineTable'

import type { Meta, StoryObj } from '@storybook/react'

const GRID = 'grid grid-cols-[20px_1fr_120px_100px_24px] items-center gap-2'

type Feature = { id: string; name: string; unit: string; limit: string }

const SEED: Feature[] = [
  { id: 'f1', name: '방문상담 배정', unit: '건', limit: '무제한' },
  { id: 'f2', name: '플래너 근무슬롯', unit: '슬롯', limit: '200' },
  { id: 'f3', name: '재조정 시뮬레이션', unit: '회', limit: '30' },
  { id: 'f4', name: 'AI 상담 추천', unit: '요청', limit: '5,000' },
]

/** 행 드래그 정렬까지 살아 있는 실사용 형태 — 셸이 그립·삭제·빈상태·푸터를 전부 소유한다. */
function FeatureTable({ initial }: { initial: Feature[] }) {
  const [items, setItems] = useState(initial)
  const { startDrag, rowRef } = useInlineRowDrag(items, setItems)

  return (
    <InlineTable
      label="기능"
      count={items.length}
      gridClassName={GRID}
      columns={['이름', '단위', '한도']}
      emptyLabel="아직 기능이 없습니다."
      footer={
        <button
          type="button"
          onClick={() =>
            setItems((prev) => [
              ...prev,
              { id: `f${prev.length + 1}`, name: '새 기능', unit: '건', limit: '—' },
            ])
          }
          className="rounded px-1.5 py-0.5 text-xs text-fg-muted hover:bg-surface hover:text-fg"
        >
          + 기능 추가
        </button>
      }
    >
      {items.map((it, i) => (
        <InlineTableRow
          key={it.id}
          gridClassName={GRID}
          rowRef={rowRef(i)}
          onGripDown={startDrag(i)}
          onRemove={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
          removeLabel={`${it.name} 삭제`}
        >
          <span className="truncate text-sm text-fg">{it.name}</span>
          <span className="text-xs text-fg-muted">{it.unit}</span>
          <span className="text-xs tabular-nums text-fg-muted">{it.limit}</span>
        </InlineTableRow>
      ))}
    </InlineTable>
  )
}

const meta: Meta<typeof FeatureTable> = {
  title: 'Collections/InlineTable',
  component: FeatureTable,
  decorators: [
    (Story) => (
      <div className="max-w-xl bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: { initial: SEED },
}

export default meta
type Story = StoryObj<typeof FeatureTable>

/** 행 4개 — 헤더 격자와 행 격자의 열이 정확히 맞아야 한다(같은 gridClassName). */
export const Default: Story = {}

/** 빈 상태 — 헤더 행은 남고 본문만 안내 문구로 대체된다. */
export const Empty: Story = {
  args: { initial: [] },
}

/** 행 하나 — 마지막 행의 border-b 제거(`last:border-b-0`) 확인. */
export const SingleRow: Story = {
  args: { initial: SEED.slice(0, 1) },
}
