import { describe, it, expect } from 'vitest'
import { collectionConfigSchema, blockDocumentSchema } from './collection-schema'

// 회귀 핀: 프리셋 컬럼 이름변경(properties[key].label)이 PATCH(collectionConfigSchema 검증)를 통과해
// 영속되는지. 과거엔 Zod 에 label 이 누락돼 strip → 프리셋 컬럼 rename 이 유실됐다(이 테스트가 그 회귀를 막음).

describe('collectionConfigSchema — properties 오버라이드', () => {
  it('properties[key].label 을 보존한다(프리셋 컬럼 이름변경 영속)', () => {
    const config = { properties: { title: { label: '이름' } } }
    const parsed = collectionConfigSchema.parse(config)
    expect(parsed.properties?.title?.label).toBe('이름')
  })

  it('label + options + locked + width 를 함께 보존', () => {
    const config = {
      properties: {
        status: {
          label: '상태',
          options: [{ value: 'todo', label: '할 일' }],
          locked: true,
          width: { mode: 'fixed', px: 200 },
        },
      },
    }
    const parsed = collectionConfigSchema.parse(config)
    const p = parsed.properties?.status
    expect(p?.label).toBe('상태')
    expect(p?.options).toEqual([{ value: 'todo', label: '할 일' }])
    expect(p?.locked).toBe(true)
    expect(p?.width).toEqual({ mode: 'fixed', px: 200 })
  })

  it('label 64자 초과는 거부(base label 캡과 정렬)', () => {
    const config = { properties: { title: { label: 'x'.repeat(65) } } }
    expect(collectionConfigSchema.safeParse(config).success).toBe(false)
  })

  it('properties 항목의 미지 키는 여전히 strip(주입 방어)', () => {
    const config = { properties: { title: { label: '이름', evil: 'x' } } }
    const parsed = collectionConfigSchema.parse(config)
    expect('evil' in (parsed.properties?.title ?? {})).toBe(false)
  })

  it('base 동적 컬럼·views·activeViewId 라운드트립(sanity)', () => {
    const config = {
      base: [{ key: 'amount', label: '금액', type: 'number' as const }],
      views: [{ id: 'v1', name: '기본', config: { visibleProps: ['title', 'amount'] } }],
      activeViewId: 'v1',
    }
    const parsed = collectionConfigSchema.parse(config)
    expect(parsed.base?.[0]).toEqual({ key: 'amount', label: '금액', type: 'number' })
    expect(parsed.views?.[0]?.name).toBe('기본')
    expect(parsed.activeViewId).toBe('v1')
  })

  it('description(노션식 헤더 설명) 라운드트립 — 500자 이하 영속', () => {
    const parsed = collectionConfigSchema.parse({ description: '회원 명단입니다.' })
    expect(parsed.description).toBe('회원 명단입니다.')
  })

  it('description 500자 초과는 거부(입력 방어)', () => {
    const config = { description: 'x'.repeat(501) }
    expect(collectionConfigSchema.safeParse(config).success).toBe(false)
  })
})

