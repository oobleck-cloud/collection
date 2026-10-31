import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// PersonCell 문구(로캘별).
const M = {
  placeholder: {
    default: '사람 선택',
    en: 'Select person',
    'zh-Hans': '选择人员',
  } satisfies Localized,
  search: {
    default: '이름·이메일 검색',
    en: 'Search name or email',
    'zh-Hans': '搜索姓名或邮箱',
  } satisfies Localized,
  noResults: {
    default: '결과 없음',
    en: 'No results',
    'zh-Hans': '无结果',
  } satisfies Localized,
  remove: {
    default: '빼기',
    en: 'Remove',
    'zh-Hans': '移除',
  } satisfies Localized,
}

export function personCellCopy(locale: CollectionLocale) {
  return {
    placeholder: pickLocalized(M.placeholder, locale),
    search: pickLocalized(M.search, locale),
    noResults: pickLocalized(M.noResults, locale),
    remove: pickLocalized(M.remove, locale),
  }
}
