import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// RelationCell 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  selectRelation: {
    default: '관계 선택',
    en: 'Select relation',
    'zh-Hans': '选择关系',
  } satisfies Localized,
  openLinked: {
    default: '연결 대상 열기',
    en: 'Open linked record',
    'zh-Hans': '打开关联对象',
  } satisfies Localized,
  search: {
    default: '검색',
    en: 'Search',
    'zh-Hans': '搜索',
  } satisfies Localized,
  noResults: {
    default: '결과 없음',
    en: 'No results',
    'zh-Hans': '无结果',
  } satisfies Localized,
}

export function relationCellCopy(locale: CollectionLocale) {
  return {
    selectRelation: pickLocalized(M.selectRelation, locale),
    openLinked: pickLocalized(M.openLinked, locale),
    search: pickLocalized(M.search, locale),
    noResults: pickLocalized(M.noResults, locale),
  }
}
