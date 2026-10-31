// @oobleck/collection — 뷰별 컬럼 폭(사용자가 헤더 오른쪽 끝을 끌어서 정한 폭).
//
// 폭의 자리는 두 곳이다:
//  - 스키마(PropertyDef.width) — 화면 코드·자동 폭(auto-size)이 정하는 기본값. 모든 뷰가 같다.
//  - 뷰 설정(CollectionViewConfig.columnWidths) — 사용자가 끌어서 정한 값. **뷰마다** 다르다.
// 렌더 시 뷰 값이 스키마 위에 `{ mode:'fixed', px }` 로 덮인다. 뷰에 없는 키는 스키마 그대로라,
// columnWidths 가 없는 기존 뷰는 한 픽셀도 바뀌지 않는다.

import type { PropertyDef } from './types'

/** 끌어서 줄일 수 있는 하한 — 이보다 좁으면 헤더 라벨·핸들이 함께 사라져 다시 넓힐 손잡이를 찾기 어렵다. */
export const COLUMN_WIDTH_MIN_PX = 60
/** 끌어서 넓힐 수 있는 상한 — 스키마 검증(PropertyDef.width·columnWidths 의 max 800)과 같다. */
export const COLUMN_WIDTH_MAX_PX = 800

/** px → 저장 가능한 정수 폭(60~800 클램프). NaN 등 비정상 값은 하한으로. */
export function clampColumnWidth(px: number): number {
  if (!Number.isFinite(px)) return COLUMN_WIDTH_MIN_PX
  return Math.round(Math.min(COLUMN_WIDTH_MAX_PX, Math.max(COLUMN_WIDTH_MIN_PX, px)))
}

/**
 * 뷰의 컬럼 폭을 스키마에 얹는다 — 뷰에 적힌 키만 `{ mode:'fixed', px }` 로 바꾼다.
 * 입력을 변형하지 않고, 덮을 것이 없으면 **같은 배열을 그대로** 돌려준다(memo 안정성).
 */
export function applyViewColumnWidths(
  schema: PropertyDef[],
  columnWidths: Record<string, number> | undefined,
): PropertyDef[] {
  if (!columnWidths || Object.keys(columnWidths).length === 0) return schema
  return schema.map((def) => {
    const px = columnWidths[def.key]
    if (px === undefined) return def
    return { ...def, width: { mode: 'fixed', px: clampColumnWidth(px) } }
  })
}

/**
 * 한 컬럼의 폭을 바꾼 새 columnWidths. `px === null` 이면 그 키를 지워 기본 폭으로 되돌린다.
 * 남는 키가 없으면 undefined — 뷰 설정에 빈 객체가 남아 "기본 시야에서 벗어남"으로 읽히지 않게.
 */
export function setColumnWidth(
  columnWidths: Record<string, number> | undefined,
  key: string,
  px: number | null,
): Record<string, number> | undefined {
  const next = { ...columnWidths }
  if (px === null) delete next[key]
  else next[key] = clampColumnWidth(px)
  return Object.keys(next).length === 0 ? undefined : next
}
