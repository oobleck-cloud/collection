import { describe, expect, it } from 'vitest'

import {
  answerRowsOf,
  answerSections,
  answerSummary,
  attributeDefsOf,
  fieldKey,
  fieldsOfQuestions,
  type FormQuestionLike,
} from './index'

const QUESTIONS: FormQuestionLike[] = [
  {
    key: 'liability',
    short: '배상 책임',
    kind: 'choice',
    options: [
      { value: 'yes', label: '들었어요', summary: '가입' },
      { value: 'no', label: '안 들었어요' },
    ],
  },
  {
    key: 'otherKinds',
    short: '다른 보험',
    kind: 'multi',
    options: [{ value: 'car', label: '차' }],
  },
  { key: 'claimNote', short: '사고 내용', kind: 'text' },
  { key: 'monthlyMoves', short: '월 이사 수', kind: 'number' },
  { key: 'premium', short: '보험료', kind: 'premium' },
]

describe('문항 → 칸', () => {
  it('칸 키 — 낙타 표기를 밑줄로', () => {
    expect(fieldKey('otherKinds')).toBe('other_kinds')
    expect(fieldKey('liability')).toBe('liability')
  })

  it('기본 종류를 옮기고 모르는 종류는 뺀다 — 모두 선택 칸, 선택지는 요약 이름 먼저', () => {
    const fields = fieldsOfQuestions(QUESTIONS)
    expect(fields.map((f) => [f.key, f.type])).toEqual([
      ['liability', 'SELECT'],
      ['other_kinds', 'MULTI_SELECT'],
      ['claim_note', 'TEXT'],
      ['monthly_moves', 'NUMBER'],
    ])
    expect(fields.every((f) => !f.required)).toBe(true)
    expect(fields[0]!.options).toEqual([
      { value: 'yes', label: '가입' },
      { value: 'no', label: '안 들었어요' },
    ])
    expect(fields[2]!.options).toEqual([])
  })

  it('앱 고유 종류는 custom 으로 — 키는 맞추고 이름은 자른다, null 이면 뺀다', () => {
    const fields = fieldsOfQuestions(QUESTIONS, {
      labelMax: 8,
      custom: (q, base) =>
        q.kind === 'premium'
          ? { ...base, key: 'ignored', label: `${q.short} (월, 원)`, type: 'NUMBER' }
          : q.kind === 'text'
            ? null
            : undefined,
    })
    expect(fields.find((f) => f.key === 'premium')).toMatchObject({
      type: 'NUMBER',
      label: '보험료 (월, ',
    })
    expect(fields.some((f) => f.key === 'claim_note')).toBe(false)
    expect(fields).toHaveLength(4)
  })

  it('칸 → 속성 정의 — 종류는 소문자, 선택지 그대로', () => {
    const defs = attributeDefsOf([
      ...fieldsOfQuestions(QUESTIONS),
      { key: 'callback_on', label: '다시 걸 날', type: 'DATE', options: [] },
      { key: 'ok', label: '확인', type: 'CHECKBOX', options: [] },
    ])
    expect(defs.map((d) => d.type)).toEqual([
      'select',
      'multi_select',
      'text',
      'number',
      'date',
      'checkbox',
    ])
    expect(defs[0]!.options).toHaveLength(2)
  })
})

describe('답', () => {
  const fields = fieldsOfQuestions(QUESTIONS)

  it('한 줄 요약 — 칸 순서, 선택지 이름, 빈 칸은 뺀다', () => {
    expect(
      answerSummary({ monthly_moves: ['12'], liability: ['yes'], claim_note: [] }, fields),
    ).toBe('배상 책임 가입 · 월 이사 수 12')
  })

  it('칸을 모르면 키 그대로', () => {
    expect(answerSummary({ intent: ['later'], x: ['a', 'b'] }, null)).toBe('intent later · x a, b')
  })

  it('답 표 줄 — 받은 갈래의 구역만, 답한 문항만, 구역 차례대로 묶는다', () => {
    const items = [
      { section: { title: '기본' }, question: { key: 'a', short: 'A' } },
      { section: { title: '보험', variant: 'ins' }, question: { key: 'b', short: 'B' } },
      { section: { title: '기본' }, question: { key: 'c', short: 'C' } },
      { section: { title: '기본' }, question: { key: 'd', short: 'D' } },
    ]
    const text: Record<string, string> = { a: '가', b: '나', c: '', d: '라' }
    const rows = answerRowsOf(items, (q) => text[q.key] ?? '')
    expect(rows.map((r) => r.key)).toEqual(['a', 'd'])
    const withIns = answerRowsOf(items, (q) => text[q.key] ?? '', ['ins'])
    expect(answerSections(withIns).map((s) => [s.section, s.rows.map((r) => r.key)])).toEqual([
      ['기본', ['a', 'd']],
      ['보험', ['b']],
    ])
  })
})
