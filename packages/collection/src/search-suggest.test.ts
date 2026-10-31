// 자동완성 엔진 — **접두 검증**이 핵심 계약이다.
//
// 이 파일이 지키는 것 하나: 검증기는 "유효한가" 가 아니라 "자라날 수 있는가" 를 묻는다.
// 완성형 검증으로 슬쩍 바뀌어도 화면은 멀쩡해 보이고 — 다 치고 나면 제안이 뜨니까 —
// "타이핑 중엔 아무것도 안 뜬다" 는 것만 조용히 사라진다. 그래서 부분 입력을 못박는다.

import { describe, expect, it } from 'vitest'

import {
  asyncSuggesters,
  compositeSuggestions,
  builtinSuggester,
  digitsOf,
  numberPrefixStrength,
  phoneStrength,
  rankSuggestions,
  syncSuggestions,
} from './search-suggest'

import type { PropertyDef } from './types'

function def(over: Partial<PropertyDef> & Pick<PropertyDef, 'key' | 'type'>): PropertyDef {
  return {
    label: over.key,
    source: 'projection',
    origin: 'preset',
    ...over,
  } as PropertyDef
}

describe('phoneStrength — 러프 + 접두', () => {
  it('타이핑 중인 조각도 전화로 본다', () => {
    for (const t of ['010', '0101', '010-1', '010-1234', '010 1234 5678', '02', '031-']) {
      expect(phoneStrength(t), t).toBe('strong')
    }
  })

  it('하이픈·공백·점·괄호를 벗기고 판단한다', () => {
    expect(digitsOf('010-1234.5678')).toBe('01012345678')
    expect(phoneStrength('(02) 123-4567')).toBe('strong')
  })

  it('0 으로 시작하지 않는 숫자는 약하게 — 가운데부터 기억해 치는 경우', () => {
    expect(phoneStrength('12345')).toBe('weak')
    expect(phoneStrength('203')).toBe('none') // 너무 짧아 전화로 보기 어렵다
  })

  it('글자가 섞이면 전화가 아니다', () => {
    expect(phoneStrength('부평')).toBe('none')
    expect(phoneStrength('010가')).toBe('none')
  })

  it('숫자 0 한 자리만으로는 아직 아무것도 아니다', () => {
    expect(phoneStrength('0')).toBe('weak')
  })
})

describe('numberPrefixStrength — 선행 0 이 전화와 번호를 가른다', () => {
  it('일련번호는 0 으로 시작하지 않는다', () => {
    expect(numberPrefixStrength('2034479')).toBe('strong')
    expect(numberPrefixStrength('203')).toBe('strong')
  })

  it('0 으로 시작하면 번호 후보에서 뺀다 — 그건 전화 쪽이다', () => {
    expect(numberPrefixStrength('010')).toBe('none')
  })

  it('숫자가 아니면 none', () => {
    expect(numberPrefixStrength('부평')).toBe('none')
    expect(numberPrefixStrength('2026-09')).toBe('none')
  })
})

