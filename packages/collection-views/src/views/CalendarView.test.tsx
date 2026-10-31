// @vitest-environment jsdom
//
// @oobleck/collection — CalendarView 렌더 테스트(#34).
//
// 목적: 캘린더 surface 의 렌더 사각지대를 닫는 회귀 핀.
//   (a) date 속성 없음 → 안내 상태.
//   (b) date 속성 + 표시 월 내 날짜를 가진 레코드 → 그 제목이 그리드에 노출.
//
// 전략(views.test.tsx 와 동일): @oobleck/systheme 배럴(motion·Tiptap 등 무거운 의존)을 vi.mock 경량
//   스텁으로 대체. 대상 컴포넌트의 *자체 로직·훅* 실행이 핵심.

import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ── @oobleck/systheme 경량 스텁 ────────────────────────────────────────────────────────
// CalendarView 가 CalendarDays/ChevronLeft/ChevronRight/cn 사용.
vi.mock('@oobleck/systheme', () => {
  const makeIcon =
    (id: string) =>
    ({ className }: { className?: string; 'aria-hidden'?: boolean }) =>
      React.createElement('svg', { 'data-testid': `icon-${id}`, className })

  const CalendarDays = makeIcon('calendar')
  const ChevronLeft = makeIcon('chevron-left')
  const ChevronRight = makeIcon('chevron-right')
  const cn = (...args: unknown[]) => args.filter(Boolean).join(' ')

  return { CalendarDays, ChevronLeft, ChevronRight, cn }
})

// ── 인라인 mock BlockPack ─────────────────────────────────────────────────────
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

/** 최소 ViewConfig 생성 헬퍼(type='calendar'). */
function makeView(partial: Partial<ViewConfig>): ViewConfig {
  return {
    type: 'calendar',
    filters: { op: 'and', children: [] },
    sort: [],
    ...partial,
  }
}

/** 테스트 레코드 생성 헬퍼. */
function makeRecord(id: string, props: Record<string, PropertyValue>): TableRecord {
  return { id, doc: { properties: props } }
}

// vi.mock 이후에 실제 모듈 로드(정적 import — vi.mock 이 먼저 등록됨).
import { CalendarView } from './CalendarView'

afterEach(cleanup)

describe('CalendarView', () => {
  it('date 속성이 없으면 → "캘린더로 보려면 날짜 속성이 필요합니다" 안내', () => {
    const pack = makePack([
      { key: 'title', label: '제목', type: 'text', source: 'frontmatter', origin: 'preset' },
    ])
    const view = makeView({})

    render(<CalendarView records={[]} pack={pack} view={view} />)

    expect(screen.getByText('캘린더로 보려면 날짜 속성이 필요합니다')).toBeDefined()
  })

  it('date 속성 + 표시 월(현재 월) 내 날짜를 가진 레코드 → 제목이 그리드에 노출', () => {
    const schema: PropertyDef[] = [
      { key: 'title', label: '제목', type: 'text', source: 'frontmatter', origin: 'preset' },
      { key: 'due', label: '마감일', type: 'date', source: 'frontmatter', origin: 'preset' },
    ]
    const pack = makePack(schema)

    // 초기 표시 월 = 현재 월(UTC). 실행 날짜와 무관하게 "현재 월의 15일" ISO 값을 만든다.
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const inMonthIso = `${y}-${m}-15`

    const records: TableRecord[] = [makeRecord('r1', { title: '청구 마감', due: inMonthIso })]
    const view = makeView({})

    render(<CalendarView records={records} pack={pack} view={view} />)

    // 제목 칩이 그리드 안에 노출되어야 한다(클릭 = onOpen, 여기선 존재만 확인).
    expect(screen.getByText('청구 마감')).toBeDefined()
  })

  // 회귀 핀(#45 리뷰): 빈 제목 폴백은 형제 뷰(ListView·RecordCard)와 동일한 '제목 없음'(괄호 없음).
  it('제목이 빈 문자열이면 → 형제 뷰와 동일한 "제목 없음"(괄호 없음) 으로 폴백', () => {
    const schema: PropertyDef[] = [
      { key: 'title', label: '제목', type: 'text', source: 'frontmatter', origin: 'preset' },
      { key: 'due', label: '마감일', type: 'date', source: 'frontmatter', origin: 'preset' },
    ]
    const pack = makePack(schema)
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const inMonthIso = `${y}-${m}-15`

    const records: TableRecord[] = [makeRecord('r1', { title: '', due: inMonthIso })]
    render(<CalendarView records={records} pack={pack} view={makeView({})} />)

    expect(screen.getByText('제목 없음')).toBeDefined()
    // 이전의 괄호형 '(제목 없음)' 은 더 이상 렌더되지 않는다.
    expect(screen.queryByText('(제목 없음)')).toBeNull()
  })

  // 기간(종료일) 값 → 시작~종료에 걸친 가로 막대(gridColumn 스팬)로 렌더.
  it('기간 값(start/end) → 제목 막대가 그리드 열을 걸쳐 배치(gridColumn 스팬)', () => {
    const schema: PropertyDef[] = [
      { key: 'title', label: '제목', type: 'text', source: 'frontmatter', origin: 'preset' },
      { key: 'due', label: '기간', type: 'date', source: 'frontmatter', origin: 'preset' },
    ]
    const pack = makePack(schema)
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    // 현재 월 10~12일(월 경계에 안 걸리는 안전한 중순 범위).
    const range = `${y}-${m}-10/${y}-${m}-12`

    const records: TableRecord[] = [makeRecord('r1', { title: '워크샵', due: range })]
    render(<CalendarView records={records} pack={pack} view={makeView({})} />)

    const bars = screen.getAllByRole('button', { name: '워크샵' })
    expect(bars.length).toBeGreaterThanOrEqual(1)
    // 막대는 인라인 gridColumn 스팬으로 배치된다("start / end").
    expect(bars[0].style.gridColumn).toMatch(/\d+\s*\/\s*\d+/)
  })

  // geo 제목도 formatTitleText 경유로 라벨 렌더(["object Object"] 누수 없음).
  it('제목이 geo 값이면 → 도로명주소 라벨이 칩에 노출(객체 누수 없음)', () => {
    const schema: PropertyDef[] = [
      { key: 'title', label: '제목', type: 'geo', source: 'frontmatter', origin: 'preset' },
      { key: 'due', label: '마감일', type: 'date', source: 'frontmatter', origin: 'preset' },
    ]
    const pack = makePack(schema)
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    const inMonthIso = `${y}-${m}-15`

    const geo: PropertyValue = {
      coordinate: { x: 126.978, y: 37.5665, type: 'WGS84' },
      roadAddress: '서울특별시 중구 세종대로 110',
    }
    const records: TableRecord[] = [makeRecord('r1', { title: geo, due: inMonthIso })]
    const { container } = render(<CalendarView records={records} pack={pack} view={makeView({})} />)

    expect(screen.getByText('서울특별시 중구 세종대로 110')).toBeDefined()
    expect(container.textContent).not.toContain('[object Object]')
  })
})
