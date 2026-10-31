import { describe, it, expect } from 'vitest'
import type { PropertyDef, PropertyType } from './types'
import {
  propertyValueSchemaFor,
  recordPropertiesSchema,
  recordWriteSchema,
  writableProperties,
} from './record-schema'

// 파생기 테스트 — "스키마를 주면 계약이 떨어진다"의 타입별 경계·실패 케이스.
// 소비자(데이터 API)가 아직 없으므로 여기가 유일한 회귀 그물이다(슬라이스 A1 = 순수·소비자 0).

const def = (over: Partial<PropertyDef> & { type: PropertyType }): PropertyDef => ({
  key: 'f',
  label: '필드',
  source: 'frontmatter',
  origin: 'base',
  ...over,
})

/** 값 하나를 그 컬럼 정의로 검증 — 통과 여부만. */
const accepts = (d: PropertyDef, value: unknown): boolean =>
  propertyValueSchemaFor(d).safeParse(value).success

describe('propertyValueSchemaFor — 타입별 매핑', () => {
  it('text 는 문자열만 (빈 문자열 허용 — 미설정은 null 로 표현)', () => {
    const d = def({ type: 'text' })
    expect(accepts(d, '가나다')).toBe(true)
    expect(accepts(d, '')).toBe(true)
    expect(accepts(d, 7)).toBe(false)
  })

  it('number 는 유한 수만 — NaN·Infinity·숫자문자열 거부', () => {
    const d = def({ type: 'number' })
    expect(accepts(d, 0)).toBe(true)
    expect(accepts(d, -12.5)).toBe(true)
    expect(accepts(d, NaN)).toBe(false)
    expect(accepts(d, Infinity)).toBe(false)
    expect(accepts(d, '12')).toBe(false)
  })

  it('checkbox 는 boolean 만 — 0/1 거부', () => {
    const d = def({ type: 'checkbox' })
    expect(accepts(d, false)).toBe(true)
    expect(accepts(d, 0)).toBe(false)
  })

  it('select 는 선언된 옵션 집합으로 제한', () => {
    const d = def({ type: 'select', options: ['open', 'done'] })
    expect(accepts(d, 'open')).toBe(true)
    expect(accepts(d, 'OPEN')).toBe(false)
    expect(accepts(d, 'archived')).toBe(false)
  })

  it('select 에 옵션이 없으면 자유 문자열(옵션 없는 컬럼을 막지 않는다)', () => {
    expect(accepts(def({ type: 'select' }), '아무거나')).toBe(true)
    expect(accepts(def({ type: 'select', options: [] }), '아무거나')).toBe(true)
  })

  it('select 옵션은 리치 객체 형태(SelectOption[])도 받는다', () => {
    const d = def({ type: 'select', options: [{ value: 'open', label: '진행' }] })
    expect(accepts(d, 'open')).toBe(true)
    expect(accepts(d, '진행')).toBe(false) // 영속값은 value 이지 label 이 아니다
  })

  it('multi_select 는 옵션 배열 — 원소 하나라도 벗어나면 거부', () => {
    const d = def({ type: 'multi_select', options: ['a', 'b'] })
    expect(accepts(d, [])).toBe(true)
    expect(accepts(d, ['a', 'b'])).toBe(true)
    expect(accepts(d, ['a', 'z'])).toBe(false)
    expect(accepts(d, 'a')).toBe(false) // 단일 문자열은 배열이 아니다
  })

  it('url·email 은 형식 검증', () => {
    expect(accepts(def({ type: 'url' }), 'https://poein.kr/a?b=1')).toBe(true)
    expect(accepts(def({ type: 'url' }), 'poein.kr')).toBe(false)
    expect(accepts(def({ type: 'email' }), 'a@b.co')).toBe(true)
    expect(accepts(def({ type: 'email' }), 'a@b')).toBe(false)
  })

  it('phone 은 국가 규칙을 고정하지 않되 문자열 쓰레기는 막는다', () => {
    const d = def({ type: 'phone' })
    expect(accepts(d, '010-1234-5678')).toBe(true)
    expect(accepts(d, '+82 10 1234 5678')).toBe(true)
    expect(accepts(d, '(02) 123-4567')).toBe(true)
    expect(accepts(d, '전화없음')).toBe(false)
    expect(accepts(d, '')).toBe(false)
  })

  it('relation 은 카디널리티에 따라 id 하나 또는 id 배열', () => {
    const one = def({ type: 'relation', relation: { target: 'plan' } })
    const many = def({ type: 'relation', relation: { target: 'plan', cardinality: 'many' } })
    expect(accepts(one, 'row_1')).toBe(true)
    expect(accepts(one, ['row_1'])).toBe(false)
    expect(accepts(one, '')).toBe(false)
    expect(accepts(many, ['row_1', 'row_2'])).toBe(true)
    expect(accepts(many, 'row_1')).toBe(false)
  })

  it('geo 는 좌표+도로명 객체 — 좌표계는 알려진 값만', () => {
    const d = def({ type: 'geo' })
    const ok = { coordinate: { x: 127.02, y: 37.5, type: 'WGS84' }, roadAddress: '서울시 강남구' }
    expect(accepts(d, ok)).toBe(true)
    expect(accepts(d, { ...ok, coordinate: { ...ok.coordinate, type: 'EPSG4326' } })).toBe(false)
    expect(accepts(d, { roadAddress: '서울시 강남구' })).toBe(false)
    expect(accepts(d, '서울시 강남구')).toBe(false)
  })
})

