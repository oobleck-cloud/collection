// 컬렉션 스키마(PropertyDef[]) → 행 쓰기 Zod 계약 파생 — **순수**(DB·전송 무의존).
// 계획: docs/product-builder-data-api-plan.md §5 D2 / 슬라이스 A1.
//
// 왜 파생인가: 사용자가 만든 DB 가 그대로 CRUD API 로 나가면, 그 API 의 입력 계약은 **사용자 스키마마다
// 다르다.** 손으로 Zod 를 쓸 수 있는 대상이 아니다. 그래서 컬럼 정의(PropertyDef)를 유일한 출처로 두고
// 검증기를 여기서 떨어뜨린다 — §9 규약("API route 는 Zod 로 검증 필수")을 사용자 정의 스키마까지 확장하는
// 유일한 방법이고, 스키마를 고치면 계약이 저절로 따라온다(드리프트 0).
//
// 소비처 셋이 같은 파생을 공유한다: 데이터 API 쓰기 검증 · 캔버스 폼 위젯의 클라 검증 · AI 행 저작 게이트.
//
// **쓰기 가능 컬럼만 계약에 든다**(writableProperties):
//  - source:'projection' 은 본문에서 계산되는 읽기전용 파생값이라 제외한다(써도 다음 투영에 덮인다).
//  - type:'button' 은 행 액션 렌더 정보(ButtonValue)지 사용자 데이터가 아니라 제외한다.
// 결과적으로 "표에 보이는 컬럼"과 "API 로 쓸 수 있는 필드"가 다를 수 있고, 그 차이는 의도된 것이다.

import { z } from 'zod'
import type { PropertyDef, SelectOption } from './types'
import { normalizeOptions } from './options'
import { isDateValue } from './date-value'

/** geo 셀 값(GeoValue) 미러 — collection-schema 의 것과 같은 형태를 이 파생기도 쓴다(값 계약 단일). */
const coordinateSystemSchema = z.enum(['WGS84', 'WCONGNAMUL', 'CONGNAMUL', 'WTM', 'TM'])
const geoValueSchema = z.object({
  coordinate: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    type: coordinateSystemSchema,
  }),
  roadAddress: z.string(),
  detailAddress: z.string().optional(),
})

/** 전화번호 — 국가 규칙을 고정하지 않는다(숫자·공백·+·-·괄호만, 숫자 최소 하나). 과한 검증은 정상 입력을 막는다. */
const PHONE_RE = /^[+()\d][\d\s()+-]*$/

/** date 값 — 표현 규약(단일·시간·기간)의 판정은 date-value 가 소유한다. */
const dateValueSchema = z
  .string()
  .refine(isDateValue, 'YYYY-MM-DD · YYYY-MM-DDTHH:mm · <start>/<end> 형식이어야 합니다')

/** select/multi_select 의 허용 값 목록. 옵션 미선언(자유 입력 컬럼)이면 빈 배열. */
function optionValues(def: PropertyDef): string[] {
  const opts: SelectOption[] = normalizeOptions(def.options)
  return opts.map((o) => o.value)
}

/**
 * 옵션 목록을 값 검증기로 — 옵션이 선언돼 있으면 그 집합으로 제한하고, 없으면 자유 문자열.
 * `z.enum` 은 최소 1개를 요구하므로 빈 목록은 문자열로 폴백한다(옵션 없는 select = 자유 태그 입력).
 */
function optionValueSchema(def: PropertyDef): z.ZodType<string> {
  const values = optionValues(def)
  if (values.length === 0) return z.string()
  return z.enum(values as [string, ...string[]])
}

/**
 * 컬럼 하나의 값 검증기(널 허용 전). 타입별 매핑은 PropertyValue 규약과 투영(row-projection)의
 * 컬럼 선택 규칙에 맞춘다 — 여기서 통과한 값은 투영이 반드시 알맞은 타입드 컬럼에 담을 수 있어야 한다.
 */
