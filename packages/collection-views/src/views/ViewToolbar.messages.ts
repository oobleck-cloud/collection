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
  in: { default: '다음 중 하나', en: 'Is any of', 'zh-Hans': '属于其中之一' },
  not_in: { default: '다음 중 아님', en: 'Is none of', 'zh-Hans': '不属于其中任何一个' },
  is_empty: { default: '비어있음', en: 'Is empty', 'zh-Hans': '为空' },
  is_not_empty: { default: '값 있음', en: 'Has value', 'zh-Hans': '有值' },
}

const M = {
  dateModeFixed: {
    default: '고정 날짜',
    en: 'Fixed date',
    'zh-Hans': '固定日期',
  } satisfies Localized,
  dateTimeOfDay: { default: '시각', en: 'Time', 'zh-Hans': '时间' } satisfies Localized,
  dateModeCustomDay: {
    default: 'N일 전/후 (직접)',
    en: 'N days ago/later (custom)',
    'zh-Hans': 'N 天前/后（自定义）',
  } satisfies Localized,
  dateModeCustomHour: {
    default: 'N시간 전/후 (직접)',
    en: 'N hours ago/later (custom)',
    'zh-Hans': 'N 小时前/后（自定义）',
  } satisfies Localized,
  relativeDayCount: { default: '일 수', en: 'Days', 'zh-Hans': '天数' } satisfies Localized,
  relativeHourCount: { default: '시간 수', en: 'Hours', 'zh-Hans': '小时数' } satisfies Localized,
  /** 「직접」 숫자 칸 옆의 단위 글 — NumberInput 은 단위를 그리지 않는다. */
  relativeDayUnit: { default: '일', en: 'days', 'zh-Hans': '天' } satisfies Localized,
  relativeHourUnit: { default: '시간', en: 'hours', 'zh-Hans': '小时' } satisfies Localized,
  relativeDirection: { default: '방향', en: 'Direction', 'zh-Hans': '方向' } satisfies Localized,
  relativePast: { default: '전', en: 'Ago', 'zh-Hans': '前' } satisfies Localized,
  relativeFuture: { default: '후', en: 'Later', 'zh-Hans': '后' } satisfies Localized,
  relativeDayOrdinal: {
    default: '{n}일 차',
    en: 'Day {n}',
    'zh-Hans': '第 {n} 天',
  } satisfies Localized,
  relativeNow: { default: '지금', en: 'Now', 'zh-Hans': '现在' } satisfies Localized,
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

  rollupCount: { default: '개수', en: 'Count', 'zh-Hans': '数量' } satisfies Localized,
  rollupSum: { default: '합계', en: 'sum', 'zh-Hans': '合计' } satisfies Localized,
  rollupMin: { default: '최소', en: 'min', 'zh-Hans': '最小' } satisfies Localized,
  rollupMax: { default: '최대', en: 'max', 'zh-Hans': '最大' } satisfies Localized,
  rollupAvg: { default: '평균', en: 'avg', 'zh-Hans': '平均' } satisfies Localized,
  rollupGroup: { default: '관계', en: 'Relations', 'zh-Hans': '关联' } satisfies Localized,
  rollupSourceOption: {
    default: '{source} (집계)',
    en: '{source} (rollup)',
    'zh-Hans': '{source}（汇总）',
  } satisfies Localized,
  rollupWhere: {
    default: '이어진 {source} 중',
    en: 'Of linked {source} where',
    'zh-Hans': '关联的{source}中',
  } satisfies Localized,
  rollupAllLinked: {
    default: '조건 없음 — 이어진 {source} 전부',
    en: 'No conditions — all linked {source}',
    'zh-Hans': '无条件 — 全部关联{source}',
  } satisfies Localized,
  rollupAddCondition: {
    default: '+ {source} 조건',
    en: '+ {source} condition',
    'zh-Hans': '+ {source}条件',
  } satisfies Localized,
  relationSearchPlaceholder: {
    default: '검색해서 고르기',
    en: 'Search to pick',
    'zh-Hans': '搜索并选择',
  } satisfies Localized,
  collapse: { default: '축소', en: 'Collapse', 'zh-Hans': '收起' } satisfies Localized,
}

export function viewToolbarCopy(locale: CollectionLocale) {
  return {
    dateModeFixed: pickLocalized(M.dateModeFixed, locale),
    dateTimeOfDay: pickLocalized(M.dateTimeOfDay, locale),
    dateModeCustomDay: pickLocalized(M.dateModeCustomDay, locale),
    dateModeCustomHour: pickLocalized(M.dateModeCustomHour, locale),
    relativeDayCount: pickLocalized(M.relativeDayCount, locale),
    relativeHourCount: pickLocalized(M.relativeHourCount, locale),
    relativeDayUnit: pickLocalized(M.relativeDayUnit, locale),
    relativeHourUnit: pickLocalized(M.relativeHourUnit, locale),
    relativeDirection: pickLocalized(M.relativeDirection, locale),
    relativePast: pickLocalized(M.relativePast, locale),
    relativeFuture: pickLocalized(M.relativeFuture, locale),
    relativeDayOrdinal: (n: number) =>
      pickLocalized(M.relativeDayOrdinal, locale).replace('{n}', String(n)),
    relativeNow: pickLocalized(M.relativeNow, locale),
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
    rollupCount: pickLocalized(M.rollupCount, locale),
    rollupAgg: {
      sum: pickLocalized(M.rollupSum, locale),
      min: pickLocalized(M.rollupMin, locale),
      max: pickLocalized(M.rollupMax, locale),
      avg: pickLocalized(M.rollupAvg, locale),
    },
    rollupGroup: pickLocalized(M.rollupGroup, locale),
    rollupSourceOption: (source: string) =>
      pickLocalized(M.rollupSourceOption, locale).replace('{source}', source),
    rollupWhere: (source: string) =>
      pickLocalized(M.rollupWhere, locale).replace('{source}', source),
    rollupAllLinked: (source: string) =>
      pickLocalized(M.rollupAllLinked, locale).replace('{source}', source),
    rollupAddCondition: (source: string) =>
      pickLocalized(M.rollupAddCondition, locale).replace('{source}', source),
    relationSearchPlaceholder: pickLocalized(M.relationSearchPlaceholder, locale),
    collapse: pickLocalized(M.collapse, locale),
  }
}
