import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// ListView 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  titleNone: {
    default: '제목 없음',
    en: 'Untitled',
    'zh-Hans': '无标题',
  } satisfies Localized,
  noRecords: {
    default: '레코드가 없습니다.',
    en: 'No records yet.',
    'zh-Hans': '暂无记录。',
  } satisfies Localized,
  groupNone: {
    default: '없음',
    en: 'None',
    'zh-Hans': '无',
  } satisfies Localized,
  newItem: {
    default: '새 항목',
    en: 'New item',
    'zh-Hans': '新建项',
  } satisfies Localized,
}

export function listViewCopy(locale: CollectionLocale) {
  return {
    titleNone: pickLocalized(M.titleNone, locale),
    noRecords: pickLocalized(M.noRecords, locale),
    groupNone: pickLocalized(M.groupNone, locale),
    newItem: pickLocalized(M.newItem, locale),
  }
}
