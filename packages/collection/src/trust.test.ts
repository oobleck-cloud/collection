import { describe, expect, it } from 'vitest'
import type { BlockDocument } from './types'
import {
  canSetGrade,
  cellsNeedingEvidence,
  clearTrust,
  decayStale,
  gradeOf,
  gradeRank,
  readTrust,
  rowGrade,
  validateCell,
  validateRow,
  writeTrust,
} from './trust'

const doc = (properties: Record<string, unknown> = {}): BlockDocument =>
  ({ properties }) as BlockDocument

describe('gradeRank', () => {
  it('격자 순서대로 커진다', () => {
    expect(gradeRank('hypothesis')).toBeLessThan(gradeRank('claimed'))
    expect(gradeRank('claimed')).toBeLessThan(gradeRank('sourced'))
    expect(gradeRank('sourced')).toBeLessThan(gradeRank('verified'))
  })
  it('미부여(undefined)는 최하위', () => {
    expect(gradeRank(undefined)).toBe(0)
  })
})

describe('read/write/clear', () => {
  it('쓴 값을 그대로 읽는다', () => {
    const d = writeTrust(doc({ addr: '서울' }), 'addr', { g: 'sourced', src: '상가정보' })
    expect(readTrust(d, 'addr')).toEqual({ g: 'sourced', src: '상가정보' })
  })
  it('원본을 변형하지 않는다(불변)', () => {
    const before = doc({ addr: '서울' })
    writeTrust(before, 'addr', { g: 'sourced', src: 'x' })
    expect(before.trust).toBeUndefined()
  })
  it('다른 컬럼 메타를 보존한다', () => {
    let d = writeTrust(doc(), 'a', { g: 'sourced', src: 'x' })
    d = writeTrust(d, 'b', { g: 'claimed' })
    expect(readTrust(d, 'a')?.g).toBe('sourced')
    expect(readTrust(d, 'b')?.g).toBe('claimed')
  })
  it('clearTrust 는 해당 컬럼만 지운다', () => {
    let d = writeTrust(doc(), 'a', { g: 'sourced', src: 'x' })
    d = writeTrust(d, 'b', { g: 'claimed' })
    d = clearTrust(d, 'a')
    expect(readTrust(d, 'a')).toBeUndefined()
    expect(readTrust(d, 'b')?.g).toBe('claimed')
  })
  it('메타 없는 컬럼의 등급은 hypothesis', () => {
    expect(gradeOf(doc({ x: 1 }), 'x')).toBe('hypothesis')
  })
  it('trust 가 배열·비객체여도 안전하게 빈 맵으로 읽는다', () => {
    expect(readTrust({ trust: [1, 2] } as never, 'a')).toBeUndefined()
    expect(readTrust({ trust: 'nope' } as never, 'a')).toBeUndefined()
  })
  it('properties 는 건드리지 않는다 — trust 는 형제 필드', () => {
    const d = writeTrust(doc({ addr: '서울' }), 'addr', { g: 'sourced', src: 'x' })
    expect(d.properties).toEqual({ addr: '서울' })
    expect(d.trust).toEqual({ addr: { g: 'sourced', src: 'x' } })
  })
})

describe('canSetGrade — 자동 상향 상한은 sourced (I2)', () => {
  it('자동은 sourced 까지 올릴 수 있다', () => {
    expect(canSetGrade('claimed', 'sourced', 'auto')).toBe(true)
  })
  it('자동은 verified 로 올릴 수 없다', () => {
    expect(canSetGrade('sourced', 'verified', 'auto')).toBe(false)
  })
  it('사람은 verified 로 올릴 수 있다', () => {
    expect(canSetGrade('sourced', 'verified', 'human')).toBe(true)
  })
  it('강등은 자동도 언제나 허용 — 소스 상충·만료를 즉시 반영해야 한다', () => {
    expect(canSetGrade('verified', 'claimed', 'auto')).toBe(true)
    expect(canSetGrade('sourced', 'hypothesis', 'auto')).toBe(true)
  })
  it('동급 유지도 허용', () => {
    expect(canSetGrade('sourced', 'sourced', 'auto')).toBe(true)
  })
})

