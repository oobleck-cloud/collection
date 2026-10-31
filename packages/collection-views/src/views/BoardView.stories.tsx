/**
 * Collections — BoardView (칸반)
 *
 * 표면 문법(2026-10-26): 열은 테두리 없이 한 단 눌린 면(bg-canvas), 카드는 테두리 없이 그림자로 뜬 흰 면.
 * 열 머리는 색 점 + 이름 + 수. 시각회귀가 지키는 것:
 *  - Default: select 그룹(색 점 열 머리) · 칩 카드 · 빈 열 「비어 있음」.
 *  - CollapsedEmptyColumns: 빈 열이 좁은 세로 띠(이름 + 0)로 접힌다.
 *  - NegotiationLike: 넓은 카드(L) · 기한 배지 · 메타 한 줄 · 요약 묶음 · 조건부 서식(글자색) · 버튼 없는 줄 관계 표.
 * 상대 날짜가 들어가므로 시계를 고정한다(withFixedNow — 2026-03-15).
 */
import { withFixedNow } from '../storybook/fixedClock'
import {
  DEMO_PACK,
  DEMO_RECORDS,
  DEMO_SCHEMA,
  makePack,
  makeRecord,
  makeView,
} from '../storybook/fixtures'

import { BoardView } from './BoardView'

import type {
  PropertyDef,
  RelatedRecordRow,
  RelatedRecordSource,
  RelationProvider,
} from '@oobleck/collection'
import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof BoardView> = {
  title: 'Collections/BoardView',
  component: BoardView,
  beforeEach: withFixedNow,
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
    view: makeView({
      type: 'board',
      groupBy: 'status',
      visibleProps: ['name', 'tags', 'amount', 'due'],
    }),
    onEdit: () => {},
    onOpen: () => {},
  },
}

export default meta
type Story = StoryObj<typeof BoardView>

/** select 그룹 — 색 점 열 머리 · 칩 카드. */
export const Default: Story = {}

/** 빈 열 접기 — 「검토」 태그 열처럼 카드 없는 열은 좁은 세로 띠. */
export const CollapsedEmptyColumns: Story = {
  args: {
    records: DEMO_RECORDS.filter((r) => r.doc.properties?.status !== 'paused'),
    view: makeView({
      type: 'board',
      groupBy: 'status',
      collapseEmptyGroups: true,
      visibleProps: ['name', 'tags', 'amount'],
    }),
  },
}

// ─── 가격 조율 보드 닮은 꼴 — 관계 표(목록) · 상대 날짜 · 조건부 서식 ─────────────────

