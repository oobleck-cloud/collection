// @mvos/collections — 조건부 서식 규칙 평가(순수) 핀.

import { describe, expect, it } from 'vitest'

import {
  aggregationTone,
  cardFormatClassName,
  conditionalFormatClassName,
  resolveCardFormat,
  resolveCellFormat,
  textFormatClassName,
} from './conditional-format'

import type { ConditionalFormatRule } from './conditional-format'
import type { PropertyValue } from './types'

const row = (props: Record<string, PropertyValue>) => props

/** 조건 하나짜리 규칙 헬퍼 — `key op value` 를 만족하면 style 적용. */
function rule(
  id: string,
  cond: { key: string; op: 'eq' | 'gt' | 'is_empty'; value?: PropertyValue },
  style: ConditionalFormatRule['style'],
  target?: string,
): ConditionalFormatRule {
  return {
    id,
    ...(target !== undefined ? { target } : {}),
    when: { op: 'and', children: [{ key: cond.key, op: cond.op, value: cond.value ?? null }] },
    style,
  }
}

describe('resolveCellFormat', () => {
  it('규칙이 없으면 null', () => {
    expect(resolveCellFormat(undefined, 'amount', row({ amount: 10 }))).toBeNull()
    expect(resolveCellFormat([], 'amount', row({ amount: 10 }))).toBeNull()
  })

  it('조건을 만족하는 규칙의 서식을 돌려준다', () => {
    const rules = [rule('r1', { key: 'status', op: 'eq', value: 'cancelled' }, { tone: 'danger' })]
    expect(resolveCellFormat(rules, 'amount', row({ status: 'cancelled' }))).toEqual({
      tone: 'danger',
    })
  })

  it('조건을 만족하지 않으면 null', () => {
    const rules = [rule('r1', { key: 'status', op: 'eq', value: 'cancelled' }, { tone: 'danger' })]
    expect(resolveCellFormat(rules, 'amount', row({ status: 'active' }))).toBeNull()
  })

  it('target 이 지정되면 그 컬럼에만 적용된다', () => {
    const rules = [
      rule('r1', { key: 'status', op: 'eq', value: 'cancelled' }, { tone: 'danger' }, 'amount'),
    ]
    const props = row({ status: 'cancelled', amount: 100, name: 'x' })
    expect(resolveCellFormat(rules, 'amount', props)).toEqual({ tone: 'danger' })
    expect(resolveCellFormat(rules, 'name', props)).toBeNull()
  })

  it('target 미지정 규칙은 모든 컬럼에 적용된다(행 전체 강조)', () => {
    const rules = [rule('r1', { key: 'status', op: 'eq', value: 'cancelled' }, { tone: 'muted' })]
    const props = row({ status: 'cancelled', amount: 100, name: 'x' })
    expect(resolveCellFormat(rules, 'amount', props)).toEqual({ tone: 'muted' })
    expect(resolveCellFormat(rules, 'name', props)).toEqual({ tone: 'muted' })
  })

  it('다른 컬럼을 근거로 이 컬럼을 칠할 수 있다(조건은 행 전체에 대해 평가)', () => {
    // "상태가 취소면 금액을 흐리게" — 조건은 status, 서식은 amount.
    const rules = [
      rule(
        'dim',
        { key: 'status', op: 'eq', value: 'cancelled' },
        { tone: 'muted', strikethrough: true },
        'amount',
      ),
    ]
    expect(resolveCellFormat(rules, 'amount', row({ status: 'cancelled', amount: 5000 }))).toEqual({
      tone: 'muted',
      strikethrough: true,
    })
  })

  it('충돌하는 속성은 앞선 규칙이 이기고, 겹치지 않는 속성은 합쳐진다', () => {
    const rules = [
      rule('first', { key: 'a', op: 'eq', value: 1 }, { tone: 'danger' }),
      rule('second', { key: 'a', op: 'eq', value: 1 }, { tone: 'success', bold: true }),
    ]
    // tone 은 앞선 'first' 가 이기고, bold 는 'second' 만 정했으므로 적용된다.
    expect(resolveCellFormat(rules, 'x', row({ a: 1 }))).toEqual({ tone: 'danger', bold: true })
  })

  it('매칭되지 않는 규칙은 우선순위를 소모하지 않는다', () => {
    const rules = [
      rule('miss', { key: 'a', op: 'eq', value: 999 }, { tone: 'danger' }),
      rule('hit', { key: 'a', op: 'eq', value: 1 }, { tone: 'success' }),
    ]
    expect(resolveCellFormat(rules, 'x', row({ a: 1 }))).toEqual({ tone: 'success' })
  })

  it('비교 연산자(gt)도 필터와 같은 semantics 로 동작한다', () => {
    const rules = [rule('big', { key: 'amount', op: 'gt', value: 100 }, { tone: 'warning' })]
    expect(resolveCellFormat(rules, 'amount', row({ amount: 101 }))).toEqual({ tone: 'warning' })
    expect(resolveCellFormat(rules, 'amount', row({ amount: 100 }))).toBeNull()
  })

  it('빈 값 조건(is_empty)', () => {
    const rules = [rule('missing', { key: 'owner', op: 'is_empty' }, { tone: 'warning' })]
    expect(resolveCellFormat(rules, 'owner', row({ owner: null }))).toEqual({ tone: 'warning' })
    expect(resolveCellFormat(rules, 'owner', row({ owner: 'kim' }))).toBeNull()
  })

  it('레거시 평탄 배열 조건도 AND 로 해석한다', () => {
    const legacy: ConditionalFormatRule = {
      id: 'legacy',
      when: [
        { key: 'status', op: 'eq', value: 'active' },
        { key: 'amount', op: 'gt', value: 10 },
      ],
      style: { tone: 'success' },
    }
    expect(resolveCellFormat([legacy], 'x', row({ status: 'active', amount: 20 }))).toEqual({
      tone: 'success',
    })
    expect(resolveCellFormat([legacy], 'x', row({ status: 'active', amount: 5 }))).toBeNull()
  })
})

