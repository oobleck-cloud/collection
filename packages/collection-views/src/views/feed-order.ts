// @oobleck/collection — 피드 정렬 폴백(순수 모듈).
//
// FeedView 에서 분리한 순수 로직(React·DOM·@oobleck/systheme 비의존) — 단위 테스트 용이.
//
// 역할: view.sort 가 비었을 때의 "최신순" 폴백만 책임진다. view.sort 가 있으면 코어
//   viewRows 가 이미 정렬하므로 FeedView 는 이 폴백을 호출하지 않는다(이중 정렬 방지).
//
// ★ 타임존 일관성(BL9/N2와 동일 규율): date-only 값('YYYY-MM-DD')은 Date.parse 가 **UTC 자정**
//   으로 파싱된다. 비교를 Date.parse(=epoch ms)로 하므로 로컬 메서드를 섞지 않는다 — 서버(UTC)·
//   클라이언트(로컬) 결과가 갈리지 않아 hydration 불일치가 없다.
//
// 순수성: wall-clock(zero-arg new Date()/Date.now()) 호출 없음 — 모든 ms 는 레코드 값에서 파생.

import type { PropertyDef, PropertyValue } from '@oobleck/collection'
import type { Row } from '@oobleck/collection'
import { dateValueStart } from '@oobleck/collection'

type Props = Record<string, PropertyValue>

/**
 * 정렬 폴백에 쓸 date 속성 키 — 스키마에서 *첫* date 타입 컬럼. 없으면 undefined.
 * (어느 컬럼으로 "최신순"을 정의할지의 단일 규칙. 타임라인이 startKey 를 명시 지정하는 것과 달리
 *  피드는 사용자 설정이 없으므로 스키마 선언 순서의 첫 date 를 관례로 채택한다.)
 */
export function firstDateKey(schema: PropertyDef[]): string | undefined {
  return schema.find((d) => d.type === 'date')?.key
}

/** ISO date string(기간/시간 포함) → *시작* timestamp(ms). 파싱 실패·비문자열·빈값이면 null. */
function parseDateMs(v: PropertyValue): number | null {
  if (typeof v !== 'string' || v.length === 0) return null
  const t = Date.parse(dateValueStart(v))
  return Number.isNaN(t) ? null : t
}

/**
 * view.sort 가 비었을 때의 폴백 정렬 — 첫 date 속성 기준 **내림차순(최신 먼저)**, 안정 정렬.
 *  - dateKey 가 없으면(=date 컬럼 없음) 입력 순서를 그대로 보존(불변).
 *  - 날짜값이 없는(null/파싱불가) 행은 항상 뒤로(asc·desc 무관) — 누락이 머리에 끼지 않게.
 *  - 동률(같은 ms, 또는 둘 다 날짜 없음)은 입력 순서 유지(stable) — 인덱스 tie-break.
 *
 * @param rows  추출된 props 를 가진 행 목록(읽기전용, 불변 — 새 배열 반환).
 * @param dateKey  정렬 기준 date 속성 키. undefined 면 정렬하지 않고 입력 순서 반환.
 */
export function orderByRecency<P extends Props>(
  rows: Row<P>[],
  dateKey: string | undefined,
): Row<P>[] {
  if (!dateKey) return rows.slice()
  return rows
    .map((row, index) => ({ row, index, ms: parseDateMs(row.props[dateKey] ?? null) }))
    .sort((a, b) => {
      // 날짜 없는 행은 항상 뒤로(부호 반전 밖에서 처리 — desc 여도 끝에 남는다).
      if (a.ms === null && b.ms === null) return a.index - b.index
      if (a.ms === null) return 1
      if (b.ms === null) return -1
      if (a.ms !== b.ms) return b.ms - a.ms // 내림차순(최신 먼저)
      return a.index - b.index // 동률 tie-break: 입력 순서 유지(stable)
    })
    .map((w) => w.row)
}
