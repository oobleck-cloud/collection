import { describe, it, expect } from 'vitest'
import {
  applySchemaConfig,
  DEFAULT_VIEW_ID,
  normalizeOptions,
  optionColor,
  resolveActiveView,
  resolveOptionColor,
  resolveSavedViews,
  toSchemaConfig,
  toViewConfig,
  VIEW_SETTINGS_KEYS,
} from './options'
import type { CollectionViewConfig, PropertyDef, SavedView } from './types'

describe('normalizeOptions — 문자열/리치 → 채워진 SelectOption[]', () => {
  it('문자열 배열 → value=label, 해시 색 채움', () => {
    const out = normalizeOptions(['draft', 'published'])
    expect(out).toEqual([
      { value: 'draft', label: 'draft', color: optionColor('draft') },
      { value: 'published', label: 'published', color: optionColor('published') },
    ])
  })

  it('리치 옵션의 label·color 는 보존, 빈 칸만 채움', () => {
    const out = normalizeOptions([{ value: 'a', label: '에이', color: 'red' }, { value: 'b' }])
    expect(out[0]).toEqual({ value: 'a', label: '에이', color: 'red' })
    expect(out[1]).toEqual({ value: 'b', label: 'b', color: optionColor('b') })
  })

  it('undefined → 빈 배열', () => {
    expect(normalizeOptions(undefined)).toEqual([])
  })

  it('optionColor 는 안정적(같은 값=같은 색)', () => {
    expect(optionColor('published')).toBe(optionColor('published'))
  })

  it('resolveOptionColor — 옵션 명시색 우선, 무효/미지정은 값 해시색', () => {
    const def: PropertyDef = {
      key: 'tags',
      label: '태그',
      type: 'multi_select',
      source: 'frontmatter',
      origin: 'preset',
      options: [
        { value: '가리비', color: 'purple' },
        { value: '랍스터' },
        { value: 'X', color: 'bogus' },
      ],
    }
    expect(resolveOptionColor(def, '가리비')).toBe('purple') // 명시 팔레트색 우선
    expect(resolveOptionColor(def, '랍스터')).toBe(optionColor('랍스터')) // 색 미지정 → 해시
    expect(resolveOptionColor(def, 'X')).toBe(optionColor('X')) // 무효색 → 해시 폴백
    expect(resolveOptionColor(def, '없음')).toBe(optionColor('없음')) // 옵션에 없는 값 → 해시
  })
})

const base: PropertyDef[] = [
  {
    key: 'status',
    label: '상태',
    type: 'select',
    source: 'frontmatter',
    origin: 'preset',
    options: ['draft'],
    locked: true,
  },
  { key: 'tags', label: '태그', type: 'multi_select', source: 'frontmatter', origin: 'preset' },
  { key: 'name', label: '이름', type: 'text', source: 'projection', origin: 'preset' },
]

describe('applySchemaConfig — 팩 기본 위에 옵션/잠금 오버라이드 머지', () => {
  it('config 없으면 원본 그대로(동일 참조)', () => {
    expect(applySchemaConfig(base)).toBe(base)
  })

  it('빈 config(키 없음) 도 원본 그대로(동일 참조)', () => {
    expect(applySchemaConfig(base, {})).toBe(base)
  })

  it('해당 키만 options/locked 오버라이드, 나머지 보존', () => {
    const out = applySchemaConfig(base, {
      properties: {
        tags: { options: [{ value: 'ai', color: 'blue' }], locked: false },
      },
    })
    const tags = out.find((d) => d.key === 'tags')!
    expect(tags.options).toEqual([{ value: 'ai', color: 'blue' }])
    expect(tags.locked).toBe(false)
    // status 는 그대로
    expect(out.find((d) => d.key === 'status')!.locked).toBe(true)
    // 불변: 원본 base 미변경
    expect(base.find((d) => d.key === 'tags')!.options).toBeUndefined()
  })
})

