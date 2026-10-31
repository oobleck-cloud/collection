'use client'

// @oobleck/collection — projected(투영) 소스 사이드보기 패널(공유 기질, L1).
//
// 배경: "시스템/운영 표면 = 문서시스템(substrate 투영)" 원칙에서, 워크스페이스 노드가 아닌 데이터
// (마켓플레이스 팩·백오피스 AI 추론 로그·문맥 타임라인 등)를 미리 투영한 BlockDocument 로 만들어
// 컬렉션 네이티브 행-열기(사이드보기)로 여는 표면이 셋 이상 생겼다. 이 셋이 각자 사이드패널을 재구현하면
// 국소 중복이라, 그 **projected-peek 쉘**(포털 + 스크림 + Esc + 사이드/모달 토글 + RecordDocumentView)을
// 여기(collections)로 내려 공유한다:
//   · 워크스페이스 PeekPanel(components/workspace) — projected 분기가 이 컴포넌트에 위임한다(node fetch
//     경로는 워크스페이스에 그대로 — 이 컴포넌트는 fetch 를 모른다).
//   · 백오피스 AI 추론 드릴다운(components/backoffice) — 층위 분리(D-17: backoffice ↛ workspace)로
//     워크스페이스 PeekPanel 을 import 할 수 없어, 같은 L1 기질(collections)을 직접 쓴다.
// 규칙을 완화하는 대신 공유 기질을 아래로 내린다 — "공유는 L1 기질뿐"이라는 원칙 그대로(RecordDocumentView
// 하강과 동형). 이 컴포넌트는 next-intl·next/navigation·motion 무의존(collections 계약) — 애니메이션은
// CSS 트랜지션, 문구는 co-located vocab i18n(useCollectionLocale).

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PanelRight, Monitor, X, cn } from '@oobleck/systheme'
import type { BlockDocument } from '@oobleck/collection'
import { useCollectionLocale } from '../i18n'
import { RecordDocumentView } from './RecordDocumentView'
import { projectedPeekCopy } from './ProjectedPeekPanel.messages'

/** 투영 소스 사이드보기 대상 — fetch 없이 전달 doc 를 정적 렌더. onAction=문서 안 button 클릭 위임(선택). */
export type ProjectedPeekTarget = {
  doc: BlockDocument
  /** 드로어 헤더 제목(맥락, 선택). */
  title?: string
  /** 문서 안 button(#289, 설치/해제 등) 클릭을 호스트로 위임(선택). 미지정이면 button 은 비활성 렌더. */
  onAction?: (action: string) => void
}

/** 열리는 방식. side=우측 사이드 패널, center=중앙 모달. projected 는 라우트가 없어 full(풀페이지) 없음. */
type PeekMode = 'side' | 'center'

const PEEK_MODE_KEY = 'montize:peek-mode'

function isPeekMode(v: unknown): v is PeekMode {
  return v === 'side' || v === 'center'
}

/**
 * 마지막으로 고른 열기 방식을 기억(노션식). 기본 side. SSR 안전(마운트 후 읽기). 워크스페이스 PeekPanel 과
 * 같은 키(montize:peek-mode)를 공유해 사이드/모달 선호가 표면 간 일관된다('full' 저장값은 side 로 폴백).
 */
function usePeekMode(): [PeekMode, (m: PeekMode) => void] {
  const [mode, setMode] = useState<PeekMode>('side')
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PEEK_MODE_KEY)
      if (isPeekMode(saved)) setMode(saved)
    } catch {
      // localStorage 접근 불가(프라이버시 모드 등) — 기본값 유지.
    }
  }, [])
  const choose = useCallback((m: PeekMode) => {
    setMode(m)
    try {
      localStorage.setItem(PEEK_MODE_KEY, m)
    } catch {
      // 영속 실패는 무시(이번 세션엔 적용됨).
    }
  }, [])
  return [mode, choose]
}

/**
 * ProjectedPeekPanel — 투영 doc 를 컬렉션 네이티브 사이드보기로 여는 공유 쉘. target=null 이면 닫힘.
 * fetch 하지 않는다(전달 doc 를 RecordDocumentView 로 정적 렌더). 소비처: 워크스페이스 PeekPanel(projected
 * 분기 위임)·백오피스 AI 추론 드릴다운. onClose 는 닫기(스크림 클릭·Esc·X 버튼 공통).
 */
export function ProjectedPeekPanel({
  target,
  onClose,
}: {
  target: ProjectedPeekTarget | null
  onClose: () => void
}) {
  const c = projectedPeekCopy(useCollectionLocale())
  const [mode, setMode] = usePeekMode()
  const [mounted, setMounted] = useState(false)
  const open = target != null

  useEffect(() => setMounted(true), [])

  // 중앙 모달일 때만 본문 스크롤 잠금(집중). 사이드는 노션처럼 뒤 목록 스크롤을 허용한다.
  useEffect(() => {
    if (!open || mode !== 'center') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, mode])

  // Esc 닫기(공통). 오버레이 클릭 닫기는 스크림 버튼이 담당.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted || !open) return null

  return createPortal(
    <div
      data-slot="projected-peek-root"
      className={cn(
        'fixed inset-0 z-50 flex',
        mode === 'center' ? 'items-center justify-center p-4 sm:p-6' : 'justify-end',
      )}
      role="presentation"
    >
      {/* 스크림 — 사이드는 얕은 딤(블러 없음, 목록이 보임), 중앙 모달은 표준 딤+블러. 클릭 시 닫힘. */}
      <button
        type="button"
        aria-label={c.close}
        onClick={onClose}
        className={cn(
          'absolute inset-0',
          mode === 'center'
            ? 'bg-inverse/[.28] backdrop-blur-sm'
            : 'bg-inverse/[.06] cursor-default',
        )}
      />

      {/* 패널 — mode 로 재스타일링(사이드=우측, 중앙=대화상자). CSS 트랜지션만(collections 는 motion 무의존). */}
      <div
        data-slot="projected-peek-panel"
        role="dialog"
        aria-modal={mode === 'center'}
        aria-label={target.title || c.panelLabelFallback}
        className={cn(
          'relative z-10 flex flex-col overflow-hidden border border-border bg-surface shadow-2xl',
          'transition-[width,max-width,height,border-radius] duration-200 ease-out',
          mode === 'center'
            ? 'h-[86vh] w-[min(960px,94vw)] rounded-2xl'
            : 'h-full w-full max-w-[min(560px,92vw)] rounded-l-2xl',
        )}
      >
        {/* 헤더 — 사이드/모달 토글 + 제목 + 닫기(projected 는 "전체 페이지로 열기" 없음 — 라우트 없음). */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="flex min-w-0 items-center gap-1">
            <ModeButton
              active={mode === 'side'}
              onClick={() => setMode('side')}
              label={c.openSide}
              icon={<PanelRight size={15} />}
            />
            <ModeButton
              active={mode === 'center'}
              onClick={() => setMode('center')}
              label={c.openCenter}
              icon={<Monitor size={15} />}
            />
            {target.title ? (
              <span className="ml-1 truncate text-sm text-fg-muted">{target.title}</span>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={c.close}
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-muted hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>
        {/* 본문 — 전달 doc 를 정적 렌더(RecordDocumentView, onAction 위임). fetch 없음. */}
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="p-4">
            <RecordDocumentView doc={target.doc} onAction={target.onAction} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** 열기 방식 토글 버튼 — 활성 상태를 강조. */
function ModeButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        active ? 'bg-muted text-fg' : 'text-fg-muted hover:bg-muted hover:text-fg',
      )}
    >
      {icon}
    </button>
  )
}
