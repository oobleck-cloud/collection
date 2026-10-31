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

import { passesFilterNode } from './view'

import type { FilterExpr, PropertyValue } from './types'

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
