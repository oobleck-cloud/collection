// @oobleck/collection — 카드·행 「열기」 마우스 핸들러(RecordCard · ListView 행 · 표 제목이 공유).

import type { MouseEvent } from 'react'

/**
 * 카드·행을 여는 마우스 핸들러 — 왼쪽 클릭과 **가운데 클릭**(auxclick, button 1)을 같은 onOpen 으로 보낸다.
 *
 * - 이벤트를 그대로 넘긴다 — 호스트가 ⌘/Ctrl(+Shift)·가운데 클릭을 「새 탭에서 열기」로 읽는다. 예전엔 카드가
 *   이벤트를 버리고 `onOpen()` 만 불러, 보드에서 ⌘+클릭해도 늘 지금 탭에서 열렸다.
 * - 가운데 클릭은 click 이 아니라 auxclick 으로 온다. 카드 안 버튼(관계 표 「네고 콜」·케밥)은 click 만 막으므로,
 *   안쪽 컨트롤에서 올라온 auxclick 은 여기서 거른다. mousedown 의 기본 동작(자동 스크롤)도 막는다.
 */
export function openClickHandlers(onOpen: ((event: MouseEvent) => void) | undefined): {
  onClick?: (e: MouseEvent<HTMLElement>) => void
  onAuxClick?: (e: MouseEvent<HTMLElement>) => void
  onMouseDown?: (e: MouseEvent<HTMLElement>) => void
} {
  if (!onOpen) return {}
  return {
    onClick: (e) => onOpen(e),
    onAuxClick: (e) => {
      if (e.button !== 1 || fromNestedControl(e)) return
      e.preventDefault()
      onOpen(e)
    },
    onMouseDown: (e) => {
      if (e.button === 1 && !fromNestedControl(e)) e.preventDefault()
    },
  }
}

/** 이벤트가 카드 **안쪽** 컨트롤(버튼·링크·입력)에서 왔는가 — 카드 자신(div role=button)은 아니다. */
function fromNestedControl(e: MouseEvent<HTMLElement>): boolean {
  const target = e.target instanceof Element ? e.target : null
  const control = target?.closest('button, a, input, select, textarea, [role="menuitem"]')
  return control != null && control !== e.currentTarget && e.currentTarget.contains(control)
}
