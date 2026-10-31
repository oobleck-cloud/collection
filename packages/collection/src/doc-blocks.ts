// @mvos/collections — 읽기전용 문서 본문 블록 빌더(순수, TipTap JSON 최소 형태).
//
// "행=문서" 상세 투영(RecordDocumentView 가 읽는 body 블록)을 만드는 doc 빌더가 세 곳(마켓플레이스
// toPackDetailDoc·백오피스 toAiInferenceDetailDoc·헤드리스 endpointBody)에 heading/paragraph/table/
// bulletList 조립 로직을 복붙해 갖고 있었다(3중 사본). 드리프트를 없애려고 그 공통 조립을 여기로 추출한다.
//
// 층위: collections L1(공유 기질) — 백오피스·마켓플레이스·헤드리스가 전부 import 가능하다(도메인 역의존
// 없음). 렌더러(RecordDocumentView)가 소비하는 알려진 타입만 만든다(heading/paragraph/bulletList/table/
// codeBlock). 순수 함수 — 단위테스트로 셰이프를 핀한다.
//
// **바이트 동치 보존:** 기존 세 사본이 내던 출력과 정확히 같은 JSON 을 만든다. 셀 attrs 차이(헤드리스는
// 에디터 왕복 무손실을 위해 TABLE_CELL_ATTRS 를 명시, 마켓플레이스·백오피스는 정적 렌더 전용이라 생략)를
// tableBlock 의 옵션(cellAttrs)으로 파라미터화해, 어느 소비처든 자기 기존 출력을 그대로 재생산한다.

/**
 * 본문 블록 노드(TipTap JSON 최소 형태) — 상세 문서 body 가 담는 알려진 블록 타입만 표현한다.
 * (heading/paragraph/bulletList/table/codeBlock/tableRow/tableCell/tableHeader/text 등.)
 * 정본은 여기(비클라이언트 순수 모듈) — RecordDocumentView 가 이 타입을 재노출해 하위호환을 유지한다.
 */
export type DocBlockNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: DocBlockNode[]
  text?: string
}

/** 인라인 텍스트 노드 — `{ type:'text', text }`. */
export function textNode(text: string): DocBlockNode {
  return { type: 'text', text }
}

/** heading 블록 — 기본 level 3(상세 문서의 섹션 제목 관례). content=단일 텍스트. */
export function headingBlock(label: string, level = 3): DocBlockNode {
  return { type: 'heading', attrs: { level }, content: [textNode(label)] }
}

/** paragraph 블록 — 단일 텍스트(빈 문자열도 텍스트 노드를 남긴다: 기존 정적 빌더와 동일). */
export function paragraphBlock(label: string): DocBlockNode {
  return { type: 'paragraph', content: [textNode(label)] }
}

/** bulletList 블록 — 각 항목을 listItem>paragraph 로 감싼다(마켓플레이스 게이트 목록 셰이프). */
export function bulletListBlock(items: readonly string[]): DocBlockNode {
  return {
    type: 'bulletList',
    content: items.map((t) => ({ type: 'listItem', content: [paragraphBlock(t)] })),
  }
}

/**
 * codeBlock 블록 — attrs.language + 단일 텍스트(헤드리스 JSON 예시 셰이프). language 미지정이면 attrs 없이.
 * (RecordDocumentView 는 codeBlock 을 blockText 로 평탄화해 <pre><code> 로 렌더한다.)
 */
export function codeBlock(code: string, language?: string): DocBlockNode {
  return {
    type: 'codeBlock',
    ...(language !== undefined ? { attrs: { language } } : {}),
    content: [textNode(code)],
  }
}

/**
 * 표 셀 빌더 옵션 — 셰이프 차이를 파라미터화(바이트 동치 보존).
 *  - cellAttrs: 지정 시 tableHeader/tableCell 에 이 attrs 를 실는다(헤드리스 = 에디터 왕복 무손실).
 *    미지정이면 attrs 없이(마켓플레이스·백오피스 = 정적 렌더 전용).
 *  - emptyCellContent: true 면 빈 문자열 셀의 paragraph content 를 빈 배열로(헤드리스). 미지정/false 면
 *    빈 문자열도 텍스트 노드를 남긴다(마켓플레이스·백오피스 — 기존 동작).
 */
export type TableBlockOptions = {
  cellAttrs?: Record<string, unknown>
  emptyCellContent?: boolean
}

/** 한 표 셀(tableHeader | tableCell) — paragraph 로 감싼 텍스트. 옵션으로 attrs·빈셀 처리를 맞춘다. */
function cellNode(
  kind: 'tableHeader' | 'tableCell',
  value: string,
  opts: TableBlockOptions,
): DocBlockNode {
  const paraContent = opts.emptyCellContent && value === '' ? [] : [textNode(value)]
  return {
    type: kind,
    ...(opts.cellAttrs !== undefined ? { attrs: { ...opts.cellAttrs } } : {}),
    content: [{ type: 'paragraph', content: paraContent }],
  }
}

/** 한 표 행 — 셀 kind(header/cell) + 값 배열. */
export function tableRowBlock(
  kind: 'tableHeader' | 'tableCell',
  values: readonly string[],
  opts: TableBlockOptions = {},
): DocBlockNode {
  return { type: 'tableRow', content: values.map((v) => cellNode(kind, v, opts)) }
}

/**
 * 표 블록 — 헤더 행(tableHeader) + 데이터 행(tableCell)들. header/rows 는 평문 텍스트 배열.
 * opts 로 셀 attrs·빈셀 처리를 소비처 기존 출력과 맞춘다(바이트 동치).
 */
export function tableBlock(
  header: readonly string[],
  rows: readonly (readonly string[])[],
  opts: TableBlockOptions = {},
): DocBlockNode {
  return {
    type: 'table',
    content: [
      tableRowBlock('tableHeader', header, opts),
      ...rows.map((r) => tableRowBlock('tableCell', r, opts)),
    ],
  }
}