describe('applySchemaConfig — 동적 베이스(D-8 §3): 사용자 추가 컬럼을 앞에 끼움', () => {
  it('베이스 추가 — origin=base/source=frontmatter 로 변환되어 결과 앞에 배치', () => {
    const out = applySchemaConfig(base, {
      base: [{ key: 'note', label: '메모', type: 'text' }],
    })
    expect(out[0]).toEqual({
      key: 'note',
      label: '메모',
      type: 'text',
      source: 'frontmatter',
      origin: 'base',
    })
    // 팩 기본 컬럼들은 base 뒤에 순서 유지(status·tags·name).
    expect(out.slice(1).map((d) => d.key)).toEqual(['status', 'tags', 'name'])
  })

  it('base 키가 팩 키와 충돌하면 base 가 이긴다 — 팩 정의는 흡수돼 중복 없음', () => {
    const out = applySchemaConfig(base, {
      base: [{ key: 'status', label: '내 상태', type: 'text' }],
    })
    const statuses = out.filter((d) => d.key === 'status')
    expect(statuses).toHaveLength(1)
    expect(statuses[0].origin).toBe('base')
    expect(statuses[0].type).toBe('text')
    expect(statuses[0].label).toBe('내 상태')
  })

  it('base 내부 중복 키는 첫 정의만 남는다(가드)', () => {
    const out = applySchemaConfig([], {
      base: [
        { key: 'x', label: 'first', type: 'text' },
        { key: 'x', label: 'second', type: 'number' },
      ],
    })
    expect(out).toHaveLength(1)
    expect(out[0].label).toBe('first')
    expect(out[0].type).toBe('text')
  })

  it('base + properties 동시 적용 — base 가 앞, 팩 컬럼은 오버라이드 후 뒤에', () => {
    const out = applySchemaConfig(base, {
      base: [{ key: 'priority', label: '우선', type: 'number' }],
      properties: { tags: { locked: true } },
    })
    expect(out[0].key).toBe('priority')
    expect(out.find((d) => d.key === 'tags')!.locked).toBe(true)
  })

  it('base 의 inherited 플래그 보존 — 상속 컬럼이 PropertyDef 로 흐른다(프로토타입 잠금 표시용)', () => {
    const out = applySchemaConfig([], {
      base: [
        { key: 'status', label: '상태', type: 'select', inherited: true },
        { key: 'note', label: '메모', type: 'text' },
      ],
    })
    expect(out.find((d) => d.key === 'status')!.inherited).toBe(true)
    // inherited 미설정 컬럼엔 키가 붙지 않는다(undefined → TableView 잠금 false, 자유 컬럼).
    expect(out.find((d) => d.key === 'note')!.inherited).toBeUndefined()
  })

  it('base 의 select 옵션 보존(JSON 안전)', () => {
    const out = applySchemaConfig([], {
      base: [
        {
          key: 'severity',
          label: '심각도',
          type: 'select',
          options: [
            { value: 'low', color: 'gray' },
            { value: 'high', color: 'red' },
          ],
        },
      ],
    })
    expect(out[0].options).toEqual([
      { value: 'low', color: 'gray' },
      { value: 'high', color: 'red' },
    ])
  })

  it('base relation 컬럼 — relation 설정(target/cardinality)이 PropertyDef 로 전파', () => {
    const out = applySchemaConfig([], {
      base: [
        {
          key: 'related_plans',
          label: '연결 플랜',
          type: 'relation',
          relation: { target: 'plan', cardinality: 'many' },
        },
      ],
    })
    expect(out[0].type).toBe('relation')
    expect(out[0].relation).toEqual({ target: 'plan', cardinality: 'many' })
  })
})

