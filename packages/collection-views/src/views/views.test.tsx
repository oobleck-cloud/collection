// @vitest-environment jsdom
//
// @oobleck/collection — 컴포넌트 렌더 테스트 (BL2).
//
// 목적: ViewSurface(.tsx)의 렌더 사각지대를 닫는 회귀 핀 테스트.
//   - TimelineView: 축 미설정 → 안내 상태, 그리고 미설정→설정 rerender 전이(Rules-of-Hooks B2 핀).
//   - GalleryView: 레코드 0개 → 빈 상태, groupBy + 레코드 → 그룹 섹션.
//   - GroupPanel smoke: 후보 없음 → 안내, 후보 있음 → 선택 가능.
//
// 전략: @oobleck/systheme 배럴(motion·Tiptap 등 무거운 의존)을 vi.mock 경량 스텁으로 대체.
//   대상 컴포넌트의 *자체 로직·훅*이 실행되는 것이 핵심이고, DS 컴포넌트 렌더는 부차적.

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ── @oobleck/systheme 경량 스텁 ────────────────────────────────────────────────────────
// record-card.tsx 가 ArrowLeftRight/Badge/CalendarDays/Hash/Link2/List/SquareCheck/Tags/Type/cn/LucideIcon 사용.
// TimelineView 가 CalendarDays/cn, GalleryView 가 Plus/cn, group-panel 이 List/Switch/cn 사용.
// 모두 최소 스텁으로 대체 — 컴포넌트 자체 로직·훅 실행이 핵심.
vi.mock('@oobleck/systheme', () => {
  const makeIcon =
    (id: string) =>
    ({ className }: { className?: string; 'aria-hidden'?: boolean }) =>
      React.createElement('svg', { 'data-testid': `icon-${id}`, className })

  const CalendarDays = makeIcon('calendar')
  const Plus = makeIcon('plus')
  const List = makeIcon('list')
  const ArrowLeftRight = makeIcon('arrow-lr')
  const Hash = makeIcon('hash')
  const Link2 = makeIcon('link2')
  const SquareCheck = makeIcon('square-check')
  const Tags = makeIcon('tags')
  const Type = makeIcon('type')

  const Mail = makeIcon('mail')
  const MapIcon = makeIcon('map')
  const Phone = makeIcon('phone')

  const Switch = ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean
    onCheckedChange: (v: boolean) => void
  }) =>
    React.createElement('button', {
      role: 'switch',
      'aria-checked': checked,
      onClick: () => onCheckedChange(!checked),
    })

  const Badge = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children)

  const Tag = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children)

  const Select = ({
    value,
    onChange,
    options,
  }: {
    value?: string
    onChange?: (v: string) => void
    options: { value: string; label: string }[]
  }) =>
    React.createElement(
      'select',
      { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value) },
      options.map((o) => React.createElement('option', { key: o.value, value: o.value }, o.label)),
    )

  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')

  return {
    CalendarDays,
    Plus,
    List,
    Switch,
    Badge,
    Tag,
    Select,
    cn,
    ArrowLeftRight,
    Hash,
    LayoutDashboard: makeIcon('layout-dashboard'),
    Link2,
    SquareCheck,
    Tags,
    Type,
    User: makeIcon('user'),
    Users: makeIcon('users'),
    Mail,
    Map: MapIcon,
    Phone,
  }
})

// ── 인라인 mock BlockPack (productBlockPack 의존 없음) ───────────────────────
import type {
  BlockDocument,
  BlockPack,
  PropertyDef,
  PropertyValue,
  TableRecord,
  ViewConfig,
} from '@oobleck/collection'

type MockProps = Record<string, PropertyValue>

/** 최소 BlockPack — frontmatter 프로퍼티를 그대로 읽는다. */
function makePack(schema: PropertyDef[]): BlockPack<MockProps> {
  return {
    propertySchema: schema,
    readProperties: (doc: BlockDocument): MockProps => doc.properties ?? {},
    writeProperty: (doc: BlockDocument, key: string, value: PropertyValue): BlockDocument => ({
      ...doc,
      properties: { ...(doc.properties ?? {}), [key]: value },
    }),
  }
}

