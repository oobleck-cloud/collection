// @mvos/collections — 공유 문서 본문 블록 빌더(doc-blocks) 셰이프 핀.
//
// 3중(실제 4중) 사본이던 TipTap 블록 조립을 이 모듈로 수렴했다(마켓플레이스 toPackDetailDoc·백오피스
// toAiInferenceDetailDoc·헤드리스 endpointBody·워크스페이스 toTimelineDoc). 각 소비처의 기존 출력과
// **바이트 동치**를 유지하는 게 목적이라, 두 출력 셰이프(정적 렌더 기본 / 헤드리스 에디터-왕복 attrs)를
// 정확한 JSON 으로 핀한다. 여기가 깨지면 소비처 출력이 조용히 바뀐 것.

import { describe, it, expect } from 'vitest'
import {
  bulletListBlock,
  codeBlock,
  headingBlock,
  paragraphBlock,
  tableBlock,
  tableRowBlock,
  textNode,
} from './doc-blocks'

describe('doc-blocks — 기본(정적 렌더) 셰이프', () => {
  it('textNode/headingBlock/paragraphBlock', () => {
    expect(textNode('x')).toEqual({ type: 'text', text: 'x' })
    expect(headingBlock('제목')).toEqual({
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: '제목' }],
    })
    expect(headingBlock('H2', 2)).toEqual({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'H2' }],
    })
    expect(paragraphBlock('본문')).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: '본문' }],
    })
  })

  it('bulletListBlock — 각 항목 listItem>paragraph', () => {
    expect(bulletListBlock(['a', 'b'])).toEqual({
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }],
        },
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }],
        },
      ],
    })
  })

  it('tableBlock(기본) — 셀 attrs 없음, 빈 문자열도 텍스트 노드 유지(정적 렌더 소비처 동작)', () => {
    expect(tableBlock(['H'], [['v'], ['']])).toEqual({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H' }] }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v' }] }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
            },
          ],
        },
      ],
    })
  })
})

describe('doc-blocks — 헤드리스(에디터 왕복) 셰이프', () => {
  const attrs = { colspan: 1, rowspan: 1, colwidth: null, align: null }
  const opts = { cellAttrs: attrs, emptyCellContent: true }

  it('tableBlock(cellAttrs+emptyCellContent) — 셀 attrs 명시 + 빈 문자열 셀은 빈 content', () => {
    expect(tableBlock(['H'], [['v'], ['']], opts)).toEqual({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H' }] }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'v' }] }],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [{ type: 'tableCell', attrs, content: [{ type: 'paragraph', content: [] }] }],
        },
      ],
    })
  })

  it('셀마다 독립 attrs 객체(공유 참조 아님 — 한 셀 변경이 번지지 않음)', () => {
    const row = tableRowBlock('tableCell', ['a', 'b'], opts)
    const cells = row.content as { attrs?: Record<string, unknown> }[]
    expect(cells[0].attrs).not.toBe(cells[1].attrs)
    expect(cells[0].attrs).toEqual(attrs)
  })

  it('codeBlock — language 있으면 attrs.language, 없으면 attrs 생략', () => {
    expect(codeBlock('{"a":1}', 'json')).toEqual({
      type: 'codeBlock',
      attrs: { language: 'json' },
      content: [{ type: 'text', text: '{"a":1}' }],
    })
    expect(codeBlock('plain')).toEqual({
      type: 'codeBlock',
      content: [{ type: 'text', text: 'plain' }],
    })
  })
})
