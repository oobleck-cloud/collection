// @vitest-environment jsdom
//
// @oobleck/collection — FeedView 렌더 테스트(#33).
//
// 목적: 피드 뷰의 렌더 사각지대를 닫는 회귀 핀.
//   - 레코드 0개 → 빈 상태 텍스트.
//   - N개 → N개 카드가 최신순(첫 date 속성 desc)으로 렌더(view.sort 빈 경우의 폴백 경로).
//
// 전략(views.test.tsx 동형): @oobleck/systheme 배럴을 경량 스텁으로 대체 — 컴포넌트 자체 로직·훅 실행이 핵심.
//   FeedView → RecordCard → PropertyChip 경로가 쓰는 아이콘/유틸만 스텁한다.

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ── @oobleck/systheme 경량 스텁 ────────────────────────────────────────────────────────
// record-card.tsx 가 ArrowLeftRight/Badge/CalendarDays/Hash/Link2/List/Mail/Map/Phone/SquareCheck/Tags/Type/cn 사용.
// FeedView 가 Plus 사용. 모두 최소 스텁으로 대체.
vi.mock('@oobleck/systheme', () => {
  const makeIcon =
    (id: string) =>
    ({ className }: { className?: string; 'aria-hidden'?: boolean }) =>
      React.createElement('svg', { 'data-testid': `icon-${id}`, className })

  const Badge = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children)

  const Tag = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children)

  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')

  return {
    Plus: makeIcon('plus'),
    CalendarDays: makeIcon('calendar'),
    List: makeIcon('list'),
    ArrowLeftRight: makeIcon('arrow-lr'),
    Hash: makeIcon('hash'),
    LayoutDashboard: makeIcon('layout-dashboard'),
    Link2: makeIcon('link2'),
    SquareCheck: makeIcon('square-check'),
    Tags: makeIcon('tags'),
    Type: makeIcon('type'),
    User: makeIcon('user'),
    Users: makeIcon('users'),
    Mail: makeIcon('mail'),
    Map: makeIcon('map'),
    Phone: makeIcon('phone'),
    Badge,
    Tag,
    cn,
  }
})

// ── 인라인 mock BlockPack ────────────────────────────────────────────────────
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

/** 최소 ViewConfig 생성 헬퍼(type='feed' 기본). */
function makeView(partial: Partial<ViewConfig>): ViewConfig {
  return {
    type: 'feed',
    filters: { op: 'and', children: [] },
    sort: [],
    ...partial,
  }
}

/** 테스트 레코드 생성 헬퍼. */
function makeRecord(id: string, props: Record<string, PropertyValue>): TableRecord {
  return { id, doc: { properties: props } }
}

// ── 지연 import (vi.mock 이후 실제 모듈 로드) ────────────────────────────────
import { FeedView } from './FeedView'

afterEach(cleanup)

describe('FeedView', () => {
  const schema: PropertyDef[] = [
    { key: 'name', label: '제목', type: 'text', source: 'frontmatter', origin: 'preset' },
    { key: 'published', label: '게시일', type: 'date', source: 'frontmatter', origin: 'preset' },
  ]
  const pack = makePack(schema)

  it('레코드 0개 → 빈 상태 텍스트 렌더, 크래시 없음', () => {
    render(<FeedView records={[]} pack={pack} view={makeView({})} />)
    expect(screen.getByText('레코드가 없습니다.')).toBeDefined()
  })

  it('N개 레코드 → N개 카드가 최신순(첫 date 속성 desc)으로 렌더', () => {
    const records: TableRecord[] = [
      makeRecord('r-old', { name: '오래된 글', published: '2026-01-01' }),
      makeRecord('r-new', { name: '최신 글', published: '2026-06-20' }),
      makeRecord('r-mid', { name: '중간 글', published: '2026-03-15' }),
    ]

    render(<FeedView records={records} pack={pack} view={makeView({})} />)

    // 제목 3개가 모두 보이고(=카드 3개), 최신순(최신 글 → 중간 글 → 오래된 글)으로 정렬됐는지 확인.
    const titles = screen.getAllByText(/글$/).map((el) => el.textContent)
    expect(titles).toEqual(['최신 글', '중간 글', '오래된 글'])
  })

  it('view.sort 가 명시되면 폴백 대신 그 정렬을 존중(제목 오름차순)', () => {
    const records: TableRecord[] = [
      makeRecord('r-b', { name: 'B 글', published: '2026-06-20' }),
      makeRecord('r-a', { name: 'A 글', published: '2026-01-01' }),
    ]
    const view = makeView({ sort: [{ key: 'name', dir: 'asc' }] })

    render(<FeedView records={records} pack={pack} view={view} />)

    // name asc → 'A 글' 이 먼저. (date 폴백이었다면 최신인 'B 글' 이 먼저였을 것.)
    const titles = screen.getAllByText(/글$/).map((el) => el.textContent)
    expect(titles).toEqual(['A 글', 'B 글'])
  })
})
