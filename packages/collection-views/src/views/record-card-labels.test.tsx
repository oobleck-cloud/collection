// @vitest-environment jsdom
//
// @oobleck/collection — 카드 속성 이름표(뷰 cardPropLabels) 핀.
//
// 교육 현황 「진행별」 보드 시안: 「0 / 7 · 010-2384-1192」 한 줄 + 「최근 학습 2026-10-21」(없으면 「가입 …」).
// 아이콘 칩 한 줄로는 어느 날짜가 가입이고 어느 것이 최근 학습인지 읽히지 않았다.

import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// design-system 배럴 경량 스텁(phone-cell.test 와 같은 전략) — 서식 함수만 실물.
vi.mock('@oobleck/systheme', async () => {
  const { formatPhoneNumber } = await vi.importActual<{
    formatPhoneNumber: (v: string | null | undefined) => string
  }>('../../node_modules/@oobleck/systheme/src/utils/koreanPhoneNumber')
  const icon =
    (id: string) =>
    ({ className }: { className?: string }) =>
      React.createElement('svg', { 'data-testid': `icon-${id}`, className })
  const names = [
    'ArrowLeftRight',
    'CalendarDays',
    'Hash',
    'LayoutDashboard',
    'Link2',
    'List',
    'Mail',
    'Phone',
  ]
  return {
    ...Object.fromEntries(
      [
        ...names,
        'SquareCheck',
        'Tag',
        'Tags',
        'Type',
        'User',
        'Users',
        'MoreHorizontal',
        'Trash2',
      ].map((n) => [n, icon(n.toLowerCase())]),
    ),
    Map: icon('map'),
    Tag: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', { 'data-testid': 'tag' }, children),
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
    formatPhoneNumber,
  }
})
vi.mock('./row-action-menu', () => ({ RowActionMenu: () => null }))
vi.mock('./PersonCell', () => ({ PersonValue: () => null }))

import { RecordCard, cardBadgeOf, cardDisplayProps, propertyText } from './record-card'

import type { PropertyDef } from '@oobleck/collection'

afterEach(cleanup)

const def = (
  d: Partial<PropertyDef> & Pick<PropertyDef, 'key' | 'label' | 'type'>,
): PropertyDef => ({
  source: 'projection',
  origin: 'preset',
  ...d,
})

const SCHEMA: PropertyDef[] = [
  def({ key: 'name', label: '이름', type: 'text' }),
  def({ key: 'progress', label: '이수', type: 'text', cardLabel: '' }),
  def({ key: 'phone', label: '연락처', type: 'phone', cardLabel: '' }),
  def({
    key: 'last',
    label: '최근 학습일',
    type: 'date',
    dateFormat: 'iso',
    cardLabel: '최근 학습',
    cardFallbackKey: 'joined',
  }),
  def({ key: 'joined', label: '가입일', type: 'date', dateFormat: 'iso', cardLabel: '가입' }),
]
const SHOWN = SCHEMA.slice(1, 4)

function renderCard(props: Record<string, string | null>, labels = true) {
  return render(
    <RecordCard
      cover={null}
      title="김민준"
      displayProps={cardDisplayProps(SHOWN, props, SCHEMA, {})}
      labels={labels}
    />,
  )
}

describe('RecordCard — 속성 이름표(cardPropLabels)', () => {
  it('빈 이름표 속성은 한 줄에 「 · 」로, 이름표 속성은 제 줄에 「이름표 값」', () => {
    renderCard({
      progress: '2 / 7',
      phone: '01077104421',
      last: '2026-10-21',
      joined: '2026-10-19',
    })
    const meta = screen.getByTitle('2 / 7 · 010-7710-4421')
    expect(meta.textContent).toBe('2 / 7·010-7710-4421')
    expect(screen.getByTitle('최근 학습 2026-10-21').textContent).toBe('최근 학습2026-10-21')
    // 아이콘 칩이 아니다
    expect(document.querySelector('svg')).toBeNull()
    // 대신 보일 속성은 원래 속성이 있으면 나오지 않는다
    expect(screen.queryByText('가입')).toBeNull()
  })

  it('최근 학습이 비면 가입(대신 보일 속성)을 자기 이름표로', () => {
    renderCard({ progress: '0 / 7', phone: '01023841192', last: null, joined: '2026-10-21' })
    expect(screen.getByTitle('가입 2026-10-21')).toBeTruthy()
    expect(screen.queryByText('최근 학습')).toBeNull()
  })

  it('둘 다 비면 그 줄을 그리지 않는다', () => {
    renderCard({ progress: '0 / 7', phone: '01023841192', last: null, joined: null })
    expect(screen.queryByText('가입')).toBeNull()
    expect(screen.queryByText('최근 학습')).toBeNull()
  })

  it('이름표를 끄면(기본) 예전처럼 아이콘 칩 한 줄', () => {
    renderCard({ progress: '2 / 7', phone: '01077104421', last: '2026-10-21', joined: null }, false)
    expect(document.querySelectorAll('svg').length).toBeGreaterThan(0)
    expect(screen.queryByText('최근 학습')).toBeNull()
    expect(screen.getByText('2026-10-21')).toBeTruthy()
  })

  it('cardLabel 이 없으면 컬럼 라벨을 이름표로 쓴다', () => {
    const plain = def({ key: 'joined', label: '가입일', type: 'date', dateFormat: 'iso' })
    render(
      <RecordCard
        cover={null}
        title="x"
        displayProps={[{ def: plain, value: '2026-10-21' }]}
        labels
      />,
    )
    expect(screen.getByTitle('가입일 2026-10-21')).toBeTruthy()
  })
})

describe('propertyText', () => {
  it('칩으로만 그리는 타입은 null, 날짜는 컬럼 dateFormat, 전화는 하이픈', () => {
    expect(propertyText(def({ key: 's', label: 's', type: 'select' }), 'a')).toBeNull()
    expect(propertyText(SCHEMA[4]!, '2026-10-21')).toBe('2026-10-21')
    expect(propertyText(SCHEMA[2]!, '01023841192')).toBe('010-2384-1192')
    expect(propertyText(SCHEMA[1]!, null)).toBe('')
  })
})

describe('카드 배지(cardLayout.badgeKey) — 상대 날짜는 임박하면 주의 색', () => {
  const due: PropertyDef = {
    key: 'due',
    label: '조율 기한',
    type: 'date',
    source: 'projection',
    origin: 'preset',
    dateFormat: 'relative',
  }
  const now = new Date(2026, 9, 29, 10)

  it('오늘 · 내일 · 지남은 warning, 이틀 이상 남으면 무채색', () => {
    expect(cardBadgeOf(due, '2026-10-30', undefined, now)).toEqual({ text: 'D-1', tone: 'warning' })
    expect(cardBadgeOf(due, '2026-10-29', undefined, now)).toEqual({
      text: 'D-day',
      tone: 'warning',
    })
    expect(cardBadgeOf(due, '2026-10-28', undefined, now)).toEqual({ text: 'D+1', tone: 'warning' })
    expect(cardBadgeOf(due, '2026-11-01', undefined, now)).toEqual({ text: 'D-3' })
  })

  it('조건부 서식의 색이 먼저, 빈 값은 배지 없음', () => {
    expect(cardBadgeOf(due, '2026-11-01', { tone: 'danger' }, now)).toEqual({
      text: 'D-3',
      tone: 'danger',
    })
    expect(cardBadgeOf(due, null, undefined, now)).toBeNull()
  })
})
