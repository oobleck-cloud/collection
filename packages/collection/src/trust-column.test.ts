import { describe, expect, it } from 'vitest'
import type { BlockDocument, BlockPack, PropertyDef, PropertyValue } from './types'
import { blankPack } from './blank-pack'
import { firstGeoKey, toGeoMarkers } from './map-markers'
import { writeTrust } from './trust'
import {
  GRADE_LABEL,
  TRUST_COLUMN_KEY,
  evidenceGapCount,
  triageOrder,
  trustColumnDef,
  trustColumnValue,
  withTrustColumn,
} from './trust-column'

const KEYS = ['addr', 'phone', 'seats']

/** 최소 팩 — 도메인 무관성을 보이기 위해 blankPack 이 아니라 직접 만든다. */
const basePack: BlockPack<Record<string, PropertyValue>> = {
  propertySchema: [
    { key: 'addr', label: '주소', type: 'text', source: 'frontmatter', origin: 'base' },
    { key: 'phone', label: '전화', type: 'phone', source: 'frontmatter', origin: 'base' },
    { key: 'seats', label: '자리', type: 'number', source: 'frontmatter', origin: 'base' },
  ],
  readProperties: (doc) => ({ ...(doc.properties ?? {}) }),
  writeProperty: (doc, key, value) => ({
    ...doc,
    properties: { ...(doc.properties ?? {}), [key]: value },
  }),
}

function docWith(grades: Partial<Record<string, Parameters<typeof writeTrust>[2]>>): BlockDocument {
  let d: BlockDocument = { properties: { addr: '서울', phone: '02-1', seats: 5 } }
  for (const [k, t] of Object.entries(grades)) if (t) d = writeTrust(d, k, t)
  return d
}

describe('trustColumnDef — 계산형 컬럼', () => {
  const def = trustColumnDef()
  it('projection 이라 셀에서 수정할 수 없다 — 등급은 근거에서 파생된다', () => {
    expect(def.source).toBe('projection')
    expect(def.key).toBe(TRUST_COLUMN_KEY)
  })
  it('옵션은 사람이 읽는 라벨 — 등급 이름은 개발자 어휘라 표에 내지 않는다', () => {
    const values = (def.options as { value: string }[]).map((o) => o.value)
    expect(values).toEqual([
      GRADE_LABEL.hypothesis,
      GRADE_LABEL.claimed,
      GRADE_LABEL.sourced,
      GRADE_LABEL.verified,
    ])
  })
  it('라벨을 바꿀 수 있다', () => {
    expect(trustColumnDef('근거').label).toBe('근거')
  })
})

describe('trustColumnValue — 가장 약한 셀이 행을 대표한다', () => {
  it('한 칸이라도 약하면 행 등급이 내려간다', () => {
    const doc = docWith({
      addr: { g: 'sourced', src: 's' },
      phone: { g: 'sourced', src: 's' },
      seats: { g: 'claimed' },
    })
    expect(trustColumnValue(doc, KEYS)).toBe(GRADE_LABEL.claimed)
  })
  it('전부 verified 면 verified', () => {
    const doc = docWith({
      addr: { g: 'verified', src: 's' },
      phone: { g: 'verified', src: 's' },
      seats: { g: 'verified', src: 's' },
    })
    expect(trustColumnValue(doc, KEYS)).toBe(GRADE_LABEL.verified)
  })
  it('등급이 하나도 없으면 확인 필요', () => {
    expect(trustColumnValue({ properties: {} }, KEYS)).toBe(GRADE_LABEL.hypothesis)
  })
})

describe('evidenceGapCount — 몇 칸이 비었나', () => {
  it('등급 미부여·hypothesis 칸을 센다', () => {
    const doc = docWith({ addr: { g: 'sourced', src: 's' }, phone: { g: 'hypothesis' } })
    // addr=sourced / phone=hypothesis / seats=미부여 → 2칸
    expect(evidenceGapCount(doc, KEYS)).toBe(2)
  })
  it('전부 근거가 있으면 0', () => {
    const doc = docWith({
      addr: { g: 'sourced', src: 's' },
      phone: { g: 'claimed' },
      seats: { g: 'claimed' },
    })
    expect(evidenceGapCount(doc, KEYS)).toBe(0)
  })
})

