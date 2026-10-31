// @oobleck/collection — 뷰 설정의 차이(patch) — 저장된 설정 위에 "내가 바꾼 것"만 얹는다(순수).
//
// 왜 통째 설정이 아니라 차이인가:
//   저장하지 않은 편집(개인 초안)을 남겨 둘 때, 설정을 통째로 남기면 그사이 공유 뷰가 바뀐 것을
//   전부 덮는다 — 정렬만 바꿨는데 남이 고친 필터·컬럼까지 옛 것으로 돌아간다. 바꾼 **최상위 항목만**
//   남기면 손대지 않은 항목은 지금 저장된 뷰를 따라간다.
//
// 단위가 최상위 항목인 이유: 필터 트리·정렬 목록 안쪽까지 병합하면 "정렬 1번만 바꿨다"를 어떻게
//   합칠지부터 새 규칙이 된다. 사용자가 고르는 단위(정렬 전체·필터 전체·컬럼 목록)와 같게 둔다.

import type { CollectionViewConfig } from './types'

/**
 * 저장된 설정에 얹는 차이 — 키가 있으면 그 값으로 바꾸고, **null 이면 그 항목을 지운다**
 * (저장된 뷰에 있던 정렬을 사용자가 걷어 낸 경우). 키가 없으면 저장된 값을 그대로 쓴다.
 * JSON 안전이라 그대로 저장소에 담긴다(undefined 는 JSON 에 남지 않으므로 지움을 null 로 적는다).
 */
export type CollectionViewConfigPatch = {
  [K in keyof CollectionViewConfig]?: CollectionViewConfig[K] | null
}

/** base → next 로 가는 최상위 차이. 같으면 빈 객체. */
export function diffViewConfig(
  base: CollectionViewConfig,
  next: CollectionViewConfig,
): CollectionViewConfigPatch {
  const patch: Record<string, unknown> = {}
  const keys = new Set([...Object.keys(base), ...Object.keys(next)])
  for (const key of keys) {
    const before = (base as Record<string, unknown>)[key]
    const after = (next as Record<string, unknown>)[key]
    if (JSON.stringify(before) === JSON.stringify(after)) continue
    if (isBlank(key, before) && isBlank(key, after)) continue
    patch[key] = after === undefined ? null : after
  }
  return patch as CollectionViewConfigPatch
}

/**
 * "없음"과 같은 빈 값 — 정렬을 다 걷어 낸 `[]`, 조건이 없는 필터 그룹은 항목이 없는 것과 같은 시야다.
 * 정리(`reconcileViewConfig`)가 죽은 정렬을 `[]` 로 남기므로 이걸 차이로 치면, 열기만 해도 초안이 생긴다.
 * 표시 컬럼(`visibleProps`)은 예외 — 빈 목록과 미지정(기본 컬럼)은 다른 시야다.
 */
function isBlank(key: string, value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (key === 'visibleProps' || key === 'knownProps') return false
  if (Array.isArray(value)) return value.length === 0
  if (typeof value !== 'object') return false
  const children = (value as { children?: unknown }).children
  if (Array.isArray(children)) return children.length === 0
  return Object.keys(value).length === 0
}

/** base 위에 차이를 얹은 설정(입력 미변형). null 은 그 항목을 지운다. */
export function applyViewConfigPatch(
  base: CollectionViewConfig,
  patch: CollectionViewConfigPatch,
): CollectionViewConfig {
  const next: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) delete next[key]
    else next[key] = value
  }
  return next as CollectionViewConfig
}

/** 차이가 사용자의 편집인가 — knownProps 만 다르면 정리·편집이 덧붙인 기록일 뿐이다. */
export function isEmptyViewConfigPatch(patch: CollectionViewConfigPatch): boolean {
  return Object.keys(patch).every((key) => key === 'knownProps')
}
