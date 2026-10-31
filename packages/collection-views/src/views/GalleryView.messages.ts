import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// GalleryView 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  groupNone: {
    default: '없음',
    en: 'None',
    'zh-Hans': '无',
  } satisfies Localized,
  newCard: {
    default: '새 카드',
    en: 'New card',
    'zh-Hans': '新建卡片',
  } satisfies Localized,
  noRecords: {
    default: '레코드가 없습니다.',
    en: 'No records yet.',
    'zh-Hans': '暂无记录。',
  } satisfies Localized,
}

export function galleryViewCopy(locale: CollectionLocale) {
  return {
    groupNone: pickLocalized(M.groupNone, locale),
    newCard: pickLocalized(M.newCard, locale),
    noRecords: pickLocalized(M.noRecords, locale),
  }
}
