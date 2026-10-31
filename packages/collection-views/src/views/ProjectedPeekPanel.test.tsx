// @vitest-environment jsdom
//
// @oobleck/collection — ProjectedPeekPanel(투영 소스 사이드보기, 공유 L1 프리미티브) 계약 핀.
//
// 이 컴포넌트는 워크스페이스 PeekPanel(projected 분기 위임)과 백오피스 AI 추론 드릴다운이 **공유**하는
// projected-peek 쉘이다(국소 재구현 금지 — 층위 분리로 백오피스는 워크스페이스 PeekPanel 을 import 못 함).
// 검증:
//   - target.doc 를 fetch 없이 RecordDocumentView 로 정적 렌더(전달 doc = 유일 진실, 네트워크 무의존).
//   - 문서 안 button(onAction)이 패널 안에서 작동(호스트 위임).
//   - 사이드/모달 모드 토글은 있고, "전체 페이지로 열기"(full)는 없다(projected 는 라우트 없음).
//   - Esc → onClose. target=null → 아무것도 렌더하지 않는다.
//
// 전략: @oobleck/systheme 배럴을 경량 스텁으로 대체(button-cell.test 동형) — 프리미티브 로직 실행이 핵심.

import React from 'react'
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@oobleck/systheme', () => {
  const Icon = ({ size }: { size?: number }) =>
    React.createElement('span', { 'data-icon': String(size ?? '') })
  return {
    cn: (...xs: unknown[]) => xs.filter(Boolean).join(' '),
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children?: React.ReactNode
      onClick?: () => void
      disabled?: boolean
    }) => React.createElement('button', { type: 'button', onClick, disabled }, children),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    PanelRight: Icon,
    Monitor: Icon,
    X: Icon,
  }
})

import { ProjectedPeekPanel } from './ProjectedPeekPanel'
import type { BlockDocument } from '@oobleck/collection'

const doc: BlockDocument = {
  properties: {
    title: '구독 팩',
    상태: '미설치',
    toggle: { action: 'toggle-install', label: '설치', variant: 'primary' },
  },
  body: [{ type: 'paragraph', content: [{ type: 'text', text: '구독 팩 설명' }] }],
  locked: true,
}

beforeEach(() => {
  try {
    localStorage.clear() // 기본 side 모드로 시작(열기 모드 기억 초기화).
  } catch {
    /* jsdom localStorage 항상 존재 */
  }
})
afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

describe('ProjectedPeekPanel — 투영 소스 사이드보기(공유 L1)', () => {
  it('target=null 이면 아무것도 렌더하지 않는다', () => {
    render(<ProjectedPeekPanel target={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('전달 doc 를 fetch 없이 RecordDocumentView 로 렌더한다', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<ProjectedPeekPanel target={{ doc, title: '구독 팩' }} onClose={vi.fn()} />)
    // 네트워크 호출 없음(투영 소스 = 노드 아님 — 이 프리미티브가 존재하는 이유).
    expect(fetchMock).not.toHaveBeenCalled()
    // doc.body 문단이 렌더된다(정적 문서 렌더 경로 도달).
    expect(screen.getByText('구독 팩 설명')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('문서 안 button(onAction)이 패널 안에서 작동한다', () => {
    const onAction = vi.fn()
    render(<ProjectedPeekPanel target={{ doc, onAction, title: '구독 팩' }} onClose={vi.fn()} />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '설치' }))
    })
    expect(onAction).toHaveBeenCalledWith('toggle-install')
  })

  it('사이드/모달 토글은 있고 "전체 페이지로 열기"는 없다(projected=라우트 없음)', () => {
    render(<ProjectedPeekPanel target={{ doc, title: '구독 팩' }} onClose={vi.fn()} />)
    expect(screen.getByLabelText('사이드 패널로 열기')).toBeTruthy()
    expect(screen.getByLabelText('모달(중앙)로 열기')).toBeTruthy()
    expect(screen.queryByLabelText('전체 페이지로 열기')).toBeNull()
  })

  it('Esc 로 닫힌다(onClose 호출)', () => {
    const onClose = vi.fn()
    render(<ProjectedPeekPanel target={{ doc, title: '구독 팩' }} onClose={onClose} />)
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('스크림 클릭으로 닫힌다(onClose 호출)', () => {
    const onClose = vi.fn()
    render(<ProjectedPeekPanel target={{ doc }} onClose={onClose} />)
    // 스크림 = 닫기 aria-label 버튼(2개 중 첫 번째 = 오버레이). 헤더의 X 도 같은 라벨이라 전부 닫기.
    const closers = screen.getAllByLabelText('닫기')
    act(() => {
      fireEvent.click(closers[0])
    })
    expect(onClose).toHaveBeenCalled()
  })
})
