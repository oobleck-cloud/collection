// @oobleck/collection — 관계 표(카드 블록)의 순수 규칙. 렌더는 views/RelationTable.tsx.
//
// 관계 표는 「이 레코드가 가리키는 대상 레코드들」을 카드 안의 작은 표로 보인다(노션 관계의 롤업 표 동형).
// 무엇을 가리키는지는 관계 속성 값(id 들)이, 대상 레코드의 칸은 provider 의 `records`(호스트가 미리 읽어 둔 사본)가 말한다.
// 이 파일은 도메인을 모른다 — 설정(RelationTableConfig) · 스키마 · 값만으로 「어느 열을, 몇 줄까지」를 정한다.

import type {
  PropertyDef,
  PropertyValue,
  RelatedRecordRow,
  RelatedRecordSource,
  RelationProvider,
  RelationTableConfig,
} from './types'

/** 카드에 보일 기본 줄 수 — 넘치면 「+ N개 더」 한 줄로 접는다. */
export const RELATION_TABLE_DEFAULT_ROWS = 3

/** 관계 값 → id 배열. 단일(string)·다중(string[]) 모두. 빈 값·객체값은 []. */
export function relationIds(value: PropertyValue | undefined): string[] {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value.map(String).filter((id) => id !== '')
  if (typeof value === 'object') return []
  return [String(value)]
}

/** 관계 표가 가리키는 관계 속성 — 설정의 키가 이 스키마의 relation 속성일 때만. */
export function relationTableDef(
  schema: readonly PropertyDef[],
  config: RelationTableConfig | undefined,
): PropertyDef | undefined {
  if (!config) return undefined
  const def = schema.find((d) => d.key === config.key)
  return def?.type === 'relation' && def.relation ? def : undefined
}

/** 관계 표의 대상 읽기 창구 — 관계 속성의 대상 provider 가 `records` 를 가졌을 때만. */
export function relationTableSource(
  def: PropertyDef | undefined,
  relations: Record<string, RelationProvider> | undefined,
): RelatedRecordSource | undefined {
  const target = def?.relation?.target
  return target ? relations?.[target]?.records : undefined
}

/** 열 후보로 세울 수 있는 대상 속성 — 컬럼 자리가 없는 것(searchOnly)·버튼은 표 칸이 아니다. */
export function relationTableColumnCandidates(source: RelatedRecordSource): PropertyDef[] {
  return source.schema.filter((d) => !d.searchOnly && d.type !== 'button')
}

/**
 * 표의 열 — 뷰가 고른 열(순서대로) → 없으면 provider 기본 열 → 없으면 숨김 아닌 대상 속성 전부.
 * 대상 스키마에 없는 키는 건너뛴다(대상 컬렉션의 열이 바뀌어도 표가 깨지지 않게 — 넓히는 쪽으로).
 * 고른 열이 전부 죽었으면 기본으로 돌아간다(빈 표를 그리지 않는다).
 */
export function relationTableColumns(
  source: RelatedRecordSource,
  columns: readonly string[] | undefined,
): PropertyDef[] {
  const candidates = relationTableColumnCandidates(source)
  const byKey = new Map(candidates.map((d) => [d.key, d]))
  const pick = (keys: readonly string[] | undefined) =>
    (keys ?? []).flatMap((k) => {
      const def = byKey.get(k)
      return def ? [def] : []
    })
  const chosen = pick(columns)
  if (chosen.length > 0) return chosen
  const defaults = pick(source.defaultColumns)
  if (defaults.length > 0) return defaults
  return candidates.filter((d) => !d.hiddenByDefault)
}

/** 보일 줄 / 접을 줄. maxRows 미지정 = 기본(3), 0 이하 = 1. 접은 줄은 「+ N개 더」가 센다. */
export function relationTableSlice<T>(
  rows: readonly T[],
  maxRows: number | undefined,
): { shown: T[]; hidden: T[] } {
  const limit = Math.max(1, Math.trunc(maxRows ?? RELATION_TABLE_DEFAULT_ROWS))
  return { shown: rows.slice(0, limit), hidden: rows.slice(limit) }
}

/** 카드 한 장의 관계 표 줄 — 관계 값의 id 순서대로 대상 레코드를 읽는다(모르는 id 는 빠진다). */
export function relationTableRows(
  source: RelatedRecordSource,
  value: PropertyValue | undefined,
): RelatedRecordRow[] {
  const ids = relationIds(value)
  return ids.length === 0 ? [] : source.read(ids)
}
