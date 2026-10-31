import { describe, it, expect } from 'vitest'
import {
  viewRows,
  viewGroups,
  GROUP_EMPTY,
  normalizeFilterRoot,
  normalizeViewType,
  passesFilterNode,
  isFilterGroup,
  groupKeysOf,
  applyRowOrder,
  type Row,
} from './view'
import type { FilterCondition, FilterGroup, FilterNode, PropertyValue, ViewConfig } from './types'

type P = Record<string, PropertyValue>

// 테스트 편의 — 평탄 조건 배열을 AND 루트 그룹으로 감싼다(레거시 작성 스타일 유지).
const andGroup = (children: FilterNode[]): FilterGroup => ({ op: 'and', children })

const baseView = (
  over: Partial<Omit<ViewConfig, 'filters'>> & { filters?: FilterCondition[] | FilterGroup } = {},
): ViewConfig => ({
  type: 'table',
  filters: over.filters
    ? Array.isArray(over.filters)
      ? andGroup(over.filters)
      : over.filters
    : andGroup([]),
  sort: over.sort ?? [],
  groupBy: over.groupBy,
  visibleProps: over.visibleProps,
})

const records: Row<P>[] = [
  {
    id: '1',
    props: { name: 'Alpha', status: 'published', count: 3, tags: ['a', 'b'], when: '2026-01-10' },
  },
  { id: '2', props: { name: 'Beta', status: 'draft', count: 1, tags: ['b'], when: '2026-03-01' } },
  {
    id: '3',
    props: { name: 'Gamma', status: 'published', count: 10, tags: [], when: '2025-12-01' },
  },
  { id: '4', props: { name: 'Delta', status: null, count: 0, tags: ['c'], when: null } },
]

const ids = (rows: Row<P>[]) => rows.map((r) => r.id)

