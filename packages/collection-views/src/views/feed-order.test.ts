// 피드 정렬 폴백 — view.sort 가 빌 때의 "최신순" 회귀 핀.
//
// date-only 값은 Date.parse 가 UTC 자정으로 파싱한다. 비교가 epoch ms 라 TZ 와 무관해야 하므로
// 음수 offset TZ 를 강제해 회귀(로컬 메서드 혼입)를 잡는다. Node 는 import 전 process.env.TZ 를 반영한다.
process.env.TZ = 'America/New_York' // UTC-5/-4 (음수 offset)

import { describe, it, expect } from 'vitest'
import type { PropertyDef, PropertyValue } from '@oobleck/collection'
import type { Row } from '@oobleck/collection'
import { firstDateKey, orderByRecency } from './feed-order'

type Props = Record<string, PropertyValue>

/** 행 생성 헬퍼. */
const row = (id: string, props: Props): Row<Props> => ({ id, props })

const dateSchema: PropertyDef[] = [
  { key: 'name', label: '이름', type: 'text', source: 'frontmatter', origin: 'preset' },
  { key: 'created', label: '생성일', type: 'date', source: 'frontmatter', origin: 'preset' },
  { key: 'updated', label: '수정일', type: 'date', source: 'frontmatter', origin: 'preset' },
]

describe('feed-order — firstDateKey', () => {
  it('스키마의 첫 date 타입 컬럼 키를 고른다(선언 순서)', () => {
    expect(firstDateKey(dateSchema)).toBe('created')
  })

  it('date 컬럼이 없으면 undefined', () => {
    const noDate: PropertyDef[] = [
      { key: 'name', label: '이름', type: 'text', source: 'frontmatter', origin: 'preset' },
      { key: 'count', label: '수', type: 'number', source: 'frontmatter', origin: 'preset' },
    ]
    expect(firstDateKey(noDate)).toBeUndefined()
  })
})

describe('feed-order — orderByRecency', () => {
  it('빈 레코드 → 빈 배열(크래시 없음)', () => {
    expect(orderByRecency([], 'created')).toEqual([])
  })

  it('dateKey 가 undefined(=date 속성 없음) → 입력 순서 그대로 보존', () => {
    const rows = [row('a', { name: 'A' }), row('b', { name: 'B' }), row('c', { name: 'C' })]
    const out = orderByRecency(rows, undefined)
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('정상 내림차순(최신 먼저)으로 정렬', () => {
    const rows = [
      row('old', { created: '2026-01-01' }),
      row('new', { created: '2026-06-20' }),
      row('mid', { created: '2026-03-15' }),
    ]
    const out = orderByRecency(rows, 'created')
    expect(out.map((r) => r.id)).toEqual(['new', 'mid', 'old'])
  })

  it('TZ 무관: date-only 값이 음수 offset TZ 에서도 동일 정렬(하루 어긋남 없음)', () => {
    // 로컬 메서드를 섞었다면 자정 경계 근처에서 순서가 흔들릴 수 있다 — epoch ms 비교로 결정성 확보.
    const rows = [
      row('d15', { created: '2026-01-15' }),
      row('d16', { created: '2026-01-16' }),
      row('d14', { created: '2026-01-14' }),
    ]
    const out = orderByRecency(rows, 'created')
    expect(out.map((r) => r.id)).toEqual(['d16', 'd15', 'd14'])
  })

  it('동일 날짜(동률)는 입력 순서 유지(stable)', () => {
    const rows = [
      row('first', { created: '2026-05-01' }),
      row('second', { created: '2026-05-01' }),
      row('third', { created: '2026-05-01' }),
    ]
    const out = orderByRecency(rows, 'created')
    expect(out.map((r) => r.id)).toEqual(['first', 'second', 'third'])
  })

  it('날짜 없는(null/파싱불가) 행은 항상 뒤로, 그들끼리는 입력 순서 유지', () => {
    const rows = [
      row('noval', { created: null }),
      row('dated', { created: '2026-02-10' }),
      row('garbage', { created: 'not-a-date' }),
      row('older', { created: '2026-01-05' }),
    ]
    const out = orderByRecency(rows, 'created')
    // 날짜 있는 둘이 최신순으로 앞, 날짜 없는 둘은 입력 순서(noval → garbage)로 뒤.
    expect(out.map((r) => r.id)).toEqual(['dated', 'older', 'noval', 'garbage'])
  })

  it('원본 배열을 변형하지 않는다(불변)', () => {
    const rows = [row('a', { created: '2026-01-01' }), row('b', { created: '2026-02-01' })]
    const snapshot = rows.map((r) => r.id)
    orderByRecency(rows, 'created')
    expect(rows.map((r) => r.id)).toEqual(snapshot)
  })
})