describe('builtinSuggester', () => {
  it('select 은 원시값이 아니라 **라벨**로 맞춘다', () => {
    const status = def({
      key: 'status',
      type: 'select',
      label: '상태',
      options: [
        { value: 'lead_in', label: '접수됨' },
        { value: 'visit_appointed', label: '플래너 배정됨' },
      ],
    })
    // 사용자는 'lead_in' 을 치지 않는다.
    expect(builtinSuggester('접수', status)).toMatchObject([
      {
        conditions: [{ key: 'status', op: 'eq', value: 'lead_in' }],
        propertyLabel: '상태',
        valueLabel: '접수됨',
        strength: 'strong',
      },
    ])
    expect(builtinSuggester('lead_in', status)).toEqual([])
  })

  it('하루를 짚으면 "그 날" 이 먼저, 그 뒤 이후·이전', () => {
    const d = def({ key: 'moveDate', type: 'date', label: '이사 예정일' })
    const out = builtinSuggester('8월 13일', d, new Date(2026, 7, 16))
    expect(out.map((s) => s.conditions[0]?.op)).toEqual(['eq', 'gte', 'lte'])
    expect(out.map((s) => s.conditions[0]?.value)).toEqual([
      '2026-08-13',
      '2026-08-13',
      '2026-08-13',
    ])
    expect(out[0]?.valueLabel).toBe('2026년 8월 13일')
  })

  it('달을 짚으면 **범위 제안**이 먼저 — 조건 두 개가 한 쌍으로 들어간다', () => {
    // `≥ 8월 1일` 만 넣으면 "8월" 이 아니라 "8월부터 영원히" 가 된다.
    const d = def({ key: 'moveDate', type: 'date', label: '이사 예정일' })
    const out = builtinSuggester('8월', d, new Date(2026, 7, 16))
    expect(out[0]?.conditions).toEqual([
      { key: 'moveDate', op: 'gte', value: '2026-08-01' },
      { key: 'moveDate', op: 'lte', value: '2026-08-31' },
    ])
    expect(out[0]?.valueLabel).toBe('2026년 8월')
    // 범위는 연산자 기호가 없다 — 라벨 자체가 범위다.
    expect(out[0]?.opLabel).toBe('')
    expect(out.slice(1).map((s) => s.conditions[0]?.op)).toEqual(['gte', 'lte'])
  })

  it('"이번 주" 도 범위 — 월요일부터 일요일까지 한 쌍', () => {
    const d = def({ key: 'moveDate', type: 'date', label: '이사 예정일' })
    const out = builtinSuggester('이번 주', d, new Date(2026, 7, 16))
    expect(out[0]?.conditions).toEqual([
      { key: 'moveDate', op: 'gte', value: '2026-08-10' },
      { key: 'moveDate', op: 'lte', value: '2026-08-16' },
    ])
  })

  it('text 는 언제나 가능하지만 근거가 약하다', () => {
    const t = def({ key: 'departure', type: 'text', label: '출발지' })
    expect(builtinSuggester('부평', t)).toMatchObject([
      {
        conditions: [{ key: 'departure', op: 'contains', value: '부평' }],
        propertyLabel: '출발지',
        valueLabel: '부평',
        strength: 'weak',
      },
    ])
  })

  it('객체값(geo/button)·checkbox 는 낱말로 겨눌 수 없다', () => {
    expect(builtinSuggester('부평', def({ key: 'g', type: 'geo' }))).toEqual([])
    expect(builtinSuggester('부평', def({ key: 'b', type: 'button' }))).toEqual([])
    expect(builtinSuggester('예', def({ key: 'c', type: 'checkbox' }))).toEqual([])
  })
})

describe('syncSuggestions — 스키마 전체에서 노이즈를 거른다', () => {
  const SCHEMA: PropertyDef[] = [
    def({ key: 'misoOrderId', type: 'number', label: '주문번호' }),
    def({
      key: 'status',
      type: 'select',
      label: '상태',
      options: [{ value: 'lead_in', label: '접수됨' }],
    }),
    def({ key: 'phone', type: 'phone', label: '연락처' }),
    def({ key: 'moveDate', type: 'date', label: '이사 예정일' }),
    def({ key: 'departure', type: 'text', label: '출발지' }),
  ]

  it('"부평" — 날짜·번호·전화 컬럼이 딸려오지 않는다', () => {
    expect(syncSuggestions('부평', SCHEMA).map((s) => s.conditions[0]?.key)).toEqual(['departure'])
  })

  it('"관악" — 주문번호가 딸려오지 않는다(값이 수인 컬럼은 number 로 선언한다)', () => {
    // 주문번호를 text 로 두면 "무엇이든 부분일치" 규칙에 걸려 "주문번호 포함 관악" 이 뜬다.
    expect(syncSuggestions('관악', SCHEMA).map((s) => s.conditions[0]?.key)).toEqual(['departure'])
  })

  it('"8월 13일" — 날짜 컬럼만, 텍스트 컬럼은 딸려오지 않는다', () => {
    const out = syncSuggestions('8월 13일', SCHEMA, new Date(2026, 7, 16))
    expect(new Set(out.map((s) => s.conditions[0]?.key))).toEqual(new Set(['moveDate']))
    expect(out.map((s) => s.conditions[0]?.op)).toEqual(['eq', 'gte', 'lte'])
  })

  it('"010" — 전화로 가고 주문번호로는 가지 않는다(선행 0)', () => {
    const keys = syncSuggestions('010', SCHEMA).map((s) => s.conditions[0]?.key)
    expect(keys).toContain('phone')
    expect(keys).not.toContain('misoOrderId')
  })

  it('"2034479" — 주문번호가 전화보다 앞선다(strong > weak)', () => {
    const keys = syncSuggestions('2034479', SCHEMA).map((s) => s.conditions[0]?.key)
    expect(keys[0]).toBe('misoOrderId')
    expect(keys).toContain('phone') // 가운데부터 친 번호일 수 있으므로 남기되 뒤로
  })

  it('"접수" — 상태 옵션이 텍스트 부분일치보다 앞선다', () => {
    const out = syncSuggestions('접수', SCHEMA)
    expect(out[0]?.conditions[0]?.key).toBe('status')
    expect(out[0]?.strength).toBe('strong')
  })

  it('빈 낱말이면 아무것도 제안하지 않는다', () => {
    expect(syncSuggestions('', SCHEMA)).toEqual([])
    expect(syncSuggestions('   ', SCHEMA)).toEqual([])
  })

  it('조사형(suggest 를 단) 컬럼은 동기 목록에서 빠진다 — 비동기로 따로 온다', () => {
    const withProbe: PropertyDef[] = [
      ...SCHEMA,
      def({ key: 'workRegionCode', type: 'text', label: '서비스 구역', suggest: () => [] }),
    ]
    expect(syncSuggestions('부평', withProbe).map((s) => s.conditions[0]?.key)).toEqual([
      'departure',
    ])
    expect(asyncSuggesters(withProbe).map((d) => d.key)).toEqual(['workRegionCode'])
  })
})