/** 최소 ViewConfig 생성 헬퍼. */
function makeView(partial: Partial<ViewConfig>): ViewConfig {
  return {
    type: 'timeline',
    filters: { op: 'and', children: [] },
    sort: [],
    ...partial,
  }
}

/** 테스트 레코드 생성 헬퍼. */
function makeRecord(id: string, props: Record<string, PropertyValue>): TableRecord {
  return { id, doc: { properties: props } }
}

// ── 지연 import (vi.mock 이후에 실제 모듈 로드) ──────────────────────────────
// vitest hoisting: vi.mock 은 파일 상단으로 호이스팅되지만 dynamic import 로 해소를 늦출 수 있다.
// 아래는 정적 import 로 사용 가능 — vi.mock 이 먼저 등록되므로.
import { TimelineView } from './TimelineView'
import { GalleryView } from './GalleryView'
import { ListView } from './ListView'
import { GroupPanel } from './group-panel'

afterEach(cleanup)

// ── TimelineView ──────────────────────────────────────────────────────────────

describe('TimelineView', () => {
  const dateSchema: PropertyDef[] = [
    {
      key: 'start_date',
      label: '시작일',
      type: 'date',
      source: 'frontmatter',
      origin: 'preset',
    },
    {
      key: 'end_date',
      label: '종료일',
      type: 'date',
      source: 'frontmatter',
      origin: 'preset',
    },
  ]
  const pack = makePack(dateSchema)

  it('축 미설정(startKey 없음) → 안내 상태 렌더, 크래시 없음', () => {
    const view = makeView({ type: 'timeline' }) // timeline 미설정 = undefined
    const records: TableRecord[] = []

    render(<TimelineView records={records} pack={pack} view={view} />)

    // 날짜 컬럼은 있지만 startKey 가 없으므로 선택 안내 문구가 보여야 한다.
    expect(screen.getByText('타임라인 기준 날짜 속성을 선택하세요')).toBeDefined()
  })

  it('date 컬럼이 아예 없을 때 → "날짜 속성이 없습니다" 안내', () => {
    const noDatePack = makePack([
      { key: 'title', label: '제목', type: 'text', source: 'frontmatter', origin: 'preset' },
    ])
    const view = makeView({ type: 'timeline' })

    render(<TimelineView records={[]} pack={noDatePack} view={view} />)

    expect(screen.getByText('날짜 속성이 없습니다')).toBeDefined()
  })

  it('(B2 회귀 핀) 축 미설정 → 설정 rerender 전이 시 "Rendered more hooks" 크래시 없음', () => {
    // W3 B2: startKey 미설정 상태(안내 렌더) → startKey 설정 상태(정상 렌더)로 rerender.
    // Rules-of-Hooks 위반이면 이 전이에서 "Rendered more hooks than during the previous render" 에러가 발생한다.
    const records: TableRecord[] = [
      makeRecord('r1', { start_date: '2026-01-15', end_date: '2026-03-01' }),
      makeRecord('r2', { start_date: '2026-02-01' }),
    ]

    // 1단계: 축 미설정 — 안내 상태 렌더
    const viewNoAxis = makeView({ type: 'timeline' })
    const { rerender } = render(<TimelineView records={records} pack={pack} view={viewNoAxis} />)
    expect(screen.getByText('타임라인 기준 날짜 속성을 선택하세요')).toBeDefined()

    // 2단계: startKey 설정 — 정상 타임라인 렌더(에러 없어야 함)
    const viewWithAxis = makeView({
      type: 'timeline',
      timeline: { startKey: 'start_date', endKey: 'end_date', zoom: 'month' },
    })
    // rerender 가 에러 없이 완료되는 것이 핵심 assertion.
    expect(() => {
      rerender(<TimelineView records={records} pack={pack} view={viewWithAxis} />)
    }).not.toThrow()

    // 타임라인 막대 행이 렌더됐는지 확인(role=row).
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('레코드에 날짜값이 없을 때(startKey 설정됨) → "날짜 값이 있는 레코드가 없습니다" 안내', () => {
    const records: TableRecord[] = [
      makeRecord('r1', { start_date: null }), // 날짜값 없음
    ]
    const view = makeView({
      type: 'timeline',
      timeline: { startKey: 'start_date' },
    })

    render(<TimelineView records={records} pack={pack} view={view} />)

    expect(screen.getByText('날짜 값이 있는 레코드가 없습니다.')).toBeDefined()
  })

  it('startKey 설정 + 유효한 날짜값 → 크래시 없이 렌더, 레코드 행 존재', () => {
    const records: TableRecord[] = [
      makeRecord('r1', { start_date: '2026-03-01', end_date: '2026-06-30' }),
      makeRecord('r2', { start_date: '2026-04-15' }),
    ]
    const view = makeView({
      type: 'timeline',
      timeline: { startKey: 'start_date', endKey: 'end_date', zoom: 'month' },
    })

    render(<TimelineView records={records} pack={pack} view={view} />)

    const rows = screen.getAllByRole('row')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })
})

// ── GalleryView ───────────────────────────────────────────────────────────────

describe('GalleryView', () => {
  const schema: PropertyDef[] = [
    {
      key: 'name',
      label: '이름',
      type: 'text',
      source: 'frontmatter',
      origin: 'preset',
    },
    {
      key: 'category',
      label: '카테고리',
      type: 'select',
      source: 'frontmatter',
      origin: 'preset',
      options: [
        { value: 'A', label: '카테고리A' },
        { value: 'B', label: '카테고리B' },
      ],
    },
  ]
  const pack = makePack(schema)
  const baseView = makeView({ type: 'gallery' })

  it('레코드 0개 → 빈 상태 텍스트 렌더, 크래시 없음', () => {
    render(<GalleryView records={[]} pack={pack} view={baseView} />)
    expect(screen.getByText('레코드가 없습니다.')).toBeDefined()
  })

  it('레코드 있고 groupBy 없음 → 그룹 섹션 없이 카드 렌더', () => {
    const records: TableRecord[] = [
      makeRecord('p1', { name: '상품 Alpha', category: 'A' }),
      makeRecord('p2', { name: '상품 Beta', category: 'B' }),
    ]

    render(<GalleryView records={records} pack={pack} view={baseView} />)

    // groupBy 없으므로 섹션 헤더 없이 카드만 렌더. 크래시가 없으면 OK.
    // 그룹 헤더 없음 — 헤더의 색 점으로 본다(카드 칩이 선택지 라벨 「카테고리A」를 그리므로 글자로는 못 가린다).
    expect(screen.queryByTestId('group-color-swatch')).toBeNull()
    expect(screen.getByText('카테고리A')).toBeDefined() // 카드 칩 = 값(A)이 아니라 라벨
    // 카드 내 제목은 visibleProps 설정이 없으므 schema 전체에 포함됨 — 하지만
    // GallerySection 이 titleKey 를 찾아 제목으로 쓰므로 schema[0].key='name' 이 title.
    // (단, visibleProps 미설정이면 resolveTitleKey 는 schema[0] = 'name' 을 쓴다)
  })

  it('groupBy 설정 + 레코드 → 그룹 섹션 헤더 렌더', () => {
    const records: TableRecord[] = [
      makeRecord('p1', { name: '상품 Alpha', category: 'A' }),
      makeRecord('p2', { name: '상품 Beta', category: 'B' }),
      makeRecord('p3', { name: '상품 Gamma', category: 'A' }),
    ]
    const view = makeView({ type: 'gallery', groupBy: 'category' })

    render(<GalleryView records={records} pack={pack} view={view} />)

    // 그룹 섹션 헤더가 렌더돼야 한다.
    expect(screen.getByText('카테고리A')).toBeDefined()
    expect(screen.getByText('카테고리B')).toBeDefined()
  })

  it('groupBy 설정됐으나 레코드 없음 → 빈 상태', () => {
    const view = makeView({ type: 'gallery', groupBy: 'category' })

    render(<GalleryView records={[]} pack={pack} view={view} />)

    expect(screen.getByText('레코드가 없습니다.')).toBeDefined()
  })
})

// ── 그룹 헤더 색 스와치 렌더 핀 테스트 ─────────────────────────────────────────

describe('GalleryView 그룹 헤더 색 스와치', () => {
  const colorSchema: PropertyDef[] = [
    {
      key: 'name',
      label: '이름',
      type: 'text',
      source: 'frontmatter',
      origin: 'preset',
    },
    {
      key: 'status',
      label: '상태',
      type: 'select',
      source: 'frontmatter',
      origin: 'preset',
      options: [
        { value: 'active', label: '활성', color: 'green' },
        { value: 'inactive', label: '비활성', color: 'red' },
      ],
    },
  ]
  const pack = makePack(colorSchema)

  it('groupBy=select 컬럼(옵션 색 있음) → 그룹 헤더에 color swatch 렌더', () => {
    const records: TableRecord[] = [
      makeRecord('r1', { name: '알파', status: 'active' }),
      makeRecord('r2', { name: '베타', status: 'inactive' }),
    ]
    const view = makeView({ type: 'gallery', groupBy: 'status' })

    render(<GalleryView records={records} pack={pack} view={view} />)

    // 그룹 헤더 라벨 렌더 확인.
    expect(screen.getByText('활성')).toBeDefined()
    expect(screen.getByText('비활성')).toBeDefined()
    // 스와치(data-testid=group-color-swatch)가 그룹 수만큼 렌더돼야 한다.
    const swatches = screen.getAllByTestId('group-color-swatch')
    expect(swatches.length).toBeGreaterThanOrEqual(2)
  })
})

describe('ListView 그룹 헤더 색 스와치', () => {
  const colorSchema: PropertyDef[] = [
    {
      key: 'title',
      label: '제목',
      type: 'text',
      source: 'frontmatter',
      origin: 'preset',
    },
    {
      key: 'category',
      label: '카테고리',
      type: 'select',
      source: 'frontmatter',
      origin: 'preset',
      options: [
        { value: 'A', label: '카테A', color: 'blue' },
        { value: 'B', label: '카테B', color: 'orange' },
      ],
    },
  ]
  const pack = makePack(colorSchema)

  it('groupBy=select 컬럼 → 리스트 그룹 헤더에 color swatch 렌더', () => {
    const records: TableRecord[] = [
      makeRecord('r1', { title: '항목1', category: 'A' }),
      makeRecord('r2', { title: '항목2', category: 'B' }),
    ]
    const view = makeView({ type: 'list', groupBy: 'category' })

    render(<ListView records={records} pack={pack} view={view} />)

    expect(screen.getByText('카테A')).toBeDefined()
    expect(screen.getByText('카테B')).toBeDefined()
    const swatches = screen.getAllByTestId('group-color-swatch')
    expect(swatches.length).toBeGreaterThanOrEqual(2)
  })
})

// ── GroupPanel smoke ──────────────────────────────────────────────────────────

describe('GroupPanel smoke', () => {
  const onViewChange = vi.fn()
  const baseView = makeView({ type: 'gallery' })

  it('select/multi_select 컬럼 없음 → "컬럼이 없습니다" 안내', () => {
    const schema: PropertyDef[] = [
      { key: 'name', label: '이름', type: 'text', source: 'frontmatter', origin: 'preset' },
    ]

    render(<GroupPanel schema={schema} view={baseView} onViewChange={onViewChange} />)

    expect(screen.getByText('그룹 기준으로 사용할 수 있는 컬럼이 없습니다.')).toBeDefined()
  })

  it('select 컬럼 있음 → 그룹 없음 + 후보 렌더, 크래시 없음', () => {
    const schema: PropertyDef[] = [
      { key: 'name', label: '이름', type: 'text', source: 'frontmatter', origin: 'preset' },
      {
        key: 'status',
        label: '상태',
        type: 'select',
        source: 'frontmatter',
        origin: 'preset',
        options: [{ value: 'active', label: '활성' }],
      },
    ]

    render(<GroupPanel schema={schema} view={baseView} onViewChange={onViewChange} />)

    expect(screen.getByText('그룹 없음')).toBeDefined()
    expect(screen.getByText('상태')).toBeDefined()
  })
})
