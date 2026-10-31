import type { BlockDocument, BlockPack, Grade, PropertyDef, PropertyValue } from './types'
import { GRADES, gradeOf, gradeRank, rowGrade } from './trust'

// 신뢰도 컬럼 — **리서치로 만들어진 컬렉션의 표준 장치**(도메인 무관).
//
// AI·파이프라인이 외부 소스에서 긁어 만든 행은, 사람이 손으로 채운 행과 성질이 다르다. 어떤 칸은
// 공공데이터 대조를 통과했고 어떤 칸은 블로그 한 줄이 전부다. 그런 컬렉션은 "무엇이 들어 있나"만큼
// **"이 행을 얼마나 믿을 수 있나"** 가 훑기의 1차 정보가 된다.
//
// 그래서 등급을 셀마다 배지로 흩뿌리지 않고, **행 대표 등급 한 칸**을 파생 컬럼으로 세운다.
// 컬럼이 많은 표에서 셀마다 배지를 달면 세로로 길어져 훑기가 되레 어려워진다 — 표는 한 칸으로
// 훑고, 셀별 근거는 행을 열었을 때 본다.
//
// 파생(projection)이라 **저장하지 않는다.** 정본은 언제나 doc.trust 이고 이 컬럼은 그것의 읽기
// 투영일 뿐이다 — 값을 따로 저장하면 두 개의 진실원천이 생기고 반드시 어긋난다.

/** 신뢰도 컬럼 키(예약). 데이터 컬럼과 충돌하지 않도록 밑줄 두 개로 시작한다. */
export const TRUST_COLUMN_KEY = '__grade'

/** 등급 → 표시 라벨(사람이 읽는 말). 등급 이름 자체는 개발자 어휘라 표에는 이 라벨을 쓴다. */
export const GRADE_LABEL: Record<Grade, string> = {
  verified: '사람이 확인',
  sourced: '대조로 확인',
  claimed: '누군가의 말',
  hypothesis: '확인 필요',
}

/**
 * 등급 → DS 태그 색. 잉크 농도만으로는 표 셀에서 구분이 약해 색 채널을 하나 더 준다(이중 부호화).
 * export 하는 이유: 표의 신뢰도 컬럼과 행 상세의 근거 패널이 **같은 등급에 같은 색**을 써야 한다 —
 * 두 곳이 따로 색을 고르면 같은 사실이 두 색으로 보인다.
 */
export const GRADE_COLOR: Record<Grade, string> = {
  verified: 'green',
  sourced: 'gray',
  claimed: 'gray',
  hypothesis: 'orange',
}

/**
 * 신뢰도 컬럼 정의. `source: 'projection'` — 계산형·읽기전용이라 셀에서 직접 수정할 수 없다
 * (등급은 근거로부터 파생되는 것이지 사람이 타이핑하는 값이 아니다).
 */
export function trustColumnDef(label = '신뢰도'): PropertyDef {
  return {
    key: TRUST_COLUMN_KEY,
    label,
    type: 'select',
    source: 'projection',
    origin: 'preset',
    options: GRADES.map((g) => ({ value: GRADE_LABEL[g], color: GRADE_COLOR[g] })),
  }
}

/** 문서의 행 대표 등급 라벨. 데이터 컬럼 중 가장 약한 셀이 행을 대표한다(rowGrade). */
export function trustColumnValue(doc: BlockDocument, dataKeys: readonly string[]): string {
  return GRADE_LABEL[rowGrade(doc, dataKeys)]
}

/**
 * 근거가 필요한 셀 수 — "이 행에서 몇 칸이 비었나". 표의 보조 신호·정렬에 쓴다.
 * hypothesis(미부여 포함)인 칸을 센다.
 */
export function evidenceGapCount(doc: BlockDocument, dataKeys: readonly string[]): number {
  return dataKeys.filter((k) => gradeOf(doc, k) === 'hypothesis').length
}

/**
 * 기존 팩에 신뢰도 컬럼을 얹은 새 팩(합성, 원본 불변).
 * 어떤 컬렉션이든 이 한 줄로 표준 장치를 붙인다 — 팩이 도메인 무엇이든 상관없다:
 *
 *   const pack = withTrustColumn(blankPack, ['geo', 'phone', 'bizStatus'])
 *
 * dataKeys 는 **등급을 집계할 데이터 컬럼**이다. 여기에 TRUST_COLUMN_KEY 자신을 넣으면 자기참조가
 * 되므로 넣지 않는다(넣어도 아래에서 걸러낸다).
 */
export function withTrustColumn<P extends Record<string, PropertyValue>>(
  pack: BlockPack<P>,
  dataKeys: readonly string[],
  label?: string,
): BlockPack<P> {
  const keys = dataKeys.filter((k) => k !== TRUST_COLUMN_KEY)
  return {
    ...pack,
    propertySchema: [...pack.propertySchema, trustColumnDef(label)],
    readProperties: (doc: BlockDocument): P => ({
      ...pack.readProperties(doc),
      [TRUST_COLUMN_KEY]: trustColumnValue(doc, keys),
    }),
    // 파생 컬럼은 쓰기를 삼킨다 — 실수로 등급을 직접 쓰려 해도 문서가 변하지 않는다.
    writeProperty: (doc: BlockDocument, key: string, value: PropertyValue): BlockDocument =>
      key === TRUST_COLUMN_KEY ? doc : pack.writeProperty(doc, key, value),
  }
}

/**
 * 등급 오름차순 정렬 키 — 약한 행이 위로 온다.
 * 운영자가 표를 열었을 때 **손봐야 할 행이 먼저** 보여야 한다. 같은 등급이면 빈 칸이 많은 행이 먼저.
 */
export function triageOrder(doc: BlockDocument, dataKeys: readonly string[]): number {
  const g = rowGrade(doc, dataKeys)
  return gradeRank(g) * 1000 - evidenceGapCount(doc, dataKeys)
}
