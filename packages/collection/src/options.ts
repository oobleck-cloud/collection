import { normalizeFilterRoot, normalizeViewType } from './view'

import type {
  BasePropertyDef,
  CollectionSchemaConfig,
  CollectionViewConfig,
  PropertyDef,
  SavedView,
  SelectOption,
  TagColorName,
  ViewConfig,
} from './types'

// select / multi_select 옵션 헬퍼(순수). 옵션 정규화(문자열↔리치), 안정 색, 컬렉션 스키마 머지.

/** 노션식 태그 색 팔레트(DS Tag color 이름과 일치). */
const TAG_PALETTE = ['gray', 'blue', 'green', 'orange', 'red', 'purple', 'teal'] as const

/** 팔레트 색 — DS `TagColor` 와 동일 집합(구조적 호환). select/multi_select 칩 색 타입. */
export type OptionColor = (typeof TAG_PALETTE)[number]

// OptionColor(런타임 팔레트 파생) 와 TagColorName(types.ts 리터럴 union)이 정확히 같은 집합임을 컴파일
// 타임에 고정 — 어느 한쪽에 색을 추가/오타 내면 아래 대입이 never 가 되어 에러. TagValue.color 가
// 팔레트와 어긋나지 않게 보장(양방향 extends 로 집합 동치 확인).
type _PaletteEqual = OptionColor extends TagColorName
  ? TagColorName extends OptionColor
    ? true
    : never
  : never
const _assertPaletteAligned: _PaletteEqual = true
void _assertPaletteAligned

/** 값 → 안정적인 색(해시). 같은 값은 항상 같은 색. (DS TagSelect 의 tagColorFor 과 동일 규칙) */
export function optionColor(value: string): OptionColor {
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return TAG_PALETTE[h % TAG_PALETTE.length]
}

/** options(string[] | SelectOption[]) → SelectOption[] 정규화 — label·color 를 채운다(불변). */
export function normalizeOptions(options: PropertyDef['options']): SelectOption[] {
  if (!options) return []
  return options.map((o) => {
    const opt = typeof o === 'string' ? { value: o } : o
    return {
      value: opt.value,
      label: opt.label ?? opt.value,
      color: opt.color ?? optionColor(opt.value),
    }
  })
}

/** 문자열이 유효 팔레트 색인지(타입 가드). 사용자 명시색이 팔레트 밖이면 false → 해시 폴백. */
function isOptionColor(c: string): c is OptionColor {
  return (TAG_PALETTE as readonly string[]).includes(c)
}

/**
 * select/multi_select 한 값의 노션식 칩 색 — 옵션 명시색(유효 팔레트면) 우선, 없으면 값 해시색.
 * 그룹 헤더 점(ListView)·DS TagSelect 와 동일 규칙이라 한 값은 어디서나 같은 색을 갖는다.
 */
export function resolveOptionColor(def: PropertyDef, value: string): OptionColor {
  const raw = def.options
    ? normalizeOptions(def.options).find((o) => o.value === value)?.color
    : undefined
  return raw && isOptionColor(raw) ? raw : optionColor(value)
}

/**
 * 이 컬럼의 선택지 색을 팀이 고를 수 있는가 — 플랫폼 기본은 **고를 수 있다**.
 *
 * 선택지가 있는 select/multi_select 는 표준 셀이 옵션 색으로 칩을 그리므로, 색을 바꾸면 그대로 보인다.
 * 셀을 직접 그리는 컬럼(`render`)은 옵션 색을 쓰는지 플랫폼이 알 수 없어 `colorEditable: true` 로
 * 밝힌 때만 연다 — 아니면 골라도 아무것도 안 바뀌는 메뉴가 된다. `false` 면 언제나 닫는다.
 */
export function isOptionColorEditable(def: PropertyDef): boolean {
  if (def.type !== 'select' && def.type !== 'multi_select') return false
  if (normalizeOptions(def.options).length === 0) return false
  if (def.colorEditable !== undefined) return def.colorEditable
  return !def.render
}

/**
 * 사용자 동적 베이스(JSON 안전) → PropertyDef[] 변환. origin='base', source='frontmatter' 고정.
 * 팩 schema 키와 충돌하면 base 가 우선(D-8 §3: 사용자 자유 확장 > 정적 프리셋).
 */
export function basePropertyDefs(base: BasePropertyDef[] | undefined): PropertyDef[] {
  if (!base || base.length === 0) return []
  const seen = new Set<string>()
  const result: PropertyDef[] = []
  for (const b of base) {
    if (seen.has(b.key)) continue
    seen.add(b.key)
    result.push({
      key: b.key,
      label: b.label,
      type: b.type,
      source: 'frontmatter',
      origin: 'base',
      ...(b.options !== undefined ? { options: b.options } : {}),
      ...(b.locked !== undefined ? { locked: b.locked } : {}),
      ...(b.inherited !== undefined ? { inherited: b.inherited } : {}),
      ...(b.width !== undefined ? { width: b.width } : {}),
      ...(b.relation !== undefined ? { relation: b.relation } : {}),
      ...(b.required !== undefined ? { required: b.required } : {}),
    })
  }
  return result
}

