import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// FilterChipRail 문구(로캘별) — co-located vocab. 연산자 라벨은 ViewToolbar.messages 의
// opLabel 을 재사용한다(어휘 이원화 방지). 여기는 레일 고유 문구만.
const M = {
  addFilter: {
    default: '필터',
    en: 'Filter',
    'zh-Hans': '筛选',
  } satisfies Localized,
  addFilterAria: {
    default: '필터 추가',
    en: 'Add filter',
    'zh-Hans': '添加筛选',
  } satisfies Localized,
  clearAll: {
    default: '모두 지우기',
    en: 'Clear all',
    'zh-Hans': '全部清除',
  } satisfies Localized,
  groupChip: {
    default: '그룹 · {count}',
    en: 'Group · {count}',
    'zh-Hans': '组 · {count}',
  } satisfies Localized,
  removeChip: {
    default: '{label} 필터 제거',
    en: 'Remove {label} filter',
    'zh-Hans': '移除 {label} 筛选',
  } satisfies Localized,
  editChip: {
    default: '{label} 필터 편집',
    en: 'Edit {label} filter',
    'zh-Hans': '编辑 {label} 筛选',
  } satisfies Localized,
}

export function filterChipRailCopy(locale: CollectionLocale) {
  return {
    addFilter: pickLocalized(M.addFilter, locale),
    addFilterAria: pickLocalized(M.addFilterAria, locale),
    clearAll: pickLocalized(M.clearAll, locale),
    groupChip: (count: number) =>
      pickLocalized(M.groupChip, locale).replace('{count}', String(count)),
    removeChip: (label: string) => pickLocalized(M.removeChip, locale).replace('{label}', label),
    editChip: (label: string) => pickLocalized(M.editChip, locale).replace('{label}', label),
  }
}
