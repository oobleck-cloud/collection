/**
 * Collections — RecordDocumentView (읽기전용 "행 = 문서" 상세)
 *
 * 속성 목록은 `grid-cols-[max-content_1fr]` + `contents` 로 dt/dd 를 두 열에 맞춘다.
 * 그 임의값 유틸리티가 없으면 라벨과 값이 한 줄로 흘러내려 문서 전체가 뭉개지는데,
 * 텍스트 단언 테스트는 그대로 통과한다. 정확히 시각회귀가 필요한 형태.
 */
import { fn } from '@storybook/test'

import { bulletListBlock, codeBlock, headingBlock, paragraphBlock, tableBlock } from '@oobleck/collection'

import { RecordDocumentView } from './RecordDocumentView'

import type { BlockDocument } from '@oobleck/collection'
import type { Meta, StoryObj } from '@storybook/react'

const DOC: BlockDocument = {
  properties: {
    title: '재조정 시뮬레이션 리포트',
    상태: { tag: '진행중', color: 'green' },
    담당: '플래너 운영팀',
    건수: 128,
    발행: true,
    링크: 'https://example.com/report',
    태그: ['긴급', '검토'],
    액션: { action: 'republish', label: '다시 발행', variant: 'outline' },
  },
  body: [
    paragraphBlock('LNS + 시뮬레이티드 어닐링으로 하루치 상담 일정을 재조정한 결과입니다.'),
    headingBlock('제약 위반', 2),
    bulletListBlock([
      'Hard — 시간 충돌 0건',
      'Hard — 최대 이동시간 60분 초과 2건',
      'Soft — 프리랜서 활성도 하한 미달 1건',
    ]),
    headingBlock('구역별 요약', 3),
    tableBlock(
      ['구역', '건수', '평균 이동'],
      [
        ['강남', '42', '18분'],
        ['송파', '37', '23분'],
        ['마포', '49', '31분'],
      ],
    ),
    headingBlock('실행 파라미터', 3),
    codeBlock('{\n  "iterations": 20000,\n  "seed": 42,\n  "cooling": 0.997\n}', 'json'),
  ],
}

const meta: Meta<typeof RecordDocumentView> = {
  title: 'Collections/RecordDocumentView',
  component: RecordDocumentView,
  decorators: [
    (Story) => (
      <div className="max-w-2xl bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: { doc: DOC },
}

export default meta
type Story = StoryObj<typeof RecordDocumentView>

/** 알려진 블록 전종(제목·문단·불릿·표·코드) + 값 타입별 셀. */
export const Full: Story = {}

/** onAction 연결 — button 프로퍼티가 활성 렌더된다(미지정이면 비활성). */
export const WithAction: Story = {
  args: { onAction: fn() },
}

/** 속성만 있고 본문이 없는 문서 — dl 격자만 남는다. */
export const PropertiesOnly: Story = {
  args: {
    doc: { properties: DOC.properties },
  },
}

/** 본문만 있고 속성이 없는 문서. */
export const BodyOnly: Story = {
  args: {
    doc: { body: DOC.body },
  },
}

/** 빈 문서 — 아무것도 그리지 않는다(크래시 없음). */
export const EmptyDocument: Story = {
  args: { doc: {} },
}