describe('withTrustColumn — 어떤 팩에든 한 줄로 붙는다', () => {
  const pack = withTrustColumn(basePack, KEYS)

  it('원본 팩을 변형하지 않는다', () => {
    expect(basePack.propertySchema).toHaveLength(3)
    expect(pack.propertySchema).toHaveLength(4)
  })

  it('스키마 끝에 신뢰도 컬럼이 붙는다', () => {
    expect(pack.propertySchema.at(-1)?.key).toBe(TRUST_COLUMN_KEY)
  })

  it('읽으면 계산된 등급 라벨이 함께 나온다', () => {
    const doc = docWith({
      addr: { g: 'sourced', src: 's' },
      phone: { g: 'sourced', src: 's' },
      seats: { g: 'claimed' },
    })
    const props = pack.readProperties(doc)
    expect(props.addr).toBe('서울') // 원래 값은 그대로
    expect(props[TRUST_COLUMN_KEY]).toBe(GRADE_LABEL.claimed)
  })

  it('파생 컬럼 쓰기는 삼킨다 — 두 개의 진실원천을 만들지 않는다', () => {
    const doc = docWith({ addr: { g: 'sourced', src: 's' } })
    const after = pack.writeProperty(doc, TRUST_COLUMN_KEY, '사람이 확인')
    expect(after).toBe(doc) // 원본 그대로
    expect(after.properties?.[TRUST_COLUMN_KEY]).toBeUndefined()
  })

  it('일반 컬럼 쓰기는 원래 팩에 위임한다', () => {
    const after = pack.writeProperty({ properties: {} }, 'addr', '부산')
    expect(after.properties?.addr).toBe('부산')
  })

  it('자기 자신을 dataKeys 에 넣어도 자기참조하지 않는다', () => {
    const p = withTrustColumn(basePack, [...KEYS, TRUST_COLUMN_KEY])
    const doc = docWith({
      addr: { g: 'sourced', src: 's' },
      phone: { g: 'sourced', src: 's' },
      seats: { g: 'sourced', src: 's' },
    })
    expect(p.readProperties(doc)[TRUST_COLUMN_KEY]).toBe(GRADE_LABEL.sourced)
  })

  it('writeTitle 등 원래 팩의 나머지 계약을 보존한다', () => {
    const withTitle: BlockPack<Record<string, PropertyValue>> = {
      ...basePack,
      writeTitle: (doc, v) => ({ ...doc, properties: { ...(doc.properties ?? {}), title: v } }),
    }
    expect(withTrustColumn(withTitle, KEYS).writeTitle).toBeDefined()
  })
})

describe('triageOrder — 손봐야 할 행이 먼저 온다', () => {
  const weak = docWith({ addr: { g: 'claimed' } }) // claimed + 빈칸 2
  const strong = docWith({
    addr: { g: 'sourced', src: 's' },
    phone: { g: 'sourced', src: 's' },
    seats: { g: 'sourced', src: 's' },
  })
  it('약한 행이 앞선다', () => {
    expect(triageOrder(weak, KEYS)).toBeLessThan(triageOrder(strong, KEYS))
  })
  it('같은 등급이면 빈 칸이 많은 행이 앞선다', () => {
    const gap1 = docWith({
      addr: { g: 'claimed' },
      phone: { g: 'claimed' },
      seats: { g: 'hypothesis' },
    })
    const gap2 = docWith({ addr: { g: 'claimed' } }) // phone·seats 미부여 → 빈칸 2
    expect(triageOrder(gap2, KEYS)).toBeLessThan(triageOrder(gap1, KEYS))
  })
})

// ⛔ 손님 화면엔 등급이 없다 — 등급은 **만드는 사람의 도구**다(사용자 확정 2026-07-28).
// 지도 마커는 손님이 보는 표면이므로, 신뢰도 컬럼이 pack 에 얹혀 있어도 마커 모델에 새어나오면 안 된다.
// 이 핀이 지키는 것: 마커는 geo 값에서만 만들어지고 readProperties 의 파생 등급을 label 로 쓰지 않는다.
describe('신뢰도 컬럼은 손님 표면(지도 마커)으로 새지 않는다', () => {
  const pack = withTrustColumn(blankPack, ['geo'])
  const schema: PropertyDef[] = [
    { key: 'title', label: '이름', type: 'text', source: 'frontmatter', origin: 'base' },
    { key: 'geo', label: '위치', type: 'geo', source: 'frontmatter', origin: 'base' },
    trustColumnDef(),
  ]
  const rows = [
    {
      id: 'r1',
      props: pack.readProperties({
        properties: {
          title: '종로 야장',
          geo: {
            coordinate: { x: 126.99, y: 37.57, type: 'WGS84' as const },
            roadAddress: '서울 종로구 종로 1',
          },
        },
        // 근거 없음 = '확인 필요'. 손님에게 이 말이 보이면 안 된다.
      }),
    },
  ]

  it('마커 라벨·id 어디에도 등급 라벨이 없다', () => {
    const markers = toGeoMarkers(rows, firstGeoKey(schema))
    expect(markers).toHaveLength(1)
    const serialized = JSON.stringify(markers)
    for (const label of Object.values(GRADE_LABEL)) {
      expect(serialized).not.toContain(label)
    }
    expect(serialized).not.toContain(TRUST_COLUMN_KEY)
  })

  it('geo 키 선택이 신뢰도 컬럼에 걸리지 않는다(첫 geo 는 여전히 위치 컬럼)', () => {
    expect(firstGeoKey(schema)).toBe('geo')
  })
})
