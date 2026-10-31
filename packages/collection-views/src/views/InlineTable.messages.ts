import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// InlineTable / InlineTableRow 문구(로캘별). ko(default)는 기존 하드코딩과 바이트 동일(파리티),
// en·zh-Hans 는 관용 번역.
const M = {
  count: {
    default: '{count}개',
    en: '{count}',
    'zh-Hans': '{count}个',
  } satisfies Localized,
  rowMove: {
    default: '행 이동',
    en: 'Move row',
    'zh-Hans': '移动行',
  } satisfies Localized,
}

export function inlineTableCopy(locale: CollectionLocale) {
  return {
    count: (count: number) => pickLocalized(M.count, locale).replace('{count}', String(count)),
    rowMove: pickLocalized(M.rowMove, locale),
  }
}
