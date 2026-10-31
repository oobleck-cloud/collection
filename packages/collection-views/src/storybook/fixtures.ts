// @mvos/collections — Storybook 픽스처(뷰 스토리 공용).
//
// 이 패키지의 스토리는 design-system 의 Storybook 이 인덱싱한다
// (`packages/design-system/.storybook/main.ts` 의 stories 글롭 + `preview.css` 의 `@source`).
// 목적은 **시각회귀 커버리지**다 — collections 는 리포에서 레이아웃 밀도가 가장 높은데
// 그동안 Chromatic/Lost Pixel 이 한 장도 찍지 못했다.
//
// 그래서 픽스처는 전부 **결정론적**이다: 무작위·현재시각·네트워크 없음. 스냅샷이 커밋과
// 무관하게 흔들리면 베이스라인이 신뢰를 잃고, 그 순간 시각회귀는 다시 사각지대가 된다.
// (날짜 축을 쓰는 뷰는 `FIXED_NOW` 로 시계까지 고정한다 — withFixedNow 참조.)

import type {
  BlockDocument,
  BlockPack,
  PropertyDef,
  PropertyValue,
  TableRecord,
  ViewConfig,
} from '@oobleck/collection'

export type FixtureProps = Record<string, PropertyValue>

/**
 * 최소 BlockPack — frontmatter 를 그대로 읽고 쓰는 항등 팩.
 * 뷰는 블록팩 계약만 알면 되므로(도메인 무지) 스토리도 도메인 팩을 끌어오지 않는다.
 */
export function makePack(schema: PropertyDef[]): BlockPack<FixtureProps> {
  return {
    propertySchema: schema,
    readProperties: (doc: BlockDocument): FixtureProps => doc.properties ?? {},
    writeProperty: (doc: BlockDocument, key: string, value: PropertyValue): BlockDocument => ({
      ...doc,
      properties: { ...(doc.properties ?? {}), [key]: value },
    }),
    writeTitle: (doc: BlockDocument, value: string): BlockDocument => ({
      ...doc,
      properties: { ...(doc.properties ?? {}), name: value },
    }),
  }
}

/** 최소 ViewConfig — 정규화된 빈 필터 루트 + 빈 정렬. */
export function makeView(partial: Partial<ViewConfig> & Pick<ViewConfig, 'type'>): ViewConfig {
  return {
    filters: { op: 'and', children: [] },
    sort: [],
    ...partial,
  }
}

/** 레코드 하나. */
export function makeRecord(id: string, properties: FixtureProps): TableRecord {
  return { id, doc: { properties } }
}

// ─── 공용 스키마 ──────────────────────────────────────────────────────────────

/**
 * 뷰 전반을 흔드는 스키마 — 타입별 셀 렌더(텍스트·숫자·선택·다중선택·날짜·체크박스·URL)를
 * 한 화면에 모아 스냅샷 한 장이 최대한 많은 렌더 경로를 덮게 한다.
 */
export const DEMO_SCHEMA: PropertyDef[] = [
  { key: 'name', label: '이름', type: 'text', source: 'frontmatter', origin: 'preset' },
  {
    key: 'status',
    label: '상태',
    type: 'select',
    source: 'frontmatter',
    origin: 'preset',
    options: [
      { value: 'active', label: '진행중', color: 'green' },
      { value: 'paused', label: '보류', color: 'orange' },
      { value: 'done', label: '완료', color: 'blue' },
    ],
  },
  {
    key: 'tags',
    label: '태그',
    type: 'multi_select',
    source: 'frontmatter',
    origin: 'preset',
    options: [
      { value: 'urgent', label: '긴급', color: 'red' },
      { value: 'review', label: '검토', color: 'purple' },
      { value: 'ops', label: '운영', color: 'teal' },
    ],
  },
  { key: 'amount', label: '금액', type: 'number', source: 'frontmatter', origin: 'preset' },
  { key: 'due', label: '기한', type: 'date', source: 'frontmatter', origin: 'preset' },
  { key: 'shipped', label: '발송', type: 'checkbox', source: 'frontmatter', origin: 'preset' },
  { key: 'link', label: '링크', type: 'url', source: 'frontmatter', origin: 'preset' },
]

/**
 * 데모 레코드 8행 — 갤러리에서 다열 그리드가 되고(#366 이 무너뜨린 바로 그 레이아웃),
 * 표에서 스크롤 없이 밀도를 확인할 수 있는 최소 개수.
 * 날짜는 FIXED_NOW(2026-03) 월에 모여 캘린더 한 화면에 들어온다.
 */
export const DEMO_RECORDS: TableRecord[] = [
  makeRecord('r1', {
    name: '방문상담 배정 개선',
    status: 'active',
    tags: ['urgent', 'ops'],
    amount: 1240000,
    due: '2026-03-04',
    shipped: true,
    link: 'https://example.com/1',
  }),
  makeRecord('r2', {
    name: '플래너 근무슬롯 정리',
    status: 'paused',
    tags: ['review'],
    amount: 320000,
    due: '2026-03-09/2026-03-13',
    shipped: false,
    link: 'https://example.com/2',
  }),
  makeRecord('r3', {
    name: '주문 퍼널 라벨 재정의',
    status: 'done',
    tags: [],
    amount: 87000,
    due: '2026-03-11',
    shipped: true,
    link: 'https://example.com/3',
  }),
  makeRecord('r4', {
    name: '구역 자격 재계산',
    status: 'active',
    tags: ['ops'],
    amount: 5600000,
    due: '2026-03-16/2026-03-20',
    shipped: false,
    link: 'https://example.com/4',
  }),
  makeRecord('r5', {
    name: '재조정 시뮬레이션 리포트',
    status: 'active',
    tags: ['urgent', 'review'],
    amount: 0,
    due: '2026-03-18',
    shipped: false,
    link: 'https://example.com/5',
  }),
  makeRecord('r6', {
    name: '메모 템플릿 이관',
    status: 'done',
    tags: ['ops'],
    amount: 145000,
    due: '2026-03-24',
    shipped: true,
    link: 'https://example.com/6',
  }),
  makeRecord('r7', {
    name: '이벤트 스키마 버전 올리기',
    status: 'paused',
    tags: ['review'],
    amount: 999000,
    due: '2026-03-26/2026-03-31',
    shipped: false,
    link: 'https://example.com/7',
  }),
  makeRecord('r8', {
    name: '프로젝션 체크포인트 점검',
    status: 'active',
    tags: [],
    amount: 74500,
    due: '2026-03-30',
    shipped: true,
    link: 'https://example.com/8',
  }),
]

export const DEMO_PACK = makePack(DEMO_SCHEMA)