describe('propertyValueSchemaFor — date 값 규약', () => {
  const d = def({ type: 'date' })

  it('단일 일자·시간 포함·기간 셋 다 받는다', () => {
    expect(accepts(d, '2026-08-01')).toBe(true)
    expect(accepts(d, '2026-08-01T09:30')).toBe(true)
    expect(accepts(d, '2026-08-01/2026-08-03')).toBe(true)
  })

  it('형태만 맞고 달력에 없는 날짜는 거부(롤오버 차단)', () => {
    expect(accepts(d, '2026-02-30')).toBe(false)
    expect(accepts(d, '2026-13-01')).toBe(false)
    expect(accepts(d, '2026-08-01T25:00')).toBe(false)
  })

  it('윤년은 실제 달력을 따른다', () => {
    expect(accepts(d, '2024-02-29')).toBe(true)
    expect(accepts(d, '2026-02-29')).toBe(false)
  })

  it('기간은 시작이 끝보다 뒤면 거부', () => {
    expect(accepts(d, '2026-08-05/2026-08-01')).toBe(false)
    expect(accepts(d, '2026-08-01/2026-08-01')).toBe(true)
  })

  it('임의 문자열·다른 형식은 거부', () => {
    expect(accepts(d, '2026/08/01')).toBe(false)
    expect(accepts(d, '내일')).toBe(false)
  })
})

describe('writableProperties — 계약에 드는 컬럼', () => {
  it('projection(읽기전용 파생)과 button(액션 렌더값)은 제외한다', () => {
    const defs: PropertyDef[] = [
      def({ key: 'name', type: 'text' }),
      def({ key: 'total', type: 'number', source: 'projection' }),
      def({ key: 'act', type: 'button' }),
    ]
    expect(writableProperties(defs).map((d) => d.key)).toEqual(['name'])
  })

  it('선언 순서를 보존한다(문서·필드 순서가 표와 일치하도록)', () => {
    const defs: PropertyDef[] = [
      def({ key: 'c', type: 'text' }),
      def({ key: 'a', type: 'text' }),
      def({ key: 'b', type: 'text' }),
    ]
    expect(writableProperties(defs).map((d) => d.key)).toEqual(['c', 'a', 'b'])
  })
})

describe('recordPropertiesSchema — 객체 계약', () => {
  const defs: PropertyDef[] = [
    def({ key: 'title', type: 'text', required: true }),
    def({ key: 'count', type: 'number' }),
    def({ key: 'done', type: 'checkbox' }),
    def({ key: 'computed', type: 'text', source: 'projection' }),
  ]

  it('required 컬럼이 없으면 거부하고, 나머지는 없어도 통과', () => {
    expect(recordPropertiesSchema(defs).safeParse({ title: '가' }).success).toBe(true)
    expect(recordPropertiesSchema(defs).safeParse({ count: 1 }).success).toBe(false)
  })

  it('required 컬럼은 null 을 받지 않는다(필수인데 비우는 건 모순)', () => {
    expect(recordPropertiesSchema(defs).safeParse({ title: null }).success).toBe(false)
  })

  it('선택 컬럼은 null 로 값 삭제를 표현할 수 있다', () => {
    expect(recordPropertiesSchema(defs).safeParse({ title: '가', count: null }).success).toBe(true)
  })

  it('선언되지 않은 키는 거부한다 — 오타가 조용한 유실이 되지 않게', () => {
    const r = recordPropertiesSchema(defs).safeParse({ title: '가', titel: '오타' })
    expect(r.success).toBe(false)
    expect(JSON.stringify(r.error?.issues)).toContain('titel')
  })

  it('projection 컬럼은 쓰기 계약에 없으므로 보내면 거부된다', () => {
    expect(recordPropertiesSchema(defs).safeParse({ title: '가', computed: 'x' }).success).toBe(
      false,
    )
  })

  it('partial 모드는 required 를 무시한다(부분 갱신)', () => {
    const partial = recordPropertiesSchema(defs, { partial: true })
    expect(partial.safeParse({ count: 3 }).success).toBe(true)
    expect(partial.safeParse({}).success).toBe(true)
    // 미선언 키 거부는 partial 에서도 유지된다.
    expect(partial.safeParse({ nope: 1 }).success).toBe(false)
  })

  it('빈 스키마는 빈 객체만 받는다', () => {
    const empty = recordPropertiesSchema([])
    expect(empty.safeParse({}).success).toBe(true)
    expect(empty.safeParse({ any: 1 }).success).toBe(false)
  })

  it('타입 위반은 어느 필드가 틀렸는지 issues 로 알린다', () => {
    const r = recordPropertiesSchema(defs).safeParse({ title: '가', count: '셋' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['count'])
  })
})

describe('recordWriteSchema — 요청 바디 계약', () => {
  const defs: PropertyDef[] = [def({ key: 'title', type: 'text', required: true })]

  it('생성은 properties 를 요구한다', () => {
    expect(recordWriteSchema(defs).safeParse({ properties: { title: '가' } }).success).toBe(true)
    expect(recordWriteSchema(defs).safeParse({}).success).toBe(false)
  })

  it('부분 갱신은 properties 없이도 통과하고 빈 객체로 채운다', () => {
    const r = recordWriteSchema(defs, { partial: true }).safeParse({})
    expect(r.success).toBe(true)
    expect(r.data).toEqual({ properties: {} })
  })

  it('본문(body)을 실어 보내면 거부한다 — 조용히 무시되지 않게', () => {
    const r = recordWriteSchema(defs).safeParse({
      properties: { title: '가' },
      body: [{ type: 'paragraph' }],
    })
    expect(r.success).toBe(false)
  })
})
