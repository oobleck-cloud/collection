import type { BlockDocument, BlockPack, PropertyDef, PropertyValue } from './types'

// 빈 데이터베이스용 BlockPack — 도메인 무관(플라톤: 아직 Form 이 없는 "원형 없는" 컬렉션).
// 프리셋 컬럼은 'title'(이름) 하나뿐이고, 나머지 컬럼은 사용자가 동적 base(노션식 "+")로 자유 추가한다
// (applySchemaConfig 가 base 를 팩 기본 앞에 끼움). base 컬럼은 frontmatter(편집형)다.
// 세 멤버 모두 순수 함수(불변).
//
// 제목 컬럼은 source: 'projection' — 노션처럼 "DB 행 = 페이지" 를 보장하기 위함이다. TableView 는
// 첫 컬럼이 읽기전용(!editable)일 때만 페이지 링크형 제목 셀(파일 아이콘 + "열기")로 렌더하고,
// frontmatter(편집형)면 평범한 텍스트 셀로 떨어뜨려 페이지 연결이 사라진다. 제목을 projection 으로
// 두면(product/plan 팩과 동일 규약) 항상 제목 셀이 되고, 인라인 편집은 writeTitle(onEditTitle) 경로로
// 유지된다 — 즉 제목 행은 무조건 해당 행 페이지로 연결된다.

/** 빈 DB 의 기본 제목 컬럼 키 — 모든 노션 DB 가 갖는 "이름" 컬럼. */
export const BLANK_TITLE_KEY = 'title'

export const blankPropertySchema: PropertyDef[] = [
  { key: BLANK_TITLE_KEY, label: '이름', type: 'text', source: 'projection', origin: 'preset' },
]

function readProperties(doc: BlockDocument): Record<string, PropertyValue> {
  return { ...(doc.properties ?? {}) }
}

function writeProperty(doc: BlockDocument, key: string, value: PropertyValue): BlockDocument {
  return { ...doc, properties: { ...(doc.properties ?? {}), [key]: value } }
}

function writeTitle(doc: BlockDocument, value: string): BlockDocument {
  return writeProperty(doc, BLANK_TITLE_KEY, value)
}

export const blankPack: BlockPack<Record<string, PropertyValue>> = {
  propertySchema: blankPropertySchema,
  readProperties,
  writeProperty,
  writeTitle,
}

/** 새 빈 행 — 빈 properties(제목은 사용자가 입력). */
export function emptyRow(): BlockDocument {
  return { properties: {} }
}

/** 제목 없는 행의 표시값(노션식 "제목 없음"). */
export const UNTITLED_LABEL = '(제목 없음)'

/**
 * 행 문서에서 제목 문자열을 뽑는다(불투명 doc → 안전 추출) — BLANK_TITLE_KEY 의 정본 리더.
 *  - doc.properties.title 이 비지 않은 문자열이면 그 값(trim 전 원본).
 *  - 누락/빈문자열/비문자열이면 UNTITLED_LABEL.
 * doc 형태를 신뢰하지 않는다(unknown) — 저장소가 임의 JSON 을 돌려줄 수 있어 방어적으로 읽는다.
 * (구 lib/workspace/row-title.ts 소재 — 제목 키 소유자인 collections 로 승격, 워크스페이스는 재노출.)
 */
export function rowTitle(doc: unknown): string {
  if (doc !== null && typeof doc === 'object' && 'properties' in doc) {
    const props = (doc as { properties?: unknown }).properties
    if (props !== null && typeof props === 'object') {
      const raw = (props as Record<string, unknown>)[BLANK_TITLE_KEY]
      if (typeof raw === 'string' && raw.trim().length > 0) return raw
    }
  }
  return UNTITLED_LABEL
}
