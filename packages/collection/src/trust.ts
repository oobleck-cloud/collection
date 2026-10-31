import type { BlockDocument, CellTrust, Grade, PropertyValue } from './types'

export type { CellTrust, Grade } from './types'

// 셀 단위 신뢰등급 — ContextDocument 온톨로지(볼트 R-37).
//
// 왜 셀 단위인가: 한 행 안에서도 필드마다 근거의 질이 다르다. 예를 들어 장소 행은
// 주소·좌표는 공공데이터 대조를 통과했지만(sourced) "야외 테이블이 있는가" 같은 도메인
// 속성은 블로그가 그렇게 말했을 뿐이다(claimed). 행 단위로 "이 행은 sourced" 라고 하면
// 거짓말이 된다. 그래서 등급은 **값이 아니라 값에 붙는 메타**이며, 행 기본이 아니라
// 셀 오버라이드로 표현한다.
//
// 저장 위치: `doc.trust` — properties 의 형제 필드({ 컬럼키: CellTrust }). properties 안에
// 예약 키로 숨기지 않는 이유는 두 가지다. (1) 이건 속성이 아니라 속성에 대한 메타다.
// (2) PropertyValue 는 닫힌 유니온이라 임의 레코드를 담을 수 없다. 등급을 모르는 기존 뷰·팩은
// 이 필드를 그냥 무시하면 되므로 하위호환이 깨지지 않는다.

/** 등급 격자(낮음→높음). 순서가 의미를 갖는다 — 비교는 gradeRank 로. */
export const GRADES: readonly Grade[] = ['hypothesis', 'claimed', 'sourced', 'verified']

/** 등급을 순위 정수로(비교용). 알 수 없는 값은 최하위. */
export function gradeRank(g: Grade | undefined): number {
  const i = GRADES.indexOf(g as Grade)
  return i < 0 ? 0 : i
}

function trustMap(doc: BlockDocument): Record<string, CellTrust> {
  const raw = doc.trust
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {}
}

/** 한 컬럼의 신뢰 메타를 읽는다. 없으면 undefined(= 등급 미부여). */
export function readTrust(doc: BlockDocument, propKey: string): CellTrust | undefined {
  return trustMap(doc)[propKey]
}

/** 한 컬럼의 등급을 읽는다. 메타가 없으면 hypothesis(모르는 건 모르는 것). */
export function gradeOf(doc: BlockDocument, propKey: string): Grade {
  return readTrust(doc, propKey)?.g ?? 'hypothesis'
}

/** 한 컬럼의 신뢰 메타를 쓴다(불변). */
export function writeTrust(doc: BlockDocument, propKey: string, trust: CellTrust): BlockDocument {
  return { ...doc, trust: { ...trustMap(doc), [propKey]: trust } }
}

/** 한 컬럼의 신뢰 메타를 지운다(불변). */
export function clearTrust(doc: BlockDocument, propKey: string): BlockDocument {
  const next = trustMap(doc)
  delete next[propKey]
  return { ...doc, trust: next }
}

/**
 * 값이 비었는가 — null·undefined·빈 문자열·빈 배열.
 * export 하는 이유: "빈 칸은 hypothesis 여야 한다"(I3)는 검사만이 아니라 **쓰기 지점의 선행조건**이기도
 * 하다 — 빈 칸에 확인 도장을 찍는 경로(markVerified)와 그 버튼을 그리는 UI 가 같은 판정을 써야 한다.
 */
export function isEmptyValue(v: PropertyValue | undefined): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

/** 승격 주체 — 자동(에이전트·AI 파이프라인)인가 사람인가. */
export type Actor = 'auto' | 'human'

/**
 * 자동 상향의 상한은 sourced (I2).
 * verified 는 "사람이 확인했다" 는 뜻이므로 파이프라인이 스스로 부여할 수 없다.
 * 강등은 주체와 무관하게 항상 허용한다 — 소스 상충·신선도 만료를 즉시 반영해야 하므로.
 */