describe('conditionalFormatClassName', () => {
  it('null 이면 빈 문자열', () => {
    expect(conditionalFormatClassName(null)).toBe('')
  })

  it('tone 은 DS 시맨틱 토큰 클래스로 바뀐다', () => {
    expect(conditionalFormatClassName({ tone: 'danger' })).toBe(
      'bg-error-subtle/80 text-error-text',
    )
    expect(conditionalFormatClassName({ tone: 'muted' })).toBe('text-fg-muted')
  })

  it('bold·strikethrough 가 함께 붙는다', () => {
    expect(conditionalFormatClassName({ tone: 'warning', bold: true, strikethrough: true })).toBe(
      'bg-warning-subtle/80 text-warning-text font-semibold line-through',
    )
  })

  it('tone 없이 bold 만도 가능하다', () => {
    expect(conditionalFormatClassName({ bold: true })).toBe('font-semibold')
  })
})

describe('resolveCardFormat — 보드·갤러리 카드', () => {
  const stalled: ConditionalFormatRule = {
    id: 'stalled',
    target: 'lastActivityAt',
    when: { op: 'and', children: [{ key: '__stalled', op: 'eq', value: true }] },
    style: { tone: 'warning' },
  }
  const converted: ConditionalFormatRule = {
    id: 'converted-muted',
    when: { op: 'and', children: [{ key: 'stage', op: 'eq', value: 'converted' }] },
    style: { tone: 'muted' },
  }

  it('보이는 속성을 대상으로 한 규칙은 카드 전체와 그 속성 줄을 칠한다', () => {
    const r = resolveCardFormat([stalled], row({ __stalled: true }), ['name', 'lastActivityAt'])
    expect(r.card).toEqual({ tone: 'warning' })
    expect(r.byKey).toEqual({ lastActivityAt: { tone: 'warning' } })
  })

  it('카드에 안 보이는 속성을 대상으로 한 규칙은 칠하지 않는다(근거가 안 보이는 색)', () => {
    const r = resolveCardFormat([stalled], row({ __stalled: true }), ['name', 'phone'])
    expect(r.card).toBeNull()
    expect(r.byKey).toEqual({})
  })

  it('행 전체 규칙은 카드만 칠하고 속성 줄은 건드리지 않는다', () => {
    const r = resolveCardFormat([converted], row({ stage: 'converted' }), ['name', 'phone'])
    expect(r.card).toEqual({ tone: 'muted' })
    expect(r.byKey).toEqual({})
  })

  it('먼저 나온 규칙이 이긴다(표와 같은 병합)', () => {
    const r = resolveCardFormat(
      [converted, stalled],
      row({ stage: 'converted', __stalled: true }),
      ['lastActivityAt'],
    )
    expect(r.card).toEqual({ tone: 'muted' })
    expect(r.byKey.lastActivityAt).toEqual({ tone: 'warning' })
  })

  it('규칙이 없거나 맞지 않으면 서식 없음', () => {
    expect(resolveCardFormat(undefined, row({}), ['name'])).toEqual({ card: null, byKey: {} })
    expect(
      resolveCardFormat([stalled], row({ __stalled: false }), ['lastActivityAt']).card,
    ).toBeNull()
  })
})

