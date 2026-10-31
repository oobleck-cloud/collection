// @oobleck/collection — Collection + Views 플랫폼 코어(도메인 무관, 순수).
// "레코드 = 블록 문서, 속성 = 문서 projection, 뷰 = 렌더러"의 플랫폼 레이어(D-8).
// 공개 API 배럴. 패키지 내부 파일끼리는 상대경로(`./x`)로만 import 한다(순환·배럴 우회 방지).
// 블록팩(policy·product…)에 역의존하지 않는다 — 블록팩은 BlockPack 계약만 구현하면 된다.

export * from './types'
export * from './schema'
export * from './options'
export * from './view'
export * from './view-drift' // 영속된 뷰 설정 ↔ 현재 스키마의 드리프트 정리(저장된 뷰가 표를 비우지 않게)
export * from './view-patch' // 뷰 설정 차이 — 저장된 설정 위에 바꾼 항목만 얹는다(개인 초안, 순수)
export * from './saved-views' // 뷰 서랍 규칙 — 공개범위·소유 판정, 검색·섹션, 탭 꺼내기/넣기(순수)
export * from './aggregations'
export * from './date-value'
export * from './record-schema' // 스키마→행 쓰기 Zod 계약 파생(데이터 API·폼·AI 저작 공용, 순수)
export * from './geo-search' // geo 셀 주소검색 계약(GeoSearchResult·GeocodeProvider) — 구현은 lib/infra/geocode
export * from './trust' // 셀 단위 신뢰등급(R-37) — 등급 격자·불변식·신선도 강등(순수)
export * from './trust-column' // 신뢰도 파생 컬럼 — 리서치 기반 컬렉션의 표준 장치(도메인 무관)
export * from './query' // 저장소 무관 쿼리 IR(필터 트리·정렬·페이지) — 서버 어댑터의 계약면
export * from './headless' // 쿼리 실행 주체 분리(client/server)·전송 인코딩·집계 범위
export * from './auto-size' // 컬럼 폭 content-based auto-fit(분위수 기반, 순수)
export * from './column-widths' // 뷰별 컬럼 폭(끌어서 정한 폭) — 클램프·스키마 위 덮기(순수)
export * from './date-term' // 낱말 → 날짜(범위) 파서 — 상대·한국어·압축 표기(순수, now 주입)
export * from './person' // 사람(person/multi_person) 값 — id 정규화·명단 검색·고르기(순수)
export * from './relative-value' // 저장은 식으로, 실행은 리터럴로 — 상대 날짜 값과 해소(순수, now 주입)
export * from './search-suggest' // 검색어 → 구조화 필터 제안(스키마 파생 · 접두 검증, 순수)
export * from './conditional-format' // 스프레드시트식 조건부 서식(규칙 → 셀 스타일)
export * from './struct' // 구조 속성 — 칸 풀기 · 표시 글자 · 칸 조건 풀기(순수)
export * from './relation-table' // 관계 표(카드 블록) — 열·줄 수·접기 규칙(순수)
export * from './i18n'
export * from './doc-blocks' // 읽기전용 문서 본문 블록 빌더(순수, DocBlockNode 정본 — 클라 미의존)
// 뷰 컴포넌트는 외부 소비처가 `@oobleck/collection/views/...` 로 deep-import 한다(이 배럴엔 노출 안 함).
// 그래야 클라이언트 컴포넌트(Tiptap 등 무거운 의존)가 SSR 트리에 끌려들지 않음.

export * from './geo'
export * from './map-markers'