describe('toSchemaConfig — JSON 안전 오버라이드 추출(format 함수 제외)', () => {
  it('options/locked 있는 프로퍼티만, 정규화된 옵션으로', () => {
    const cfg = toSchemaConfig(base)
    expect(cfg.properties?.status).toEqual({
      options: [{ value: 'draft', label: 'draft', color: optionColor('draft') }],
      locked: true,
    })
    // name(projection, 옵션·잠금 없음)은 제외
    expect(cfg.properties?.name).toBeUndefined()
    // tags(옵션·잠금 둘 다 없음)도 제외
    expect(cfg.properties?.tags).toBeUndefined()
  })

  it('format 함수가 있어도 직렬화 안전(함수 미포함)', () => {
    const withFormat: PropertyDef[] = [
      {
        key: 'price',
        label: '가격',
        type: 'number',
        source: 'projection',
        origin: 'preset',
        format: () => 'x',
        options: ['a'],
      },
    ]
    const cfg = toSchemaConfig(withFormat)
    expect(JSON.stringify(cfg)).toContain('"price"')
    expect(JSON.stringify(cfg)).not.toContain('format')
  })
})

describe('resolveSavedViews — 다중 SavedView 마이그레이션·폴백', () => {
  const sampleView: SavedView = {
    id: 'a',
    name: 'A',
    config: { sort: [{ key: 'name', dir: 'asc' }] },
  }

  it('views 가 있으면 그대로', () => {
    expect(resolveSavedViews({ views: [sampleView] })).toEqual([sampleView])
  })

  it('레거시 view 가 있으면 단일 SavedView 로 변환(id=default, name=기본)', () => {
    const result = resolveSavedViews({ view: { sort: [{ key: 'status', dir: 'desc' }] } })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(DEFAULT_VIEW_ID)
    expect(result[0].name).toBe('기본')
    expect(result[0].config.sort).toEqual([{ key: 'status', dir: 'desc' }])
  })

  it('빈 config → 빈 기본 뷰 한 개', () => {
    const result = resolveSavedViews(undefined)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(DEFAULT_VIEW_ID)
    expect(result[0].config).toEqual({})
  })

  it('views 가 빈 배열이면 레거시 view 폴백(빈 배열은 "없는 것"으로 취급)', () => {
    const result = resolveSavedViews({
      views: [],
      view: { filters: [{ key: 'x', op: 'eq', value: '1' }] },
    })
    expect(result).toHaveLength(1)
    expect(result[0].config.filters).toHaveLength(1)
  })
})

describe('resolveActiveView — activeViewId 우선, 없으면 첫 뷰', () => {
  const v1: SavedView = { id: 'one', name: '하나', config: {} }
  const v2: SavedView = { id: 'two', name: '둘', config: {} }

  it('activeViewId 가 views 에 있으면 그것', () => {
    expect(resolveActiveView({ views: [v1, v2], activeViewId: 'two' })).toBe(v2)
  })

  it('activeViewId 불일치면 첫 뷰', () => {
    expect(resolveActiveView({ views: [v1, v2], activeViewId: 'missing' })).toBe(v1)
  })

  it('activeViewId 미지정이면 첫 뷰', () => {
    expect(resolveActiveView({ views: [v1, v2] })).toBe(v1)
  })

  it('config 자체가 없어도 첫 뷰(빈 기본 뷰) 반환', () => {
    const r = resolveActiveView(undefined)
    expect(r.id).toBe(DEFAULT_VIEW_ID)
  })
})

