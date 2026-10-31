// @mvos/collections — 컬럼 폭 자동 조절(auto-fit).
//
// 문제: 컬럼 폭을 손으로 못 박으면(`width: {mode:'fixed', px:100}`) 내용과 어긋난다. 좁으면
// "플래너 배정됨" 같은 값이 옆 컬럼에 붙어 여백이 사라지고, 넓으면 표가 헐렁해진다. 화면마다
// 눈대중으로 px 를 고르는 것도 오래 못 간다 — 데이터가 바뀌면 다시 어긋난다.
//
// 접근: 스프레드시트/데이터그리드가 쓰는 **content-based auto-fit** 을 따른다
// (Excel AutoFit · AG Grid autoSizeColumns · Notion 컬럼 더블클릭).
//   컬럼 폭 = clamp( max(헤더 폭, 콘텐츠 폭) + 패딩, min, max )
//
// 다만 소박한 AutoFit 은 **최댓값**을 쓴다. 주소처럼 한두 개가 유독 긴 컬럼에서 그러면 그 하나
// 때문에 컬럼이 화면을 다 먹는다. 그래서 콘텐츠 폭은 **분위수(기본 p90)** 를 쓴다 — 90% 의 행이
// 잘리지 않으면 충분하고, 나머지는 말줄임(truncate)에 맡긴다. 이건 데이터그리드에서
// "sample-based sizing" 으로 흔히 쓰는 절충이다.
//
// 폭 측정은 **추정**이다(canvas measureText 아님). 이유:
//   - 순수 함수라 SSR·테스트에서 그대로 돈다(레이아웃 패스·DOM 불필요).
//   - 렌더 → 측정 → 재렌더의 깜빡임이 없다.
//   - 표 컬럼은 몇 px 오차가 문제되지 않는다. 정확도가 필요한 자리는 `autoSize.extraPx` 로 보정한다.

import { formatDateValueDisplay } from './date-value'

import type { PropertyDef, PropertyValue } from './types'

/** 문자 폭 계수(폰트 크기 대비). 한글·한자·가나는 전각이라 1em, 라틴은 자모마다 다르다. */
const W_FULLWIDTH = 1.0
const W_DIGIT_OR_UPPER = 0.6
const W_LOWER = 0.52
const W_NARROW = 0.3

/** 전각(CJK·한글·가나·전각기호) 코드포인트인가. */
function isFullWidth(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // 한글 자모
    (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK 부수·한자·가나·주음
    (cp >= 0xac00 && cp <= 0xd7a3) || // 한글 음절
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK 호환 한자
    (cp >= 0xfe30 && cp <= 0xfe6f) || // CJK 호환 형태
    (cp >= 0xff00 && cp <= 0xff60) || // 전각 영숫자·기호
    (cp >= 0xffe0 && cp <= 0xffe6)
  )
}

/**
 * 텍스트의 렌더 폭 추정(px). 순수 함수 — 같은 입력이면 항상 같은 값.
 * 정확한 측정이 아니라 **컬럼 폭을 정하기 충분한 근사**다(위 파일 주석 참조).
 */
export function estimateTextWidth(text: string, fontSizePx = 14): number {
  let em = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (isFullWidth(cp)) em += W_FULLWIDTH
    else if (ch === ' ' || ch === '.' || ch === ',' || ch === ':' || ch === '|' || ch === "'")
      em += W_NARROW
    else if ((ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z')) em += W_DIGIT_OR_UPPER
    else em += W_LOWER
  }
  return em * fontSizePx
}

/**
 * 분위수(선형 보간 없음 — nearest-rank). p=1 이면 최댓값(= 고전 AutoFit).
 * 빈 배열은 0.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil(Math.min(1, Math.max(0, p)) * sorted.length)
  return sorted[Math.max(0, rank - 1)] ?? 0
}

export type AutoSizeOptions = {
  /** 본문 폰트 크기(px). DS 표 본문 기준 14. */
  fontSizePx?: number
  /** 셀 좌우 패딩 + 컬럼 사이 숨 쉴 여백(px). DS default density 기준. */
  paddingPx?: number
  /** 컬럼 최소 폭 — 헤더가 너무 쪼그라들지 않게. */
  minPx?: number
  /** 컬럼 최대 폭 — 긴 주소 하나가 표를 삼키지 않게. */
  maxPx?: number
  /** 콘텐츠 폭 분위수. 1 = 최댓값. 기본 0.9. */
  percentile?: number
  /** 헤더의 타입 아이콘 + 정렬 표시 등 텍스트 외 폭. */
  headerExtraPx?: number
}

const DEFAULTS: Required<AutoSizeOptions> = {
  fontSizePx: 14,
  paddingPx: 32,
  minPx: 72,
  maxPx: 360,
  percentile: 0.9,
  headerExtraPx: 28,
}

/** 폭 계산에 쓸 표시 문자열. `autoSize.text` 가 있으면 그것(=render 로 그리는 셀의 실제 문자열). */
function displayTextFor(def: PropertyDef, props: Record<string, PropertyValue>): string {
  const value = props[def.key] ?? null
  if (def.autoSize?.text) return def.autoSize.text(value, props)
  if (def.format) return def.format(value)
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return ''
  // 날짜는 셀이 그리는 글자(「2026. 10. 21.」)로 잰다 — 저장값(「2026-10-21」)으로 재면 칸이 좁아 날짜가 두 줄로 꺾인다.
  if (def.type === 'date' && typeof value === 'string')
    return formatDateValueDisplay(value, def.dateFormat) || value
  return String(value)
}

/**
 * 컬럼별 자동 폭(px) 계산.
 *
 * 명시 폭(`PropertyDef.width`)이 있는 컬럼은 **건드리지 않는다** — 손으로 정한 값이 자동 계산보다
 * 우선이다(사용자가 드래그로 리사이즈한 폭도 여기 담긴다).
 *
 * @param schema 컬럼 정의
 * @param rows   현재 화면의 행 속성 맵 배열
 */
export function autoSizeColumns(
  schema: PropertyDef[],
  rows: Record<string, PropertyValue>[],
  options: AutoSizeOptions = {},
): Record<string, number> {
  const o = { ...DEFAULTS, ...options }
  const out: Record<string, number> = {}

  for (const def of schema) {
    if (def.width) continue // 명시 폭 우선

    const contentWidths = rows.map((props) =>
      estimateTextWidth(displayTextFor(def, props), o.fontSizePx),
    )
    const content = percentile(contentWidths, o.percentile)
    const header = estimateTextWidth(def.label, o.fontSizePx) + o.headerExtraPx
    const extra = def.autoSize?.extraPx ?? 0

    const min = def.autoSize?.minPx ?? o.minPx
    const max = def.autoSize?.maxPx ?? o.maxPx
    out[def.key] = Math.round(
      Math.min(max, Math.max(min, Math.max(content + extra, header) + o.paddingPx)),
    )
  }

  return out
}

/**
 * 계산된 폭을 스키마에 얹는다(`width: {mode:'fixed'}`).
 * 마지막 컬럼 하나는 `fill` 로 남겨 표가 가로를 꽉 채우게 할 수 있다(`fillKey`).
 */
export function applyAutoWidths(
  schema: PropertyDef[],
  widths: Record<string, number>,
  fillKey?: string,
): PropertyDef[] {
  return schema.map((def) => {
    if (def.width) return def
    const px = widths[def.key]
    if (px === undefined) return def
    if (def.key === fillKey) return { ...def, width: { mode: 'fill', minPx: px } }
    return { ...def, width: { mode: 'fixed', px } }
  })
}