/**
 * 팩 기본 스키마(PropertyDef[]) 위에 컬렉션 Document 의 오버라이드를 머지(불변).
 *  - properties[key]: 옵션·잠금 패치(팩 정의 프로퍼티에 한해)
 *  - base[]: 사용자 동적 베이스 컬럼 — 결과의 *앞*에 끼운다(D-8 §3 base-first).
 *    base 키가 팩 키와 충돌하면 base 가 우선(팩 정의는 흡수돼 중복 없음).
 *
 * config 가 없거나 효과적 변화가 없으면 입력 참조를 그대로 반환(테스트의 동일 참조 단언과 호환).
 */
export function applySchemaConfig(
  packSchema: PropertyDef[],
  config?: CollectionSchemaConfig,
): PropertyDef[] {
  const userBase = basePropertyDefs(config?.base)
  const overrides = config?.properties
  if (userBase.length === 0 && !overrides) return packSchema

  const overridden = !overrides
    ? packSchema
    : packSchema.map((def) => {
        const ov = overrides[def.key]
        if (!ov) return def
        return {
          ...def,
          ...(ov.label !== undefined ? { label: ov.label } : {}),
          ...(ov.options !== undefined ? { options: ov.options } : {}),
          ...(ov.locked !== undefined ? { locked: ov.locked } : {}),
          ...(ov.width !== undefined ? { width: ov.width } : {}),
        }
      })

  if (userBase.length === 0) return overridden

  // base 키가 팩 키와 충돌하면 base 가 이긴다 — 팩 정의에서 그 키를 제거하고, base 를 앞에 둔다.
  const baseKeys = new Set(userBase.map((b) => b.key))
  const tail = overridden.filter((d) => !baseKeys.has(d.key))
  return [...userBase, ...tail]
}

// ─── SavedView 결정·마이그레이션 ──────────────────────────────────────────────

/** 기본 뷰 id — 레거시 단일 view 가 마이그레이션될 때 또는 빈 컬렉션의 초기 뷰 id. */
export const DEFAULT_VIEW_ID = 'default'
export const DEFAULT_VIEW_NAME = '기본'

/**
 * 저장된 config 에서 SavedView[] 를 결정한다 — 노션식 다중 뷰. 마이그레이션·폴백 규칙:
 *  1) config.views 가 있고 비어있지 않으면 그대로 사용.
 *  2) 없거나 비었으면 레거시 config.view 를 단일 SavedView 로 변환(id='default', name='기본').
 *  3) 둘 다 없으면 빈 기본 뷰 하나(`{visibleProps, sort, filters} = 미지정`).
 * 호출자(상위)가 보장: 결과 배열은 *최소 1개 뷰* 를 포함한다.
 */
export function resolveSavedViews(config: CollectionSchemaConfig | undefined | null): SavedView[] {
  if (config?.views && config.views.length > 0) return config.views
  const legacy: CollectionViewConfig | undefined = config?.view
  return [
    {
      id: DEFAULT_VIEW_ID,
      name: DEFAULT_VIEW_NAME,
      config: legacy ?? {},
    },
  ]
}

/**
 * 활성 뷰 결정 — activeViewId 가 views 에 존재하면 그것, 아니면 첫 뷰. resolveSavedViews 가 비어있지 않음을 보장.
 */
export function resolveActiveView(config: CollectionSchemaConfig | undefined | null): SavedView {
  const views = resolveSavedViews(config)
  const wantedId = config?.activeViewId
  return views.find((v) => v.id === wantedId) ?? views[0]
}

// ─── toViewConfig drift-proof 가드 ───────────────────────────────────────────
//
// ViewConfig 에서 toViewConfig 가 "있을 때만 옮기는" optional 설정 키 집합을 타입 수준에서 고정한다.
//
// 새 optional 설정 필드를 ViewConfig 에 추가하면:
//   1) VIEW_SETTINGS_KEYS 배열에 추가하지 않으면 _AssertSettingsKeysExhaustive 가 컴파일 에러.
//   2) options.test.ts 의 "toViewConfig 보존 키 목록" 단언도 업데이트해야 테스트 녹색.
//
// type / filters / sort / visibleProps 는 toViewConfig 가 항상 채우므로 제외.

