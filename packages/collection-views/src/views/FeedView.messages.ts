import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// FeedView 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  noRecords: {
    default: '레코드가 없습니다.',
    en: 'No records yet.',
    'zh-Hans': '暂无记录。',
  } satisfies Localized,
  newItem: {
    default: '새 항목',
    en: 'New item',
    'zh-Hans': '新建项',
  } satisfies Localized,
}

export function feedViewCopy(locale: CollectionLocale) {
  return {
    noRecords: pickLocalized(M.noRecords, locale),
    newItem: pickLocalized(M.newItem, locale),
  }
}