describe('cardFormatClassName · textFormatClassName', () => {
  it('카드는 상태 바탕만 — 테두리 없이(그림자 면)', () => {
    expect(cardFormatClassName({ tone: 'warning' })).toBe('bg-warning-subtle')
    expect(cardFormatClassName(null)).toBe('')
  })

  it('속성 줄은 글자색만', () => {
    expect(textFormatClassName({ tone: 'warning', bold: true })).toBe(
      'text-warning-text font-semibold',
    )
    expect(textFormatClassName(undefined)).toBe('')
  })
})

describe('aggregationTone — 바닥 집계 숫자의 색', () => {
  const noMain = {
    id: 'no-main',
    target: 'main',
    when: { op: 'and' as const, children: [{ key: 'main', op: 'is_empty' as const }] },
    style: { tone: 'warning' as const },
  }
  const rows = [{ props: { main: ['r1'] } }, { props: { main: null } }, { props: { main: [] } }]

  it('센 빈 칸을 서식이 칠했으면 그 색(플래너 「주선호 미지정」 → 빈 값 숫자도 주황)', () => {
    expect(aggregationTone('count_empty', 'main', rows, [noMain])).toBe('warning')
  })

  it('센 칸이 칠해지지 않았으면 null — 값 있음은 주황 칸을 세지 않는다', () => {
    expect(aggregationTone('count_not_empty', 'main', rows, [noMain])).toBeNull()
  })

  it('다른 칸을 칠하는 규칙·흐림(muted)·칸을 세지 않는 집계는 색을 잇지 않는다', () => {
    const other = { ...noMain, target: 'sub' }
    const muted = { ...noMain, style: { tone: 'muted' as const } }
    expect(aggregationTone('count_empty', 'main', rows, [other])).toBeNull()
    expect(aggregationTone('count_empty', 'main', rows, [muted])).toBeNull()
    expect(aggregationTone('count', 'main', rows, [noMain])).toBeNull()
    expect(aggregationTone('count_empty', 'main', rows, undefined)).toBeNull()
  })

  it('빈 칸이 하나도 없으면 null(빈 값 0 은 본문 색)', () => {
    expect(aggregationTone('count_empty', 'main', [rows[0]!], [noMain])).toBeNull()
  })
})

describe('resolveCardFormat — 제 색으로 말하는 자리(배지 · 숫자 띠)', () => {
  const rule = {
    id: 'gap',
    target: 'gap',
    when: { op: 'and' as const, children: [{ key: 'gap', op: 'gt' as const, value: 0 }] },
    style: { tone: 'warning' as const },
  }

  it('그 속성을 대상으로 한 규칙은 칸 글자만 칠하고 카드 바탕은 두지 않는다', () => {
    const { card, byKey } = resolveCardFormat([rule], { gap: 20 }, ['title', 'gap'], ['gap'])
    expect(card).toBeNull()
    expect(byKey.gap).toEqual({ tone: 'warning' })
  })

  it('지정하지 않으면 예전처럼 카드를 칠한다', () => {
    expect(resolveCardFormat([rule], { gap: 20 }, ['title', 'gap']).card).toEqual({
      tone: 'warning',
    })
  })
})
