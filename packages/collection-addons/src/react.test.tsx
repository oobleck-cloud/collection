import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AnswerSections } from './react'

describe('AnswerSections', () => {
  it('구역마다 카드, 이름 — 답 줄. 답이 없으면 그리지 않는다', () => {
    const html = renderToStaticMarkup(
      <AnswerSections
        rows={[
          { key: 'a', label: '배상 책임', text: '가입', section: '기본' },
          { key: 'b', label: '메모', text: '없음', section: '' },
        ]}
      />,
    )
    expect(html).toContain('data-section="기본"')
    expect(html).toContain('<dt class="text-fg-muted">배상 책임</dt>')
    expect(html).toContain('112px minmax(0,1fr)')
    expect((html.match(/<dl/g) ?? []).length).toBe(2)
    expect(renderToStaticMarkup(<AnswerSections rows={[]} />)).toBe('')
  })
})
