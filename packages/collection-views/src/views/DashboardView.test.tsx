// @vitest-environment jsdom
//
// @oobleck/collection — DashboardView 렌더 테스트(대시보드 뷰 회귀 핀, #37).
//
// 목적:
//   - 레코드 0개 → 안내 상태("레코드가 없습니다.") — 카드 렌더 안 함.
//   - 레코드 + select 프로퍼티 → 총 레코드 수 텍스트 + 분포 막대(최소 1개).
//
// 전략: @oobleck/systheme 배럴(motion·Tiptap 등 무거운 의존)을 vi.mock 경량 스텁으로 대체.
//   DashboardView 는 @oobleck/systheme 에서 cn 만 쓴다 — 최소 스텁으로 충분(아이콘 미사용).

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ── @oobleck/systheme 경량 스텁 ────────────────────────────────────────────────────────
// DashboardView 는 cn 만 소비. 다른 심볼은 불필요.
vi.mock('@oobleck/systheme', () => {
  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')
  return { cn }
})

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
    type: 'dashboard',
    filters: { op: 'and', children: [] },
    sort: [],
    ...partial,
  }
}

/** 테스트 레코드 생성 헬퍼. */
function makeRecord(id: string, props: Record<string, PropertyValue>): TableRecord {
  return { id, doc: { properties: props } }
}

// vi.mock 등록 후 실제 컴포넌트 로드.
import { DashboardView } from './DashboardView'

afterEach(cleanup)

describe('DashboardView', () => {
  const schema: PropertyDef[] = [
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
  const pack = makePack(schema)

  it('레코드 0개 → 안내 상태 렌더(카드 아님)', () => {
    const view = makeView({})
    render(<DashboardView records={[]} pack={pack} view={view} />)

    expect(screen.getByText('레코드가 없습니다.')).toBeDefined()
    // 분포 막대(listitem)는 없어야 한다.
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('레코드 + select 프로퍼티 → 총 레코드 수 텍스트 + 분포 막대(최소 1개)', () => {
    const records: TableRecord[] = [
      makeRecord('r1', { name: '알파', status: 'active' }),
      makeRecord('r2', { name: '베타', status: 'active' }),
      makeRecord('r3', { name: '감마', status: 'inactive' }),
    ]
    const view = makeView({})

    render(<DashboardView records={records} pack={pack} view={view} />)

    // Total 카드 — 총 레코드 수(3)와 라벨.
    expect(screen.getByText('총 레코드')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
    // 분포 카드 제목(프로퍼티 라벨)과 옵션 라벨.
    expect(screen.getByText('상태')).toBeDefined()
    expect(screen.getByText('활성')).toBeDefined()
    expect(screen.getByText('비활성')).toBeDefined()
    // 분포 막대(listitem)가 최소 1개 — status 값 2종(활성·비활성).
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(1)
    // 색 스와치도 막대 수만큼.
    expect(screen.getAllByTestId('dashboard-bar-swatch').length).toBeGreaterThanOrEqual(1)
    // 클라 모드는 전량을 들고 있다 — 모수 고지가 붙지 않는다.
    expect(screen.queryByText('분포는 이 페이지 기준입니다.')).toBeNull()
  })

  // 서버가 페이지를 잘라 보내는 목록(주문·고객)에서 이 뷰가 전체인 척하던 자리.
  describe('server 모드 — 모수를 밝힌다', () => {
    const records: TableRecord[] = [
      makeRecord('r1', { name: '알파', status: 'active' }),
      makeRecord('r2', { name: '베타', status: 'inactive' }),
    ]

    it('totalCount 를 받으면 Total 은 전체 수로 답한다(페이지 수가 아니라)', () => {
      render(
        <DashboardView
          records={records}
          pack={pack}
          view={makeView({})}
          queryMode="server"
          totalCount={900}
        />,
      )

      expect(screen.getByText('900')).toBeDefined()
      expect(screen.queryByText('2')).toBeNull()
      // 분포는 여전히 이 페이지만 센 것 — 고지가 붙는다.
      expect(screen.getByText('분포는 이 페이지 기준입니다.')).toBeDefined()
    })

    it('totalCount 가 없으면 Total 에도 "(이 페이지)" 를 붙인다', () => {
      render(<DashboardView records={records} pack={pack} view={makeView({})} queryMode="server" />)

      expect(screen.getByText('2')).toBeDefined()
      expect(screen.getByText('(이 페이지)')).toBeDefined()
    })

    it('서버가 이미 거른 행에 필터를 다시 걸지 않는다', () => {
      // 클라 semantics 로는 한 건도 통과 못 하는 조건 — 서버가 고른 행이 사라지면 안 된다.
      const view = makeView({
        filters: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'nonexistent' }] },
      })

      render(
        <DashboardView
          records={records}
          pack={pack}
          view={view}
          queryMode="server"
          totalCount={2}
        />,
      )

      expect(screen.getByText('2')).toBeDefined()
      expect(screen.queryByText('레코드가 없습니다.')).toBeNull()
    })
  })
})