export function canSetGrade(from: Grade, to: Grade, actor: Actor): boolean {
  if (gradeRank(to) <= gradeRank(from)) return true // 강등·동급은 항상 허용
  return actor === 'human' || to !== 'verified'
}

/** 불변식 위반 코드(린트·게이트용). */
export type TrustViolation =
  | 'I1_source_required' // sourced 이상인데 src 가 없다
  | 'I2_auto_cannot_verify' // 자동 주체가 verified 를 부여했다
  | 'I3_empty_must_be_hypothesis' // 값이 비었는데 등급이 hypothesis 가 아니다
  | 'I4_unknown_grade' // 격자에 없는 등급

/**
 * 셀 하나의 불변식을 검사한다. 순수 — 위반 코드 배열을 돌려주고 throw 하지 않는다.
 * (I4 강등 자유는 canSetGrade 가 담당하므로 여기서 검사하지 않는다.)
 */
export function validateCell(
  value: PropertyValue | undefined,
  trust: CellTrust | undefined,
  actor: Actor = 'auto',
): TrustViolation[] {
  if (!trust) return []
  const out: TrustViolation[] = []
  if (!GRADES.includes(trust.g)) {
    out.push('I4_unknown_grade')
    return out
  }
  if (isEmptyValue(value) && trust.g !== 'hypothesis') out.push('I3_empty_must_be_hypothesis')
  if (gradeRank(trust.g) >= gradeRank('sourced') && !trust.src?.trim())
    out.push('I1_source_required')
  if (trust.g === 'verified' && actor === 'auto') out.push('I2_auto_cannot_verify')
  return out
}

/** 행 전체 검사 — { 컬럼키: 위반코드[] } 로, 위반이 있는 컬럼만 담는다. */
export function validateRow(
  doc: BlockDocument,
  actor: Actor = 'auto',
): Record<string, TrustViolation[]> {
  const props = doc.properties ?? {}
  const map = trustMap(doc)
  const out: Record<string, TrustViolation[]> = {}
  for (const [key, trust] of Object.entries(map)) {
    const v = validateCell(props[key], trust, actor)
    if (v.length > 0) out[key] = v
  }
  return out
}

/**
 * 등급 미달로 "확인 필요" 인 컬럼들 — 제보 폼이 물어야 할 질문 목록의 원천.
 * hypothesis 이거나 메타가 아예 없는(=미부여) 컬럼을 돌려준다.
 */
export function cellsNeedingEvidence(doc: BlockDocument, propKeys: readonly string[]): string[] {
  return propKeys.filter((k) => gradeOf(doc, k) === 'hypothesis')
}

/**
 * 행의 대표 등급 — 가장 약한 셀의 등급(최소값). 셀이 하나도 없으면 hypothesis.
 * "이 행 전체를 얼마나 믿을 수 있나" 를 한 값으로 보여줄 때 쓴다(마커 색·배지).
 * 최대가 아니라 **최소**인 이유: 한 칸이라도 근거가 없으면 행 전체를 그만큼만 믿어야 한다.
 */
export function rowGrade(doc: BlockDocument, propKeys: readonly string[]): Grade {
  if (propKeys.length === 0) return 'hypothesis'
  let min: Grade = 'verified'
  for (const k of propKeys) {
    const g = gradeOf(doc, k)
    if (gradeRank(g) < gradeRank(min)) min = g
  }
  return min
}

/**
 * 신선도 강등 — 마지막 확인이 maxAgeDays 보다 오래됐으면 sourced 이상을 claimed 로 내린다.
 * 폐업·철거가 잦은 도메인에서 "오래된 sourced" 가 조용히 거짓이 되는 것을 막는다.
 * now 는 주입(순수 함수 — Date.now() 직접 호출 금지).
 */
export function decayStale(trust: CellTrust, now: Date, maxAgeDays: number): CellTrust {
  if (!trust.at || gradeRank(trust.g) < gradeRank('sourced')) return trust
  const checked = new Date(trust.at).getTime()
  if (Number.isNaN(checked)) return trust
  const ageDays = (now.getTime() - checked) / 86_400_000
  return ageDays > maxAgeDays ? { ...trust, g: 'claimed' } : trust
}