describe('viewRows — filter', () => {
  it('eq (select)', () => {
    const out = viewRows(
      records,
      baseView({ filters: [{ key: 'status', op: 'eq', value: 'published' }] }),
    )
    expect(ids(out)).toEqual(['1', '3'])
  })

  it('neq', () => {
    const out = viewRows(
      records,
      baseView({ filters: [{ key: 'status', op: 'neq', value: 'published' }] }),
    )
    expect(ids(out)).toEqual(['2', '4'])
  })

  it('contains / not_contains (text — 대소문자 구분)', () => {
    // 소문자 'a' 는 Alpha·Bet'a'·Gamma·Delta 모두 포함(대문자 'A' 는 매칭 안 함).
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'name', op: 'contains', value: 'a' }] }))),
    ).toEqual(['1', '2', '3', '4'])
    expect(
      ids(
        viewRows(records, baseView({ filters: [{ key: 'name', op: 'not_contains', value: 'a' }] })),
      ),
    ).toEqual([])
    // 대문자 'A' 는 첫 글자가 대문자인 Alpha 만 — 나머지는 소문자 a 라 매칭 안 됨.
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'name', op: 'contains', value: 'A' }] }))),
    ).toEqual(['1'])
  })

  it('gt / gte / lt / lte (number)', () => {
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'count', op: 'gt', value: 3 }] }))),
    ).toEqual(['3'])
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'count', op: 'gte', value: 3 }] }))),
    ).toEqual(['1', '3'])
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'count', op: 'lt', value: 3 }] }))),
    ).toEqual(['2', '4'])
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'count', op: 'lte', value: 3 }] }))),
    ).toEqual(['1', '2', '4'])
  })

  it('gt / lt (date — ISO string 비교)', () => {
    expect(
      ids(
        viewRows(records, baseView({ filters: [{ key: 'when', op: 'gt', value: '2026-01-01' }] })),
      ),
    ).toEqual(['1', '2'])
    expect(
      ids(
        viewRows(records, baseView({ filters: [{ key: 'when', op: 'lt', value: '2026-01-01' }] })),
      ),
    ).toEqual(['3'])
  })

  // 조건은 "그 날"(2026-01-10)인데 값은 일시(2026-01-10T21:45:00Z)인 경우 — 달력·검색
  // 자동완성이 내는 날짜는 언제나 날짜뿐이고, 저장값은 컬럼에 따라 시각을 달고 있다.
  // 문자열 그대로 비교하면 `= 그 날` 이 0건이 되고 `≤ 그 날` 이 그날을 통째로 뺀다.
  describe('일시 값에 날짜 조건 — 하루 단위로 비교한다', () => {
    const stamped: Row<P>[] = [
      { id: 'a', props: { when: '2026-01-09T23:30:00.000Z' } as P },
      { id: 'b', props: { when: '2026-01-10T00:10:00.000Z' } as P },
      { id: 'c', props: { when: '2026-01-10T21:45:00.000Z' } as P },
      { id: 'd', props: { when: '2026-01-11T02:00:00.000Z' } as P },
    ]
    const pick = (op: FilterCondition['op'], value: PropertyValue) =>
      ids(viewRows(stamped, baseView({ filters: [{ key: 'when', op, value }] })))

    it('eq — 그날 전체가 걸린다', () => {
      expect(pick('eq', '2026-01-10')).toEqual(['b', 'c'])
    })

    it('neq — 그날만 빠진다', () => {
      expect(pick('neq', '2026-01-10')).toEqual(['a', 'd'])
    })

    it('lte / gt — 경계가 그날의 끝에 선다', () => {
      expect(pick('lte', '2026-01-10')).toEqual(['a', 'b', 'c'])
      expect(pick('gt', '2026-01-10')).toEqual(['d'])
    })

    it('조건에 시각이 붙어 있으면 그대로 비교한다', () => {
      expect(pick('eq', '2026-01-10T00:10:00.000Z')).toEqual(['b'])
    })
  })

  it('has / not_has (multi_select)', () => {
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'tags', op: 'has', value: 'b' }] }))),
    ).toEqual(['1', '2'])
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'tags', op: 'not_has', value: 'b' }] }))),
    ).toEqual(['3', '4'])
  })

  it('is_empty / is_not_empty (null·빈문자·빈배열만 empty, 0·false 는 값)', () => {
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'status', op: 'is_empty' }] }))),
    ).toEqual(['4'])
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'tags', op: 'is_empty' }] }))),
    ).toEqual(['3'])
    // count=0 은 비어있지 않음
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'count', op: 'is_empty' }] }))),
    ).toEqual([])
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'when', op: 'is_not_empty' }] }))),
    ).toEqual(['1', '2', '3'])
  })

  it('여러 필터는 AND 결합', () => {
    const out = viewRows(
      records,
      baseView({
        filters: [
          { key: 'status', op: 'eq', value: 'published' },
          { key: 'count', op: 'gt', value: 5 },
        ],
      }),
    )
    expect(ids(out)).toEqual(['3'])
  })

  it('contains 는 수 컬럼도 문자열화해 비교한다 — 일련번호의 부분 검색', () => {
    // 예전엔 문자열끼리만 비교해 수 컬럼의 contains 가 **항상 false** 였다. 그런데
    // "주문번호 2034 포함" 은 실제로 쓰는 조건이고, 서버(CONTAINS_TOKEN)는 그걸 맞힌다 —
    // 같은 조건에 서버는 행을 주고 클라는 0건을 내는 어긋남이 있었다.
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'count', op: 'contains', value: '3' }] }))),
    ).toEqual(['1'])
  })

  it('contains 의 빈 값은 무조건 참이 아니다 — 그러면 필터가 무의미해진다', () => {
    expect(
      ids(viewRows(records, baseView({ filters: [{ key: 'count', op: 'contains', value: '' }] }))),
    ).toEqual([])
  })
})

