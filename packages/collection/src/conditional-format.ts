// @mvos/collections — 조건부 서식(스프레드시트식).
//
// 왜 이 형태인가:
//   지금까지 목록 화면의 강조는 셀마다 손으로 쓰는 boolean 이었다(`<TableCell highlight={...}>`).
//   규칙이 JSX 안에 흩어져 있어서 (a) 화면마다 임계값이 조금씩 다르고 (b) 사용자가 못 바꾸고
//   (c) 왜 노란지 물어보면 코드를 열어야 한다. 스프레드시트는 이 문제를 오래전에 풀었다 —
//   **조건은 데이터, 서식은 그 결과**.
//
// 그래서 규칙은 필터와 **같은 어휘**(FilterExpr)를 쓴다. 새 조건 문법을 만들지 않는다:
//   - 사용자가 이미 툴바 필터에서 배운 UI 를 그대로 쓸 수 있고,
//   - JSON 안전이라 뷰 설정(CollectionViewConfig.conditionalFormats)에 그대로 영속되며,
//   - 조건 평가가 행 전체(props)에 대해 돌아 **다른 컬럼을 근거로** 이 컬럼을 칠할 수 있다
//     (예: "상태가 취소면 금액을 흐리게").
//
// 색 규약(MVOS UI 원칙 2 — 색은 "조치 필요도" 순서):
//   danger(빨강) > warning(주황) > success(초록) > info(파랑) > accent(강조) > muted(무채색).
//   전부 칠하면 정작 빨강이 안 보인다. tone 은 분류 색(Tag color)이 아니라 **상태 색**이다.

import { isEmptyCellValue } from './aggregations'
import { passesFilterNode } from './view'

import type { AggregationType, FilterExpr, PropertyValue } from './types'

/** 조건부 서식의 색조 — DS 시맨틱 상태 토큰에 대응. 분류 색(TagColor)과 다르다. */
export type ConditionalFormatTone = 'danger' | 'warning' | 'success' | 'info' | 'accent' | 'muted'

/** 규칙이 적용하는 서식. 모든 필드 optional — 지정한 것만 덮어쓴다. */
export type ConditionalFormatStyle = {
  /** 배경/글자 색조. 미지정 = 색 변화 없음. */
  tone?: ConditionalFormatTone
  /** 글자 굵게. */
  bold?: boolean
  /** 취소선 — 무효/취소된 행에. */
  strikethrough?: boolean
}

/**
 * 조건부 서식 규칙 1개. JSON 안전(함수 없음) → 뷰 설정에 영속 가능.
 *
 *  - `target`: 이 서식을 입힐 컬럼 키. **미지정이면 행 전체**(모든 셀).
 *  - `when`: 조건. 필터와 동일한 `FilterExpr` — 행 전체 props 에 대해 평가한다.
 *  - `style`: 조건을 만족할 때 입힐 서식.
 */
export type ConditionalFormatRule = {
  id: string
  target?: string
  when: FilterExpr
  style: ConditionalFormatStyle
}

/**
 * 한 셀에 적용될 최종 서식 — 규칙 목록을 순서대로 훑어 **먼저 나온 규칙이 이긴다**(속성 단위).
 * 즉 위쪽 규칙이 `tone` 을 정했으면 아래 규칙의 `tone` 은 무시되지만, 아래 규칙만 정한 `bold` 는 적용된다
 * (Google Sheets 와 동일한 모델 — "충돌하는 속성만 위가 이긴다").
 *
 * 대상 판정: `target` 미지정 규칙은 모든 컬럼에, 지정 규칙은 그 컬럼에만.
 * 조건 평가는 항상 **행 전체**(props)에 대해 돈다 — 다른 컬럼을 근거로 이 컬럼을 칠할 수 있게.
 *
 * 순수 함수(렌더 밖에서 테스트 가능). 매칭 규칙이 없으면 `null`.
 */
