// @vitest-environment jsdom
//
// @oobleck/collection — RecordDocumentView 의 property 색 칩(#312) 렌더 핀.
//
// 배경: RecordDocumentView 는 팩-무관 정적 렌더라 스키마를 받지 않아 select 옵션 색을 스스로 못 구한다.
// 색을 아는 doc 빌더(toPackDetailDoc·toAiInferenceDetailDoc·endpointDetailRecord)가 값에 색을 실어(TagValue)
// 넘기면, RecordDocumentView 는 스키마 없이 그 색만 읽어 DS Tag 칩으로 렌더한다(팩-무관 계약 유지).
//
// 회귀 대상: (1) 색 힌트 있는 property(TagValue) -> 지정색 칩, (2) 색 없는 TagValue -> 라벨 해시색 폴백,
//   (3) 색 힌트 없는 일반 문자열 property -> 색 칩 없이 텍스트(기존 동작 불변),
//   (4) isTagValue 판별(ButtonValue·GeoValue·배열·스칼라와 구분).
//
// 전략: @oobleck/systheme 배럴 경량 스텁(readonly-color-cell.test 동형) — Tag 만 color 를 data-color 로 노출해
// 어떤 색이 결정됐는지 검증 가능하게 한다.

import React from 'react'
import { render, screen, cleanup, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@oobleck/systheme', () => {
  const passthrough =
    (tag: string) =>
    ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => {
      void rest
      return React.createElement(tag, null, children)
    }

  // Tag 만 color 를 노출(검증 대상). Text/Button 은 자식만 렌더하는 중립 스텁.
  const Tag = ({ children, color }: { children?: React.ReactNode; color?: string }) =>
    React.createElement('span', { 'data-testid': 'tag', 'data-color': color }, children)

  const Text = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children)
  const Button = passthrough('button')

  return {
    Tag,
    Text,
    Button,
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  }
})

import type { BlockDocument } from '@oobleck/collection'
import { isTagValue } from '@oobleck/collection'
import { RecordDocumentView } from './RecordDocumentView'

afterEach(cleanup)

function renderDoc(properties: BlockDocument['properties']) {
  return render(<RecordDocumentView doc={{ properties, locked: true }} />)
}

describe('isTagValue', () => {
  it('tag 문자열을 가진 객체만 참', () => {
    expect(isTagValue({ tag: '구독' })).toBe(true)
    expect(isTagValue({ tag: '구독', color: 'blue' })).toBe(true)
  })

  it('스칼라·배열·ButtonValue·GeoValue 형태는 거짓', () => {
    expect(isTagValue(null)).toBe(false)
    expect(isTagValue('구독')).toBe(false)
    expect(isTagValue(['a', 'b'])).toBe(false)
    expect(isTagValue({ action: 'restore', label: '복원' })).toBe(false) // ButtonValue
    expect(isTagValue({ coordinate: { x: 1, y: 2, type: 'WGS84' }, roadAddress: '서울' })).toBe(
      false,
    ) // GeoValue
    expect(isTagValue({ color: 'blue' })).toBe(false) // tag 누락
  })
})

describe('RecordDocumentView — property 색 칩(TagValue)', () => {
  it('색 힌트가 있는 TagValue -> 지정색 Tag 칩 + 라벨 표시', () => {
    renderDoc({ 도메인: { tag: '구독', color: 'blue' } })
    const chip = screen.getByText('구독')
    expect(chip.getAttribute('data-testid')).toBe('tag')
    expect(chip.getAttribute('data-color')).toBe('blue')
  })

  it('색이 없는 TagValue -> 라벨 해시색으로 폴백(팔레트 7색 중 하나, 회색 고정 아님)', () => {
    renderDoc({ 결과: { tag: 'anything' } })
    const chip = screen.getByText('anything')
    expect(chip.getAttribute('data-testid')).toBe('tag')
    const color = chip.getAttribute('data-color')
    expect(['gray', 'blue', 'green', 'orange', 'red', 'purple', 'teal']).toContain(color)
  })

  it('색 힌트 없는 일반 문자열 property -> 색 칩 없이 텍스트(기존 동작 불변)', () => {
    const { container } = renderDoc({ 영역: 'subscription' })
    expect(screen.getByText('subscription')).toBeTruthy()
    expect(within(container).queryByTestId('tag')).toBeNull()
  })

  it('title 은 색 칩 대상이 아니다(제목으로 뽑히고 속성 목록/칩에서 빠짐)', () => {
    const { container } = renderDoc({ title: '문서 A', 상태: { tag: '설치됨', color: 'green' } })
    const chips = within(container).queryAllByTestId('tag')
    expect(chips).toHaveLength(1)
    expect(chips[0]?.getAttribute('data-color')).toBe('green')
  })
})
