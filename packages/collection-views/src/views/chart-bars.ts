// @oobleck/collection — 차트(막대) 모델 순수 변환.
//
// ChartView 에서 분리한 순수 모듈(React·DOM·@oobleck/systheme 비의존) — 단위 테스트 용이.
// "그룹(키+행수) → 막대 모델" 변환만 담당한다. 그룹 버킷팅 자체는 코어 viewGroups 가 한다.
//
// 정규화: 가장 큰 그룹의 count 를 100%로 보고 각 막대의 너비 비율(pct)을 산출한다(가로 막대).
// max 가 0(모든 그룹 count 0)이면 0으로 나누지 않고 pct=0 으로 둔다(NaN/Infinity 방지).

import { GROUP_EMPTY } from '@oobleck/collection'

/** ChartView 가 소비하는 한 막대의 표시 모델. */
export type ChartBar = {
  /** 그룹 키(select 값 또는 GROUP_EMPTY). React key·식별용. */
  key: string
  /** 표시 라벨 — labelMap 우선, GROUP_EMPTY 는 '없음', 그 외는 키 그대로. */
  label: string
  /** 이 그룹의 레코드 수(막대 길이의 절대값). */
  count: number
  /** 최대 그룹 대비 너비 비율(0~100 정수). max=0 이면 0. */
  pct: number
  /** 옵션 색 이름(select/multi_select). 없으면 미지정. */
  color?: string
}

/**
 * 그룹 목록(키+count) → 막대 모델 목록(순수). 입력 순서를 보존한다(코어 viewGroups 가 이미 정렬함).
 *  - pct = max>0 ? round(count/max*100) : 0  (가장 긴 막대 = 100%, 0 나눗셈 방지).
 *  - label = labelMap[key] ?? (key===GROUP_EMPTY ? '없음' : key).
 *  - color = colorMap[key] (있을 때만 — GROUP_EMPTY 등 색 없는 그룹은 미지정).
 * 빈 입력 → 빈 배열.
 */
export function toBars(
  groups: { key: string; count: number }[],
  labelMap: Map<string, string>,
  colorMap: Map<string, string>,
): ChartBar[] {
  const max = groups.reduce((m, g) => (g.count > m ? g.count : m), 0)
  return groups.map((g) => {
    const label = labelMap.get(g.key) ?? (g.key === GROUP_EMPTY ? '없음' : g.key)
    const color = colorMap.get(g.key)
    return {
      key: g.key,
      label,
      count: g.count,
      pct: max > 0 ? Math.round((g.count / max) * 100) : 0,
      ...(color !== undefined ? { color } : {}),
    }
  })
}