const QUOTE_SCHEMA: PropertyDef[] = [
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

const QUOTES: RelatedRecordRow[] = [
  { id: 'q1', props: { partner: '한빛이사', price: 128, state: '대기' } },
  { id: 'q2', props: { partner: '바른익스프레스', price: 135, state: '부재' } },
  { id: 'q3', props: { partner: '이삿날', price: 142, state: '대기' } },
  { id: 'q4', props: { partner: '든든이사', price: 150, state: '대기' } },
  { id: 'q5', props: { partner: '오늘이사', price: 155, state: '합의' } },
]
const quoteById = new Map(QUOTES.map((q) => [q.id, q]))

const QUOTE_SOURCE: RelatedRecordSource = {
  schema: QUOTE_SCHEMA,
  read: (ids) => ids.flatMap((id) => (quoteById.has(id) ? [quoteById.get(id)!] : [])),
  countUnit: '곳',
  rowActions: [{ id: 'call', label: '네고 콜', run: () => {} }],
}

const RELATIONS: Record<string, RelationProvider> = {
  quotes: { search: () => [], resolve: () => [], records: QUOTE_SOURCE },
}

const NEGOTIATION_SCHEMA: PropertyDef[] = [
  { key: 'title', label: '주문', type: 'text', source: 'projection', origin: 'preset' },
  {
    key: 'stage',
    label: '가격 조율 상태',
    type: 'select',
    source: 'projection',
    origin: 'preset',
    options: [
      { value: '신규', color: 'gray' },
      { value: '연락중', color: 'blue' },
      { value: '합의', color: 'green' },
      { value: '결렬', color: 'red' },
    ],
  },
  {
    key: 'kind',
    label: '조율 종류',
    type: 'select',
    source: 'projection',
    origin: 'preset',
    options: [
      { value: 'gap', label: '희망가 Gap', color: 'orange' },
      { value: 'none', label: '적정가 없음', color: 'purple' },
    ],
    // 이름표 없이 칩만 한 줄 — 칩이 스스로 무엇인지 말한다.
    cardLabel: '',
  },
  {
    key: 'due',
    label: '조율 기한',
    type: 'date',
    source: 'projection',
    origin: 'preset',
    dateOnly: true,
    dateFormat: 'relative',
    cardLabel: '기한',
  },
  {
    key: 'visit',
    label: '방문 일시',
    type: 'date',
    source: 'projection',
    origin: 'preset',
    dateFormat: 'short',
    cardLabel: '방문',
    cardMeta: true,
  },
  {
    key: 'lowest',
    label: '최저 견적',
    type: 'number',
    source: 'projection',
    origin: 'preset',
    format: (v) => (typeof v === 'number' ? `${v.toLocaleString('ko-KR')}만` : ''),
  },
  {
    key: 'base',
    label: '조율 기준가',
    type: 'number',
    source: 'projection',
    origin: 'preset',
    cardLabel: '기준가',
    cardLabelKey: 'baseSource',
    format: (v) => (typeof v === 'number' ? `${v.toLocaleString('ko-KR')}만` : ''),
  },
  {
    key: 'gap',
    label: '희망가 차이',
    type: 'number',
    source: 'projection',
    origin: 'preset',
    cardLabel: '줄여야 할 금액',
    format: (v) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${String(v)}만` : ''),
  },
  {
    key: 'quotes',
    label: '견적',
    type: 'relation',
    source: 'projection',
    origin: 'preset',
    relation: { target: 'quotes' },
  },
]

const NEGOTIATION_RECORDS = [
  makeRecord('n1', {
    title: '#58210 서울 마포 → 경기 고양',
    stage: '신규',
    kind: 'gap',
    due: '2026-03-16',
    __dueSoon: true,
    visit: '2026-03-09T11:30',
    baseSource: '희망가',
    base: 110,
    lowest: 128,
    gap: 18,
    quotes: ['q1', 'q2', 'q3', 'q4', 'q5'],
  }),
  makeRecord('n2', {
    title: '#58233 서울 강서 → 인천 부평',
    stage: '신규',
    kind: 'none',
    due: '2026-03-18',
    visit: '2026-03-11T10:00',
    baseSource: '타업체 견적',
    base: 120,
    lowest: 135,
    gap: 15,
    quotes: ['q2', 'q3'],
  }),
  makeRecord('n3', {
    title: '#58190 경기 성남 → 서울 송파',
    stage: '연락중',
    kind: 'gap',
    due: '2026-03-15',
    __dueSoon: true,
    visit: '2026-03-08T12:00',
    baseSource: '희망가',
    base: 130,
    lowest: 142,
    gap: 12,
    quotes: ['q3', 'q1', 'q4'],
  }),
]

export const NegotiationLike: Story = {
  args: {
    records: NEGOTIATION_RECORDS,
    pack: makePack(NEGOTIATION_SCHEMA),
    schema: NEGOTIATION_SCHEMA,
    relations: RELATIONS,
    view: makeView({
      type: 'board',
      groupBy: 'stage',
      cardSize: 'L',
      cardPropLabels: true,
      collapseEmptyGroups: true,
      relationTable: { key: 'quotes', maxRows: 3, variant: 'rows' },
      // 기한은 제목 옆 배지(임박하면 주의 색), 금액 셋은 숫자 띠, 나머지는 메타 한 줄.
      cardLayout: { badgeKey: 'due', metrics: ['gap', 'base', 'lowest'] },
      visibleProps: ['title', 'due', 'kind', 'visit', 'base', 'lowest', 'gap', 'quotes'],
      // 줄여야 할 금액(차이 > 0)은 주의 색.
      conditionalFormats: [
        {
          id: 'gap-to-close',
          target: 'gap',
          when: { op: 'and', children: [{ key: 'gap', op: 'gt', value: 0 }] },
          style: { tone: 'warning' },
        },
      ],
    }),
  },
}

/** 같은 보드, 관계 표를 「견적 N곳 보기」 한 줄로 접어 둔 모양. */
export const NegotiationCollapsedQuotes: Story = {
  args: {
    ...NegotiationLike.args,
    view: makeView({
      type: 'board',
      groupBy: 'stage',
      cardSize: 'L',
      cardPropLabels: true,
      collapseEmptyGroups: true,
      relationTable: { key: 'quotes', maxRows: 3, variant: 'list', collapsed: true },
      visibleProps: ['title', 'kind', 'due', 'base', 'gap', 'quotes'],
    }),
  },
}
