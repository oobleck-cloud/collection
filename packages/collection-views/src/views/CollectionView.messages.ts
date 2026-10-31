import { pickLocalized, type CollectionLocale, type Localized } from '../i18n'

// CollectionView 문구(로캘별) — co-located vocab 패턴의 레퍼런스. 각 뷰는 이 형태의 `<view>.messages.ts` 를
// 옆에 두고 `xxxCopy(locale)` 로 해석한다. ko(default)는 기존 하드코딩과 바이트 동일(파리티), en·zh-Hans 는 관용 번역.
const M = {
  viewPreparing: {
    default: '{label} 뷰는 준비 중입니다.',
    en: 'The {label} view is coming soon.',
    'zh-Hans': '{label} 视图正在开发中。',
  } satisfies Localized,
  unknownView: {
    default: '알 수 없는 뷰: {kind}',
    en: 'Unknown view: {kind}',
    'zh-Hans': '未知视图：{kind}',
  } satisfies Localized,
}

export function collectionViewCopy(locale: CollectionLocale) {
  return {
    viewPreparing: (label: string) =>
      pickLocalized(M.viewPreparing, locale).replace('{label}', label),
    unknownView: (kind: string) => pickLocalized(M.unknownView, locale).replace('{kind}', kind),
  }
}
