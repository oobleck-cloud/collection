// @vitest-environment jsdom
//
// 자동완성 **실행** 층 — 규칙이 아니라 시간을 검증한다.
//
// 여기서 잡는 버그들은 전부 "화면은 멀쩡한데 틀린" 종류다. 낡은 응답이 최신 입력을 덮어써도
// 그럴듯한 목록이 떠 있고, 판정기 하나가 죽어 목록이 통째로 비어도 "결과 없음"과 구별되지
// 않는다. 그래서 눈으로 못 잡는 이 네 가지를 못박는다.

import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSearchSuggest } from './useSearchSuggest'

import type { SearchSuggestion } from '@oobleck/collection'
import type { PropertyDef } from '@oobleck/collection'

function def(over: Partial<PropertyDef> & Pick<PropertyDef, 'key' | 'type'>): PropertyDef {
  return { label: over.key, source: 'projection', origin: 'preset', ...over } as PropertyDef
}

function hit(key: string, label: string): SearchSuggestion {
  return {
    id: `${key}:eq:${label}`,
    conditions: [{ key, op: 'eq', value: label }],
    propertyLabel: key,
    opLabel: '=',
    valueLabel: label,
    strength: 'strong',
  }
}

/** 훅의 결과를 DOM 으로 뱉는 얇은 하니스 — 렌더 결과만 보면 되므로 별도 라이브러리 없이. */
function Harness({ term, schema }: { term: string; schema: PropertyDef[] }) {
  const { suggestions, probing } = useSearchSuggest(term, schema)
  return (
    <div>
      <span data-testid="probing">{String(probing)}</span>
      <ul data-testid="list">
        {suggestions.map((s) => (
          <li key={s.id}>{`${s.conditions[0]?.key}:${s.valueLabel}`}</li>
        ))}
      </ul>
    </div>
  )
}

function items(): string[] {
  return Array.from(screen.getByTestId('list').querySelectorAll('li')).map(
    (li) => li.textContent ?? '',
  )
}

const TEXT_COL = def({ key: 'departure', type: 'text', label: '출발지' })

describe('useSearchSuggest', () => {
  it('동기 제안은 조사(비동기)를 기다리지 않고 즉시 나온다', () => {
    // 구역 조회 한 건 때문에 드롭다운 전체가 멈추면, 있는 답도 없는 것처럼 보인다.
    const slow = def({
      key: 'region',
      type: 'text',
      label: '구역',
      suggest: () => new Promise(() => []), // 영원히 안 끝남
    })
    render(<Harness term="부평" schema={[TEXT_COL, slow]} />)
    expect(items()).toEqual(['departure:부평'])
  })

  it('조사 결과가 도착하면 합류한다', async () => {
    vi.useFakeTimers()
    const probe = def({
      key: 'region',
      type: 'text',
      label: '구역',
      suggest: () => Promise.resolve([hit('region', '서울-부평구')]),
    })
    render(<Harness term="부평" schema={[TEXT_COL, probe]} />)
    expect(items()).toEqual(['departure:부평'])

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(items()).toContain('region:서울-부평구')
    expect(screen.getByTestId('probing').textContent).toBe('false')
    vi.useRealTimers()
  })

  it('낡은 응답은 최신 입력의 결과를 덮어쓰지 않는다', async () => {
    vi.useFakeTimers()
    // "성북" 요청은 느리고 "성북구" 요청은 빠르다 — 앞 요청이 나중에 도착한다.
    const suggest = vi.fn((term: string) =>
      term === '성북'
        ? new Promise<SearchSuggestion[]>((r) =>
            setTimeout(() => r([hit('region', 'STALE')]), 5000),
          )
        : Promise.resolve([hit('region', '서울-성북구')]),
    )
    const probe = def({ key: 'region', type: 'text', label: '구역', suggest })

    const { rerender } = render(<Harness term="성북" schema={[probe]} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    rerender(<Harness term="성북구" schema={[probe]} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(items()).toEqual(['region:서울-성북구'])

    // 느린 앞 요청이 이제 도착하지만 세대가 달라 버려진다.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000)
    })
    expect(items()).toEqual(['region:서울-성북구'])
    vi.useRealTimers()
  })

  it('판정기가 던져도 나머지 목록은 산다', async () => {
    vi.useFakeTimers()
    const boom = def({
      key: 'region',
      type: 'text',
      label: '구역',
      suggest: () => Promise.reject(new Error('API down')),
    })
    render(<Harness term="부평" schema={[TEXT_COL, boom]} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(items()).toEqual(['departure:부평'])
    expect(screen.getByTestId('probing').textContent).toBe('false')
    vi.useRealTimers()
  })

  it('느린 판정기는 타임아웃으로 빠지고 목록을 붙잡지 않는다', async () => {
    vi.useFakeTimers()
    const slow = def({
      key: 'region',
      type: 'text',
      label: '구역',
      suggest: () =>
        new Promise<SearchSuggestion[]>((r) =>
          setTimeout(() => r([hit('region', '늦음')]), 60_000),
        ),
    })
    render(<Harness term="부평" schema={[TEXT_COL, slow]} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000) // 디바운스 200 + 타임아웃 2500
    })
    expect(items()).toEqual(['departure:부평'])
    expect(screen.getByTestId('probing').textContent).toBe('false')
    vi.useRealTimers()
  })

  it('같은 낱말을 다시 치면 재조회하지 않는다(term+key 캐시)', async () => {
    vi.useFakeTimers()
    const suggest = vi.fn(() => Promise.resolve([hit('region', '서울-부평구')]))
    const probe = def({ key: 'region', type: 'text', label: '구역', suggest })

    const { rerender } = render(<Harness term="부평" schema={[probe]} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(suggest).toHaveBeenCalledTimes(1)

    rerender(<Harness term="부" schema={[probe]} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    rerender(<Harness term="부평" schema={[probe]} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    // "부" 는 새 질문이라 1회 늘고, "부평" 은 캐시에서 나온다.
    expect(suggest).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('빈 낱말이면 조사를 시작하지 않는다', () => {
    const suggest = vi.fn(() => Promise.resolve([]))
    const probe = def({ key: 'region', type: 'text', label: '구역', suggest })
    render(<Harness term="   " schema={[probe]} />)
    expect(items()).toEqual([])
    expect(suggest).not.toHaveBeenCalled()
  })
})