describe('viewRows — sort', () => {
  it('숫자 asc / desc', () => {
    expect(ids(viewRows(records, baseView({ sort: [{ key: 'count', dir: 'asc' }] })))).toEqual([
      '4',
      '2',
      '1',
      '3',
    ])
    expect(ids(viewRows(records, baseView({ sort: [{ key: 'count', dir: 'desc' }] })))).toEqual([
      '3',
      '1',
      '2',
      '4',
    ])
  })

  it('문자 asc / desc (locale)', () => {
    expect(ids(viewRows(records, baseView({ sort: [{ key: 'name', dir: 'asc' }] })))).toEqual([
      '1',
      '2',
      '4',
      '3',
    ])
    expect(ids(viewRows(records, baseView({ sort: [{ key: 'name', dir: 'desc' }] })))).toEqual([
      '3',
      '4',
      '2',
      '1',
    ])
  })

  it('날짜 asc (ISO string → epoch)', () => {
    // when 이 null 인 4번은 빈 값이라 항상 뒤로
    expect(ids(viewRows(records, baseView({ sort: [{ key: 'when', dir: 'asc' }] })))).toEqual([
      '3',
      '1',
      '2',
      '4',
    ])
  })

  it('빈 값은 dir 과 무관하게 항상 뒤로', () => {
    const withEmpties: Row<P>[] = [
      { id: 'a', props: { v: null } },
      { id: 'b', props: { v: 2 } },
      { id: 'c', props: { v: 1 } },
    ]
    expect(ids(viewRows(withEmpties, baseView({ sort: [{ key: 'v', dir: 'asc' }] })))).toEqual([
      'c',
      'b',
      'a',
    ])
    expect(ids(viewRows(withEmpties, baseView({ sort: [{ key: 'v', dir: 'desc' }] })))).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('다중 키 정렬 — 1순위 동률 시 2순위로 tie-break', () => {
    const out = viewRows(
      records,
      baseView({
        sort: [
          { key: 'status', dir: 'asc' },
          { key: 'count', dir: 'desc' },
        ],
      }),
    )
    // status: draft < null(empty 뒤) ; published 그룹 내부는 count desc
    expect(ids(out)).toEqual(['2', '3', '1', '4'])
  })

  it('정렬은 안정적 — 동일 키값이면 입력 순서 유지', () => {
    const same: Row<P>[] = [
      { id: 'x', props: { k: 'same' } },
      { id: 'y', props: { k: 'same' } },
      { id: 'z', props: { k: 'same' } },
    ]
    expect(ids(viewRows(same, baseView({ sort: [{ key: 'k', dir: 'asc' }] })))).toEqual([
      'x',
      'y',
      'z',
    ])
  })

  it('비배열 객체값(geo 등) — 결정적·안정 비교(String 뭉갬으로 항상 동률되던 버그 방지, #55)', () => {
    // 두 서로 다른 객체. compareNonEmpty 가 String(v) 였다면 둘 다 "[object Object]" → 항상 동률(0).
    const a = { roadAddress: 'a-addr' } as PropertyValue
    const b = { roadAddress: 'b-addr' } as PropertyValue
    const objs: Row<P>[] = [
      { id: '1', props: { loc: b } },
      { id: '2', props: { loc: a } },
    ]
    const asc = ids(viewRows(objs, baseView({ sort: [{ key: 'loc', dir: 'asc' }] })))
    const desc = ids(viewRows(objs, baseView({ sort: [{ key: 'loc', dir: 'desc' }] })))
    // 비-동률이어야 하므로 asc 와 desc 가 서로 뒤집힌다(입력 순서 유지가 아니라 실제 비교).
    expect(asc).toEqual(['2', '1']) // JSON.stringify 기준 a-addr < b-addr
    expect(desc).toEqual(['1', '2'])

    // 같은 구조의 객체 → 동률(0) → 안정 정렬로 입력 순서 유지.
    const same: Row<P>[] = [
      { id: 'p', props: { loc: { roadAddress: 'same' } as PropertyValue } },
      { id: 'q', props: { loc: { roadAddress: 'same' } as PropertyValue } },
    ]
    expect(ids(viewRows(same, baseView({ sort: [{ key: 'loc', dir: 'asc' }] })))).toEqual([
      'p',
      'q',
    ])
  })
})

describe('viewGroups — group', () => {
  it('groupBy 로 묶고 그룹 첫 등장 순서를 보존', () => {
    const groups = viewGroups(records, baseView({ groupBy: 'status' }))
    expect(groups.map((g) => g.key)).toEqual(['published', 'draft', GROUP_EMPTY])
    expect(ids(groups[0].rows)).toEqual(['1', '3'])
    expect(ids(groups[1].rows)).toEqual(['2'])
    expect(ids(groups[2].rows)).toEqual(['4']) // status=null
  })

  it('filter·sort 를 먼저 적용한 뒤 그룹', () => {
    const groups = viewGroups(
      records,
      baseView({
        filters: [{ key: 'status', op: 'eq', value: 'published' }],
        sort: [{ key: 'count', dir: 'desc' }],
        groupBy: 'status',
      }),
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe('published')
    expect(ids(groups[0].rows)).toEqual(['3', '1'])
  })

  it('groupBy 미지정이면 단일 그룹(GROUP_EMPTY)', () => {
    const groups = viewGroups(records, baseView())
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe(GROUP_EMPTY)
    expect(ids(groups[0].rows)).toEqual(['1', '2', '3', '4'])
  })

  it('단일(select) groupBy — 레코드당 한 그룹(multiGroup 기본 false)', () => {
    // tags 컬럼이지만 multiGroup 미지정 → select 처럼 첫 멤버만(과거 동작 보존).
    const groups = viewGroups(records, baseView({ groupBy: 'tags' }))
    expect(groups.map((g) => g.key)).toEqual(['a', 'b', GROUP_EMPTY, 'c'])
  })

  it('multi_select fan-out — 한 레코드가 멤버 수만큼 여러 그룹에 등장(#16-2)', () => {
    const groups = viewGroups(records, baseView({ groupBy: 'tags' }), { multiGroup: true })
    // 1=[a,b], 2=[b], 3=[], 4=[c] → 등장 순서: a, b, GROUP_EMPTY(3), c
    expect(groups.map((g) => g.key)).toEqual(['a', 'b', GROUP_EMPTY, 'c'])
    // fan-out: 레코드1 이 a·b 두 그룹에 모두 등장.
    const byKey = new Map(groups.map((g) => [g.key, ids(g.rows)]))
    expect(byKey.get('a')).toEqual(['1'])
    expect(byKey.get('b')).toEqual(['1', '2'])
    expect(byKey.get(GROUP_EMPTY)).toEqual(['3']) // tags=[] → 빈
    expect(byKey.get('c')).toEqual(['4'])
  })
})

describe('groupKeysOf — 그룹핑 코어 단일 진실원천(#16-2)', () => {
  it('빈/누락 값 → [GROUP_EMPTY] (단일·다중 모두)', () => {
    expect(groupKeysOf(null, false)).toEqual([GROUP_EMPTY])
    expect(groupKeysOf('', false)).toEqual([GROUP_EMPTY])
    expect(groupKeysOf([], true)).toEqual([GROUP_EMPTY])
    expect(groupKeysOf(null, true)).toEqual([GROUP_EMPTY])
  })

  it('select(multi=false) → 단일 그룹. 배열이 와도 첫 멤버만', () => {
    expect(groupKeysOf('published', false)).toEqual(['published'])
    expect(groupKeysOf(['a', 'b'], false)).toEqual(['a'])
  })

  it('multi_select(multi=true) → 멤버마다 fan-out 키', () => {
    expect(groupKeysOf(['a', 'b', 'c'], true)).toEqual(['a', 'b', 'c'])
    // 비배열 스칼라가 와도 단일 멤버로 취급(방어적).
    expect(groupKeysOf('a', true)).toEqual(['a'])
  })

  it('비배열 객체값(geo 등) → 구조 기반 키로 구분("[object Object]" 뭉갬 방지, #55)', () => {
    // GeoValue 형태의 두 서로 다른 객체. String(v) 였다면 둘 다 "[object Object]" 로 한 그룹에 섞임.
    const seoul = {
      coordinate: { x: 127, y: 37, type: 'WGS84' },
      roadAddress: '서울',
    } as PropertyValue
    const busan = {
      coordinate: { x: 129, y: 35, type: 'WGS84' },
      roadAddress: '부산',
    } as PropertyValue
    const ka = groupKeysOf(seoul, false)
    const kb = groupKeysOf(busan, false)
    expect(ka).toHaveLength(1)
    expect(kb).toHaveLength(1)
    expect(ka[0]).not.toBe('[object Object]')
    expect(ka).not.toEqual(kb) // 서로 다른 객체 → 서로 다른 키
    // 같은 구조의 객체 → 같은 키(구조 기반 동등).
    const seoul2 = {
      coordinate: { x: 127, y: 37, type: 'WGS84' },
      roadAddress: '서울',
    } as PropertyValue
    expect(groupKeysOf(seoul2, false)).toEqual(ka)
    // multi=true 에서도 동일(비배열 객체는 단일 멤버), 배열 fan-out 은 회귀 없음.
    expect(groupKeysOf(seoul, true)).toEqual(ka)
  })
})

describe('viewGroups — hideEmptyGroups', () => {
  // records: 1=published, 2=draft, 3=published, 4=null(GROUP_EMPTY)
  // select 옵션에 'archived' 가 있다고 가정하면 viewGroups 결과에 'archived' 는 등장하지 않음(레코드 없음).
  // 실제로 등장하는 그룹: published(rows=[1,3]), draft(rows=[2]), __empty__(rows=[4]).

  it('off(기본) — 빈 그룹을 숨기지 않는다(현행 동작 불변)', () => {
    const groups = viewGroups(records, baseView({ groupBy: 'status' }))
    // published·draft·__empty__ 모두 등장(empty 그룹도 보임)
    expect(groups.map((g) => g.key)).toEqual(['published', 'draft', GROUP_EMPTY])
  })

  it('view.hideEmptyGroups=true — rows 0인 그룹 제거', () => {
    const sparse: Row<P>[] = [
      { id: '1', props: { status: 'published' } },
      { id: '2', props: { status: 'published' } },
      { id: '3', props: { status: null } }, // GROUP_EMPTY
    ]
    const view = baseView({ groupBy: 'status' })
    // hideEmptyGroups=true 를 view 에 직접 주입(ViewConfig 는 선택적 필드)
    const viewWithHide: ViewConfig = { ...view, hideEmptyGroups: true }
    const groups = viewGroups(sparse, viewWithHide)
    // 'published' 와 GROUP_EMPTY 만 — 'draft' 는 등장하지 않으므로 결과에 없음(applyGroup 이 없는 키를 생성하지 않음).
    // 단, GROUP_EMPTY 는 rows=[3]이 있으므로 유지.
    expect(groups.map((g) => g.key)).toEqual(['published', GROUP_EMPTY])
  })

  it('opts.hideEmptyGroups=true — 옵션 오버라이드로도 동작', () => {
    const sparse: Row<P>[] = [
      { id: '1', props: { status: 'published' } },
      { id: '2', props: { status: null } },
    ]
    const groups = viewGroups(sparse, baseView({ groupBy: 'status' }), { hideEmptyGroups: true })
    expect(groups.map((g) => g.key)).toEqual(['published', GROUP_EMPTY])
  })

  it('전부 빈 경우(모든 그룹이 rows=0) — 빈 배열 반환', () => {
    // records 중 status='archived' 는 없으므로 groupBy='status' 시 등장 그룹은 실제 값만 나온다.
    // "전부 빈" 시뮬레이션: 레코드가 없으면 groups 자체가 []
    const groups = viewGroups([], baseView({ groupBy: 'status' }), { hideEmptyGroups: true })
    expect(groups).toEqual([])
  })

  it('groupBy 없으면 hideEmptyGroups 무시 — 단일 GROUP_EMPTY 그룹 반환', () => {
    const view: ViewConfig = { ...baseView(), hideEmptyGroups: true }
    const groups = viewGroups(records, view)
    // groupBy 없음 → 단일 그룹, hideEmptyGroups 는 적용하지 않는다(rows 있으므로 어차피 유지됨).
    expect(groups).toHaveLength(1)
    expect(groups[0].key).toBe(GROUP_EMPTY)
  })

  it('hideEmptyGroups=false 명시 — 기본 동작(빈 그룹 표시)과 동일', () => {
    const view: ViewConfig = { ...baseView({ groupBy: 'status' }), hideEmptyGroups: false }
    const groups = viewGroups(records, view)
    expect(groups.map((g) => g.key)).toEqual(['published', 'draft', GROUP_EMPTY])
  })
})

describe('viewGroups — groupSort', () => {
  // records: 1=published(3건), 2=draft(1건), 3=published(3건), 4=null(GROUP_EMPTY)
  // published → rows=[1,3], draft → rows=[2], __empty__ → rows=[4]

  it('groupSort=manual(미설정) — first-appearance 순 유지(회귀 0)', () => {
    const groups = viewGroups(records, baseView({ groupBy: 'status' }))
    expect(groups.map((g) => g.key)).toEqual(['published', 'draft', GROUP_EMPTY])
  })

  it('groupSort=manual 명시 — first-appearance 순 유지(회귀 0)', () => {
    const view: ViewConfig = { ...baseView({ groupBy: 'status' }), groupSort: 'manual' }
    const groups = viewGroups(records, view)
    expect(groups.map((g) => g.key)).toEqual(['published', 'draft', GROUP_EMPTY])
  })

  it('groupSort=count — 행 수 내림차순, GROUP_EMPTY 는 항상 마지막', () => {
    // published=2, draft=1, __empty__=1
    const view: ViewConfig = { ...baseView({ groupBy: 'status' }), groupSort: 'count' }
    const groups = viewGroups(records, view)
    // published(2) > draft(1) = __empty__(1) but __empty__ always last
    expect(groups[0].key).toBe('published')
    expect(groups[groups.length - 1].key).toBe(GROUP_EMPTY)
    // draft 와 __empty__ 는 같은 count지만 __empty__가 마지막에 강제
    expect(groups.map((g) => g.key)).toEqual(['published', 'draft', GROUP_EMPTY])
  })

  it('groupSort=name — 라벨 오름차순(groupLabelMap 없으면 키 오름차순), GROUP_EMPTY 는 항상 마지막', () => {
    const view: ViewConfig = { ...baseView({ groupBy: 'status' }), groupSort: 'name' }
    const groups = viewGroups(records, view)
    // 'draft' < 'published' 알파벳 순; __empty__ 는 마지막
    expect(groups.map((g) => g.key)).toEqual(['draft', 'published', GROUP_EMPTY])
  })

  it('groupSort=name + groupLabelMap — 라벨 오름차순 적용', () => {
    // 키='a','b','c' 지만 라벨='세','가','나' → 가·나·세 순서
    const recs: Row<P>[] = [
      { id: '1', props: { cat: 'a' } },
      { id: '2', props: { cat: 'b' } },
      { id: '3', props: { cat: 'c' } },
    ]
    const view: ViewConfig = { ...baseView({ groupBy: 'cat' }), groupSort: 'name' }
    const labelMap = new Map([
      ['a', '세'],
      ['b', '가'],
      ['c', '나'],
    ])
    const groups = viewGroups(recs, view, { groupLabelMap: labelMap })
    expect(groups.map((g) => g.key)).toEqual(['b', 'c', 'a']) // 가·나·세 라벨 순
  })

  it('groupSort=count — 행 수가 같으면 first-appearance 상대 순서 유지(안정 정렬)', () => {
    const recs: Row<P>[] = [
      { id: '1', props: { s: 'x' } },
      { id: '2', props: { s: 'y' } },
      { id: '3', props: { s: 'z' } },
    ]
    const view: ViewConfig = { ...baseView({ groupBy: 's' }), groupSort: 'count' }
    const groups = viewGroups(recs, view)
    // 모두 1건 — 안정 정렬이므로 등장 순서 x·y·z 가 유지된다.
    expect(groups.map((g) => g.key)).toEqual(['x', 'y', 'z'])
  })

  it('GROUP_EMPTY 는 groupSort=count·name 모두에서 항상 마지막', () => {
    const recs: Row<P>[] = [
      { id: '1', props: { s: null } }, // GROUP_EMPTY
      { id: '2', props: { s: 'zzz' } }, // 알파벳 마지막
    ]
    for (const mode of ['count', 'name'] as const) {
      const view: ViewConfig = { ...baseView({ groupBy: 's' }), groupSort: mode }
      const groups = viewGroups(recs, view)
      expect(groups[groups.length - 1].key, `mode=${mode}`).toBe(GROUP_EMPTY)
    }
  })
})

describe('viewRows / viewGroups — 엣지', () => {
  it('빈 records 는 빈 결과', () => {
    expect(
      viewRows(
        [],
        baseView({ filters: [{ key: 'x', op: 'eq', value: 1 }], sort: [{ key: 'x', dir: 'asc' }] }),
      ),
    ).toEqual([])
    expect(viewGroups([], baseView({ groupBy: 'x' }))).toEqual([])
  })

  it('누락 키(undefined prop)는 null 로 취급 — is_empty 통과, eq 불일치', () => {
    const r: Row<P>[] = [{ id: '1', props: {} }]
    expect(ids(viewRows(r, baseView({ filters: [{ key: 'missing', op: 'is_empty' }] })))).toEqual([
      '1',
    ])
    expect(
      ids(viewRows(r, baseView({ filters: [{ key: 'missing', op: 'eq', value: 'x' }] }))),
    ).toEqual([])
  })

  it('필터·정렬 없으면 원본 순서 그대로 반환', () => {
    expect(ids(viewRows(records, baseView()))).toEqual(['1', '2', '3', '4'])
  })

  it('eq 는 배열을 집합 동등(순서 무관)으로 비교', () => {
    const r: Row<P>[] = [
      { id: '1', props: { tags: ['a', 'b'] } },
      { id: '2', props: { tags: ['b', 'a'] } },
      { id: '3', props: { tags: ['a'] } },
    ]
    expect(
      ids(viewRows(r, baseView({ filters: [{ key: 'tags', op: 'eq', value: ['a', 'b'] }] }))),
    ).toEqual(['1', '2'])
  })
})

// ─── 필터 트리(F1) ─────────────────────────────────────────────────────────────

describe('isFilterGroup — 판별자', () => {
  it('children 필드 유무로 그룹/조건 구분', () => {
    expect(isFilterGroup({ op: 'and', children: [] })).toBe(true)
    expect(isFilterGroup({ key: 'x', op: 'eq', value: 1 })).toBe(false)
    // op 가 'and'/'or' 라도 children 이 없으면 조건으로 본다(이 케이스는 실재하지 않지만 판별자 명세).
    expect(isFilterGroup({ key: 'and', op: 'eq', value: 'and' })).toBe(false)
  })
})

describe('normalizeFilterRoot — 레거시 마이그레이션', () => {
  it('평탄 배열 → AND 루트 그룹', () => {
    const flat: FilterCondition[] = [{ key: 'status', op: 'eq', value: 'published' }]
    expect(normalizeFilterRoot(flat)).toEqual({ op: 'and', children: flat })
  })

  it('undefined/null → 빈 AND 그룹(모두 통과)', () => {
    expect(normalizeFilterRoot(undefined)).toEqual({ op: 'and', children: [] })
    expect(normalizeFilterRoot(null)).toEqual({ op: 'and', children: [] })
  })

  it('이미 FilterGroup 이면 그대로(참조 보존)', () => {
    const g: FilterGroup = { op: 'or', children: [{ key: 'x', op: 'eq', value: 1 }] }
    expect(normalizeFilterRoot(g)).toBe(g)
  })

  it('레거시 평탄 filters 로 영속된 뷰가 viewRows 에서 정상 동작(하위호환)', () => {
    // baseView 를 우회해 ViewConfig.filters 에 *평탄 배열*을 직접 흘려보내도 깨지지 않아야 한다.
    const legacyView = {
      type: 'table' as const,
      filters: [{ key: 'status', op: 'eq' as const, value: 'published' }] as unknown,
      sort: [],
    } as unknown as ViewConfig
    expect(ids(viewRows(records, legacyView))).toEqual(['1', '3'])
  })
})

describe('passesFilterNode — 재귀 평가', () => {
  const props: P = { status: 'published', count: 10, tags: ['a', 'b'] }

  it('단일 조건(leaf)', () => {
    expect(passesFilterNode(props, { key: 'status', op: 'eq', value: 'published' })).toBe(true)
    expect(passesFilterNode(props, { key: 'status', op: 'eq', value: 'draft' })).toBe(false)
  })

  it('빈 AND 그룹 = true, 빈 OR 그룹 = false', () => {
    expect(passesFilterNode(props, { op: 'and', children: [] })).toBe(true)
    expect(passesFilterNode(props, { op: 'or', children: [] })).toBe(false)
  })

  it('AND 그룹 — 모든 자식 통과해야', () => {
    expect(
      passesFilterNode(props, {
        op: 'and',
        children: [
          { key: 'status', op: 'eq', value: 'published' },
          { key: 'count', op: 'gt', value: 5 },
        ],
      }),
    ).toBe(true)
    expect(
      passesFilterNode(props, {
        op: 'and',
        children: [
          { key: 'status', op: 'eq', value: 'published' },
          { key: 'count', op: 'gt', value: 50 },
        ],
      }),
    ).toBe(false)
  })

  it('OR 그룹 — 하나라도 통과하면', () => {
    expect(
      passesFilterNode(props, {
        op: 'or',
        children: [
          { key: 'status', op: 'eq', value: 'draft' },
          { key: 'count', op: 'gt', value: 5 },
        ],
      }),
    ).toBe(true)
    expect(
      passesFilterNode(props, {
        op: 'or',
        children: [
          { key: 'status', op: 'eq', value: 'draft' },
          { key: 'count', op: 'lt', value: 5 },
        ],
      }),
    ).toBe(false)
  })

  it('중첩(2~3단) — AND(OR(...), 조건)', () => {
    // (status=draft OR count>5) AND tags has 'a'  → true
    const node: FilterNode = {
      op: 'and',
      children: [
        {
          op: 'or',
          children: [
            { key: 'status', op: 'eq', value: 'draft' },
            { key: 'count', op: 'gt', value: 5 },
          ],
        },
        { key: 'tags', op: 'has', value: 'a' },
      ],
    }
    expect(passesFilterNode(props, node)).toBe(true)

    // 3단: AND( OR( AND(count>5, status=published), status=draft ), tags has 'a' )
    const deep: FilterNode = {
      op: 'and',
      children: [
        {
          op: 'or',
          children: [
            {
              op: 'and',
              children: [
                { key: 'count', op: 'gt', value: 5 },
                { key: 'status', op: 'eq', value: 'published' },
              ],
            },
            { key: 'status', op: 'eq', value: 'draft' },
          ],
        },
        { key: 'tags', op: 'has', value: 'a' },
      ],
    }
    expect(passesFilterNode(props, deep)).toBe(true)
  })
})

describe('viewRows — 필터 트리 통합', () => {
  it('OR 루트 그룹', () => {
    const view = baseView({
      filters: {
        op: 'or',
        children: [
          { key: 'status', op: 'eq', value: 'draft' },
          { key: 'count', op: 'gt', value: 5 },
        ],
      },
    })
    // draft(2) 또는 count>5(3) → 2,3
    expect(ids(viewRows(records, view))).toEqual(['2', '3'])
  })

  it('중첩 그룹 + 정렬', () => {
    const view = baseView({
      filters: {
        op: 'and',
        children: [
          {
            op: 'or',
            children: [
              { key: 'status', op: 'eq', value: 'published' },
              { key: 'status', op: 'eq', value: 'draft' },
            ],
          },
          { key: 'count', op: 'gte', value: 1 },
        ],
      },
      sort: [{ key: 'count', dir: 'asc' }],
    })
    // (published|draft) AND count>=1 → 1,2,3 ; count asc → 2(1),1(3),3(10)
    expect(ids(viewRows(records, view))).toEqual(['2', '1', '3'])
  })

  it('빈 루트 그룹 = 전체 통과', () => {
    expect(ids(viewRows(records, baseView({ filters: { op: 'and', children: [] } })))).toEqual([
      '1',
      '2',
      '3',
      '4',
    ])
  })
})

describe('normalizeViewType — 어휘 정렬(F3)', () => {
  it("레거시 'grid' → 'gallery'", () => {
    expect(normalizeViewType('grid')).toBe('gallery')
  })
  it('미지정 → table', () => {
    expect(normalizeViewType(undefined)).toBe('table')
    expect(normalizeViewType(null)).toBe('table')
  })
  it('그 외 타입은 그대로', () => {
    expect(normalizeViewType('board')).toBe('board')
    expect(normalizeViewType('gallery')).toBe('gallery')
    expect(normalizeViewType('timeline')).toBe('timeline')
  })
})

// applyRowOrder — table 뷰 행 수동 정렬(노션식 드래그, view.rowOrder)의 순수 정렬 로직 회귀 핀.
// 버그 맥락: 워크스페이스 상품 목록에서 행을 드래그해도 순서가 영속되지 않던 문제(onReorder no-op).
// 수정으로 순서는 view.rowOrder 에 저장되고, 렌더 시 이 함수가 그 순서를 적용한다.
describe('applyRowOrder — 행 수동 정렬', () => {
  const mkRows = (...ids: string[]): Row<Record<string, never>>[] =>
    ids.map((id) => ({ id, props: {} }))
  const idsOf = (rs: Row<Record<string, never>>[]): string[] => rs.map((r) => r.id)

  it('order 미지정/빈 배열이면 원본 순서 그대로(회귀 0)', () => {
    const base = mkRows('a', 'b', 'c')
    expect(applyRowOrder(base, undefined)).toBe(base)
    expect(applyRowOrder(base, [])).toBe(base)
  })

  it('rowOrder 가 있으면 그 순서로 재배치한다', () => {
    expect(idsOf(applyRowOrder(mkRows('a', 'b', 'c'), ['c', 'a', 'b']))).toEqual(['c', 'a', 'b'])
  })

  it('rowOrder 에 없는 행(신규 생성 등)은 끝으로, 원래 상대순서를 유지한다', () => {
    // b·c 만 등록 → a·d 는 미등록(끝). 미등록끼리는 입력 순서(a, d) 보존(안정 정렬).
    expect(idsOf(applyRowOrder(mkRows('a', 'b', 'c', 'd'), ['c', 'b']))).toEqual([
      'c',
      'b',
      'a',
      'd',
    ])
  })

  it('rowOrder 의 stale id(삭제된 행)는 무시하고 존재하는 행만 정렬한다', () => {
    expect(idsOf(applyRowOrder(mkRows('a', 'b'), ['x', 'b', 'a', 'y']))).toEqual(['b', 'a'])
  })

  it('입력 배열을 변형하지 않는다(순수 함수)', () => {
    const base = mkRows('a', 'b', 'c')
    applyRowOrder(base, ['c', 'b', 'a'])
    expect(idsOf(base)).toEqual(['a', 'b', 'c'])
  })
})