describe('rankSuggestions', () => {
  it('strong 먼저, 같은 등급은 스키마 선언 순서를 지킨다', () => {
    const mk = (key: string, strength: 'strong' | 'weak') => ({
      id: key,
      conditions: [{ key, op: 'contains' as const, value: 'x' }],
      propertyLabel: key,
      opLabel: '포함',
      valueLabel: 'x',
      strength,
    })
    expect(
      rankSuggestions([mk('a', 'weak'), mk('b', 'strong'), mk('c', 'weak')]).map(
        (s) => s.conditions[0]?.key,
      ),
    ).toEqual(['b', 'a', 'c'])
  })

  it('none 은 목록에서 빠진다', () => {
    expect(
      rankSuggestions([
        {
          id: 'a',
          conditions: [{ key: 'a', op: 'contains', value: 'x' }],
          propertyLabel: 'a',
          opLabel: '포함',
          valueLabel: 'x',
          strength: 'none',
        },
      ]),
    ).toEqual([])
  })
})

describe('number — 부분 입력엔 "포함", 완성 입력엔 "="', () => {
  // 주문번호가 7자리인데 `2034` 까지 친 것을 `= 2034` 로 제안하면 결과는 0건이다.
  // 접두 검증은 넣었는데 **연산자 선택**이 완성형 가정에 머물러 있던 자리다.
  const withDigits = def({ key: 'misoOrderId', type: 'number', label: '주문번호', digits: 7 })
  const noHint = def({ key: 'n', type: 'number', label: '번호' })

  it('자릿수가 맞으면 = 하나', () => {
    const out = builtinSuggester('2034479', withDigits)
    expect(out).toHaveLength(1)
    expect(out[0]?.conditions).toEqual([{ key: 'misoOrderId', op: 'eq', value: 2034479 }])
  })

  it('자릿수가 모자라면 포함 하나', () => {
    const out = builtinSuggester('2034', withDigits)
    expect(out).toHaveLength(1)
    expect(out[0]?.conditions).toEqual([{ key: 'misoOrderId', op: 'contains', value: '2034' }])
  })

  it('자릿수를 모르면 둘 다 낸다 — 모르는 걸 추측하지 않는다', () => {
    expect(builtinSuggester('2034', noHint).map((s) => s.conditions[0]?.op)).toEqual([
      'eq',
      'contains',
    ])
  })

  it('# 접두는 벗긴다 — 주문번호를 옮겨 적을 때 붙는 표기', () => {
    const out = builtinSuggester('#2034479', withDigits)
    expect(out[0]?.conditions).toEqual([{ key: 'misoOrderId', op: 'eq', value: 2034479 }])
  })
})

