// @mvos/collections — 생성된 CSS 규칙 존재 확인(스토리 계약 검사용).
//
// 왜 필요한가: collections 의 hover 어포던스는 `opacity-0` + `group-hover/row:opacity-100` 짝이다.
// Tailwind 스캔 범위에서 이 패키지가 빠지면 **뒤쪽 규칙만** 사라진다 — 요소는 계속 `opacity-0`
// 이라 정적 스냅샷은 멀쩡하고, 마우스를 올려야만 "눌러도 아무것도 안 보이는" 상태가 드러난다.
// #366 의 TableView 쪽 증상이 정확히 이것이었다.
//
// play 함수의 합성 이벤트로는 CSS `:hover` 를 켤 수 없으므로, 대신 **규칙이 생성됐는지**를
// CSSOM 에서 직접 확인한다. 시각 스냅샷이 원리적으로 못 보는 축을 메우는 검사다.

/** @layer·@media 등 중첩 규칙을 재귀적으로 훑어 selectorText 를 모두 뱉는다. */
function* selectorsOf(rules: CSSRuleList): Generator<string> {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) yield rule.selectorText
    const nested = (rule as CSSGroupingRule).cssRules
    if (nested) yield* selectorsOf(nested)
  }
}

/**
 * 문서에 로드된 스타일시트 중 selector 에 `needle` 을 포함하는 규칙이 하나라도 있으면 true.
 * needle 은 **CSS 이스케이프된 형태**로 준다(예: `group-hover\\/row\\:opacity-100`).
 */
export function hasCssRuleMatching(needle: string): boolean {
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // cross-origin 시트 — 접근 불가, 건너뛴다.
    }
    for (const selector of selectorsOf(rules)) {
      if (selector.includes(needle)) return true
    }
  }
  return false
}
