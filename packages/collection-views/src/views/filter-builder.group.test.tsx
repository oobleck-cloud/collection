import { describe, expect, it, vi } from 'vitest'

// DS 배럴은 vitest 에서 별칭 경로가 풀리지 않는다 — 이 시험은 순수 함수만 보므로 통째로 비운다.
vi.mock('@oobleck/systheme', () => ({}))

import { propertyOption } from './filter-builder'

import type { PropertyDef } from '@oobleck/collection'

function def(over: Partial<PropertyDef>): PropertyDef {
  return { key: 'k', label: '라벨', type: 'text', source: 'projection', origin: 'preset', ...over }
}

describe('조건 추가 목록 — 속성의 자리와 별칭', () => {
  it('경로를 머리글과 보조 글로 싣는다', () => {
    expect(
      propertyOption(
        def({
          key: 'contractPartnerScore',
          label: '계약 파트너 평점',
          group: ['견적', '계약 파트너'],
        }),
      ),
    ).toEqual({
      value: 'contractPartnerScore',
      label: '계약 파트너 평점',
      group: '견적 › 계약 파트너',
      hint: '견적 › 계약 파트너',
    })
  })

  it('별칭은 검색어로만 — 화면에는 보이지 않는다', () => {
    expect(propertyOption(def({ aliases: ['이사일'] })).keywords).toEqual(['이사일'])
  })

  it('자리가 없으면 묶음 없이 — 예전 평평한 목록과 같다', () => {
    expect(propertyOption(def({}))).toEqual({ value: 'k', label: '라벨' })
    expect(propertyOption(def({ group: [], aliases: [] }))).toEqual({ value: 'k', label: '라벨' })
  })
})
