// @vitest-environment jsdom
//
// @oobleck/collection — ChartView 렌더 테스트(차트 뷰 회귀 핀).
//
// 목적:
//   - groupBy 미설정 → 안내 상태(빈 차트 렌더 안 함).
//   - groupBy 설정 + 2개 이상 그룹의 레코드 → 그룹 수만큼 막대 + count 텍스트.
//
// 전략: @oobleck/systheme 배럴(motion·Tiptap 등 무거운 의존)을 vi.mock 경량 스텁으로 대체.
//   ChartView 는 @oobleck/systheme 에서 cn 만 쓴다 — 최소 스텁으로 충분.

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ── @oobleck/systheme 경량 스텁 ────────────────────────────────────────────────────────
// ChartView 는 cn 만 소비. 다른 심볼은 불필요.
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
    type: 'chart',
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
import { ChartView } from './ChartView'

afterEach(cleanup)

describe('ChartView', () => {
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

  it('groupBy 미설정 → 안내 상태 렌더(빈 차트 아님)', () => {
    const view = makeView({ type: 'chart' }) // groupBy 없음
    const records: TableRecord[] = [makeRecord('r1', { name: '알파', status: 'active' })]

    render(<ChartView records={records} pack={pack} view={view} />)

    expect(screen.getByText('그룹 기준을 선택하면 분포를 막대로 봅니다.')).toBeDefined()
    // 막대(listitem)는 없어야 한다.
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('groupBy 설정 + 2개 이상 그룹 → 그룹 수만큼 막대 + count 텍스트', () => {
    const records: TableRecord[] = [
      makeRecord('r1', { name: '알파', status: 'active' }),
      makeRecord('r2', { name: '베타', status: 'active' }),
      makeRecord('r3', { name: '감마', status: 'inactive' }),
    ]
    const view = makeView({ type: 'chart', groupBy: 'status' })

    render(<ChartView records={records} pack={pack} view={view} />)

    // 그룹 라벨(옵션 라벨) 렌더 확인.
    expect(screen.getByText('활성')).toBeDefined()
    expect(screen.getByText('비활성')).toBeDefined()
    // 막대(listitem)가 그룹 수(2)만큼 렌더돼야 한다.
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    // 색 스와치도 그룹 수만큼.
    expect(screen.getAllByTestId('chart-bar-swatch')).toHaveLength(2)
    // count 텍스트: 활성=2, 비활성=1.
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('1')).toBeDefined()
    // 클라 모드는 전량 — 모수 고지 없음.
    expect(screen.queryByText('이 페이지 기준 분포입니다.')).toBeNull()
  })

  describe('server 모드 — 한 페이지 분포임을 밝힌다', () => {
    const records: TableRecord[] = [
      makeRecord('r1', { name: '알파', status: 'active' }),
      makeRecord('r2', { name: '베타', status: 'inactive' }),
    ]

    it('전체 수가 페이지보다 크면 모수를 고지한다', () => {
      render(
        <ChartView
          records={records}
          pack={pack}
          view={makeView({ type: 'chart', groupBy: 'status' })}
          queryMode="server"
          totalCount={900}
        />,
      )

      expect(screen.getByText('이 페이지 기준 분포입니다.')).toBeDefined()
      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })

    it('한 페이지가 곧 전체면 고지하지 않는다', () => {
      render(
        <ChartView
          records={records}
          pack={pack}
          view={makeView({ type: 'chart', groupBy: 'status' })}
          queryMode="server"
          totalCount={2}
        />,
      )

      expect(screen.queryByText('이 페이지 기준 분포입니다.')).toBeNull()
    })

    it('서버가 이미 거른 행에 필터를 다시 걸지 않는다', () => {
      const view = makeView({
        type: 'chart',
        groupBy: 'status',
        filters: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'nonexistent' }] },
      })

      render(<ChartView records={records} pack={pack} view={view} queryMode="server" />)

      expect(screen.getAllByRole('listitem')).toHaveLength(2)
    })
  })
})