describe('toViewConfig — 저장 config → 렌더러 ViewConfig(빈 필드 채움·optional 보존)', () => {
  const DEFAULT_VISIBLE = ['name', 'status']

  it('빈 config → 기본값(type=table, 빈 AND 필터, 빈 sort, defaultVisible)', () => {
    const out = toViewConfig({}, DEFAULT_VISIBLE)
    expect(out.type).toBe('table')
    expect(out.filters).toEqual({ op: 'and', children: [] })
    expect(out.sort).toEqual([])
    expect(out.visibleProps).toEqual(DEFAULT_VISIBLE)
    // optional 카드/그룹 필드는 미지정이면 키 자체가 없다(부피 최소화).
    expect(out.groupBy).toBeUndefined()
    expect(out.aggregations).toBeUndefined()
    expect(out.cardOrder).toBeUndefined()
    expect(out.coverKey).toBeUndefined()
    expect(out.cardSize).toBeUndefined()
    expect(out.hideEmptyGroups).toBeUndefined()
    expect(out.rowHeight).toBeUndefined()
    expect(out.wrapCells).toBeUndefined()
    expect(out.groupSort).toBeUndefined()
  })

  it('레거시 type=grid → gallery, 평탄 filters → FilterGroup 루트로 정규화', () => {
    const out = toViewConfig(
      // 'grid' 는 드롭된 레거시 ViewType — normalizeViewType 이 'gallery' 로 정규화하는지 검증(입력 캐스트).
      {
        type: 'grid',
        filters: [{ key: 'status', op: 'eq', value: 'published' }],
      } as unknown as CollectionViewConfig,
      DEFAULT_VISIBLE,
    )
    expect(out.type).toBe('gallery')
    expect(out.filters).toEqual({
      op: 'and',
      children: [{ key: 'status', op: 'eq', value: 'published' }],
    })
  })

  // 회귀 방지(리뷰 #1·#2 게이트): 카드/그룹 optional 필드를 빠짐없이 보존해야 한다.
  // 특히 cardSize 누락 시 CardLayoutPanel 의 크기 설정이 화면에 반영되지 않는다(무동작 버그).
  it('cardSize·coverKey·groupBy·aggregations·cardOrder·timeline·hideEmptyGroups·rowHeight·wrapCells·groupSort 를 모두 보존한다', () => {
    const saved: CollectionViewConfig = {
      type: 'gallery',
      visibleProps: ['name', 'category'],
      sort: [{ key: 'name', dir: 'asc' }],
      groupBy: 'status',
      aggregations: { priceRange: 'sum' },
      cardOrder: { published: ['1', '2'] },
      coverKey: 'thumbnail',
      cardSize: 'L',
      timeline: { startKey: 'startsAt', endKey: 'endsAt', zoom: 'week' },
      hideEmptyGroups: true,
      rowHeight: 'M',
      wrapCells: true,
      groupSort: 'count',
    }
    const out = toViewConfig(saved, DEFAULT_VISIBLE)
    expect(out.visibleProps).toEqual(['name', 'category'])
    expect(out.sort).toEqual([{ key: 'name', dir: 'asc' }])
    expect(out.groupBy).toBe('status')
    expect(out.aggregations).toEqual({ priceRange: 'sum' })
    expect(out.cardOrder).toEqual({ published: ['1', '2'] })
    expect(out.coverKey).toBe('thumbnail')
    expect(out.cardSize).toBe('L')
    expect(out.timeline).toEqual({ startKey: 'startsAt', endKey: 'endsAt', zoom: 'week' })
    expect(out.hideEmptyGroups).toBe(true)
    expect(out.rowHeight).toBe('M')
    expect(out.wrapCells).toBe(true)
    expect(out.groupSort).toBe('count')
  })

  // 회귀 방지(리뷰 B1 게이트): timeline 축 설정이 round-trip 보존돼야 한다.
  // 누락 시 view.timeline 이 항상 undefined → 축 설정 직후에도 타임라인이 무동작.
  it('timeline 만 설정된 경우에도 round-trip 보존(다른 optional 은 미지정)', () => {
    const saved: CollectionViewConfig = {
      type: 'timeline',
      timeline: { startKey: 'createdAt' },
    }
    const out = toViewConfig(saved, DEFAULT_VISIBLE)
    expect(out.type).toBe('timeline')
    expect(out.timeline).toEqual({ startKey: 'createdAt' })
    // 다른 optional 은 여전히 미지정(부피 최소화).
    expect(out.groupBy).toBeUndefined()
    expect(out.cardSize).toBeUndefined()
  })

  it('timeline 미지정이면 키 자체가 없다(부피 최소화)', () => {
    const out = toViewConfig({ type: 'timeline' }, DEFAULT_VISIBLE)
    expect(out.timeline).toBeUndefined()
  })

  it('순수 — 입력 saved 객체를 변형하지 않는다', () => {
    const saved: CollectionViewConfig = { cardSize: 'S', coverKey: 'cover' }
    const snapshot = structuredClone(saved)
    toViewConfig(saved, DEFAULT_VISIBLE)
    expect(saved).toEqual(snapshot)
  })

  // ── drift-proof 보존 완전성 테스트 ────────────────────────────────────────
  // 이 테스트는 VIEW_SETTINGS_KEYS 에 선언된 모든 optional 설정 키가 toViewConfig 를 거쳐
  // round-trip 으로 보존됨을 명시적으로 단언한다.
  //
  // 새 ViewConfig optional 필드 추가 시 체크리스트:
  //   1. types.ts — ViewConfig 에 새 필드 추가.
  //   2. options.ts — VIEW_SETTINGS_KEYS 에 키 추가(미추가 시 컴파일 에러).
  //   3. options.ts — toViewConfig 반환 객체에 `...(saved.X ? { X: saved.X } : {})` 추가.
  //   4. 여기 KEY_PRESERVATION_ASSERTIONS 에 해당 키와 샘플 값 추가(미추가 시 테스트 실패).
  it('VIEW_SETTINGS_KEYS 의 모든 키가 toViewConfig 를 거쳐 round-trip 보존된다', () => {
    // 새 ViewConfig optional 필드 추가 시 이 목록을 함께 업데이트할 것.
    // (컴파일 가드는 VIEW_SETTINGS_KEYS 누락을 잡고, 이 테스트는 toViewConfig 구현 누락을 잡는다.)
    const KEY_PRESERVATION_ASSERTIONS: {
      key: (typeof VIEW_SETTINGS_KEYS)[number]
      saved: CollectionViewConfig
      expected: unknown
    }[] = [
      { key: 'groupBy', saved: { groupBy: 'status' }, expected: 'status' },
      { key: 'groupEmptyAs', saved: { groupEmptyAs: '신규' }, expected: '신규' },
      {
        key: 'aggregations',
        saved: { aggregations: { price: 'sum' } },
        expected: { price: 'sum' },
      },
      {
        key: 'cardOrder',
        saved: { cardOrder: { active: ['a', 'b'] } },
        expected: { active: ['a', 'b'] },
      },
      { key: 'rowOrder', saved: { rowOrder: ['a', 'b'] }, expected: ['a', 'b'] },
      { key: 'coverKey', saved: { coverKey: 'thumbnail' }, expected: 'thumbnail' },
      { key: 'cardSize', saved: { cardSize: 'L' }, expected: 'L' },
      { key: 'cardPropLabels', saved: { cardPropLabels: true }, expected: true },
      {
        key: 'cardLayout',
        saved: { cardLayout: { badgeKey: 'due', metrics: ['base', 'gap'] } },
        expected: { badgeKey: 'due', metrics: ['base', 'gap'] },
      },
      {
        key: 'relationTable',
        saved: {
          relationTable: {
            key: 'quotes',
            columns: ['partner'],
            maxRows: 3,
            variant: 'list',
            collapsed: true,
          },
        },
        expected: {
          key: 'quotes',
          columns: ['partner'],
          maxRows: 3,
          variant: 'list',
          collapsed: true,
        },
      },
      {
        key: 'timeline',
        saved: { timeline: { startKey: 'startsAt', endKey: 'endsAt' } },
        expected: { startKey: 'startsAt', endKey: 'endsAt' },
      },
      {
        key: 'hideEmptyGroups',
        saved: { hideEmptyGroups: true },
        expected: true,
      },
      { key: 'collapseEmptyGroups', saved: { collapseEmptyGroups: true }, expected: true },
      { key: 'rowHeight', saved: { rowHeight: 'L' }, expected: 'L' },
      { key: 'wrapCells', saved: { wrapCells: true }, expected: true },
      { key: 'groupSort', saved: { groupSort: 'name' }, expected: 'name' },
      { key: 'columnWidths', saved: { columnWidths: { status: 200 } }, expected: { status: 200 } },
      {
        key: 'conditionalFormats',
        saved: {
          conditionalFormats: [
            {
              id: 'overdue',
              target: 'dueAt',
              when: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'overdue' }] },
              style: { tone: 'danger', bold: true },
            },
          ],
        },
        expected: [
          {
            id: 'overdue',
            target: 'dueAt',
            when: { op: 'and', children: [{ key: 'status', op: 'eq', value: 'overdue' }] },
            style: { tone: 'danger', bold: true },
          },
        ],
      },
    ]

    // VIEW_SETTINGS_KEYS 와 단언 목록이 일치하는지 확인(단언 누락 방지).
    const assertedKeys = KEY_PRESERVATION_ASSERTIONS.map((a) => a.key).sort()
    const declaredKeys = [...VIEW_SETTINGS_KEYS].sort()
    expect(assertedKeys).toEqual(declaredKeys)

    // 각 키가 실제로 round-trip 보존되는지 확인.
    for (const { key, saved, expected } of KEY_PRESERVATION_ASSERTIONS) {
      const out = toViewConfig(saved, DEFAULT_VISIBLE)
      expect(out[key], `"${key}" 가 toViewConfig 에서 보존되지 않았다`).toEqual(expected)
    }
  })

  // hideEmptyGroups 는 유일하게 `!== undefined` 가드라 명시적 false 도 보존해야 한다
  // (토글 OFF 상태 영속). truthy 가드로 회귀하면 false 가 조용히 드롭되므로 핀으로 박는다.
  it('toViewConfig 가 hideEmptyGroups=false 명시값을 보존한다', () => {
    expect(toViewConfig({ hideEmptyGroups: false }, DEFAULT_VISIBLE).hideEmptyGroups).toBe(false)
  })

  // collapseEmptyGroups 도 boolean — 토글 OFF(false) 명시값이 조용히 드롭되지 않게.
  it('toViewConfig 가 collapseEmptyGroups=false 명시값을 보존한다', () => {
    expect(toViewConfig({ collapseEmptyGroups: false }, DEFAULT_VISIBLE).collapseEmptyGroups).toBe(
      false,
    )
    expect(toViewConfig({}, DEFAULT_VISIBLE).collapseEmptyGroups).toBeUndefined()
  })

  // wrapCells 도 boolean 이므로 `!== undefined` 가드 필수 — false(토글 OFF) 명시값을 보존해야 한다.
  // truthy 가드로 회귀하면 wrapCells=false 저장 후 로드 시 줄바꿈이 켜진 것처럼 보이는 버그 발생.
  it('toViewConfig 가 wrapCells=false 명시값을 보존한다', () => {
    expect(toViewConfig({ wrapCells: false }, DEFAULT_VISIBLE).wrapCells).toBe(false)
  })

  // rowHeight 미설정 시 키 자체가 없어야 한다(부피 최소화 + 기본값=S=현행 동작 유지).
  it('rowHeight 미설정 시 키 자체가 없다(기본값=S=현행 동작)', () => {
    expect(toViewConfig({}, DEFAULT_VISIBLE).rowHeight).toBeUndefined()
  })

  // wrapCells 미설정 시 키 자체가 없어야 한다(미설정=false=현행 한 줄 클리핑).
  it('wrapCells 미설정 시 키 자체가 없다(미설정=false=현행 동작)', () => {
    expect(toViewConfig({}, DEFAULT_VISIBLE).wrapCells).toBeUndefined()
  })
})