describe('validateCell — 불변식', () => {
  it('I1: sourced 이상은 출처가 필수', () => {
    expect(validateCell('서울', { g: 'sourced' })).toContain('I1_source_required')
    expect(validateCell('서울', { g: 'sourced', src: '상가정보' })).toEqual([])
    expect(validateCell('서울', { g: 'sourced', src: '   ' })).toContain('I1_source_required')
  })
  it('I1: claimed 이하는 출처가 없어도 된다', () => {
    expect(validateCell('아마도', { g: 'claimed' })).toEqual([])
  })
  it('I2: 자동 주체는 verified 를 부여할 수 없다', () => {
    expect(validateCell('x', { g: 'verified', src: 's' }, 'auto')).toContain(
      'I2_auto_cannot_verify',
    )
    expect(validateCell('x', { g: 'verified', src: 's' }, 'human')).toEqual([])
  })
  it('I3: 값이 비면 등급은 hypothesis 여야 한다', () => {
    expect(validateCell(null, { g: 'sourced', src: 's' })).toContain('I3_empty_must_be_hypothesis')
    expect(validateCell('', { g: 'claimed' })).toContain('I3_empty_must_be_hypothesis')
    expect(validateCell([], { g: 'claimed' })).toContain('I3_empty_must_be_hypothesis')
    expect(validateCell(null, { g: 'hypothesis' })).toEqual([])
  })
  it('I4: 격자 밖 등급은 그것만 보고한다', () => {
    expect(validateCell('x', { g: 'bogus' as never })).toEqual(['I4_unknown_grade'])
  })
  it('메타가 없으면 검사할 것이 없다', () => {
    expect(validateCell('x', undefined)).toEqual([])
  })
})

describe('validateRow', () => {
  it('위반이 있는 컬럼만 담는다', () => {
    let d = doc({ ok: '값', bad: '값' })
    d = writeTrust(d, 'ok', { g: 'sourced', src: '상가정보' })
    d = writeTrust(d, 'bad', { g: 'sourced' })
    const v = validateRow(d)
    expect(Object.keys(v)).toEqual(['bad'])
    expect(v.bad).toContain('I1_source_required')
  })
  it('위반이 없으면 빈 객체', () => {
    const d = writeTrust(doc({ a: 'v' }), 'a', { g: 'claimed' })
    expect(validateRow(d)).toEqual({})
  })
})

describe('cellsNeedingEvidence — 제보 폼 질문의 원천', () => {
  it('hypothesis 이거나 미부여인 컬럼을 돌려준다', () => {
    let d = doc({ addr: '서울', seats: null, pay: null })
    d = writeTrust(d, 'addr', { g: 'sourced', src: '상가정보' })
    d = writeTrust(d, 'seats', { g: 'hypothesis' })
    expect(cellsNeedingEvidence(d, ['addr', 'seats', 'pay'])).toEqual(['seats', 'pay'])
  })
})

describe('rowGrade — 가장 약한 셀이 행을 대표한다', () => {
  it('한 칸이라도 약하면 행 등급이 그만큼 내려간다', () => {
    let d = doc({ a: 'v', b: 'v' })
    d = writeTrust(d, 'a', { g: 'verified', src: 's' })
    d = writeTrust(d, 'b', { g: 'claimed' })
    expect(rowGrade(d, ['a', 'b'])).toBe('claimed')
  })
  it('모두 sourced 면 sourced', () => {
    let d = doc({ a: 'v', b: 'v' })
    d = writeTrust(d, 'a', { g: 'sourced', src: 's' })
    d = writeTrust(d, 'b', { g: 'sourced', src: 's' })
    expect(rowGrade(d, ['a', 'b'])).toBe('sourced')
  })
  it('컬럼이 없으면 hypothesis', () => {
    expect(rowGrade(doc(), [])).toBe('hypothesis')
  })
})

describe('decayStale — 오래된 sourced 는 조용히 거짓이 된다', () => {
  const now = new Date('2026-07-28T00:00:00Z')
  it('기한을 넘긴 sourced 는 claimed 로 강등', () => {
    const t = decayStale({ g: 'sourced', src: 's', at: '2026-01-01T00:00:00Z' }, now, 90)
    expect(t.g).toBe('claimed')
  })
  it('기한 내면 그대로', () => {
    const t = decayStale({ g: 'sourced', src: 's', at: '2026-07-01T00:00:00Z' }, now, 90)
    expect(t.g).toBe('sourced')
  })
  it('claimed 이하는 강등 대상이 아니다', () => {
    const t = decayStale({ g: 'claimed', at: '2020-01-01T00:00:00Z' }, now, 90)
    expect(t.g).toBe('claimed')
  })
  it('확인 시각이 없거나 파싱 불가면 그대로', () => {
    expect(decayStale({ g: 'sourced', src: 's' }, now, 90).g).toBe('sourced')
    expect(decayStale({ g: 'sourced', src: 's', at: 'nope' }, now, 90).g).toBe('sourced')
  })
})
