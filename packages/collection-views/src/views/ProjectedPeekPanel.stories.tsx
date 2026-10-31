/**
 * Collections — ProjectedPeekPanel (투영 문서 사이드보기 쉘)
 *
 * 포털 + 스크림 + 사이드/모달 토글. 패널 폭·높이가 임의값 유틸리티
 * (`max-w-[min(560px,92vw)]`, `h-[86vh]`, `w-[min(960px,94vw)]`)에 걸려 있어서, 그 규칙이
 * 생성되지 않으면 패널이 화면 전체를 먹거나 0폭으로 접힌다 — 어느 쪽도 단위 테스트는 못 본다.
 *
 * 열림 방식은 localStorage(`montize:peek-mode`)에 기억되므로, 스토리마다 그 키를 지워
 * 앞 스토리의 선택이 다음 스냅샷으로 새지 않게 한다(시각회귀에서 상태 누수 = 랜덤 diff).
 */
import { fn } from '@storybook/test'

import { bulletListBlock, headingBlock, paragraphBlock } from '@oobleck/collection'

import { ProjectedPeekPanel } from './ProjectedPeekPanel'

import type { ProjectedPeekTarget } from './ProjectedPeekPanel'
import type { Meta, StoryObj } from '@storybook/react'

const PEEK_MODE_KEY = 'montize:peek-mode'

const TARGET: ProjectedPeekTarget = {
  title: 'AI 추론 로그',
  doc: {
    properties: {
      title: 'counsel.suggestion.rank',
      상태: { tag: '성공', color: 'green' },
      지연: '412ms',
      모델: 'rule-engine v13',
      토큰: 0,
    },
    body: [
      paragraphBlock('상담 추천 후보 24건 중 상위 5건을 반환했습니다.'),
      headingBlock('적용된 규칙', 3),
      bulletListBlock([
        '구역 자격 일치 — 가중치 0.4',
        '이동시간 60분 이하 — 가중치 0.35',
        '일일 6건 상한 미도달 — 가중치 0.25',
      ]),
    ],
  },
}

const meta: Meta<typeof ProjectedPeekPanel> = {
  title: 'Collections/ProjectedPeekPanel',
  component: ProjectedPeekPanel,
  parameters: {
    layout: 'fullscreen',
    // 패널은 document.body 포털이라 canvas 밖에 뜬다 — 뒤에 목록이 있는 실제 맥락을 깔아준다.
    docs: { story: { inline: false, height: '520px' } },
  },
  beforeEach: () => {
    localStorage.removeItem(PEEK_MODE_KEY)
    return () => localStorage.removeItem(PEEK_MODE_KEY)
  },
  decorators: [
    (Story) => (
      <div className="min-h-[480px] bg-background p-4">
        <p className="text-sm text-fg-muted">
          뒤 목록 — 사이드 모드는 얕은 딤이라 이 글이 비쳐야 하고, 중앙 모달은 블러로 가려야 한다.
        </p>
        <Story />
      </div>
    ),
  ],
  args: {
    target: TARGET,
    onClose: fn(),
  },
}

export default meta
type Story = StoryObj<typeof ProjectedPeekPanel>

/** 기본(side) — 우측 패널 + 얕은 딤. */
export const SidePanel: Story = {}

/**
 * 중앙 모달 — 저장된 선호를 미리 심어 렌더한다(토글 클릭 없이 결정론적으로 그 모드를 잡는다).
 */
export const CenterModal: Story = {
  beforeEach: () => {
    localStorage.setItem(PEEK_MODE_KEY, 'center')
    return () => localStorage.removeItem(PEEK_MODE_KEY)
  },
}

/** 제목 없는 대상 — 헤더에 토글과 닫기만 남는다. */
export const WithoutTitle: Story = {
  args: {
    target: { doc: TARGET.doc },
  },
}

/** target=null → 아무것도 렌더하지 않는다(닫힘). */
export const Closed: Story = {
  args: { target: null },
}