export function resolveCellFormat(
  rules: ConditionalFormatRule[] | undefined,
  columnKey: string,
  props: Record<string, PropertyValue>,
): ConditionalFormatStyle | null {
  if (!rules || rules.length === 0) return null

  let tone: ConditionalFormatTone | undefined
  let bold: boolean | undefined
  let strikethrough: boolean | undefined

  for (const rule of rules) {
    if (rule.target !== undefined && rule.target !== columnKey) continue
    if (!matchesRule(rule, props)) continue
    // 먼저 정해진 값이 이긴다 — 이미 정해진 속성은 건너뛴다.
    if (tone === undefined) tone = rule.style.tone
    if (bold === undefined) bold = rule.style.bold
    if (strikethrough === undefined) strikethrough = rule.style.strikethrough
    if (tone !== undefined && bold !== undefined && strikethrough !== undefined) break
  }

  if (tone === undefined && bold === undefined && strikethrough === undefined) return null
  return {
    ...(tone !== undefined ? { tone } : {}),
    ...(bold !== undefined ? { bold } : {}),
    ...(strikethrough !== undefined ? { strikethrough } : {}),
  }
}

/** 규칙 조건 평가 — 필터 트리와 동일 semantics(같은 평가기를 쓴다, 재구현 금지). */
export function matchesRule(
  rule: ConditionalFormatRule,
  props: Record<string, PropertyValue>,
): boolean {
  const when = rule.when
  // 레거시 평탄 배열도 필터와 동일하게 AND 로 해석한다(normalizeFilterRoot 와 같은 규약).
  if (Array.isArray(when)) return when.every((c) => passesFilterNode(props, c))
  return passesFilterNode(props, when)
}

/**
 * tone → 셀 className. DS 시맨틱 토큰만 쓴다(하드코딩 색 금지).
 * `-subtle` 배경 + `-text` 글자 — Badge/Alert 가 쓰는 것과 같은 상태 토큰 쌍이라
 * 라이트/다크가 같이 따라온다.
 */
const TONE_CLASS: Record<ConditionalFormatTone, string> = {
  danger: 'bg-error-subtle/80 text-error-text',
  warning: 'bg-warning-subtle/80 text-warning-text',
  success: 'bg-success-subtle/80 text-success-text',
  info: 'bg-info-subtle/80 text-info-text',
  accent: 'bg-primary/10 text-primary',
  muted: 'text-fg-muted',
}

/**
 * 서식 → className 문자열. 뷰(TableView)가 셀에 얹는다. 빈 서식이면 빈 문자열.
 * cn() 은 호출부에서 — 이 함수는 순수 문자열 생성만 한다(테스트 용이).
 */
export function conditionalFormatClassName(style: ConditionalFormatStyle | null): string {
  if (!style) return ''
  const parts: string[] = []
  if (style.tone) parts.push(TONE_CLASS[style.tone])
  if (style.bold) parts.push('font-semibold')
  if (style.strikethrough) parts.push('line-through')
  return parts.join(' ')
}

/**
 * 카드(board·gallery)에 입힐 서식 — 표의 셀 단위 규칙을 카드 한 장에 옮긴다.
 *
 *  - `card`: 카드 전체 서식. 행 전체 규칙(`target` 없음)과 **카드에 보이는 속성**을 대상으로 한 규칙이
 *    먼저 나온 순서로 이긴다(resolveCellFormat 과 같은 병합). 표에서 칸 하나가 칠해질 일이 카드에선
 *    카드 한 장이 칠해지는 것이다 — 카드 안 작은 글자 하나만 칠하면 보드에서 눈에 띄지 않는다.
 *  - `byKey`: 속성별 서식 — 그 속성을 대상으로 한 규칙만(행 전체 규칙은 card 가 이미 맡았다).
 *    카드가 그 속성 줄의 글자색을 바꿔 "왜 칠해졌나"를 가리킨다.
 *
 * 보이지 않는 속성을 대상으로 한 규칙은 카드를 칠하지 않는다 — 근거가 안 보이는 색은 읽을 수 없다.
 * [selfColoredKeys](카드 짜임의 배지 · 숫자 띠 칸)를 대상으로 한 규칙도 카드를 칠하지 않는다 — 그 자리는 제 색을 크게
 * 보일 만큼 눈에 띄어서, 카드까지 칠하면 같은 말을 두 번 하고 정작 다른 카드 서식(행 전체 규칙)이 묻힌다.
 */
