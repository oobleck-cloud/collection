import type { PropertyValue, SelectOption } from './types'

// @oobleck/collection — 사람(person / multi_person) 값의 순수 헬퍼. 셀(PersonCell)·카드·테스트가 같이 쓴다.
//
// 값은 언제나 **계정 id** 다. 이름·이메일·역할은 호스트가 `PropertyDef.options` 로 채운 명단에서 푼다.

/** PropertyValue → id 배열. null·빈 문자열 = []. 단일 문자열 → [문자열]. */
export function personIdsOf(value: PropertyValue | undefined): string[] {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value.map(String).filter((v) => v !== '')
  if (typeof value === 'object') return []
  return [String(value)]
}

/**
 * 검색어로 명단 거르기 — 이름·보조표기(이메일·역할) 부분 일치, 대소문자 무시.
 * 비활성 계정은 새로 고를 수 없으니 빠진다. 결과는 이름순.
 */
export function searchPeople(options: readonly SelectOption[], query: string): SelectOption[] {
  const q = query.trim().toLowerCase()
  return options
    .filter((o) => !o.inactive)
    .filter((o) => {
      if (!q) return true
      const name = (o.label ?? o.value).toLowerCase()
      return name.includes(q) || (o.hint?.toLowerCase().includes(q) ?? false)
    })
    .sort((a, b) => (a.label ?? a.value).localeCompare(b.label ?? b.value, 'ko'))
}

/**
 * 고른 사람을 값에 반영 — 단일은 바꾸거나(같은 사람이면 비움), 다중은 넣고 뺀다.
 * 빈 결과는 `null`(해제)이다.
 */
export function togglePerson(
  multiple: boolean,
  current: readonly string[],
  id: string,
): PropertyValue {
  if (!multiple) return current[0] === id ? null : id
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
  return next.length === 0 ? null : next
}
