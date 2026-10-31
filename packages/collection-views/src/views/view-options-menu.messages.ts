import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// ViewOptionsMenu 문구(로캘별) — co-located vocab. ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  noOptions: {
    default: '설정 옵션이 없습니다.',
    en: 'No settings available.',
    'zh-Hans': '暂无设置选项。',
  } satisfies Localized,
  settings: { default: '설정', en: 'Settings', 'zh-Hans': '设置' } satisfies Localized,
  viewOptions: {
    default: '뷰 옵션',
    en: 'View options',
    'zh-Hans': '视图选项',
  } satisfies Localized,
}

export function viewOptionsMenuCopy(locale: CollectionLocale) {
  return {
    noOptions: pickLocalized(M.noOptions, locale),
    settings: pickLocalized(M.settings, locale),
    viewOptions: pickLocalized(M.viewOptions, locale),
  }
}