export function resolveCardFormat(
  rules: ConditionalFormatRule[] | undefined,
  props: Record<string, PropertyValue>,
  visibleKeys: readonly string[],
  selfColoredKeys: readonly string[] = [],
): { card: ConditionalFormatStyle | null; byKey: Record<string, ConditionalFormatStyle> } {
  const byKey: Record<string, ConditionalFormatStyle> = {}
  if (!rules || rules.length === 0) return { card: null, byKey }
  const visible = new Set(visibleKeys)
  const selfColored = new Set(selfColoredKeys)
  const applicable = rules.filter((r) => r.target === undefined || visible.has(r.target))
  // 카드 전체 — 대상을 지운 규칙으로 바꿔 resolveCellFormat 의 "먼저 나온 규칙이 이긴다"를 그대로 쓴다.
  const card = resolveCellFormat(
    applicable
      .filter((r) => r.target === undefined || !selfColored.has(r.target))
      .map(({ target: _target, ...rest }) => rest),
    '',
    props,
  )
  for (const key of visible) {
    const style = resolveCellFormat(
      applicable.filter((r) => r.target === key),
      key,
      props,
    )
    if (style) byKey[key] = style
  }
  return { card, byKey }
}

/**
 * 카드 전체 서식 → className. 카드는 테두리 없이 그림자로 뜬 면이라(보드 표면 문법 2026-10-26) 상태는 **바탕색**만으로
 * 말한다 — 테두리를 되살리면 그림자와 겹쳐 경계가 두 번 그어진다.
 */
const CARD_TONE_CLASS: Record<ConditionalFormatTone, string> = {
  danger: 'bg-error-subtle',
  warning: 'bg-warning-subtle',
  success: 'bg-success-subtle',
  info: 'bg-info-subtle',
  accent: 'bg-brand-50',
  muted: 'opacity-70',
}

export function cardFormatClassName(style: ConditionalFormatStyle | null): string {
  if (!style) return ''
  const parts: string[] = []
  if (style.tone) parts.push(CARD_TONE_CLASS[style.tone])
  if (style.strikethrough) parts.push('[&_[data-card-title]]:line-through')
  return parts.join(' ')
}

/** 카드 안 속성 줄의 글자 서식 — 바탕은 카드가 맡으므로 글자색·굵기·취소선만. */
const TEXT_TONE_CLASS: Record<ConditionalFormatTone, string> = {
  danger: 'text-error-text',
  warning: 'text-warning-text',
  success: 'text-success-text',
  info: 'text-info-text',
  accent: 'text-primary',
  muted: 'text-fg-muted',
}

export function textFormatClassName(style: ConditionalFormatStyle | null | undefined): string {
  if (!style) return ''
  const parts: string[] = []
  if (style.tone) parts.push(TEXT_TONE_CLASS[style.tone])
  if (style.bold) parts.push('font-semibold')
  if (style.strikethrough) parts.push('line-through')
  return parts.join(' ')
}

/**
 * 바닥 집계 숫자의 상태 색 — 센 칸들을 조건부 서식이 상태 색으로 칠했으면 그 색(먼저 만난 것, muted 제외).
 * 「빈 값 10」이 주황 칸 열 개를 센 것이면 숫자도 주황 — 표의 칸과 바닥 숫자가 같은 말을 한다.
 * 칸을 세는 집계(빈 값·값 있음)만 잇는다 — 합계·평균은 칸 하나하나의 색을 물려받을 근거가 없다.
 * 센 칸이 하나도 칠해지지 않았으면 null(본문 글자색).
 */
export function aggregationTone(
  type: AggregationType,
  key: string,
  rows: readonly { props: Record<string, PropertyValue> }[],
  rules: ConditionalFormatRule[] | undefined,
): ConditionalFormatTone | null {
  if (!rules || rules.length === 0) return null
  if (type !== 'count_empty' && type !== 'count_not_empty') return null
  const wantEmpty = type === 'count_empty'
  for (const row of rows) {
    if (isEmptyCellValue(row.props[key]) !== wantEmpty) continue
    const tone = resolveCellFormat(rules, key, row.props)?.tone
    if (tone && tone !== 'muted') return tone
  }
  return null
}
