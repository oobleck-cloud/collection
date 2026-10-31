// 사람(person / multi_person) 값 — 계정 id 만 다루고, 이름은 명단에서 푼다.

import { describe, expect, it } from 'vitest'

import { personIdsOf, searchPeople, togglePerson } from './person'
import { builtinSuggester } from './search-suggest'

import type { PropertyDef, SelectOption } from './types'

const PEOPLE: SelectOption[] = [
  { value: 'acc-park', label: '박운영', hint: 'park@miso.kr' },
  { value: 'acc-kim', label: '김미소', hint: 'kim@miso.kr' },
  { value: 'acc-gone', label: '김퇴사', hint: 'gone@miso.kr', inactive: true },
]

describe('personIdsOf — 값 정규화', () => {
  it('단일·다중·빈 값을 id 배열로 편다', () => {
    expect(personIdsOf('acc-kim')).toEqual(['acc-kim'])
    expect(personIdsOf(['acc-kim', 'acc-park'])).toEqual(['acc-kim', 'acc-park'])
    expect(personIdsOf(null)).toEqual([])
    expect(personIdsOf('')).toEqual([])
  })
})

describe('searchPeople — 피커 목록', () => {
  it('비활성 계정은 새로 고를 수 없어 빠지고, 이름순이다', () => {
    expect(searchPeople(PEOPLE, '').map((o) => o.value)).toEqual(['acc-kim', 'acc-park'])
  })

  it('이름과 이메일 둘 다로 찾는다', () => {
    expect(searchPeople(PEOPLE, '김').map((o) => o.value)).toEqual(['acc-kim'])
    expect(searchPeople(PEOPLE, 'PARK@').map((o) => o.value)).toEqual(['acc-park'])
  })
})

describe('togglePerson — 고르기', () => {
  it('한 명 칸은 바꾸고, 같은 사람을 다시 고르면 비운다', () => {
    expect(togglePerson(false, [], 'acc-kim')).toBe('acc-kim')
    expect(togglePerson(false, ['acc-kim'], 'acc-park')).toBe('acc-park')
    expect(togglePerson(false, ['acc-kim'], 'acc-kim')).toBeNull()
  })

  it('여러 명 칸은 넣고 빼며, 다 빠지면 해제(null)다', () => {
    expect(togglePerson(true, ['acc-kim'], 'acc-park')).toEqual(['acc-kim', 'acc-park'])
    expect(togglePerson(true, ['acc-kim', 'acc-park'], 'acc-kim')).toEqual(['acc-park'])
    expect(togglePerson(true, ['acc-kim'], 'acc-kim')).toBeNull()
  })
})

describe('검색어 제안 — 사람 컬럼', () => {
  const owner: PropertyDef = {
    key: 'x:담당',
    label: '담당',
    type: 'person',
    source: 'frontmatter',
    origin: 'base',
    options: PEOPLE,
  }

  it('이름·이메일이 맞는 사람을 계정 id 조건으로 낸다', () => {
    const out = builtinSuggester('kim@', owner)
    expect(out.map((s) => s.conditions)).toEqual([[{ key: 'x:담당', op: 'eq', value: 'acc-kim' }]])
    expect(out[0]?.valueLabel).toBe('김미소')
  })

  it('「나」를 치면 보는 사람 조건이 맨 앞에 온다(상대값)', () => {
    const out = builtinSuggester('나', { ...owner, type: 'multi_person' })
    expect(out[0]?.conditions).toEqual([{ key: 'x:담당', op: 'has', value: { rel: 'me' } }])
  })
})
