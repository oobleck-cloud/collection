import { describe, it, expect } from 'vitest'
import { blankPack, blankPropertySchema, emptyRow, BLANK_TITLE_KEY } from './blank-pack'

describe('blankPack', () => {
  it('스키마는 title(이름) 프리셋 컬럼 하나 — projection/preset(행=페이지 보장)', () => {
    // 제목은 projection — TableView 가 첫 컬럼을 페이지 링크형 제목 셀로 렌더하도록(읽기전용 게이트).
    // 인라인 편집은 writeTitle(onEditTitle) 경로로 유지된다. product/plan 팩과 동일 규약.
    expect(blankPropertySchema).toHaveLength(1)
    expect(blankPropertySchema[0]).toMatchObject({
      key: BLANK_TITLE_KEY,
      type: 'text',
      source: 'projection',
      origin: 'preset',
    })
  })

  it('readProperties 는 properties 사본 반환(원본 미참조)', () => {
    const doc = { properties: { title: 'A', n: 3 } }
    const props = blankPack.readProperties(doc)
    expect(props).toEqual({ title: 'A', n: 3 })
    expect(props).not.toBe(doc.properties)
  })

  it('readProperties 는 properties 누락 시 빈 객체', () => {
    expect(blankPack.readProperties({})).toEqual({})
  })

  it('writeProperty 는 불변 — 새 doc 반환, 원본 미변경', () => {
    const doc = { properties: { title: 'A' } }
    const next = blankPack.writeProperty(doc, 'status', 'open')
    expect(next.properties).toEqual({ title: 'A', status: 'open' })
    expect(doc.properties).toEqual({ title: 'A' })
    expect(next).not.toBe(doc)
  })

  it('writeProperty 는 properties 누락 doc 도 처리', () => {
    expect(blankPack.writeProperty({}, 'k', 1).properties).toEqual({ k: 1 })
  })

  it('writeTitle 은 title 키에 기록', () => {
    expect(blankPack.writeTitle?.({ properties: {} }, '제목').properties?.[BLANK_TITLE_KEY]).toBe(
      '제목',
    )
  })

  it('emptyRow 는 빈 properties', () => {
    expect(emptyRow()).toEqual({ properties: {} })
  })
})