describe('searchOnly — 표에 없지만 검색은 아는 필드', () => {
  // 주문 목록은 전화번호를 컬럼으로 보여주지 않지만 서버는 전화번호로 훑는다.
  // 제안 대상이 "표시 컬럼" 이면 `010` 에 아무 말도 못 하고, 사용자는
  // "이 목록은 전화번호를 모르는구나" 로 잘못 배운다.
  const SCHEMA: PropertyDef[] = [
    def({ key: 'departure', type: 'text', label: '출발지' }),
    def({ key: 'phone', type: 'phone', label: '전화번호', searchOnly: true }),
  ]

  it('숨은 필드도 제안한다', () => {
    const out = syncSuggestions('010-1234', SCHEMA)
    expect(out.map((s) => s.conditions[0]?.key)).toContain('phone')
    expect(out[0]?.propertyLabel).toBe('전화번호') // strong 이라 텍스트보다 앞
  })

  it('제안 대상 판단은 타입 규칙 그대로 — 낱말은 전화로 가지 않는다', () => {
    expect(syncSuggestions('부평', SCHEMA).map((s) => s.conditions[0]?.key)).toEqual(['departure'])
  })
})

describe('복합 제안 — 낱말이 여럿일 때', () => {
  const SCHEMA: PropertyDef[] = [
    def({ key: 'misoOrderId', type: 'number', label: '주문번호', digits: 7 }),
    def({
      key: 'status',
      type: 'select',
      label: '상태',
      options: [{ value: 'lead_in', label: '접수됨' }],
    }),
    def({ key: 'moveDate', type: 'date', label: '이사 예정일' }),
    def({ key: 'departure', type: 'text', label: '출발지' }),
    def({ key: 'destination', type: 'text', label: '도착지' }),
  ]
  const NOW = new Date(2026, 7, 16)

  it('"관악 8월" — 조건 두 개가 한 제안에 들어간다', () => {
    const out = syncSuggestions('관악 8월', SCHEMA, NOW)
    const composite = out[0]
    // 복합이 맨 앞 — 낱말을 여럿 친 사용자는 대개 조건도 여럿을 원한다.
    expect(composite?.conditions.length).toBeGreaterThan(1)
    expect(composite?.conditions.map((c) => c.key)).toContain('moveDate')
    expect(composite?.conditions.map((c) => c.key)).toContain('departure')
  })

  it('"접수 8월" — 옵션 + 날짜', () => {
    const out = syncSuggestions('접수 8월', SCHEMA, NOW)
    expect(out[0]?.conditions).toEqual(
      expect.arrayContaining([{ key: 'status', op: 'eq', value: 'lead_in' }]),
    )
  })

  it('"서울 강남" — 한 주소 구문이지 조건 둘이 아니다', () => {
    // 전부 텍스트 부분일치(weak)면 쪼개지 않는다. 쪼개면
    // `출발지 포함 서울 AND 도착지 포함 강남` 같은 뜻 없는 제안이 된다.
    const out = syncSuggestions('서울 강남', SCHEMA, NOW)
    expect(out.every((s) => s.conditions.length === 1)).toBe(true)
  })

  it('"8월 13일" · "이번 주" — 전체가 하나의 날짜면 쪼개지 않는다', () => {
    for (const t of ['8월 13일', '이번 주', '3일 전']) {
      const out = syncSuggestions(t, SCHEMA, NOW)
      expect(
        out.every((s) => new Set(s.conditions.map((c) => c.key)).size === 1),
        t,
      ).toBe(true)
    }
  })

  it('조각마다 다른 컬럼을 겨눈다 — 같은 컬럼 두 번은 서로를 지운다', () => {
    for (const s of syncSuggestions('접수 8월', SCHEMA, NOW)) {
      if (!s.id.startsWith('composite:')) continue
      // 컬럼은 둘 이상이어야 복합이다.
      expect(new Set(s.conditions.map((c) => c.key)).size).toBeGreaterThanOrEqual(2)
      // 같은 키가 반복되는 건 **범위(gte+lte)** 뿐이다 — 같은 연산자가 두 번 나오면
      // 한 조각이 다른 조각을 덮어쓴 것이다.
      const pairs = s.conditions.map((c) => `${c.key}:${c.op}`)
      expect(new Set(pairs).size).toBe(pairs.length)
    }
  })

  it('낱말 하나면 복합은 없다', () => {
    expect(compositeSuggestions('관악', SCHEMA, NOW)).toEqual([])
  })

  it('네 낱말 이상은 문장이지 조건이 아니다', () => {
    expect(compositeSuggestions('서울 관악구 신림동 8월', SCHEMA, NOW)).toEqual([])
  })
})