// 회귀 핀: UI 가 실제로 만들 수 있는 컬럼 타입·뷰 타입·뷰 설정이 PATCH(collectionConfigSchema)를 통과해야 한다.
// 과거엔 base 타입 enum 에 email/phone/geo 가, 뷰 타입 enum 에 calendar/feed/chart/dashboard/map 이 빠져 있어
// 그런 컬럼/뷰를 만들면 전체 config PATCH 가 400(silent) → 새로고침 시 모든 스키마 변경이 롤백됐다.
describe('collectionConfigSchema — UI 가 만드는 값의 라운드트립(롤백 회귀)', () => {
  it('base 컬럼 타입 email/phone/geo 를 허용(add-property 피커가 제공하는 타입)', () => {
    for (const type of ['email', 'phone', 'geo'] as const) {
      const config = { base: [{ key: `c_${type}`, label: type, type }] }
      const res = collectionConfigSchema.safeParse(config)
      expect(res.success).toBe(true)
      if (res.success) expect(res.data.base?.[0]?.type).toBe(type)
    }
  })

  it('뷰 타입 calendar/feed/chart/dashboard/map 을 허용(등록된 뷰 surface)', () => {
    for (const type of ['calendar', 'feed', 'chart', 'dashboard', 'map'] as const) {
      const config = { views: [{ id: 'v1', name: '뷰', config: { type } }] }
      const res = collectionConfigSchema.safeParse(config)
      expect(res.success).toBe(true)
      if (res.success) expect(res.data.views?.[0]?.config.type).toBe(type)
    }
  })

  it('뷰 config 의 cardSize·timeline·rowHeight·wrapCells·hideEmptyGroups·groupSort 라운드트립(strip 방지)', () => {
    const config = {
      views: [
        {
          id: 'v1',
          name: '뷰',
          config: {
            type: 'timeline' as const,
            cardSize: 'L' as const,
            cardPropLabels: true,
            timeline: { startKey: 'start', endKey: 'end', zoom: 'week' as const },
            rowHeight: 'M' as const,
            wrapCells: true,
            hideEmptyGroups: true,
            collapseEmptyGroups: true,
            relationTable: {
              key: 'quotes',
              maxRows: 3,
              variant: 'list' as const,
              collapsed: true,
            },
            groupSort: 'count' as const,
          },
        },
      ],
    }
    const parsed = collectionConfigSchema.parse(config)
    const cfg = parsed.views?.[0]?.config
    expect(cfg?.cardSize).toBe('L')
    expect(cfg?.cardPropLabels).toBe(true)
    expect(cfg?.timeline).toEqual({ startKey: 'start', endKey: 'end', zoom: 'week' })
    expect(cfg?.rowHeight).toBe('M')
    expect(cfg?.wrapCells).toBe(true)
    expect(cfg?.hideEmptyGroups).toBe(true)
    expect(cfg?.collapseEmptyGroups).toBe(true)
    expect(cfg?.relationTable).toEqual({
      key: 'quotes',
      maxRows: 3,
      variant: 'list',
      collapsed: true,
    })
    expect(cfg?.groupSort).toBe('count')
  })

  it('뷰 config 의 columnWidths(뷰별 컬럼 폭) 라운드트립 — 범위(40~800) 밖은 거절한다', () => {
    const withWidths = (columnWidths: Record<string, number>) => ({
      views: [{ id: 'v1', name: '뷰', config: { columnWidths } }],
    })
    const parsed = collectionConfigSchema.parse(withWidths({ status: 200, 'x:담당': 150 }))
    expect(parsed.views?.[0]?.config.columnWidths).toEqual({ status: 200, 'x:담당': 150 })
    expect(collectionConfigSchema.safeParse(withWidths({ status: 20 })).success).toBe(false)
    expect(collectionConfigSchema.safeParse(withWidths({ status: 801 })).success).toBe(false)
    // 없는 뷰는 그대로 — 필드가 생기지 않는다.
    const legacy = collectionConfigSchema.parse({ views: [{ id: 'v1', name: '뷰', config: {} }] })
    expect(legacy.views?.[0]?.config.columnWidths).toBeUndefined()
  })
})

// 회귀 핀: geo 컬럼의 셀 값(GeoValue 객체)이 행 PATCH(blockDocumentSchema)를 통과해야 한다.
// 과거엔 propertyValueSchema 가 객체를 허용 안 해 geo 편집이 조용히 유실됐다.
describe('blockDocumentSchema — geo 값 라운드트립', () => {
  it('GeoValue 객체를 properties 값으로 허용', () => {
    const doc = {
      properties: {
        loc: {
          coordinate: { x: 126.978, y: 37.5665, type: 'WGS84' },
          roadAddress: '서울특별시 중구 세종대로 110',
        },
      },
    }
    const res = blockDocumentSchema.safeParse(doc)
    expect(res.success).toBe(true)
  })
})

// 회귀 핀: 셀 등급(doc.trust)이 행 PATCH 를 통과해야 한다. trust 는 properties 의 *형제*라, Zod 에
// 없으면 매 저장마다 통째로 strip 됐다 — 값은 남고 근거만 사라지는(등급 전부 hypothesis 로 리셋되는)
// 가장 조용한 형태의 데이터 손실. 행을 열었다 저장하는 것만으로 발생한다.
describe('blockDocumentSchema — 셀 등급(trust) 라운드트립', () => {
  it('trust 를 보존한다 — strip 되지 않는다', () => {
    const doc = {
      properties: { bizStatus: '영업' },
      trust: { bizStatus: { g: 'sourced', src: '행안부 인허가', at: '2026-07-28T00:00:00.000Z' } },
    }
    const res = blockDocumentSchema.safeParse(doc)
    expect(res.success).toBe(true)
    expect(res.success && res.data.trust).toEqual(doc.trust)
  })

  it('g 만 있어도 통과(src·at 은 선택)', () => {
    const res = blockDocumentSchema.safeParse({
      properties: {},
      trust: { phone: { g: 'claimed' } },
    })
    expect(res.success).toBe(true)
  })

  it('격자 밖 등급은 거부 — 임의 문자열이 등급인 척 들어오지 못한다', () => {
    const res = blockDocumentSchema.safeParse({ properties: {}, trust: { phone: { g: '최고' } } })
    expect(res.success).toBe(false)
  })

  it('trust 없는 문서는 그대로 통과(등급을 안 쓰는 DB 회귀 0)', () => {
    const res = blockDocumentSchema.safeParse({ properties: { title: '가게' }, body: [] })
    expect(res.success).toBe(true)
    expect(res.success && res.data.trust).toBeUndefined()
  })
})
