import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'
import type { FilterOp } from '@oobleck/collection'

// ViewToolbar 문구(로캘별) — co-located vocab. ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.

/** 필터 연산자 라벨(로캘별). 부등호 기호(>, ≥, <, ≤)는 로캘 무관 — default 만 둔다. */
const OP: Record<FilterOp, Localized> = {
  eq: { default: '같음', en: 'Equals', 'zh-Hans': '等于' },
  neq: { default: '다름', en: 'Not equal', 'zh-Hans': '不等于' },
  contains: { default: '포함', en: 'Contains', 'zh-Hans': '包含' },
  not_contains: { default: '미포함', en: 'Does not contain', 'zh-Hans': '不包含' },
  gt: { default: '>' },
  gte: { default: '≥' },
  lt: { default: '<' },
  lte: { default: '≤' },
  has: { default: '포함', en: 'Contains', 'zh-Hans': '包含' },
  not_has: { default: '미포함', en: 'Does not contain', 'zh-Hans': '不包含' },
  is_empty: { default: '비어있음', en: 'Is empty', 'zh-Hans': '为空' },
  is_not_empty: { default: '값 있음', en: 'Has value', 'zh-Hans': '有值' },
}

const M = {
  dateModeFixed: {
    default: '고정 날짜',
    en: 'Fixed date',
    'zh-Hans': '固定日期',
  } satisfies Localized,
  checkboxChecked: { default: '체크됨', en: 'Checked', 'zh-Hans': '已勾选' } satisfies Localized,
  checkboxUnchecked: {
    default: '미체크',
    en: 'Unchecked',
    'zh-Hans': '未勾选',
  } satisfies Localized,
  selectValuePlaceholder: {
    default: '값 선택',
    en: 'Select value',
    'zh-Hans': '选择值',
  } satisfies Localized,
  valuePlaceholder: { default: '값', en: 'Value', 'zh-Hans': '值' } satisfies Localized,

  noSort: {
    default: '아직 정렬 기준이 없습니다.',
    en: 'No sort applied yet.',
    'zh-Hans': '尚无排序条件。',
  } satisfies Localized,
  toggleDirection: {
    default: '방향 전환',
    en: 'Toggle direction',
    'zh-Hans': '切换方向',
  } satisfies Localized,
  ascShort: { default: '오름', en: 'Asc', 'zh-Hans': '升序' } satisfies Localized,
  descShort: { default: '내림', en: 'Desc', 'zh-Hans': '降序' } satisfies Localized,
  remove: { default: '제거', en: 'Remove', 'zh-Hans': '移除' } satisfies Localized,
  addSort: {
    default: '+ 정렬 추가',
    en: '+ Add sort',
    'zh-Hans': '+ 添加排序',
  } satisfies Localized,

  groupCombinatorAria: {
    default: '그룹 조합자: {op}. 클릭하면 전환.',
    en: 'Group combinator: {op}. Click to toggle.',
    'zh-Hans': '分组组合方式：{op}。点击切换。',
  } satisfies Localized,
  groupLabel: { default: '그룹', en: 'Group', 'zh-Hans': '分组' } satisfies Localized,
  removeGroup: {
    default: '그룹 제거',
    en: 'Remove group',
    'zh-Hans': '移除分组',
  } satisfies Localized,
  combine: { default: '조건 결합:', en: 'Combine:', 'zh-Hans': '条件组合：' } satisfies Localized,
  andAria: {
    default: 'AND 결합',
    en: 'Combine with AND',
    'zh-Hans': '以 AND 组合',
  } satisfies Localized,
  orAria: {
    default: 'OR 결합',
    en: 'Combine with OR',
    'zh-Hans': '以 OR 组合',
  } satisfies Localized,
  noFilterRoot: {
    default: '아직 필터 조건이 없습니다.',
    en: 'No filters applied yet.',
    'zh-Hans': '尚无筛选条件。',
  } satisfies Localized,
  noFilterGroup: {
    default: '조건이 없습니다.',
    en: 'No conditions.',
    'zh-Hans': '暂无条件。',
  } satisfies Localized,
  addFilter: {
    default: '+ 필터 추가',
    en: '+ Add filter',
    'zh-Hans': '+ 添加筛选',
  } satisfies Localized,
  addFilterGroup: {
    default: '+ 필터 그룹 추가',
    en: '+ Add filter group',
    'zh-Hans': '+ 添加筛选分组',
  } satisfies Localized,

  searchPlaceholder: {
    default: '검색...',
    en: 'Search...',
    'zh-Hans': '搜索…',
  } satisfies Localized,
  closeSearch: {
    default: '검색 닫기',
    en: 'Close search',
    'zh-Hans': '关闭搜索',
  } satisfies Localized,
  search: { default: '검색', en: 'Search', 'zh-Hans': '搜索' } satisfies Localized,

  createDefault: { default: '새로 만들기', en: 'New', 'zh-Hans': '新建' } satisfies Localized,
  expand: { default: '확장', en: 'Expand', 'zh-Hans': '展开' } satisfies Localized,
  sort: { default: '정렬', en: 'Sort', 'zh-Hans': '排序' } satisfies Localized,
  filterBadge: {
    default: '필터 {count}',
    en: 'Filters {count}',
    'zh-Hans': '筛选 {count}',
  } satisfies Localized,
  filter: { default: '필터', en: 'Filter', 'zh-Hans': '筛选' } satisfies Localized,
  collapse: { default: '축소', en: 'Collapse', 'zh-Hans': '收起' } satisfies Localized,
}

