// 차트 막대 모델(toBars) 순수 변환 — 정규화·라벨/색 패스스루·0 나눗셈 가드 핀.
//
// 막대 길이는 최대 그룹 대비 비율(pct)로 정규화된다. 핵심 회귀:
//   - max=0(모든 그룹 count 0) → 0 나눗셈 금지(pct=0, NaN 아님).
//   - 단일 max → 100, 나머지는 round(count/max*100).
//   - GROUP_EMPTY 는 labelMap 없으면 '없음'.

import { describe, it, expect } from 'vitest'
import { toBars } from './chart-bars'
import { GROUP_EMPTY } from '@oobleck/collection'

const noLabels = new Map<string, string>()
const noColors = new Map<string, string>()

describe('toBars — 막대 모델 변환', () => {
  it('빈 그룹 → 빈 배열', () => {
    expect(toBars([], noLabels, noColors)).toEqual([])
  })

  it('모든 그룹 count 0(max=0) → pct 0, 0 나눗셈 없음(NaN/Infinity 아님)', () => {
    const bars = toBars(
      [
        { key: 'a', count: 0 },
        { key: 'b', count: 0 },
      ],
      noLabels,
      noColors,
    )
    expect(bars.map((b) => b.pct)).toEqual([0, 0])
    expect(bars.every((b) => Number.isFinite(b.pct))).toBe(true)
  })

  it('단일 최대 그룹 → 100%, 나머지는 비율 정규화', () => {
    const bars = toBars(
      [
        { key: 'a', count: 10 },
        { key: 'b', count: 5 },
        { key: 'c', count: 2 },
      ],
      noLabels,
      noColors,
    )
    expect(bars.map((b) => b.pct)).toEqual([100, 50, 20])
    expect(bars.map((b) => b.count)).toEqual([10, 5, 2])
  })

  it('정규화 비율은 반올림(round)된다', () => {
    // 1/3 = 33.33… → 33, 2/3 = 66.66… → 67.
    const bars = toBars(
      [
        { key: 'a', count: 3 },
        { key: 'b', count: 1 },
        { key: 'c', count: 2 },
      ],
      noLabels,
      noColors,
    )
    expect(bars.map((b) => b.pct)).toEqual([100, 33, 67])
  })

  it('labelMap·colorMap 패스스루 — 있으면 라벨/색 반영', () => {
    const labels = new Map([['active', '활성']])
    const colors = new Map([['active', 'green']])
    const bars = toBars([{ key: 'active', count: 4 }], labels, colors)
    expect(bars[0].label).toBe('활성')
    expect(bars[0].color).toBe('green')
  })

  it('색이 없는 키는 color 미지정(undefined)', () => {
    const bars = toBars([{ key: 'x', count: 1 }], noLabels, noColors)
    expect(bars[0].color).toBeUndefined()
  })

  it('GROUP_EMPTY 키 — labelMap 없으면 라벨 "없음"', () => {
    const bars = toBars([{ key: GROUP_EMPTY, count: 2 }], noLabels, noColors)
    expect(bars[0].label).toBe('없음')
  })

  it('labelMap 없고 일반 키면 키를 라벨로 그대로 사용', () => {
    const bars = toBars([{ key: 'raw_key', count: 1 }], noLabels, noColors)
    expect(bars[0].label).toBe('raw_key')
  })
})
