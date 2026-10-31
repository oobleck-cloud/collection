import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// RecordCard 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  noTitle: {
    default: '제목 없음',
    en: 'Untitled',
    'zh-Hans': '无标题',
  } satisfies Localized,
}

export function recordCardCopy(locale: CollectionLocale) {
  return {
    noTitle: pickLocalized(M.noTitle, locale),
  }
}