export function propertyValueSchemaFor(def: PropertyDef): z.ZodTypeAny {
  switch (def.type) {
    case 'number':
      return z.number().finite()
    case 'checkbox':
      return z.boolean()
    case 'date':
      return dateValueSchema
    case 'url':
      return z.string().url()
    case 'email':
      return z.string().email()
    case 'phone':
      return z.string().min(1).regex(PHONE_RE, '전화번호 형식이 아닙니다')
    case 'select':
      return optionValueSchema(def)
    case 'multi_select':
      return z.array(optionValueSchema(def))
    case 'relation':
      // cardinality 'many' 는 id 배열, 기본('one')은 id 하나. 대상 행의 *실재* 검증은 이 순수 파생기가
      // 할 수 없다(DB 조회) — 해석기(트랙 A4)가 영속 직전에 확인한다. 여기선 형태만 계약한다.
      return def.relation?.cardinality === 'many' ? z.array(z.string().min(1)) : z.string().min(1)
    case 'geo':
      return geoValueSchema
    case 'text':
      return z.string()
    // button 은 writableProperties 가 걸러내므로 여기 도달하지 않는다. 새 PropertyType 이 생겼는데
    // 매핑을 안 붙인 경우의 폴백 — 검증 없이 통과시키지 않고 명시적으로 거부한다(조용한 구멍 방지).
    default:
      return z.never()
  }
}

/**
 * API 쓰기 계약에 드는 컬럼만 — projection(읽기전용 파생)·button(액션 렌더값) 제외.
 * 순서는 스키마 선언 순서를 보존한다(문서·OpenAPI 필드 순서가 표 컬럼 순서와 일치하도록).
 */
export function writableProperties(defs: readonly PropertyDef[]): PropertyDef[] {
  return defs.filter((d) => d.source !== 'projection' && d.type !== 'button')
}

export type RecordSchemaOptions = {
  /**
   * 부분 갱신(PUT 머지) 모드 — 전 필드 optional 로 만들고 required 를 무시한다.
   * 보내지 않은 필드는 기존 값을 유지하므로, 여기서 필수를 강제하면 "이름만 고치려는 요청"이 막힌다.
   */
  partial?: boolean
}

/**
 * 컬렉션 스키마 → 행 프로퍼티 객체의 Zod 계약.
 *
 * 규칙:
 *  - `required: true` 인 컬럼은 생성(POST)에서 필수. 그 외는 optional.
 *  - 모든 값은 `null` 허용 — null 은 "미설정"이며 값 삭제의 표현이다(PropertyValue 규약).
 *    단 required 컬럼은 null 을 받지 않는다(필수인데 비우는 것은 모순).
 *  - **선언되지 않은 키는 거부**(strict). 스키마에서 계약을 파생하는 목적의 절반이 오타 검출이다 —
 *    strip 하면 `titel: "..."` 이 200 을 받고 값은 사라진다(조용한 데이터 유실). 400 이 낫다.
 */
export function recordPropertiesSchema(
  defs: readonly PropertyDef[],
  options: RecordSchemaOptions = {},
) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const def of writableProperties(defs)) {
    const value = propertyValueSchemaFor(def)
    const isRequired = def.required === true && options.partial !== true
    shape[def.key] = isRequired ? value : value.nullable().optional()
  }
  return z.object(shape).strict()
}

/**
 * 행 쓰기 요청 바디 계약 — `{ properties }`. body(블록 트리)는 데이터 API 표면에서 다루지 않는다:
 * 외부 CRUD 소비자는 "레코드의 필드"를 쓰지 문서 본문을 저작하지 않는다(본문 저작은 대시보드·AI 경로).
 * 그래서 여기서도 strict 로 막아, 본문을 실어 보내면 조용히 무시되는 대신 400 으로 알린다.
 */
export function recordWriteSchema(defs: readonly PropertyDef[], options: RecordSchemaOptions = {}) {
  const properties: z.ZodTypeAny = recordPropertiesSchema(defs, options)
  return z
    .object({
      properties: options.partial === true ? properties.optional().default({}) : properties,
    })
    .strict()
}
