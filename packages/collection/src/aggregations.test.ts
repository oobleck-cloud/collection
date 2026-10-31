import { describe, it, expect } from 'vitest'
import { AGGREGATION_LABEL, computeAggregation } from './aggregations'
import type { GeoValue, PropertyValue } from './types'

// 집계 함수 — 컬럼 footer 의 결과 문자열을 생성한다. type='none' 은 빈 문자열.

describe('computeAggregation — count 계열', () => {
  it('none 은 항상 빈 문자열', () => {
    expect(computeAggregation('none', [1, 2, 3])).toBe('')
  })

  it('count 는 전체 행 수(셀 값 무관)', () => {
    expect(computeAggregation('count', [1, null, '', 2])).toBe('4')
  })

  it('count_empty / count_not_empty — null·빈문자열·빈배열 만 빈 값(0/false 는 값 있음)', () => {
    const vals: (PropertyValue | undefined)[] = [null, undefined, '', [], 0, false, 'x', ['a']]
    expect(computeAggregation('count_empty', vals)).toBe('4') // null,undef,'',[]
    expect(computeAggregation('count_not_empty', vals)).toBe('4') // 0,false,'x',['a']
  })

  it('count_unique — 배열은 평탄화 후 집합', () => {
    expect(computeAggregation('count_unique', ['a', 'b', 'a', null, ['c', 'a']])).toBe('3')
  })

  it('count_unique — 서로 다른 객체(geo)는 구조 기준으로 구분(String 뭉개짐 방지)', () => {
    const a: GeoValue = { coordinate: { x: 126.97, y: 37.56, type: 'WGS84' }, roadAddress: '서울' }
    const b: GeoValue = { coordinate: { x: 129.07, y: 35.17, type: 'WGS84' }, roadAddress: '부산' }
    const c: GeoValue = { coordinate: { x: 126.7, y: 37.45, type: 'WGS84' }, roadAddress: '인천' }
    // 셋 다 String() 으로는 "[object Object]" 라 1 로 뭉개졌었다 → 이제 3.
    expect(computeAggregation('count_unique', [a, b, c])).toBe('3')
  })

  it('count_unique — 동일한 객체(geo)는 1 로 집계', () => {
    const a: GeoValue = { coordinate: { x: 126.97, y: 37.56, type: 'WGS84' }, roadAddress: '서울' }
    const aCopy: GeoValue = {
      coordinate: { x: 126.97, y: 37.56, type: 'WGS84' },
      roadAddress: '서울',
    }
    expect(computeAggregation('count_unique', [a, aCopy])).toBe('1')
  })
})

describe('computeAggregation — 수치 집계(숫자/날짜만)', () => {
  it('sum / avg — 한국식 천단위 구분', () => {
    expect(computeAggregation('sum', [1000, 2000, 3500])).toBe('6,500')
    expect(computeAggregation('avg', [1000, 2000])).toBe('1,500')
  })

  it('min / max — 음수 포함', () => {
    expect(computeAggregation('min', [3, -1, 5])).toBe('-1')
    expect(computeAggregation('max', [3, -1, 5])).toBe('5')
  })

  it('비숫자 셀은 스킵(부분 집계 가능)', () => {
    expect(computeAggregation('sum', ['x', 10, null, 20])).toBe('30')
  })

  it('모두 비숫자면 빈 문자열', () => {
    expect(computeAggregation('sum', ['x', null, ''])).toBe('')
    expect(computeAggregation('avg', [])).toBe('')
  })

  it('소수점은 2자리까지 표시', () => {
    expect(computeAggregation('avg', [1, 2])).toBe('1.5')
    expect(computeAggregation('avg', [1, 2, 2])).toMatch(/^1\.6[67]$/)
  })

  it('날짜 ISO 문자열도 비교 가능(epoch ms 기반)', () => {
    // 2024-01-01 vs 2025-01-01 — min 은 더 이른 날짜의 epoch ms.
    const a = Date.parse('2024-01-01T00:00:00Z')
    const b = Date.parse('2025-01-01T00:00:00Z')
    expect(computeAggregation('min', ['2024-01-01T00:00:00Z', '2025-01-01T00:00:00Z'])).toBe(
      a.toLocaleString('ko-KR'),
    )
    expect(computeAggregation('max', ['2024-01-01T00:00:00Z', '2025-01-01T00:00:00Z'])).toBe(
      b.toLocaleString('ko-KR'),
    )
  })
})

describe('AGGREGATION_LABEL — 한국어 라벨', () => {
  it('모든 타입에 라벨 존재', () => {
    expect(AGGREGATION_LABEL.none).toBe('없음')
    expect(AGGREGATION_LABEL.count).toBe('전체 수')
    expect(AGGREGATION_LABEL.sum).toBe('합계')
    expect(AGGREGATION_LABEL.avg).toBe('평균')
  })
})