/** toViewConfig 가 optional 전달을 담당하는 ViewConfig 설정 키 집합. */
type ViewConfigSettingsKey = keyof Omit<ViewConfig, 'type' | 'filters' | 'sort' | 'visibleProps'>

/**
 * ViewConfig optional 설정 키 목록 — EXHAUSTIVE.
 * ViewConfig 에 새 optional 필드를 추가하면 아래 _AssertSettingsKeysExhaustive 가 컴파일 에러를 낸다.
 * 그때 이 배열에 키를 추가하고, options.test.ts 의 KEY_PRESERVATION_ASSERTIONS 도 업데이트할 것.
 */
export const VIEW_SETTINGS_KEYS = [
  'groupBy',
  'aggregations',
  'cardOrder',
  'rowOrder',
  'coverKey',
  'cardSize',
  'timeline',
  'hideEmptyGroups',
  'rowHeight',
  'wrapCells',
  'groupSort',
  'conditionalFormats',
] as const satisfies readonly ViewConfigSettingsKey[]

/**
 * 양방향 완전성 체크 — VIEW_SETTINGS_KEYS 가 ViewConfigSettingsKey 를 빠짐없이 커버함을 컴파일 타임에 보장.
 * ViewConfig 에 새 optional 필드가 추가되면 이 타입이 never 가 되어 아래 대입에서 TS 에러가 난다.
 */
type _AssertSettingsKeysExhaustive =
  ViewConfigSettingsKey extends (typeof VIEW_SETTINGS_KEYS)[number] ? true : never
const _settingsKeysExhaustiveCheck: _AssertSettingsKeysExhaustive = true
void _settingsKeysExhaustiveCheck // 미사용 변수 경고 방지

/**
 * 저장된 부분 view config(CollectionViewConfig) → 렌더러가 받는 ViewConfig(빈 필드 채움).
 *  - type: 레거시 'grid' → 'gallery', 미지정 → 'table'(normalizeViewType).
 *  - filters: 레거시 평탄 Filter[] → FilterGroup 루트로 정규화(normalizeFilterRoot, 하위호환).
 *  - sort/visibleProps: 미지정 시 빈 배열 / defaultVisible 폴백.
 *  - groupBy/aggregations/cardOrder/coverKey/cardSize/timeline: 있을 때만 옮긴다(optional 보존).
 *    ※ 이 목록이 VIEW_SETTINGS_KEYS 와 일치함을 컴파일 타임에 보장(위 가드).
 * 순수 함수 — 입력을 변형하지 않는다(useCollectionViews 가 소비).
 */
export function toViewConfig(saved: CollectionViewConfig, defaultVisible: string[]): ViewConfig {
  return {
    type: normalizeViewType(saved.type),
    filters: normalizeFilterRoot(saved.filters),
    sort: saved.sort ?? [],
    visibleProps: saved.visibleProps ?? defaultVisible,
    ...(saved.groupBy ? { groupBy: saved.groupBy } : {}),
    ...(saved.aggregations ? { aggregations: saved.aggregations } : {}),
    ...(saved.cardOrder ? { cardOrder: saved.cardOrder } : {}),
    ...(saved.rowOrder ? { rowOrder: saved.rowOrder } : {}),
    ...(saved.coverKey ? { coverKey: saved.coverKey } : {}),
    ...(saved.cardSize ? { cardSize: saved.cardSize } : {}),
    ...(saved.timeline ? { timeline: saved.timeline } : {}),
    ...(saved.hideEmptyGroups !== undefined ? { hideEmptyGroups: saved.hideEmptyGroups } : {}),
    ...(saved.rowHeight ? { rowHeight: saved.rowHeight } : {}),
    ...(saved.wrapCells !== undefined ? { wrapCells: saved.wrapCells } : {}),
    ...(saved.groupSort ? { groupSort: saved.groupSort } : {}),
    // 빈 배열도 "규칙 없음"과 같지만, 사용자가 규칙을 다 지운 상태를 그대로 보존한다
    // (length 로 거르면 마지막 규칙 삭제가 undefined 로 접혀 이후 diff·영속이 헷갈린다).
    ...(saved.conditionalFormats ? { conditionalFormats: saved.conditionalFormats } : {}),
  }
}

/** 스키마(PropertyDef[]) → Document 저장용 오버라이드(JSON 안전: 옵션·잠금만, format 함수 제외). */
export function toSchemaConfig(props: PropertyDef[]): CollectionSchemaConfig {
  const properties: Record<string, { options?: SelectOption[]; locked?: boolean }> = {}
  for (const def of props) {
    if (def.options === undefined && def.locked === undefined) continue
    properties[def.key] = {
      ...(def.options !== undefined ? { options: normalizeOptions(def.options) } : {}),
      ...(def.locked !== undefined ? { locked: def.locked } : {}),
    }
  }
  return { properties }
}