export function viewToolbarCopy(locale: CollectionLocale) {
  return {
    dateModeFixed: pickLocalized(M.dateModeFixed, locale),
    opLabel: (op: FilterOp) => pickLocalized(OP[op], locale),
    checkboxChecked: pickLocalized(M.checkboxChecked, locale),
    checkboxUnchecked: pickLocalized(M.checkboxUnchecked, locale),
    selectValuePlaceholder: pickLocalized(M.selectValuePlaceholder, locale),
    valuePlaceholder: pickLocalized(M.valuePlaceholder, locale),
    noSort: pickLocalized(M.noSort, locale),
    toggleDirection: pickLocalized(M.toggleDirection, locale),
    ascShort: pickLocalized(M.ascShort, locale),
    descShort: pickLocalized(M.descShort, locale),
    remove: pickLocalized(M.remove, locale),
    addSort: pickLocalized(M.addSort, locale),
    groupCombinatorAria: (op: string) =>
      pickLocalized(M.groupCombinatorAria, locale).replace('{op}', op),
    groupLabel: pickLocalized(M.groupLabel, locale),
    removeGroup: pickLocalized(M.removeGroup, locale),
    combine: pickLocalized(M.combine, locale),
    andAria: pickLocalized(M.andAria, locale),
    orAria: pickLocalized(M.orAria, locale),
    noFilterRoot: pickLocalized(M.noFilterRoot, locale),
    noFilterGroup: pickLocalized(M.noFilterGroup, locale),
    addFilter: pickLocalized(M.addFilter, locale),
    addFilterGroup: pickLocalized(M.addFilterGroup, locale),
    searchPlaceholder: pickLocalized(M.searchPlaceholder, locale),
    closeSearch: pickLocalized(M.closeSearch, locale),
    search: pickLocalized(M.search, locale),
    createDefault: pickLocalized(M.createDefault, locale),
    expand: pickLocalized(M.expand, locale),
    sort: pickLocalized(M.sort, locale),
    filterBadge: (count: number) =>
      pickLocalized(M.filterBadge, locale).replace('{count}', String(count)),
    filter: pickLocalized(M.filter, locale),
    collapse: pickLocalized(M.collapse, locale),
  }
}
