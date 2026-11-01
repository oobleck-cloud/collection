/**
 * Collections — Workstyle 킷
 *
 * 같은 컬렉션 뷰를 부품 자리(src/kit)에 Workstyle 킷을 걸어 그린다. 단추·입력·고르개·팝오버·스위치·체크박스·배지·
 * 아이콘 일부가 @oobleck/workstyle/react 로 바뀌고, 감싼 곳의 .dark 로 systheme 색도 Workstyle 다크 값이 된다.
 * 킷이 채우지 않는 자리(AnchorContextSurface·표 등)는 systheme 그대로다. 기본(킷 없음) 모습은 각 뷰 스토리.
 */
import '@oobleck/workstyle/react.css'

import { fn } from '@storybook/test'
import { useState } from 'react'

import { KitProvider } from '@oobleck/collection-views/kit'
import {
  DEMO_PACK,
  DEMO_RECORDS,
  DEMO_SCHEMA,
  makeView,
} from '@oobleck/collection-views/storybook/fixtures'
import { BoardView } from '@oobleck/collection-views/views/BoardView'
import { TableView } from '@oobleck/collection-views/views/TableView'
import { ViewToolbar } from '@oobleck/collection-views/views/ViewToolbar'

import { workstyleKit } from './index'

import type { ViewConfig } from '@oobleck/collection'
import type { Meta, StoryObj } from '@storybook/react'

function Demo({ type }: { type: 'table' | 'board' }) {
  const [view, setView] = useState<ViewConfig>(
    makeView({
      type,
      aggregations: { amount: 'sum', name: 'count' },
      ...(type === 'board' ? { groupBy: 'status' } : {}),
    }),
  )
  const onViewChange = (next: Partial<ViewConfig>) => setView((prev) => ({ ...prev, ...next }))
  return (
    <div className="flex flex-col gap-3">
      <ViewToolbar
        schema={DEMO_SCHEMA}
        view={view}
        onViewChange={onViewChange}
        onSearchChange={fn()}
        onCreate={fn()}
        createLabel="새 항목"
      />
      {type === 'table' ? (
        <TableView
          records={DEMO_RECORDS}
          pack={DEMO_PACK}
          schema={DEMO_SCHEMA}
          view={view}
          onOpen={fn()}
          onEdit={fn()}
          onDeleteRow={fn()}
          onCreate={fn()}
          createLabel="+ 새 항목"
          onSortChange={fn()}
          onColumnHide={fn()}
          onAddProperty={fn()}
          onAggregationChange={fn()}
        />
      ) : (
        <BoardView
          records={DEMO_RECORDS}
          pack={DEMO_PACK}
          schema={DEMO_SCHEMA}
          view={view}
          onOpen={fn()}
          onCreate={fn()}
        />
      )}
    </div>
  )
}

const meta: Meta<typeof Demo> = {
  title: 'Collections/Workstyle 킷',
  component: Demo,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <KitProvider kit={workstyleKit}>
        <div className="min-h-screen bg-canvas p-4 text-fg">
          <Story />
        </div>
      </KitProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof Demo>

/** 표 + 툴바 */
export const Table: Story = { args: { type: 'table' } }

/** 보드 + 툴바 */
export const Board: Story = { args: { type: 'board' } }
